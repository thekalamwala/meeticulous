'use strict';
/**
 * seedBotFaqs.js — version-controlled source of truth for the Bolt FAQ layer
 * (the `bot_faqs` table). Reads scripts/data/botFaqs.json and clears + reinserts,
 * so a re-run is idempotent and the repo file is authoritative on BOTH DBs.
 *
 * Governance (2026-08-31): bot_faqs is curated HERE, not grown from thumbs-up
 * feedback (auto-promotion is gated off in botService.recordFeedback). To change an
 * FAQ: edit botFaqs.json, open a PR, and re-run this on prod + staging. This replaced
 * an ad-hoc, prod-only, admin-console-edited table that had accumulated duplicate,
 * stale, and unsafe (slur-echo) rows.
 *
 * Run:        node scripts/seedBotFaqs.js
 * Self-check: node scripts/seedBotFaqs.js --check   (validates the JSON, no DB)
 * Mirrors scripts/seedKnowledgeBase.js / scripts/seedEmailTemplates.js.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, 'data', 'botFaqs.json');

// Load + validate the curated FAQ set. Throws (loudly) on a malformed file, a row
// missing pattern/answer, a duplicate pattern, or any abuse/slur pattern — abuse is
// handled by abuseGuard, never by a canned FAQ, so those must never be seeded.
function load() {
  const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (!Array.isArray(rows) || !rows.length) throw new Error('botFaqs.json is empty or not an array');
  const seen = new Set();
  const BANNED = /\b(nigga|fuck|bitch|chutiya|gadha)\b/i;
  for (const r of rows) {
    if (!r.pattern || !String(r.pattern).trim()) throw new Error(`row missing pattern: ${JSON.stringify(r)}`);
    if (!r.answer || !String(r.answer).trim()) throw new Error(`row missing answer for pattern "${r.pattern}"`);
    const key = String(r.pattern).toLowerCase().trim();
    if (seen.has(key)) throw new Error(`duplicate pattern: "${r.pattern}"`);
    if (BANNED.test(r.pattern)) throw new Error(`abuse/slur pattern must not be seeded: "${r.pattern}"`);
    seen.add(key);
  }
  return rows.map((r) => ({
    pattern: String(r.pattern),
    answer: String(r.answer),
    enabled: r.enabled !== false,
    category: r.category || 'General',
  }));
}

async function main() {
  const { supabaseAdmin } = require('../config/supabase');
  const rows = load();
  const { error: delErr } = await supabaseAdmin.from('bot_faqs').delete().not('id', 'is', null);
  if (delErr) throw new Error(`clear bot_faqs: ${delErr.message}`);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin.from('bot_faqs').insert(rows.slice(i, i + 200));
    if (error) throw new Error(`insert batch @${i}: ${error.message}`);
  }
  console.log(`Seeded ${rows.length} bot_faqs rows.`);
}

if (process.argv.includes('--check')) {
  const rows = load();
  const assert = require('assert');
  assert.ok(rows.length >= 20, 'expected a non-trivial curated FAQ set');
  assert.ok(rows.every((r) => r.pattern && r.answer), 'every row needs a pattern + answer');
  console.log(`seedBotFaqs self-check passed (${rows.length} rows).`);
} else {
  main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
}
