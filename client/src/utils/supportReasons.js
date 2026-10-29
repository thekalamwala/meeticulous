// Contact-reason taxonomy — client mirror of server/config/supportReasons.js
// (used by the resolve / close pickers). KEEP CODES IN SYNC with the server; the
// insights report is the source of truth for aggregation.
export const REASONS = [
  { code: 'booking_cant_book',  label: "Couldn't complete a booking",    category: 'Booking' },
  { code: 'booking_status',     label: 'Booking status / where is it',   category: 'Booking' },
  { code: 'booking_cancel',     label: 'Cancellation',                   category: 'Booking' },
  { code: 'booking_reschedule', label: 'Reschedule',                     category: 'Booking' },
  { code: 'no_show',            label: 'No-show / dispute',              category: 'Booking' },
  { code: 'pay_failed',         label: 'Payment failed',                 category: 'Payment' },
  { code: 'pay_refund',         label: 'Refund status',                  category: 'Payment' },
  { code: 'pay_dispute',        label: 'Charge dispute / double charge', category: 'Payment' },
  { code: 'host_listing_live',  label: "Listing isn't live",             category: 'Host' },
  { code: 'host_kyc',           label: 'KYC / verification',             category: 'Host' },
  { code: 'host_payout',        label: 'Payout / earnings',              category: 'Host' },
  { code: 'host_subscription',  label: 'Subscription / plan',            category: 'Host' },
  { code: 'host_availability',  label: 'Availability / calendar',        category: 'Host' },
  { code: 'account_login',      label: 'Login / OTP',                    category: 'Account' },
  { code: 'account_profile',    label: 'Profile / settings',             category: 'Account' },
  { code: 'product_bug',        label: 'Product bug / error',            category: 'Product' },
  { code: 'how_to',             label: 'How-to / guidance',              category: 'Guidance' },
  { code: 'other',              label: 'Other',                          category: 'Other' },
];

// [{ category, items:[...] }] for a grouped <optgroup> picker.
export const REASON_GROUPS = REASONS.reduce((acc, r) => {
  const g = acc.find((x) => x.category === r.category) || (acc.push({ category: r.category, items: [] }), acc[acc.length - 1]);
  g.items.push(r);
  return acc;
}, []);
