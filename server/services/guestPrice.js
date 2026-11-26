/**
 * guestPrice — what a guest pays for a catalog item, for the HOST's own lists.
 *
 * The Kept Catalog shows each item's price "incl. fees" (founder call,
 * 2026-11-26). That figure must come from the server and must match checkout,
 * so this file adds NO money maths of its own: it calls the same pricingEngine
 * functions, with the same inputs, as the code that charges the guest:
 *
 *   service  bookingController.createBooking — price_on_request books as a ₹0
 *            enquiry with no fee; under fee-only mode a ₹0 service still owes the
 *            booking fee (chargeFeeOnFree), except price-on-request.
 *   product  paymentController.createProductOrder / productController public read
 *   course   courseController.createCourseOrder
 *            — price + platform fee + GST on the fee; a free item carries no fee.
 *
 * A coupon is applied per booking, so it is never in this figure. Display only:
 * nothing here is stored or charged. Best-effort: if config can't be read, the
 * rows go back untouched and the client shows the listed price alone.
 */
'use strict';

const { calculatePlatformFee, calculateGst, calculateCustomerTotal, round2 } = require('../lib/pricingEngine');
const platformConfig = require('./platformConfig');
const { feeOnlyForHost } = require('./paidMode');

/** Pure. `price` + fee + GST on the fee, as checkout computes it. */
function guestPrice(price, { platformFee, gstRate, chargeFeeOnFree = false } = {}) {
  const p = Math.max(0, Number(price) || 0);
  const fee = calculatePlatformFee(p, { platformFee, chargeFeeOnFree });
  const gst = calculateGst(fee, { gstRate });
  return { guest_total: calculateCustomerTotal(p, fee, gst), booking_fee: round2(fee + gst) };
}

/** Pure. A service row → its guest price under the host's mode. */
function serviceGuestPrice(svc, cfg, feeOnly) {
  const onRequest = svc?.price_on_request === true;
  return guestPrice(onRequest ? 0 : svc?.price, {
    platformFee: cfg.platformFee, gstRate: cfg.gstRate, chargeFeeOnFree: !!feeOnly && !onRequest,
  });
}

/**
 * Add guest_total + booking_fee to each row of a host's own list.
 * kind: 'service' | 'product' | 'course'.
 */
async function withGuestPrices(rows, kind, hostId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  try {
    const cfg = await platformConfig.getConfig();
    const feeOnly = kind === 'service' ? await feeOnlyForHost(hostId) : false;
    return rows.map((r) => ({
      ...r,
      ...(kind === 'service'
        ? serviceGuestPrice(r, cfg, feeOnly)
        : guestPrice(r.price, { platformFee: cfg.platformFee, gstRate: cfg.gstRate })),
    }));
  } catch (_) {
    return rows;
  }
}

module.exports = { guestPrice, serviceGuestPrice, withGuestPrices };
