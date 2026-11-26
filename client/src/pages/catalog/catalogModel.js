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
  // Coupons are called Discounts in the product (Kept, founder call 2026-11-25).
  // Code, routes and the API keep "coupon".
  coupon: 'Discount',
  membership: 'Membership',
};

/** Plural, for the filter. */
export const TYPE_PLURAL = {
  service: 'Services',
  product: 'Products',
  course: 'Courses',
  coupon: 'Discounts',
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

// Where "add a new one of this type" lands. Every type that creates items has an
// add-new route (2026-11-26): services their own editor, products / courses /
// coupons their page with the create form open (useAddNewRoute). Membership has
// no per-item create — tiers are added on the program page, so it points there.
export const ADD_ROUTE = {
  service: '/dashboard/service/add-new',
  product: '/dashboard/product/add-new',
  course: '/dashboard/course/add-new',
  coupon: '/dashboard/coupon/add-new',
  membership: '/dashboard/memberships',
};

export const editHref = (item) => {
  if (item.kind === 'service') return `/dashboard/service/edit/${item.id}`;
  // Products and courses edit inline on their own page; ?edit= opens that one.
  if (item.kind === 'product' || item.kind === 'course') return `${HOME_OF[item.kind]}?edit=${encodeURIComponent(item.id)}`;
  return HOME_OF[item.kind];
};

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
      title: row.code || 'Untitled discount',
      // A coupon has no price. Null, not 0 — 0 would render as "Free", which is
      // a different and wrong claim.
      price: null,
      active: !!row.active,
      meta: couponSummary(row),
      image: null,
      guestTotal: null,
      sortOrder: null,
      createdAt: row.created_at || null,
      detail: couponDetail(row),
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
      image: null,
      // A tier is billed at its own price — no booking fee on top (v3.225 note).
      guestTotal: null,
      sortOrder: Number.isFinite(Number(row.position)) ? Number(row.position) : null,
      createdAt: row.created_at || null,
      perMonth: !free,
      detail: free ? 'Free tier' : 'Billed monthly',
    };
  }

  return {
    id: row.id,
    kind,
    title: row.title || 'Untitled',
    price: num(row.price),
    active: !!row.is_active,
    meta: kind === 'service' && row.duration ? `${row.duration} min` : null,
    image: row.thumbnail_url || null,
    // What a guest pays, worked out by the SERVER from pricingEngine (guest_total
    // on the host list endpoints). Never computed here: null when the server did
    // not send it, and the card then shows the listed price alone.
    guestTotal: Number.isFinite(Number(row.guest_total)) && row.guest_total !== null ? Number(row.guest_total) : null,
    priceOnRequest: row.price_on_request === true,
    sortOrder: Number.isFinite(Number(row.sort_order)) && row.sort_order !== null ? Number(row.sort_order) : null,
    createdAt: row.created_at || null,
    detail: detailOf(row, kind),
  };
}

const MODE = { online: 'Online', offline: 'In person', in_person: 'In person', hybrid: 'Online or in person', phone: 'Phone call' };
const PRODUCT_KIND = { pdf: 'PDF', template: 'Template', ebook: 'Ebook', prompt_pack: 'Prompt pack', resource: 'Resource', other: 'Download' };

/** The second line under a title: the one or two facts a host scans for. */
function detailOf(row, kind) {
  if (kind === 'service') {
    return [row.duration ? `${row.duration} min` : null, MODE[row.meeting_mode] || null].filter(Boolean).join(' · ') || null;
  }
  if (kind === 'product') {
    const sold = num(row.purchase_count);
    return [PRODUCT_KIND[row.type] || 'Download', sold ? `${sold.toLocaleString('en-IN')} sold` : null].filter(Boolean).join(' · ');
  }
  if (kind === 'course') {
    const n = Array.isArray(row.course_lessons) ? row.course_lessons.length : 0;
    const sold = num(row.purchase_count);
    return [n ? `${n} ${n === 1 ? 'lesson' : 'lessons'}` : 'No lessons yet', sold ? `${sold.toLocaleString('en-IN')} sold` : null].filter(Boolean).join(' · ');
  }
  return null;
}

/** A discount's second line: how often it was used and when it ends. */
function couponDetail(c) {
  const used = num(c.times_redeemed);
  const cap = c.max_redemptions ? ` of ${num(c.max_redemptions).toLocaleString('en-IN')}` : '';
  const ends = c.expires_at
    ? (new Date(c.expires_at).getTime() < Date.now()
      ? 'Ended'
      : `Ends ${new Date(c.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`)
    : 'No end date';
  return `${used.toLocaleString('en-IN')}${cap} used · ${ends}`;
}

/** Types whose order the host can set (they carry a sort_order column, v3.227). */
export const REORDERABLE = ['service', 'product', 'course'];

/**
 * The order a host sees — and guests see on the booking page: the host's own
 * order first (sort_order ascending), then anything never placed, newest first.
 * Matches the server's ORDER BY sort_order NULLS LAST, created_at DESC.
 */
export function byHostOrder(a, b) {
  const sa = a.sortOrder; const sb = b.sortOrder;
  if (sa !== null && sb !== null && sa !== sb) return sa - sb;
  if (sa !== null && sb === null) return -1;
  if (sa === null && sb !== null) return 1;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

/** Group items by type in TYPES order, each group in host order. Empty groups dropped. */
export function groupByKind(items, order = TYPES) {
  return order
    .map((kind) => [kind, items.filter((i) => i.kind === kind).sort(byHostOrder)])
    .filter(([, list]) => list.length > 0);
}

/** Move one id within a list of ids. Out-of-range or same index returns a copy. */
export function moveId(ids, from, to) {
  const out = [...ids];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
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
    // The host's own order (sort_order), as guests see it on the booking page.
    host: byHostOrder,
  };

  return [...out].sort(by[sort] || by.name);
}

export const countsByKind = (items) =>
  items.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
