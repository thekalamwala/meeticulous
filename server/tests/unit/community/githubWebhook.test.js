'use strict';
/**
 * GitHub pull_request webhook → Tithi release notes. Security-critical bits:
 * X-Hub-Signature-256 verification, and the merge/release-branch gating that
 * decides whether a merged PR is handed to tithiWorker.handleMergedPr.
 */
const crypto = require('crypto');

jest.mock('../../../services/community/tithiWorker', () => ({ handleMergedPr: jest.fn(), handleDeployment: jest.fn() }));
const tithiWorker = require('../../../services/community/tithiWorker');
const { handleGithubWebhook, _internal: { verifySignature } } = require('../../../controllers/githubWebhookController');

const SECRET = 'hook-secret';
const sign = (body, s = SECRET) => 'sha256=' + crypto.createHmac('sha256', s).update(body).digest('hex');

const mockReq = (bodyObj, { event = 'pull_request', badSig = false } = {}) => {
  const raw = Buffer.from(JSON.stringify(bodyObj));
  return {
    body: raw,
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': badSig ? sign(raw.toString(), 'wrong') : sign(raw.toString()),
    },
  };
};
const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const merged = (base = 'release/2026-11', head = 'feat/x') => ({
  action: 'closed',
  pull_request: { merged: true, number: 42, title: 'feat: thing', body: 'b', base: { ref: base }, head: { ref: head } },
});

beforeEach(() => { process.env.GITHUB_WEBHOOK_SECRET = SECRET; });
afterEach(() => { jest.clearAllMocks(); delete process.env.GITHUB_WEBHOOK_SECRET; });

describe('verifySignature', () => {
  const body = JSON.stringify({ a: 1 });
  test('accepts correct, rejects tampered / wrong-secret / missing', () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
    expect(verifySignature(body + 'x', sign(body), SECRET)).toBe(false);
    expect(verifySignature(body, sign(body, 'other'), SECRET)).toBe(false);
    expect(verifySignature(body, undefined, SECRET)).toBe(false);
  });
});

describe('handleGithubWebhook', () => {
  test('503 when unconfigured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const res = mockRes();
    await handleGithubWebhook(mockReq(merged()), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(tithiWorker.handleMergedPr).not.toHaveBeenCalled();
  });

  test('401 on a bad signature', async () => {
    const res = mockRes();
    await handleGithubWebhook(mockReq(merged(), { badSig: true }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(tithiWorker.handleMergedPr).not.toHaveBeenCalled();
  });

  test('ignores non-merged PRs', async () => {
    const res = mockRes();
    const body = { action: 'closed', pull_request: { merged: false, number: 7, base: { ref: 'release/2026-11' } } };
    await handleGithubWebhook(mockReq(body), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: 'not-merged' }));
    expect(tithiWorker.handleMergedPr).not.toHaveBeenCalled();
  });

  test('ignores a feature merge to main (not a release ship)', async () => {
    const res = mockRes();
    await handleGithubWebhook(mockReq(merged('main', 'feat/x')), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: 'not-release-merge' }));
    expect(tithiWorker.handleMergedPr).not.toHaveBeenCalled();
    expect(tithiWorker.handleDeployment).not.toHaveBeenCalled();
  });

  test('publishes a per-feature note for a PR merged into release/**', async () => {
    tithiWorker.handleMergedPr.mockResolvedValue({ posted: true, kind: 'feature' });
    const res = mockRes();
    await handleGithubWebhook(mockReq(merged('release/2026-11', 'feat/x')), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: 'pr-42', kind: 'release' }));
    expect(tithiWorker.handleMergedPr).toHaveBeenCalledWith(
      { number: 42, title: 'feat: thing', body: 'b' }, 'release/2026-11',
    );
  });

  test('publishes a deploy note when release/** merges into main', async () => {
    tithiWorker.handleDeployment.mockResolvedValue({ posted: true });
    const res = mockRes();
    await handleGithubWebhook(mockReq(merged('main', 'release/2026-11')), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: 'pr-42', kind: 'deploy' }));
    expect(tithiWorker.handleDeployment).toHaveBeenCalledWith(
      { number: 42, title: 'feat: thing', body: 'b' }, 'release/2026-11',
    );
    expect(tithiWorker.handleMergedPr).not.toHaveBeenCalled();
  });
});
