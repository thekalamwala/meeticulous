/**
 * NAV vs NAV_V2 — the two rails must stay in step.
 *
 * The failure this exists to prevent: someone adds a page to NAV, ships it,
 * and it is simply absent for every host on console_v2. Nothing errors, no
 * route 404s, the page just cannot be reached from the rail — the quietest
 * kind of regression there is. This test makes that a red CI run instead.
 *
 * It also pins the property that makes the flag safe to flip either way:
 * v2 changes grouping, never routes.
 */
import { describe, it, expect } from 'vitest';
import { NAV, NAV_V2, navFor, visibleSections, resolveActive, firstItemTo } from '../components/common/ConsoleSidebar';

const routesOf = (nav) => nav.flatMap((s) => s.items.map((i) => i.to));
const ALL_FLAGS = { flags: { guest_messaging: true, course_purchase: true, coupons: true, community_memberships: true } };

describe('the two rails serve the same routes', () => {
  it('loses no page from NAV when v2 is on', () => {
    const missing = routesOf(NAV).filter((to) => !routesOf(NAV_V2).includes(to));
    // If this fails you added a page to NAV and not to NAV_V2. Add it there —
    // do not delete this test.
    expect(missing).toEqual([]);
  });

  it('invents no route that NAV does not already have', () => {
    // v2 is a regrouping, not a new surface. A route here that NAV lacks means
    // a page was added without a route, or this list drifted into fiction.
    const invented = routesOf(NAV_V2).filter((to) => !routesOf(NAV).includes(to));
    expect(invented).toEqual([]);
  });

  it('lists every route exactly once, so no page has two homes', () => {
    const seen = routesOf(NAV_V2);
    expect(seen).toHaveLength(new Set(seen).size);
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
});
