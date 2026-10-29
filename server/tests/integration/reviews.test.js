/**
 * tests/integration/reviews.test.js
 * Integration tests for /api/reviews:
 *   - PUT /api/reviews/booking/:id  (updateReview)
 *   - GET /api/reviews/received     (direction filter)
 */
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => { req.user = { id: 'user-uuid' }; next(); },
  requireHost: (_req, _res, next) => next(),
}));
jest.mock('../../middleware/requireFeature', () => ({
  requireFeature: () => (_r, _s, n) => n(),
}));
jest.mock('../../services/badgeEngine', () => ({
  evaluate: jest.fn().mockResolvedValue(undefined),
}));

const request        = require('supertest');
const express        = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const reviewRoutes      = require('../../routes/reviewRoutes');

const app = express();
app.use(express.json());
app.use('/api/reviews', reviewRoutes);

// Chainable stub whose terminal resolves `resolved`.
const chain = (resolved) => ({
  select:      jest.fn().mockReturnThis(),
  insert:      jest.fn().mockReturnThis(),
  update:      jest.fn().mockReturnThis(),
  eq:          jest.fn().mockReturnThis(),
  neq:         jest.fn().mockReturnThis(),
  order:       jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue(resolved),
  maybeSingle: jest.fn().mockResolvedValue(resolved),
});

afterEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/reviews/booking/:id — updateReview
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/reviews/booking/:id', () => {
  const EXISTING_REVIEW = {
    id: 'review-1',
    reviewer_id: 'user-uuid',
    host_id: 'vendor-uuid',
    direction: 'guest_to_host',
  };
  const UPDATED_REVIEW = {
    id: 'review-1',
    reviewer_id: 'user-uuid',
    host_id: 'vendor-uuid',
    direction: 'guest_to_host',
    rating: 4,
    comment: 'Updated comment',
  };

  test('200 — author can update rating and comment', async () => {
    // First call: maybeSingle for existing review lookup
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: EXISTING_REVIEW, error: null }))   // lookup
      .mockReturnValueOnce(chain({ data: UPDATED_REVIEW, error: null }));   // update + select

    const res = await request(app)
      .put('/api/reviews/booking/booking-1')
      .send({ rating: 4, comment: 'Updated comment' });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4);
    expect(res.body.comment).toBe('Updated comment');
  });

  test('404 — non-author (reviewer_id mismatch) gets "No review to edit"', async () => {
    // The lookup filters by reviewer_id = req.user.id ('user-uuid'),
    // so a different user would get null back from maybeSingle.
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: null, error: null })); // lookup returns nothing

    const res = await request(app)
      .put('/api/reviews/booking/booking-1')
      .send({ rating: 3 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('No review to edit');
  });

  test('400 — rating out of range (6) is rejected before any DB call', async () => {
    const res = await request(app)
      .put('/api/reviews/booking/booking-1')
      .send({ rating: 6 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 5/i);
    // No DB call should have been made
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test('400 — rating 0 is rejected', async () => {
    const res = await request(app)
      .put('/api/reviews/booking/booking-1')
      .send({ rating: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 5/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/received — direction filter
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/reviews/received', () => {
  const GUEST_TO_HOST_ROW = {
    id: 'r-1', rating: 5, comment: 'Great host', created_at: '2026-01-01T00:00:00Z',
    direction: 'guest_to_host',
    profiles: { name: 'Alice', profile_image: null },
    bookings: { services: { title: 'Yoga Session' } },
  };
  const HOST_TO_GUEST_ROW = {
    id: 'r-2', rating: 4, comment: 'Good guest', created_at: '2026-01-02T00:00:00Z',
    direction: 'host_to_guest',
    profiles: { name: 'Bob', profile_image: null },
    bookings: { services: { title: 'Yoga Session' } },
  };

  // Helper: build a stub where order() is the terminal that resolves the query.
  // Controller chain: .from → .select → .eq(subject_id) → [.eq(direction)?] → .order()
  const makeReceivedStub = (rows, eqMock = jest.fn().mockReturnThis()) => {
    const stub = {
      select: jest.fn().mockReturnThis(),
      eq:     eqMock,
      neq:    jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      order:  jest.fn().mockResolvedValue({ data: rows, error: null }),
    };
    // eq must return an object that also has eq and order so chaining works
    eqMock.mockImplementation(() => stub);
    return { stub, eqMock };
  };

  test('200 — no filter returns all reviews for subject', async () => {
    const rows = [GUEST_TO_HOST_ROW, HOST_TO_GUEST_ROW];
    const { stub } = makeReceivedStub(rows);
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).get('/api/reviews/received');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.count).toBe(2);
  });

  test('200 — direction=guest_to_host returns only guest_to_host rows', async () => {
    const rows = [GUEST_TO_HOST_ROW];
    const eqMock = jest.fn();
    const { stub } = makeReceivedStub(rows, eqMock);
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).get('/api/reviews/received?direction=guest_to_host');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].direction).toBe('guest_to_host');
    // Confirm .eq("direction", "guest_to_host") was called
    expect(eqMock).toHaveBeenCalledWith('direction', 'guest_to_host');
  });

  test('200 — direction=host_to_guest returns only host_to_guest rows', async () => {
    const rows = [HOST_TO_GUEST_ROW];
    const eqMock = jest.fn();
    const { stub } = makeReceivedStub(rows, eqMock);
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).get('/api/reviews/received?direction=host_to_guest');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].direction).toBe('host_to_guest');
    expect(eqMock).toHaveBeenCalledWith('direction', 'host_to_guest');
  });

  test('200 — invalid direction value is ignored (no filter applied)', async () => {
    const rows = [GUEST_TO_HOST_ROW, HOST_TO_GUEST_ROW];
    const eqMock = jest.fn();
    const { stub } = makeReceivedStub(rows, eqMock);
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).get('/api/reviews/received?direction=invalid_value');
    expect(res.status).toBe(200);
    // .eq("direction", ...) should NOT have been called with an invalid value
    const directionCalls = eqMock.mock.calls.filter(([field]) => field === 'direction');
    expect(directionCalls).toHaveLength(0);
  });

  test('200 — avg and count computed correctly', async () => {
    const rows = [
      { ...GUEST_TO_HOST_ROW, rating: 5 },
      { ...HOST_TO_GUEST_ROW, rating: 3 },
    ];
    const { stub } = makeReceivedStub(rows);
    supabaseAdmin.from.mockReturnValueOnce(stub);

    const res = await request(app).get('/api/reviews/received');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.avg).toBe(4); // (5+3)/2 = 4.0
  });
});
