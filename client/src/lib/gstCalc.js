/**
 * gstCalc.js — pure GST math for the /tools/gst-calculator page.
 *
 * India GST on most professional/booking services is 18%; the picker also offers
 * the other statutory slabs (0/5/12/18/28). Handles both directions — add GST to a
 * net fee (exclusive) or extract GST already inside a gross fee (inclusive) — and
 * the intra-state CGST/SGST half-split. No DB, no side effects; unit-testable.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const GST_RATES = [0, 5, 12, 18, 28];

/**
 * @param {object} i
 * @param {number} i.amount        the fee entered (₹)
 * @param {number} i.ratePct       GST rate % (one of GST_RATES; any ≥0 accepted)
 * @param {boolean} [i.inclusive]  true = `amount` already includes GST (extract it);
 *                                 false (default) = `amount` is net, add GST on top.
 * @returns {{base:number, gst:number, total:number, cgst:number, sgst:number, ratePct:number}}
 */
export function gstBreakdown({ amount, ratePct, inclusive = false } = {}) {
  const a = num(amount);
  const r = num(ratePct);

  let base;
  let gst;
  let total;
  if (inclusive) {
    base = a / (1 + r / 100);
    gst = a - base;
    total = a;
  } else {
    base = a;
    gst = a * (r / 100);
    total = a + gst;
  }

  // Intra-state supply splits GST evenly into CGST + SGST; an inter-state supply
  // would be a single IGST of the same total (= gst). Shown as the common case.
  return { base, gst, total, cgst: gst / 2, sgst: gst / 2, ratePct: r };
}
