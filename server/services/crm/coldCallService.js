'use strict';
/**
 * coldCallService.js — admin Cold Calling tab (/api/admin/crm/cold-calls).
 *
 * Import a calling list, serve today's call queue (DAILY_TARGET calls, sliced in
 * the DB so a 10k-lead pool never loads whole), search any lead (inbound callbacks),
 * record a call outcome (+ the one-click email/WhatsApp follow-up) and set
 * callback reminders. Built on the
 * Sales CRM: leads / lead_activities / lead_follow_ups / crm_messages.
 *
 * Calling state lives in leads.attributes.cold_call — NOT next_action_at, which
 * lifecycleEngine overwrites every tick. List membership is
 * attributes.cold_call.list_id because upsertLead never overwrites an existing
 * lead's list_id/status (a pipeline lead can still be called without regressing).
 */
const { supabaseAdmin } = require('../../config/supabase');
const leadService = require('./leadService');
const followUpService = require('./followUpService');
const messageService = require('./messageService');
const listService = require('./listService');
const rules = require('./coldCallRules');
const { rankOf, MONEY } = require('./lifecycleRules');
const { logActivity } = require('./activity');
const sendEmail = require('../../utils/sendEmail');

const REMINDER = 'cold_call_callback_reminder';   // WhatsApp-only, sent by the cron

const SENDER = 'shubham';             // founder persona — plain, hand-typed email layout
const MAX_ROWS = 50;                  // per import request; the client batches
const LEAD_COLS = 'id,name,business_name,phone,whatsapp_phone,email,website,city,profession,status,do_not_contact,profile_id,attributes,tags';
const CC = 'attributes->cold_call->>';
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const validDate = (v) => !!v && !Number.isNaN(new Date(v).getTime());

// ── Import ────────────────────────────────────────────────────
async function importRows({ rows = [], listId = null, listName = '', createdBy = '' } = {}) {
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw httpErr(400, `send at most ${MAX_ROWS} rows per request`);
  if (!listId) {
    if (!String(listName || '').trim()) throw httpErr(400, 'listId or listName required');
    listId = (await listService.createList({
      name: listName, source: 'cold_call', consentBasis: 'b2b_legitimate_interest', createdBy,
    })).id;
  }
  let created = 0, merged = 0, skipped = 0;
  for (const r of rows) {
    const phone = rules.phone10(r.phone);
    if (!phone) { skipped++; continue; }
    const wa = rules.waPhone10(r.whatsapp) || phone;
    try {
      // Identify by phone only: scraped lists share one email across branches/agencies,
      // and upsertLead's email match would merge distinct businesses.
      const { lead, created: isNew } = await leadService.upsertLead({
        name: r.name || '', phone, whatsapp_phone: `91${wa}`,
        business_name: r.business || '', profession: r.category || '', website: r.website || '',
        city: r.city || '', status: 'list', list_id: listId, tags: ['cold-call'],
      }, { source: 'cold_call', createdBy, skipMetaLead: true });
      const attrs = lead.attributes || {};
      const prev = attrs.cold_call || {};
      const coldCall = {
        ...prev,                             // keeps attempts / last_outcome / closed on re-import
        list_id: listId, day: r.day || prev.day || null, priority: r.priority || prev.priority || null,
        fit: r.fit || prev.fit || null, locality: r.locality || prev.locality || null, pitch: r.pitch || prev.pitch || null,
        // Google listing facts shown on the call screen (rating, reviews, address, Maps link).
        rating: r.rating || prev.rating || null, reviews: r.reviews || prev.reviews || null,
        address: r.address || prev.address || null, maps_url: r.maps_url || prev.maps_url || null,
      };
      coldCall.sort_key = rules.sortKey(coldCall);   // the queue ORDERs BY this in the DB
      const patch = { attributes: { ...attrs, cold_call: coldCall }, updated_at: new Date().toISOString() };
      if (r.email && !lead.email) {
        const { data: holder } = await supabaseAdmin.from('leads').select('id').eq('email', r.email).maybeSingle();
        if (!holder) patch.email = r.email;
      }
      const { error: upErr } = await supabaseAdmin.from('leads').update(patch).eq('id', lead.id);
      if (upErr) throw upErr;
      if (isNew) created++; else merged++;
    } catch (e) {
      console.warn('[cold-call] import row skipped:', e.message);
      skipped++;
    }
  }
  return { created, merged, skipped, listId };
}

// ── Hot leads + signups ───────────────────────────────────────
// "Hot" = clicked an email link or the WhatsApp tracking link in the last 48h — call
// them while they're looking. Click activities are a few a day, so this stays small.
const HOT_MS = 48 * 60 * 60 * 1000;
async function hotMap(now = new Date()) {
  const { data } = await supabaseAdmin.from('lead_activities').select('lead_id,type,occurred_at')
    .in('type', ['email_clicked', 'link_clicked']).gte('occurred_at', new Date(now.getTime() - HOT_MS).toISOString())
    .order('occurred_at', { ascending: false }).limit(200);
  const out = {};
  for (const a of data || []) if (!out[a.lead_id]) out[a.lead_id] = a.occurred_at;
  return out;
}

// Cold-call leads who signed up in the last 30 days and aren't live yet (setup steps
// left). signup stitching (leadService.recordAccountEvent) sets leads.profile_id.
const SETUP_DAYS = 30;
async function setupList(now = new Date()) {
  const db = supabaseAdmin;
  const { data: leads } = await db.from('leads').select(LEAD_COLS)
    .not(`${CC}list_id`, 'is', null).not('profile_id', 'is', null).limit(200);
  const pids = (leads || []).map((l) => l.profile_id);
  if (!pids.length) return [];
  const since = new Date(now.getTime() - SETUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [profs, svcs, bks] = await Promise.all([
    db.from('profiles').select('id,created_at,onboarding_completed,profile_image,username').in('id', pids).gte('created_at', since),
    db.from('services').select('host_id').in('host_id', pids).eq('is_active', true),
    db.from('bookings').select('host_id').in('host_id', pids).limit(2000),
  ]);
  const tally = (rows) => (rows || []).reduce((m, r) => m.set(r.host_id, (m.get(r.host_id) || 0) + 1), new Map());
  const nSvc = tally(svcs.data);
  const nBk = tally(bks.data);
  const byPid = new Map((profs.data || []).map((p) => [p.id, p]));
  return (leads || [])
    .filter((l) => byPid.has(l.profile_id))
    .map((l) => {
      const profile = byPid.get(l.profile_id);
      const steps = rules.setupSteps({ profile, services: nSvc.get(l.profile_id) || 0, bookings: nBk.get(l.profile_id) || 0 });
      // Due for a setup call: not called since they signed up, or 3+ days since the last call.
      const last = new Date(l.attributes?.cold_call?.last_called_at || 0).getTime();
      const due = last < new Date(profile.created_at).getTime() || now.getTime() - last > 3 * 24 * 60 * 60 * 1000;
      return { lead: l, signedUpAt: profile.created_at, username: profile.username || null, steps, left: steps.filter((x) => !x.done).length, due };
    })
    .filter((x) => x.left > 0)
    .sort((a, b) => new Date(b.signedUpAt) - new Date(a.signedUpAt));
}

// ── Queue ─────────────────────────────────────────────────────
// Callbacks come from EVERY list (a promised call is never hidden by the list
// picker); retries and fresh leads come from the chosen list. Fresh leads only fill
// what's left of today's target, fetched in sort_key order with a LIMIT — a 10k pool
// is never loaded whole.
async function getQueue(listId, now = new Date()) {
  if (!listId) throw httpErr(400, 'listId required');
  const db = supabaseAdmin;
  const since = rules.istDayStart(now);
  const inList = (q) => q.eq(`${CC}list_id`, listId);
  const counter = () => inList(db.from('leads').select('id', { count: 'exact', head: true }));
  const [fu, calls, msgs, tpls, retryRes, left, signed, hot, setup] = await Promise.all([
    db.from('lead_follow_ups').select('id,lead_id,title,due_at').eq('status', 'open').like('title', `${rules.CALLBACK_PREFIX}%`),
    db.from('lead_activities').select('lead_id,meta,occurred_at').eq('type', 'call_logged').gte('occurred_at', since),
    db.from('crm_messages').select('lead_id,status').like('idempotency_key', 'cold:%').gte('created_at', since),
    db.from('crm_templates').select('id,channel,name,label,category,subject,body,variables,is_active').like('category', 'cold_call_%'),
    inList(db.from('leads').select(LEAD_COLS)).lte(`${CC}retry_at`, now.toISOString()).eq(`${CC}closed`, 'false').limit(300),
    counter().is(`${CC}attempts`, null).not('do_not_contact', 'is', true),
    counter().not('profile_id', 'is', null),
    hotMap(now).catch(() => ({})),
    setupList(now).catch(() => []),
  ]);
  if (retryRes.error) throw retryRes.error;
  const followUps = fu.data || [];
  // Open callbacks are a handful, so this .in() stays far below the URL limit.
  const cbIds = [...new Set(followUps.map((f) => f.lead_id))];
  // Cold-call outcomes only — other CRM call logs don't count toward the target.
  const doneCalls = (calls.data || []).filter((c) => c.meta?.outcome && rules.OUTCOMES[c.meta.outcome]);
  const doneIds = [...new Set(doneCalls.map((c) => c.lead_id))];
  // Both id sets are a day's worth (≤ ~100), far below the URL limit.
  const [cbRes, doneRes] = await Promise.all([
    cbIds.length ? db.from('leads').select(LEAD_COLS).in('id', cbIds) : { data: [] },
    doneIds.length ? db.from('leads').select(LEAD_COLS).in('id', doneIds) : { data: [] },
  ]);
  const cbLeads = cbRes.data || [];
  const doneById = new Map((doneRes.data || []).map((l) => [l.id, l]));
  const base = rules.buildQueue([...cbLeads, ...(retryRes.data || [])], followUps, now);

  const outcomes = doneCalls.map((c) => c.meta.outcome);
  const dayEnd = new Date(rules.istDayEnd(now)).getTime();
  const callbacksToday = base.callbacksDue.length + base.upcoming.filter((c) => new Date(c.dueAt).getTime() < dayEnd).length;
  const slots = rules.freshSlots({ callsToday: outcomes.length, callbacksToday, retries: base.retries.length });
  let fresh = [];
  if (slots > 0) {
    const { data, error } = await inList(db.from('leads').select(LEAD_COLS))
      .is(`${CC}attempts`, null).not('do_not_contact', 'is', true).neq('status', 'do_not_contact')
      .order(`${CC}sort_key`, { ascending: true, nullsFirst: false })
      .limit(slots + 10);   // slack for the rare fresh lead that already holds a callback
    if (error) throw error;
    fresh = rules.buildQueue(data || [], followUps, now).fresh.slice(0, slots);
  }
  return {
    callbacksDue: base.callbacksDue, retries: base.retries, fresh, upcoming: base.upcoming,
    // Today's finished calls, oldest first — Today's Calls shows them as Done.
    done: doneCalls
      .filter((c) => doneById.has(c.lead_id))
      .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .map((c) => ({ lead: doneById.get(c.lead_id), outcome: c.meta.outcome, at: c.occurred_at })),
    today: {
      ...rules.todayStats(outcomes), target: rules.DAILY_TARGET,
      followUpsSent: (msgs.data || []).filter((m) => rules.wasSent(m.status)).length,
    },
    totals: { fresh: left.count || 0, signedUp: signed.count || 0 },
    templates: tpls.data || [],
    hot,      // { leadId: last click ISO } — last 48h
    setup,    // signed up, not live yet → setup calls
  };
}

// ── Overview ──────────────────────────────────────────────────
// Week-so-far numbers across every cold-call list (one caller works them all):
// funnel, outcome mix, top objections, follow-up buckets, and each list's progress.
// Loaded once per Overview visit, never polled.
async function stats({ days = 7 } = {}, now = new Date()) {
  const db = supabaseAdmin;
  const n = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
  const since = rules.istDayStart(new Date(now.getTime() - (n - 1) * 24 * 60 * 60 * 1000));
  const coldCount = () => db.from('leads').select('id', { count: 'exact', head: true }).not(`${CC}list_id`, 'is', null);
  const [calls, msgs, fu, lists, signed, hot, setup] = await Promise.all([
    db.from('lead_activities').select('meta,occurred_at').eq('type', 'call_logged').gte('occurred_at', since),
    db.from('crm_messages').select('status,created_at').like('idempotency_key', 'cold:%').gte('created_at', since),
    db.from('lead_follow_ups').select('id,lead_id,title,due_at').eq('status', 'open').like('title', `${rules.CALLBACK_PREFIX}%`).order('due_at').limit(500),
    db.from('lead_lists').select('id,name,created_at').eq('source', 'cold_call').order('created_at', { ascending: true }),
    coldCount().not('profile_id', 'is', null),
    hotMap(now).catch(() => ({})),
    setupList(now).catch(() => []),
  ]);
  const hotIds = Object.keys(hot);
  const hotLeads = hotIds.length
    ? ((await db.from('leads').select('id,business_name,name,phone').in('id', hotIds).not(`${CC}list_id`, 'is', null)).data || [])
    : [];
  const mix = rules.outcomeMix((calls.data || []).map((c) => c.meta));
  // Today vs yesterday (IST) for the Overview's "vs yesterday" deltas.
  const dayOf = (iso) => { const t = new Date(iso); return Number.isNaN(t.getTime()) ? '' : rules.istDate(t); };
  const day = (d) => {
    const m = rules.outcomeMix((calls.data || []).filter((c) => dayOf(c.occurred_at) === d).map((c) => c.meta));
    const sent = (msgs.data || []).filter((x) => dayOf(x.created_at) === d && rules.wasSent(x.status)).length;
    return { calls: m.calls, connected: m.connected, interested: m.interested, followUpsSent: sent };
  };
  const todayKey = rules.istDate(now);
  const yesterdayKey = rules.istDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const followUps = fu.data || [];
  // The next few callbacks, named — a handful of ids, well below the URL limit.
  const nextFu = followUps.slice(0, 5);
  const names = nextFu.length
    ? new Map(((await db.from('leads').select('id,business_name,name').in('id', nextFu.map((f) => f.lead_id))).data || []).map((l) => [l.id, l.business_name || l.name]))
    : new Map();
  const listRows = await Promise.all((lists.data || []).map(async (l) => {
    const inList = () => db.from('leads').select('id', { count: 'exact', head: true }).eq(`${CC}list_id`, l.id);
    const [total, fresh, interested] = await Promise.all([
      inList(), inList().is(`${CC}attempts`, null), inList().eq(`${CC}last_outcome`, 'interested'),
    ]);
    return { id: l.id, name: l.name, total: total.count || 0, fresh: fresh.count || 0, interested: interested.count || 0 };
  }));
  return {
    days: n, since,
    calls: mix.calls, connected: mix.connected, interested: mix.interested, signedUp: signed.count || 0,
    byOutcome: mix.byOutcome, objections: mix.objections,
    followUpsSent: (msgs.data || []).filter((m) => rules.wasSent(m.status)).length,
    today: day(todayKey), yesterday: day(yesterdayKey),
    followUps: {
      ...rules.followUpBuckets(followUps, now),
      next: nextFu.map((f) => ({ leadId: f.lead_id, name: names.get(f.lead_id) || 'Lead', dueAt: f.due_at, title: f.title })),
    },
    lists: listRows,
    hot: hotLeads.map((l) => ({ leadId: l.id, name: l.business_name || l.name || 'Lead', phone: l.phone, at: hot[l.id] }))
      .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8),
    setup: setup.slice(0, 8).map((x) => ({ leadId: x.lead.id, name: x.lead.business_name || x.lead.name || 'Lead', signedUpAt: x.signedUpAt, left: x.left, steps: x.steps })),
  };
}

// ── Search (inbound callbacks) ────────────────────────────────
// Any lead by name / business / email, or by phone in any format (+91, 0-prefix,
// spaces) — matched on the last 10 digits against phone and WhatsApp.
async function search(q) {
  const s = String(q || '').replace(/[%,()*"\\]/g, ' ').trim();
  if (s.length < 3) return [];
  const arms = [`name.ilike.%${s}%`, `business_name.ilike.%${s}%`, `email.ilike.%${s}%`];
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 5) {
    const d = digits.slice(-10);
    arms.push(`phone.ilike.%${d}%`, `whatsapp_phone.ilike.%${d}%`);
  }
  const { data, error } = await supabaseAdmin.from('leads').select(LEAD_COLS).or(arms.join(',')).limit(10);
  if (error) throw error;
  return data || [];
}

// ── Outcome ───────────────────────────────────────────────────
async function sendFollowUp(lead, channel, category, outcome, callbackAt, now, createdBy) {
  try {
    const { data: tpl } = await supabaseAdmin.from('crm_templates')
      .select('*').eq('channel', channel).eq('category', category).maybeSingle();
    if (!tpl) return { status: 'skipped', reason: 'no_template' };
    if (!tpl.is_active) return { status: 'skipped', reason: channel === 'whatsapp' ? 'pending_aisensy' : 'template_inactive' };
    // {{callback_time}} is cold-call-only, so fill it here; lead tokens
    // ({{business_name}}, {{first_name}}…) are rendered later by messageService.
    const when = callbackAt ? rules.formatIst(callbackAt) : '';
    const fill = (s) => String(s || '').replace(/\{\{\s*callback_time\s*\}\}/g, when);
    const base = {
      leadId: lead.id, channel, immediate: true, createdBy,
      // A second callback the same day carries a new time, so it gets its own key.
      idempotencyKey: `cold:${lead.id}:${outcome}:${channel}:${rules.istDate(now)}${callbackAt ? `:${callbackAt}` : ''}`,
    };
    // { ref: 'code' | 'link' } variables are this lead's invite code / invite link.
    const code = (tpl.variables || []).some((v) => v.ref) ? await ensureRefCode(lead.id) : null;
    const row = channel === 'email'
      ? await messageService.enqueue({ ...base, subject: fill(tpl.subject), variables: { html: fill(tpl.body) }, senderKey: SENDER })
      : await messageService.enqueue({ ...base, templateKey: tpl.name, variables: {
        params: (tpl.variables || []).map((v) => (v.ref === 'link' ? inviteUrl(code, lead.profession) : v.ref ? code : fill(`{{${v.key}}}`))),
      } });
    // enqueue returns the EXISTING row on an idempotency hit — don't report it as a fresh send.
    if (row?.created_at && new Date(row.created_at).getTime() < now.getTime() - 60 * 1000) {
      return { status: 'already_sent', reason: null };
    }
    return { status: row?.status || 'queued', reason: row?.error || null };
  } catch (e) {
    return { status: 'failed', reason: e.message };
  }
}

async function recordOutcome(leadId, body = {}, actorAdminId = null, now = new Date()) {
  const { outcome, note = '', durationSec = null, callbackAt = null, send = {}, email = null } = body;
  const objection = String(body.objection || '').trim().slice(0, 80) || null;
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  let step;
  try { step = rules.nextStep(outcome, lead.attributes?.cold_call || {}, now, callbackAt); }
  catch (e) { throw httpErr(400, e.message); }
  const warnings = [];
  const nowIso = now.toISOString();

  // 1. Email captured on the call (a blank or invalid value never clobbers).
  const mail = String(email || '').trim().toLowerCase();
  if (mail && VALID_EMAIL.test(mail) && mail !== lead.email) {
    await supabaseAdmin.from('leads').update({ email: mail, updated_at: nowIso }).eq('id', leadId);
    lead.email = mail;
  }

  // 2. The call log comes first — a later send failure must never lose it.
  const durationMin = durationSec ? Math.max(1, Math.round(durationSec / 60)) : null;
  await leadService.logCall(leadId, { outcome, durationMin, body: note, objection }, actorAdminId);
  if (String(note).trim()) await leadService.addNote(leadId, note, actorAdminId);

  // 3. Calling state.
  await supabaseAdmin.from('leads')
    .update({ attributes: { ...(lead.attributes || {}), cold_call: step.cold_call }, updated_at: nowIso })
    .eq('id', leadId);

  // 4. A call happened → close open callbacks; open the new one if asked. A failure here
  // is a warning (the call is already logged; cold_call.retry_at is the safety net).
  try {
    const open = await followUpService.listOpen({ leadId });
    for (const f of open.filter((x) => String(x.title || '').startsWith(rules.CALLBACK_PREFIX))) {
      await followUpService.complete(f.id, actorAdminId);
    }
    if (step.callbackAt) {
      await followUpService.create({
        leadId, ownerAdminId: actorAdminId, title: `${rules.CALLBACK_PREFIX} ${String(note).trim() || 'call back'}`,
        dueAt: step.callbackAt, remind: false, createdBy: 'cold_call',
      });
    }
  } catch (e) { warnings.push(`callback task: ${e.message}`); }

  // 5. Pipeline move — never regress a lead already further along; failures are warnings.
  try {
    // setDnc rewrites status → do_not_contact; never do that to a paying customer.
    if (step.dnc && MONEY.has(lead.status)) warnings.push('lead is a paying customer — not marked do-not-contact');
    else if (step.dnc) await leadService.setDnc(leadId, true, actorAdminId);
    else if (step.status && rankOf(lead.status) < rankOf(step.status)) {
      await leadService.changeStatus(leadId, step.status, actorAdminId, { via: 'cold_call' });
    }
    if (step.tag) await leadService.addTag(leadId, step.tag, actorAdminId);
  } catch (e) { warnings.push(`status: ${e.message}`); }

  // 6. Follow-ups — per-channel result, never thrown.
  const sends = {};
  if (step.template) {
    for (const ch of ['email', 'whatsapp']) {
      if (send[ch]) sends[ch] = await sendFollowUp(lead, ch, step.template, outcome, step.callbackAt, now, actorAdminId || 'cold_call');
    }
  }
  return { ok: true, coldCall: step.cold_call, sends, warnings };
}

// ── Send (the follow-up window) ───────────────────────────────
// After a call (or any time) the caller picks a message set per channel:
// body { email: { category } | null, whatsapp: { category } | null, callbackAt?, toEmail? }.
// Each channel's result is returned, never thrown — same as recordOutcome's sends.
const CATEGORY = /^cold_call_[a-z_]+$/;
async function send(leadId, body = {}, actorAdminId = null, now = new Date()) {
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  const mail = String(body.toEmail || '').trim().toLowerCase();   // typed in the window
  if (mail && VALID_EMAIL.test(mail) && mail !== lead.email) {
    await supabaseAdmin.from('leads').update({ email: mail, updated_at: now.toISOString() }).eq('id', leadId);
    lead.email = mail;
  }
  const callbackAt = validDate(body.callbackAt) ? new Date(body.callbackAt).toISOString() : null;
  const sends = {};
  for (const ch of ['email', 'whatsapp']) {
    const category = body[ch]?.category;
    if (!category) continue;
    if (!CATEGORY.test(category)) throw httpErr(400, `bad category for ${ch}`);
    sends[ch] = await sendFollowUp(lead, ch, category, category, callbackAt, now, actorAdminId || 'cold_call');
  }
  if (!Object.keys(sends).length) throw httpErr(400, 'pick at least one channel');
  return { ok: true, sends };
}

// ── Lead details captured on the call ─────────────────────────
// Lead columns + call-only extras (role, alternate number, hours, address) that
// live in attributes.cold_call. Blank strings clear a field; absent keys are kept.
const DETAIL_COLUMNS = ['name', 'business_name', 'profession', 'website', 'instagram'];
const DETAIL_EXTRAS = ['role', 'alt_phone', 'hours', 'address'];
async function updateDetails(leadId, body = {}, now = new Date()) {
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  const patch = {};
  for (const k of DETAIL_COLUMNS) if (k in body) patch[k] = String(body[k] ?? '').trim() || null;
  if ('email' in body) {
    const mail = String(body.email || '').trim().toLowerCase();
    if (mail && !VALID_EMAIL.test(mail)) throw httpErr(400, 'invalid email');
    patch.email = mail || null;
  }
  const cc = { ...(lead.attributes?.cold_call || {}) };
  let extras = false;
  for (const k of DETAIL_EXTRAS) if (k in body) { cc[k] = String(body[k] ?? '').trim() || null; extras = true; }
  if (extras) patch.attributes = { ...(lead.attributes || {}), cold_call: cc };
  if (!Object.keys(patch).length) throw httpErr(400, 'nothing to update');
  patch.updated_at = now.toISOString();
  const { data, error } = await supabaseAdmin.from('leads').update(patch).eq('id', leadId).select(LEAD_COLS).single();
  if (error) throw error;
  return data;
}

// ── Remind me ─────────────────────────────────────────────────
async function remind(leadId, { at, note = '' } = {}, actorAdminId = null) {
  if (!validDate(at)) throw httpErr(400, 'valid "at" date required');
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  const row = await followUpService.create({
    leadId, ownerAdminId: actorAdminId, title: `${rules.CALLBACK_PREFIX} ${String(note).trim() || 'call back'}`,
    dueAt: new Date(at).toISOString(), remind: false, createdBy: 'cold_call',
  });
  await setRetryAt(lead, new Date(at).toISOString());
  return row;
}

// cold_call.retry_at is the lead's "next follow-up" — the Follow-ups page sorts by it.
async function setRetryAt(lead, iso) {
  const cc = { ...(lead.attributes?.cold_call || {}), retry_at: iso };
  await supabaseAdmin.from('leads')
    .update({ attributes: { ...(lead.attributes || {}), cold_call: cc }, updated_at: new Date().toISOString() })
    .eq('id', lead.id);
}

// ── Follow-ups page ───────────────────────────────────────────
// Every cold-call lead with a next follow-up (cold_call.retry_at: callbacks, details,
// not now, no-answer retries, reminders), bucketed overdue / today / tomorrow / week,
// plus "no date": interested but not signed up and nothing scheduled.
const BUCKETS = ['overdue', 'today', 'tomorrow', 'week', 'nodate', 'all'];
async function followUps(opts = {}, now = new Date()) {
  const { bucket = 'all', outcome = '', listId = '', category = '', priority = '', q = '' } = opts;
  if (!BUCKETS.includes(bucket)) throw httpErr(400, 'bad bucket');
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(Math.max(parseInt(opts.pageSize, 10) || 25, 5), 100);
  const db = supabaseAdmin;
  const ranges = rules.followUpRanges(now);
  const clean = (v) => String(v || '').replace(/[%,()*"\\]/g, ' ').trim();
  const filtered = (cols, countOpts) => {
    let x = db.from('leads').select(cols, countOpts).not(`${CC}list_id`, 'is', null).not('do_not_contact', 'is', true);
    if (listId) x = x.eq(`${CC}list_id`, listId);
    if (outcome) x = x.eq(`${CC}last_outcome`, outcome);
    if (priority) x = x.eq(`${CC}priority`, priority);
    if (clean(category)) x = x.ilike('profession', `%${clean(category)}%`);
    const s = clean(q);
    if (s.length >= 2) {
      const d = s.replace(/\D/g, '').slice(-10);
      x = x.or([`business_name.ilike.%${s}%`, `name.ilike.%${s}%`, ...(d.length >= 5 ? [`phone.ilike.%${d}%`] : [])].join(','));
    }
    return x;
  };
  const inBucket = (x, b) => {
    if (b === 'nodate') return x.eq(`${CC}last_outcome`, 'interested').is(`${CC}retry_at`, null).is('profile_id', null);
    x = x.not(`${CC}retry_at`, 'is', null);
    const [from, to] = ranges[b];
    if (from) x = x.gte(`${CC}retry_at`, from);
    if (to) x = x.lt(`${CC}retry_at`, to);
    return x;
  };
  const head = () => filtered('id', { count: 'exact', head: true });
  const [rowsRes, ...counts] = await Promise.all([
    inBucket(filtered(LEAD_COLS, { count: 'exact' }), bucket)
      .order(`${CC}retry_at`, { ascending: true, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
    ...['overdue', 'today', 'tomorrow', 'week', 'nodate'].map((b) => inBucket(head(), b)),
  ]);
  if (rowsRes.error) throw rowsRes.error;
  const rows = rowsRes.data || [];
  // Last call note per lead on this page (≤ pageSize ids).
  const ids = rows.map((r) => r.id);
  const notes = new Map();
  if (ids.length) {
    const { data } = await db.from('lead_activities').select('lead_id,body,occurred_at,meta')
      .eq('type', 'call_logged').in('lead_id', ids).order('occurred_at', { ascending: false });
    for (const a of data || []) if (!notes.has(a.lead_id)) notes.set(a.lead_id, a);
  }
  const hot = ids.length ? await hotMap(now).catch(() => ({})) : {};
  const [overdue, today, tomorrow, week, nodate] = counts.map((c) => c.count || 0);
  return {
    rows: rows.map((lead) => {
      const last = notes.get(lead.id);
      return { lead, hotAt: hot[lead.id] || null, nextAt: lead.attributes?.cold_call?.retry_at || null, lastCallAt: last?.occurred_at || lead.attributes?.cold_call?.last_called_at || null, lastNote: last?.body || '' };
    }),
    total: rowsRes.count || 0, page, pageSize,
    counts: { overdue, today, tomorrow, week, nodate },
  };
}

// Reschedule (at) or mark done (done: true) a lead's next follow-up.
async function setFollowUp(leadId, { at = null, done = false } = {}, actorAdminId = null) {
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  if (!done && !validDate(at)) throw httpErr(400, 'valid "at" date required');
  const open = (await followUpService.listOpen({ leadId })).filter((f) => String(f.title || '').startsWith(rules.CALLBACK_PREFIX));
  for (const f of open) await followUpService.complete(f.id, actorAdminId);
  if (!done) {
    await followUpService.create({
      leadId, ownerAdminId: actorAdminId, title: open[0]?.title || `${rules.CALLBACK_PREFIX} call back`,
      dueAt: new Date(at).toISOString(), remind: false, createdBy: 'cold_call',
    });
  }
  await setRetryAt(lead, done ? null : new Date(at).toISOString());
  return { ok: true };
}

// ── Call history ──────────────────────────────────────────────
async function history(opts = {}, now = new Date()) {
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 7, 1), 365);
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const pageSize = Math.min(Math.max(parseInt(opts.pageSize, 10) || 25, 5), 100);
  const since = rules.istDayStart(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  let x = supabaseAdmin.from('lead_activities').select('id,lead_id,meta,body,occurred_at', { count: 'exact' })
    .eq('type', 'call_logged').gte('occurred_at', since);
  x = opts.outcome && rules.OUTCOMES[opts.outcome] ? x.eq('meta->>outcome', opts.outcome) : x.in('meta->>outcome', Object.keys(rules.OUTCOMES));
  const { data, count, error } = await x.order('occurred_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  const ids = [...new Set((data || []).map((a) => a.lead_id))];
  const leads = ids.length ? ((await supabaseAdmin.from('leads').select(LEAD_COLS).in('id', ids)).data || []) : [];
  const byId = new Map(leads.map((l) => [l.id, l]));
  return {
    rows: (data || []).map((a) => ({
      id: a.id, at: a.occurred_at, outcome: a.meta?.outcome, objection: a.meta?.objection || null,
      durationMin: a.meta?.duration_min || null, note: a.body || '', lead: byId.get(a.lead_id) || { id: a.lead_id },
    })),
    total: count || 0, page, pageSize, days,
  };
}

// ── Reports ───────────────────────────────────────────────────
// Calls in the window rolled up by category and by area. Lead lookups go in
// chunks so the id list never overflows the request URL.
async function reports(opts = {}, now = new Date()) {
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 30, 1), 365);
  const since = rules.istDayStart(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  const { data: calls, error } = await supabaseAdmin.from('lead_activities').select('lead_id,meta,occurred_at')
    .eq('type', 'call_logged').gte('occurred_at', since).in('meta->>outcome', Object.keys(rules.OUTCOMES)).limit(20000);
  if (error) throw error;
  const ids = [...new Set((calls || []).map((c) => c.lead_id))];
  const leadsById = new Map();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabaseAdmin.from('leads')
      .select(`id,profession,profile_id,locality:${CC}locality`).in('id', ids.slice(i, i + 150));
    for (const l of data || []) leadsById.set(l.id, l);
  }
  const mix = rules.outcomeMix((calls || []).map((c) => c.meta));
  return {
    days,
    totals: { calls: mix.calls, connected: mix.connected, interested: mix.interested, byOutcome: mix.byOutcome, objections: mix.objections },
    byCategory: rules.groupReport(calls || [], leadsById, (l) => l.profession),
    byArea: rules.groupReport(calls || [], leadsById, (l) => l.locality),
    byHour: rules.hourMix(calls || []),
  };
}

// ── Invite link (public, via inviteService) ───────────────────
// The tracked link is the lead's category landing page (or the homepage) with ?i=<code>:
// any page with ?i= logs the visit and stashes the code for Google signup (client
// AuthContext → /api/invite/<code>/visit). meeticulous.com/invite/<code> also still works:
// inviteService falls back here when a slug isn't an invite_links row.
const inviteUrl = (code, profession) => `https://meeticulous.com${rules.landingPath(profession)}?i=${code}`;

// ponytail: ref_code lookups scan leads' JSONB (no index) — fine at ~10k leads; add an
// expression index on attributes->cold_call->>ref_code if clicks or leads grow a lot.
async function leadByRefCode(raw) {
  const code = rules.cleanRefCode(raw);
  if (!code) return null;
  const { data } = await supabaseAdmin.from('leads').select('id,business_name,name,profile_id')
    .eq(`${CC}ref_code`, code).limit(1).maybeSingle();
  return data || null;
}

// A host signed up from a lead's invite link → link the account to that exact lead
// (never re-points a lead already linked to another account).
async function claimSignup(raw, profileId) {
  const lead = await leadByRefCode(raw);
  if (!lead || !profileId || lead.profile_id) return false;
  await supabaseAdmin.from('leads').update({ profile_id: profileId, updated_at: new Date().toISOString() })
    .eq('id', lead.id).is('profile_id', null);
  await logActivity(lead.id, 'host_signup', { title: 'Signed up from the invite link', meta: { via: 'cold_call_invite', profile_id: profileId } });
  return true;
}

async function trackClick(raw) {
  const lead = await leadByRefCode(raw);
  if (!lead) return false;
  await logActivity(lead.id, 'link_clicked', { title: 'Invite link opened', meta: { via: 'cold_call' } });
  return true;
}

// The lead's invite code, minted on first use. Re-reads attributes so a concurrent
// outcome write isn't overwritten; retries on the rare clash with another lead's code.
async function ensureRefCode(leadId) {
  const { data: row } = await supabaseAdmin.from('leads').select('attributes').eq('id', leadId).maybeSingle();
  const cc = row?.attributes?.cold_call || {};
  if (cc.ref_code) return cc.ref_code;
  for (let i = 0; i < 8; i++) {
    const code = rules.newRefCode();
    const { count } = await supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq(`${CC}ref_code`, code);
    if (count) continue;
    await supabaseAdmin.from('leads')
      .update({ attributes: { ...(row?.attributes || {}), cold_call: { ...cc, ref_code: code } } }).eq('id', leadId);
    return code;
  }
  throw new Error('could not mint an invite code');
}

// ── Callback reminder (cron, every 5 min) ─────────────────────
// WhatsApp the lead ~15 min before a promised callback ("calling you at 4 pm").
// Skips quietly until the template is approved; the idempotency key (lead + due
// time) makes every tick safe to repeat.
async function callbackReminders(now = new Date()) {
  const { data: tpl } = await supabaseAdmin.from('crm_templates').select('is_active')
    .eq('channel', 'whatsapp').eq('category', REMINDER).maybeSingle();
  if (!tpl?.is_active) return { sent: 0 };
  const { data: due } = await supabaseAdmin.from('lead_follow_ups').select('lead_id,due_at')
    .eq('status', 'open').like('title', `${rules.CALLBACK_PREFIX}%`)
    .gte('due_at', new Date(now.getTime() + 5 * 60 * 1000).toISOString())
    .lte('due_at', new Date(now.getTime() + 20 * 60 * 1000).toISOString()).limit(20);
  let sent = 0;
  for (const f of due || []) {
    const lead = await leadService.getLead(f.lead_id);
    if (!lead || lead.do_not_contact) continue;
    const r = await sendFollowUp(lead, 'whatsapp', REMINDER, 'cb_reminder', f.due_at, now, 'cold_call_reminder');
    if (r.status !== 'already_sent' && r.status !== 'failed' && r.status !== 'skipped') sent++;
  }
  return { sent };
}

// ── 6 pm recap email (cron) ───────────────────────────────────
const RECAP_TO = process.env.COLD_CALL_RECAP_EMAIL || 'hello@meeticulous.com';
async function dailyRecap(now = new Date()) {
  const s = await stats({ days: 1 }, now);
  const t = s.today;
  const tomorrowStart = rules.istDayEnd(now);
  const tomorrowEnd = new Date(new Date(tomorrowStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: cbs } = await supabaseAdmin.from('lead_follow_ups').select('lead_id,due_at')
    .eq('status', 'open').like('title', `${rules.CALLBACK_PREFIX}%`)
    .gte('due_at', tomorrowStart).lt('due_at', tomorrowEnd).order('due_at').limit(30);
  if (!t.calls && !(cbs || []).length) return { sent: false, reason: 'nothing to report' };
  const names = (cbs || []).length
    ? new Map(((await supabaseAdmin.from('leads').select('id,business_name,name').in('id', cbs.map((c) => c.lead_id))).data || []).map((l) => [l.id, l.business_name || l.name]))
    : new Map();
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const row = (k, v) => `<tr><td style="padding:4px 16px 4px 0;color:#6b7280">${k}</td><td style="font-weight:700">${v}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827">
<h2 style="margin:0 0 12px">Cold calling — ${esc(rules.istDate(now))}</h2>
<table>${row('Calls', `${t.calls} / ${rules.DAILY_TARGET}`)}${row('Connected', t.connected)}${row('Interested', t.interested)}${row('Follow-ups sent', t.followUpsSent)}${row('Clicked a link (48h)', s.hot.length)}${row('Signed up, not live yet', s.setup.length)}</table>
<h3 style="margin:18px 0 6px">Tomorrow's callbacks (${(cbs || []).length})</h3>
${(cbs || []).length ? `<ul>${cbs.map((c) => `<li>${esc(rules.formatIst(c.due_at))} — ${esc(names.get(c.lead_id) || 'Lead')}</li>`).join('')}</ul>` : '<p>None booked.</p>'}
<p><a href="https://meeticulous.com/admin/sales/cold-calling">Open Cold Calling</a></p></div>`;
  await sendEmail({ to: RECAP_TO, subject: `Cold calling today: ${t.calls} calls · ${t.interested} interested`, html });
  return { sent: true };
}

module.exports = {
  importRows, getQueue, stats, followUps, setFollowUp, history, reports, search, recordOutcome, send, updateDetails, remind,
  trackClick, leadByRefCode, claimSignup, callbackReminders, dailyRecap,
};
