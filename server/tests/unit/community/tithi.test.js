'use strict';
// tithi.js — release-note publisher. AI is mocked OFF so the deterministic (fallback)
// path runs: no model stubbing, every assertion stable.

jest.mock('../../../services/ai/anthropicClient', () => ({
  isConfigured: () => false,
  getClient: () => null,
  MODELS: { generate: 'haiku', listing: 'sonnet' },
}));
jest.mock('../../../lib/botBudget', () => ({ tryConsume: async () => ({ allowed: true }) }));
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../../services/community/store', () => ({
  getPostBySlug: jest.fn(),
  getSpaceByKey: jest.fn(),
  insertPost: jest.fn(),
  refreshIndexable: jest.fn(),
  getProfile: jest.fn(),
  countCommentsByAuthorOnPost: jest.fn(),
  insertComment: jest.fn(),
}));
jest.mock('../../../services/botService', () => ({ askBot: jest.fn() }));
jest.mock('../../../services/bot/escalationService', () => ({ recordAndNotify: jest.fn() }));
jest.mock('../../../services/community/notify', () => ({ onMentions: jest.fn() }));

const { isFeatureEnabled } = require('../../../services/featureFlags');
const botService = require('../../../services/botService');
const escalationService = require('../../../services/bot/escalationService');
const notify = require('../../../services/community/notify');
const store = require('../../../services/community/store');
const tithi = require('../../../services/community/tithi');

const PR = { number: 412, title: 'feat: faster booking confirmations', body: 'Cuts confirm time from 8s to 2s.' };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.COMMUNITY_TITHI_USER_ID = 'tithi-uuid';
  isFeatureEnabled.mockResolvedValue(true);
});

describe('pure helpers', () => {
  test('kindFromPrefix maps conventional prefixes', () => {
    expect(tithi.kindFromPrefix('feat: x')).toBe('feature');
    expect(tithi.kindFromPrefix('fix(bot): y')).toBe('fix');
    expect(tithi.kindFromPrefix('chore: deps')).toBe('upgrade');
    expect(tithi.kindFromPrefix('random title')).toBeNull();
  });

  test('releaseLabel resolves the month', () => {
    expect(tithi.releaseLabel('release/2026-11')).toBe('November');
    expect(tithi.releaseLabel('2026-01')).toBe('January');
    expect(tithi.releaseLabel('garbage')).toBe('next');
  });

  test('cleanTitle strips the commit prefix', () => {
    expect(tithi.cleanTitle('feat(booking)!: faster confirmations')).toBe('faster confirmations');
  });

  test('prSlug is deterministic and PR-suffixed (the dedup key)', () => {
    expect(tithi.prSlug(PR, 'feature')).toBe('faster-booking-confirmations-pr-412');
    expect(tithi.prSlug(PR, 'feature')).toBe(tithi.prSlug(PR, 'feature'));
  });

  test('fallbackNote leads with the right verb and names the release', () => {
    const { headline, body } = tithi.fallbackNote(PR, 'feature', 'November');
    expect(headline).toMatch(/^New:/);
    expect(body).toMatch(/November release/);
  });
});

describe('classifyPr (AI off)', () => {
  test('uses the prefix with no model call', async () => {
    expect(await tithi.classifyPr(PR)).toBe('feature');
  });
  test('defaults to upgrade when there is no prefix and no AI', async () => {
    expect(await tithi.classifyPr({ title: 'tidy up', body: '' })).toBe('upgrade');
  });
});

describe('voice guardrails survive the humour layer', () => {
  test('VOICE forbids bot disclosure and fabrication', () => {
    expect(tithi.VOICE).toMatch(/never say or imply you are an ai|never reveal/i);
    expect(tithi.VOICE).toMatch(/never invent/i);
    expect(tithi.VOICE).toMatch(/trevor.noah/i);
  });
});

describe('publishReleaseNote gating', () => {
  test('flag off -> skipped, nothing written', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    expect(await tithi.publishReleaseNote({ pr: PR, release: '2026-11' })).toEqual({ skipped: 'flag_off' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('no identity -> skipped', async () => {
    delete process.env.COMMUNITY_TITHI_USER_ID;
    expect(await tithi.publishReleaseNote({ pr: PR, release: '2026-11' })).toEqual({ skipped: 'no_identity' });
  });

  test('already posted (slug exists) -> duplicate, no insert', async () => {
    store.getPostBySlug.mockResolvedValue({ id: 'existing' });
    expect(await tithi.publishReleaseNote({ pr: PR, release: '2026-11' })).toEqual({ skipped: 'duplicate' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('approveFirst -> draft, never touches the DB', async () => {
    const res = await tithi.publishReleaseNote({ pr: PR, release: '2026-11', approveFirst: true });
    expect(res.draft).toBe(true);
    expect(res.kind).toBe('feature');
    expect(store.getPostBySlug).not.toHaveBeenCalled();
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('tables missing -> skipped unavailable, not thrown', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    const err = new Error('relation does not exist'); err.code = 'COMMUNITY_UNAVAILABLE';
    store.getSpaceByKey.mockRejectedValue(err);
    expect(await tithi.publishReleaseNote({ pr: PR, release: '2026-11' })).toEqual({ skipped: 'unavailable' });
  });
});

describe('replyToPost (first responder)', () => {
  const POST = { id: 'post-1', author_id: 'member-1', body: 'how do payouts work?', slug: 'p-slug', status: 'visible' };

  beforeEach(() => {
    store.countCommentsByAuthorOnPost.mockResolvedValue(0);
    store.getProfile.mockResolvedValue({ id: 'member-1', is_host: true, name: 'Asha' });
    store.insertComment.mockResolvedValue({ id: 'comment-1' });
    botService.askBot.mockResolvedValue({ answer: 'Payouts clear in 24-48h.', escalate: false });
  });

  test('flag off -> skipped, no model call', async () => {
    isFeatureEnabled.mockResolvedValue(false);
    expect(await tithi.replyToPost({ post: POST })).toEqual({ skipped: 'flag_off' });
    expect(botService.askBot).not.toHaveBeenCalled();
  });

  test('never replies to herself', async () => {
    expect(await tithi.replyToPost({ post: { ...POST, author_id: 'tithi-uuid' } })).toEqual({ skipped: 'self' });
  });

  test('one reply per post (dedup)', async () => {
    store.countCommentsByAuthorOnPost.mockResolvedValue(1);
    expect(await tithi.replyToPost({ post: POST })).toEqual({ skipped: 'already_replied' });
    expect(store.insertComment).not.toHaveBeenCalled();
  });

  test('grounded answer is posted as a Tithi comment with the author audience, no tag', async () => {
    const res = await tithi.replyToPost({ post: POST });
    expect(res).toEqual({ replied: true, commentId: 'comment-1', escalated: false, tagged: false });
    expect(botService.askBot).toHaveBeenCalledWith({ question: POST.body, audience: 'host' });
    expect(store.insertComment).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1', author_id: 'tithi-uuid', body: 'Payouts clear in 24-48h.', status: 'visible',
    }));
    expect(escalationService.recordAndNotify).not.toHaveBeenCalled();
    expect(notify.onMentions).not.toHaveBeenCalled();
  });

  test('escalation: holding reply tags a human in-thread AND emails the team', async () => {
    botService.askBot.mockResolvedValue({ answer: "I'm getting a human on this.", escalate: true, escalateReason: 'sensitive' });
    const res = await tithi.replyToPost({ post: POST });
    expect(res).toEqual({ replied: true, commentId: 'comment-1', escalated: true, tagged: true });
    // the reply body carries the @mention so it's visible in-thread
    expect(store.insertComment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('@team') }));
    expect(escalationService.recordAndNotify).toHaveBeenCalledTimes(1);
    // and the human is pinged via the community mention path
    expect(notify.onMentions).toHaveBeenCalledWith(expect.objectContaining({ usernames: ['team'], actorId: 'tithi-uuid' }));
  });

  test('a removed post is not answered', async () => {
    expect(await tithi.replyToPost({ post: { ...POST, status: 'removed' } })).toEqual({ skipped: 'not_visible' });
  });
});

describe('publishReleaseNote happy path', () => {
  test('posts an announcement into updates as Tithi, deterministic slug, indexable', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    store.getSpaceByKey.mockResolvedValue({ id: 'updates-space-id', key: 'updates' });
    store.insertPost.mockResolvedValue({ id: 'new-post-id' });

    const res = await tithi.publishReleaseNote({ pr: PR, release: 'release/2026-11' });

    expect(res).toMatchObject({ posted: true, postId: 'new-post-id', slug: 'faster-booking-confirmations-pr-412', kind: 'feature' });
    expect(store.getSpaceByKey).toHaveBeenCalledWith('updates');
    const [row, makeSlug] = store.insertPost.mock.calls[0];
    expect(row).toMatchObject({
      kind: 'post', format: 'announcement', author_id: 'tithi-uuid', space_id: 'updates-space-id', status: 'visible',
    });
    expect(makeSlug()).toBe('faster-booking-confirmations-pr-412');
    expect(store.refreshIndexable).toHaveBeenCalledWith('new-post-id');
  });
});
