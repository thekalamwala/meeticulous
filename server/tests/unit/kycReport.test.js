'use strict';
/**
 * kycReport.test.js — SATYA read-only KYC report (ASH-28).
 * Covers: KYC by status + IST windows, queue age buckets / stuck, the strict
 * activation funnel + drop-offs, nudge event state + log counts, badge and
 * verification counts, Razorpay Route status counts, the empty fallback,
 * NO PII / document columns selected or returned, and the x-agent-token gate on /kyc.
 */
const mockSelects = [];
const mockFixtures = {};
let mockNudgesOn = false;
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const preds = [];
      const b = {
        select: (cols) => { mockSelects.push({ table, cols }); return b; },
        eq: (k, v) => { preds.push((r) => r[k] === v); return b; },
        in: (k, vs) => { preds.push((r) => vs.includes(r[k])); return b; },
        is: (k, v) => { preds.push((r) => (r[k] ?? null) === v); return b; },
        order: () => b,
        range: async () => ({ data: (mockFixtures[table] || []).filter((r) => preds.every((p) => p(r))), error: null }),
      };
      return b;
    },
  },
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn(async (k) => k === 'activation_nudges' && mockNudgesOn) }));
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn(async () => ({ routeAutopilot: false, feeOnlyMode: true })),
  DEFAULTS: { routeAutopilot: false, feeOnlyMode: true },
}));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { buildKycReport, COLS } = require('../../services/kycReportService');

// 2026-11-04 10:00 IST = 04:30Z. IST month starts 2026-10-31T18:30Z.
const NOW = new Date('2026-11-04T04:30:00Z');
const TODAY = '2026-11-04T01:00:00Z';
const EARLIER = '2026-11-02T10:00:00Z';
const OLD = '2026-09-01T10:00:00Z';
const PII = {
  full_name: 'Ada Lovelace', name: 'Ada Lovelace', email: 'ada@example.com', phone: '+919999999999',
  pan_number: 'ENC:ABCDE1234F', aadhaar_number: 'ENC:123412341234', account_number: 'ENC:0011223344',
  holder_name: 'Ada L', bank_name: 'Ada Bank', ifsc: 'ADAB0001234', addr_street1: '1 Analytical Engine Rd',
  addr_city: 'Pune', selfie_url: 'H1/selfie.jpg', pan_doc_url: 'H1/pan.jpg', review_note: 'blurry PAN',
  razorpay_account_id: 'acc_SECRET1', route_error: 'Ada invalid address',
};

const kycRow = (user_id, f) => ({
  user_id, status: 'pending', created_at: EARLIER, updated_at: EARLIER, reviewed_at: null,
  route_status: 'none', route_activation_status: null, ...PII, ...f,
});
const host = (host_id, f) => ({
  host_id, is_internal: false, onboarded: true, has_priced_service: true, has_booking: false,
  paid_bookings: 0, first_payout_at: null, name: PII.name, email: PII.email, phone: PII.phone, ...f,
});

beforeEach(() => { mockSelects.length = 0; mockNudgesOn = false; for (const k of Object.keys(mockFixtures)) delete mockFixtures[k]; });

describe('buildKycReport', () => {
  beforeEach(() => {
    mockFixtures.kyc_submissions = [
      kycRow('H1', { created_at: OLD, updated_at: TODAY }),                       // resubmitted today → <1d
      kycRow('H2', {}),                                                          // 1.8d
      kycRow('H3', { created_at: '2026-10-30T04:30:00Z', updated_at: '2026-10-30T04:30:00Z' }), // 5d
      kycRow('H4', { created_at: '2026-10-20T04:30:00Z', updated_at: '2026-10-20T04:30:00Z' }), // 15d
      kycRow('H5', { status: 'approved', created_at: TODAY, reviewed_at: TODAY, route_status: 'created', route_activation_status: 'activated' }),
      kycRow('H6', { status: 'approved', created_at: OLD, reviewed_at: OLD, route_status: 'error' }),
      kycRow('H7', { status: 'rejected', reviewed_at: EARLIER }),
      kycRow('H8', { status: 'approved', created_at: OLD, reviewed_at: '2026-11-01T10:00:00Z', route_status: 'created', route_activation_status: 'needs_clarification' }),
    ];
    mockFixtures.host_activation = [
      host('H1'),                                                                // stops at priced_service (KYC pending)
      host('H2'),
      host('H5', { has_booking: true, paid_bookings: 2, first_payout_at: EARLIER }), // full funnel
      host('H6', { has_priced_service: false }),                                 // KYC approved but no service
      host('H8', { has_booking: true, paid_bookings: 1 }),                       // through first_booking
      host('H9', { onboarded: false, has_priced_service: false }),               // signed up only
      host('H10', { has_booking: true, paid_bookings: 1 }),                      // paid, no KYC
      host('H11', { is_internal: true, has_booking: true, paid_bookings: 3, first_payout_at: OLD }),
    ];
    mockFixtures.profiles = [
      { id: 'H1', is_host: true, whatsapp_verified: true, ...PII },
      { id: 'H5', is_host: true, whatsapp_verified: true },
      { id: 'H9', is_host: true, whatsapp_verified: false },
      { id: 'G1', is_host: false, whatsapp_verified: true },  // guest
      { id: 'B1', is_host: true, whatsapp_verified: true },   // banned: not in host_activation
    ];
    mockFixtures.badges = [
      { id: 'BG', slug: 'google-verified' }, { id: 'BL', slug: 'linkedin-verified' }, { id: 'BT', slug: 'top-pick-by-team' },
    ];
    mockFixtures.vendor_badges = [
      { vendor_id: 'H1', badge_id: 'BG', revoked_at: null, reason: PII.name },
      { vendor_id: 'H5', badge_id: 'BG', revoked_at: null },
      { vendor_id: 'H5', badge_id: 'BL', revoked_at: null },
      { vendor_id: 'H5', badge_id: 'BT', revoked_at: null },
      { vendor_id: 'H6', badge_id: 'BG', revoked_at: OLD },  // revoked
      { vendor_id: 'B1', badge_id: 'BL', revoked_at: null }, // banned host: excluded like whatsapp
    ];
    mockFixtures.notification_events = [
      { event_key: 'HOST_ADD_SERVICE_NUDGE', is_active: false, whatsapp_enabled: false, email_enabled: false, in_app_enabled: false },
      { event_key: 'HOST_PAYOUT_WAITING_NUDGE', is_active: true, whatsapp_enabled: true, email_enabled: false, in_app_enabled: false },
      { event_key: 'KYC_APPROVED', is_active: true, whatsapp_enabled: true, email_enabled: true, in_app_enabled: true },
    ];
    const log = (event_key, status, created_at) => ({ event_key, status, created_at, destination: PII.phone, payload: { name: PII.name } });
    mockFixtures.notification_logs = [
      log('HOST_PAYOUT_WAITING_NUDGE', 'sent', TODAY), log('HOST_PAYOUT_WAITING_NUDGE', 'failed', EARLIER),
      log('HOST_PAYOUT_WAITING_NUDGE', 'sent', OLD), log('HOST_ADD_SERVICE_NUDGE', 'pending', EARLIER),
      log('KYC_APPROVED', 'sent', TODAY),
    ];
  });

  test('KYC by status, IST windows, queue age + stuck', async () => {
    const r = await buildKycReport({ now: NOW });
    expect(r).toMatchObject({ report: 'kyc', version: 1, as_of: NOW.toISOString(), timezone: 'Asia/Kolkata' });
    expect(r.kyc).toEqual({
      total: 8,
      by_status: { pending: 4, approved: 3, rejected: 1 },
      submitted: { today: 1, mtd: 3 },
      decided: { today: { approved: 1, rejected: 0 }, mtd: { approved: 2, rejected: 1 } },
      route_autopilot: 'off',
    });
    expect(r.queue).toEqual({
      pending: 4, age_buckets: { lt_1d: 1, d1_to_3: 1, d3_to_7: 1, gt_7d: 1 },
      stuck_threshold_days: 3, stuck: 2, oldest_pending_days: 15,
    });
  });

  test('activation funnel: strict steps, drop-offs, internal excluded, payout waiting on KYC', async () => {
    const { activation_funnel: f } = await buildKycReport({ now: NOW });
    expect(f).toEqual({
      hosts_total: 8,
      internal_excluded: 1,
      steps: { signed_up: 7, profile_completed: 6, priced_service: 5, kyc_approved: 2, first_booking: 2, first_payout: 1 },
      drop_offs: { profile_completed: 1, priced_service: 1, kyc_approved: 3, first_booking: 0, first_payout: 1 },
      step_conversion_pct: { profile_completed: 85.7, priced_service: 83.3, kyc_approved: 40, first_booking: 100, first_payout: 50 },
      overall_conversion_pct: 14.3,
      paid_booking_without_approved_kyc: 1,
    });
  });

  test('nudges, badges + verifications, Razorpay Route', async () => {
    mockNudgesOn = true;
    const r = await buildKycReport({ now: NOW });
    expect(r.nudges.activation_nudges).toBe('on');
    expect(Object.keys(r.nudges.events)).toEqual(['HOST_ADD_SERVICE_NUDGE', 'HOST_SHARE_LINK_NUDGE', 'HOST_FIRST_BOOKING_NUDGE', 'HOST_PAYOUT_WAITING_NUDGE']);
    expect(r.nudges.events.HOST_PAYOUT_WAITING_NUDGE).toEqual({
      active: true, channels: { whatsapp: true, email: false, in_app: false },
      logged: { today: 1, mtd: 2, lifetime: 3 }, failed_lifetime: 1,
    });
    expect(r.nudges.events.HOST_ADD_SERVICE_NUDGE.logged).toEqual({ today: 0, mtd: 1, lifetime: 1 });
    expect(r.nudges.events.HOST_SHARE_LINK_NUDGE).toMatchObject({ active: false, logged: { lifetime: 0 } }); // row missing → off
    expect(r.badges).toEqual({
      active_awards: 4,
      by_slug: { 'google-verified': 2, 'linkedin-verified': 1, 'top-pick-by-team': 1 },
      verifications: { google: 2, linkedin: 1, whatsapp: 2 },
    });
    expect(r.razorpay_route).toEqual({
      fee_only_mode: 'on',
      by_route_status: { none: 5, pending: 0, created: 2, error: 1 },
      by_activation_status: { '(none)': 6, activated: 1, needs_clarification: 1 },
      approved_without_linked_account: 1,
      payout_ready: 1,
    });
  });

  test('NO PII: no PII/document column is selected, output carries none', async () => {
    const r = await buildKycReport({ now: NOW });
    const PII_COL = /\*|name|phone|pan_|aadhaar|account|bank|holder|ifsc|branch|addr|selfie|_doc|_url|note|razorpay|error|destination|payload|response|google_id|linkedin_sub|reviewed_by|profession|gmv/i;
    expect(mockSelects.map((s) => s.table).sort()).toEqual(
      ['badges', 'host_activation', 'kyc_submissions', 'notification_events', 'notification_logs', 'profiles', 'vendor_badges'],
    );
    for (const { table, cols } of mockSelects) {
      expect(cols).toBe(COLS[table]);
      for (const c of cols.split(',').map((s) => s.trim())) {
        expect(c).not.toMatch(PII_COL);
        expect(c).not.toBe('email');
      }
    }
    const body = JSON.stringify(r);
    for (const v of Object.values(PII)) expect(body).not.toContain(v);
    expect(body).not.toMatch(/"H\d+"|"G1"|"B[1GLT]"/); // no row ids leak either
  });
});

test('empty tables → zeros with as_of, never invented', async () => {
  const r = await buildKycReport({ now: NOW });
  expect(r.as_of).toBe(NOW.toISOString());
  expect(r.kyc).toMatchObject({ total: 0, by_status: { pending: 0, approved: 0, rejected: 0 }, submitted: { today: 0, mtd: 0 } });
  expect(r.queue).toEqual({ pending: 0, age_buckets: { lt_1d: 0, d1_to_3: 0, d3_to_7: 0, gt_7d: 0 }, stuck_threshold_days: 3, stuck: 0, oldest_pending_days: 0 });
  expect(r.activation_funnel.steps).toEqual({ signed_up: 0, profile_completed: 0, priced_service: 0, kyc_approved: 0, first_booking: 0, first_payout: 0 });
  expect(r.activation_funnel.overall_conversion_pct).toBe(0);
  expect(r.nudges).toMatchObject({ activation_nudges: 'off', events: { HOST_PAYOUT_WAITING_NUDGE: { active: false, logged: { lifetime: 0 } } } });
  expect(r.badges).toEqual({ active_awards: 0, by_slug: {}, verifications: { google: 0, linkedin: 0, whatsapp: 0 } });
  expect(r.razorpay_route).toMatchObject({ by_route_status: { none: 0, pending: 0, created: 0, error: 0 }, by_activation_status: {}, payout_ready: 0 });
  expect(JSON.stringify(r)).not.toMatch(/NaN|null/);
});

describe('GET /api/agents/reports/kyc auth', () => {
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  const GOOD = 'x'.repeat(40);
  beforeEach(() => { delete process.env.AGENT_REPORT_TOKEN; });
  afterEach(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('same fail-closed token gate as the other reports', async () => {
    await request(app).get('/api/agents/reports/kyc').set('x-agent-token', 'anything').expect(503);
    process.env.AGENT_REPORT_TOKEN = GOOD;
    await request(app).get('/api/agents/reports/kyc').expect(401);
    await request(app).get('/api/agents/reports/kyc').set('x-agent-token', `${GOOD}y`).expect(401);
  });

  test('right token → 200 kyc report, no-store; read-only', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    const res = await request(app).get('/api/agents/reports/kyc').set('x-agent-token', GOOD).expect(200);
    expect(res.body).toMatchObject({ report: 'kyc', kyc: { total: 0 } });
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post('/api/agents/reports/kyc').set('x-agent-token', GOOD).expect(404);
  });
});
