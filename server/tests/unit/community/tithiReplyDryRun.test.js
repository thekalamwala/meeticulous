'use strict';
// Dry-run gate evaluation. store / anthropicClient are mocked so requiring the script
// never touches Supabase or the model; replyGate.decide is the only thing under test.

jest.mock('../../../services/community/store', () => ({ listFeedRows: jest.fn(), listRecentTopLevelComments: jest.fn() }));
jest.mock('../../../services/ai/anthropicClient', () => ({ isConfigured: () => false }));
jest.mock('../../../services/community/replyGate', () => ({ decide: jest.fn() }));

const replyGate = require('../../../services/community/replyGate');
const { evalItem } = require('../../../scripts/tithiReplyDryRun');

beforeEach(() => jest.clearAllMocks());

test('skips a non-visible item without consulting the gate', async () => {
  expect(await evalItem('post', { status: 'removed', body: 'how do payouts work?' }))
    .toEqual({ decision: 'skip', reason: 'not_visible' });
  expect(replyGate.decide).not.toHaveBeenCalled();
});

test('skips a nested (non-top-level) comment', async () => {
  expect(await evalItem('comment', { status: 'visible', parent_id: 'x', body: 'how?' }))
    .toEqual({ decision: 'skip', reason: 'not_top_level' });
  expect(replyGate.decide).not.toHaveBeenCalled();
});

test('skips an empty body', async () => {
  expect(await evalItem('post', { status: 'visible', body: '   ' }))
    .toEqual({ decision: 'skip', reason: 'empty' });
});

test('reports an answer with its route when the gate says act', async () => {
  replyGate.decide.mockResolvedValue({ act: true, route: 'comparison' });
  expect(await evalItem('post', { status: 'visible', body: 'can you do X like Calendly?' }))
    .toEqual({ decision: 'answer', route: 'comparison' });
});

test('reports a skip with the gate reason when silent', async () => {
  replyGate.decide.mockResolvedValue({ act: false, route: 'not_for_us', reason: 'not_a_question' });
  expect(await evalItem('comment', { status: 'visible', parent_id: null, body: 'love this!' }))
    .toEqual({ decision: 'skip', reason: 'not_a_question' });
});
