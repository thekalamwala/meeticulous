'use strict';
// tithi.js — release-note publisher. AI is mocked OFF so the deterministic (fallback)
// path runs: no model stubbing, every assertion stable.

// AI defaults OFF (deterministic fallback path) so the existing suite is untouched; a
// test opts the model IN by setting mockAiConfigured and the text it should return.
let mockAiConfigured = false;
let mockAiResponse = '';
jest.mock('../../../services/ai/anthropicClient', () => ({
  isConfigured: () => mockAiConfigured,
  getClient: () => ({ messages: { create: async () => ({ content: [{ type: 'text', text: mockAiResponse }] }) } }),
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
  countReplies: jest.fn(),
  countRepliesByAuthor: jest.fn(),
  insertComment: jest.fn(),
}));
jest.mock('../../../services/botService', () => ({ askBot: jest.fn() }));
jest.mock('../../../services/community/replyGate', () => ({ decide: jest.fn(), appendCta: jest.fn((a) => a) }));
jest.mock('../../../services/bot/escalationService', () => ({ recordAndNotify: jest.fn() }));
jest.mock('../../../services/community/notify', () => ({ onMentions: jest.fn() }));

const { isFeatureEnabled } = require('../../../services/featureFlags');
const botService = require('../../../services/botService');
const escalationService = require('../../../services/bot/escalationService');
const notify = require('../../../services/community/notify');
const store = require('../../../services/community/store');
const tithi = require('../../../services/community/tithi');
const replyGate = require('../../../services/community/replyGate');

const PR = { number: 412, title: 'feat: faster booking confirmations', body: 'Cuts confirm time from 8s to 2s.' };
// Same PR but the author left a Community brief — the deterministic (AI-off) path then
// has safe copy to post, so the store-reaching tests below don't trip the needsReview gate.
const PR_B = { ...PR, body: `${PR.body}\n\nCommunity: Confirmations are near-instant now.` };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.COMMUNITY_TITHI_USER_ID = 'tithi-uuid';
  isFeatureEnabled.mockResolvedValue(true);
  mockAiConfigured = false;
  mockAiResponse = '';
});

describe('[[SKIP]] — model declines a not-live change instead of posting the hedge', () => {
  test('model returns [[SKIP]] (no brief) -> skipped not_live, nothing written', async () => {
    mockAiConfigured = true;
    mockAiResponse = '[[SKIP]]';
    store.getPostBySlug.mockResolvedValue(null);
    const res = await tithi.publishReleaseNote({ pr: PR, release: '2026-11' });
    expect(res).toEqual({ skipped: 'not_live' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('[[SKIP]] never leaks into a published post', async () => {
    mockAiConfigured = true;
    mockAiResponse = 'Something shipped\n\n[[SKIP]] actually not sure';
    store.getPostBySlug.mockResolvedValue(null);
    const res = await tithi.publishReleaseNote({ pr: PR, release: '2026-11' });
    expect(res).toEqual({ skipped: 'not_live' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('an explicit author brief overrides [[SKIP]] — their copy is posted', async () => {
    mockAiConfigured = true;
    mockAiResponse = '[[SKIP]]';
    store.getPostBySlug.mockResolvedValue(null);
    store.getSpaceByKey.mockResolvedValue({ id: 'space-1' });
    store.insertPost.mockResolvedValue({ id: 'post-1' });
    const res = await tithi.publishReleaseNote({ pr: PR_B, release: '2026-11' });
    expect(res.posted).toBe(true);
    expect(store.insertPost).toHaveBeenCalled();
  });

  test('writeReleaseNote returns the MODEL_SKIP sentinel for a not-live PR with no brief', async () => {
    mockAiConfigured = true;
    mockAiResponse = '[[SKIP]]';
    const note = await tithi.writeReleaseNote(PR, 'feature', 'November', null);
    expect(note).toBe(tithi.MODEL_SKIP);
  });
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

  test('cleanTitle strips a test(scope) prefix (the #211 leak)', () => {
    expect(tithi.cleanTitle('test(dashboard): fold revamped pages')).toBe('fold revamped pages');
  });

  test('truncateWords cuts on a word boundary, never mid-word', () => {
    const s = 'release notes plus first-responder replies for members';
    expect(tithi.truncateWords(s, 30)).not.toMatch(/responde$/);
    expect(s.startsWith(tithi.truncateWords(s, 30))).toBe(true);
    expect(tithi.truncateWords(s, 30).endsWith(' ')).toBe(false);
  });

  test('parseCommunityBlock pulls the author brief; empty/absent -> null', () => {
    expect(tithi.parseCommunityBlock('body\n\nCommunity: Payouts are faster now.')).toBe('Payouts are faster now.');
    expect(tithi.parseCommunityBlock('no block here')).toBeNull();
    expect(tithi.parseCommunityBlock('Community:   ')).toBeNull();
    // last occurrence wins (author may use the word while explaining above)
    expect(tithi.parseCommunityBlock('Community: draft one\n\nCommunity: final line')).toBe('final line');
  });

  test('briefNote posts the author copy as-is', () => {
    const { headline, body } = tithi.briefNote('Confirmations are near-instant now.');
    expect(body).toBe('Confirmations are near-instant now.');
    expect(headline).toBe('Confirmations are near-instant now.');
  });

  test('announceDecision gates by prefix, and a brief always opts in', () => {
    expect(tithi.announceDecision({ title: 'feat: x', body: '' }).announce).toBe(true);
    expect(tithi.announceDecision({ title: 'docs: x', body: '' })).toEqual({ announce: false, reason: 'not_announce' });
    expect(tithi.announceDecision({ title: 'test(ui): x', body: '' })).toEqual({ announce: false, reason: 'not_announce' });
    expect(tithi.announceDecision({ title: 'random title', body: '' })).toEqual({ announce: false, reason: 'not_announce' });
    expect(tithi.announceDecision({ title: 'chore: x', body: 'Community: this matters' })).toEqual({ announce: true, brief: 'this matters' });
    expect(tithi.announceDecision({ title: 'feat: x', body: 'Community: SKIP' })).toEqual({ announce: false, reason: 'author_skip' });
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
    // the locked voice: Trevor Noah × Shakespeare, raised by Pu La Deshpande
    expect(tithi.VOICE).toMatch(/trevor.noah/i);
    expect(tithi.VOICE).toMatch(/shakespeare/i);
    expect(tithi.VOICE).toMatch(/deshpande/i);
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
    expect(await tithi.publishReleaseNote({ pr: PR_B, release: '2026-11' })).toEqual({ skipped: 'duplicate' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('approveFirst -> draft, never touches the DB', async () => {
    const res = await tithi.publishReleaseNote({ pr: PR_B, release: '2026-11', approveFirst: true });
    expect(res.draft).toBe(true);
    expect(res.kind).toBe('feature');
    expect(store.getPostBySlug).not.toHaveBeenCalled();
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('tables missing -> skipped unavailable, not thrown', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    const err = new Error('relation does not exist'); err.code = 'COMMUNITY_UNAVAILABLE';
    store.getSpaceByKey.mockRejectedValue(err);
    expect(await tithi.publishReleaseNote({ pr: PR_B, release: '2026-11' })).toEqual({ skipped: 'unavailable' });
  });

  // ── The gate: the whole point of this change ──────────────────────────────
  test('non-announce prefix with no brief -> skipped, nothing written (the #195/#217 garbage)', async () => {
    const docsPr = { number: 195, title: 'docs: email journey map', body: 'internal notes' };
    expect(await tithi.publishReleaseNote({ pr: docsPr, release: '2026-11' })).toEqual({ skipped: 'not_announce' });
    expect(store.getPostBySlug).not.toHaveBeenCalled();
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('Community: SKIP -> author_skip, nothing written', async () => {
    const pr = { number: 1, title: 'feat: thing', body: 'Community: SKIP' };
    expect(await tithi.publishReleaseNote({ pr, release: '2026-11' })).toEqual({ skipped: 'author_skip' });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('announce-worthy but no brief + no model -> needsReview, NEVER a raw-title post', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    store.getSpaceByKey.mockResolvedValue({ id: 'updates-space-id' });
    // PR (feat, no Community line); AI is mocked off -> no safe copy.
    const res = await tithi.publishReleaseNote({ pr: PR, release: '2026-11' });
    expect(res).toEqual({ needsReview: true, kind: 'feature', pr: { number: 412, title: PR.title } });
    expect(store.insertPost).not.toHaveBeenCalled();
  });

  test('a chore with a Community brief DOES post (author opt-in)', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    store.getSpaceByKey.mockResolvedValue({ id: 'updates-space-id', key: 'updates' });
    store.insertPost.mockResolvedValue({ id: 'chore-post' });
    const pr = { number: 50, title: 'chore: bump deps', body: 'Community: Everything is a little snappier today.' };
    const res = await tithi.publishReleaseNote({ pr, release: '2026-11' });
    expect(res.posted).toBe(true);
    const [row] = store.insertPost.mock.calls[0];
    expect(row.body).toBe('Everything is a little snappier today.');
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
    expect(botService.askBot).toHaveBeenCalledWith({ question: POST.body, audience: 'host', channel: 'community' });
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

describe('replyToPost — relevance gate (COMMUNITY_REPLY_GATE_ENABLED)', () => {
  const POST = { id: 'p2', author_id: 'member-9', body: 'can you do recurring bookings like Calendly?', slug: 's', status: 'visible', comment_count: 0 };

  beforeEach(() => {
    process.env.COMMUNITY_REPLY_GATE_ENABLED = 'true';
    store.countCommentsByAuthorOnPost.mockResolvedValue(0);
    store.getProfile.mockResolvedValue({ id: 'member-9', is_host: true });
    store.insertComment.mockResolvedValue({ id: 'c9' });
    botService.askBot.mockResolvedValue({ answer: 'Not yet — single bookings only for now.', escalate: false });
    replyGate.appendCta.mockImplementation((a) => a);
  });
  afterEach(() => { delete process.env.COMMUNITY_REPLY_GATE_ENABLED; });

  test('gate says skip → stays silent, no model answer, no comment', async () => {
    replyGate.decide.mockResolvedValue({ act: false, route: 'not_for_us', reason: 'not_a_question' });
    expect(await tithi.replyToPost({ post: POST })).toEqual({ skipped: 'gate', reason: 'not_a_question' });
    expect(botService.askBot).not.toHaveBeenCalled();
    expect(store.insertComment).not.toHaveBeenCalled();
  });

  test('a member already answered → silent, gate not even consulted', async () => {
    replyGate.decide.mockResolvedValue({ act: true, route: 'support' });
    expect(await tithi.replyToPost({ post: { ...POST, comment_count: 1 } })).toEqual({ skipped: 'human_answered' });
    expect(replyGate.decide).not.toHaveBeenCalled();
    expect(botService.askBot).not.toHaveBeenCalled();
  });

  test('comparison intent → grounded answer gets ONE pitch CTA', async () => {
    replyGate.decide.mockResolvedValue({ act: true, route: 'comparison' });
    replyGate.appendCta.mockImplementation((a) => `${a}\n\n[See plans & pricing](/pricing)`);
    const res = await tithi.replyToPost({ post: POST });
    expect(res.replied).toBe(true);
    expect(replyGate.appendCta).toHaveBeenCalledWith('Not yet — single bookings only for now.', 'comparison');
    expect(store.insertComment).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('/pricing') }));
  });

  test("can't ground it → honest community handoff + human tag, escalates", async () => {
    replyGate.decide.mockResolvedValue({ act: true, route: 'feature' });
    botService.askBot.mockResolvedValue({ answer: '', escalate: true, escalateReason: 'no_match' });
    const res = await tithi.replyToPost({ post: POST });
    expect(res).toEqual({ replied: true, commentId: 'c9', escalated: true, tagged: true });
    const [row] = store.insertComment.mock.calls[0];
    expect(row.body).toMatch(/pulling in the team/i);
    expect(row.body).toContain('@team');
    expect(escalationService.recordAndNotify).toHaveBeenCalledTimes(1);
  });
});

describe('replyToComment (Phase 2 — questions in thread comments)', () => {
  const COMMENT = { id: 'cm1', post_id: 'post-1', parent_id: null, author_id: 'member-2', body: 'how do I enable reminders?', status: 'visible' };

  beforeEach(() => {
    process.env.COMMUNITY_REPLY_GATE_ENABLED = 'true';
    store.countRepliesByAuthor.mockResolvedValue(0);
    store.countReplies.mockResolvedValue(0);
    store.getProfile.mockResolvedValue({ id: 'member-2', is_host: false });
    store.insertComment.mockResolvedValue({ id: 'reply-1' });
    botService.askBot.mockResolvedValue({ answer: 'Reminders are on by default.', escalate: false });
    replyGate.decide.mockResolvedValue({ act: true, route: 'support' });
    replyGate.appendCta.mockImplementation((a) => a);
  });
  afterEach(() => { delete process.env.COMMUNITY_REPLY_GATE_ENABLED; });

  test('answers a top-level question, nested under it (parent_id)', async () => {
    const res = await tithi.replyToComment({ comment: COMMENT });
    expect(res).toEqual({ replied: true, commentId: 'reply-1', escalated: false, tagged: false });
    expect(botService.askBot).toHaveBeenCalledWith({ question: COMMENT.body, audience: 'guest', channel: 'community' });
    expect(store.insertComment).toHaveBeenCalledWith(expect.objectContaining({
      post_id: 'post-1', parent_id: 'cm1', author_id: 'tithi-uuid', status: 'visible',
    }));
  });

  test('never answers herself', async () => {
    expect(await tithi.replyToComment({ comment: { ...COMMENT, author_id: 'tithi-uuid' } })).toEqual({ skipped: 'self' });
  });

  test('skips a nested (non-top-level) comment', async () => {
    expect(await tithi.replyToComment({ comment: { ...COMMENT, parent_id: 'other' } })).toEqual({ skipped: 'not_top_level' });
  });

  test('one reply per comment (dedup on Tithi reply)', async () => {
    store.countRepliesByAuthor.mockResolvedValue(1);
    expect(await tithi.replyToComment({ comment: COMMENT })).toEqual({ skipped: 'already_replied' });
    expect(botService.askBot).not.toHaveBeenCalled();
  });

  test('a member already replied → silent', async () => {
    store.countReplies.mockResolvedValue(1);
    expect(await tithi.replyToComment({ comment: COMMENT })).toEqual({ skipped: 'human_answered' });
    expect(replyGate.decide).not.toHaveBeenCalled();
  });

  test('gate silences a non-question comment', async () => {
    replyGate.decide.mockResolvedValue({ act: false, route: 'not_for_us', reason: 'not_a_question' });
    expect(await tithi.replyToComment({ comment: COMMENT })).toEqual({ skipped: 'gate', reason: 'not_a_question' });
    expect(store.insertComment).not.toHaveBeenCalled();
  });

  test("can't ground → honest handoff + human tag, escalates", async () => {
    botService.askBot.mockResolvedValue({ answer: '', escalate: true, escalateReason: 'no_match' });
    const res = await tithi.replyToComment({ comment: COMMENT });
    expect(res).toMatchObject({ replied: true, escalated: true, tagged: true });
    const [row] = store.insertComment.mock.calls[0];
    expect(row.body).toMatch(/pulling in the team/i);
    expect(row.body).toContain('@team');
    expect(escalationService.recordAndNotify).toHaveBeenCalledTimes(1);
  });
});

describe('publishReleaseNote happy path', () => {
  test('posts an announcement into updates as Tithi, deterministic slug, indexable', async () => {
    store.getPostBySlug.mockResolvedValue(null);
    store.getSpaceByKey.mockResolvedValue({ id: 'updates-space-id', key: 'updates' });
    store.insertPost.mockResolvedValue({ id: 'new-post-id' });

    const res = await tithi.publishReleaseNote({ pr: PR_B, release: 'release/2026-11' });

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
