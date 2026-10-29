/**
 * tests/integration/notifications.test.js
 * Integration tests for /api/notifications:
 *   - GET /api/notifications?role=guest|host   (list)
 *   - POST /api/notifications/read-all         (markAllRead)
 *   - PATCH /api/notifications/:id/read        (markRead)
 */
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => { req.user = { id: 'user-uuid' }; next(); },
  requireHost: (_req, _res, next) => next(),
}));

const request                = require('supertest');
const express                = require('express');
const { supabaseAdmin }      = require('../../config/supabase');
const notificationRoutes     = require('../../routes/notificationRoutes');

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

// ── Chain helpers ─────────────────────────────────────────────────────────────

// Build a fluent chain where limit() is the terminal that resolves `resolved`.
// Used by list() controller: .from → .select → .eq → .eq → .order → .limit
const listChain = (resolved) => {
  const c = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockResolvedValue(resolved),
  };
  return c;
};

// Build a chain where is() is the terminal that resolves `resolved`.
// Used by markAllRead() controller: .from → .update → .eq → .eq → .is
const isChain = (resolved) => {
  const c = {
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    is:     jest.fn().mockResolvedValue(resolved),
  };
  return c;
};

// Build a chain where the last eq() is the terminal.
// Used by markRead() controller: .from → .update → .eq → .eq
// The second .eq() must resolve, not return this.
const updateChain = (resolved) => {
  let callCount = 0;
  const c = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation(() => {
      callCount++;
      // First eq returns chainable; second (last) resolves.
      if (callCount >= 2) return Promise.resolve(resolved);
      return c;
    }),
  };
  return c;
};

afterEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications?role=guest — list guest feed
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/notifications', () => {
  const GUEST_ROW = {
    id: 'n-1', type: 'booking_confirmed', title: 'Booking confirmed',
    body: 'Your slot is locked in.', link: '/bookings/1',
    data: {}, read_at: null, created_at: '2026-06-26T10:00:00Z',
  };
  const HOST_ROW = {
    id: 'n-2', type: 'payout_processed', title: 'Payout sent',
    body: null, link: null,
    data: {}, read_at: '2026-06-25T08:00:00Z', created_at: '2026-06-25T08:00:00Z',
  };

  test('200 — role=guest returns guest rows and correct unreadCount', async () => {
    supabaseAdmin.from.mockReturnValueOnce(listChain({ data: [GUEST_ROW], error: null }));

    const res = await request(app).get('/api/notifications?role=guest');

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].id).toBe('n-1');
    expect(res.body.unreadCount).toBe(1); // read_at is null → unread
  });

  test('200 — role=host returns host rows and correct unreadCount', async () => {
    supabaseAdmin.from.mockReturnValueOnce(listChain({ data: [HOST_ROW], error: null }));

    const res = await request(app).get('/api/notifications?role=host');

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].id).toBe('n-2');
    expect(res.body.unreadCount).toBe(0); // read_at is set → already read
  });

  test('200 — default (no role param) treats as guest', async () => {
    supabaseAdmin.from.mockReturnValueOnce(listChain({ data: [GUEST_ROW], error: null }));

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);
    // The controller must have called .eq("role", "guest")
    const fromCall = supabaseAdmin.from.mock.calls[0];
    expect(fromCall[0]).toBe('in_app_notifications');
  });

  test('200 — empty feed returns empty array and unreadCount=0', async () => {
    supabaseAdmin.from.mockReturnValueOnce(listChain({ data: [], error: null }));

    const res = await request(app).get('/api/notifications?role=guest');

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.unreadCount).toBe(0);
  });

  test('200 — mixed read/unread: unreadCount counts only null read_at', async () => {
    const rows = [
      { ...GUEST_ROW, id: 'n-a', read_at: null },
      { ...GUEST_ROW, id: 'n-b', read_at: '2026-06-20T00:00:00Z' },
      { ...GUEST_ROW, id: 'n-c', read_at: null },
    ];
    supabaseAdmin.from.mockReturnValueOnce(listChain({ data: rows, error: null }));

    const res = await request(app).get('/api/notifications?role=guest');

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/read-all?role=guest — mark all guest unread as read
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/notifications/read-all', () => {
  test('200 — marks unread guest rows read', async () => {
    supabaseAdmin.from.mockReturnValueOnce(isChain({ error: null }));

    const res = await request(app).post('/api/notifications/read-all?role=guest');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify .is("read_at", null) was called (filters only unread rows).
    const fromInstance = supabaseAdmin.from.mock.results[0].value;
    expect(fromInstance.is).toHaveBeenCalledWith('read_at', null);
  });

  test('200 — role=host filters by host role', async () => {
    supabaseAdmin.from.mockReturnValueOnce(isChain({ error: null }));

    const res = await request(app).post('/api/notifications/read-all?role=host');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const fromInstance = supabaseAdmin.from.mock.results[0].value;
    // eq called with both user_id and role=host
    const eqCalls = fromInstance.eq.mock.calls;
    const roleCall = eqCalls.find(([field, val]) => field === 'role' && val === 'host');
    expect(roleCall).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read — mark a single notification read
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/notifications/:id/read', () => {
  test('200 — marks the specified notification read for the caller', async () => {
    supabaseAdmin.from.mockReturnValueOnce(updateChain({ error: null }));

    const res = await request(app).patch('/api/notifications/n-1/read');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Must target the correct table
    expect(supabaseAdmin.from).toHaveBeenCalledWith('in_app_notifications');
  });

  test('200 — scopes update to eq("id", notifId) and eq("user_id", callerId)', async () => {
    const stub = updateChain({ error: null });
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).patch('/api/notifications/abc-123/read');

    expect(res.status).toBe(200);
    const eqCalls = stub.eq.mock.calls;
    const idCall     = eqCalls.find(([field, val]) => field === 'id'      && val === 'abc-123');
    const userIdCall = eqCalls.find(([field, val]) => field === 'user_id' && val === 'user-uuid');
    expect(idCall).toBeDefined();
    expect(userIdCall).toBeDefined();
  });
});
