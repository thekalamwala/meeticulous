/**
 * followupService.js — schedule + fire generic post-event follow-ups.
 *
 * scheduleFollowups: called from the shared markBookingCompleted (both the manual
 * and the auto-complete paths). Best-effort — never throws, never blocks completion.
 * processFollowups (Task 4): the leader-elected cron that fires due rows.
 */
const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../featureFlags');
const planService = require('../planService');
const { getFlow, entitledSteps } = require('./flowRegistry');
const NotificationEngine = require('../notificationEngine');
const commEngine = require('../email/communicationEngine');

const DAY = 24 * 60 * 60 * 1000;

const scheduleFollowups = async ({ sourceType, sourceId, hostId, entity, completedAt, flowKey = 'rebook' }) => {
  try {
    if (!(await featureFlags.isFeatureEnabled('rebook_nudge'))) return { scheduled: 0, reason: 'flag_off' };
    const flow = getFlow(flowKey);
    if (!flow) return { scheduled: 0, reason: 'no_flow' };

    // Host plan → entitlement. The completion join doesn't carry plan columns,
    // so fetch them here (keeps this service self-contained / vertical-agnostic).
    const { data: hostRow } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at').eq('id', hostId).maybeSingle();
    const slug = planService.resolveVendorPlan(hostRow || {});
    const n = await planService.getLimit(slug, 'followup_flows');
    const steps = entitledSteps(flow, n);
    if (!steps.length) return { scheduled: 0, reason: 'not_entitled' };

    const base = new Date(completedAt).getTime();
    const payload = flow.buildPayload(entity);
    const rows = steps.map((s) => ({
      source_type: sourceType,
      source_id: sourceId,
      host_id: hostId,
      recipient_user_id: entity.guest_id || null,
      flow_key: flow.flow_key,
      step: s.step,
      audience: flow.audience,
      event_key: flow.event,
      due_at: new Date(base + s.offsetDays * DAY).toISOString(),
      status: 'pending',
      payload,
    }));

    const { error } = await supabaseAdmin
      .from('scheduled_followups')
      .upsert(rows, { onConflict: 'source_type,source_id,flow_key,step', ignoreDuplicates: true });
    if (error) { console.error('scheduleFollowups upsert error:', error.message); return { scheduled: 0, reason: 'db_error' }; }
    return { scheduled: rows.length };
  } catch (e) {
    console.error('scheduleFollowups error:', e.message);
    return { scheduled: 0, reason: 'error' };
  }
};

const PROCESS_BATCH = 200;
const MAX_ATTEMPTS = 3;
const CLIENT_URL = process.env.CLIENT_URL || 'https://meeticulous.com';

const setStatus = (id, vals) =>
  supabaseAdmin.from('scheduled_followups')
    .update({ ...vals, updated_at: new Date().toISOString() }).eq('id', id);

const cancelSiblings = (row) =>
  supabaseAdmin.from('scheduled_followups')
    .update({ status: 'cancelled', skip_reason: 'sibling_rebooked', updated_at: new Date().toISOString() })
    .eq('source_type', row.source_type).eq('source_id', row.source_id)
    .eq('flow_key', row.flow_key).eq('status', 'pending').neq('id', row.id);

// Live eligibility for a booking-sourced row. Returns { ok } or { skip: reason }.
const bookingEligibility = async (row) => {
  // E2 — entitlement re-check (host may have downgraded since scheduling)
  const { data: hostRow } = await supabaseAdmin
    .from('profiles').select('plan, plan_expires_at').eq('id', row.host_id).maybeSingle();
  const n = await planService.getLimit(planService.resolveVendorPlan(hostRow || {}), 'followup_flows');
  if (!(n < 0 || n >= row.step)) return { skip: 'not_entitled' };

  // E3 — source still completed + paid
  const { data: bk } = await supabaseAdmin
    .from('bookings').select('status, payment_status, completed_at').eq('id', row.source_id).maybeSingle();
  if (!bk || bk.status !== 'completed' || bk.payment_status !== 'paid') return { skip: 'source_invalid' };

  // E4 — already rebooked with this host after the source completed
  const p = row.payload || {};
  let rq = supabaseAdmin.from('bookings')
    .select('id').eq('host_id', row.host_id).eq('payment_status', 'paid')
    .neq('id', row.source_id).gt('created_at', bk.completed_at || '1970-01-01');
  if (p.guest_id) rq = rq.eq('guest_id', p.guest_id);
  else if (p.guest_email) rq = rq.eq('guest_email', p.guest_email);
  else if (p.guest_phone) rq = rq.eq('guest_phone', p.guest_phone);
  const { data: rebooked } = await rq.limit(1);
  if (rebooked && rebooked.length) return { skip: 'already_rebooked', cancelSiblings: true };

  // E5 — contactability + email opt-out (WhatsApp channel is off for this event now)
  if (!p.guest_email && !p.guest_phone) return { skip: 'no_contact' };
  const emailOptedOut = p.guest_email ? await commEngine.isUnsubscribed(p.guest_email) : true;
  if (emailOptedOut && !p.guest_phone) return { skip: 'opted_out' };

  return { ok: true };
};

// Strip control chars (CR/LF/TAB) from free-text profile fields before they are
// handed to an external messaging API as template parameters. Defence-in-depth
// against parameter smuggling / CRLF injection at the AiSensy boundary — host and
// guest names are user-controlled and must never carry line breaks into a message.
const cleanParam = (s) => String(s || '').replace(/[\r\n\t]+/g, ' ').trim();

const sendRow = async (row) => {
  const p = row.payload || {};
  // encodeURIComponent the slug even though normalizeSlug already constrains it —
  // defence-in-depth so a future relaxation of the username charset can't break
  // (or inject into) the deep link that ships inside the message body.
  const deepLink = p.host_username ? `${CLIENT_URL}/${encodeURIComponent(p.host_username)}` : `${CLIENT_URL}`;
  await NotificationEngine.send({
    event: row.event_key,
    data: {
      email: p.guest_email, phone: p.guest_phone, name: p.guest_name,
      // WhatsApp body params: {{1}} guest name, {{2}} host name, {{3}} rebook link.
      // The link is a BODY param (not a dynamic CTA button) because AiSensy templates
      // have no dynamic button-URL option — the deep-link must live in the message text.
      templateParams: [cleanParam(p.guest_name) || 'there', cleanParam(p.host_name) || 'your host', deepLink],
      emailData: {
        first_name: (p.guest_name || '').split(' ')[0],
        vendor_name: p.host_name, service_name: p.service_title, profile_url: deepLink,
      },
      emailUser: { name: p.guest_name, email: p.guest_email },
      recipientUserId: p.guest_id || row.recipient_user_id || null,
    },
  });
};

const processFollowups = async () => {
  const out = { sent: 0, skipped: 0, failed: 0 };
  // E1 — kill switch: leave pending (pause, not skip)
  if (!(await featureFlags.isFeatureEnabled('rebook_nudge'))) return out;

  const { data: rows, error } = await supabaseAdmin
    .from('scheduled_followups').select('*')
    .eq('status', 'pending').lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true }).limit(PROCESS_BATCH);
  if (error) { console.error('processFollowups query error:', error.message); return out; }

  for (const row of rows || []) {
    // Eligibility is decided outside the send try/catch so a skip-branch
    // write failure (setStatus/cancelSiblings) can never be mistaken for a
    // send failure and feed the attempts/retry logic below.
    let elig;
    try {
      elig = await bookingEligibility(row);
    } catch (e) {
      console.error(`processFollowups row ${row.id} eligibility check failed:`, e.message);
      continue;
    }

    if (elig.skip) {
      try {
        await setStatus(row.id, { status: 'skipped', skip_reason: elig.skip });
        if (elig.cancelSiblings) await cancelSiblings(row);
        out.skipped += 1;
      } catch (e) {
        // Skip-write failed — surface it, but do NOT touch attempts/failed.
        console.error(`processFollowups row ${row.id} skip-write failed:`, e.message);
      }
      continue;
    }

    try {
      await sendRow(row);
      await setStatus(row.id, { status: 'sent', sent_at: new Date().toISOString() });
      out.sent += 1;
    } catch (e) {
      const attempts = (row.attempts || 0) + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await setStatus(row.id, { attempts, status, skip_reason: status === 'failed' ? 'send_failed' : null });
      out.failed += 1;
      console.error(`processFollowups row ${row.id} failed (attempt ${attempts}):`, e.message);
    }
  }
  return out;
};

module.exports = { scheduleFollowups, processFollowups };
