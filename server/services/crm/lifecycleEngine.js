'use strict';
/**
 * lifecycleEngine.js — the one deterministic engine that moves leads.
 *
 * Every 15 min it reads the still-open leads, (re)computes the persisted score +
 * intent, advances status by fixed rules, records the recommended next action,
 * and — best-effort — enrolls the right nurture sequence / opens a sales task on
 * a high-intent lead. No AI: `decide()` is a pure function of the lead + its
 * linked account state, unit-tested in isolation.
 *
 * BEHAVIOURAL (Phase 6): for a linked host who hasn't finished onboarding, the
 * engine doesn't nag on a timer — it nudges the FIRST unfilled step on the
 * go-live path (photo → service → availability), and when the host fills one and
 * advances, stopStaleGaps() halts the previous gap's sequence. A host who lands
 * their first paid booking gets the celebration sequence instead of the generic
 * activation nudge. Signals come from the linked profile in loadAccountCtx().
 *
 * SAFE WITH SENDS OFF: it only writes lead state and enqueues/enrolls. Actual
 * delivery still passes the `crm_admin_sends` kill-switch (default OFF) in
 * messageService/sendGate, so nothing leaves the building until that flip (P0-5).
 *
 * Schema fallback: the score/intent/next_action columns (migration v3.112) may
 * not exist yet on a given DB. The first "column missing" error flips
 * `scoringColumns=false` and the engine simply stops writing those columns —
 * status progression (pre-existing columns) keeps working.
 */
const { supabaseAdmin } = require('../../config/supabase');
const leadScore = require('./leadScore');
const relationshipHealth = require('./relationshipHealth');
const relationshipTouch = require('./relationshipTouch');
const touchRecommendationService = require('./touchRecommendationService');
const leadService = require('./leadService');
const sequenceService = require('./sequenceService');
const followUpService = require('./followUpService');
const rules = require('./lifecycleRules');

const BATCH = Number(process.env.LIFECYCLE_ENGINE_BATCH) || 500;
const DRYRUN = process.env.LIFECYCLE_ENGINE_DRYRUN === 'true';
const OPEN_EXCLUDE = ['lost', 'do_not_contact', 'paid', 'list']; // cold pool never enters the automation tick
const STALE_SIGNUP_DAYS = 3;   // signed up but onboarding not finished this long → nurture
const INACTIVE_DAYS = 30;      // no activity this long, never converted → win-back

// Named sequences the engine enrolls into (created separately; enroll no-ops if
// a name is absent/inactive so the engine never hard-depends on seeded content).
const SEQ = {
  NEW_LEAD: 'New Lead nurture',
  NO_PHOTO: 'Onboarding: add photo',
  NO_SERVICE: 'Onboarding: add service',
  NO_AVAILABILITY: 'Onboarding: set availability',
  NOT_ACTIVATED: 'Signed-up-not-activated',
  NO_BOOKING: 'Activated-no-booking',
  FIRST_BOOKING: 'First booking celebration',
  WINBACK: 'Win-back',
};
// The onboarding go-live path. The host is enrolled in the first unfilled one;
// filling it and advancing stops the previous one (stopStaleGaps).
const GAP_SEQS = new Set([SEQ.NO_PHOTO, SEQ.NO_SERVICE, SEQ.NO_AVAILABILITY, SEQ.NOT_ACTIVATED]);

let scoringColumns = true; // flipped false on first "column missing" error
let healthColumns = true;  // v3.135 relationship-health columns; same fallback

const daysSince = (iso, now) => (iso ? (now - new Date(iso).getTime()) / 864e5 : Infinity);
const engagedSinceContact = (lead) =>
  !!lead.last_engaged_at &&
  (!lead.last_contacted_at || new Date(lead.last_engaged_at) > new Date(lead.last_contacted_at));

/**
 * PURE decision for one lead. No I/O.
 * @param {object} lead   a leads row
 * @param {object} ctx    linked-profile signals: { onboardingComplete, hasPhoto,
 *                        hasService, hasAvailability, hasBooking } (all false if unlinked)
 * @param {number} now    epoch ms
 * @returns {{ score, intent, status, changed, nextAction, enroll }}
 *   status  = desired status (may equal current); changed = did it move
 *   enroll  = a SEQ.* name to enroll into, or null
 */
function decide(lead, ctx = {}, now = Date.now()) {
  if (!lead) return { score: 0, intent: 'low', status: null, changed: false, nextAction: 'Nurturing', enroll: null };
  const { score } = leadScore.compute(lead, now);
  const intent = leadScore.intentOf(lead, score);
  const cur = lead.status;
  // hasBooking/isPaid/earnings… are consumed by rules.resolveAccountStatus(ctx);
  // decide() itself only needs the onboarding-gap signals below.
  const {
    onboardingComplete = false,
    hasPhoto = false, hasService = false, hasAvailability = false,
  } = ctx;

  // 1. Account-derived promotion (paid hosts): Subscribed → Onboarded → Won → ROI
  //    → Marketing, via the shared pure resolver (same one the real-time hooks use).
  //    An unpaid host gets `cur` back and falls through to the acquisition rules
  //    below, so a free onboarded host stays in Presale (O-1).
  let status = rules.resolveAccountStatus(cur, ctx);
  if (status === cur) {
    // 2. High intent → qualify for a human.
    if (intent === 'high' && ['new', 'contacted', 'replied'].includes(cur)) status = 'qualified';
    // 3. Engaged since we last reached out → they responded.
    else if (engagedSinceContact(lead) && ['new', 'contacted'].includes(cur)) status = 'replied';
    // 4. We've contacted a brand-new lead → mark contacted.
    else if (cur === 'new' && lead.last_contacted_at) status = 'contacted';
  }

  // Next action + which sequence (if any) to enroll. Order matters: the
  // lifecycle/activation handoff outranks the acquisition "human contact" cue.
  let nextAction = 'Nurturing';
  let enroll = null;
  if (status === 'won') {
    // First paid booking landed → celebrate + teach booking #2.
    nextAction = 'Celebrate first booking'; enroll = SEQ.FIRST_BOOKING;
  } else if (status === 'activated') {
    // Onboarded (paid) but no booking yet → help land the first.
    nextAction = 'Enroll: Activated-no-booking'; enroll = SEQ.NO_BOOKING;
  } else if (status === 'qualified' || status === 'replied' || intent === 'high') {
    nextAction = 'Human contact';
  } else if (lead.profile_id && !onboardingComplete && daysSince(lead.created_at, now) >= STALE_SIGNUP_DAYS) {
    // Onboarding stalled → nudge the FIRST unfilled step on the go-live path.
    if (!hasPhoto) { nextAction = 'Enroll: add photo'; enroll = SEQ.NO_PHOTO; }
    else if (!hasService) { nextAction = 'Enroll: add service'; enroll = SEQ.NO_SERVICE; }
    else if (!hasAvailability) { nextAction = 'Enroll: set availability'; enroll = SEQ.NO_AVAILABILITY; }
    else { nextAction = 'Enroll: Signed-up-not-activated'; enroll = SEQ.NOT_ACTIVATED; }
  } else if (cur === 'new' && !lead.last_contacted_at) {
    nextAction = 'Enroll: New Lead nurture';
    enroll = SEQ.NEW_LEAD;
  } else if (lead.last_activity_at && daysSince(lead.last_activity_at, now) >= INACTIVE_DAYS && !lead.converted_at) {
    nextAction = 'Enroll: Win-back';
    enroll = SEQ.WINBACK;
  }

  return { score, intent, status, changed: status !== cur, nextAction, enroll };
}

// ── I/O helpers ──────────────────────────────────────────────────────────────

async function loadOpenLeads() {
  const { data } = await supabaseAdmin.from('leads').select('*')
    .not('status', 'in', `(${OPEN_EXCLUDE.join(',')})`)
    .order('updated_at', { ascending: true }).limit(BATCH);
  return data || [];
}

// One batched read of linked-account state: the three go-live gap signals
// (photo / service / availability) + the facts the resolver needs to promote paid
// hosts through Relations → Marketing (paid?, earnings, last-30d bookings, plan
// price, renewals, qualified referrals, enterprise).
//
// PURE: derive relationshipHealth's two soft sentiment signals from a host's support
// threads + vendor feedback (v3.20). supportOpen = an escalated, unresolved thread (a
// human issue in flight — 'waiting'/'assigned'; a 'bot' thread isn't yet a human issue
// and 'resolved' is closed). negative = a poor support rating (≤2/5) OR a recent
// complaint / low vendor rating (≤3/10). Both are SOFT in compute (one alone caps at
// 'cooling'; two reach 'at_risk'), so we keep them high-signal and current — a stale
// complaint (>90d) no longer reflects the relationship and is dropped.
const NEG_FEEDBACK_WINDOW_MS = 90 * 864e5;
function sentimentSignals(supportRows = [], feedbackRows = [], now = Date.now()) {
  const supportOpen = new Set();
  const negative = new Set();
  for (const t of supportRows || []) {
    if (!t || !t.user_id) continue;
    if (t.status === 'waiting' || t.status === 'assigned') supportOpen.add(t.user_id);
    if (t.rating != null && Number(t.rating) <= 2) negative.add(t.user_id);
  }
  const cutoff = now - NEG_FEEDBACK_WINDOW_MS;
  for (const f of feedbackRows || []) {
    if (!f || !f.vendor_id) continue;
    const recent = !f.created_at || new Date(f.created_at).getTime() >= cutoff;
    if (recent && (f.type === 'complaint' || (f.rating != null && Number(f.rating) <= 3))) negative.add(f.vendor_id);
  }
  return { supportOpen, negative };
}

async function loadAccountCtx(leads) {
  const planService = require('../planService');
  const ids = [...new Set(leads.map((l) => l.profile_id).filter(Boolean))];
  const ctx = new Map();
  if (!ids.length) return ctx;
  const now = Date.now();
  const since30 = new Date(now - 30 * 864e5).toISOString();
  const DEAD = new Set(['cancelled', 'no_show', 'refunded']);
  const negSince = new Date(now - NEG_FEEDBACK_WINDOW_MS).toISOString();
  const [profilesRes, servicesRes, availRes, bookedRes, subsRes, refsRes, supportRes, feedbackRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, onboarding_completed, profile_image, plan, billing_cadence, plan_activated_at, razorpay_subscription_id, subscription_status').in('id', ids),
    supabaseAdmin.from('services').select('host_id').in('host_id', ids),
    supabaseAdmin.from('availability').select('host_id').in('host_id', ids),
    supabaseAdmin.from('bookings').select('host_id, customer_total, status, created_at').eq('payment_status', 'paid').in('host_id', ids),
    supabaseAdmin.from('subscription_payments').select('vendor_id').eq('status', 'paid').in('vendor_id', ids),
    supabaseAdmin.from('referrals').select('referrer_id').in('status', ['qualified', 'rewarded']).in('referrer_id', ids),
    // Relationship-health sentiment (PR-7.5). Both fail-soft: a missing table (an
    // un-migrated DB) resolves { data:null } and simply yields no signal, never a throw.
    supabaseAdmin.from('support_threads').select('user_id, status, rating').eq('participant_type', 'host').in('user_id', ids),
    supabaseAdmin.from('feedback').select('vendor_id, type, rating, created_at').in('vendor_id', ids).gte('created_at', negSince),
  ]);
  const hasService = new Set((servicesRes.data || []).map((s) => s.host_id));
  const hasAvail = new Set((availRes.data || []).map((a) => a.host_id));
  const { supportOpen, negative } = sentimentSignals(supportRes.data, feedbackRes.data, now);

  // Per-host booking rows + last-30d recency (dead dispositions dropped from recency).
  const bookingsByHost = new Map(); const last30 = new Map();
  for (const b of bookedRes.data || []) {
    if (!bookingsByHost.has(b.host_id)) bookingsByHost.set(b.host_id, []);
    bookingsByHost.get(b.host_id).push(b);
    if (b.created_at && b.created_at >= since30 && !(b.status && DEAD.has(String(b.status).toLowerCase()))) {
      last30.set(b.host_id, (last30.get(b.host_id) || 0) + 1);
    }
  }
  const subCount = new Map();
  for (const s of subsRes.data || []) subCount.set(s.vendor_id, (subCount.get(s.vendor_id) || 0) + 1);
  const refCount = new Map();
  for (const r of refsRes.data || []) refCount.set(r.referrer_id, (refCount.get(r.referrer_id) || 0) + 1);

  // Plan rows for the distinct plans present (cached — a handful of slugs).
  const planCache = new Map();
  const planOf = async (slug) => {
    if (!slug) return null;
    if (planCache.has(slug)) return planCache.get(slug);
    let plan = null;
    try { plan = await planService.getPlan(slug); } catch (_) { /* best-effort */ }
    planCache.set(slug, plan); return plan;
  };

  // Derive the resolver ctx via the shared pure helper so batch + single-lead agree,
  // then merge the go-live gap signals (service / availability).
  for (const p of profilesRes.data || []) {
    const slug = planService.resolveVendorPlan ? planService.resolveVendorPlan(p) : p.plan;
    const bookings = bookingsByHost.get(p.id) || [];
    const facts = leadService.computeAccountFacts({
      profile: p, plan: await planOf(slug),
      earningsPaise: leadService.grossEarningsPaise(bookings),
      hasBooking: bookings.some((b) => !(b.status && DEAD.has(String(b.status).toLowerCase()))),
      bookingsLast30d: last30.get(p.id) || 0,
      subsCount: subCount.get(p.id) || 0,
      referralsQualified: refCount.get(p.id) || 0,
      now,
    });
    ctx.set(p.id, {
      ...facts,
      hasService: hasService.has(p.id), hasAvailability: hasAvail.has(p.id),
      bookingsTotal: bookings.length,
      supportOpen: supportOpen.has(p.id), negativeFeedback: negative.has(p.id),
    });
  }
  return ctx;
}

// Active sequence id by name, cached per run. null if absent/inactive.
function seqResolver() {
  const cache = new Map();
  return async (name) => {
    if (!name) return null;
    if (cache.has(name)) return cache.get(name);
    const { data } = await supabaseAdmin.from('crm_sequences')
      .select('id').eq('name', name).eq('is_active', true).maybeSingle();
    const id = data?.id || null;
    cache.set(name, id);
    return id;
  };
}

// The lead's enrollment status for a sequence (null if never enrolled). Used to
// keep every nurture ONCE per lead — a completed sequence must not resurrect and
// re-send on the next tick.
async function enrollmentStatus(seqId, leadId) {
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('status').eq('sequence_id', seqId).eq('lead_id', leadId).maybeSingle();
  return data?.status || null;
}

// Host filled a gap and advanced → stop the previous gap's still-active
// enrollment so its remaining emails don't fire. Best-effort.
async function stopStaleGaps(leadId, keepSeqId, resolveSeq) {
  const ids = (await Promise.all([...GAP_SEQS].map((n) => resolveSeq(n)))).filter(Boolean);
  const stale = ids.filter((id) => id !== keepSeqId);
  if (!stale.length) return;
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('id').eq('lead_id', leadId).eq('status', 'active').in('sequence_id', stale);
  for (const e of data || []) { try { await sequenceService.stop(e.id, 'gap_filled'); } catch (_) { /* best-effort */ } }
}

// One open lifecycle-created sales task per lead — never pile them up.
async function hasOpenLifecycleTask(leadId) {
  const { data } = await supabaseAdmin.from('lead_follow_ups')
    .select('id').eq('lead_id', leadId).eq('status', 'open').eq('created_by', 'lifecycle').limit(1);
  return !!(data && data.length);
}

async function writeScoring(lead, d) {
  if (!scoringColumns) return;
  const { error } = await supabaseAdmin.from('leads')
    .update({ score: d.score, intent: d.intent, next_action: d.nextAction, next_action_at: new Date().toISOString() })
    .eq('id', lead.id);
  if (error && /column .* does not exist|Could not find/i.test(error.message || '')) {
    scoringColumns = false;
    console.warn('[crm] lifecycle: scoring columns missing (run v3.112) — skipping score writeback');
  }
}

// Relationship health (v3.135) — a separate axis from the lead score: how current &
// healthy the relationship is, decaying with time-since-meaningful-interaction. Takes
// a PRECOMPUTED health (so the tick computes it once and reuses it for the touch recs),
// persists state/score/signals. Same schema-fallback discipline as writeScoring.
async function writeHealth(lead, health) {
  if (!healthColumns) return;
  const { error } = await supabaseAdmin.from('leads').update({
    health_state: health.state,
    health_score: health.score,
    health_signals: health.signals,
    health_computed_at: new Date().toISOString(),
  }).eq('id', lead.id);
  if (error && /column .* does not exist|Could not find/i.test(error.message || '')) {
    healthColumns = false;
    console.warn('[crm] lifecycle: health columns missing (run v3.135) — skipping health writeback');
  }
}

// Relationship touch recommendations (v3.136) — the single most relevant relationship
// moment for this lead, emitted into the touch_recommendations queue for the Desk.
// Best-effort; the service self-guards a missing table. NOTHING is sent from here.
async function upsertTouchRecs(lead, health, ctx, now) {
  const recs = [
    ...relationshipTouch.recommendationsFor(lead, health, ctx, now),
    ...relationshipTouch.milestoneRecommendationsFor(lead, ctx, now), // anniversaries + booking milestones (once-ever)
  ];
  if (recs.length) await touchRecommendationService.upsertOpen(recs, now);
}

// Churn-on-lapse sweep: money-state leads whose paid term has lapsed → Churned +
// win-back. Money states are excluded from loadOpenLeads, so they get their own pass.
// `plan_expires_at` in the past = the paid term ended (the same signal
// resolveVendorPlan uses to downgrade to free) — we do NOT churn on the cancel
// webhook, so a cancelled host keeps their paid status until the term actually runs
// out. A system move, so it bypasses the manual reason guard.
async function churnLapsedLeads(now = Date.now()) {
  const { data: leads } = await supabaseAdmin.from('leads')
    .select('id, status, profile_id')
    .in('status', [...rules.MONEY]).not('profile_id', 'is', null)
    .order('updated_at', { ascending: true }).limit(BATCH);
  if (!leads?.length) return { churned: 0 };
  const ids = [...new Set(leads.map((l) => l.profile_id))];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id, plan_expires_at').in('id', ids);
  const expiresAt = new Map((profs || []).map((p) => [p.id, p.plan_expires_at]));
  let churned = 0;
  for (const lead of leads) {
    const exp = expiresAt.get(lead.profile_id);
    if (!exp || new Date(exp).getTime() >= now) continue;   // paid term still active → skip
    try {
      await leadService.changeStatus(lead.id, 'churned', null, { via: 'term_lapsed' });
      await sequenceService.enrollByName('Churn-winback', lead.id, 'event:term_lapsed').catch(() => {});
      churned++;
    } catch (err) { console.error(`[crm] churn-lapse: lead ${lead.id} failed:`, err.message); }
  }
  return { churned };
}

/** Cron tick. Leader-elected by the caller. */
async function run() {
  const now = Date.now();
  // Churn lapsed money-state leads first — they are not part of the "open" scan below.
  const churn = DRYRUN ? { churned: 0 } : await churnLapsedLeads(now);
  const leads = await loadOpenLeads();
  if (!leads.length) return { scanned: 0, moved: 0, enrolled: 0, tasks: 0, churned: churn.churned, dryRun: DRYRUN };
  const ctxMap = await loadAccountCtx(leads);
  const resolveSeq = seqResolver();

  let moved = 0, enrolled = 0, tasks = 0;
  for (const lead of leads) {
    try {
      const d = decide(lead, ctxMap.get(lead.profile_id) || {}, now);

      if (DRYRUN) {
        if (d.changed || d.enroll) console.log(`[dryrun] lead ${lead.id}: ${lead.status}->${d.status} score=${d.score} intent=${d.intent} next="${d.nextAction}" enroll=${d.enroll || '-'}`);
        continue;
      }

      await writeScoring(lead, d);

      // Relationship layer: compute health once, persist it, and emit the touch rec.
      const healthCtx = { ...(ctxMap.get(lead.profile_id) || {}), meetsRoi: rules.meetsRoiGate(ctxMap.get(lead.profile_id) || {}) };
      const health = relationshipHealth.compute(lead, healthCtx, now);
      await writeHealth(lead, health);
      await upsertTouchRecs(lead, health, healthCtx, now);

      if (d.changed) { await leadService.changeStatus(lead.id, d.status, null); moved++; }

      // High-intent → a human task (deduped to one open lifecycle task per lead).
      if (d.status === 'qualified' && !(await hasOpenLifecycleTask(lead.id))) {
        await followUpService.create({
          leadId: lead.id, ownerAdminId: lead.owner_admin_id || null,
          title: `New opportunity: ${lead.business_name || lead.name || 'lead'} (${d.intent} intent, score ${d.score})`,
          dueAt: new Date(now).toISOString(), remind: true, createdBy: 'lifecycle',
        });
        tasks++;
      }

      // Best-effort enroll, ONCE per lead per sequence. A prior enrollment (in any
      // state) means we've already run this nurture — don't resurrect it.
      if (d.enroll) {
        const seqId = await resolveSeq(d.enroll);
        if (seqId && !(await enrollmentStatus(seqId, lead.id))) {
          // Advancing to a new onboarding gap → stop the previous gap's sequence.
          if (GAP_SEQS.has(d.enroll)) await stopStaleGaps(lead.id, seqId, resolveSeq);
          try { await sequenceService.enroll(seqId, lead.id, 'lifecycle'); enrolled++; }
          catch (e) { /* e.g. sequence has no steps — skip */ }
        }
      }
    } catch (err) {
      console.error(`[crm] lifecycle: lead ${lead.id} failed:`, err.message);
    }
  }
  return { scanned: leads.length, moved, enrolled, tasks, churned: churn.churned, dryRun: DRYRUN };
}

module.exports = { run, decide, SEQ, churnLapsedLeads, sentimentSignals };
