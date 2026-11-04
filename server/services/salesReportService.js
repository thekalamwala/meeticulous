'use strict';
/**
 * salesReportService.js — READ-ONLY CRM sales numbers for the SUTRA agent network
 * (LABH). Served by GET /api/agents/reports/sales.
 *
 * Contract:
 *   • COUNTS ONLY. No lead/contact PII is ever selected: no name, phone, email,
 *     business, socials, city, notes, message bodies/subjects/variables or event
 *     payloads. Row ids are read only to join (lead → profile, message → reply
 *     event) and never returned. Asserted in tests/unit/salesReport.test.js.
 *   • No writes, no new tables, no migration. Empty tables → zeros, never invented.
 *   • Definitions reuse the CRM's own: open = not in lifecycleRules.CLOSED (Sales
 *     Desk), high intent = deskService.highIntent filter, Pro = the plan
 *     planService.resolveVendorPlan grants (non-free, non-comped).
 *   • "today" / "mtd" are IST calendar day / month (same istWindows as finance).
 */
const { supabaseAdmin } = require('../config/supabase');
const { fetchAll, istWindows } = require('./financeReportService');
const { STATUSES, CLOSED, LIST } = require('./crm/lifecycleRules');
const { HIGH_INTENT_STATUSES } = require('./crm/deskService');
const { resolveVendorPlan, isFreeSlug, isCompedSlug } = require('./planService');
const { isFeatureEnabled } = require('./featureFlags');

const DAY = 24 * 60 * 60 * 1000;
const STALL_DAYS = 14;
const INTENTS = ['low', 'medium', 'high', 'activated'];
const MSG_STATUSES = ['queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'bounced', 'skipped'];
const SENT = new Set(['sent', 'delivered', 'read']); // reached the provider
const REPLY_EVENTS = ['replied', 'email.replied'];   // webhookEvents WA / Brevo inbound
const CHUNK = 100; // uuids per .in(): ~3.7KB, well under 8KB URL limits

// Exported so the PII test checks the exact strings the queries use.
const COLS = {
  leads: 'id, status, source, intent, owner_admin_id, profile_id, created_at, last_meaningful_interaction_at, last_reply_at',
  profiles: 'id, plan, plan_expires_at',
  bookings: 'host_id',
  crm_messages: 'id, status, sent_at',
  crm_message_events: 'message_id',
};

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const at = (ts) => Date.parse(ts);
const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
// leads.source is free text on admin create/import (leadService.upsertLead), so a
// non-slug value could carry a person's name — bucket it rather than echo it.
const sourceKey = (s) => (!s ? '(unknown)' : /^[a-z0-9_-]{1,40}$/.test(s) ? s : '(other)');
const isOpen = (status) => STATUSES.includes(status) && !CLOSED.includes(status);
// Last human-side touch: a human outbound/call (v3.133) or the lead's reply. NOT
// last_activity_at — automated sends bump that, so a drip-only lead would never stall.
const lastTouch = (l) => Math.max(at(l.last_meaningful_interaction_at) || 0, at(l.last_reply_at) || 0, at(l.created_at) || 0);

/**
 * Pure aggregation over already-fetched rows. Exported for tests.
 * @param {object} p
 * @param {Array}  p.leads        leads rows (COLS.leads)
 * @param {Array}  p.profiles     profiles of signed-up leads (COLS.profiles)
 * @param {Set}    p.bookedHosts  profile ids with ≥1 paid booking as host
 * @param {Array}  p.messages     outbound crm_messages (COLS.crm_messages)
 * @param {Set}    p.repliedIds   crm_message ids with a reply event
 * @param {boolean} p.sendsEnabled crm_admin_sends
 * @param {object} p.windows      { todayStart, monthStart } from istWindows()
 * @param {Date}   p.now
 */
function aggregateSales({ leads, profiles, bookedHosts, messages, repliedIds, sendsEnabled, windows, now }) {
  const { todayStart, monthStart } = windows;
  const inToday = (ts) => at(ts) >= at(todayStart);
  const inMonth = (ts) => at(ts) >= at(monthStart);

  // ── pipeline + sources + intent + stalled (one pass) ──
  const byStatus = zeros(STATUSES);
  const bySource = {};
  const byIntent = zeros(INTENTS);
  const newLeads = { today: 0, mtd: 0 };
  let open = 0, highIntentOpen = 0, stalled = 0;
  const stallBefore = now.getTime() - STALL_DAYS * DAY;
  for (const l of leads) {
    bump(byStatus, l.status || '(unknown)');
    bump(bySource, sourceKey(l.source));
    if (inMonth(l.created_at)) newLeads.mtd += 1;
    if (inToday(l.created_at)) newLeads.today += 1;
    if (!isOpen(l.status)) continue;
    open += 1;
    bump(byIntent, l.intent || 'low'); // column default is 'low'
    if (l.intent === 'high' && !l.owner_admin_id && HIGH_INTENT_STATUSES.includes(l.status)) highIntentOpen += 1;
    if (lastTouch(l) < stallBefore) stalled += 1;
  }

  // ── funnel: lead → signup → first paid booking → Pro ──
  // Cold list leads were never worked — out of the funnel, as in the CRM report.
  // Account steps count DISTINCT accounts: two unmerged leads on one profile count once.
  const worked = leads.filter((l) => l.status !== LIST);
  const signedIds = [...new Set(worked.map((l) => l.profile_id).filter(Boolean))];
  const proIds = new Set(profiles
    .filter((p) => { const s = resolveVendorPlan(p); return !isFreeSlug(s) && !isCompedSlug(s); })
    .map((p) => p.id));
  const booked = signedIds.filter((id) => bookedHosts.has(id)).length;
  const pro = signedIds.filter((id) => proIds.has(id)).length;

  // ── outreach: outbound crm_messages, sent cohorts by sent_at ──
  const msgByStatus = zeros(MSG_STATUSES);
  const cohort = () => ({ sent: 0, replied: 0, reply_rate_pct: 0 });
  const out = { today: cohort(), mtd: cohort(), lifetime: cohort() };
  for (const m of messages) {
    bump(msgByStatus, m.status || '(unknown)');
    if (!SENT.has(m.status)) continue;
    const replied = repliedIds.has(m.id);
    const hits = ['lifetime'];
    if (m.sent_at && inMonth(m.sent_at)) hits.push('mtd');
    if (m.sent_at && inToday(m.sent_at)) hits.push('today');
    for (const w of hits) { out[w].sent += 1; if (replied) out[w].replied += 1; }
  }
  for (const c of Object.values(out)) c.reply_rate_pct = pct(c.replied, c.sent);

  return {
    pipeline: {
      total: leads.length,
      by_status: byStatus,
      new_leads: newLeads,
      funnel: {
        leads: worked.length,
        signed_up: signedIds.length,
        first_paid_booking: booked,
        pro,
        rates_pct: {
          lead_to_signup: pct(signedIds.length, worked.length),
          signup_to_first_paid_booking: pct(booked, signedIds.length),
          signup_to_pro: pct(pro, signedIds.length),
          lead_to_pro: pct(pro, worked.length),
        },
      },
    },
    by_source: bySource,
    intent_queue: { open_leads: open, by_intent: byIntent, high_intent_open: highIntentOpen },
    stalled: { threshold_days: STALL_DAYS, count: stalled, open_leads: open },
    outreach: {
      crm_admin_sends: sendsEnabled ? 'on' : 'off',
      by_status: msgByStatus,
      ...out,
    },
  };
}

const chunks = (ids) => {
  const out = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK));
  return out;
};
// fetchAll over `ids` in CHUNK-sized .in() batches. build(chunk) → fresh builder.
const fetchIn = async (ids, build) => (await Promise.all(chunks(ids).map((c) => fetchAll(() => build(c))))).flat();

async function buildSalesReport({ now = new Date() } = {}) {
  const windows = istWindows(now);
  const db = supabaseAdmin;

  const [leads, messages, sendsEnabled] = await Promise.all([
    fetchAll(() => db.from('leads').select(COLS.leads).order('id')),
    fetchAll(() => db.from('crm_messages').select(COLS.crm_messages).eq('direction', 'outbound').order('id')),
    isFeatureEnabled('crm_admin_sends'), // fail-closed: unreadable → off
  ]);

  const profileIds = [...new Set(leads.filter((l) => l.status !== LIST && l.profile_id).map((l) => l.profile_id))];
  const sentIds = messages.filter((m) => SENT.has(m.status)).map((m) => m.id);
  const [profiles, bookings, replies] = await Promise.all([
    fetchIn(profileIds, (c) => db.from('profiles').select(COLS.profiles).in('id', c).order('id')),
    // ponytail: pulls every paid booking of signed-up leads; switch to a count RPC if hosts get busy.
    fetchIn(profileIds, (c) => db.from('bookings').select(COLS.bookings).eq('payment_status', 'paid').in('host_id', c).order('id')),
    fetchIn(sentIds, (c) => db.from('crm_message_events').select(COLS.crm_message_events)
      .in('event_type', REPLY_EVENTS).in('message_id', c).order('id')),
  ]);

  return {
    report: 'sales',
    version: 1,
    as_of: now.toISOString(),
    timezone: 'Asia/Kolkata',
    windows: { today_start: windows.todayStart, month_start: windows.monthStart },
    definitions: {
      open_lead: 'status not in lifecycleRules.CLOSED (same as the Sales Desk: activated stays open)',
      high_intent_open: `intent=high, no owner, status in (${HIGH_INTENT_STATUSES.join(', ')}) — the Sales Desk high-intent queue`,
      stalled: `open lead whose latest human touch (last_meaningful_interaction_at = human outbound/call, last_reply_at, else created_at) is more than ${STALL_DAYS} days before as_of; automated sends do not count`,
      funnel: 'leads = leads not in the cold list pool; the account steps count DISTINCT accounts: signed_up = linked to an account (profile_id); first_paid_booking = that account has ≥1 paid booking as host; pro = that account is on a paid plan now (incl. founding, legacy and gifted Pro; excl. comped)',
      outreach: 'outbound crm_messages only; sent = status sent/delivered/read, windowed by sent_at; replied = a sent message with a reply event (WhatsApp reply / Brevo inbound email)',
      new_leads: 'leads created in the window, all statuses incl. cold list',
    },
    ...aggregateSales({
      leads,
      profiles,
      bookedHosts: new Set(bookings.map((b) => b.host_id)),
      messages,
      repliedIds: new Set(replies.map((r) => r.message_id)),
      sendsEnabled,
      windows,
      now,
    }),
  };
}

module.exports = { buildSalesReport, aggregateSales, COLS };
