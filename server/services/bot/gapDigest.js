'use strict';

/**
 * gapDigest.js — Slice 8. The closed learning loop. logGap already records every question
 * Tithi couldn't answer (knowledge_gaps, reason='escalated'), but nothing acted on them —
 * they died in a table. This weekly job CLUSTERS the recent misses into themes, ranks them
 * by how often they came up, drafts a help-doc stub for the top one, and emails the team —
 * so the KB's gaps turn into the KB's next entries and Tithi compounds week over week.
 *
 * Flag `bot_gap_digest` (default OFF, fail-closed). Read-only except the digest email.
 * Clustering is a cheap keyword signature (no embeddings); the stub is a best-effort Haiku
 * draft, budget-gated. Everything fails soft.
 */

const { isFeatureEnabled } = require('../featureFlags');
const anthropicClient = require('../ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const sendEmail = require('../../utils/sendEmail');

const FLAG = 'bot_gap_digest';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'team@meeticulous.com';
const WINDOW_DAYS = 7;
const MAX_THEMES = 8;

const STOP = new Set([
  'how', 'what', 'why', 'can', 'does', 'did', 'the', 'and', 'for', 'are', 'was', 'with', 'you', 'your',
  'this', 'that', 'from', 'have', 'has', 'not', 'but', 'will', 'would', 'should', 'could', 'when', 'where',
  'who', 'about', 'into', 'our', 'out', 'get', 'got', 'any', 'all', 'they', 'them', 'there', 'here', 'been',
  'much', 'many', 'some', 'need', 'want', 'please', 'help', 'able', 'meeticulous',
]);

// Coarse keyword signature: unique significant words, sorted — so "where is my payout" and
// "my payout hasn't arrived" land in the same bucket. Deliberately simple + explainable.
function sigOf(question) {
  const words = String(question || '').toLowerCase().match(/[a-z]+/g) || [];
  const sig = [...new Set(words.filter((w) => w.length > 3 && !STOP.has(w)))].sort();
  return sig.slice(0, 6).join(' ');
}

// clusterGaps(rows) → [{ sig, count, sample, questions }] ranked by count desc. Pure.
function clusterGaps(rows = []) {
  const groups = new Map();
  for (const r of rows) {
    const q = r && r.question && String(r.question).trim();
    if (!q) continue;
    const sig = sigOf(q);
    if (!sig) continue;
    if (!groups.has(sig)) groups.set(sig, { sig, count: 0, sample: q, questions: [] });
    const g = groups.get(sig);
    g.count += 1;
    if (g.questions.length < 5) g.questions.push(q);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// Best-effort Haiku draft of a help-doc stub for one theme. Null on no key / over budget / error.
async function draftStub(theme) {
  if (!theme || !anthropicClient.isConfigured()) return null;
  const budget = await botBudget.tryConsume();
  if (!budget.allowed) return null;
  try {
    const resp = await anthropicClient.getClient().messages.create({
      model: anthropicClient.MODELS.generate,
      max_tokens: 400,
      system: 'You draft a short help-doc stub for Meeticulous (a booking platform) from real support questions it could not answer. '
        + 'Write a clear heading as a question and a 2–4 sentence plain-English answer a support teammate can verify and publish. '
        + 'If the questions are too vague to answer, say "NEEDS A HUMAN" and nothing else. Do not invent specifics.',
      messages: [{ role: 'user', content: `Questions we could not answer:\n- ${theme.questions.join('\n- ')}` }],
    });
    const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text && !/^NEEDS A HUMAN$/i.test(text) ? text : null;
  } catch (_) {
    return null;
  }
}

const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function emailDigest(themes, stub, totalGaps) {
  const list = themes
    .map((t) => `<li><b>${t.count}×</b> — ${esc(t.sample).slice(0, 120)}</li>`)
    .join('');
  const stubBlock = stub
    ? `<h3>Suggested stub for the top theme</h3><p style="white-space:pre-wrap">${esc(stub)}</p>`
      + '<p style="color:#888">Verify + publish into docs/help if it\'s right.</p>'
    : '';
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Tithi] ${themes.length} unanswered themes this week (${totalGaps} misses)`,
    html: `<h2>What Tithi couldn't answer — last ${WINDOW_DAYS} days</h2>`
      + `<p>${totalGaps} escalations, clustered into ${themes.length} themes (most frequent first):</p>`
      + `<ul>${list}</ul>${stubBlock}`,
  });
}

// The weekly job. Flag-gated; fails soft; the digest email is best-effort.
async function runGapDigest(now = new Date()) {
  if (!(await isFeatureEnabled(FLAG))) return { skipped: 'flag_off' };
  let rows;
  try {
    const { supabaseAdmin } = require('../../config/supabase');
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('knowledge_gaps')
      .select('question, reason, created_at')
      .eq('reason', 'escalated')
      .gte('created_at', since)
      .limit(500);
    if (error) return { skipped: 'unavailable' };
    rows = data || [];
  } catch (_) {
    return { skipped: 'unavailable' };
  }
  const themes = clusterGaps(rows).slice(0, MAX_THEMES);
  if (!themes.length) return { themes: 0, gaps: rows.length };
  const stub = await draftStub(themes[0]);
  try { await emailDigest(themes, stub, rows.length); } catch (_) { /* best-effort */ }
  return { themes: themes.length, gaps: rows.length, drafted: !!stub };
}

module.exports = { runGapDigest, clusterGaps, sigOf, draftStub, FLAG };
