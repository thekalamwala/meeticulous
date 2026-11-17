// Slice 8 — the gap digest (closed learning loop). supabase / featureFlags / email /
// anthropic / budget mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../utils/sendEmail', () => jest.fn(() => Promise.resolve()));
jest.mock('../../services/ai/anthropicClient', () => ({ isConfigured: jest.fn(() => false), getClient: jest.fn(), MODELS: { generate: 'gen' } }));
jest.mock('../../lib/botBudget', () => ({ tryConsume: jest.fn().mockResolvedValue({ allowed: true }) }));

const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../../services/featureFlags');
const sendEmail = require('../../utils/sendEmail');
const { runGapDigest, clusterGaps, sigOf } = require('../../services/bot/gapDigest');

function qb(result) {
  const b = {};
  ['select', 'eq', 'gte', 'limit'].forEach((m) => { b[m] = () => b; });
  b.then = (res) => res(result);
  return b;
}

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabled.mockResolvedValue(true);
});

describe('sigOf / clusterGaps (pure)', () => {
  test('word order and stopwords do not change the signature', () => {
    expect(sigOf('refund status')).toBe(sigOf('status of the refund'));
  });
  test('clusters by theme and ranks by frequency', () => {
    const rows = [
      { question: 'refund status' }, { question: 'status of refund' }, { question: 'the refund status please' },
      { question: 'payout settlement timing' },
    ];
    const c = clusterGaps(rows);
    expect(c).toHaveLength(2);
    expect(c[0].sig).toBe('refund status');
    expect(c[0].count).toBe(3);
    expect(c[0].questions.length).toBeGreaterThan(0);
  });
  test('blank questions are ignored', () => {
    expect(clusterGaps([{ question: '' }, { question: null }, {}])).toEqual([]);
  });
});

describe('runGapDigest', () => {
  test('flag OFF → no-op', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    expect(await runGapDigest()).toEqual({ skipped: 'flag_off' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('no gaps → nothing emailed', async () => {
    supabaseAdmin.from.mockReturnValue(qb({ data: [], error: null }));
    const r = await runGapDigest();
    expect(r).toEqual({ themes: 0, gaps: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('clusters the week\'s misses and emails the team (no key → no stub)', async () => {
    supabaseAdmin.from.mockReturnValue(qb({
      data: [
        { question: 'where is my payout' }, { question: 'my payout settlement' }, { question: 'payout settlement delayed' },
        { question: 'invoice download' },
      ],
      error: null,
    }));
    const r = await runGapDigest();
    expect(r.themes).toBeGreaterThanOrEqual(1);
    expect(r.gaps).toBe(4);
    expect(r.drafted).toBe(false); // anthropic not configured
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/unanswered themes/);
  });

  test('a query error degrades to skipped', async () => {
    supabaseAdmin.from.mockReturnValue(qb({ data: null, error: { message: 'boom' } }));
    expect(await runGapDigest()).toEqual({ skipped: 'unavailable' });
  });
});
