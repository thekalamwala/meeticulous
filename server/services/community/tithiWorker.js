'use strict';
// tithiWorker.js — the poll jobs that drive Tithi. Two workers, both no-ops until
// configured, all gated by the OFF community_tithi flag inside tithi.*:
//
//   runReleaseNotePoll — finds PRs merged onto the open release branch and posts (or,
//     in approve-first mode, emails the team) a human release note. Dedup is tithi.js's
//     deterministic slug, so a generous look-back window can't double-post.
//   runReplySweep — first-responds to recent member posts that Tithi hasn't answered.
//
// GitHub is read over the public REST API (optional token lifts the rate limit). No repo
// configured, or the fetch fails → [] → the poll is a clean no-op. Mirrors the AiSensy /
// activation-nudge "seeded but inert until the founder wires it" pattern.

const tithi = require('./tithi');
const store = require('./store');
const sendEmail = require('../../utils/sendEmail');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'team@meeticulous.com';
// Auto-post release notes, or draft-and-email for approval first (default: approve-first).
const AUTOPOST = process.env.COMMUNITY_TITHI_AUTOPOST === 'true';
// Only consider PRs merged within this window (dedup still guards older ones).
const MERGE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
// How many recent posts a reply sweep scans; replyToPost dedups/skips the rest.
const SWEEP_LIMIT = 20;
// Don't first-respond to posts older than this (a late reply reads as a bot trawling).
const SWEEP_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Current open release branch: explicit env, else derive release/<this month>.
function releaseBranch() {
  if (process.env.COMMUNITY_RELEASE_BRANCH) return process.env.COMMUNITY_RELEASE_BRANCH;
  const d = new Date();
  return `release/${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Recently-merged PRs on `branch`, newest first. Best-effort: [] on no-repo / any error.
async function fetchMergedPrs(branch) {
  const repo = process.env.COMMUNITY_GH_REPO; // "owner/name"
  if (!repo || typeof fetch !== 'function') return [];
  try {
    const url = `https://api.github.com/repos/${repo}/pulls?state=closed&base=${encodeURIComponent(branch)}`
      + '&sort=updated&direction=desc&per_page=30';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'meeticulous-tithi' };
    if (process.env.COMMUNITY_GH_TOKEN) headers.Authorization = `Bearer ${process.env.COMMUNITY_GH_TOKEN}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return [];
    const list = await resp.json();
    const since = Date.now() - MERGE_LOOKBACK_MS;
    return (Array.isArray(list) ? list : [])
      .filter((p) => p.merged_at && new Date(p.merged_at).getTime() >= since)
      .map((p) => ({ number: p.number, title: p.title || '', body: p.body || '' }));
  } catch (_) {
    return [];
  }
}

// Email a drafted release note to the team for manual posting (approve-first mode).
async function emailDraft(pr, draft) {
  try {
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Tithi] Release-note draft — ${draft.headline}`,
      html: `<p>Tithi drafted a release note for PR #${pr.number} (${draft.kind}). Review and post if good:</p>`
        + `<h3>${draft.headline}</h3><p>${String(draft.body).replace(/\n/g, '<br>')}</p>`
        + '<p style="color:#888">Auto-posting is off (COMMUNITY_TITHI_AUTOPOST). Set it to true once you trust the notes.</p>',
    });
  } catch (_) { /* best-effort */ }
}

/** Poll merged release PRs → publish (or draft-and-email) one note each. */
async function runReleaseNotePoll() {
  const branch = releaseBranch();
  const prs = await fetchMergedPrs(branch);
  let posted = 0; let drafted = 0; let skipped = 0;
  for (const pr of prs) {
    const res = await tithi.publishReleaseNote({ pr, release: branch, approveFirst: !AUTOPOST });
    if (res.posted) posted += 1;
    else if (res.draft) { drafted += 1; await emailDraft(pr, res); }
    else skipped += 1;
  }
  return { posted, drafted, skipped, scanned: prs.length };
}

/** First-respond to recent member posts Tithi hasn't answered yet. */
async function runReplySweep() {
  let rows;
  try {
    rows = await store.listFeedRows({ cur: null, limit: SWEEP_LIMIT });
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return { replied: 0, skipped: 0 };
    throw e;
  }
  const minTs = Date.now() - SWEEP_MAX_AGE_MS;
  let replied = 0; let skipped = 0;
  for (const post of rows || []) {
    if (new Date(post.created_at).getTime() < minTs) continue; // too old to first-respond
    const res = await tithi.replyToPost({ post });
    if (res.replied) replied += 1; else skipped += 1;
  }
  return { replied, skipped };
}

module.exports = { runReleaseNotePoll, runReplySweep, releaseBranch, fetchMergedPrs, _AUTOPOST: AUTOPOST };
