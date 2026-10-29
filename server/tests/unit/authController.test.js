/**
 * tests/unit/authController.test.js
 * Tests for registerVendor, registerUser, login, sendOtp, verifyOtp, getMe.
 */
jest.mock('../../config/supabase', () => {
  const mockChain = () => {
    const chain = {
      select:   jest.fn().mockReturnThis(),
      insert:   jest.fn().mockReturnThis(),
      update:   jest.fn().mockReturnThis(),
      upsert:   jest.fn().mockReturnThis(),
      delete:   jest.fn().mockReturnThis(),
      eq:       jest.fn().mockReturnThis(),
      neq:      jest.fn().mockReturnThis(),
      is:       jest.fn().mockResolvedValue({ error: null }),
      single:   jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    return chain;
  };

  const signIn = jest.fn();
  return {
    supabaseAdmin: {
      auth: {
        admin: {
          createUser: jest.fn(),
          deleteUser: jest.fn(),
          listUsers:  jest.fn(),
        },
        signInWithPassword: signIn,
      },
      from: jest.fn().mockImplementation(() => mockChain()),
    },
    // Controllers now sign in via this disposable-client helper; delegate to the
    // same jest.fn so existing test setup (supabaseAdmin.auth.signInWithPassword
    // .mockResolvedValue) continues to drive it.
    signInWithPassword: (email, password) => signIn({ email, password }),
  };
});

jest.mock('../../utils/sendEmail',  () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify',     () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore',   () => ({
  set:      jest.fn().mockResolvedValue({ ok: true }),
  verify:   jest.fn(),
  generate: jest.fn(() => '123456'),
}));

// Default unified_login ON (fail-open default); individual tests flip it OFF to
// exercise the legacy host/guest login separation.
jest.mock('../../services/featureFlags', () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/usernameService', () => ({
  resolve: jest.fn().mockResolvedValue(null),
  createInitialUsername: jest.fn().mockResolvedValue('auto-handle-x1'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
  usernameExists: jest.fn().mockResolvedValue(false),
  changeUsername: jest.fn(),
}));

const { supabaseAdmin }  = require('../../config/supabase');
const otpStore           = require('../../utils/otpStore');
const featureFlags       = require('../../services/featureFlags');
const {
  registerVendor, registerUser, login, sendOtp, verifyOtp, getMe,
  normalizeSeedTimezone,
} = require('../../controllers/authController');

// ── helpers ──────────────────────────────────────────────────────────────────

const req  = (body = {}, user = null) => ({ body, user });
const res  = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

const VENDOR_PROFILE = {
  id: 'vendor-uuid', name: 'Jane Vendor', email: 'jane@vendor.com',
  role: 'host', plan: 'explorer', username: 'jane-vendor',
  bio: '', tagline: '', profession: '', location: '',
  profile_image: '', cover_image: '', social_links: {}, theme_color: null,
  google_calendar_connected: false, is_verified: false, badges: [],
};

const USER_PROFILE = { ...VENDOR_PROFILE, id: 'user-uuid', email: 'bob@user.com', role: 'guest', username: 'bob-user' };

const mockAuthCreate = (profile) => {
  supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: profile.id, email: profile.email } }, error: null });
  supabaseAdmin.auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'tok', refresh_token: 'ref' } }, error: null });
  // upsert chain returns profile
  supabaseAdmin.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    neq:    jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  });
};

// ── registerVendor ───────────────────────────────────────────────────────────

describe('registerVendor', () => {
  beforeEach(() => mockAuthCreate(VENDOR_PROFILE));

  test('requires name, email, password', async () => {
    const r = res();
    await registerVendor(req({}), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 when email already exists as guest', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'x', role: 'guest' } }),
    });
    const r = res();
    await registerVendor(req({ name: 'A', email: 'jane@vendor.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].message).toMatch(/already exists/i);
  });

  test('returns 409 when email already exists as vendor', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'x', role: 'host' } }),
    });
    const r = res();
    await registerVendor(req({ name: 'A', email: 'jane@vendor.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  test('returns 400 on Supabase auth creation error', async () => {
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: null, error: { message: 'Email taken' } });
    const r = res();
    await registerVendor(req({ name: 'A', email: 'jane@vendor.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('returns full serialized profile on success', async () => {
    const r = res();
    await registerVendor(req({ name: 'Jane Vendor', email: 'jane@vendor.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(201);
    const payload = r.json.mock.calls[0][0];
    expect(payload.role).toBe('host');
    expect(payload.plan).toBeDefined();
    expect(payload.token).toBe('tok');
  });

  test('response includes all required profile fields', async () => {
    const r = res();
    await registerVendor(req({ name: 'Jane', email: 'jane@vendor.com', password: 'p' }), r);
    const payload = r.json.mock.calls[0][0];
    for (const field of ['_id', 'name', 'email', 'role', 'plan', 'username', 'token', 'refresh_token']) {
      expect(payload).toHaveProperty(field);
    }
  });
});

// ── registerUser ─────────────────────────────────────────────────────────────

describe('registerUser', () => {
  beforeEach(() => mockAuthCreate(USER_PROFILE));

  test('requires name, email, password', async () => {
    const r = res();
    await registerUser(req({}), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('returns 409 when email already exists as vendor', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'x', role: 'host' } }),
    });
    const r = res();
    await registerUser(req({ name: 'Bob', email: 'bob@user.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].message).toMatch(/already exists/i);
  });

  test('returns role: guest on success', async () => {
    const r = res();
    await registerUser(req({ name: 'Bob', email: 'bob@user.com', password: 'pass123' }), r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json.mock.calls[0][0].role).toBe('guest');
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => {
    supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'vendor-uuid' }, session: { access_token: 'tok', refresh_token: 'ref' } },
      error: null,
    });
    // login now does: maybeSingle (pre-flight lockout check), update (counter
    // reset on success), single (fetch full profile). Provide a chain that
    // supports all three terminal methods plus update().
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }), // no lockout by default
      single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
    });
  });

  test('returns 401 on invalid credentials', async () => {
    // pre is null (no profile found) → increment skipped → uniform 401
    supabaseAdmin.auth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid' } });
    const r = res();
    await login(req({ email: 'x@x.com', password: 'bad' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  test('returns full profile including plan on success', async () => {
    const r = res();
    await login(req({ email: 'jane@vendor.com', password: 'pass123' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.plan).toBe('explorer');
    expect(payload.token).toBe('tok');
  });
});

// ── sendOtp ───────────────────────────────────────────────────────────────────

describe('sendOtp', () => {
  test('returns 400 when email missing', async () => {
    const r = res();
    await sendOtp(req({}), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('stores OTP and sends email', async () => {
    const r = res();
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing' } }),
      single: jest.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
    });
    await sendOtp(req({ email: 'guest@x.com', name: 'Guest' }), r);
    expect(otpStore.set).toHaveBeenCalled();
    expect(r.json.mock.calls[0][0].message).toMatch(/sent/i);
  });

  // ── login-door host pre-check (reject BEFORE sending an OTP) ──────────────────
  const profileByPhone = (data) => supabaseAdmin.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data }),
  });

  test('purpose:login + host number → OTP sent (dual login: host may hold a guest session)', async () => {
    profileByPhone({ is_host: true, role: 'host' });
    otpStore.set.mockClear();
    const r = res();
    await sendOtp(req({ phone: '+919876543210', purpose: 'login' }), r);
    expect(otpStore.set).toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalledWith(409);
  });

  test('purpose:login + superadmin number → 409 before any OTP (admin login is separate)', async () => {
    profileByPhone({ is_host: false, role: 'superadmin' });
    otpStore.set.mockClear();
    const r = res();
    await sendOtp(req({ phone: '+919876543210', purpose: 'login' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(otpStore.set).not.toHaveBeenCalled();
  });

  test('purpose:login + guest number → OTP still sent', async () => {
    profileByPhone({ is_host: false, role: 'guest' });
    otpStore.set.mockClear();
    const r = res();
    await sendOtp(req({ phone: '+919876543210', purpose: 'login' }), r);
    expect(otpStore.set).toHaveBeenCalled();
    expect(r.json.mock.calls[0][0].message).toMatch(/sent/i);
  });

  test('booking flow (no purpose) + host number → OTP still sent (host can book as customer)', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValueOnce(false);
    profileByPhone({ is_host: true, role: 'host' });
    otpStore.set.mockClear();
    const r = res();
    await sendOtp(req({ phone: '+919876543210' }), r);
    expect(otpStore.set).toHaveBeenCalled();
    expect(r.status).not.toHaveBeenCalledWith(409);
  });
});

// ── verifyOtp ─────────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  test('returns 400 when email or otp missing', async () => {
    const r = res();
    await verifyOtp(req({ email: 'g@x.com' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 on wrong OTP', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid OTP.' });
    const r = res();
    await verifyOtp(req({ email: 'g@x.com', otp: '000000' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('returns user on valid OTP', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: USER_PROFILE }),
      single: jest.fn().mockResolvedValue({ data: USER_PROFILE, error: null }),
    });
    const r = res();
    await verifyOtp(req({ email: 'bob@user.com', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.verified).toBe(true);
    expect(payload.user.role).toBe('guest');
  });
});

// ── getMe ─────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  test('returns serialized profile for authenticated user', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
    });
    const r = res();
    await getMe(req({}, { id: 'vendor-uuid' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.plan).toBe('explorer');
    expect(payload.role).toBe('host');
  });

  test('returns 404 when profile not found', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const r = res();
    await getMe(req({}, { id: 'ghost' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

describe('normalizeSeedTimezone', () => {
  test('UTC/GMT variants and empty fall back to India default', () => {
    for (const v of ['UTC', 'utc', 'Etc/UTC', 'GMT', 'Etc/GMT', '', null, undefined]) {
      expect(normalizeSeedTimezone(v)).toBe('Asia/Kolkata');
    }
  });
  test('a genuine non-UTC Google timezone is kept', () => {
    expect(normalizeSeedTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(normalizeSeedTimezone('America/New_York')).toBe('America/New_York');
    expect(normalizeSeedTimezone('Europe/London')).toBe('Europe/London');
  });
});
