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
import { BASE, NAV, SUBPAGES } from '../nav';

const DIR = path.resolve(__dirname, '..');

/** Every source file under pages/hostlab. `.js` matters as much as `.jsx`:
 *  the setup checklist's destinations live in mockData.js. */
function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
  });
}

// Three shapes carry a destination, and a grep for only the first misses the
// other two: go('x') / onGo('x') are calls, `to: 'x'` is data (the profile menu
// and the setup checklist), and some `to:` values are absolute, with BASE.
const PATTERNS = [/\b(?:on)?[Gg]o\(\s*'([^']*)'\s*\)/g, /\bto:\s*'([^']*)'/g];

const TARGETS = sources(DIR).flatMap((file) => {
  const src = fs.readFileSync(file, 'utf8');
  return PATTERNS.flatMap((re) => [...src.matchAll(re)].map((m) => ({
    file: path.relative(DIR, file).replace(/\\/g, '/'),
    target: m[1],
  })));
});

const ITEMS = NAV.flatMap((g) => g.items);
const byTo = new Map(ITEMS.map((i) => [i.to, i]));

function resolve(raw) {
  if (raw.includes('?')) return `uses a query string ("${raw}") — sub-pages are real routes now, so this lands on the parent's first page`;
  // Some `to:` values are absolute (`/host-lab/bookings/week`); same destination.
  const target = raw.startsWith(`${BASE}/`) ? raw.slice(BASE.length + 1) : raw;
  if (target === '' || target === BASE) return null; // Today
  if (target.startsWith('/')) return `absolute path outside Host Lab ("${raw}")`;
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

  it('every link target resolves to a real destination', () => {
    const broken = TARGETS
      .map(({ file, target }) => {
        const why = resolve(target);
        return why ? `${file}: '${target}' — ${why}` : null;
      })
      .filter(Boolean);
    expect(broken).toEqual([]);
  });

  it('no link points at a deleted page', () => {
    // Grow › Insights was removed here; Intelligence owns measurement.
    //
    // EXPECT THIS TO FAIL WHEN THE HOST LAB BRANCH MERGES, and read it
    // correctly when it does. grow/insights resolves on that branch and must —
    // the page still exists there, because the deletion lands on this branch,
    // not theirs. Their rebuilt Today.jsx carries two links to it. So the
    // failure means "the repoint is now due", not "their branch is broken".
    // The fix is to point both at intelligence/audience, as agreed between the
    // two sessions. Do not fix it by deleting this test.
    const dead = TARGETS.filter((t) => t.target.startsWith('grow/insights'));
    expect(dead.map((d) => `${d.file}: ${d.target}`)).toEqual([]);
  });
});
