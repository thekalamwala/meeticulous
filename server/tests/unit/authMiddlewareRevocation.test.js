/**
 * authMiddlewareRevocation.test.js — global session invalidation (Google RISC).
 *
 * protect() must reject a token whose iat predates the user's
 * sessions_valid_after watermark, allow it otherwise, and FAIL OPEN (allow) if
 * the watermark column/lookup errors — a revocation-check fault must never lock
 * out a legitimate host.
 */
const jwt = require('jsonwebtoken');

const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: (...a) => mockGetUser(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: (...a) => mockMaybeSingle(...a) }) }),
    }),
  },
}));

const { protect } = require('../../middleware/authMiddleware');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
// Token with iat = 1000s ago.
const token = jwt.sign({ sub: 'u-1' }, 's', { expiresIn: '1h' });
const req = () => ({ headers: { authorization: `Bearer ${token}` } });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1', email: 'h@x.com' } }, error: null });
});

test('no watermark → allows (next called)', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { sessions_valid_after: null }, error: null });
  const next = jest.fn();
  const r = res();
  await protect(req(), r, next);
  expect(next).toHaveBeenCalled();
  expect(r.status).not.toHaveBeenCalledWith(401);
});

test('watermark AFTER token iat → 401 revoked, next NOT called', async () => {
  mockMaybeSingle.mockResolvedValue({
    data: { sessions_valid_after: new Date(Date.now() + 60_000).toISOString() },
    error: null,
  });
  const next = jest.fn();
  const r = res();
  await protect(req(), r, next);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('watermark BEFORE token iat → allows', async () => {
  mockMaybeSingle.mockResolvedValue({
    data: { sessions_valid_after: new Date(Date.now() - 3600_000).toISOString() },
    error: null,
  });
  const next = jest.fn();
  await protect(req(), res(), next);
  expect(next).toHaveBeenCalled();
});

test('watermark lookup errors (e.g. column missing) → FAIL OPEN, allows', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'column does not exist' } });
  const next = jest.fn();
  await protect(req(), res(), next);
  expect(next).toHaveBeenCalled();
});

test('a banned user stays blocked across a later gate error (ban-cache, P2-15)', async () => {
  // 1st request: DB reports banned → 403, and the ban is remembered.
  mockMaybeSingle.mockResolvedValueOnce({ data: { sessions_valid_after: null, is_banned: true }, error: null });
  const r1 = res(); const next1 = jest.fn();
  await protect(req(), r1, next1);
  expect(r1.status).toHaveBeenCalledWith(403);
  expect(next1).not.toHaveBeenCalled();

  // 2nd request: gate read errors (transient DB blip) → must STILL block from the
  // cache, not fail open to allowed (a blip must not become a ban bypass).
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });
  const r2 = res(); const next2 = jest.fn();
  await protect(req(), r2, next2);
  expect(r2.status).toHaveBeenCalledWith(403);
  expect(next2).not.toHaveBeenCalled();
});
