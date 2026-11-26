/**
 * NAV vs NAV_V2 — the two rails must stay in step.
 *
 * The failure this exists to prevent: someone adds a page to NAV, ships it,
 * and it is simply absent for every host on console_v2. Nothing errors, no
 * route 404s, the page just cannot be reached from the rail — the quietest
 * kind of regression there is. This test makes that a red CI run instead.
 *
 * It also pins the property that makes the flag safe to flip either way: every
 * page stays reachable under both rails. v2 adds exactly one surface of its own
 * — the catalog list — and that exception is allowlisted below so a second one
 * cannot slip in unnoticed.
 */
import { describe, it, expect } from 'vitest';
import { NAV, NAV_V2, navFor, visibleSections, resolveActive, firstItemTo } from '../components/common/ConsoleSidebar';
import { HOME_OF } from '../pages/catalog/catalogModel';
import { GROUPS } from '../components/common/dashboardV2Groups';

const routesOf = (nav) => nav.flatMap((s) => s.items.map((i) => i.to));
const ALL_FLAGS = { flags: { guest_messaging: true, course_purchase: true, coupons: true, community_memberships: true } };

// Step 2 changed this contract, and the test caught it rather than the change
// slipping through: the v2 rail no longer lists the four catalog types, because
// /dashboard/catalog lists them instead. So "present in the rail" is too strong
// a requirement now. "Reachable" is the property that actually matters, and it
// is the one asserted below.
//
// Anything the catalog page links to counts as reachable. Everything else must
// still be a rail entry.
const CATALOG_COVERS = Object.values(HOME_OF);
// v2's own surfaces that have no NAV equivalent: the collapsed catalog list, and
// the dashboard_sections_v2 Intelligence + Community consoles (graduated from the
// Host Lab prototype; gated by their own OFF flag, so hidden unless it is on).
const V2_OWN_ROUTES = [
  '/dashboard/catalog',
  '/dashboard/intelligence/overview', '/dashboard/intelligence/revenue',
  '/dashboard/intelligence/audience', '/dashboard/intelligence/demand',
  '/dashboard/community/activity', '/dashboard/community/mentions',
  '/dashboard/community/answer', '/dashboard/community/spaces',
  // Grow (Kept): its overview landing and the booking-page editor.
  '/dashboard/grow', '/dashboard/grow/page',
];

describe('nothing becomes unreachable under v2', () => {
  it('keeps every NAV page either in the rail or linked from the catalog', () => {
    const v2 = routesOf(NAV_V2);
    const stranded = routesOf(NAV).filter((to) => !v2.includes(to) && !CATALOG_COVERS.includes(to));
    // If this fails you added a page to NAV and not to NAV_V2, and the catalog
    // does not link it either — so it is reachable only by typing the URL.
    // Add it to NAV_V2. Do not delete this test.
    expect(stranded).toEqual([]);
  });

  it('adds exactly one surface of its own, and names it', () => {
    // v2 is a regrouping. The catalog list is the single deliberate exception,
    // allowlisted above so a second one cannot appear unnoticed.
    const invented = routesOf(NAV_V2).filter((to) => !routesOf(NAV).includes(to) && !V2_OWN_ROUTES.includes(to));
    expect(invented).toEqual([]);
  });

  it('still reaches all four catalog types from the catalog page', () => {
    // The flip side of collapsing the rail: if these links broke, four pages
    // would have no way in at all.
    expect(CATALOG_COVERS).toEqual(expect.arrayContaining([
      '/dashboard/services', '/dashboard/products', '/dashboard/courses', '/dashboard/coupons',
    ]));
  });

  it('lists every route exactly once, so no page has two homes', () => {
    const seen = routesOf(NAV_V2);
    expect(seen).toHaveLength(new Set(seen).size);
  });
});

describe('the dashboard_v2 shell reaches every section', () => {
  // The v2 shell (DashboardLayoutV2) renders NAV_V2's sections bucketed into
  // GROUPS. A section id present in NAV_V2 but absent from every bucket would be
  // invisible on the new rail — the same quiet regression navParity guards for
  // the rail itself, one level up. With every flag on, ALL sections are visible.
  const ctx = { flags: { console_v2: true, guest_messaging: true, course_purchase: true, coupons: true, community_memberships: true } };
  const bucketed = new Set(GROUPS.flatMap((g) => g.ids));

  it('buckets every visible v2 section into a group', () => {
    const stranded = visibleSections(ctx).map((s) => s.id).filter((id) => !bucketed.has(id));
    // If this fails you added a NAV_V2 section and did not place it in a GROUPS
    // bucket in dashboardV2Groups.js, so it cannot be reached from the v2 rail.
    expect(stranded).toEqual([]);
  });

  it('buckets no id that is not a real section', () => {
    const real = new Set(NAV_V2.map((s) => s.id));
    const ghosts = [...bucketed].filter((id) => !real.has(id));
    expect(ghosts).toEqual([]);
  });
});

describe('the flag picks the rail', () => {
  it('serves the current grouping when off, or absent', () => {
    expect(navFor({ flags: {} })).toBe(NAV);
    expect(navFor(undefined)).toBe(NAV);
  });

  it('serves the regrouped rail when on', () => {
    expect(navFor({ flags: { console_v2: true } })).toBe(NAV_V2);
  });
});

describe('the regrouping itself', () => {
  const v2 = visibleSections({ ...ALL_FLAGS, flags: { ...ALL_FLAGS.flags, console_v2: true } });
  const sectionOf = (to) => v2.find((s) => s.items.some((i) => i.to === to))?.id;

  it('gives Clients and Schedule their own sections', () => {
    expect(sectionOf('/dashboard/clients')).toBe('clients');
    expect(sectionOf('/dashboard/availability')).toBe('schedule');
  });

  it('moves social proof and referrals into Grow', () => {
    expect(sectionOf('/dashboard/testimonials')).toBe('grow');
    expect(sectionOf('/dashboard/referrals')).toBe('grow');
  });

  it('lands Grow on its overview, with Your page beside it', () => {
    const grow = NAV_V2.find((s) => s.id === 'grow');
    expect(firstItemTo(grow, 'starter')).toBe('/dashboard/grow');
    expect(sectionOf('/dashboard/grow/page')).toBe('grow');
  });

  it('leaves Money exactly as it was — it already matched the redesign', () => {
    const before = NAV.find((s) => s.id === 'money').items.map((i) => i.to).sort();
    const after = NAV_V2.find((s) => s.id === 'money').items.map((i) => i.to).sort();
    expect(after).toEqual(before);
  });
});

describe('the helpers still work against v2', () => {
  const ctx = { flags: { console_v2: true, guest_messaging: true, course_purchase: true, coupons: true } };
  const sections = visibleSections(ctx);

  it('resolves a deep route to its new parent', () => {
    // The thing a host actually notices: open a nested page, see the right rail
    // row lit.
    expect(resolveActive('/dashboard/clients/42', sections).sectionId).toBe('clients');
    expect(resolveActive('/dashboard/payments/transactions', sections).sectionId).toBe('money');
  });

  it('still treats the dashboard root as exact, not a prefix for everything', () => {
    expect(resolveActive('/dashboard', sections)).toMatchObject({ to: '/dashboard' });
  });

  it('lands a rail click on a real page for every section', () => {
    for (const s of sections) {
      expect(firstItemTo(s, 'premium')).toMatch(/^\/dashboard/);
    }
  });

  it('keeps Messages hidden until its flag is on', () => {
    const withoutMessages = visibleSections({ flags: { console_v2: true } });
    expect(withoutMessages.some((s) => s.id === 'messages')).toBe(false);
  });

  it('hides Intelligence + Community until dashboard_sections_v2 is on, then shows them', () => {
    const off = visibleSections({ flags: { console_v2: true } }).map((s) => s.id);
    expect(off).not.toContain('intelligence');
    expect(off).not.toContain('community');
    const on = visibleSections({ flags: { console_v2: true, dashboard_sections_v2: true } }).map((s) => s.id);
    expect(on).toContain('intelligence');
    expect(on).toContain('community');
  });

  it('keeps Community its own section, marked new, with all four pages', () => {
    const c = NAV_V2.find((s) => s.id === 'community');
    expect(c.isNew).toBe(true);
    expect(c.items.map((i) => i.to)).toEqual(['activity', 'mentions', 'answer', 'spaces'].map((k) => `/dashboard/community/${k}`));
    expect(NAV_V2.find((s) => s.id === 'grow').items.some((i) => i.to.startsWith('/dashboard/community'))).toBe(false);
  });
});
