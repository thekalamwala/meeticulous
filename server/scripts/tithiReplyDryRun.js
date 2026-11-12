/**
 * tithiReplyDryRun.js — READ-ONLY dry run of Tithi's community first-responder GATE.
 *
 * For each recent post and top-level comment, runs the real replyGate.decide() and
 * reports what Tithi WOULD do — answer (with route) or stay silent (with reason) —
 * WITHOUT posting anything, calling askBot, or writing a single row. The safe
 * pre-flip check before setting COMMUNITY_REPLY_GATE_ENABLED=true in production.
 *
 * What it does NOT do (on purpose): it does not ground an answer (no askBot, so no
 * bot_messages rows), it does not dedup against live replies, and it posts nothing.
 * It shows the gate's SELECTION — the "does she pick the right questions" question —
 * which is what the token budget turns on.
 *
 * Run:   node scripts/tithiReplyDryRun.js [--limit=50]
 * Needs: ANTHROPIC_API_KEY (the Haiku triage). Without it every candidate reports
 *        'classify_unavailable'. VOYAGE_API_KEY is NOT used (no grounding here).
 *
 * See the local-run caveat in docs: run from server/ with .env; it only reads.
 */
'use strict';
require('dotenv').config();

const store = require('../services/community/store');
const replyGate = require('../services/community/replyGate');
const anthropicClient = require('../services/ai/anthropicClient');

const arg = (name, def) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : def;
};
const LIMIT = Math.max(1, Number(arg('limit', 50)) || 50);
const snippet = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 70);

// Mirror the cheap pre-gate checks the live path does (visibility, top-level, non-empty)
// before handing a candidate to the relevance gate. Dedup / human-already-answered are
// deliberately NOT applied — this reports the gate's selection, not the live reply state.
async function evalItem(kind, item) {
  if (item.status && item.status !== 'visible') return { decision: 'skip', reason: 'not_visible' };
  if (kind === 'comment' && item.parent_id) return { decision: 'skip', reason: 'not_top_level' };
  if (!String(item.body || '').trim()) return { decision: 'skip', reason: 'empty' };
  const d = await replyGate.decide({ body: item.body });
  return d.act ? { decision: 'answer', route: d.route } : { decision: 'skip', reason: d.reason };
}

async function main() {
  if (!anthropicClient.isConfigured()) {
    console.log('WARNING: ANTHROPIC_API_KEY not set — the triage classifier cannot run; '
      + 'every question-shaped candidate will report classify_unavailable.\n');
  }

  const safeList = (p) => p.catch((e) => {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return [];
    throw e;
  });
  const [posts, comments] = await Promise.all([
    safeList(store.listFeedRows({ cur: null, limit: LIMIT })),
    safeList(store.listRecentTopLevelComments({ limit: LIMIT })),
  ]);

  const tally = { answer: 0, skip: 0, routes: {}, reasons: {} };
  const rows = [];
  for (const [kind, list] of [['post', posts], ['comment', comments]]) {
    for (const item of list || []) {
      const r = await evalItem(kind, item);
      if (r.decision === 'answer') {
        tally.answer += 1;
        tally.routes[r.route] = (tally.routes[r.route] || 0) + 1;
      } else {
        tally.skip += 1;
        tally.reasons[r.reason] = (tally.reasons[r.reason] || 0) + 1;
      }
      rows.push({
        kind, who: item.author_id ? String(item.author_id).slice(0, 8) : '--',
        decision: r.decision, detail: r.route || r.reason, body: snippet(item.body),
      });
    }
  }

  // ANSWER rows first (what she'd actually speak on), then the skips.
  rows.sort((a, b) => (a.decision === b.decision ? 0 : a.decision === 'answer' ? -1 : 1));
  for (const r of rows) {
    const mark = r.decision === 'answer' ? `ANSWER/${r.detail}` : `skip/${r.detail}`;
    console.log(`${r.kind.padEnd(7)} ${r.who}  ${mark.padEnd(28)} ${r.body}`);
  }

  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || '--';
  console.log(`\nScanned ${(posts || []).length} posts + ${(comments || []).length} top-level comments (limit ${LIMIT}).`);
  console.log(`WOULD ANSWER: ${tally.answer}  (${fmt(tally.routes)})`);
  console.log(`WOULD SKIP:   ${tally.skip}  (${fmt(tally.reasons)})`);
  console.log('\nNothing was written: no posts, no answers drafted, no DB changes. '
    + 'Flip COMMUNITY_REPLY_GATE_ENABLED=true to go live.');
}

module.exports = { evalItem, _evalItem: evalItem };

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('Dry run failed:', e.message); process.exit(1); });
}
