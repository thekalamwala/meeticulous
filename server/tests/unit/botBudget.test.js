// botBudget: caps model calls per rolling minute + day. RATE_LIMIT_STORE_URL is
// unset in tests, so the in-memory counter path is exercised.
const budget = require('../../lib/botBudget');

beforeEach(() => {
  delete process.env.BOT_MODEL_CALLS_PER_MIN;
  delete process.env.BOT_MODEL_CALLS_PER_DAY;
  budget._reset();
});

test('allows up to the per-minute limit, then denies with reason "minute"', async () => {
  process.env.BOT_MODEL_CALLS_PER_MIN = '2';
  budget._reset();
  expect((await budget.tryConsume()).allowed).toBe(true);
  expect((await budget.tryConsume()).allowed).toBe(true);
  const third = await budget.tryConsume();
  expect(third.allowed).toBe(false);
  expect(third.reason).toBe('minute');
});

test('denies with reason "day" when the daily ceiling is hit under a high minute limit', async () => {
  process.env.BOT_MODEL_CALLS_PER_MIN = '1000';
  process.env.BOT_MODEL_CALLS_PER_DAY = '2';
  budget._reset();
  expect((await budget.tryConsume()).allowed).toBe(true);
  expect((await budget.tryConsume()).allowed).toBe(true);
  const third = await budget.tryConsume();
  expect(third.allowed).toBe(false);
  expect(third.reason).toBe('day');
});
