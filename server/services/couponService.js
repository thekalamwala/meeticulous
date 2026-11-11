'use strict';
/**
 * couponService — host discount codes applied at booking time.
 *
 * A coupon reduces the SERVICE PRICE; the host eats their own promo and commission /
 * TDS / GST recompute on the discounted price (see bookingController). The booking row
 * is the redemption record (coupon_id + discount_amount); times_redeemed is a counter.
 */
const { supabaseAdmin } = require('../config/supabase');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Discount (₹) a coupon gives on a service price. Pure; never exceeds the price. */
function computeDiscount(coupon, servicePrice) {
  const price = Number(servicePrice) || 0;
  const raw = coupon.discount_type === 'percent'
    ? (price * Number(coupon.discount_value)) / 100
    : Number(coupon.discount_value) || 0;
  return round2(Math.min(price, Math.max(0, raw)));
}

/**
 * Validate a code for a host + service price.
 * @returns {Promise<{ ok: boolean, coupon?, discount?: number, reason?: string }>}
 */
async function validate(code, { hostId, servicePrice }) {
  const c = String(code || '').trim();
  if (!c) return { ok: false, reason: 'Enter a coupon code.' };
  if (!(Number(servicePrice) > 0)) return { ok: false, reason: 'Coupons apply to paid services only.' };

  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .eq('host_id', hostId)
    .ilike('code', c) // case-insensitive exact match (no % wildcards in `c`)
    .maybeSingle();

  if (error || !coupon) return { ok: false, reason: 'Invalid coupon code.' };
  if (!coupon.active) return { ok: false, reason: 'This coupon is no longer active.' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now())
    return { ok: false, reason: 'This coupon has expired.' };
  if (coupon.max_redemptions != null && coupon.times_redeemed >= coupon.max_redemptions)
    return { ok: false, reason: 'This coupon has reached its limit.' };
  if (Number(servicePrice) < Number(coupon.min_amount || 0))
    return { ok: false, reason: `Applies to bookings of ₹${Math.round(coupon.min_amount)} or more.` };

  const discount = computeDiscount(coupon, servicePrice);
  if (discount <= 0) return { ok: false, reason: 'This coupon gives no discount here.' };
  return { ok: true, coupon, discount };
}

/** Bump the redemption counter (atomic). Best-effort — booking.coupon_id is authoritative. */
async function redeem(couponId) {
  try {
    await supabaseAdmin.rpc('increment_coupon_redemption', { c_id: couponId });
  } catch (_) { /* advisory counter; the booking row records the real redemption */ }
}

module.exports = { computeDiscount, validate, redeem };
