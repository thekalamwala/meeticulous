'use strict';
// voyageClient — key-optional embeddings. fetch is mocked; no network is hit.

const voyage = require('../../services/ai/voyageClient');

const OLD_KEY = process.env.VOYAGE_API_KEY;
afterEach(() => {
  if (OLD_KEY === undefined) delete process.env.VOYAGE_API_KEY;
  else process.env.VOYAGE_API_KEY = OLD_KEY;
  jest.restoreAllMocks();
});

test('unconfigured: isConfigured false, embed returns null', async () => {
  delete process.env.VOYAGE_API_KEY;
  expect(voyage.isConfigured()).toBe(false);
  expect(await voyage.embed(['hello'])).toBeNull();
  expect(await voyage.embedQuery('hello')).toBeNull();
});

test('configured: embed returns the vectors from the API', async () => {
  process.env.VOYAGE_API_KEY = 'test-key';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }] }),
  });
  const out = await voyage.embed(['a', 'b'], 'document');
  expect(out).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  // sends the model + input_type in the body
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.model).toBe(voyage.MODEL);
  expect(body.input_type).toBe('document');
});

test('embedQuery returns a single vector', async () => {
  process.env.VOYAGE_API_KEY = 'test-key';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ embedding: [1, 2, 3] }] }) });
  expect(await voyage.embedQuery('hi')).toEqual([1, 2, 3]);
});

test('a non-OK response throws (caller falls back to FTS)', async () => {
  process.env.VOYAGE_API_KEY = 'test-key';
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
  await expect(voyage.embed(['x'])).rejects.toThrow(/voyage 429/);
});

test('empty input short-circuits without calling fetch', async () => {
  process.env.VOYAGE_API_KEY = 'test-key';
  global.fetch = jest.fn();
  expect(await voyage.embed([])).toEqual([]);
  expect(await voyage.embed(['   '])).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});
