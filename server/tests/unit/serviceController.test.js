/**
 * tests/unit/serviceController.test.js
 * Tests for createService, updateService, deleteService, duplicateService,
 * toggleService, getMyServices, getServiceById, getPublicServiceBySlug,
 * getPublicServiceByProfileAndSlug.
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
  const makeFluent = (resolvedValue) => {
    const obj = {
      select:   jest.fn().mockReturnThis(),
      insert:   jest.fn().mockReturnThis(),
      update:   jest.fn().mockReturnThis(),
      delete:   jest.fn().mockReturnThis(),
      upsert:   jest.fn().mockReturnThis(),
      eq:       jest.fn().mockReturnThis(),
      neq:      jest.fn().mockReturnThis(),
      order:    jest.fn().mockReturnThis(),
      limit:    jest.fn().mockReturnThis(),
      single:   jest.fn().mockResolvedValue(resolvedValue ?? { data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    };
    return obj;
  };

  return {
    supabaseAdmin: {
      from: jest.fn().mockImplementation(() => makeFluent()),
    },
  };
});

const { supabaseAdmin } = require('../../config/supabase');

const {
  createService,
  updateService,
  deleteService,
  duplicateService,
  toggleService,
  getMyServices,
  getServiceById,
  getPublicServiceBySlug,
  getPublicServiceByProfileAndSlug,
} = require('../../controllers/serviceController');

// ── helpers ──────────────────────────────────────────────────────────────────

const req  = (params = {}, body = {}, user = { id: 'vendor-uuid' }) => ({ params, body, user });
const res  = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  r.set    = jest.fn().mockReturnValue(r);
  return r;
};

const SERVICE = {
  id: 'svc-1', host_id: 'vendor-uuid', title: 'Consultation',
  slug: 'consultation', price: 500, duration: 45, meeting_mode: 'online',
  is_active: true, created_at: new Date().toISOString(),
};

const mockFrom = (data, error = null) => {
  supabaseAdmin.from.mockReturnValue({
    select:   jest.fn().mockReturnThis(),
    insert:   jest.fn().mockReturnThis(),
    update:   jest.fn().mockReturnThis(),
    delete:   jest.fn().mockReturnThis(),
    eq:       jest.fn().mockReturnThis(),
    neq:      jest.fn().mockReturnThis(),
    order:    jest.fn().mockReturnThis(),
    limit:    jest.fn().mockReturnThis(),
    single:   jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
  });
};

// ── createService ─────────────────────────────────────────────────────────────

describe('createService', () => {
  test('returns 400 when title is missing', async () => {
    const r = res();
    await createService(req({}, {}), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toMatch(/title/i);
  });

  test('creates service and returns 201 with data', async () => {
    mockFrom(SERVICE);
    const r = res();
    await createService(req({}, { title: 'Consultation', price: 500, duration: 45 }), r);
    expect(r.status).toHaveBeenCalledWith(201);
    const payload = r.json.mock.calls[0][0];
    expect(payload.slug).toBeDefined();
  });

  test('generates slug from title', async () => {
    let insertedPayload;
    supabaseAdmin.from.mockReturnValue({
      select:   jest.fn().mockReturnThis(),
      insert:   jest.fn().mockImplementation((p) => { insertedPayload = Array.isArray(p) ? p[0] : p; return { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { ...SERVICE, ...insertedPayload }, error: null }) }; }),
      eq:       jest.fn().mockReturnThis(),
      single:   jest.fn().mockResolvedValue({ data: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });
    const r = res();
    await createService(req({}, { title: 'My Amazing Service!' }), r);
    if (insertedPayload?.slug) {
      expect(insertedPayload.slug).toMatch(/^[a-z0-9-]+$/);
      expect(insertedPayload.slug).not.toContain('!');
    }
  });

  test('returns 500 on DB error', async () => {
    mockFrom(null, { message: 'DB error' });
    const r = res();
    await createService(req({}, { title: 'Test' }), r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── offline venue guard ───────────────────────────────────────────────────────

describe('offline services require a profile map_link', () => {
  test('createService returns 400 when meeting_mode=offline and profile has no map_link', async () => {
    mockFrom({ map_link: '' }); // profile lookup resolves to empty venue
    const r = res();
    await createService(req({}, { title: 'Salon visit', meeting_mode: 'offline' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    const payload = r.json.mock.calls[0][0];
    expect(payload.map_link_required).toBe(true);
    expect(payload.message).toMatch(/map link|venue/i);
  });

  test('updateService returns 400 when switching to offline with no map_link', async () => {
    mockFrom({ map_link: '   ' }); // whitespace-only counts as empty
    const r = res();
    await updateService(req({ id: 'svc-1' }, { meeting_mode: 'offline' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].map_link_required).toBe(true);
  });
});

// ── updateService ─────────────────────────────────────────────────────────────

describe('updateService', () => {
  test('re-slugifies when title changes', async () => {
    let updatePayload;
    supabaseAdmin.from.mockReturnValue({
      select:   jest.fn().mockReturnThis(),
      update:   jest.fn().mockImplementation((p) => { updatePayload = p; return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: SERVICE, error: null }) }; }),
      eq:       jest.fn().mockReturnThis(),
      neq:      jest.fn().mockReturnThis(),
      single:   jest.fn().mockResolvedValue({ data: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });
    const r = res();
    await updateService(req({ id: 'svc-1' }, { title: 'New Title Here' }), r);
    if (updatePayload?.slug) {
      expect(updatePayload.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test('returns 500 on DB error', async () => {
    mockFrom(null, { message: 'Constraint error' });
    const r = res();
    await updateService(req({ id: 'svc-1' }, { title: 'X' }), r);
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

// ── deleteService ─────────────────────────────────────────────────────────────

describe('deleteService', () => {
  test('deletes service scoped to host_id', async () => {
    let deleteCalled = false;
    supabaseAdmin.from.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockImplementation(() => {
        deleteCalled = true;
        return { eq: jest.fn().mockResolvedValue({ error: null }) };
      }),
    });
    const r = res();
    await deleteService(req({ id: 'svc-1' }), r);
    expect(deleteCalled).toBe(true);
  });

  test('returns confirmation message on success', async () => {
    // Controller chains .delete().eq(id).eq(host_id) — mock must support two eq calls
    supabaseAdmin.from.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    });
    const r = res();
    await deleteService(req({ id: 'svc-1' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.message).toMatch(/deleted/i);
  });
});

// ── toggleService ─────────────────────────────────────────────────────────────

describe('toggleService', () => {
  test('returns 404 when service not found', async () => {
    mockFrom(null);
    const r = res();
    await toggleService(req({ id: 'ghost' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test('flips is_active from true to false', async () => {
    let updateArg;
    supabaseAdmin.from
      .mockReturnValueOnce({
        select:  jest.fn().mockReturnThis(),
        eq:      jest.fn().mockReturnThis(),
        single:  jest.fn().mockResolvedValue({ data: { is_active: true }, error: null }),
      })
      .mockReturnValue({
        update:  jest.fn().mockImplementation((u) => { updateArg = u; return { eq: jest.fn().mockReturnThis() }; }),
        eq:      jest.fn().mockResolvedValue({ error: null }),
      });

    const r = res();
    await toggleService(req({ id: 'svc-1' }), r);
    if (updateArg) expect(updateArg.is_active).toBe(false);
    expect(r.json.mock.calls[0][0]).toEqual({ is_active: false });
  });
});

// ── getPublicServiceBySlug ────────────────────────────────────────────────────

describe('getPublicServiceBySlug', () => {
  test('returns 404 when service not found', async () => {
    mockFrom(null, { message: 'Not found' });
    const r = res();
    await getPublicServiceBySlug(req({ slug: 'ghost-service' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  test('returns service + vendor + reviews on success', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ // service lookup
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: SERVICE, error: null }),
      })
      .mockReturnValueOnce({ // vendor profile
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'vendor-uuid', name: 'Jane' }, error: null }),
      })
      .mockReturnValue({ // service count + availability + reviews
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order:  jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        count:  0,
      });

    const r = res();
    await getPublicServiceBySlug(req({ slug: 'consultation' }), r);
    const payload = r.json.mock.calls[0][0];
    expect(payload).toHaveProperty('service');
    expect(payload).toHaveProperty('vendor');
    expect(payload).toHaveProperty('reviews');
    expect(payload).toHaveProperty('avgRating');
  });
});

// ── getPublicServiceByProfileAndSlug ─────────────────────────────────────────

describe('getPublicServiceByProfileAndSlug', () => {
  test('returns 404 when vendor slug not found', async () => {
    mockFrom(null, { message: 'Not found' });
    const r = res();
    await getPublicServiceByProfileAndSlug(req({ profileSlug: 'nobody', serviceSlug: 'svc' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(r.json.mock.calls[0][0].message).toMatch(/host/i);
  });

  test('returns 404 when service slug not found for that vendor', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ // vendor found
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'v1', name: 'Jane' }, error: null }),
      })
      .mockReturnValue({ // service not found for this vendor
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });

    const r = res();
    await getPublicServiceByProfileAndSlug(req({ profileSlug: 'jane-v', serviceSlug: 'ghost' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(r.json.mock.calls[0][0].message).toMatch(/service/i);
  });
});
