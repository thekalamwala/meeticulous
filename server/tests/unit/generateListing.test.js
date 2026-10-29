jest.mock('../../services/ai/anthropicClient', () => {
  const create = jest.fn();
  return { __create: create, MODELS: { generate: 'gen-id', regenerate: 'regen-id', listing: 'claude-sonnet-5' }, getClient: () => ({ messages: { create } }) };
});
const client = require('../../services/ai/anthropicClient');
const { generateListing, thinkingParamFor } = require('../../services/ai/generateListing');

const toolReply = (input) => ({ content: [{ type: 'tool_use', name: 'emit_listing', input }] });

beforeEach(() => client.__create.mockReset());

test('returns sanitized fields from tool output (forced tool_choice, no thinking param)', async () => {
  client.__create.mockResolvedValueOnce(toolReply({
    title: 'SEO Consultancy', short_description: 'Grow organic traffic fast.',
    long_description: 'SEO consultancy is a service...', included_items: ['Audit'],
    excluded_items: ['Ads'], faqs: [{ question: 'How long?', answer: 'Weeks.' }],
  }));
  const out = await generateListing({ title: 'SEO', allowedCategorySlugs: [] });
  expect(out.model).toBe('claude-sonnet-5');
  expect(out.fields.title).toBe('SEO Consultancy');
  // Sonnet 5 (adaptive) defaults thinking ON, so a forced tool_choice needs
  // {type:'disabled'} sent explicitly.
  expect(client.__create).toHaveBeenCalledWith(expect.objectContaining({
    model: 'claude-sonnet-5', tool_choice: { type: 'tool', name: 'emit_listing' },
    thinking: { type: 'disabled' },
  }));
});

test('thinkingParamFor: disabled for adaptive models, omitted for pre-adaptive', () => {
  // adaptive → must send {type:'disabled'}
  expect(thinkingParamFor('claude-sonnet-5')).toEqual({ thinking: { type: 'disabled' } });
  expect(thinkingParamFor('claude-opus-4-8')).toEqual({ thinking: { type: 'disabled' } });
  // pre-adaptive → must OMIT (these reject {type:'disabled'} with a 400)
  expect(thinkingParamFor('claude-haiku-4-5-20251001')).toEqual({});
  expect(thinkingParamFor('claude-sonnet-4-5-20250929')).toEqual({});
});

test('regenerate uses the same listing model (variety comes from the tweak prompt)', async () => {
  client.__create.mockResolvedValueOnce(toolReply({
    title: 'T', short_description: 'S', long_description: 'L',
    included_items: ['a'], excluded_items: ['b'], faqs: [{ question: 'q', answer: 'a' }],
  }));
  const out = await generateListing({ title: 'X', regenerate: true });
  expect(out.model).toBe('claude-sonnet-5');
});

test('retries once then throws AI_INVALID on no tool output', async () => {
  client.__create.mockResolvedValue({ content: [{ type: 'text', text: 'sorry' }] });
  await expect(generateListing({ title: 'X' })).rejects.toThrow('AI_INVALID');
  expect(client.__create).toHaveBeenCalledTimes(2);
});

test('retries when the first tool call is INCOMPLETE (only title + short_description)', async () => {
  // Partial payload — the exact "only Title + Short Description populate" bug:
  // truthy object, but missing long_description/included/excluded/faqs.
  client.__create
    .mockResolvedValueOnce(toolReply({ title: 'SEO', short_description: 'Grow traffic.' }))
    .mockResolvedValueOnce(toolReply({
      title: 'SEO Consultancy', short_description: 'Grow organic traffic fast.',
      long_description: 'SEO consultancy is a service...', included_items: ['Audit'],
      excluded_items: ['Ads'], faqs: [{ question: 'How long?', answer: 'Weeks.' }],
    }));
  const out = await generateListing({ title: 'SEO' });
  expect(client.__create).toHaveBeenCalledTimes(2);
  expect(out.fields.long_description).toBe('SEO consultancy is a service...');
  expect(out.fields.included_items).toEqual(['Audit']);
  expect(out.fields.faqs).toHaveLength(1);
});

test('throws AI_UNAVAILABLE when client null', async () => {
  const spy = jest.spyOn(client, 'getClient').mockReturnValueOnce(null);
  await expect(generateListing({ title: 'X' })).rejects.toThrow('AI_UNAVAILABLE');
  spy.mockRestore();
});
