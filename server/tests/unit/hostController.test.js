/**
 * tests/unit/hostController.test.js
 * Tests for getHostProfile, updateProfile, getServiceBySlug, getMyServices.
 */
// Bypass the read-through response cache so each test drives its own mock DB
// sequence deterministically (cache behavior is covered by responseCache.test.js).
jest.mock('../../services/responseCache', () => ({
  getOrSet: (_k, _ttl, producer) => producer(),
  bust: () => 0,
  clear: () => 0,
  _size: () => 0,
}));
jest.mock('../../config/supabase', () => {
  const chain = () => ({
    select:  jest.fn().mockReturnThis(),
    update:  jest.fn().mockReturnThis(),
    insert:  jest.fn().mockReturnThis(),
    delete:  jest.fn().mockReturnThis(),
    upsert:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    neq:     jest.fn().mockReturnThis(),
    single:  jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    order:   jest.fn().mockReturnThis(),
    limit:   jest.fn().mockReturnThis(),
  });
  return { supabaseAdmin: { from: jest.fn().mockImplementation(chain) } };
});

jest.mock('../../services/usernameService', () => ({
  resolve: jest.fn().mockResolvedValue(null),
  createInitialUsername: jest.fn().mockResolvedValue('auto-handle-x1'),
  recordInitialUsername: jest.fn().mockResolvedValue(undefined),
  usernameExists: jest.fn().mockResolvedValue(false),
  changeUsername: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const usernameService = require('../../services/usernameService');
const {
  getHostProfile, updateProfile, getServiceBySlug, getMyServices,
} = require('../../controllers/hostController');

const req = (params = {}, body = {}, user = { id: 'vendor-uuid' }) => ({ params, body, user });
const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  r.set    = jest.fn().mockReturnValue(r);
  return r;
};

const HOST = {
  id: 'vendor-uuid', name: 'Jane', email: 'jane@v.com', role: 'host',
  username: 'jane-v', profile_image: '', cover_image: '', bio: 'Hi',
  social_links: {}, theme_color: '#FE5100', google_calendar_connected: false,
  is_verified: true, badges: [], google_access_token: 'secret',
};

const mockFrom = (data, error = null) =>
  supabaseAdmin.from.mockReturnValue({
    select:  jest.fn().mockReturnThis(),
    update:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    neq:     jest.fn().mockReturnThis(),
    single:  jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });

// ── getHostProfile ────────────────────────────────────────────────────────────

describe('getHostProfile', () => {
  test('returns 404 when host not found', async () => {
    mockFrom(null, { message: 'Not found' });
    const r = res();
    await getHostProfile(req({ username: 'ghost' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test('strips sensitive fields from response', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({                       // profiles query
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...HOST }, error: null }),
      })
      .mockReturnValue({                           // services + availability parallel
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        limit:  jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

    const r = res();
    await getHostProfile(req({ username: 'jane-v' }), r);
    const { host } = r.json.mock.calls[0][0];
    expect(host).not.toHaveProperty('google_access_token');
    expect(host).not.toHaveProperty('google_refresh_token');
  });

  test('returns services array', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: HOST, error: null }),
      })
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        limit:  jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

    const r = res();
    await getHostProfile(req({ username: 'jane-v' }), r);
    const { services } = r.json.mock.calls[0][0];
    expect(Array.isArray(services)).toBe(true);
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  test('ignores body username; never changes an existing one', async () => {
    let capturedUpdates;
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockImplementation((u) => { capturedUpdates = u; return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: HOST, error: null }) }; }),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { username: 'jane-v' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });

    const r = res();
    await updateProfile(req({}, { name: 'Jane Vendor', username: 'hacker-handle' }), r);
    // Username is gated elsewhere — updateProfile must NOT touch it when one exists.
    expect(capturedUpdates).toBeDefined();
    expect(capturedUpdates.username).toBeUndefined();
    expect(usernameService.createInitialUsername).not.toHaveBeenCalled();
  });

  test('auto-assigns a username only when the account has none', async () => {
    let capturedUpdates;
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockImplementation((u) => { capturedUpdates = u; return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: HOST, error: null }) }; }),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { username: null }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });

    const r = res();
    await updateProfile(req({}, { name: 'Jane Vendor' }), r);
    expect(usernameService.createInitialUsername).toHaveBeenCalled();
    expect(capturedUpdates.username).toBe('auto-handle-x1');
  });

  test('validates theme_color is a valid hex', async () => {
    let capturedUpdates;
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockImplementation((u) => { capturedUpdates = u; return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: HOST, error: null }) }; }),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { username: 'jane-v' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });

    const r = res();
    await updateProfile(req({}, { theme_color: 'not-a-color' }), r);
    expect(capturedUpdates?.theme_color).toBeUndefined(); // invalid hex rejected
  });

  test('accepts valid #rrggbb theme_color', async () => {
    let capturedUpdates;
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockImplementation((u) => { capturedUpdates = u; return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: HOST, error: null }) }; }),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { username: 'jane-v' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });

    const r = res();
    await updateProfile(req({}, { theme_color: '#FE5100' }), r);
    expect(capturedUpdates?.theme_color).toBe('#FE5100');
  });
});

// ── getServiceBySlug ──────────────────────────────────────────────────────────

describe('getServiceBySlug', () => {
  test('returns 404 when host not found', async () => {
    mockFrom(null);
    const r = res();
    await getServiceBySlug(req({ username: 'ghost', slug: 'svc' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

// ── getMyServices ─────────────────────────────────────────────────────────────

describe('getMyServices', () => {
  test('returns array of services for authenticated vendor', async () => {
    const SVC = { id: 's1', title: 'Consultation', slug: 'consultation', price: 500 };
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      order:  jest.fn().mockResolvedValue({ data: [SVC], error: null }),
    });
    const r = res();
    await getMyServices(req({}, {}, { id: 'vendor-uuid' }), r);
    expect(r.json.mock.calls[0][0]).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Consultation' })]));
  });
});
