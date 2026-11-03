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
  getTokensFromCode: jest.fn(),
  hasCalendarScopes: jest.requireActual('../../config/google').hasCalendarScopes,
  getCalendarTimezone: jest.fn().mockResolvedValue('Asia/Kolkata'),
  oauth2Client: {},
}));

jest.mock('../../utils/cryptoTokens', () => ({
  encrypt: (v) => (v ? `enc:${v}` : v),
  decrypt: (v) => v,
  isEncrypted: (v) => typeof v === 'string' && v.startsWith('enc:'),
}));

jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));
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
const { getTokensFromCode, getCalendarTimezone } = require('../../config/google');
const profileSecrets = require('../../utils/profileSecrets');
const { trackServer } = require('../../utils/trackServer');
const FULL_SCOPE = 'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.settings.readonly';
// Every update() payload passed on a from('profiles') chain.
const profileUpdates = () =>
  supa.supabaseAdmin.from.mock.results
    .filter((r, i) => supa.supabaseAdmin.from.mock.calls[i][0] === 'profiles')
    .flatMap((r) => r.value.update.mock.calls.map((c) => c[0]));
const { googleVendorAuth, googleAuth, googleCallback } = require('../../controllers/authController');

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
  jest.spyOn(profileSecrets, 'setGoogleTokens').mockResolvedValue(undefined);
  jest.spyOn(profileSecrets, 'getGoogleTokens').mockResolvedValue({});
  getTokensFromCode.mockResolvedValue({ access_token: 'at', refresh_token: 'rt', scope: FULL_SCOPE });
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

  test('vendor_auth cancel (error, no code) → /login-as-vendor?error=cancelled', async () => {
    const r = res();
    await googleCallback({ query: { error: 'access_denied', state: signState({ flow: 'vendor_auth' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/login-as-vendor?error=cancelled');
    expect(r.status).not.toHaveBeenCalled();
  });

  test('calendar_connect cancel from onboarding → back to the calendar screen, denied', async () => {
    const r = res();
    await googleCallback({ query: { error: 'access_denied', state: signState({ flow: 'calendar_connect', uid: 'h', ret: '/vendor-register/my-page/calendar' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/vendor-register/my-page/calendar?google=denied');
  });

  test('calendar_connect cancel with unsafe ret → /dashboard?google=denied', async () => {
    const r = res();
    await googleCallback({ query: { error: 'access_denied', state: signState({ flow: 'calendar_connect', uid: 'h', ret: '//evil.com' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=denied');
  });

  test('error with forged state and no code → still 400', async () => {
    const r = res();
    await googleCallback({ query: { error: 'access_denied', state: 'nope' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('calendar_connect exchange failure from onboarding → returns to the calendar screen with google=error', async () => {
    getTokensFromCode.mockRejectedValueOnce(new Error('exchange boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'h', ret: '/vendor-register/my-page/calendar' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/vendor-register/my-page/calendar?google=error&reason=auth_failed');
    errSpy.mockRestore();
  });

  test('calendar_connect exchange failure without ret → /dashboard?google=error', async () => {
    getTokensFromCode.mockRejectedValueOnce(new Error('exchange boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'h' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=error&reason=auth_failed');
    errSpy.mockRestore();
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

describe('googleCallback — granted calendar scopes', () => {
  const NO_CAL = { access_token: 'at', refresh_token: 'rt', scope: 'openid email profile' };
  const vendorState = (intent = 'signup') => signState({ flow: 'vendor_auth', intent });

  test('signup without calendar scopes → not connected, not skipped, still logs in (new=1)', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    const r = res();
    await googleCallback({ query: { code: 'abc', state: vendorState() } }, r);
    const u = profileUpdates();
    expect(u.some((p) => p.google_calendar_connected === true)).toBe(false);
    expect(u).toContainEqual(expect.objectContaining({ google_calendar_connected: false, calendar_skipped: false }));
    expect(u.some((p) => p.calendar_skipped === true)).toBe(false);
    expect(trackServer).toHaveBeenCalledWith('p-1', 'calendar_scope_denied', { source: 'signup' }, expect.anything());
    // Denied: no tokens stored, no legacy revoke read, no Google timezone call.
    expect(profileSecrets.setGoogleTokens).not.toHaveBeenCalled();
    expect(profileSecrets.getGoogleTokens).not.toHaveBeenCalled();
    expect(getCalendarTimezone).not.toHaveBeenCalled();
    // Flow A is the login identity: google_id IS recorded.
    expect(u).toContainEqual(expect.objectContaining({ google_id: 'g-1' }));
    expect(mockMintSession).toHaveBeenCalled();
    expect(r.redirect.mock.calls[0][0]).toContain('new=1');
  });

  test('returning (not yet connected) host denied calendar → source login', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    supa.__state.existing = { id: 'p-1', role: 'host', is_host: true, email: 'new@vendor.com', google_calendar_connected: false };
    await googleCallback({ query: { code: 'abc', state: vendorState('login') } }, res());
    expect(trackServer).toHaveBeenCalledWith('p-1', 'calendar_scope_denied', { source: 'login' }, expect.anything());
  });

  test('signup with full scopes → calendar_skipped:true and connected:true', async () => {
    const r = res();
    await googleCallback({ query: { code: 'abc', state: vendorState() } }, r);
    const u = profileUpdates();
    expect(u).toContainEqual(expect.objectContaining({ calendar_skipped: true }));
    expect(u).toContainEqual(expect.objectContaining({ google_calendar_connected: true }));
    expect(trackServer).toHaveBeenCalledWith('p-1', 'auth_completed', { method: 'google', new: '1' }, expect.anything());
    expect(trackServer).not.toHaveBeenCalledWith('p-1', 'calendar_scope_denied', expect.anything(), expect.anything());
  });

  test('existing connected host, plain login without refresh token/scopes → never flipped to disconnected', async () => {
    getTokensFromCode.mockResolvedValue({ access_token: 'at', scope: 'openid email profile' });
    supa.__state.existing = { id: 'p-1', role: 'host', is_host: true, email: 'new@vendor.com', google_calendar_connected: true };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: vendorState('login') } }, r);
    expect(profileUpdates().some((p) => p.google_calendar_connected === false)).toBe(false);
    expect(r.redirect.mock.calls[0][0]).toContain('new=0');
  });

  test('already-connected host re-consents with a refresh_token but no calendar scopes → no profiles update sets google_calendar_connected:false', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    supa.__state.existing = { id: 'p-1', role: 'host', is_host: true, email: 'new@vendor.com', google_calendar_connected: true };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: vendorState('login') } }, r);
    const u = profileUpdates();
    expect(u.some((p) => 'google_calendar_connected' in p || 'calendar_skipped' in p)).toBe(false);
    expect(trackServer).toHaveBeenCalledWith('p-1', 'calendar_scope_denied', { source: 'login' }, expect.anything());
    expect(r.redirect.mock.calls[0][0]).toContain('new=0');
  });

  test('calendar_connect denied for an already-connected host → denied redirect, connection untouched', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    supa.__state.existing = { id: 'host-9', role: 'host', google_calendar_connected: true };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'host-9' }) } }, r);
    expect(profileUpdates().some((p) => 'google_calendar_connected' in p)).toBe(false);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=denied');
  });

  test('upgraded customer without calendar scopes → calendar_skipped:false written', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    supa.__state.existing = { id: 'u-1', role: 'guest', is_host: false, email: 'new@vendor.com' };
    const r = res();
    await googleCallback({ query: { code: 'abc', state: vendorState('login') } }, r);
    expect(profileUpdates()).toContainEqual(expect.objectContaining({ google_calendar_connected: false, calendar_skipped: false }));
    expect(r.redirect.mock.calls[0][0]).toContain('new=upgrade');
  });

  test('calendar_connect without calendar scopes → ?google=denied', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'host-9' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=denied');
    expect(trackServer).toHaveBeenCalledWith('host-9', 'calendar_scope_denied', { source: 'dashboard' }, expect.anything());
    // Nothing was attached, so the calendar account's google_id must not be written.
    expect(profileUpdates().some((p) => 'google_id' in p)).toBe(false);
    expect(profileSecrets.setGoogleTokens).not.toHaveBeenCalled();
    expect(profileSecrets.getGoogleTokens).not.toHaveBeenCalled();
    expect(getCalendarTimezone).not.toHaveBeenCalled();
  });
});

describe('calendar connect return path', () => {
  const stateFor = (ret) => {
    const r = res();
    googleAuth({ user: { id: 'host-9' }, query: ret === undefined ? {} : { return: ret } }, r);
    return jwt.verify(new URL(r.json.mock.calls[0][0].url).searchParams.get('state'), 'test-oauth-secret');
  };
  const NO_CAL = { access_token: 'at', refresh_token: 'rt', scope: 'openid email profile' };

  test('onboarding calendar path → ret in state, callback redirects there', async () => {
    const st = stateFor('/vendor-register/my-page/calendar');
    expect(st.ret).toBe('/vendor-register/my-page/calendar');
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: st.flow, uid: st.uid, ret: st.ret }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/vendor-register/my-page/calendar?google=connected');
  });

  test.each([
    '//evil.com', 'https://evil.com', '/dashboard/../x', '/vendor-register/x/calendar?next=/y',
    '/vendor-register/x/calendar#f', '/vendor-register/x%2Fy/calendar', '/vendor-register/X/calendar',
    '/vendor-register//calendar', '/dashboard\\evil', '/vendor-register/x/calendar/', ['/dashboard'], { a: 1 }, '',
  ])('rejects %p → no ret, dashboard redirect', async (bad) => {
    const st = stateFor(bad);
    expect(st.ret).toBeUndefined();
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: st.flow, uid: st.uid, ret: st.ret }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=connected');
  });

  test('no return param → no ret', () => {
    expect(stateFor(undefined).ret).toBeUndefined();
  });

  test('callback re-validates a forged ret in signed state', async () => {
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'host-9', ret: '//evil.com' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/dashboard?google=connected');
  });

  test('denied from onboarding → denied redirect there, source onboarding', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    const r = res();
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'calendar_connect', uid: 'host-9', ret: '/vendor-register/my-page/calendar' }) } }, r);
    expect(r.redirect.mock.calls[0][0]).toBe('https://app.test/vendor-register/my-page/calendar?google=denied');
    expect(trackServer).toHaveBeenCalledWith('host-9', 'calendar_scope_denied', { source: 'onboarding' }, expect.anything());
  });
});

describe('browser timezone fallback', () => {
  const NO_CAL = { access_token: 'at', refresh_token: 'rt', scope: 'openid email profile' };
  const stateTz = (tz) => {
    const r = res();
    googleVendorAuth({ query: { intent: 'signup', tz } }, r);
    return jwt.verify(r.json.mock.calls[0][0].url.split('state=')[1], 'test-oauth-secret');
  };
  // Every upsert payload written on a from('availability') chain.
  const availUpserts = () =>
    supa.supabaseAdmin.from.mock.results
      .filter((r, i) => supa.supabaseAdmin.from.mock.calls[i][0] === 'availability')
      .flatMap((r) => r.value.upsert.mock.calls.map((c) => c[0]));

  test('valid tz is carried in the signed state', () => {
    expect(stateTz('Europe/London').tz).toBe('Europe/London');
  });

  test.each(['Not/AZone', '', ['Asia/Dubai'], { a: 1 }, 'A'.repeat(65)])('rejects %p → no tz in state', (bad) => {
    expect(stateTz(bad).tz).toBeUndefined();
  });

  test('signup without calendar scopes and state tz Asia/Dubai → availability timezone Asia/Dubai', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup', tz: 'Asia/Dubai' }) } }, res());
    expect(availUpserts()).toContainEqual(expect.objectContaining({ host_id: 'p-1', timezone: 'Asia/Dubai' }));
  });

  test('signup without calendar scopes and no tz → Asia/Kolkata', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup' }) } }, res());
    expect(availUpserts()).toContainEqual(expect.objectContaining({ timezone: 'Asia/Kolkata' }));
  });

  test.each(['UTC', 'GMT', 'Etc/UTC'])('Google reporting %s does not beat the browser tz', async (g) => {
    getCalendarTimezone.mockResolvedValueOnce(g);
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup', tz: 'Asia/Dubai' }) } }, res());
    expect(availUpserts()).toContainEqual(expect.objectContaining({ timezone: 'Asia/Dubai' }));
  });

  test('availability read error → no upsert (never overwrite a chosen timezone)', async () => {
    const realFrom = supa.supabaseAdmin.from.getMockImplementation();
    supa.supabaseAdmin.from.mockImplementation((t) => {
      const c = realFrom(t);
      if (t === 'availability') c.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'db down' } });
      return c;
    });
    getTokensFromCode.mockResolvedValue(NO_CAL);
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup', tz: 'Asia/Dubai' }) } }, res());
    expect(availUpserts()).toEqual([]);
    supa.supabaseAdmin.from.mockImplementation(realFrom);
  });

  test('browser UTC is normalised to Asia/Kolkata', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup', tz: 'UTC' }) } }, res());
    expect(availUpserts()).toContainEqual(expect.objectContaining({ timezone: 'Asia/Kolkata' }));
  });

  test('calendar granted but Google settings call fails → falls back to state tz', async () => {
    require('../../config/google').getCalendarTimezone.mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'signup', tz: 'Asia/Dubai' }) } }, res());
    expect(availUpserts()).toContainEqual(expect.objectContaining({ timezone: 'Asia/Dubai' }));
    errSpy.mockRestore();
  });

  test('already-connected host with calendar denied → no availability write', async () => {
    getTokensFromCode.mockResolvedValue(NO_CAL);
    supa.__state.existing = { id: 'p-1', role: 'host', is_host: true, email: 'new@vendor.com', google_calendar_connected: true };
    await googleCallback({ query: { code: 'abc', state: signState({ flow: 'vendor_auth', intent: 'login', tz: 'Asia/Dubai' }) } }, res());
    expect(availUpserts()).toEqual([]);
  });
});
