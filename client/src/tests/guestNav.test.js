/**
 * Guest console nav (Kept shell): every /user page stays reachable, and Library
 * stays one lit rail row across both of its pages.
 * Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md §4.
 */
import { describe, it, expect } from 'vitest';
import { resolveActive, isLeafSection } from '../components/common/ConsoleSidebar';
import { GUEST_SECTIONS, GUEST_GROUPS, GUEST_TAB_BAR, GUEST_MENU_LINKS } from '../components/common/guestNav';

const GUEST_PAGES = [
  '/user', '/user/my-bookings', '/user/courses', '/user/memberships', '/user/invoices',
  '/user/reviews', '/user/loyalty', '/user/profile', '/user/chat',
];

describe('guest nav', () => {
  it('reaches every /user page from the rail, the More sheet or the account menu', () => {
    const rail = GUEST_SECTIONS.flatMap((s) => s.items.flatMap((i) => i.matchPrefix || [i.to]));
    const sheet = GUEST_TAB_BAR.sheet.filter((it) => typeof it === 'object').map((it) => it.to);
    const reach = new Set([...rail, ...sheet, ...GUEST_MENU_LINKS]);
    expect(GUEST_PAGES.filter((p) => !reach.has(p))).toEqual([]);
  });

  it('lights Library on both of its pages, as a leaf row', () => {
    const lib = GUEST_SECTIONS.find((s) => s.id === 'library');
    expect(isLeafSection(lib)).toBe(true);
    expect(resolveActive('/user/courses', GUEST_SECTIONS).sectionId).toBe('library');
    expect(resolveActive('/user/memberships', GUEST_SECTIONS).sectionId).toBe('library');
  });

  it('lights Bookings on a booking detail page and Home only on /user', () => {
    expect(resolveActive('/user/my-bookings/abc', GUEST_SECTIONS).sectionId).toBe('bookings');
    expect(resolveActive('/user', GUEST_SECTIONS).sectionId).toBe('home');
  });

  it('puts every section in a rail group and every tab in the sections', () => {
    const ids = GUEST_SECTIONS.map((s) => s.id);
    expect(GUEST_GROUPS.flatMap((g) => g.ids).sort()).toEqual([...ids].sort());
    expect(GUEST_TAB_BAR.order.every((id) => ids.includes(id))).toBe(true);
  });
});
