/**
 * tests/unit/authLinkedinHost.test.js
 *
 * POST /api/auth/linkedin/host — host sign-in/up via LinkedIn (Supabase
 * linkedin_oidc). The client already holds a Supabase session; the server must
 * trust only that verified JWT + the identities Supabase holds for the user.
 *
 * Driven through the REAL router (protect → authLimiter → requireFeature →
 * controller) with supertest, so the flag gate and the "no profile row yet"
 * tolerance of protect/accountGate are proven on this exact route.
 */

// ── Mutable fake DB (prefixed `mock` so jest.mock factories may read it) ──────
const mockDb = {
  row: null,        // profiles row for the auth user id (null = no profile yet)
  emailOwner: null, // a profiles row holding the same email under another id
  authUser: null,   // what auth.admin.getUserById returns
  calls: [],        // { table, op, payload, filters }
};

jest.mock('../../config/supabase', () => {
  const answer = (c) => {
    if (c.table === 'profiles') {
      if (c.op === 'upsert') {
        mockDb.row = { ...c.payload, is_host: false };
        return { data: mockDb.row, error: null };
      }
      if (c.op === 'update') {
        if (mockDb.row) mockDb.row = { ...mockDb.row, ...c.payload };
        return { data: mockDb.row, error: null };
      }
      if ('email' in c.filters) return { data: mockDb.emailOwner ? [mockDb.emailOwner] : [], error: null };
      if (c.cols === 'username') return { data: null, error: null }; // upsertProfile pre-read
      return { data: mockDb.row, error: null };
    }
    return { data: null, error: null }; // availability, badges, feature_flags, …
  };
  const from = jest.fn((table) => {
    const c = { table, op: 'select', filters: {}, payload: null, cols: null };
    const rec = () => mockDb.calls.push(c);
    c.select = jest.fn((cols) => { if (c.op === 'select') c.cols = cols; return c; });
    c.update = jest.fn((p) => { c.op = 'update'; c.payload = p; return c; });
    c.upsert = jest.fn((p) => { c.op = 'upsert'; c.payload = p; return c; });
    c.insert = jest.fn((p) => { c.op = 'insert'; c.payload = p; return c; });
    c.eq = jest.fn((k, v) => { c.filters[k] = v; return c; });
    c.is = jest.fn(() => c);
    c.limit = jest.fn(() => c);
    c.maybeSingle = jest.fn(async () => { rec(); return answer(c); });
    c.single = jest.fn(async () => { rec(); return answer(c); });
    c.then = (ok, ko) => { rec(); return Promise.resolve(answer(c)).then(ok, ko); };
    return c;
  });
  return {
    supabaseAdmin: {
      from,
      auth: {
        getUser: jest.fn(async (token) => (token === 'good'
          ? { data: { user: { id: 'u-1', email: 'li@host.com' } }, error: null }
          : { data: { user: null }, error: { message: 'bad jwt' } })),
        admin: {
          getUserById: jest.fn(async () => ({ data: { user: mockDb.authUser }, error: null })),
          createUser: jest.fn(),
        },
      },
    },
    signInWithPassword: jest.fn(),
    mintSessionForEmail: jest.fn(),
  };
});

jest.mock('../../middleware/security', () => ({
  authLimiter: (req, res, next) => next(),
  otpLimiter: (req, res, next) => next(),
  otpContactLimiter: (req, res, next) => next(),
}));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn(async () => true), clearCache: jest.fn() }));
jest.mock('../../services/planService', () => ({
  getPlan: jest.fn(async () => null),
  resolveVendorPlan: jest.fn(() => 'free'),
}));
jest.mock('../../services/paidMode', () => ({ feeOnlyForHost: jest.fn(async () => true) }));
jest.mock('../../services/badgeEngine', () => ({ evaluate: jest.fn(async () => ({})) }));
jest.mock('../../services/inviteService', () => ({ stampInviteSlug: jest.fn(async () => {}) }));
jest.mock('../../services/crm/leadService', () => ({ safeUpsertLead: jest.fn(async () => {}) }));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(true));
jest.mock('../../utils/notify', () => ({ sendOtpNotification: jest.fn() }));
jest.mock('../../utils/otpStore', () => ({ set: jest.fn(), verify: jest.fn(), generate: jest.fn(() => '123456') }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({}) }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn().mockResolvedValue({ sent: true }) }));
jest.mock('../../services/usernameService', () => ({
  createInitialUsername: jest.fn().mockResolvedValue('li-host-ab12'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
}));

const express = require('express');
const request = require('supertest');
const supa = require('../../config/supabase');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { trackServer } = require('../../utils/trackServer');
const { stampInviteSlug } = require('../../services/inviteService');
const { safeUpsertLead } = require('../../services/crm/leadService');
const NotificationEngine = require('../../services/notificationEngine');
const badgeEngine = require('../../services/badgeEngine');

const app = express();
app.use(express.json());
app.use('/api/auth', require('../../routes/authRoutes'));

const post = (body = {}, token = 'good') =>
  request(app).post('/api/auth/linkedin/host').set('Authorization', `Bearer ${token}`).send(body);

const LI_IDENTITY = {
  provider: 'linkedin_oidc',
  identity_id: 'iid-1',
  identity_data: { sub: 'li-sub-1', name: 'Li Host', picture: 'https://pic/li.jpg', given_name: 'Li', family_name: 'Host', email: 'li@host.com' },
};
const writes = (table, op) =>
  mockDb.calls.filter((c) => c.table === table && c.op === op).map((c) => c.payload);

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.row = null;
  mockDb.emailOwner = null;
  mockDb.calls = [];
  mockDb.authUser = { id: 'u-1', email: 'Li@Host.com', identities: [{ provider: 'email' }, LI_IDENTITY] };
  isFeatureEnabled.mockResolvedValue(true);
});

describe('new host', () => {
  test('creates the host profile, onboarding step 1 with calendar_skipped:false, new=1', async () => {
    const r = await post({ intent: 'signup', invite: '  MyInvite  ', att: { utm_source: 'li' }, tz: 'Asia/Dubai' });
    expect(r.status).toBe(200);
    expect(r.body.new).toBe('1');
    expect(r.body.profile).toEqual(expect.objectContaining({ id: 'u-1', email: 'li@host.com', linkedin_verified: true }));
    expect(r.body.profile.token).toBeUndefined(); // no session minting / echo

    // Profile created from Supabase identity data (never the body), as a host.
    expect(writes('profiles', 'upsert')).toEqual([expect.objectContaining({
      id: 'u-1', name: 'Li Host', email: 'li@host.com', role: 'host',
      first_name: 'Li', last_name: 'Host', profile_image: 'https://pic/li.jpg',
    })]);
    const u = writes('profiles', 'update');
    expect(u).toContainEqual(expect.objectContaining({ onboarding_step_completed: 1, onboarding_completed: false, calendar_skipped: false, onboarding_slug: 'li-host-ab12' }));
    expect(u).toContainEqual(expect.objectContaining({ linkedin_sub: 'li-sub-1', linkedin_verified_at: expect.any(String) }));
    expect(writes('availability', 'upsert')).toContainEqual(expect.objectContaining({ host_id: 'u-1', timezone: 'Asia/Dubai' }));

    // Shared new-host side effects ran with method linkedin + body-derived state.
    expect(stampInviteSlug).toHaveBeenCalledWith('u-1', 'myinvite');
    expect(trackServer).toHaveBeenCalledWith('u-1', 'user_registered', { method: 'linkedin', role: 'host' }, expect.anything());
    expect(trackServer).toHaveBeenCalledWith('u-1', 'auth_completed', { method: 'linkedin', new: '1' }, expect.anything());
    expect(NotificationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ event: 'VENDOR_WELCOME' }));
    expect(safeUpsertLead).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'li@host.com', profile_id: 'u-1' }),
      expect.objectContaining({ source: 'host_signup', attribution: expect.objectContaining({ utm_source: 'li' }) }),
    );
    expect(require('../../utils/adminAlert').adminAlert).toHaveBeenCalledWith(expect.objectContaining({
      lines: expect.arrayContaining(['Signed up via: LinkedIn (new account)']),
    }));
    expect(badgeEngine.evaluate).toHaveBeenCalledWith({ vendorIds: ['u-1'] });
  });

  test('name falls back to the email local-part when LinkedIn gives none', async () => {
    mockDb.authUser = { id: 'u-1', email: 'li@host.com', identities: [{ provider: 'linkedin_oidc', identity_data: { sub: 's' } }] };
    const r = await post({});
    expect(r.status).toBe(200);
    expect(writes('profiles', 'upsert')[0]).toEqual(expect.objectContaining({ name: 'li' }));
  });

  test('garbage intent is treated as login (still signs the host up, like Google)', async () => {
    const r = await post({ intent: { evil: 1 }, invite: ['x'], tz: 42 });
    expect(r.status).toBe(200);
    expect(r.body.new).toBe('1');
    expect(stampInviteSlug).not.toHaveBeenCalled(); // non-string invite dropped
  });

  test('invalid tz → default timezone Asia/Kolkata', async () => {
    await post({ tz: 'Not/AZone' });
    expect(writes('availability', 'upsert')).toContainEqual(expect.objectContaining({ timezone: 'Asia/Kolkata' }));
  });

  test('body-supplied identity/email is ignored', async () => {
    await post({ email: 'victim@x.com', name: 'Evil', id: 'other', role: 'superadmin' });
    expect(writes('profiles', 'upsert')).toEqual([expect.objectContaining({ id: 'u-1', email: 'li@host.com', role: 'host', name: 'Li Host' })]);
  });

  test('a side-effect failure never blocks the login', async () => {
    NotificationEngine.send.mockRejectedValueOnce(new Error('mail down'));
    badgeEngine.evaluate.mockRejectedValueOnce(new Error('badge down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post({});
    expect(r.status).toBe(200);
    expect(r.body.new).toBe('1');
    errSpy.mockRestore();
  });
});

describe('existing account', () => {
  test('existing host → new=0, no create, no new-host side effects', async () => {
    mockDb.row = { id: 'u-1', role: 'host', is_host: true, email: 'li@host.com', username: 'li' };
    const r = await post({ intent: 'login' });
    expect(r.status).toBe(200);
    expect(r.body.new).toBe('0');
    expect(writes('profiles', 'upsert')).toEqual([]);
    expect(stampInviteSlug).not.toHaveBeenCalled();
    expect(NotificationEngine.send).not.toHaveBeenCalled();
    expect(writes('profiles', 'update')).toContainEqual(expect.objectContaining({ linkedin_sub: 'li-sub-1' }));
    expect(trackServer).toHaveBeenCalledWith('u-1', 'auth_completed', { method: 'linkedin', new: '0' }, expect.anything());
    expect(badgeEngine.evaluate).toHaveBeenCalledWith({ vendorIds: ['u-1'] });
  });

  test('existing customer → enableHostingForProfile, new=upgrade', async () => {
    mockDb.row = { id: 'u-1', role: 'guest', is_host: false, email: 'li@host.com', username: 'li' };
    const r = await post({});
    expect(r.status).toBe(200);
    expect(r.body.new).toBe('upgrade');
    expect(writes('profiles', 'upsert')).toEqual([]);
    expect(writes('profiles', 'update')).toContainEqual(expect.objectContaining({ is_host: true, onboarding_step_completed: 1 }));
    expect(r.body.profile.is_host).toBe(true);
    expect(trackServer).toHaveBeenCalledWith('u-1', 'auth_completed', { method: 'linkedin', new: 'upgrade' }, expect.anything());
  });

  test('superadmin → 403 superadmin, nothing written', async () => {
    mockDb.row = { id: 'u-1', role: 'superadmin', is_host: false, email: 'li@host.com' };
    const r = await post({});
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ code: 'superadmin' });
    expect(writes('profiles', 'update')).toEqual([]);
    expect(writes('profiles', 'upsert')).toEqual([]);
  });
});

describe('refusals', () => {
  test('no linkedin_oidc identity → 400 no_linkedin_identity', async () => {
    mockDb.authUser = { id: 'u-1', email: 'li@host.com', identities: [{ provider: 'email' }] };
    const r = await post({});
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ code: 'no_linkedin_identity' });
    expect(writes('profiles', 'upsert')).toEqual([]);
  });

  test('no profile for this id but the email has an account elsewhere → 409, no insert', async () => {
    mockDb.emailOwner = { id: 'google-host-9' };
    const r = await post({ intent: 'signup' });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ code: 'email_has_account' });
    expect(writes('profiles', 'upsert')).toEqual([]);
    expect(writes('profiles', 'update')).toEqual([]);
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('profile lookup error → 500 and nothing created (never upsert over an unread row)', async () => {
    const realFrom = supa.supabaseAdmin.from.getMockImplementation();
    let n = 0;
    supa.supabaseAdmin.from.mockImplementation((t) => {
      const c = realFrom(t);
      // 1st profiles read = accountGate (tolerated); 2nd = the controller's id lookup.
      if (t === 'profiles' && ++n === 2) c.maybeSingle = jest.fn(async () => ({ data: null, error: { message: 'db down' } }));
      return c;
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post({});
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('db down');
    expect(writes('profiles', 'upsert')).toEqual([]);
    supa.supabaseAdmin.from.mockImplementation(realFrom);
    errSpy.mockRestore();
  });

  test('flag off → 503 from requireFeature, controller never runs', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    const r = await post({});
    expect(r.status).toBe(503);
    expect(r.body.feature_disabled).toBe('host_linkedin_login');
    expect(isFeatureEnabled).toHaveBeenCalledWith('host_linkedin_login');
    expect(supa.supabaseAdmin.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  test('no bearer token → 401 (protect runs first)', async () => {
    const r = await request(app).post('/api/auth/linkedin/host').send({});
    expect(r.status).toBe(401);
  });
});
