'use strict';

jest.mock('../../../services/community/tithi', () => ({
  publishReleaseNote: jest.fn(),
  replyToPost: jest.fn(),
}));
jest.mock('../../../services/community/store', () => ({ listFeedRows: jest.fn() }));
jest.mock('../../../utils/sendEmail', () => jest.fn());

const tithi = require('../../../services/community/tithi');
const store = require('../../../services/community/store');
const sendEmail = require('../../../utils/sendEmail');
const worker = require('../../../services/community/tithiWorker');

afterEach(() => { jest.clearAllMocks(); delete global.fetch; delete process.env.COMMUNITY_GH_REPO; delete process.env.COMMUNITY_RELEASE_BRANCH; });

describe('releaseBranch', () => {
  test('env override wins', () => {
    process.env.COMMUNITY_RELEASE_BRANCH = 'release/2026-11';
    expect(worker.releaseBranch()).toBe('release/2026-11');
  });
  test('derives release/<YYYY-MM> otherwise', () => {
    expect(worker.releaseBranch()).toMatch(/^release\/\d{4}-\d{2}$/);
  });
});

describe('runReleaseNotePoll', () => {
  test('no repo configured -> clean no-op', async () => {
    expect(await worker.runReleaseNotePoll()).toEqual({ posted: 0, drafted: 0, skipped: 0, scanned: 0 });
    expect(tithi.publishReleaseNote).not.toHaveBeenCalled();
  });

  test('posts one note per recently-merged PR', async () => {
    process.env.COMMUNITY_GH_REPO = 'owner/repo';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { number: 1, title: 'feat: a', body: '', merged_at: new Date().toISOString() },
        { number: 2, title: 'fix: b', body: '', merged_at: null }, // not merged -> filtered
      ],
    });
    tithi.publishReleaseNote.mockResolvedValue({ posted: true });
    const r = await worker.runReleaseNotePoll();
    expect(r).toMatchObject({ posted: 1, scanned: 1 });
    expect(tithi.publishReleaseNote).toHaveBeenCalledTimes(1);
  });

  test('approve-first draft is emailed to the team', async () => {
    process.env.COMMUNITY_GH_REPO = 'owner/repo';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => [{ number: 7, title: 'feat: c', body: '', merged_at: new Date().toISOString() }],
    });
    tithi.publishReleaseNote.mockResolvedValue({ draft: true, kind: 'feature', headline: 'New: c', body: 'coming soon' });
    const r = await worker.runReleaseNotePoll();
    expect(r).toMatchObject({ drafted: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('GitHub error -> no-op, never throws', async () => {
    process.env.COMMUNITY_GH_REPO = 'owner/repo';
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await worker.runReleaseNotePoll()).toMatchObject({ scanned: 0 });
  });
});

describe('runReplySweep', () => {
  test('replies to recent posts, skips stale ones', async () => {
    const now = Date.now();
    store.listFeedRows.mockResolvedValue([
      { id: 'fresh', created_at: new Date(now - 60 * 1000).toISOString() },
      { id: 'stale', created_at: new Date(now - 48 * 60 * 60 * 1000).toISOString() },
    ]);
    tithi.replyToPost.mockResolvedValue({ replied: true, commentId: 'c' });
    const r = await worker.runReplySweep();
    expect(tithi.replyToPost).toHaveBeenCalledTimes(1);
    expect(tithi.replyToPost).toHaveBeenCalledWith({ post: expect.objectContaining({ id: 'fresh' }) });
    expect(r).toEqual({ replied: 1, skipped: 0 });
  });

  test('tables missing -> no-op', async () => {
    const err = new Error('missing'); err.code = 'COMMUNITY_UNAVAILABLE';
    store.listFeedRows.mockRejectedValue(err);
    expect(await worker.runReplySweep()).toEqual({ replied: 0, skipped: 0 });
  });
});
