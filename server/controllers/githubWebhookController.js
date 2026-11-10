'use strict';
/**
 * githubWebhookController — GitHub `pull_request` webhook that drives Tithi's
 * release notes INSTANTLY, instead of the 5-minute poll.
 *
 * Why this exists: the poll (server.js setInterval → tithiWorker.runReleaseNotePoll)
 * never fires reliably on Render's free plan — the instance spins down when idle,
 * so the timer sleeps with it and merged PRs are never picked up. A webhook is
 * push-based: GitHub POSTs on merge, which also wakes the instance, so a release
 * note posts within seconds of the merge. The poll stays as a catch-up safety net.
 *
 * Verifies X-Hub-Signature-256 over the RAW body (express.raw mount in server.js),
 * then on a PR merged into a `release/**` branch hands it to the SAME
 * tithiWorker.handleMergedPr the poll uses (publish, or draft-and-email when
 * COMMUNITY_TITHI_AUTOPOST != 'true'). Idempotent: tithi.js dedups on its slug.
 *
 * Env:
 *   GITHUB_WEBHOOK_SECRET      — verifies the POST signature (set the same value in
 *                                the GitHub repo webhook's "Secret" field)
 *   COMMUNITY_TITHI_USER_ID    — the profile Tithi posts as (else skipped 'no_identity')
 *   COMMUNITY_TITHI_AUTOPOST   — 'true' = post live; anything else = draft-and-email
 * Plus the community_tithi flag must be ON (it is).
 *
 * 401 only on a bad/absent signature; 503 when unconfigured; otherwise 200 with a
 * short reason so GitHub's "Recent Deliveries" shows exactly what happened.
 */
const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const tithiWorker = require('../services/community/tithiWorker');

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256(rawBody, secret), hex. Constant-time.
function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(String(header));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleGithubWebhook(req, res) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: 'webhook not configured' });

    // req.body is a Buffer (express.raw). Sign over the exact bytes received.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    if (!verifySignature(raw, req.headers['x-hub-signature-256'], secret)) {
      return res.status(401).json({ message: 'invalid signature' });
    }

    // GitHub pings the webhook once on creation — ack so the delivery shows green.
    const event = req.headers['x-github-event'];
    if (event === 'ping') return res.json({ ok: true, pong: true });
    if (event !== 'pull_request') return res.json({ ok: true, ignored: 'event' });

    let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).json({ message: 'bad json' }); }

    const prd = evt.pull_request;
    if (evt.action !== 'closed' || !prd || !prd.merged || !prd.number) {
      return res.json({ ok: true, ignored: 'not-merged' });
    }
    // Only release trains get notes — the poll uses releaseBranch() (release/YYYY-MM).
    const base = prd.base && prd.base.ref;
    if (!base || !/^release\//.test(base)) {
      return res.json({ ok: true, ignored: 'not-release-branch' });
    }

    const pr = { number: prd.number, title: prd.title || '', body: prd.body || '' };

    // Ack immediately; the note (LLM classify + write) runs after responding so a
    // slow model call can never trip GitHub's 10s webhook timeout/retry.
    res.json({ ok: true, received: `pr-${pr.number}` });

    try {
      const r = await tithiWorker.handleMergedPr(pr, base);
      if (r.posted) console.log(`Tithi webhook: posted release note for PR #${pr.number} (${r.kind})`);
      else if (r.draft) console.log(`Tithi webhook: drafted + emailed PR #${pr.number} (autopost off)`);
      else console.log(`Tithi webhook: skipped PR #${pr.number} (${r.skipped})`);
    } catch (e) {
      console.error('[github-webhook] release-note publish failed (non-fatal):', pr.number, e.message);
    }
  } catch (e) { safeError(res, e); }
}

module.exports = { handleGithubWebhook, _internal: { verifySignature } };
