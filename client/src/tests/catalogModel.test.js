/**
 * catalogModel — merging four endpoints into one list.
 *
 * Most of what can go wrong here is coupons. They are the only type with no
 * title, no price, and `active` rather than `is_active` — so every assumption
 * the other three let you get away with breaks on them. The rest is the rule
 * that one dead endpoint must not blank a page that four endpoints feed.
 */
import { describe, it, expect } from 'vitest';
import {
  normalise, mergeCatalog, selectItems, countsByKind, editHref, couponSummary,
  TYPES, TYPE_LABEL, TYPE_PLURAL, ADD_ROUTE, HOME_OF,
} from '../pages/catalog/catalogModel';

const svc = { id: 's1', title: 'Follow-up consult', price: 1200, is_active: true, duration: 30 };
const prod = { id: 'p1', title: 'Meal plan PDF', price: 499, is_active: true };
const course = { id: 'c1', title: 'Six weeks', price: 6999, is_active: false };
const coupon = { id: 'o1', code: 'FIRST20', discount_type: 'percent', discount_value: 20, active: true };
// A membership tier — the shape getMyMembership().program.tiers returns.
const paidTier = { id: 'm1', name: 'Inner Circle', type: 'paid', price_inr: 499, status: 'live' };
const freeTier = { id: 'm2', name: 'Free follows', type: 'free', price_inr: null, status: 'draft' };

describe('normalise', () => {
  it('maps a service, keeping duration as its one distinguishing fact', () => {
    expect(normalise(svc, 'service')).toMatchObject({
      id: 's1', kind: 'service', title: 'Follow-up consult', price: 1200, active: true, meta: '30 min',
    });
  });

  it('reads is_active for the three that use it', () => {
    expect(normalise(course, 'course').active).toBe(false);
    expect(normalise(prod, 'product').active).toBe(true);
  });

  it('reads `active` for coupons, which do not use is_active', () => {
    // The whole reason this module exists. Reading is_active here gives every
    // coupon the wrong state, silently.
    expect(normalise(coupon, 'coupon').active).toBe(true);
    expect(normalise({ ...coupon, active: false }, 'coupon').active).toBe(false);
  });

  it('gives a coupon a null price, not zero', () => {
    // Zero would render as "Free", which is a claim about the offer rather than
    // an absence of one.
    expect(normalise(coupon, 'coupon').price).toBeNull();
  });

  it('uses the coupon code as its title and the discount as its summary', () => {
    expect(normalise(coupon, 'coupon')).toMatchObject({ title: 'FIRST20', meta: '20% off' });
    expect(couponSummary({ discount_type: 'flat', discount_value: 500 })).toBe('₹500 off');
  });

  it('drops a row with no id rather than rendering a dead link', () => {
    expect(normalise({ title: 'orphan' }, 'service')).toBeNull();
    expect(normalise(null, 'service')).toBeNull();
  });

  it('survives a missing price or title', () => {
    expect(normalise({ id: 'x' }, 'product')).toMatchObject({ title: 'Untitled', price: 0 });
  });

  it('maps a paid membership tier: name is the title, status is live/hidden', () => {
    expect(normalise(paidTier, 'membership')).toMatchObject({
      id: 'm1', kind: 'membership', title: 'Inner Circle', price: 499, active: true, meta: '₹499/mo',
    });
  });

  it('gives a free tier a null price and a "Free" summary, and a draft is hidden', () => {
    expect(normalise(freeTier, 'membership')).toMatchObject({
      id: 'm2', kind: 'membership', title: 'Free follows', price: null, active: false, meta: 'Free',
    });
  });
});

describe('type registry stays consistent', () => {
  // The bug this prevents: a type is added to TYPES but not to a label/route
  // map, so its Add option or row link is undefined — the exact gap that left
  // Memberships out of the graduated catalog.
  it('every type has a label, plural, add route, and home', () => {
    for (const t of TYPES) {
      expect(TYPE_LABEL[t], `label for ${t}`).toBeTruthy();
      expect(TYPE_PLURAL[t], `plural for ${t}`).toBeTruthy();
      expect(ADD_ROUTE[t], `add route for ${t}`).toBeTruthy();
      expect(HOME_OF[t], `home for ${t}`).toBeTruthy();
    }
  });

  it('includes membership', () => {
    expect(TYPES).toContain('membership');
  });
});

describe('mergeCatalog', () => {
  const sources = [
    { kind: 'service', rows: [svc] },
    { kind: 'product', rows: [prod] },
    { kind: 'course', rows: [course] },
    { kind: 'coupon', rows: [coupon] },
  ];

  it('merges four sources into one list', () => {
    const { items, failed } = mergeCatalog(sources);
    expect(items).toHaveLength(4);
    expect(failed).toEqual([]);
  });

  it('keeps the sources that answered when one fails', () => {
    // The property that matters: a dead endpoint is a partial result, never a
    // blank page. A host must not be shown three items as if that were all.
    const { items, failed } = mergeCatalog([
      ...sources.slice(0, 3),
      { kind: 'coupon', rows: [], error: true },
    ]);
    expect(items).toHaveLength(3);
    expect(failed).toEqual(['coupon']);
  });

  it('reports every failure, not just the first', () => {
    const { items, failed } = mergeCatalog([
      { kind: 'service', rows: [svc] },
      { kind: 'product', error: true },
      { kind: 'course', error: true },
    ]);
    expect(items).toHaveLength(1);
    expect(failed).toEqual(['product', 'course']);
  });

  it('copes with an endpoint that returns nothing useful', () => {
    expect(mergeCatalog([{ kind: 'service', rows: null }]).items).toEqual([]);
    expect(mergeCatalog(undefined).items).toEqual([]);
  });
});

describe('selectItems', () => {
  const items = mergeCatalog([
    { kind: 'service', rows: [svc] },
    { kind: 'product', rows: [prod] },
    { kind: 'course', rows: [course] },
    { kind: 'coupon', rows: [coupon] },
  ]).items;

  it('filters by type', () => {
    expect(selectItems(items, { kind: 'coupon' }).map((i) => i.id)).toEqual(['o1']);
  });

  it('filters by live and hidden', () => {
    expect(selectItems(items, { status: 'hidden' }).map((i) => i.id)).toEqual(['c1']);
    expect(selectItems(items, { status: 'live' })).toHaveLength(3);
  });

  it('searches titles and the coupon summary', () => {
    expect(selectItems(items, { q: 'follow' }).map((i) => i.id)).toEqual(['s1']);
    expect(selectItems(items, { q: '20% off' }).map((i) => i.id)).toEqual(['o1']);
  });

  it('sorts a null price last instead of treating it as free', () => {
    const byPrice = selectItems(items, { sort: 'price' });
    expect(byPrice[byPrice.length - 1].id).toBe('o1');
  });

  it('counts by kind', () => {
    expect(countsByKind(items)).toEqual({ service: 1, product: 1, course: 1, coupon: 1 });
  });
});

describe('editHref', () => {
  it('deep-links a service to its own editor', () => {
    expect(editHref({ kind: 'service', id: 's1' })).toBe('/dashboard/service/edit/s1');
  });

  it('sends the others to their page, opening the item where it has an inline editor', () => {
    // Products and courses edit inline on their own page; ?edit= opens the one.
    expect(editHref({ kind: 'product', id: 'p1' })).toBe('/dashboard/products?edit=p1');
    expect(editHref({ kind: 'course', id: 'c1' })).toBe('/dashboard/courses?edit=c1');
    expect(editHref({ kind: 'coupon', id: 'o1' })).toBe('/dashboard/coupons');
  });
});
