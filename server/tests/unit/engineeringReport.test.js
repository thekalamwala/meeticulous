'use strict';
/**
 * engineeringReport.test.js — YANTRA read-only engineering report (ASH-35).
 * Covers: cron health from job_runs/job_locks, queue/payout/contacts counts, the
 * missing-table → null fallback, NO-PII selects + output, and the x-agent-token gate.
 */
const mockSelects = [];
const mockFixtures = {};
const mockMissing = new Set();
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const preds = [];
      let head = false;
      const rows = () => (mockFixtures[table] || []).filter((r) => preds.every((p) => p(r)));
      const missing = () => ({ data: null, count: null, error: { code: '42P01', message: `relation "${table}" does not exist` } });
      const b = {
        select: (cols, opts) => { mockSelects.push({ table, cols }); head = !!opts?.head; return b; },
        eq: (k, v) => { preds.push((r) => r[k] === v); return b; },
        gte: (k, v) => { preds.push((r) => Date.parse(r[k]) >= Date.parse(v)); return b; },
        lt: (k, v) => { preds.push((r) => Date.parse(r[k]) < Date.parse(v)); return b; },
        limit: () => b,
        then: (resolve, reject) => Promise.resolve(
          mockMissing.has(table) ? missing() : head ? { count: rows().length, error: null } : { data: rows(), error: null },
        ).then(resolve, reject),
      };
      return b;
    },
  },
}));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { buildEngineeringReport, COLS } = require('../../services/engineeringReportService');

const NOW = new Date('2026-11-05T06:00:00Z');
const ago = (min) => new Date(NOW.getTime() - min * 60000).toISOString();
const PII = 'ada@example.com';

beforeEach(() => {
  mockSelects.length = 0;
  mockMissing.clear();
  Object.assign(mockFixtures, {
    job_runs: [
      { name: 'ledger-reconcile', last_run_at: ago(30), last_outcome: 'ok', updated_at: ago(30), last_error: null },
      { name: 'otp-cleanup', last_run_at: ago(600), last_outcome: 'error', updated_at: ago(10), last_error: `failed for ${PII}` },
    ],
    job_locks: [{ name: 'payout-reconcile', expires_at: ago(-10) }, { name: 'weekly-recap', expires_at: ago(120) }],
    email_logs: [
      { status: 'queued', recipient: PII, updated_at: ago(1) },
      { status: 'failed', recipient: PII, updated_at: ago(60) },
      { status: 'failed', recipient: PII, updated_at: ago(3 * 24 * 60) },
      { status: 'sent', recipient: PII, updated_at: ago(5) },
    ],
    crm_messages: [
      { status: 'processing', updated_at: ago(45) }, { status: 'processing', updated_at: ago(5) },
      { status: 'queued', updated_at: ago(1) },
    ],
    campaign_recipients: [{ status: 'sending', updated_at: ago(2) }],
    bookings: [{ transfer_status: 'creating' }, { transfer_status: 'failed' }, { transfer_status: 'pending' }, { transfer_status: null }],
    contacts: [
      { email: PII, email_opt_in: false, email_suppressed: true },
      { email: 'b@x.test', email_opt_in: true, email_suppressed: false },
    ],
  });
});

test('cron health: erroring jobs, minutes since success/attempt, held vs expired locks', async () => {
  const r = await buildEngineeringReport({ now: NOW });
  expect(r.jobs.tracked).toBe(2);
  expect(r.jobs.erroring).toEqual(['otp-cleanup']);
  expect(r.jobs.jobs.find((j) => j.name === 'otp-cleanup')).toEqual({
    name: 'otp-cleanup', last_outcome: 'error', minutes_since_success: 600, minutes_since_attempt: 10,
  });
  expect(r.jobs.locks).toEqual({ held: 1, expired: 1 });
});

test('queue, payout and contacts counts', async () => {
  const r = await buildEngineeringReport({ now: NOW });
  expect(r.email).toEqual({ queued: 1, sending: 0, failed_24h: 1, failed_7d: 2, sent_24h: 1 });
  expect(r.crm).toEqual({ queued: 1, stuck_processing: 1, failed_7d: 0 });
  expect(r.campaigns).toEqual({ sending: 1, failed_7d: 0 });
  expect(r.payouts).toEqual({ transfer_creating: 1, transfer_failed: 1, transfer_pending: 1 });
  expect(r.contacts).toEqual({ total: 2, email_opted_out: 1, email_suppressed: 1 });
});

test('a missing table reports null instead of failing the report', async () => {
  mockMissing.add('crm_messages');
  mockMissing.add('job_locks');
  const r = await buildEngineeringReport({ now: NOW });
  expect(r.crm).toEqual({ queued: null, stuck_processing: null, failed_7d: null });
  expect(r.jobs.locks).toBeNull();
  expect(r.email.queued).toBe(1);
});

test('NO PII: last_error is never selected and no address appears in the output', async () => {
  const r = await buildEngineeringReport({ now: NOW });
  expect(COLS.job_runs).not.toMatch(/last_error/);
  const listSelects = mockSelects.filter((s) => s.cols !== '*');
  expect(listSelects.map((s) => s.cols).join(',')).not.toMatch(/email|phone|name, email|recipient|error|body/);
  expect(JSON.stringify(r)).not.toContain(PII);
});

describe('GET /api/agents/reports/engineering', () => {
  const TOKEN = 'x'.repeat(40);
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  beforeAll(() => { process.env.AGENT_REPORT_TOKEN = TOKEN; });
  afterAll(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('401 without the agent token', async () => {
    const res = await request(app).get('/api/agents/reports/engineering');
    expect(res.status).toBe(401);
  });

  test('200 with the token, no-store', async () => {
    const res = await request(app).get('/api/agents/reports/engineering').set('x-agent-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.report).toBe('engineering');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
