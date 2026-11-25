/**
 * One shape for everything a host sells.
 *
 * The live console gives each sellable type its own page and its own nav entry:
 * Services, Products, Courses, Coupons. A host asking "what do I sell, and what
 * is working?" has to visit four pages and hold the answer in their head. This
 * module is the small amount of glue that lets one list answer it.
 *
 * It is deliberately pure — no fetching, no React — because the only hard parts
 * here are the shape differences between four endpoints, and those are much
 * easier to get right when they can be tested directly.
 *
 * Shapes as they actually come back (verified against the four pages):
 *   services  { id, title, price, is_active, duration }
 *   products  { id, title, price, is_active }
 *   courses   { id, title, price, is_active }
 *   coupons   { id, code, discount_type, discount_value, active }   ← the odd one
 *
 * Coupons differ in every interesting way: no title, no price, and `active`
 * rather than `is_active`. That single inconsistency is most of this file, and
 * it is exactly the kind of thing that turns into a blank row or a crash when a
 * list is merged by hand in a component.
 */

export const TYPES = ['service', 'product', 'course', 'coupon', 'membership'];

export const TYPE_LABEL = {
  service: 'Service',
  product: 'Product',
  course: 'Course',
  coupon: 'Offer',
  membership: 'Membership',
};

/** Plural, for the filter. */
export const TYPE_PLURAL = {
  service: 'Services',
  product: 'Products',
  course: 'Courses',
  coupon: 'Offers',
  membership: 'Memberships',
};

// One line on what each type is, for the "New" picker. Lifted from the Host Lab
// descriptors so the live menu reads the same as the prototype the founder saw.
export const TYPE_BLURB = {
  service: 'Time on your calendar. A guest picks a slot and pays for it.',
  product: 'A file a guest downloads. It sells while you sleep and takes no slot.',
  course: 'Lessons a guest works through. Teach once, sell many times.',
  membership: 'A monthly fee for ongoing access — the steadiest revenue a host can build.',
  coupon: 'A code that takes money off. For a launch, a festival, or a returning client.',
};

// Where a row goes when clicked. Only services have a per-item editor route;
// the rest edit inline on their own page, so a row lands there instead.
// Stated rather than hidden: this is the seam a later step closes by unifying
// the editors, and pretending otherwise would mean a dead link.
export const HOME_OF = {
  service: '/dashboard/services',
  product: '/dashboard/products',
  course: '/dashboard/courses',
  coupon: '/dashboard/coupons',
  // A host has ONE membership program; its tiers are managed on that one page.
  membership: '/dashboard/memberships',
};

// Where "add a new one of this type" lands. Services have a dedicated add route;
// the rest add on their own management page. Membership has no per-item create —
// tiers are added on the program page, so it points there too.
export const ADD_ROUTE = {
  service: '/dashboard/service/add-new',
  product: '/dashboard/products',
  course: '/dashboard/courses',
  coupon: '/dashboard/coupons',
  membership: '/dashboard/memberships',
};

export const editHref = (item) =>
  (item.kind === 'service' ? `/dashboard/service/edit/${item.id}` : HOME_OF[item.kind]);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** A coupon's human summary — it has no price, so the discount is the fact. */
export const couponSummary = (c) =>
  (c.discount_type === 'percent' || c.discount_type === 'percentage'
    ? `${num(c.discount_value)}% off`
    : `₹${num(c.discount_value).toLocaleString('en-IN')} off`);

/**
 * Normalise one API row into the list's shape.
 * Returns null for a row with no id — a row we cannot link to is worse than
 * absent, because it looks clickable and is not.
 */
export function normalise(row, kind) {
  if (!row || !row.id) return null;

  if (kind === 'coupon') {
    return {
      id: row.id,
      kind,
      title: row.code || 'Untitled offer',
      // A coupon has no price. Null, not 0 — 0 would render as "Free", which is
      // a different and wrong claim.
      price: null,
      active: !!row.active,
      meta: couponSummary(row),
    };
  }

  if (kind === 'membership') {
    // A membership "item" is a TIER: { id, name, type: 'free'|'paid',
    // price_inr, status: 'draft'|'live' }. It has no `title`/`price`/`is_active`
    // like the others — same class of mismatch as coupons, so it gets its own
    // branch rather than being forced through the generic shape.
    const free = row.type === 'free';
    const price = free ? null : num(row.price_inr);
    return {
      id: row.id,
      kind,
      title: row.name || 'Untitled tier',
      price,
      active: row.status === 'live',
      meta: free ? 'Free' : (price ? `₹${price.toLocaleString('en-IN')}/mo` : null),
    };
  }

  return {
    id: row.id,
    kind,
    title: row.title || 'Untitled',
    price: num(row.price),
    active: !!row.is_active,
    meta: kind === 'service' && row.duration ? `${row.duration} min` : null,
  };
}

/**
 * Merge the four sources into one list.
 *
 * Each source is `{ kind, rows, error }`. A source that failed contributes
 * nothing and is reported separately — one dead endpoint must not blank a page
 * that four endpoints feed. The host still sees everything that did load, and
 * is told plainly what is missing rather than being shown a short list as if it
 * were complete.
 */
export function mergeCatalog(sources = []) {
  const items = [];
  const failed = [];

  for (const s of sources) {
    if (!s) continue;
    if (s.error) { failed.push(s.kind); continue; }
    for (const row of s.rows || []) {
      const n = normalise(row, s.kind);
      if (n) items.push(n);
    }
  }

  return { items, failed };
}

/** Filter + sort, kept here so the component stays about rendering. */
export function selectItems(items, { q = '', kind = 'all', status = 'all', sort = 'name' } = {}) {
  const needle = q.trim().toLowerCase();

  const out = items.filter((i) => {
    if (kind !== 'all' && i.kind !== kind) return false;
    if (status === 'live' && !i.active) return false;
    if (status === 'hidden' && i.active) return false;
    if (needle && !`${i.title} ${i.meta || ''}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const by = {
    name: (a, b) => String(a.title).localeCompare(String(b.title)),
    // Null prices (coupons) sort last rather than as zero, which would put them
    // among the free items and read as a claim about them.
    price: (a, b) => (b.price ?? -1) - (a.price ?? -1),
    type: (a, b) => a.kind.localeCompare(b.kind) || String(a.title).localeCompare(String(b.title)),
  };

  return [...out].sort(by[sort] || by.name);
}

export const countsByKind = (items) =>
  items.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
