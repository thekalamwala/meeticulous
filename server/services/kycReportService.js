'use strict';
/**
 * kycReportService.js — READ-ONLY KYC / host-activation numbers for the SUTRA agent
 * network (SATYA). Served by GET /api/agents/reports/kyc.
 *
 * Contract (KYC is the most sensitive table we have):
 *   • COUNTS AND STATUSES ONLY. Never selected: names, email, phone, PAN, Aadhaar,
 *     bank holder/name/account/IFSC/branch, address, document keys (selfie/PAN/
 *     Aadhaar), review notes, route_error, razorpay ids, notification destinations
 *     or payloads. Row ids (user_id / host_id / badge_id) are read only to join and
 *     never returned. Asserted in tests/unit/kycReport.test.js.
 *   • No writes, no new tables, no migration. Empty tables → zeros, never invented.
 *   • Reuses the existing system: kyc_submissions (v3.68 + Route v3.95/v3.97),
 *     host_activation view (v3.161/162), activation nudge events (v3.163), badges
 *     (v2.0, Google/LinkedIn engine-owned since v3.173), profiles.whatsapp_verified (v3.11).
 *   • "today" / "mtd" are IST calendar day / month (same istWindows as finance).
 */
const { supabaseAdmin } = require('../config/supabase');
const { fetchAll, istWindows } = require('./financeReportService');
const { isFeatureEnabled } = require('./featureFlags');
const platformConfig = require('./platformConfig');

const DAY = 24 * 60 * 60 * 1000;
const STUCK_DAYS = 3;
const KYC_STATUSES = ['pending', 'approved', 'rejected'];
const ROUTE_STATUSES = ['none', 'pending', 'created', 'error'];
const NUDGE_EVENTS = ['HOST_ADD_SERVICE_NUDGE', 'HOST_SHARE_LINK_NUDGE', 'HOST_FIRST_BOOKING_NUDGE', 'HOST_PAYOUT_WAITING_NUDGE'];
const FUNNEL = ['signed_up', 'profile_completed', 'priced_service', 'kyc_approved', 'first_booking', 'first_payout'];

// Exported so the PII test checks the exact strings the queries use.
const COLS = {
  kyc_submissions: 'user_id, status, created_at, updated_at, reviewed_at, route_status, route_activation_status',
  host_activation: 'host_id, is_internal, onboarded, has_priced_service, has_booking, paid_bookings, first_payout_at',
  profiles: 'id, whatsapp_verified',
  vendor_badges: 'vendor_id, badge_id',
  badges: 'id, slug',
  notification_events: 'event_key, is_active, whatsapp_enabled, email_enabled, in_app_enabled',
  notification_logs: 'event_key, status, created_at',
};

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const at = (ts) => Date.parse(ts);
const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
// route_activation_status is whatever Razorpay returns — bucket anything non-slug.
const slugKey = (s) => (!s ? '(none)' : /^[a-z0-9_-]{1,40}$/.test(s) ? s : '(other)');

/**
 * Pure aggregation over already-fetched rows. Exported for tests.
 * @param {object} p
 * @param {Array}  p.kyc           kyc_submissions rows (COLS.kyc_submissions)
 * @param {Array}  p.hosts         host_activation rows (COLS.host_activation)
 * @param {Array}  p.profiles      host profiles (COLS.profiles)
 * @param {Array}  p.awards        active vendor_badges rows (COLS.vendor_badges)
 * @param {Array}  p.badges        badges rows (COLS.badges)
 * @param {Array}  p.nudgeEvents   notification_events rows for NUDGE_EVENTS
 * @param {Array}  p.nudgeLogs     notification_logs rows for NUDGE_EVENTS
 * @param {object} p.flags         { activationNudges, routeAutopilot, feeOnlyMode }
 * @param {object} p.windows       { todayStart, monthStart } from istWindows()
 * @param {Date}   p.now
 */
function aggregateKyc({ kyc, hosts, profiles, awards, badges, nudgeEvents, nudgeLogs, flags, windows, now }) {
  const inToday = (ts) => !!ts && at(ts) >= at(windows.todayStart);
  const inMonth = (ts) => !!ts && at(ts) >= at(windows.monthStart);

  // ── KYC status, windows, queue age, Route (one pass) ──
  const byStatus = zeros(KYC_STATUSES);
  const submitted = { today: 0, mtd: 0 };
  const decided = { today: zeros(['approved', 'rejected']), mtd: zeros(['approved', 'rejected']) };
  const ages = { lt_1d: 0, d1_to_3: 0, d3_to_7: 0, gt_7d: 0 };
  let oldest = 0;
  const byRoute = zeros(ROUTE_STATUSES);
  const byActivation = {};
  let approvedNoAccount = 0, payoutReady = 0;
  const approvedHosts = new Set();
  for (const k of kyc) {
    bump(byStatus, k.status || '(unknown)');
    if (inMonth(k.created_at)) submitted.mtd += 1;
    if (inToday(k.created_at)) submitted.today += 1;
    if (k.status === 'approved' || k.status === 'rejected') {
      if (inMonth(k.reviewed_at)) decided.mtd[k.status] += 1;
      if (inToday(k.reviewed_at)) decided.today[k.status] += 1;
    }
    if (k.status === 'pending') {
      // A resubmission after rejection upserts the row: updated_at = latest submit.
      const days = (now.getTime() - (at(k.updated_at) || at(k.created_at) || now.getTime())) / DAY;
      if (days > oldest) oldest = days;
      if (days < 1) ages.lt_1d += 1;
      else if (days <= STUCK_DAYS) ages.d1_to_3 += 1;
      else if (days <= 7) ages.d3_to_7 += 1;
      else ages.gt_7d += 1;
    }
    bump(byRoute, k.route_status || 'none'); // column default is 'none'
    bump(byActivation, slugKey(k.route_activation_status));
    if (k.status === 'approved') {
      approvedHosts.add(k.user_id);
      if (k.route_status !== 'created') approvedNoAccount += 1;
      // Same gate as payoutEligibility: approved + linked account + Razorpay activated.
      else if (k.route_activation_status === 'activated') payoutReady += 1;
    }
  }

  // ── activation funnel: strict, each step requires all earlier ones ──
  // Real hosts only (host_activation.is_internal), as on the admin North Star board.
  const real = hosts.filter((h) => !h.is_internal);
  const reached = [
    () => true,
    (h) => h.onboarded,
    (h) => h.has_priced_service,
    (h) => approvedHosts.has(h.host_id),
    (h) => h.has_booking,
    (h) => !!h.first_payout_at,
  ];
  const steps = {};
  let pool = real;
  FUNNEL.forEach((name, i) => { pool = pool.filter(reached[i]); steps[name] = pool.length; });
  const dropOffs = {};
  const stepPct = {};
  for (let i = 1; i < FUNNEL.length; i += 1) {
    dropOffs[FUNNEL[i]] = steps[FUNNEL[i - 1]] - steps[FUNNEL[i]];
    stepPct[FUNNEL[i]] = pct(steps[FUNNEL[i]], steps[FUNNEL[i - 1]]);
  }

  // ── badges + verifications ──
  // Same population for every badge/verification count: non-banned hosts (host_activation).
  const hostIds = new Set(hosts.map((h) => h.host_id));
  const hostAwards = awards.filter((a) => hostIds.has(a.vendor_id));
  const slugById = new Map(badges.map((b) => [b.id, b.slug]));
  const bySlug = {};
  for (const a of hostAwards) bump(bySlug, slugById.get(a.badge_id) || '(unknown)');

  // ── activation nudges ──
  const events = {};
  for (const key of NUDGE_EVENTS) {
    const e = nudgeEvents.find((r) => r.event_key === key);
    events[key] = {
      active: !!e?.is_active,
      channels: { whatsapp: !!e?.whatsapp_enabled, email: !!e?.email_enabled, in_app: !!e?.in_app_enabled },
      logged: { today: 0, mtd: 0, lifetime: 0 },
      failed_lifetime: 0,
    };
  }
  for (const l of nudgeLogs) {
    const e = events[l.event_key];
    if (!e) continue;
    e.logged.lifetime += 1;
    if (inMonth(l.created_at)) e.logged.mtd += 1;
    if (inToday(l.created_at)) e.logged.today += 1;
    if (l.status === 'failed') e.failed_lifetime += 1;
  }

  return {
    kyc: {
      total: kyc.length,
      by_status: byStatus,
      submitted,
      decided,
      route_autopilot: flags.routeAutopilot ? 'on' : 'off',
    },
    queue: {
      pending: byStatus.pending,
      age_buckets: ages,
      stuck_threshold_days: STUCK_DAYS,
      stuck: ages.d3_to_7 + ages.gt_7d,
      oldest_pending_days: Math.round(oldest * 10) / 10,
    },
    activation_funnel: {
      hosts_total: hosts.length,
      internal_excluded: hosts.length - real.length,
      steps,
      drop_offs: dropOffs,
      step_conversion_pct: stepPct,
      overall_conversion_pct: pct(steps.first_payout, steps.signed_up),
      // Money waiting on KYC — the HOST_PAYOUT_WAITING_NUDGE audience.
      paid_booking_without_approved_kyc: real.filter((h) => h.paid_bookings > 0 && !approvedHosts.has(h.host_id)).length,
    },
    nudges: { activation_nudges: flags.activationNudges ? 'on' : 'off', events },
    badges: {
      active_awards: hostAwards.length,
      by_slug: bySlug,
      verifications: {
        google: bySlug['google-verified'] || 0,
        linkedin: bySlug['linkedin-verified'] || 0,
        whatsapp: profiles.filter((p) => p.whatsapp_verified && hostIds.has(p.id)).length,
      },
    },
    razorpay_route: {
      fee_only_mode: flags.feeOnlyMode ? 'on' : 'off',
      by_route_status: byRoute,
      by_activation_status: byActivation,
      approved_without_linked_account: approvedNoAccount,
      payout_ready: payoutReady,
    },
  };
}

async function buildKycReport({ now = new Date() } = {}) {
  const windows = istWindows(now);
  const db = supabaseAdmin;

  const [kyc, hosts, profiles, awards, badges, nudgeEvents, nudgeLogs, activationNudges, cfg] = await Promise.all([
    fetchAll(() => db.from('kyc_submissions').select(COLS.kyc_submissions).order('id')),
    // ponytail: host_activation runs per-host subqueries; fine at today's host count, move to a count RPC if it gets slow.
    fetchAll(() => db.from('host_activation').select(COLS.host_activation).order('host_id')),
    fetchAll(() => db.from('profiles').select(COLS.profiles).eq('is_host', true).order('id')),
    fetchAll(() => db.from('vendor_badges').select(COLS.vendor_badges).is('revoked_at', null).order('id')),
    fetchAll(() => db.from('badges').select(COLS.badges).order('id')),
    fetchAll(() => db.from('notification_events').select(COLS.notification_events).in('event_key', NUDGE_EVENTS).order('event_key')),
    fetchAll(() => db.from('notification_logs').select(COLS.notification_logs).in('event_key', NUDGE_EVENTS).order('id')),
    isFeatureEnabled('activation_nudges'), // fail-closed: unreadable → off
    platformConfig.getConfig().catch(() => platformConfig.DEFAULTS),
  ]);

  return {
    report: 'kyc',
    version: 1,
    as_of: now.toISOString(),
    timezone: 'Asia/Kolkata',
    windows: { today_start: windows.todayStart, month_start: windows.monthStart },
    definitions: {
      kyc: 'kyc_submissions, one row per host; submitted = created_at (first submit) in window; decided = reviewed_at in window (manual review or autopilot), by CURRENT status — a rejected host who resubmitted is pending again and no longer counts as a rejection (no decision history table)',
      queue: `pending submissions aged from the latest submit (updated_at; a resubmission after rejection restarts the clock); stuck = waiting more than ${STUCK_DAYS} days`,
      activation_funnel: 'real hosts in host_activation (non-banned, internal/test accounts excluded); strict steps, each requires every earlier one: profile_completed = onboarding done, priced_service = active service with price > 0, kyc_approved = KYC status approved, first_booking = any booking, first_payout = a paid booking transfer released/settled',
      paid_booking_without_approved_kyc: 'real hosts with a paid booking but no approved KYC (payout waiting on KYC)',
      nudges: 'the 4 activation nudge notification_events (v3.163); logged = notification_logs rows (any channel, any status)',
      badges: 'active (unrevoked) vendor_badges of non-banned hosts, by badge slug; google/linkedin = their engine-owned verification badges, whatsapp = hosts with profiles.whatsapp_verified',
      razorpay_route: 'over all KYC rows; route_status = our linked-account sync state, by_activation_status = Razorpay product activation; payout_ready = approved + linked account + activated (payoutEligibility gate)',
    },
    ...aggregateKyc({
      kyc,
      hosts,
      profiles,
      awards,
      badges,
      nudgeEvents,
      nudgeLogs,
      flags: { activationNudges, routeAutopilot: cfg.routeAutopilot === true, feeOnlyMode: cfg.feeOnlyMode !== false },
      windows,
      now,
    }),
  };
}

module.exports = { buildKycReport, aggregateKyc, COLS };
