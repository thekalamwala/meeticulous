'use strict';
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
  signInWithPassword: jest.fn(),
  mintSessionForEmail: jest.fn(),
}));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
// Additional mocks so authController loads cleanly
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify', () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore', () => ({ set: jest.fn(), verify: jest.fn(), generate: jest.fn(() => '123456') }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/google', () => ({
  getAuthUrl: jest.fn(),
  getTokensFromCode: jest.fn(),
  getCalendarTimezone: jest.fn(),
  oauth2Client: {},
}));
jest.mock('googleapis', () => ({ google: { calendar: jest.fn(() => ({})) } }));
jest.mock('../../utils/cryptoTokens', () => ({ encrypt: jest.fn(v => v) }));

const { supabaseAdmin, signInWithPassword } = require('../../config/supabase');
const ctrl = require('../../controllers/authController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// profileChain: returns same profile for any select call; calls captureUpdate with
// the patch object when .update(patch) is invoked.
const profileChain = (profile, captureUpdate) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve({ data: profile }),
      single: () => Promise.resolve({ data: profile }),
    }),
  }),
  update: (patch) => {
    if (captureUpdate) captureUpdate(patch);
    return { eq: () => Promise.resolve({ error: null }) };
  },
});

beforeEach(() => jest.clearAllMocks());

// ─── login (email + password) ────────────────────────────────────────────────

describe('login lockout (email)', () => {
  test('locked account returns 429 without attempting password', async () => {
    const locked = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'u1', email: 'a@x.com', login_locked_until: locked, failed_login_count: 5 })
    );
    const res = mockRes();
    await ctrl.login({ body: { email: 'a@x.com', password: 'pw' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  test('wrong password increments failed_login_count', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'u1', email: 'a@x.com', failed_login_count: 0, login_locked_until: null }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const res = mockRes();
    await ctrl.login({ body: { email: 'a@x.com', password: 'wrong' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(patch.failed_login_count).toBe(1);
  });

  test('5th failure sets a ~15-min lockout', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'u1', email: 'a@x.com', failed_login_count: 4, login_locked_until: null }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const res = mockRes();
    await ctrl.login({ body: { email: 'a@x.com', password: 'wrong' } }, res);
    expect(patch.failed_login_count).toBe(5);
    expect(patch.login_locked_until).toBeTruthy();
  });

  test('success resets counters', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'u1', email: 'a@x.com', failed_login_count: 3, login_locked_until: null }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't', refresh_token: 'r' } },
      error: null,
    });
    const res = mockRes();
    await ctrl.login({ body: { email: 'a@x.com', password: 'right' } }, res);
    expect(patch && patch.failed_login_count).toBe(0);
  });
});

// ─── loginWithPhone ───────────────────────────────────────────────────────────

describe('loginWithPhone lockout', () => {
  const baseProfile = {
    id: 'p1',
    email: 'p1@phone.com',
    phone: '+911234567890',
    role: 'guest',
    password_set: true,
    failed_login_count: 0,
    login_locked_until: null,
  };

  test('locked phone account returns 429 without attempting password', async () => {
    const locked = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    supabaseAdmin.from.mockReturnValue(
      profileChain({ ...baseProfile, login_locked_until: locked, failed_login_count: 5 })
    );
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'pw' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  test('wrong phone password increments failed_login_count', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ ...baseProfile }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'wrong' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(patch.failed_login_count).toBe(1);
  });

  test('5th phone failure sets a ~15-min lockout', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ ...baseProfile, failed_login_count: 4 }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'wrong' } }, res);
    expect(patch.failed_login_count).toBe(5);
    expect(patch.login_locked_until).toBeTruthy();
  });

  test('successful phone login resets counters', async () => {
    let patch = null;
    supabaseAdmin.from.mockReturnValue(
      profileChain({ ...baseProfile, failed_login_count: 2 }, (p) => { patch = p; })
    );
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'p1' }, session: { access_token: 't', refresh_token: 'r' } },
      error: null,
    });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'right' } }, res);
    expect(patch && patch.failed_login_count).toBe(0);
  });
});

// ─── enumeration hardening ────────────────────────────────────────────────────
// All three negatives must produce byte-identical 401 responses so an attacker
// cannot distinguish "number not registered" from "wrong role" from "bad password".

describe('loginWithPhone enumeration hardening', () => {
  const EXPECTED_STATUS = 401;
  const EXPECTED_MSG = 'Invalid phone or password';

  test('no account for phone → 401 with uniform message (not 404)', async () => {
    supabaseAdmin.from.mockReturnValue(
      profileChain(null)
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'x' } });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'anypassword' } }, res);
    expect(res.status).toHaveBeenCalledWith(EXPECTED_STATUS);
    expect(res.json.mock.calls[0][0].message).toBe(EXPECTED_MSG);
    // Timing-equalization: a dummy auth call IS made on the no-account path so an
    // attacker can't distinguish it from a real wrong-password attempt by timing.
    expect(signInWithPassword).toHaveBeenCalled();
  });

  test('account exists with role=host → 401 with uniform message (not 409 mentioning vendor)', async () => {
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'v1', email: 'v@x.com', phone: '+911234567890', role: 'host',
                     password_set: true, failed_login_count: 0, login_locked_until: null })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'x' } });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'anypassword' } }, res);
    expect(res.status).toHaveBeenCalledWith(EXPECTED_STATUS);
    expect(res.json.mock.calls[0][0].message).toBe(EXPECTED_MSG);
    // Must not leak role information
    expect(res.json.mock.calls[0][0].message).not.toMatch(/vendor/i);
    // Timing-equalization dummy auth call is made (see no-account test).
    expect(signInWithPassword).toHaveBeenCalled();
  });

  test('valid guest + wrong password → 401 with same uniform message', async () => {
    supabaseAdmin.from.mockReturnValue(
      profileChain({ id: 'p1', email: 'p1@phone.com', phone: '+911234567890', role: 'guest',
                     password_set: true, failed_login_count: 0, login_locked_until: null })
    );
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const res = mockRes();
    await ctrl.loginWithPhone({ body: { phone: '+911234567890', password: 'wrongpassword' } }, res);
    expect(res.status).toHaveBeenCalledWith(EXPECTED_STATUS);
    expect(res.json.mock.calls[0][0].message).toBe(EXPECTED_MSG);
  });
});
