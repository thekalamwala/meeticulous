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
const { isFeatureEnabled } = require('../featureFlags');

const FLAG = 'community_tithi';
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

// Email the team about a PR Tithi did NOT auto-post. Two shapes:
//   draft       — approve-first mode: a finished note to review and post manually.
//   needsReview — announce-worthy PR with no safe copy (no Community brief + model down/
//                 over budget). We refuse to post a raw dev title, so the team adds a
//                 `Community:` line to the PR body, or writes the note by hand.
async function emailDraft(pr, res) {
  try {
    if (res.needsReview) {
      await sendEmail({
        to: SUPPORT_EMAIL,
        subject: `[Tithi] Needs a community note — PR #${pr.number}`,
        html: `<p>PR #${pr.number} (${res.kind}) is announce-worthy but Tithi couldn't write a safe note `
          + '(no <code>Community:</code> line in the PR body, and the model was unavailable or over budget). '
          + 'It was <b>not posted</b> — nothing raw ships under Tithi\'s name.</p>'
          + `<p><b>${String(pr.title || '').replace(/[<>&]/g, '')}</b></p>`
          + '<p style="color:#888">Add a <code>Community:</code> line to the PR body and re-run, or post a note by hand.</p>',
      });
      return;
    }
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Tithi] Release-note draft — ${res.headline}`,
      html: `<p>Tithi drafted a release note for PR #${pr.number} (${res.kind}). Review and post if good:</p>`
        + `<h3>${res.headline}</h3><p>${String(res.body).replace(/\n/g, '<br>')}</p>`
        + '<p style="color:#888">Auto-posting is off (COMMUNITY_TITHI_AUTOPOST). Set it to true once you trust the notes.</p>',
    });
  } catch (_) { /* best-effort */ }
}

// Publish one merged PR's release note (or draft-and-email in approve-first mode).
// The single entry point for BOTH the poll and the instant GitHub webhook, so the
// AUTOPOST gate + draft email behave identically no matter what triggered it.
async function handleMergedPr(pr, release) {
  const res = await tithi.publishReleaseNote({ pr, release, approveFirst: !AUTOPOST });
  if (res.draft || res.needsReview) await emailDraft(pr, res);
  return res;
}

// The release train merged into main (prod deploy). Post the "it's live" rollup note.
// Always publishes (no approve-first): a deploy already happened, so there's nothing
// to hold for approval. Idempotent via tithi's ship-PR slug.
async function handleDeployment(pr, release) {
  return tithi.publishDeploymentNote({ pr, release });
}

/** Poll merged release PRs → publish (or draft-and-email) one note each. */
async function runReleaseNotePoll() {
  const branch = releaseBranch();
  const prs = await fetchMergedPrs(branch);
  let posted = 0; let drafted = 0; let skipped = 0;
  for (const pr of prs) {
    const res = await handleMergedPr(pr, branch);
    if (res.posted) posted += 1;
    else if (res.draft || res.needsReview) drafted += 1;
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
  // Gate on: bound the cost of a tick and don't let one member soak every reply.
  // Gate off: legacy behaviour — no cap, one pass over the window.
  const gateOn = process.env.COMMUNITY_REPLY_GATE_ENABLED === 'true';
  const maxReplies = gateOn ? (Number(process.env.COMMUNITY_REPLY_MAX_PER_SWEEP) || 5) : Infinity;
  const repliedAuthors = new Set(); // at most one reply per author per sweep (gate on)
  let replied = 0; let skipped = 0;
  for (const post of rows || []) {
    if (replied >= maxReplies) break;
    if (new Date(post.created_at).getTime() < minTs) continue; // too old to first-respond
    if (gateOn && post.author_id && repliedAuthors.has(post.author_id)) { skipped += 1; continue; }
    const res = await tithi.replyToPost({ post });
    if (res.replied) { replied += 1; if (post.author_id) repliedAuthors.add(post.author_id); }
    else skipped += 1;
  }

  // Phase 2 (gate-on only): questions asked as top-level comments, so one buried in a
  // thread also gets Tithi. Legacy behaviour never answered comments, so this whole
  // pass stays dark until the gate is enabled. Shares the per-sweep reply budget.
  if (gateOn) {
    let comments = [];
    try {
      comments = await store.listRecentTopLevelComments({ limit: SWEEP_LIMIT });
    } catch (e) {
      if (e.code !== 'COMMUNITY_UNAVAILABLE') throw e;
    }
    for (const comment of comments || []) {
      if (replied >= maxReplies) break;
      if (new Date(comment.created_at).getTime() < minTs) continue; // too old to first-respond
      if (comment.author_id && repliedAuthors.has(comment.author_id)) { skipped += 1; continue; }
      const res = await tithi.replyToComment({ comment });
      if (res.replied) { replied += 1; if (comment.author_id) repliedAuthors.add(comment.author_id); }
      else skipped += 1;
    }
  }

  return { replied, skipped };
}

// ── Nightly founder digest ────────────────────────────────────────────────────
// A reads-only snapshot of the community for the founder, from ONE feed query: new
// member posts, how many Tithi handled, what's still unanswered, and what Tithi posted.
// Emailed to the team. Flag-gated so it's silent before launch.
const DIGEST_SCAN = 60;
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function runDailyDigest() {
  if (!(await isFeatureEnabled(FLAG))) return { skipped: 'flag_off' };
  let rows;
  try {
    rows = await store.listFeedRows({ cur: null, limit: DIGEST_SCAN });
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return { skipped: 'unavailable' };
    throw e;
  }
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const tithiId = tithi._tithiUserId();
  const recent = (rows || []).filter((r) => new Date(r.created_at).getTime() >= dayAgo);
  const memberPosts = recent.filter((r) => r.author_id !== tithiId);
  const tithiPosts = recent.filter((r) => r.author_id === tithiId);
  // comment_count is trigger-kept; 0 = no reply at all (a Tithi reply makes it ≥ 1).
  const unanswered = memberPosts.filter((r) => (r.comment_count || 0) === 0);

  const metrics = { newPosts: memberPosts.length, tithiPosts: tithiPosts.length, unanswered: unanswered.length };
  try {
    const list = unanswered.slice(0, 10)
      .map((r) => `<li><a href="/community/${r.kind === 'thread' ? 't' : 'p'}/${esc(r.slug)}">${esc(r.title || r.body || '(post)').slice(0, 80)}</a></li>`)
      .join('') || '<li>Nothing unanswered — nice.</li>';
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Tithi] Daily community digest — ${metrics.newPosts} new, ${metrics.unanswered} unanswered`,
      html: `<h2>Community — last 24h</h2>`
        + `<p>${metrics.newPosts} new member posts · ${metrics.tithiPosts} Tithi posts · ${metrics.unanswered} still unanswered.</p>`
        + `<h3>Unanswered</h3><ul>${list}</ul>`,
    });
  } catch (_) { /* digest email is best-effort */ }
  return metrics;
}

module.exports = {
  runReleaseNotePoll, runReplySweep, runDailyDigest, handleMergedPr, handleDeployment,
  releaseBranch, fetchMergedPrs, _AUTOPOST: AUTOPOST,
};
