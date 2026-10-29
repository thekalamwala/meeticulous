/**
 * tests/unit/userPhoneLogin.test.js
 * Phone-primary user login: loginWithPhone, verifyOtpLogin, setPassword.
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser:      jest.fn(),
        updateUserById:  jest.fn(),
        generateLink:    jest.fn(),
      },
    },
    from: jest.fn(),
  },
  signInWithPassword:  jest.fn(),
  mintSessionForEmail: jest.fn(),
}));

jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify',    () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore',  () => ({
  set:      jest.fn().mockResolvedValue({ ok: true }),
  verify:   jest.fn(),
  generate: jest.fn(() => '123456'),
}));
// unified_login gate (Phase 3). Default OFF so the legacy guest-only behavior is
// exercised; individual tests flip it ON. Mocked so it never hits the DB.
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(false) }));

const supa      = require('../../config/supabase');
const { supabaseAdmin, signInWithPassword, mintSessionForEmail } = supa;
const otpStore  = require('../../utils/otpStore');
const featureFlags = require('../../services/featureFlags');
const {
  loginWithPhone, verifyOtpLogin, setPassword, loginUnified,
} = require('../../controllers/authController');

// ── helpers ──────────────────────────────────────────────────────────────────

const req = (body = {}, user = null) => ({ body, user });
const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

// A Supabase query chain whose terminal (single/maybeSingle) resolves to `result`.
const chain = (result = { data: null, error: null }) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  neq:    jest.fn().mockReturnThis(),
  not:    jest.fn().mockReturnThis(),
  is:     jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  limit:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue(result),
  maybeSingle: jest.fn().mockResolvedValue(result),
});

// Queue the chains `from()` returns, in call order.
const queueFrom = (...chains) => {
  let i = 0;
  supabaseAdmin.from.mockImplementation(() => chains[i++] || chain());
};

const GUEST = {
  id: 'guest-uuid', name: 'Bob', email: 'p919876543210@users.bookasloth.app',
  role: 'guest', plan: 'explorer', username: 'bob', phone: '+919876543210',
  password_set: true, bio: '', tagline: '', profession: '', location: '',
  profile_image: '', cover_image: '', social_links: {}, theme_color: null,
  google_calendar_connected: false, is_verified: false, badges: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  signInWithPassword.mockReset();
  mintSessionForEmail.mockReset();
  featureFlags.isFeatureEnabled.mockResolvedValue(false); // legacy default per test
});

// ── loginWithPhone ─────────────────────────────────────────────────────────────

describe('loginWithPhone', () => {
  test('400 when phone or password missing', async () => {
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('401 when no profile for the phone (enumeration-resistant)', async () => {
    queueFrom(chain({ data: null }));
    // Timing-equalization: the no-account path makes a dummy auth call (resolves here).
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'x' } });
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(r.json.mock.calls[0][0].message).toBe('Invalid phone or password');
  });

  test('401 when phone belongs to a non-guest account (enumeration-resistant)', async () => {
    queueFrom(chain({ data: { ...GUEST, role: 'host', is_host: true } }));
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'x' } });
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(r.json.mock.calls[0][0].message).toBe('Invalid phone or password');
  });

  test('409 needsPassword when password not yet set', async () => {
    queueFrom(chain({ data: { ...GUEST, password_set: false } }));
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].needsPassword).toBe(true);
  });

  test('401 on wrong password', async () => {
    queueFrom(chain({ data: GUEST }));
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid' } });
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'wrongpas' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  test('returns profile + session token on success', async () => {
    queueFrom(chain({ data: GUEST }));
    signInWithPassword.mockResolvedValue({
      data: { user: { id: GUEST.id }, session: { access_token: 'tok', refresh_token: 'ref' } },
      error: null,
    });
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'secret12' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.role).toBe('guest');
    expect(payload.phone).toBe('+919876543210');
    expect(signInWithPassword).toHaveBeenCalledWith(GUEST.email, 'secret12');
  });

  test('unified_login ON: a non-guest (host) can sign in by phone', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(true);
    queueFrom(chain({ data: { ...GUEST, role: 'host' } }));
    signInWithPassword.mockResolvedValue({
      data: { user: { id: GUEST.id }, session: { access_token: 'tok', refresh_token: 'ref' } },
      error: null,
    });
    const r = res();
    await loginWithPhone(req({ phone: '+919876543210', password: 'secret12' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.role).toBe('host');
  });
});

// ── verifyOtpLogin ──────────────────────────────────────────────────────────────

describe('verifyOtpLogin', () => {
  test('400 when phone or otp missing', async () => {
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('400 on invalid OTP', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid OTP.' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '000000' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('existing-by-phone: mints a session and returns token', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    queueFrom(chain({ data: GUEST }));            // profiles lookup by phone
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.role).toBe('guest');
    expect(mintSessionForEmail).toHaveBeenCalledWith(GUEST.email);
  });

  test('back-fills orphaned anonymous bookings for the verified phone', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    const bookingsChain = chain({ data: null });
    queueFrom(
      chain({ data: GUEST }), // profiles lookup by phone → existing guest
      bookingsChain,          // backfillGuestBookings → bookings update
    );
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    // Assign this guest to prior anonymous rows — scoped to the phone AND guest_id IS NULL.
    expect(bookingsChain.update).toHaveBeenCalledWith(expect.objectContaining({ guest_id: GUEST.id }));
    expect(bookingsChain.eq).toHaveBeenCalledWith('guest_phone', '+919876543210');
    expect(bookingsChain.is).toHaveBeenCalledWith('guest_id', null);
  });

  test('new phone: creates account, mints session', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    const newProfile = { ...GUEST, id: 'new-uuid', password_set: false };
    queueFrom(
      chain({ data: null }),     // profiles lookup by phone → none
      chain({ data: null }),     // bookings lookup by guest_phone → none
      chain({ data: newProfile, error: null }), // upsertProfile → new profile
    );
    supabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-uuid', email: newProfile.email } }, error: null,
    });
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
    expect(payload.token).toBe('tok');
    expect(payload.password_set).toBe(false);
  });

  test('existing-by-booking: links phone to the prior guest profile', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    const linked = { ...GUEST, phone: null, password_set: false };
    queueFrom(
      chain({ data: null }),                     // profiles by phone → none
      chain({ data: { guest_id: GUEST.id } }),   // bookings → guest_id
      chain({ data: linked }),                   // profiles by id → linked
      chain({ data: null }),                     // profiles update phone
    );
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.phone).toBe('+919876543210');
  });

  test('a host phone OTP-logs into their guest space (dual login, no 409)', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    queueFrom(chain({ data: { ...GUEST, role: 'host', is_host: true } }));
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(r.status).not.toHaveBeenCalledWith(409);
  });

  test('409 when phone resolves to a superadmin (admin login is a separate door)', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    queueFrom(chain({ data: { ...GUEST, role: 'superadmin' } }));
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  test('unified_login ON: a host phone OTP-logs in (no 409)', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(true);
    otpStore.verify.mockResolvedValue({ valid: true });
    queueFrom(chain({ data: { ...GUEST, role: 'host' } }));
    mintSessionForEmail.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const r = res();
    await verifyOtpLogin(req({ phone: '+919876543210', otp: '123456' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.role).toBe('host');
  });
});

// ── loginUnified (Phase B: one door, email OR phone, any role) ────────────────

describe('loginUnified', () => {
  test('400 when identifier or password missing', async () => {
    const r = res();
    await loginUnified(req({ identifier: 'a@x.com' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('400 when identifier is neither a valid email nor phone', async () => {
    const r = res();
    await loginUnified(req({ identifier: 'not-valid', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('email path: resolves by email and returns session on success', async () => {
    const HOST = { ...GUEST, email: 'host@x.com', role: 'host', is_host: true };
    queueFrom(chain({ data: HOST }));
    signInWithPassword.mockResolvedValue({
      data: { user: { id: HOST.id }, session: { access_token: 'tok', refresh_token: 'ref' } },
      error: null,
    });
    const r = res();
    await loginUnified(req({ identifier: 'host@x.com', password: 'secret12' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.role).toBe('host'); // unified door: any role logs in
    expect(signInWithPassword).toHaveBeenCalledWith('host@x.com', 'secret12');
  });

  test('phone path: resolves by phone and returns session on success', async () => {
    queueFrom(chain({ data: GUEST }));
    signInWithPassword.mockResolvedValue({
      data: { user: { id: GUEST.id }, session: { access_token: 'tok', refresh_token: 'ref' } },
      error: null,
    });
    const r = res();
    await loginUnified(req({ identifier: '+919876543210', password: 'secret12' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.token).toBe('tok');
    expect(payload.phone).toBe('+919876543210');
    expect(signInWithPassword).toHaveBeenCalledWith(GUEST.email, 'secret12');
  });

  test('401 + dummy signin when no account (enumeration-resistant)', async () => {
    queueFrom(chain({ data: null }));
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'x' } });
    const r = res();
    await loginUnified(req({ identifier: 'ghost@x.com', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(signInWithPassword).toHaveBeenCalled();
  });

  test('409 needsPassword when a phone account has no password set', async () => {
    queueFrom(chain({ data: { ...GUEST, password_set: false } }));
    const r = res();
    await loginUnified(req({ identifier: '+919876543210', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].needsPassword).toBe(true);
  });

  test('401 on wrong password', async () => {
    queueFrom(chain({ data: GUEST }));
    signInWithPassword.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const r = res();
    await loginUnified(req({ identifier: '+919876543210', password: 'wrongpas' }), r);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  test('429 when the account is locked', async () => {
    const locked = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    queueFrom(chain({ data: { ...GUEST, login_locked_until: locked, failed_login_count: 5 } }));
    const r = res();
    await loginUnified(req({ identifier: '+919876543210', password: 'secret12' }), r);
    expect(r.status).toHaveBeenCalledWith(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

// ── setPassword ─────────────────────────────────────────────────────────────────

describe('setPassword', () => {
  test('400 when password too short', async () => {
    const r = res();
    await setPassword(req({ password: 'short' }, { id: GUEST.id }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('flips password_set and returns ok on success', async () => {
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: { user: { id: GUEST.id } }, error: null });
    queueFrom(chain({ data: { id: GUEST.id }, error: null })); // profiles update
    const r = res();
    await setPassword(req({ password: 'Secret12' }, { id: GUEST.id }), r);
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(GUEST.id, { password: 'Secret12' });
    expect(r.json.mock.calls[0][0].ok).toBe(true);
  });

  test('400 when password lacks an uppercase letter or a number', async () => {
    const r = res();
    await setPassword(req({ password: 'alllower1' }, { id: GUEST.id }), r); // number but no uppercase
    expect(r.status).toHaveBeenCalledWith(400);
    expect(supabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  test('400 when Supabase rejects the password update', async () => {
    supabaseAdmin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: { message: 'weak' } });
    const r = res();
    await setPassword(req({ password: 'Secret12' }, { id: GUEST.id }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
