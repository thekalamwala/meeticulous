'use strict';
/**
 * supportReport.test.js — SEVA read-only support report (ASH-27).
 * Covers: thread status/stage/participant/reason counts, first-response + resolution
 * medians per IST window, bot escalations (open/resolved, rating, first reply),
 * tickets per period + per 100 bookings, top reason codes, the empty fallback,
 * NO-PII selects + output, and the shared x-agent-token gate on /support.
 */
const mockSelects = [];
const mockFixtures = {};
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const preds = [];
      const rows = () => (mockFixtures[table] || []).filter((r) => preds.every((p) => p(r)));
      const b = {
        select: (cols) => { mockSelects.push({ table, cols }); return b; },
        eq: (k, v) => { preds.push((r) => r[k] === v); return b; },
        neq: (k, v) => { preds.push((r) => r[k] !== v); return b; },
        gte: (k, v) => { preds.push((r) => Date.parse(r[k]) >= Date.parse(v)); return b; },
        in: (k, vs) => { preds.push((r) => vs.includes(r[k])); return b; },
        order: () => b,
        range: async () => ({ data: rows(), error: null }),
        // head:true count queries are awaited directly
        then: (resolve, reject) => Promise.resolve({ count: rows().length, error: null }).then(resolve, reject),
      };
      return b;
    },
  },
}));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { buildSupportReport, median, COLS } = require('../../services/supportReportService');

// 2026-11-04 10:00 IST = 04:30Z. todayStart = 2026-11-03T18:30Z, monthStart = 2026-10-31T18:30Z.
const NOW = new Date('2026-11-04T04:30:00Z');
const PII = { name: 'Ada Lovelace', phone: '+919999999999', email: 'ada@example.com', body: 'my card was charged twice', summary: 'Ada wants refund' };
const tPII = { user_id: 'U-secret', guest_phone: PII.phone, subject: PII.body, ai_summary: PII.summary, assigned_admin: 'admin@meeticulous.com', agent_name: 'Agent Zed', reference: 'SUP-ABC123' };
const ePII = { name: PII.name, email: PII.email, phone: PII.phone, summary: PII.summary, page_url: '/booking/ada', user_agent: 'Mozilla/5.0 test', visitor_uuid: 'V-1', reference: 'CHAT-XYZ' };

const thread = (id, status, participant_type, created_at, updated_at, f = {}) => ({ id, status, participant_type, created_at, updated_at, reason_code: null, rating: null, ...tPII, ...f });
const msg = (thread_id, sender, created_at) => ({ thread_id, sender, created_at, body: PII.body, sender_name: PII.name, sender_id: 'U-secret' });

beforeEach(() => { mockSelects.length = 0; for (const k of Object.keys(mockFixtures)) delete mockFixtures[k]; });

test('median', () => {
  expect(median([])).toBeNull();
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
});

describe('buildSupportReport', () => {
  beforeEach(() => {
    mockFixtures.support_threads = [
      thread('T1', 'resolved', 'host', '2026-11-04T01:00:00Z', '2026-11-04T03:00:00Z', { reason_code: 'pay_refund', rating: 5 }),
      thread('T2', 'resolved', 'guest', '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z'),
      thread('T3', 'assigned', 'host', '2026-11-04T02:00:00Z', '2026-11-04T02:20:00Z'),
      thread('T4', 'waiting', 'guest', '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z'),
      thread('T5', 'bot', 'host', '2026-11-04T01:00:00Z', '2026-11-04T01:00:00Z'),
      thread('T6', 'resolved', 'host', '2026-09-01T10:00:00Z', '2026-09-01T16:00:00Z', { reason_code: 'product_bug', rating: 2 }),
      thread('T7', 'resolved', 'guest', '2026-11-03T10:00:00Z', '2026-11-03T10:30:00Z', { reason_code: 'not_a_code' }),
    ];
    mockFixtures.support_messages = [
      // T1: Tithi chat, then the handoff note at 01:10 → first admin reply 30 min later
      msg('T1', 'system', '2026-11-04T01:00:00Z'), msg('T1', 'bot', '2026-11-04T01:05:00Z'),
      msg('T1', 'user', '2026-11-04T01:30:00Z'),   // customer nudge while waiting: user rows are not fetched
      msg('T1', 'admin', '2026-11-04T02:00:00Z'), msg('T1', 'admin', '2026-11-04T01:40:00Z'),
      msg('T1', 'system', '2026-11-04T01:10:00Z'), // out of order on purpose
      msg('T2', 'system', '2026-11-02T10:00:00Z'), msg('T2', 'admin', '2026-11-02T10:10:00Z'),
      msg('T3', 'bot', '2026-11-04T02:00:00Z'), msg('T3', 'admin', '2026-11-04T02:20:00Z'),
      msg('T4', 'system', '2026-09-01T10:00:00Z'),
      msg('T5', 'bot', '2026-11-04T01:00:00Z'),
      msg('T6', 'admin', '2026-09-01T10:05:00Z'),  // no prior bot/system → from created_at
    ];
    mockFixtures.bot_escalations = [
      { id: 'E1', status: 'open', reason_code: null, rating: 4, created_at: '2026-11-04T02:00:00Z', ...ePII },
      { id: 'E2', status: 'replied', reason_code: null, rating: null, created_at: '2026-11-02T10:00:00Z', ...ePII },
      { id: 'E3', status: 'closed', reason_code: 'pay_refund', rating: 1, created_at: '2026-09-01T10:00:00Z', ...ePII },
      { id: 'E4', status: 'closed', reason_code: null, rating: null, created_at: '2026-11-03T20:00:00Z', ...ePII }, // today IST
    ];
    const reply = (escalation_id, channel, created_at) => ({ escalation_id, channel, created_at, body: PII.body, sent_by: 'admin@meeticulous.com' });
    mockFixtures.bot_escalation_replies = [
      reply('E2', 'note', '2026-11-02T10:05:00Z'), reply('E2', 'whatsapp', '2026-11-02T11:00:00Z'), reply('E2', 'email', '2026-11-02T10:45:00Z'),
      reply('E3', 'whatsapp', '2026-09-01T12:00:00Z'),
      reply('E4', 'note', '2026-11-03T20:10:00Z'),
    ];
    mockFixtures.bookings = [
      { id: 'B1', status: 'confirmed', created_at: '2026-11-04T01:00:00Z' },
      { id: 'B2', status: 'completed', created_at: '2026-11-02T10:00:00Z' },
      { id: 'B3', status: 'pending', created_at: '2026-11-04T01:00:00Z' },   // abandoned checkout
      { id: 'B4', status: 'cancelled', created_at: '2026-09-01T10:00:00Z' },
      { id: 'B5', status: 'confirmed', created_at: '2026-11-03T20:00:00Z' },
    ];
  });

  test('threads: status, stage, participant, reason codes, csat', async () => {
    const r = await buildSupportReport({ now: NOW });
    expect(r).toMatchObject({ report: 'support', version: 1, as_of: NOW.toISOString(), timezone: 'Asia/Kolkata' });
    const t = r.threads;
    expect(t.total).toBe(7);
    expect(t.by_status).toEqual({ bot: 1, waiting: 1, assigned: 1, resolved: 4 });
    expect(t.by_stage).toEqual({ open: 1, pending: 1, resolved: 4, bot_only: 1 });
    expect(t.by_participant).toEqual({ host: 4, guest: 3 });
    expect(t.by_reason_code).toMatchObject({ pay_refund: 1, product_bug: 1, other: 1, '(untagged)': 1, how_to: 0 });
    expect(t.csat).toEqual({ avg_rating: 3.5, rated: 2 });
  });

  test('first-response (from handoff) + resolution medians per IST window', async () => {
    const { threads } = await buildSupportReport({ now: NOW });
    expect(threads.first_response).toEqual({
      today: { count: 2, median_minutes: 25 },    // T1 30, T3 20
      mtd: { count: 3, median_minutes: 20 },      // + T2 10
      lifetime: { count: 4, median_minutes: 15 }, // + T6 5
    });
    expect(threads.resolution).toEqual({
      today: { count: 1, median_minutes: 120 },   // T1
      mtd: { count: 3, median_minutes: 60 },      // + T2 60, T7 30
      lifetime: { count: 4, median_minutes: 90 }, // + T6 360
    });
  });

  test('bot escalations: open/resolved, rating, first reply (notes excluded)', async () => {
    const { bot_escalations: e } = await buildSupportReport({ now: NOW });
    expect(e).toMatchObject({ total: 4, by_status: { open: 1, replied: 1, closed: 2 }, open: 2, resolved: 2, avg_rating: 2.5, rated: 2 });
    expect(e.by_reason_code).toMatchObject({ pay_refund: 1, '(untagged)': 1 });
    expect(e.first_response).toEqual({
      today: { count: 0, median_minutes: null },
      mtd: { count: 1, median_minutes: 45 },        // E2 email at 45 min
      lifetime: { count: 2, median_minutes: 82.5 }, // + E3 120
    });
  });

  test('tickets per period + per 100 bookings; top reason codes', async () => {
    const r = await buildSupportReport({ now: NOW });
    expect(r.tickets).toEqual({
      today: { support_threads: 2, bot_escalations: 2, total: 4, bookings: 2, per_100_bookings: 200 },
      mtd: { support_threads: 4, bot_escalations: 3, total: 7, bookings: 3, per_100_bookings: 233.3 },
      lifetime: { support_threads: 6, bot_escalations: 4, total: 10, bookings: 4, per_100_bookings: 250 },
    });
    expect(r.top_reason_codes.map((x) => [x.code, x.count])).toEqual([['pay_refund', 2], ['other', 1], ['product_bug', 1]]);
    expect(r.top_reason_codes[0]).toMatchObject({ label: 'Refund status', category: 'payment', type: 'expected' });
  });

  test('NO PII: selects name no PII column, output carries none', async () => {
    const r = await buildSupportReport({ now: NOW });
    const PII_COL = /\*|name|phone|email|body|subject|summary|reference|user_|guest_|admin|agent|sender_id|sent_by|page|visitor|meta|payload/i;
    expect([...new Set(mockSelects.map((s) => s.table))].sort()).toEqual(['bookings', 'bot_escalation_replies', 'bot_escalations', 'support_messages', 'support_threads']);
    for (const { table, cols } of mockSelects) {
      expect(cols).toBe(table === 'bookings' ? 'id' : COLS[table]);
      expect(cols).not.toMatch(PII_COL);
    }
    const body = JSON.stringify(r);
    for (const v of [...Object.values(PII), ...Object.values(tPII), ...Object.values(ePII)]) expect(body).not.toContain(v);
    expect(body).not.toMatch(/"[TEB]\d"|U-secret/); // no row ids leak either
  });
});

test('empty tables → zeros / null medians with as_of, never invented', async () => {
  const r = await buildSupportReport({ now: NOW });
  expect(r.as_of).toBe(NOW.toISOString());
  expect(r.threads).toMatchObject({ total: 0, by_status: { bot: 0, waiting: 0, assigned: 0, resolved: 0 }, csat: { avg_rating: null, rated: 0 } });
  expect(Object.values(r.threads.by_reason_code).every((v) => v === 0)).toBe(true);
  expect(r.threads.first_response.lifetime).toEqual({ count: 0, median_minutes: null });
  expect(r.threads.resolution.today).toEqual({ count: 0, median_minutes: null });
  expect(r.bot_escalations).toMatchObject({ total: 0, open: 0, resolved: 0, avg_rating: null, rated: 0 });
  expect(r.tickets.lifetime).toEqual({ support_threads: 0, bot_escalations: 0, total: 0, bookings: 0, per_100_bookings: null });
  expect(r.top_reason_codes).toEqual([]);
  expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
});

describe('GET /api/agents/reports/support auth', () => {
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  const GOOD = 'x'.repeat(40);
  beforeEach(() => { delete process.env.AGENT_REPORT_TOKEN; });
  afterEach(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('same fail-closed token gate as finance/seo/sales', async () => {
    await request(app).get('/api/agents/reports/support').set('x-agent-token', 'anything').expect(503);
    process.env.AGENT_REPORT_TOKEN = GOOD;
    await request(app).get('/api/agents/reports/support').expect(401);
    await request(app).get('/api/agents/reports/support').set('x-agent-token', `${GOOD}y`).expect(401);
  });

  test('right token → 200 support report, no-store; read-only', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    const res = await request(app).get('/api/agents/reports/support').set('x-agent-token', GOOD).expect(200);
    expect(res.body).toMatchObject({ report: 'support', threads: { total: 0 } });
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post('/api/agents/reports/support').set('x-agent-token', GOOD).expect(404);
  });
});
