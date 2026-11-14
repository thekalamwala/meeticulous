'use strict';

/**
 * institutionalMemory.js — Slice 6. Lets Tithi reuse the team's own prior answers instead
 * of re-deriving everything from the static help docs. At retrieval time she also recalls
 * ANSWERED community questions that match the query and feeds the best answer in as an extra
 * source — so "someone asked this two days ago, here's what we said" becomes part of her
 * grounding. This is how she stops repeating and starts standing on institutional memory.
 *
 * Lean v1: queries the live community tables directly (Postgres full-text via supabase
 * `textSearch` — no new table, no embedding sync, always fresh). Flag-gated + schema-fallback
 * (any error → [], so retrieval degrades to docs-only). Resolved-ticket recall is the
 * documented fast-follow (same shape, over support threads).
 *
 * SAFETY: read-only; returns retrieval chunks exactly like kb_chunks, so the model's
 * grounding + sanitize + citation path is unchanged. Nothing user-specific (public community
 * Q&A only), so it's cache-safe too.
 */

const { isFeatureEnabled } = require('../featureFlags');

const FLAG = 'bot_institutional_memory';
const MAX = 2;            // at most a couple of recalled answers — docs stay primary
const RECALL_RANK = 0.4; // below the strong doc hits, above pure FTS noise

// Prior ANSWERED community questions matching the query, each with its first answer, shaped
// as retrieval chunks. Never throws (missing tables / bad query → []).
async function recallCommunity(queryText, limit = MAX) {
  const q = String(queryText || '').trim();
  if (q.length < 6) return [];
  let supabaseAdmin;
  try { ({ supabaseAdmin } = require('../../config/supabase')); } catch (_) { return []; }
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('community_posts')
      .select('id, title, body, status, comment_count')
      .eq('status', 'visible')
      .gt('comment_count', 0) // answered only
      .textSearch('body', q, { type: 'websearch', config: 'english' })
      .limit(limit);
    if (error || !posts || !posts.length) return [];

    const chunks = [];
    for (const p of posts) {
      // Best answer = the earliest visible top-level comment (the first-responder's reply).
      const { data: ans } = await supabaseAdmin
        .from('community_comments')
        .select('body')
        .eq('post_id', p.id)
        .is('parent_id', null)
        .eq('status', 'visible')
        .order('created_at', { ascending: true })
        .limit(1);
      const answer = ans && ans[0] && String(ans[0].body || '').trim();
      if (!answer) continue;
      const asked = String(p.body || p.title || '').trim();
      if (!asked) continue;
      chunks.push({
        source_file: 'community', // citations read as "a past community answer", not a doc
        heading: (p.title || asked).slice(0, 80),
        content: `A member previously asked: ${asked.slice(0, 300)}\nThe answer given was: ${answer.slice(0, 500)}`,
        rank: RECALL_RANK,
      });
    }
    return chunks;
  } catch (_) {
    return [];
  }
}

// The retrieval hook. Flag OFF (or any failure) → [] → retrieval is docs-only, unchanged.
async function recall(queryText, limit = MAX) {
  if (!(await isFeatureEnabled(FLAG))) return [];
  return recallCommunity(queryText, limit);
}

module.exports = { recall, recallCommunity, FLAG };
