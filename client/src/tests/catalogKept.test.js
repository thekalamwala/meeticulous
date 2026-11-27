/**
 * Kept Catalog additions to catalogModel: Discounts naming, the guest price the
 * server sends (never computed here), the host's order (v3.227), and grouping.
 */
import { describe, it, expect } from 'vitest';
import {
  normalise, groupByKind, byHostOrder, moveId, selectItems, TYPE_LABEL, TYPE_PLURAL, REORDERABLE,
} from '../pages/catalog/catalogModel';

describe('Kept catalog model', () => {
  it('calls coupons Discounts', () => {
    expect(TYPE_LABEL.coupon).toBe('Discount');
    expect(TYPE_PLURAL.coupon).toBe('Discounts');
  });

  it('passes the server guest_total through and never invents one', () => {
    expect(normalise({ id: 's', title: 'A', price: 1000, guest_total: 1059 }, 'service').guestTotal).toBe(1059);
    expect(normalise({ id: 's', title: 'A', price: 1000 }, 'service').guestTotal).toBeNull();
    expect(normalise({ id: 's', title: 'A', price: 1000, guest_total: null }, 'service').guestTotal).toBeNull();
    // host_earnings ("You'll get") is the server's figure too, never derived here.
    expect(normalise({ id: 's', title: 'A', price: 1000, host_earnings: 950 }, 'service').hostEarnings).toBe(950);
    expect(normalise({ id: 's', title: 'A', price: 1000 }, 'service').hostEarnings).toBeNull();
    // A discount or a membership tier has no booking fee on top.
    expect(normalise({ id: 'c', code: 'X', discount_type: 'percent', discount_value: 5, active: true }, 'coupon').guestTotal).toBeNull();
    expect(normalise({ id: 'm', name: 'T', type: 'paid', price_inr: 99, status: 'live' }, 'membership').guestTotal).toBeNull();
  });

  it('describes each type in one short line', () => {
    expect(normalise({ id: 's', title: 'A', price: 0, duration: 45, meeting_mode: 'online' }, 'service').detail).toBe('45 min · Online');
    expect(normalise({ id: 'p', title: 'A', price: 0, type: 'pdf', purchase_count: 1200 }, 'product').detail).toBe('PDF · 1,200 sold');
    expect(normalise({ id: 'k', title: 'A', price: 0, course_lessons: [{}] }, 'course').detail).toBe('1 lesson');
    expect(normalise({ id: 'c', code: 'X', discount_type: 'flat', discount_value: 50, times_redeemed: 3, max_redemptions: 10 }, 'coupon').detail)
      .toBe('3 of 10 used · No end date');
  });

  it('orders placed items first, then unplaced newest first', () => {
    const a = { sortOrder: null, createdAt: '2026-01-01' };
    const b = { sortOrder: 2, createdAt: '2026-01-01' };
    const c = { sortOrder: 1, createdAt: '2025-01-01' };
    const d = { sortOrder: null, createdAt: '2026-05-01' };
    expect([a, b, c, d].sort(byHostOrder)).toEqual([c, b, d, a]);
  });

  it('groups by type in the given order and drops empty groups', () => {
    const items = [
      { id: '1', kind: 'coupon', sortOrder: null, createdAt: '1' },
      { id: '2', kind: 'service', sortOrder: 2, createdAt: '1' },
      { id: '3', kind: 'service', sortOrder: 1, createdAt: '1' },
    ];
    expect(groupByKind(items, ['service', 'product', 'coupon'])).toEqual([
      ['service', [items[2], items[1]]],
      ['coupon', [items[0]]],
    ]);
  });

  it('selectItems can keep the host order', () => {
    const items = [
      { id: '1', kind: 'service', title: 'Zed', active: true, sortOrder: 1, createdAt: '1' },
      { id: '2', kind: 'service', title: 'Abe', active: true, sortOrder: 2, createdAt: '1' },
    ];
    expect(selectItems(items, { sort: 'host' }).map((i) => i.id)).toEqual(['1', '2']);
    expect(selectItems(items).map((i) => i.id)).toEqual(['2', '1']); // default stays by name
  });

  it('moveId moves one id and ignores bad indexes', () => {
    expect(moveId(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveId(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });

  it('only types with a sort_order column can be reordered', () => {
    expect(REORDERABLE).toEqual(['service', 'product', 'course']);
  });
});
