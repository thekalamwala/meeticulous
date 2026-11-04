'use strict';
/**
 * salesReport.test.js — LABH read-only sales report (ASH-25).
 * Covers: pipeline/source/intent/stalled counts, the lead → signup → paid booking → Pro
 * funnel, outreach reply rate by IST window, the crm_admin_sends state, the empty
 * fallback, NO-PII selects + output, and the shared x-agent-token gate on /sales.
 */
const mockSelects = [];
const mockFixtures = {};
let mockSendsOn = false;
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const preds = [];
      const b = {
        select: (cols) => { mockSelects.push({ table, cols }); return b; },
        eq: (k, v) => { preds.push((r) => r[k] === v); return b; },
        in: (k, vs) => { preds.push((r) => vs.includes(r[k])); return b; },
        order: () => b,
        range: async () => ({ data: (mockFixtures[table] || []).filter((r) => preds.every((p) => p(r))), error: null }),
      };
      return b;
    },
  },
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn(async (k) => k === 'crm_admin_sends' && mockSendsOn) }));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { buildSalesReport, COLS } = require('../../services/salesReportService');

// 2026-11-04 10:00 IST = 04:30Z
const NOW = new Date('2026-11-04T04:30:00Z');
const TODAY = '2026-11-04T01:00:00Z';   // today IST
const EARLIER = '2026-11-02T10:00:00Z'; // this month
const OLD = '2026-09-01T10:00:00Z';     // > 14 days ago
const PII = { name: 'Ada Lovelace', phone: '+919999999999', email: 'ada@example.com', business_name: 'Ada Clinic' };

let n = 0;
const lead = (f) => ({ id: `L${++n}`, status: 'new', source: 'google', intent: 'low', owner_admin_id: null, profile_id: null, created_at: EARLIER, last_meaningful_interaction_at: EARLIER, last_reply_at: null, ...PII, ...f });

beforeEach(() => { mockSelects.length = 0; mockSendsOn = false; for (const k of Object.keys(mockFixtures)) delete mockFixtures[k]; });

describe('buildSalesReport', () => {
  beforeEach(() => {
    mockFixtures.leads = [
      lead({ intent: 'high', created_at: TODAY }),                          // high-intent open
      lead({ intent: 'high', owner_admin_id: 'A1' }),                       // owned → not in desk queue
      // stalled: automated sends bumped last_activity_at today, but no human touch in 14d
      lead({ status: 'contacted', source: 'referral', intent: 'medium', created_at: OLD, last_meaningful_interaction_at: OLD, last_activity_at: TODAY }),
      lead({ status: 'qualified', source: 'import', last_meaningful_interaction_at: null, created_at: OLD }), // stalled (never touched)
      lead({ status: 'activated', intent: 'activated', profile_id: 'P1' }), // open; signed up + booked
      lead({ status: 'paid', profile_id: 'P2', last_meaningful_interaction_at: OLD }), // closed (money) → not stalled; Pro
      lead({ status: 'won', profile_id: 'P3' }),                            // expired Pro → not Pro; booked
      lead({ status: 'lost', source: 'import' }),
      lead({ status: 'do_not_contact', source: null }),
      lead({ status: 'list', source: 'import', profile_id: 'P4', last_meaningful_interaction_at: OLD }), // cold pool: out of funnel
      // recent reply → not stalled; unmerged duplicate of P1 → funnel counts P1 once
      lead({ status: 'contacted', profile_id: 'P1', last_meaningful_interaction_at: OLD, last_reply_at: EARLIER }),
      lead({ status: 'sloth', source: 'Ada Lovelace referral' }),           // legacy status: counted, never open; free-text source bucketed
    ];
    mockFixtures.profiles = [
      { id: 'P1', plan: 'free', plan_expires_at: null, ...PII },
      { id: 'P2', plan: 'premium', plan_expires_at: null },
      { id: 'P3', plan: 'premium', plan_expires_at: '2026-10-01T00:00:00Z' },
      { id: 'P4', plan: 'premium', plan_expires_at: null },
    ];
    mockFixtures.bookings = [
      { host_id: 'P1', payment_status: 'paid' }, { host_id: 'P1', payment_status: 'paid' },
      { host_id: 'P2', payment_status: 'pending' },
      { host_id: 'P3', payment_status: 'paid' },
      { host_id: 'P4', payment_status: 'paid' },
    ];
    const msg = (id, status, sent_at, direction = 'outbound') => ({ id, status, sent_at, direction, subject: 'Hi Ada', body_preview: PII.email });
    mockFixtures.crm_messages = [
      msg('M1', 'sent', TODAY), msg('M2', 'read', EARLIER), msg('M3', 'delivered', OLD),
      msg('M4', 'queued', null), msg('M5', 'failed', null), msg('M6', 'skipped', null),
      msg('M7', 'sent', TODAY, 'inbound'),
    ];
    mockFixtures.crm_message_events = [
      { message_id: 'M1', event_type: 'replied', payload: { text: PII.phone } },
      { message_id: 'M3', event_type: 'email.replied' },
      { message_id: 'M2', event_type: 'email.opened' },  // not a reply
    ];
  });

  test('pipeline, sources, intent queue, stalled', async () => {
    const r = await buildSalesReport({ now: NOW });
    expect(r).toMatchObject({ report: 'sales', version: 1, as_of: NOW.toISOString(), timezone: 'Asia/Kolkata' });
    expect(r.pipeline.total).toBe(12);
    expect(r.pipeline.by_status).toMatchObject({ new: 2, contacted: 2, qualified: 1, activated: 1, paid: 1, won: 1, lost: 1, do_not_contact: 1, list: 1, sloth: 1, replied: 0, demo: 0 });
    expect(r.pipeline.new_leads).toEqual({ today: 1, mtd: 10 });
    expect(r.by_source).toEqual({ google: 6, referral: 1, import: 3, '(unknown)': 1, '(other)': 1 });
    expect(r.intent_queue).toEqual({ open_leads: 6, by_intent: { low: 2, medium: 1, high: 2, activated: 1 }, high_intent_open: 1 });
    expect(r.stalled).toEqual({ threshold_days: 14, count: 2, open_leads: 6 });
  });

  test('funnel: lead → signup → first paid booking → Pro (list leads excluded)', async () => {
    const { funnel } = (await buildSalesReport({ now: NOW })).pipeline;
    expect(funnel).toEqual({
      leads: 11, signed_up: 3, first_paid_booking: 2, pro: 1,
      rates_pct: { lead_to_signup: 27.3, signup_to_first_paid_booking: 66.7, signup_to_pro: 33.3, lead_to_pro: 9.1 },
    });
  });

  test('outreach: outbound status counts, reply rate per IST window, sends flag', async () => {
    mockSendsOn = true;
    const { outreach } = await buildSalesReport({ now: NOW });
    expect(outreach.crm_admin_sends).toBe('on');
    expect(outreach.by_status).toEqual({ queued: 1, processing: 0, sent: 1, delivered: 1, read: 1, failed: 1, bounced: 0, skipped: 1 });
    expect(outreach.today).toEqual({ sent: 1, replied: 1, reply_rate_pct: 100 });
    expect(outreach.mtd).toEqual({ sent: 2, replied: 1, reply_rate_pct: 50 });
    expect(outreach.lifetime).toEqual({ sent: 3, replied: 2, reply_rate_pct: 66.7 });
  });

  test('NO PII: selects name no PII column, output carries none', async () => {
    const r = await buildSalesReport({ now: NOW });
    const PII_COL = /\*|name|phone|email|business|website|instagram|linkedin|city|profession|attributes|tags|notes|body|subject|variables|payload|error|meta|_raw/i;
    expect(mockSelects.map((s) => s.table).sort()).toEqual(['bookings', 'crm_message_events', 'crm_messages', 'leads', 'profiles']);
    for (const { table, cols } of mockSelects) {
      expect(cols).toBe(COLS[table]);
      expect(cols).not.toMatch(PII_COL);
    }
    const body = JSON.stringify(r);
    for (const v of Object.values(PII)) expect(body).not.toContain(v);
    expect(body).not.toMatch(/"L\d+"|"P\d"|"M\d"|"A1"/); // no row ids leak either
  });
});

test('empty tables → zeros with as_of, never invented; sends off by default', async () => {
  const r = await buildSalesReport({ now: NOW });
  expect(r.as_of).toBe(NOW.toISOString());
  expect(r.pipeline.total).toBe(0);
  expect(Object.values(r.pipeline.by_status).every((v) => v === 0)).toBe(true);
  expect(r.pipeline.funnel).toEqual({ leads: 0, signed_up: 0, first_paid_booking: 0, pro: 0, rates_pct: { lead_to_signup: 0, signup_to_first_paid_booking: 0, signup_to_pro: 0, lead_to_pro: 0 } });
  expect(r.by_source).toEqual({});
  expect(r.intent_queue).toEqual({ open_leads: 0, by_intent: { low: 0, medium: 0, high: 0, activated: 0 }, high_intent_open: 0 });
  expect(r.stalled.count).toBe(0);
  expect(r.outreach).toMatchObject({ crm_admin_sends: 'off', lifetime: { sent: 0, replied: 0, reply_rate_pct: 0 } });
  // nothing to join → no profile/booking/event queries at all
  expect(mockSelects.map((s) => s.table).sort()).toEqual(['crm_messages', 'leads']);
  expect(JSON.stringify(r)).not.toMatch(/NaN|null/);
});

describe('GET /api/agents/reports/sales auth', () => {
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  const GOOD = 'x'.repeat(40);
  beforeEach(() => { delete process.env.AGENT_REPORT_TOKEN; });
  afterEach(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('same fail-closed token gate as finance/seo', async () => {
    await request(app).get('/api/agents/reports/sales').set('x-agent-token', 'anything').expect(503);
    process.env.AGENT_REPORT_TOKEN = GOOD;
    await request(app).get('/api/agents/reports/sales').expect(401);
    await request(app).get('/api/agents/reports/sales').set('x-agent-token', `${GOOD}y`).expect(401);
  });

  test('right token → 200 sales report, no-store; read-only', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    const res = await request(app).get('/api/agents/reports/sales').set('x-agent-token', GOOD).expect(200);
    expect(res.body).toMatchObject({ report: 'sales', pipeline: { total: 0 } });
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post('/api/agents/reports/sales').set('x-agent-token', GOOD).expect(404);
  });
});
