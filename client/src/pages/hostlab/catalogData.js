// One list of everything a host sells.
//
// The mock keeps services, products, courses and offers in their own arrays
// because that is how the real API returns them. The catalog is one list, so
// it is flattened here once and tagged with `kind` — the key into
// catalogTypes.js. Both the list and the editor read this, so a row and the
// page it opens can never disagree about what a thing is.
import mock from './mockData';

const price = (v) => (Number(v) || 0);

export const allItems = () => [
  ...mock.services.map((s) => ({
    ...s, kind: 'service',
    sold_30d: s.bookings_30d, revenue_30d: s.revenue_30d, conversion: s.conversion,
  })),
  ...mock.products.map((p) => ({
    ...p, kind: 'product',
    sold_30d: p.sales_30d, revenue_30d: p.revenue_30d,
  })),
  ...mock.courses.map((c) => ({
    ...c, kind: 'course',
    sold_30d: c.enrolled, revenue_30d: c.revenue_30d, drip: 'weekly',
  })),
  ...mock.offers.map((o) => ({
    ...o, kind: 'coupon',
    title: o.code,
    sold_30d: o.times_redeemed, revenue_30d: 0,
    expires_at: o.expires_at ? o.expires_at.slice(0, 10) : '',
  })),
];

/** A coupon's live state, matching couponService.validate's checks. */
export const couponState = (c) => {
  if (!c.active) return 'inactive';
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) return 'used_up';
  return 'active';
};

/** The one-line summary under a row's name, per kind. */
export const summarise = (item) => {
  switch (item.kind) {
    case 'service':
      return `${item.duration} min · ${item.price_on_request ? 'On request' : price(item.price) ? `₹${price(item.price).toLocaleString('en-IN')}` : 'Free'}`;
    case 'product':
      return `${price(item.price) ? `₹${price(item.price).toLocaleString('en-IN')}` : 'Free'} · instant download`;
    case 'course':
      return `₹${price(item.price).toLocaleString('en-IN')} · ${item.lessons} lessons`;
    case 'membership':
      return `₹${price(item.price).toLocaleString('en-IN')} a month`;
    case 'coupon':
      return `${item.discount_type === 'percent' ? `${item.discount_value}% off` : `₹${item.discount_value} off`}${item.expires_at ? ` · expires ${new Date(item.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ' · no expiry'}`;
    default:
      return '';
  }
};

export default allItems;
