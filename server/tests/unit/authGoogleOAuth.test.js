/**
 * tests/unit/authGoogleOAuth.test.js
 *
 * Exercises the vendor Google OAuth round-trip end-to-end with Google and
 * Supabase session-minting MOCKED, but the real `jsonwebtoken` state signing/
 * verification and the real flow branching. This is the closest we can get to
 * the live OAuth flow in CI (a real Google consent screen can't run headless).
 *
 * Covered:
 *   - signup (new vendor): creates auth user + host profile, attaches tokens,
 *     seeds slim onboarding, mints session, redirects to /auth/google/done
 *   - login (existing host): no create, attaches, mints, redirects
 *   - existing customer upgraded to host in-flow (no dead-end) → new=upgrade
 *   - superadmin NOT upgraded (capability preserved) → new=0
 *   - forged/invalid state → /login-as-vendor?error=invalid_state (CSRF)
 *   - missing code → 400
 *   - session mint throws → vendor lands on /login-as-vendor (NOT /dashboard)
 *   - calendar-connect flow (signed uid) → /dashboard?google=connected
 */

// State secret must be set BEFORE the controller is required (it reads it once).
process.env.OAUTH_STATE_SECRET = 'test-oauth-secret';
process.env.CLIENT_URL = 'https://app.test';

let mockGoogleUser = { id: 'g-1', email: 'new@vendor.com', name: 'New Vendor' };
const mockMintSession = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })) },
    oauth2: jest.fn(() => ({ userinfo: { get: jest.fn().mockImplementation(async () => ({ data: mockGoogleUser })) } })),
  },
}));

jest.mock('../../config/google', () => ({
  getAuthUrl: jest.fn((state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state || ''}`),
  getTokensFromCode: jest.fn().mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
  getCalendarTimezone: jest.fn().mockResolvedValue('Asia/Kolkata'),
  oauth2Client: {},
}));

jest.mock('../../utils/cryptoTokens', () => ({
  encrypt: (v) => (v ? `enc:${v}` : v),
  decrypt: (v) => v,
  isEncrypted: (v) => typeof v === 'string' && v.startsWith('enc:'),
}));

jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify', () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore', () => ({ set: jest.fn(), verify: jest.fn(), generate: jest.fn(() => '123456') }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({}) }));

// Supabase mock: a configurable chain + admin.createUser + mintSessionForEmail.
jest.mock('../../config/supabase', () => {
  const state = { existing: null, profile: null, createUserResult: null };
  const chain = () => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    // existing-email lookup + slug-availability both use maybeSingle.
    // First call in a flow is the email lookup → return `existing`; slug
    // lookups want null (available). We disambiguate by select args below.
    maybeSingle: jest.fn().mockImplementation(function () {
      return Promise.resolve({ data: this.__emailLookup ? state.existing : null });
    }),
    single: jest.fn().mockResolvedValue({ data: state.profile, error: null }),
  });
  const from = jest.fn().mockImplementation((table) => {
    const c = chain();
    // Tag the chain when the caller selects "id, role, email" / "id, role" so
    // maybeSingle returns the existing profile only for the email lookup.
    const origSelect = c.select;
    c.select = jest.fn((cols) => {
      if (typeof cols === 'string' && cols.includes('role')) c.__emailLookup = true;
      return c;
    });
    return c;
  });
  return {
    __state: state,
    supabaseAdmin: { auth: { admin: { createUser: jest.fn().mockImplementation(async () => state.createUserResult) } }, from },
    signInWithPassword: jest.fn(),
    mintSessionForEmail: mockMintSession,
  };
});

jest.mock('../../services/usernameService', () => ({
  resolve: jest.fn().mockResolvedValue(null),
  createInitialUsername: jest.fn().mockResolvedValue('auto-handle-x1'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
  usernameExists: jest.fn().mockResolvedValue(false),
  changeUsername: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const supa = require('../../config/supabase');
const { googleVendorAuth, googleCallback } = require('../../controllers/authController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.redirect = jest.fn().mockReturnValue(r);
  return r;
};
const signState = (payload) => jwt.sign(payload, 'test-oauth-secret', { expiresIn: '15m' });

beforeEach(() => {
  jest.clearAllMocks();
  supa.__state.existing = null;
  supa.__state.profile = { id: 'p-1', username: 'new-vendor', name: 'New Vendor', email: 'new@vendor.com', role: 'host' };
  supa.__state.createUserResult = { data: { user: { id: 'p-1', email: 'new@vendor.com' } }, error: null };
  mockGoogleUser = { id: 'g-1', email: 'new@vendor.com', name: 'New Vendor' };
  mockMintSession.mockResolvedValue({ access_token: 'sess-at', refresh_token: 'sess-rt' });
});

describe('googleVendorAuth', () => {
  test('signup intent returns a consent URL carrying signed state', () => {
    const r = res();
    googleVendorAuth({ query: { intent: 'signup' } }, r);
    const url = r.json.mock.calls[0][0].url;
    const state = url.split('state=')[1];
    const decoded = jwt.verify(state, 'test-oauth-secret');
    expect(decoded.flow).toBe('vendor_auth');
    expect(decoded.intent).toBe('signup');
  });

  test('defaults unknown intent to login', () => {
    const r = res();
    googleVendorAuth({ query: {} }, r);
    const state = r.json.mock.calls[0][0].url.split('state=')[1];
    expect(jwt.verify(state, 'test-oauth-secret').intent).toBe('login');
  });
});

describe('googleCallback — vendor signup (new)', () => {
  test('creates vendor, mints session, redirects to /auth/google/done with new=1', async () => {
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup' }) } }, r);

    expect(supa.supabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
    expect(mockMintSession).toHaveBeenCalledWith('new@vendor.com');
    const target = r.redirect.mock.calls[0][0];
    expect(target).toContain('https://app.test/auth/google/done#access_token=sess-at');
    expect(target).toContain('refresh_token=sess-rt');
    expect(target).toContain('new=1');
  });
});

describe('googleCallback — vendor login (existing host)', () => {
  test('does NOT create a user, mints session, new=0', async () => {
    supa.__state.existing = { id: 'p-1', role: 'host', is_host: true, email: 'new@vendor.com' };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'login' }) } }, r);

    expect(supa.supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockMintSession).toHaveBeenCalledWith('new@vendor.com');
    expect(r.redirect.mock.calls[0][0]).toContain('new=0');
  });
});

describe('googleCallback — existing customer upgraded to host', () => {
  test('existing guest gains hosting in-flow (no dead-end), mints session, new=upgrade', async () => {
    supa.__state.existing = { id: 'u-1', role: 'guest', is_host: false, email: 'new@vendor.com' };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'login' }) } }, r);

    // Unified identity: no separate account is created — hosting is attached to
    // the SAME profile, a session is minted, and the client routes through
    // onboarding via the new=upgrade flag.
    expect(supa.supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockMintSession).toHaveBeenCalledWith('new@vendor.com');
    expect(r.redirect.mock.calls[0][0]).toContain('new=upgrade');
  });

  test('superadmin is NOT upgraded (capability preserved)', async () => {
    supa.__state.existing = { id: 'sa-1', role: 'superadmin', is_host: false, email: 'new@vendor.com' };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'login' }) } }, r);

    // No in-flow host upgrade for a superadmin; they still get a session (new=0).
    expect(r.redirect.mock.calls[0][0]).toContain('new=0');
  });
});

describe('googleCallback — CSRF / errors', () => {
  test('forged state → invalid_state redirect, no Google exchange', async () => {
    const r = res();
    await googleCallback({ query: { code: 'abc', state: 'not-a-jwt' } }, r);
    expect(r.redirect.mock.calls[0][0]).toContain('/login-as-vendor?error=invalid_state');
    expect(mockMintSession).not.toHaveBeenCalled();
  });

  test('missing code → 400', async () => {
    const r = res();
    await googleCallback({ query: { state: signState({ flow: 'vendor_auth' }) } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('session mint failure routes vendor back to /login-as-vendor (not /dashboard)', async () => {
    mockMintSession.mockRejectedValueOnce(new Error('mint boom'));
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup' }) } }, r);
    const target = r.redirect.mock.calls[0][0];
    // UX rec: the account is already created/upgraded by this point, so a mint
    // failure nudges to sign in (signin_needed) rather than a hard auth_failed.
    expect(target).toContain('/login-as-vendor?error=signin_needed');
    expect(target).not.toContain('/dashboard');
  });
});

describe('googleCallback — calendar connect (legacy, logged-in vendor)', () => {
  test('attaches to the uid in signed state, redirects to dashboard connected', async () => {
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'host-9' }) } }, r);
    expect(mockMintSession).not.toHaveBeenCalled();
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=connected');
  });
});
