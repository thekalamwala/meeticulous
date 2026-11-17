// Drift guard: every go('…') in Host Lab must resolve to a real destination.
//
// Written because two sections are being built in parallel, and a link can go
// stale in three ways that all LOOK fine in review:
//
//   1. a page is deleted and its links are left behind (Grow › Insights)
//   2. a page is added on one branch and linked from another before it exists
//   3. a sub-page stops being a `?tab=` and becomes a real route, so the old
//      query-string link silently lands on the parent's first page instead
//
// (3) is not hypothetical: go('money?tab=payouts') resolved to Money › Earnings,
// not Payouts — and one of the two call sites was the "Withdraw" button.
// Nothing errored, nothing logged; it just quietly went to the wrong page.
//
// The nav tree is the single source of truth (nav.js declares a destination
// once, for the rail, the router and the page heading). So this test makes it
// the source of truth for LINKS too: a target that nav.js cannot resolve fails
// here rather than dead-ending a host.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NAV, SUBPAGES } from '../nav';

const DIR = path.resolve(__dirname, '..');

/** Every .jsx under pages/hostlab, including sections/. */
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(full);
    return e.name.endsWith('.jsx') ? [full] : [];
  });
}

const TARGETS = sources(DIR).flatMap((file) => {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(/\bgo\(\s*'([^']*)'\s*\)/g)].map((m) => ({
    file: path.relative(DIR, file).replace(/\\/g, '/'),
    target: m[1],
  }));
});

const ITEMS = NAV.flatMap((g) => g.items);
const byTo = new Map(ITEMS.map((i) => [i.to, i]));

function resolve(target) {
  if (target.includes('?')) return `uses a query string ("${target}") — sub-pages are real routes now, so this lands on the parent's first page`;
  if (target === '') return null; // Today
  const [parent, sub, ...rest] = target.split('/');
  if (rest.length) return `too many segments ("${target}")`;
  const item = byTo.get(parent);
  if (!item) return `no rail destination "${parent}"`;
  if (sub === undefined) return null;
  const pages = item.pages ? SUBPAGES[item.pages] : null;
  if (!pages) return `"${parent}" has no sub-pages, but the link asks for "${sub}"`;
  if (!pages.some((p) => p.slug === sub)) {
    return `"${parent}" has no sub-page "${sub}" (has: ${pages.map((p) => p.slug).join(', ')})`;
  }
  return null;
}

describe('Host Lab nav integrity', () => {
  it('finds the go() call sites', () => {
    expect(TARGETS.length).toBeGreaterThan(3);
  });

  it('every go() target resolves to a real destination', () => {
    const broken = TARGETS
      .map(({ file, target }) => {
        const why = resolve(target);
        return why ? `${file}: go('${target}') — ${why}` : null;
      })
      .filter(Boolean);
    expect(broken).toEqual([]);
  });

  it('no link points at a deleted page', () => {
    // Grow › Insights was removed; Intelligence owns measurement. A link to it
    // would dead-end, and the rebuilt Today.jsx on the Host Lab branch still
    // carries two of them — this is what catches them at merge.
    const dead = TARGETS.filter((t) => t.target.startsWith('grow/insights'));
    expect(dead.map((d) => `${d.file}: ${d.target}`)).toEqual([]);
  });
});
