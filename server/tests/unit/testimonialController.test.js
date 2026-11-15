'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: (p) => p?.plan || 'free',
  isFreeSlug: (s) => ['free', 'starter'].includes(s),
}));

const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/testimonialController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const req = (body, params = {}) => ({ user: { id: 'h1' }, body, params });

// Dispatch supabaseAdmin.from(table) to a per-table fake builder.
// profilePlan: the host's plan slug; count: existing testimonial count; insert: insert result.
const wire = ({ profilePlan = 'premium', count = 0, insert = { data: { id: 't1' }, error: null } } = {}) => {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { plan: profilePlan }, error: null }) }) }) };
    }
    // host_testimonials: count query (.select().eq() awaited) OR insert().select().single()
    return {
      select: () => ({ eq: () => Promise.resolve({ count, error: null }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve(insert) }) }),
    };
  });
};

beforeEach(() => { jest.clearAllMocks(); });

describe('createTestimonial', () => {
  it('400 when quote is missing', async () => {
    const r = res();
    await ctrl.createTestimonial(req({ author_name: 'Priya' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('400 when author_name is missing', async () => {
    const r = res();
    await ctrl.createTestimonial(req({ quote: 'Great!' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('201 for a Pro host (no cap)', async () => {
    wire({ profilePlan: 'premium', count: 99 });
    const r = res();
    await ctrl.createTestimonial(req({ quote: 'Great!', author_name: 'Priya' }), r);
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it('201 for a free host under the cap', async () => {
    wire({ profilePlan: 'free', count: 2 });
    const r = res();
    await ctrl.createTestimonial(req({ quote: 'Great!', author_name: 'Priya' }), r);
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it('409 when a free host is at the cap', async () => {
    wire({ profilePlan: 'free', count: ctrl.FREE_CAP });
    const r = res();
    await ctrl.createTestimonial(req({ quote: 'Great!', author_name: 'Priya' }), r);
    expect(r.status).toHaveBeenCalledWith(409);
  });
});

describe('listMyTestimonials', () => {
  it('returns [] when the table is missing (dormant)', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'relation "host_testimonials" does not exist' } }) }) }) }),
    });
    const r = res();
    await ctrl.listMyTestimonials(req({}), r);
    expect(r.json).toHaveBeenCalledWith([]);
  });
});

describe('getPublicTestimonials', () => {
  it('404 when the host is unknown', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    });
    const r = res();
    await ctrl.getPublicTestimonials(req({}, { username: 'nope' }), r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
