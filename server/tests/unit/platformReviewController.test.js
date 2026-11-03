// server/tests/unit/platformReviewController.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { saveMine, listPublic } = require('../../controllers/platformReviewController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.set = jest.fn(() => r); return r; };
// Chainable query stub: every builder method returns itself; `result` resolves terminal calls/awaits.
const chain = (result, spy = {}) => {
  const c = {};
  ['select', 'eq', 'in', 'order', 'limit'].forEach((m) => { c[m] = jest.fn(() => c); });
  c.upsert = jest.fn((row, opts) => { spy.row = row; spy.opts = opts; return c; });
  c.maybeSingle = jest.fn().mockResolvedValue(result);
  c.single = jest.fn().mockResolvedValue(result);
  c.then = (ok, bad) => Promise.resolve(result).then(ok, bad);
  return c;
};
beforeEach(() => jest.clearAllMocks());

test('saveMine rejects a non-integer or out-of-range rating', async () => {
  for (const rating of [0, 6, 4.5, 'x', undefined]) {
    const r = res();
    await saveMine({ user: { id: 'u1' }, body: { rating, body: 'Long enough review' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  }
  expect(mockFrom).not.toHaveBeenCalled();
});

test('saveMine rejects a too-short review body', async () => {
  const r = res();
  await saveMine({ user: { id: 'u1' }, body: { rating: 5, body: 'short' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('saveMine upserts one row per account as pending, with host role and consent time', async () => {
  const spy = {};
  mockFrom.mockImplementation((t) => (t === 'profiles'
    ? chain({ data: { is_host: true, role: 'host' }, error: null })
    : chain({ data: { id: 'p1', status: 'pending' }, error: null }, spy)));
  const r = res();
  await saveMine({ user: { id: 'u1' }, body: { rating: '5', title: ' Great ', body: ' Saves me hours every week ', consent_public: true } }, r);
  expect(spy.opts).toEqual({ onConflict: 'user_id' });
  expect(spy.row).toMatchObject({
    user_id: 'u1', reviewer_role: 'host', rating: 5, title: 'Great',
    body: 'Saves me hours every week', consent_public: true, status: 'pending',
  });
  expect(spy.row.consented_at).toEqual(expect.any(String));
  expect(r.json).toHaveBeenCalledWith({ id: 'p1', status: 'pending' });
});

test('saveMine without consent stores guest role and no consent time', async () => {
  const spy = {};
  mockFrom.mockImplementation((t) => (t === 'profiles'
    ? chain({ data: { is_host: false, role: 'customer' }, error: null })
    : chain({ data: { id: 'p2' }, error: null }, spy)));
  await saveMine({ user: { id: 'u2' }, body: { rating: 4, body: 'Booking was quick and easy' } }, res());
  expect(spy.row).toMatchObject({ reviewer_role: 'guest', consent_public: false, consented_at: null });
});

test('listPublic only exposes public fields; guests get no username/profession', async () => {
  const rows = [
    { id: 'a', user_id: 'h1', reviewer_role: 'host', rating: 5, title: null, body: 'b', created_at: 't' },
    { id: 'b', user_id: 'g1', reviewer_role: 'guest', rating: 4, title: null, body: 'b', created_at: 't' },
  ];
  const profiles = [
    { id: 'h1', name: 'Host One', username: 'hostone', profile_image: 'h.webp', profession: 'Architect' },
    { id: 'g1', name: 'Guest One', username: 'g-user', profile_image: null, profession: 'X' },
  ];
  const reviewsQ = chain({ data: rows, error: null });
  mockFrom.mockImplementation((t) => (t === 'profiles' ? chain({ data: profiles, error: null }) : reviewsQ));
  const r = res();
  await listPublic({}, r);
  expect(reviewsQ.eq).toHaveBeenCalledWith('status', 'approved');
  expect(reviewsQ.eq).toHaveBeenCalledWith('consent_public', true);
  const out = r.json.mock.calls[0][0];
  expect(out.count).toBe(2);
  expect(out.average).toBe(4.5);
  expect(out.reviews[0]).toMatchObject({ name: 'Host One', username: 'hostone', profession: 'Architect' });
  expect(out.reviews[1]).toMatchObject({ name: 'Guest One', username: null, profession: null });
  expect(out.reviews[0]).not.toHaveProperty('user_id');
});

test('listPublic degrades to empty before the migration is applied', async () => {
  mockFrom.mockImplementation(() => chain({ data: null, error: { code: '42P01', message: 'missing' } }));
  const r = res();
  await listPublic({}, r);
  expect(r.json).toHaveBeenCalledWith({ reviews: [], count: 0, average: null });
});
