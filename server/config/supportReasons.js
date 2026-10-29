'use strict';

/**
 * supportReasons — the contact-reason taxonomy. Stamped on a conversation when it's
 * resolved/closed so support becomes product intelligence: WHY did this person need
 * us, and was it a product/UX failure or expected help?
 *
 * `type` drives the headline metric — "product-caused support rate" = share of
 * conversations tagged product|ux (things we could have prevented), vs expected
 * (working-as-intended guidance) or external (payment gateway, etc).
 *
 * Codes are stable strings stored in support_threads.reason_code /
 * bot_escalations.reason_code. Add rows freely; don't rename codes (breaks history).
 */

const REASONS = [
  // code                 label                              category    type
  ['booking_cant_book',   "Couldn't complete a booking",     'booking',  'product'],
  ['booking_status',      'Booking status / where is it',    'booking',  'expected'],
  ['booking_cancel',      'Cancellation',                    'booking',  'expected'],
  ['booking_reschedule',  'Reschedule',                      'booking',  'expected'],
  ['no_show',             'No-show / dispute',               'booking',  'expected'],
  ['pay_failed',          'Payment failed',                  'payment',  'external'],
  ['pay_refund',          'Refund status',                   'payment',  'expected'],
  ['pay_dispute',         'Charge dispute / double charge',  'payment',  'external'],
  ['host_listing_live',   "Listing isn't live",              'host',     'ux'],
  ['host_kyc',            'KYC / verification',              'host',     'ux'],
  ['host_payout',         'Payout / earnings',               'host',     'expected'],
  ['host_subscription',   'Subscription / plan',             'host',     'expected'],
  ['host_availability',   'Availability / calendar',         'host',     'ux'],
  ['account_login',       'Login / OTP',                     'account',  'product'],
  ['account_profile',     'Profile / settings',              'account',  'ux'],
  ['product_bug',         'Product bug / error',             'product',  'product'],
  ['how_to',              'How-to / guidance',               'guidance', 'expected'],
  ['other',               'Other',                           'other',    'unknown'],
].map(([code, label, category, type]) => ({ code, label, category, type }));

const BY_CODE = Object.fromEntries(REASONS.map((r) => [r.code, r]));
const isValidReason = (code) => Object.prototype.hasOwnProperty.call(BY_CODE, code);
// Conversations we could have prevented with a better product/UX.
const isProductCaused = (code) => ['product', 'ux'].includes(BY_CODE[code]?.type);

// Lightweight keyword → code guess to pre-fill the picker (agent can override).
const SUGGEST = [
  [/refund/i, 'pay_refund'],
  [/(double ?charge|charged twice|dispute|chargeback)/i, 'pay_dispute'],
  [/(payment (failed|declined)|card declined|couldn.?t pay)/i, 'pay_failed'],
  [/(listing|go ?live|not live|activ)/i, 'host_listing_live'],
  [/(kyc|verif|aadhaar|pan)/i, 'host_kyc'],
  [/(payout|earning|settle|get paid)/i, 'host_payout'],
  [/(subscription|plan|upgrade|renew)/i, 'host_subscription'],
  [/(calendar|availab|slot|google cal)/i, 'host_availability'],
  [/(reschedul)/i, 'booking_reschedule'],
  [/(cancel)/i, 'booking_cancel'],
  [/(no.?show)/i, 'no_show'],
  [/(otp|login|log ?in|sign ?in|can.?t access)/i, 'account_login'],
  [/(bug|error|broke|not working|glitch|crash)/i, 'product_bug'],
  [/(where.*booking|booking.*status|my booking)/i, 'booking_status'],
  [/(how (do|to)|guide|help me)/i, 'how_to'],
];
function suggestReason(text) {
  const t = String(text || '');
  for (const [re, code] of SUGGEST) if (re.test(t)) return code;
  return null;
}

module.exports = { REASONS, BY_CODE, isValidReason, isProductCaused, suggestReason };
