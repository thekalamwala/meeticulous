/**
 * tests/unit/adminAuthController.test.js
 * Admin staff login against the SEPARATE credential store (admin_users):
 * username/email + bcrypt password -> isolated admin session token with the
 * role's resolved permissions. No Supabase Auth, no OTP.
 */
process.env.SUPER_ADMIN_JWT_SECRET = 'test-admin-secret';

const bcrypt = require('bcryptjs');

// Stateful supabase mock — globalThis.__staff / __rolePerms drive each test.
jest.mock('../../config/supabase', () => {
  const buildSelect = (table) => {
    const filters = {};
    const b = {
      select: jest.fn(() => b),
      eq: jest.fn((c, v) => { filters[c] = v; return b; }),
      maybeSingle: jest.fn(() => {
        if (table === 'admin_users') {
          const s = globalThis.__staff;
          if (!s) return Promise.resolve({ data: null });
          const hit =
            (filters.username && filters.username === s.username) ||
            (filters.email && filters.email === s.email) ||
            (filters.id && filters.id === s.id);
          return Promise.resolve({ data: hit ? s : null });
        }
        if (table === 'admin_roles') return Promise.resolve({ data: { permissions: globalThis.__rolePerms } });
        return Promise.resolve({ data: null });
      }),
    };
    return b;
  };
  return {
    supabaseAdmin: {
      from: jest.fn((table) => ({
        select: (...a) => buildSelect(table).select(...a),
        update: jest.fn((payload) => {
          (globalThis.__updates || (globalThis.__updates = [])).push({ table, payload });
          return { eq: jest.fn(() => Promise.resolve({ error: null })) };
        }),
      })),
    },
  };
});

const { adminLogin, jwtVerify } = require('../../controllers/adminAuthController');

const PASSWORD = 'Secret123!';
const HASH = bcrypt.hashSync(PASSWORD, 10);

const mockReq = (body = {}) => ({ body });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const seedStaff = (over = {}) => {
  globalThis.__staff = {
    id: 'staff-1', email: 'ops@bookasloth.com', username: 'ops', name: 'Ops Admin',
    password_hash: HASH, role_key: 'operations', is_active: true,
    failed_attempts: 0, locked_until: null, ...over,
  };
  globalThis.__rolePerms = ['ops.view', 'bookings.view'];
};

// Last write the controller pushed to the admin_users row (capture set up in the mock).
const lastAdminWrite = () => {
  const u = (globalThis.__updates || []).filter((x) => x.table === 'admin_users');
  return u.length ? u[u.length - 1].payload : null;
};

describe('adminLogin (credential store)', () => {
  beforeEach(() => { jest.clearAllMocks(); globalThis.__updates = []; seedStaff(); });

  test('400 — missing identifier or password', async () => {
    const res = mockRes();
    await adminLogin(mockReq({ password: 'x' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('401 — unknown account', async () => {
    globalThis.__staff = null;
    const res = mockRes();
    await adminLogin(mockReq({ username: 'nobody', password: PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 — wrong password', async () => {
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: 'wrong' }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 — inactive account', async () => {
    seedStaff({ is_active: false });
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('429 — locked account', async () => {
    seedStaff({ locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  // Login now returns a short-lived pending token, NOT a full session (2FA gate added v2.5).
  // When totp_enabled is false (no 2FA enrolled), the response is enroll_required + pending_token.
  // When totp_enabled is true, the response is twofa_required + pending_token.
  // Full sessions are only issued after the second factor (verify2fa / confirm2fa).

  test('200 — login by username (no 2FA enrolled) returns enroll_required pending token', async () => {
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: PASSWORD }), res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.enroll_required).toBe(true);
    expect(payload.pending_token).toBeDefined();
    // No full session in this response.
    expect(payload.token).toBeUndefined();
    expect(payload.permissions).toBeUndefined();
    // Pending token carries the enroll type.
    const decoded = jwtVerify(payload.pending_token);
    expect(decoded.type).toBe('admin_2fa_enroll');
    expect(decoded.sub).toBe('staff-1');
  });

  test('200 — login by email (no 2FA enrolled) also returns pending token', async () => {
    const res = mockRes();
    await adminLogin(mockReq({ email: 'ops@bookasloth.com', password: PASSWORD }), res);
    expect(res.status).not.toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(payload.enroll_required).toBe(true);
    expect(payload.pending_token).toBeDefined();
  });

  test('200 — login with totp_enabled=true returns twofa_required pending token', async () => {
    seedStaff({ totp_enabled: true });
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: PASSWORD }), res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.twofa_required).toBe(true);
    expect(payload.pending_token).toBeDefined();
    expect(payload.token).toBeUndefined();
    const decoded = jwtVerify(payload.pending_token);
    expect(decoded.type).toBe('admin_2fa');
    expect(decoded.sub).toBe('staff-1');
  });
});

describe('adminLogin — lockout window resets after the lock expires', () => {
  beforeEach(() => { jest.clearAllMocks(); globalThis.__updates = []; seedStaff(); });

  // Regression: failed_attempts is only reset on a *successful* login, so once a
  // lock elapses the stale counter (already at MAX) re-locks on the very next
  // wrong password — pinning the account to one attempt per LOCK_MS forever.
  test('a wrong password AFTER an expired lock opens a fresh window (no instant re-lock)', async () => {
    seedStaff({ failed_attempts: 5, locked_until: new Date(Date.now() - 1000).toISOString() });
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: 'wrong' }), res);

    expect(res.status).toHaveBeenCalledWith(401);   // gate cleared (lock expired); creds wrong
    const w = lastAdminWrite();
    expect(w).not.toBeNull();
    expect(w.failed_attempts).toBe(1);              // fresh count — NOT 6
    expect(w.locked_until).toBeNull();              // must NOT re-lock on the first post-expiry try
  });

  // Guard: a genuine run of 5 fresh failures must still lock (brute-force defence intact).
  test('the 5th consecutive failure in a fresh window still locks', async () => {
    seedStaff({ failed_attempts: 4, locked_until: null });
    const res = mockRes();
    await adminLogin(mockReq({ username: 'ops', password: 'wrong' }), res);

    const w = lastAdminWrite();
    expect(w.failed_attempts).toBe(5);
    expect(w.locked_until).toBeTruthy();
  });
});
