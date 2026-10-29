'use strict';
// Semantic cache (SIE phase B part 2): a cache hit must serve the stored answer
// WITHOUT calling the model, and sensitive topics must never hit the cache.
// Voyage + Anthropic + Supabase are all mocked; no network.

jest.mock('../../services/ai/voyageClient', () => ({
  isConfigured: () => true,
  embedQuery: jest.fn(async () => [0.1, 0.2, 0.3]),
  MODEL: 'voyage-3.5-lite',
}));
jest.mock('../../services/ai/anthropicClient', () => {
  const create = jest.fn();
  return { __create: create, MODELS: { generate: 'gen' }, isConfigured: () => true, getClient: () => ({ messages: { create } }) };
});

// mockRpc branches by name; from() is a chainable persist stub. (mock-prefixed names
// are the only out-of-scope vars a jest.mock factory may reference.)
const mockRpc = jest.fn();
const mockChain = () => {
  const c = {};
  for (const m of ['insert', 'select', 'update', 'delete', 'eq', 'in']) c[m] = jest.fn(() => c);
  c.single = jest.fn(() => Promise.resolve({ data: { id: 'row-id' }, error: null }));
  c.then = (res, rej) => Promise.resolve({ data: null, error: null }).then(res, rej);
  return c;
};
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { rpc: (...a) => mockRpc(...a), from: jest.fn(() => mockChain()) } }));

const anthropic = require('../../services/ai/anthropicClient');
const { askBot } = require('../../services/botService');

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockImplementation((name) => {
    if (name === 'match_semantic_cache') {
      return Promise.resolve({ data: [{ id: 'cache1', answer: 'Cached: go to Settings → Calendar.', cited_sources: [{ source_file: 'docs/help/availability.md', heading: 'Calendar' }] }], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  });
});

test('a cache hit serves the stored answer and never calls the model', async () => {
  const out = await askBot({ question: 'how do I hook up google calendar?' });
  expect(out.source).toBe('cache');
  expect(out.answer).toMatch(/Settings → Calendar/);
  expect(out.escalate).toBe(false);
  expect(out.cited_sources).toEqual([{ source_file: 'docs/help/availability.md', heading: 'Calendar' }]);
  expect(anthropic.__create).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledWith('match_semantic_cache', expect.any(Object));
});

test('a sensitive question never touches the cache (must escalate)', async () => {
  const out = await askBot({ question: 'I want a refund for my payment' });
  expect(out.escalate).toBe(true);
  expect(mockRpc).not.toHaveBeenCalledWith('match_semantic_cache', expect.anything());
  expect(anthropic.__create).not.toHaveBeenCalled();
});
