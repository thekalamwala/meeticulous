/**
 * tests/integration/auth.test.js
 * End-to-end route tests for /api/auth/*.
 * Covers: vendor registration, user registration, login, OTP flow, getMe.
 * Role separation guards are tested explicitly.
 */
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../utils/sendEmail',  () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify',     () => ({ sendOtpNotification: jest.fn().mockResolvedValue({ emailSent: true }) }));
jest.mock('../../utils/otpStore',   () => ({
  set:      jest.fn().mockResolvedValue({ ok: true }),
  verify:   jest.fn(),
  cleanup:  jest.fn(),
  generate: jest.fn(() => '123456'),
}));
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'vendor-uuid' };
    next();
  },
}));
jest.mock('../../services/usernameService', () => ({
  resolve: jest.fn().mockResolvedValue(null),
  createInitialUsername: jest.fn().mockResolvedValue('auto-handle-x1'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
  usernameExists: jest.fn().mockResolvedValue(false),
  changeUsername: jest.fn(),
}));

const request  = require('supertest');
const express  = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const otpStore          = require('../../utils/otpStore');
const authRoutes        = require('../../routes/authRoutes');
const { VENDOR_PROFILE, USER_PROFILE } = require('./helpers');

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// ── Factories ─────────────────────────────────────────────────────────────────
const mockNoExisting = () =>
  supabaseAdmin.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    neq:    jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });

const mockAuthSuccess = (profile = VENDOR_PROFILE) => {
  supabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: profile.id, email: profile.email } }, error: null,
  });
  supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
    data: { session: { access_token: 'tok', refresh_token: 'ref' } }, error: null,
  });
  supabaseAdmin.from.mockReturnValue({
    select:      jest.fn().mockReturnThis(),
    upsert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    neq:         jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue({ data: profile, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VENDOR REGISTRATION — retired (#534): hosts are Google-only.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/auth/register/vendor (retired)', () => {
  test('410 — email/password host registration is gone; points to Google', async () => {
    const res = await request(app)
      .post('/api/auth/register/vendor')
      .send({ name: 'Jane Vendor', email: 'jane@vendor.com', password: 'pass123' });
    expect(res.status).toBe(410);
    expect(res.body.message).toMatch(/Google/i);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER REGISTRATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/auth/register/user', () => {
  test('400 — missing required fields', async () => {
    const res = await request(app).post('/api/auth/register/user').send({});
    expect(res.status).toBe(400);
  });

  test('409 — email already registered as vendor', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'x', role: 'host' } }),
    });
    const res = await request(app)
      .post('/api/auth/register/user')
      .send({ name: 'Bob', email: 'clash@vendor.com', password: 'pass123' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test('201 — successful user registration returns guest role', async () => {
    mockAuthSuccess(USER_PROFILE);
    const res = await request(app)
      .post('/api/auth/register/user')
      .send({ name: 'Bob User', email: 'bob@user.com', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('guest');
    expect(res.body.token).toBeDefined();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/auth/login', () => {
  test('401 — wrong password', async () => {
    supabaseAdmin.auth.signInWithPassword.mockResolvedValueOnce({ data: null, error: { message: 'Invalid' } });
    const res = await request(app).post('/api/auth/login').send({ email: 'j@j.com', password: 'bad' });
    expect(res.status).toBe(401);
  });

  test('200 — returns full profile with plan on success', async () => {
    supabaseAdmin.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'vendor-uuid' }, session: { access_token: 'tok', refresh_token: 'ref' } }, error: null,
    });
    // login now: pre-flight lookup by email (maybeSingle), reset update on success, then fetch by id (single)
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'vendor-uuid', email: 'jane@vendor.com', failed_login_count: 0, login_locked_until: null } }),
      single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'jane@vendor.com', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('explorer');
    expect(res.body.role).toBe('host');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OTP FLOW (guest booking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/auth/send-otp', () => {
  test('400 — email missing', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({});
    expect(res.status).toBe(400);
  });

  test('200 — stores OTP and confirms send', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-user' } }),
      single: jest.fn().mockResolvedValue({ data: { id: 'existing-user' }, error: null }),
    });
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ email: 'guest@test.com', name: 'Guest' });
    expect(res.status).toBe(200);
    expect(otpStore.set).toHaveBeenCalled();
    expect(res.body.message).toMatch(/sent/i);
  });
});

describe('POST /api/auth/verify-otp', () => {
  test('400 — missing otp', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ email: 'g@x.com' });
    expect(res.status).toBe(400);
  });

  test('400 — invalid OTP', async () => {
    otpStore.verify.mockResolvedValueOnce({ valid: false, reason: 'Invalid OTP.' });
    const res = await request(app).post('/api/auth/verify-otp').send({ email: 'g@x.com', otp: '000000' });
    expect(res.status).toBe(400);
  });

  test('200 — returns verified:true with user on success', async () => {
    otpStore.verify.mockResolvedValueOnce({ valid: true });
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: USER_PROFILE }),
      single: jest.fn().mockResolvedValue({ data: USER_PROFILE, error: null }),
    });
    const res = await request(app).post('/api/auth/verify-otp').send({ email: 'bob@user.com', otp: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.user.role).toBe('guest');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET ME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/auth/me', () => {
  test('200 — returns serialized profile with plan', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer vendor-token');
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('explorer');
    expect(res.body.role).toBe('host');
  });
});
