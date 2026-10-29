/**
 * seedKnowledgeBase.js — walk docs/help/, split each markdown file into
 * heading-scoped chunks (~300–800 words), and clear + reinsert kb_chunks so a
 * re-run is idempotent. Powers the "Bolt 958" support bot's Postgres full-text
 * retrieval (v3.83).
 *
 * Corpus is docs/help/ ONLY — user-facing help articles, never the internal dev
 * docs (schema, specs, playbooks). Seeding dev docs made the bot retrieve
 * developer content for guest questions and over-escalate; help-only is the fix.
 * Anything a guest or host could read is fair game; nothing internal goes in here.
 *
 * Run:        node scripts/seedKnowledgeBase.js
 * Self-check: node scripts/seedKnowledgeBase.js --check   (chunker asserts, no DB)
 *
 * Re-run manually whenever docs/help/ changes. Mirrors scripts/seedEmailTemplates.js.
 */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '../../docs/help');
const MIN_WORDS = 300;
const MAX_WORDS = 800;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

// Strip an optional YAML front-matter block (--- … ---) from the top of a doc so
// maintenance metadata (last_verified, etc.) is never chunked into kb_chunks.
// No-op when a file has no front-matter. Mirrors client/src/content/helpDocs.js.
const stripFrontmatter = (s) => s.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

// Split markdown into { heading, body } sections. Heading detection ignores `#`
// lines inside fenced code blocks (bash comments would otherwise look like H1s).
function toSections(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let cur = { heading: null, body: [] };
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(HEADING_RE);
    if (m) {
      if (cur.heading !== null || cur.body.join('').trim()) sections.push(cur);
      cur = { heading: m[2].trim(), body: [] };
    } else {
      cur.body.push(line);
    }
  }
  if (cur.heading !== null || cur.body.join('').trim()) sections.push(cur);
  return sections;
}

// Greedy-pack sections into chunks of ~MIN..MAX words; a single oversize section
// body is split on blank lines (paragraphs). Each chunk keeps the nearest heading.
function chunkMarkdown(md) {
  const sections = toSections(md);
  const chunks = [];
  let buf = null; // { heading, text, words }

  const flush = () => { if (buf && buf.text.trim()) chunks.push({ heading: buf.heading, content: buf.text.trim() }); buf = null; };

  for (const sec of sections) {
    const bodyText = sec.body.join('\n').trim();
    const secText = (sec.heading ? `## ${sec.heading}\n` : '') + bodyText;
    const secWords = wordCount(secText);

    if (secWords > MAX_WORDS) {
      flush();
      const paras = bodyText.split(/\n\s*\n/);
      let part = '';
      for (const p of paras) {
        if (wordCount(part) + wordCount(p) > MAX_WORDS && part.trim()) {
          chunks.push({ heading: sec.heading, content: (part.trim()) });
          part = '';
        }
        part += (part ? '\n\n' : '') + p;
      }
      if (part.trim()) chunks.push({ heading: sec.heading, content: part.trim() });
      continue;
    }

    if (!buf) { buf = { heading: sec.heading, text: secText, words: secWords }; continue; }
    if (buf.words + secWords > MAX_WORDS) { flush(); buf = { heading: sec.heading, text: secText, words: secWords }; continue; }
    buf.text += '\n\n' + secText;
    buf.words += secWords;
    if (buf.words >= MIN_WORDS) flush();
  }
  flush();
  return chunks.filter((c) => c.content.length > 0);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function selfCheck() {
  const assert = require('assert');
  // Bash comment inside a fence must NOT split into its own heading.
  const md = '# Title\n\nintro para.\n\n```bash\n# not a heading\nnpm run dev\n```\n\n## Real Heading\n\nbody text here.';
  const secs = toSections(md);
  assert.deepStrictEqual(secs.map((s) => s.heading), ['Title', 'Real Heading'], 'fence comment leaked as heading');
  // Oversize section splits into multiple chunks; small doc yields >=1 chunk.
  const big = '# Big\n\n' + Array.from({ length: 20 }, (_, i) => `Para ${i} ` + 'word '.repeat(60)).join('\n\n');
  const chunks = chunkMarkdown(big);
  assert.ok(chunks.length > 1, 'oversize section did not split');
  assert.ok(chunks.every((c) => c.content.length), 'empty chunk emitted');
  assert.ok(chunkMarkdown('# H\n\nshort.').length === 1, 'tiny doc should still yield one chunk');
  // Front-matter is stripped before chunking; a doc with it yields the same as without.
  assert.strictEqual(stripFrontmatter('---\nlast_verified: 2026-08-31\n---\n# T\n\nx.'), '# T\n\nx.', 'front-matter not stripped');
  assert.strictEqual(stripFrontmatter('# T\n\nx.'), '# T\n\nx.', 'front-matter strip mangled a plain doc');
  console.log('seedKnowledgeBase self-check passed.');
}

async function main() {
  const { supabaseAdmin } = require('../config/supabase');
  const crypto = require('crypto');
  const files = walk(DOCS_DIR);
  const rows = [];
  const perFile = [];
  const fileHashes = {}; // source_file → sha1(content), for version-aware cache invalidation
  for (const file of files) {
    const rel = path.relative(path.resolve(__dirname, '../..'), file).replace(/\\/g, '/');
    const raw = stripFrontmatter(fs.readFileSync(file, 'utf8'));
    fileHashes[rel] = crypto.createHash('sha1').update(raw).digest('hex');
    const chunks = chunkMarkdown(raw);
    for (const c of chunks) rows.push({ source_file: rel, heading: c.heading, content: c.content });
    perFile.push([rel, chunks.length]);
  }

  // Embed each chunk for semantic retrieval (SIE phase B). Best-effort: with no
  // VOYAGE_API_KEY the embedding column stays NULL and the bot runs FTS-only until
  // reseeded with a key. Heading is prepended so the vector reflects the topic too.
  const voyageClient = require('../services/ai/voyageClient');
  if (voyageClient.isConfigured() && rows.length) {
    const texts = rows.map((r) => (r.heading ? `${r.heading}\n` : '') + r.content);
    const vectors = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = await voyageClient.embed(texts.slice(i, i + 100), 'document');
      vectors.push(...(batch || []));
    }
    rows.forEach((r, i) => { if (vectors[i]) r.embedding = vectors[i]; });
    console.log(`Embedded ${vectors.length} chunks (voyage ${voyageClient.MODEL}).`);
  } else {
    console.log('VOYAGE_API_KEY not set — seeding text only (embeddings NULL; FTS-only until reseeded with a key).');
  }

  // Clear + reinsert so the script is fully idempotent/rerunnable.
  const { error: delErr } = await supabaseAdmin.from('kb_chunks').delete().not('id', 'is', null);
  if (delErr) throw new Error(`clear kb_chunks: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from('kb_chunks').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`insert batch @${i}: ${error.message}`);
  }

  // Version-aware cache invalidation (SIE phase C): expire ONLY the cached answers
  // whose source doc actually changed (or was removed) — never the whole cache.
  // Best-effort: if the v3.86/v3.87 tables aren't there yet, just skip.
  try {
    const { data: prevVersions } = await supabaseAdmin.from('bot_doc_versions').select('source_file, content_hash');
    const prev = Object.fromEntries((prevVersions || []).map((v) => [v.source_file, v.content_hash]));
    const changed = Object.keys(fileHashes).filter((f) => prev[f] !== fileHashes[f]);
    const removed = Object.keys(prev).filter((f) => !(f in fileHashes));
    const stale = [...new Set([...changed, ...removed])];

    for (const f of stale) {
      await supabaseAdmin.from('bot_semantic_cache').delete().contains('cited_sources', [{ source_file: f }]);
    }
    const versionRows = Object.entries(fileHashes).map(([source_file, content_hash]) => ({
      source_file, content_hash, updated_at: new Date().toISOString(),
    }));
    if (versionRows.length) await supabaseAdmin.from('bot_doc_versions').upsert(versionRows, { onConflict: 'source_file' });
    if (removed.length) await supabaseAdmin.from('bot_doc_versions').delete().in('source_file', removed);
    console.log(`Cache invalidation: ${stale.length} changed/removed doc(s) → cleared their cached answers.`);
  } catch (e) {
    console.log(`Cache invalidation skipped (${e.message}).`);
  }

  perFile.sort((a, b) => b[1] - a[1]);
  for (const [rel, n] of perFile) console.log(`  ${String(n).padStart(3)}  ${rel}`);
  console.log(`\nSeeded ${rows.length} chunks from ${files.length} docs into kb_chunks.`);
}

module.exports = { chunkMarkdown, toSections };

if (require.main === module) {
  if (process.argv.includes('--check')) { selfCheck(); process.exit(0); }
  main().then(() => process.exit(0)).catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
}
