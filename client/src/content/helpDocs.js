/**
 * helpDocs.js — loads the help-center article markdown into the browser bundle.
 *
 * The .md files in docs/help/ are the single source of truth (also seeded into
 * the support bot). Vite inlines them at build time as raw strings, so the help
 * pages are fully static — no runtime API call, and they prerender cleanly.
 *
 * Title + excerpt are parsed from the markdown itself; order/category come from
 * helpDocsList.js.
 */

import { HELP_DOCS } from './helpDocsList';

// Raw markdown, keyed by file path. Path is outside the client root, so
// vite.config.js allows the repo root via server.fs.allow (dev); the build
// bundles it regardless.
const RAW = import.meta.glob('../../../docs/help/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const slugFromPath = (p) => p.split('/').pop().replace(/\.md$/, '');

// Strip an optional YAML front-matter block (--- … ---) from the top of a doc so
// maintenance metadata (last_verified, etc.) never renders on the help page.
// No-op when a file has no front-matter.
const stripFrontmatter = (s) => s.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

// Strip the inline markdown we use so an excerpt reads cleanly as plain text.
const stripInline = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [label](url) -> label
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
    .replace(/`([^`]+)`/g, '$1') // `code` -> code
    .trim();

function parseMeta(raw) {
  const titleM = raw.match(/^#\s+(.+)$/m);
  const title = titleM ? titleM[1].trim() : 'Help';
  const after = titleM ? raw.slice(raw.indexOf(titleM[0]) + titleM[0].length) : raw;
  const firstPara = after
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('-') && !/^\d+\.\s/.test(l));
  return { title, excerpt: firstPara ? stripInline(firstPara) : '' };
}

// slug -> { slug, title, excerpt, body }
const BY_SLUG = {};
for (const [path, raw] of Object.entries(RAW)) {
  const slug = slugFromPath(path);
  const body = stripFrontmatter(raw);
  BY_SLUG[slug] = { slug, body, ...parseMeta(body) };
}

export const getHelpDoc = (slug) => BY_SLUG[slug] || null;

// Every markdown file that actually loaded — used by the drift test.
export const loadedHelpSlugs = () => Object.keys(BY_SLUG);

// Articles grouped by category, in the order defined by helpDocsList. Only
// entries whose markdown file exists are included.
export function helpGroups() {
  const groups = [];
  for (const { slug, category } of HELP_DOCS) {
    const doc = BY_SLUG[slug];
    if (!doc) continue;
    let g = groups.find((x) => x.category === category);
    if (!g) groups.push((g = { category, docs: [] }));
    g.docs.push(doc);
  }
  return groups;
}
