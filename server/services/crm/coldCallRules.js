'use strict';
/**
 * coldCallRules.js — pure rules for the admin Cold Calling tab (no I/O).
 *
 * Phone parsing for scraped calling lists, the outcome → next-step table, and
 * the call-queue order (callbacks due → retries due → fresh by sort_key), and the
 * daily plan (DAILY_TARGET calls/day including callbacks and retries).
 * Calling state lives in leads.attributes.cold_call; callbacks are open
 * lead_follow_ups rows titled "Callback: …".
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 330 * 60 * 1000;            // UTC+5:30
const DUE_SOON_MS = 15 * 60 * 1000;        // a callback within 15 min is "due"
const MAX_NO_ANSWER = 3;                   // 3rd no-answer → unreachable, leaves the queue
const CALLBACK_PREFIX = 'Callback:';
const NOT_CONNECTED = new Set(['no_answer', 'wrong_number']);
// ponytail: one caller, fixed target — make it a setting when a team calls.
const DAILY_TARGET = 60;

const OUTCOMES = {
  interested:     { template: 'cold_call_interested', status: 'qualified', close: true },
  details:        { template: 'cold_call_details',    status: 'contacted', retryDays: 3 },
  callback:       { template: 'cold_call_callback',   status: 'contacted', needsCallbackAt: true },
  not_now:        { template: 'cold_call_nurture',    status: 'contacted', retryDays: 30 },
  not_interested: { template: null, dnc: true, close: true },
  no_answer:      { template: null, retryDays: 1 },
  wrong_number:   { template: null, close: true, tag: 'wrong-number' },
};

// '08888705552' | '+91 88887 05552' | '918888705552' | '8888705552' → '8888705552'
function phone10(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  return null;
}

// Scraped WhatsApp column: wa.me/<n>, api.whatsapp.com/send?phone=<n>, or junk.
function waPhone10(raw) {
  const m = String(raw || '').match(/(?:wa\.me\/|[?&](?:amp;)?phone=)\+?(\d{10,13})/);
  return m ? phone10(m[1]) : null;
}

function nextStep(outcome, coldCall = {}, now = new Date(), callbackAt = null) {
  const rule = OUTCOMES[outcome];
  if (!rule) throw new Error(`unknown outcome: ${outcome}`);
  if (rule.needsCallbackAt && !(callbackAt && !Number.isNaN(new Date(callbackAt).getTime()))) {
    throw new Error('callbackAt required');
  }
  const attempts = (coldCall.attempts || 0) + 1;
  const noAnswers = (coldCall.no_answers || 0) + (outcome === 'no_answer' ? 1 : 0);
  let closed = !!rule.close;
  let closedReason = rule.close ? outcome : null;
  let retryAt = rule.retryDays ? new Date(now.getTime() + rule.retryDays * DAY_MS).toISOString() : null;
  if (outcome === 'no_answer' && noAnswers >= MAX_NO_ANSWER) { closed = true; closedReason = 'unreachable'; retryAt = null; }
  // Safety net: if the Callback task is closed elsewhere (Follow-ups page), the lead
  // resurfaces as a retry at the callback time instead of vanishing. buildQueue keeps
  // a lead with an open Callback out of retries, so it never shows twice.
  if (rule.needsCallbackAt) retryAt = new Date(callbackAt).toISOString();
  return {
    cold_call: {
      ...coldCall, attempts, no_answers: noAnswers, last_outcome: outcome,
      last_called_at: now.toISOString(), retry_at: retryAt, closed, closed_reason: closedReason,
    },
    status: rule.status || null,
    dnc: !!rule.dnc,
    tag: rule.tag || null,
    template: rule.template,
    callbackAt: rule.needsCallbackAt ? new Date(callbackAt).toISOString() : null,
  };
}

const num = (v, miss) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : miss; };
const cc = (l) => l.attributes?.cold_call || {};
const pad = (n, w) => String(n).padStart(w, '0');

// Text-sortable call order, stored at import so the DB can ORDER BY it and fetch
// only today's slice: Day asc → Priority asc ('P1' → 1) → Fit desc. Missing → last.
function sortKey({ day, priority, fit } = {}) {
  return [
    pad(Math.min(num(day, 999), 999), 3),
    pad(Math.min(num(priority, 9999), 9999), 4),
    pad(100 - Math.min(num(fit, 0), 100), 3),
  ].join('.');
}

// Fresh leads to serve today: what's left of the target after today's calls,
// the callbacks still due today and the retries due now. Never negative.
function freshSlots({ target = DAILY_TARGET, callsToday = 0, callbacksToday = 0, retries = 0 } = {}) {
  return Math.max(0, target - callsToday - callbacksToday - retries);
}

const eligible = (l) => !!l && !l.do_not_contact && l.status !== 'do_not_contact';

function buildQueue(leads = [], followUps = [], now = new Date()) {
  const t = now.getTime();
  const byId = new Map(leads.map((l) => [l.id, l]));
  const callbacksDue = [];
  const upcoming = [];
  const hasCallback = new Set();
  for (const f of followUps) {
    const lead = byId.get(f.lead_id);
    if (!eligible(lead) || !String(f.title || '').startsWith(CALLBACK_PREFIX)) continue;
    hasCallback.add(lead.id);
    const due = new Date(f.due_at).getTime();
    const item = { lead, followUp: f, dueAt: f.due_at, overdue: due < t };
    (due <= t + DUE_SOON_MS ? callbacksDue : upcoming).push(item);
  }
  const open = leads.filter((l) => eligible(l) && !cc(l).closed && !hasCallback.has(l.id));
  const retries = open
    .filter((l) => cc(l).retry_at && new Date(cc(l).retry_at).getTime() <= t)
    .sort((a, b) => new Date(cc(a).retry_at) - new Date(cc(b).retry_at))
    .map((lead) => ({ lead }));
  const fresh = open
    .filter((l) => !(cc(l).attempts > 0))
    .sort((a, b) => sortKey(cc(a)).localeCompare(sortKey(cc(b))))
    .map((lead) => ({ lead }));
  const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
  return { callbacksDue: callbacksDue.sort(byDue), retries, fresh, upcoming: upcoming.sort(byDue) };
}

function todayStats(outcomes = []) {
  return {
    calls: outcomes.length,
    connected: outcomes.filter((o) => o && !NOT_CONNECTED.has(o)).length,
    interested: outcomes.filter((o) => o === 'interested').length,
  };
}

// Overview: count call outcomes and the objections raised on them.
function outcomeMix(metas = []) {
  const byOutcome = {};
  const objections = {};
  for (const m of metas) {
    if (!m?.outcome || !OUTCOMES[m.outcome]) continue;
    byOutcome[m.outcome] = (byOutcome[m.outcome] || 0) + 1;
    if (m.objection) objections[m.objection] = (objections[m.objection] || 0) + 1;
  }
  const top = Object.entries(objections).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => ({ label, n }));
  return { byOutcome, objections: top, ...todayStats(metas.filter((m) => m?.outcome && OUTCOMES[m.outcome]).map((m) => m.outcome)) };
}

// Overview: open callbacks split into overdue / later today / tomorrow (IST days).
function followUpBuckets(followUps = [], now = new Date()) {
  const t = now.getTime();
  const endToday = new Date(istDayEnd(now)).getTime();
  const endTomorrow = endToday + DAY_MS;
  const out = { overdue: 0, today: 0, tomorrow: 0, later: 0 };
  for (const f of followUps) {
    const due = new Date(f.due_at).getTime();
    if (due < t) out.overdue++;
    else if (due < endToday) out.today++;
    else if (due < endTomorrow) out.tomorrow++;
    else out.later++;
  }
  return out;
}

// A message that left our side (any later delivery state counts as sent).
const SENT_STATES = new Set(['sent', 'delivered', 'opened', 'clicked', 'read']);
const wasSent = (status) => SENT_STATES.has(status);

// Follow-ups page buckets as [from, to) ISO bounds on cold_call.retry_at (IST days).
function followUpRanges(now = new Date()) {
  const nowIso = now.toISOString();
  const endToday = istDayEnd(now);
  const endTomorrow = new Date(new Date(endToday).getTime() + DAY_MS).toISOString();
  const weekEnd = new Date(new Date(endToday).getTime() + 6 * DAY_MS).toISOString();
  return {
    overdue: [null, nowIso], today: [nowIso, endToday], tomorrow: [endToday, endTomorrow],
    week: [nowIso, weekEnd], all: [null, null],
  };
}

// Reports: roll calls up by a lead attribute (category / area).
// calls: [{ lead_id, meta }]; leadsById: Map(id → { key fields, profile_id }).
function groupReport(calls = [], leadsById = new Map(), keyOf = () => '') {
  const rows = new Map();
  const signed = new Map();
  for (const c of calls) {
    const o = c.meta?.outcome;
    if (!o || !OUTCOMES[o]) continue;
    const lead = leadsById.get(c.lead_id);
    const key = (lead && keyOf(lead)) || 'Unknown';
    const r = rows.get(key) || { key, calls: 0, connected: 0, interested: 0, signedUp: 0 };
    r.calls++;
    if (!NOT_CONNECTED.has(o)) r.connected++;
    if (o === 'interested') r.interested++;
    rows.set(key, r);
    if (lead?.profile_id) { const set = signed.get(key) || new Set(); set.add(c.lead_id); signed.set(key, set); }
  }
  for (const [key, set] of signed) rows.get(key).signedUp = set.size;
  return [...rows.values()].sort((a, b) => b.calls - a.calls);
}

const istDate = (now = new Date()) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
function istDayStart(now = new Date()) {
  const t = now.getTime() + IST_MS;
  return new Date(t - (t % DAY_MS) - IST_MS).toISOString();
}
const istDayEnd = (now = new Date()) => new Date(new Date(istDayStart(now)).getTime() + DAY_MS).toISOString();
const formatIst = (iso) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));

// Calls by IST hour of day — Reports' "best time to call".
function hourMix(calls = []) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0, connected: 0 }));
  for (const c of calls) {
    const o = c.meta?.outcome;
    if (!o || !OUTCOMES[o] || !c.occurred_at) continue;
    const t = new Date(c.occurred_at);
    if (Number.isNaN(t.getTime())) continue;
    const h = hours[new Date(t.getTime() + IST_MS).getUTCHours()];
    h.calls++;
    if (!NOT_CONNECTED.has(o)) h.connected++;
  }
  return hours.filter((h) => h.calls);
}

// Per-lead invite code in the tracked WhatsApp link (bookasloth.com/invite/CX12): 4 chars,
// capital letters + digits (36^4 ≈ 1.68M). Random, stored on the lead the first time it's
// sent (attributes.cold_call.ref_code); coldCallService checks it's unused.
const REF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const newRefCode = (rand = Math.random) => Array.from({ length: 4 }, () => REF_CHARS[Math.floor(rand() * REF_CHARS.length)]).join('');
const cleanRefCode = (code) => { const c = String(code || '').trim().toUpperCase(); return /^[A-Z0-9]{4}$/.test(c) ? c : null; };

// Lead category → its /for/ landing page (first match wins, so specialists come before
// the general doctors page); no match → homepage. Covers ~93% of the Nagpur pool.
const LANDINGS = [
  [/dental|dentist|orthodont|periodont|endodont|prosthodont|oral (and maxillofacial )?surgeon/i, 'dentists'],
  [/derma|skin care|hair transplant|hair replacement|cosmetic surgeon|plastic surg/i, 'dermatologists'],
  [/pediatric|child(ren)?'?s hospital|child health|children policlinic/i, 'pediatricians'],
  [/gyn|obstet|maternity|fertility|pregnancy|women's health/i, 'gynecologists'],
  [/^ent |otolaryng|speech & hearing/i, 'ent-specialists'],
  [/ophthalm|eye care|optician|optometr|lasik/i, 'ophthalmologists'],
  [/physio|rehabilitation|occupational therapist|chiropract/i, 'physiotherapists'],
  [/nutrition|dietitian|weight loss/i, 'nutritionists'],
  [/veterin|animal hospital|pet groom|pet boarding|\bdog/i, 'veterinarians'],
  [/astrolog|numerolog|vastu|pujari|priest|fortune|ritual/i, 'astrologers'],
  [/architect|interior|landscape|building designer/i, 'architects'],
  [/chartered accountant|accountant|accounting|^tax |tax (consultant|preparation|attorney)|auditor|bookkeep|income tax/i, 'chartered-accountants'],
  [/lawyer|legal|law firm|attorney|notary/i, 'lawyers'],
  [/sport|turf|cricket|badminton|futsal|pickleball|football|soccer|tennis|basketball|pool hall|billard|skating/i, 'sports-turf'],
  [/\bgym|fitness|yoga|pilates|zumba|martial|karate/i, 'fitness'],
  [/\bspas?\b|massage|wellness|reiki|meditation|aromatherapy/i, 'spa'],
  [/salon|parlou?r|beaut|make-?up|hairdresser|hair care|barber|nail|eyelash|stylist/i, 'salon'],
  [/doctor|clinic|hospital|medical|physician|practitioner|surgeon|diagnostic|patholog|laborator|homeopath|ayurved|psychiatr|cardiolog|neurolog|diabet|pulmonolog|urolog|gastro|oncolog|nephrolog|rheumatolog|endocrin|radiolog|nursing home|\bmri\b|x-ray|blood test|acupuncture|naturopath|sexolog|health counselor|health consultant|anesthes|hematolog|intensivist|proctolog/i, 'doctors'],
  [/life coach|counsel|psycholog|psychotherap|mental health|hypnotherap/i, 'life-coaches'],
  [/consult|business|financial|investment|\bhr\b|human resource|stock broker|loan|insurance/i, 'business-consultant'],
  [/coaching|tutor|education|training|institute|school|academy|class|preschool|learning|college|kindergarten|career/i, 'tutors'],
  [/agency|marketing|advertising|branding|website designer|software|design/i, 'agencies'],
  [/photograph/i, 'photographers'],
  [/event|wedding|banquet/i, 'events'],
];
function landingPath(profession = '') {
  const hit = LANDINGS.find(([re]) => re.test(String(profession || '').trim()));
  return hit ? `/for/${hit[1]}` : '/';
}

// Signed-up lead → what's left before they can take a booking.
function setupSteps({ profile = {}, services = 0, bookings = 0 } = {}) {
  return [
    { key: 'account', label: 'Account created', done: true },
    { key: 'onboarding', label: 'Finished onboarding', done: !!profile.onboarding_completed },
    { key: 'photo', label: 'Added a profile photo', done: !!profile.profile_image },
    { key: 'service', label: 'Published a service', done: services > 0 },
    { key: 'booking', label: 'First booking', done: bookings > 0 },
  ];
}

const istHour = (now = new Date()) => new Date(now.getTime() + IST_MS).getUTCHours();

module.exports = {
  OUTCOMES, CALLBACK_PREFIX, MAX_NO_ANSWER, DAILY_TARGET,
  phone10, waPhone10, nextStep, sortKey, freshSlots, buildQueue, todayStats, outcomeMix, followUpBuckets,
  followUpRanges, groupReport, wasSent, hourMix, newRefCode, cleanRefCode, landingPath, setupSteps, istHour,
  istDate, istDayStart, istDayEnd, formatIst,
};
