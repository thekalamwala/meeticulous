/**
 * tests/unit/notificationAdminController.test.js
 *
 * Covers the two notification-log fixes:
 *   1. getLogs overlays the TRUE email status from email_logs onto the
 *      enqueue-time snapshot stored in notification_logs (and filters on it).
 *   3. retryLog re-queues the ORIGINAL email_logs row (never a placeholder send).
 */
'use strict';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/aisensyService', () => ({ sendCampaign: jest.fn(), testConnection: jest.fn() }));
jest.mock('../../services/notificationEngine', () => ({ logResult: jest.fn(), clearCache: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const aisensy = require('../../services/aisensyService');
const NotificationEngine = require('../../services/notificationEngine');
const ctrl = require('../../controllers/notificationAdminController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// Awaitable query builder (supabase-js resolves when you await the builder itself).
const thenable = (result) => {
  const c = {};
  ['select', 'eq', 'order', 'limit', 'in'].forEach((m) => { c[m] = jest.fn(() => c); });
  c.then = (resolve) => resolve(result);
  return c;
};
// Terminal-method builder (.single() / .maybeSingle()).
const terminal = (resolved) => {
  const c = {};
  ['select', 'eq', 'update'].forEach((m) => { c[m] = jest.fn(() => c); });
  c.single = jest.fn(() => Promise.resolve(resolved));
  c.maybeSingle = jest.fn(() => Promise.resolve(resolved));
  return c;
};

beforeEach(() => jest.clearAllMocks());

describe('overlayEmailLogStatus', () => {
  const { overlayEmailLogStatus } = ctrl;

  test('email row inherits the real email_logs status (queued snapshot → sent)', () => {
    const rows = [{ channel: 'email', status: 'pending', payload: { logId: 'e1' } }];
    expect(overlayEmailLogStatus(rows, { e1: 'sent' })[0].status).toBe('sent');
  });

  test('maps queued→pending and failed→failed', () => {
    const rows = [
      { channel: 'email', status: 'pending', payload: { logId: 'a' } },
      { channel: 'email', status: 'pending', payload: { logId: 'b' } },
    ];
    const out = overlayEmailLogStatus(rows, { a: 'queued', b: 'failed' });
    expect(out.map((r) => r.status)).toEqual(['pending', 'failed']);
  });

  test('email row without a logId is left untouched', () => {
    const rows = [{ channel: 'email', status: 'pending', payload: {} }];
    expect(overlayEmailLogStatus(rows, { e1: 'sent' })[0].status).toBe('pending');
  });

  test('logId with no matching email_logs entry is left untouched', () => {
    const rows = [{ channel: 'email', status: 'pending', payload: { logId: 'missing' } }];
    expect(overlayEmailLogStatus(rows, { e1: 'sent' })[0].status).toBe('pending');
  });

  test('whatsapp rows are never overlaid', () => {
    const rows = [{ channel: 'whatsapp', status: 'sent', payload: { logId: 'e1' } }];
    expect(overlayEmailLogStatus(rows, { e1: 'failed' })[0].status).toBe('sent');
  });
});

describe('getLogs', () => {
  const notifRows = [
    { id: 'n1', channel: 'email', status: 'pending', payload: { logId: 'e1' } },   // really sent
    { id: 'n2', channel: 'email', status: 'pending', payload: { logId: 'e2' } },   // really failed
    { id: 'n3', channel: 'whatsapp', status: 'sent', payload: {} },
  ];
  const emailRows = [{ id: 'e1', status: 'sent' }, { id: 'e2', status: 'failed' }];

  const wireTables = () => supabaseAdmin.from.mockImplementation((table) =>
    table === 'email_logs' ? thenable({ data: emailRows, error: null })
                           : thenable({ data: notifRows, error: null }));

  test('overlays the true email status onto pending snapshots', async () => {
    wireTables();
    const res = mockRes();
    await ctrl.getLogs({ query: {} }, res);
    const out = res.json.mock.calls[0][0];
    expect(out.find((r) => r.id === 'n1').status).toBe('sent');
    expect(out.find((r) => r.id === 'n2').status).toBe('failed');
    expect(out.find((r) => r.id === 'n3').status).toBe('sent'); // whatsapp untouched
  });

  test('status filter matches the corrected status, not the snapshot', async () => {
    wireTables();
    const res = mockRes();
    await ctrl.getLogs({ query: { status: 'sent' } }, res);
    const out = res.json.mock.calls[0][0];
    // n1 (snapshot pending → really sent) and n3 (whatsapp sent) qualify; n2 (failed) excluded.
    expect(out.map((r) => r.id).sort()).toEqual(['n1', 'n3']);
  });
});

describe('retryLog (email)', () => {
  test('re-queues the original email_logs row by payload.logId', async () => {
    const emailChain = terminal({ data: { id: 'e1', status: 'queued' }, error: null });
    supabaseAdmin.from.mockImplementation((table) =>
      table === 'email_logs'
        ? emailChain
        : terminal({ data: { id: 'n1', channel: 'email', event_key: 'BOOKING_CONFIRMED_VENDOR', destination: 'a@b.com', payload: { logId: 'e1' } } }));

    const res = mockRes();
    await ctrl.retryLog({ params: { id: 'n1' } }, res);

    expect(emailChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued', attempts: 0, error: null })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/re-queued/i) }));
  });

  test('email row with no logId → 400 (no placeholder send)', async () => {
    supabaseAdmin.from.mockReturnValue(
      terminal({ data: { id: 'n1', channel: 'email', destination: 'a@b.com', payload: {} } }));
    const res = mockRes();
    await ctrl.retryLog({ params: { id: 'n1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('whatsapp retry still re-sends via AiSensy (unchanged branch)', async () => {
    aisensy.sendCampaign.mockResolvedValueOnce({ success: true, response: { ok: true } });
    supabaseAdmin.from.mockImplementation((table) =>
      table === 'notification_providers'
        ? terminal({ data: { provider: 'aisensy', api_key: 'k1' } })
        : terminal({ data: { id: 'n9', channel: 'whatsapp', event_key: 'BOOKING_OTP', destination: '919876543210', payload: { campaignName: 'OTP', templateParams: ['1'] } } }));

    const res = mockRes();
    await ctrl.retryLog({ params: { id: 'n9' } }, res);

    expect(aisensy.sendCampaign).toHaveBeenCalledWith(expect.objectContaining({ campaignName: 'OTP', apiKey: 'k1' }));
    expect(NotificationEngine.logResult).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
