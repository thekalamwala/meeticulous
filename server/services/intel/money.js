/**
 * Intelligence · Revenue — the reconciliation, from `bookings` and nothing else.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §8.2, §9.1
 *
 * EVERY FIGURE HERE IS LIVE, never rolled up and never cached. That is a
 * deliberate constraint from the design: a host reconciling their earnings must
 * see numbers that cannot have drifted from what actually reached their bank.
 * A rollup can be stale, can be mid-recompute, can disagree with the ledger by
 * a rounding rule — and the moment it does, the page is worse than useless,
 * because it is wrong in a way the host cannot see. So: read the rows, add them
 * up, every time.
 *
 * It is also why this module is PURE. Given rows it returns figures, with no
 * database and no clock, so the arithmetic can be checked against a hand
 * reconciliation rather than against itself.
 *
 * The columns are the snapshot the payment path already writes (pricingEngine +
 * bookingCapture), so these are the same numbers the host was actually paid:
 *   customer_total      what the guest paid
 *   platform_fee_amount + platform_fee_gst     the guest-side fee
 *   commission_applied  + commission_gst       our cut (0% on Pro)
 *   razorpay_fee_actual + razorpay_tax_actual  the gateway's cut, borne by host
 *   refunded_amount     money returned
 *   vendor_amount       THE AUTHORITATIVE NET. Not recomputed here — see below.
 */

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** A booking counts as revenue only once the money actually arrived. */
const isPaid = (b) => b?.payment_status === 'paid';

/**
 * Net to the host.
 *
 * Reads `vendor_amount` rather than recomputing gross − fees − commission − tds
 * − tcs. Two reasons, and the second is the important one:
 *   1. bookingCapture already recomputed it with the REAL Razorpay fee once the
 *      payment captured; a provisional recomputation here would quietly differ.
 *   2. If this file recomputed net, a change to the pricing rules would silently
 *      restate history — last quarter's dashboard would start disagreeing with
 *      last quarter's payouts. The snapshot is the record.
 *
 * Falls back to the arithmetic only when the snapshot is absent, which happens
 * for older rows, and flags that it did so.
 */
function netOf(b) {
  if (b?.vendor_amount != null) return { net: n(b.vendor_amount), derived: false };
  const gross = n(b?.customer_total);
  const deductions = n(b?.commission_applied) + n(b?.commission_gst)
    + n(b?.razorpay_fee_actual) + n(b?.razorpay_tax_actual)
    + n(b?.tds_amount) + n(b?.tcs_amount)
    + n(b?.platform_fee_amount) + n(b?.platform_fee_gst);
  return { net: round2(gross - deductions), derived: true };
}

/**
 * The waterfall: gross down to net, every deduction named.
 *
 * Refunds are SUBTRACTED, not excluded. A refunded booking still charged a
 * gateway fee and still appears in the host's statement; dropping it would make
 * the page disagree with their bank for a reason they cannot see.
 */
function summarise(bookings = []) {
  const paid = bookings.filter(isPaid);

  let gross = 0, platformFee = 0, platformFeeGst = 0, commission = 0, commissionGst = 0;
  let razorpay = 0, tds = 0, tcs = 0, refunded = 0, net = 0, derivedCount = 0;

  for (const b of paid) {
    gross += n(b.customer_total);
    platformFee += n(b.platform_fee_amount);
    platformFeeGst += n(b.platform_fee_gst);
    commission += n(b.commission_applied);
    commissionGst += n(b.commission_gst);
    razorpay += n(b.razorpay_fee_actual) + n(b.razorpay_tax_actual);
    tds += n(b.tds_amount);
    tcs += n(b.tcs_amount);
    refunded += n(b.refunded_amount);
    const r = netOf(b);
    net += r.net;
    if (r.derived) derivedCount += 1;
  }

  const count = paid.length;

  return {
    bookings: count,
    gross: round2(gross),
    platformFee: round2(platformFee),
    platformFeeGst: round2(platformFeeGst),
    commission: round2(commission),
    commissionGst: round2(commissionGst),
    razorpayFee: round2(razorpay),
    tds: round2(tds),
    tcs: round2(tcs),
    refunded: round2(refunded),
    net: round2(net - refunded),
    // Average of what the GUEST paid, which is the number a host prices
    // against. Net AOV is a different question and gets its own key.
    aov: count ? round2(gross / count) : 0,
    netAov: count ? round2((net - refunded) / count) : 0,
    // Honesty marker: how many rows had no vendor_amount snapshot and had to be
    // derived. A non-zero value here is why a figure might not tie exactly.
    derivedRows: derivedCount,
  };
}

/** Settlement state — what has actually left our hands. */
function settlement(bookings = []) {
  const paid = bookings.filter(isPaid);
  let settled = 0, pending = 0;
  for (const b of paid) {
    const { net: amt } = netOf(b);
    if (b.settlement_status === 'settled' || b.settled_at) settled += amt;
    else pending += amt;
  }
  return { settled: round2(settled), pending: round2(pending) };
}

const titleOf = (b) => b?.services?.title || b?.service_title || 'Unknown';

/** Revenue by service, biggest first. */
function byService(bookings = []) {
  const map = new Map();
  for (const b of bookings.filter(isPaid)) {
    const key = titleOf(b);
    const cur = map.get(key) || { label: key, gross: 0, net: 0, bookings: 0 };
    cur.gross += n(b.customer_total);
    cur.net += netOf(b).net;
    cur.bookings += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, gross: round2(r.gross), net: round2(r.net) }))
    .sort((a, b) => b.gross - a.gross);
}

/** Revenue by calendar month, oldest first, keyed YYYY-MM. */
function byMonth(bookings = []) {
  const map = new Map();
  for (const b of bookings.filter(isPaid)) {
    const at = b.paid_at || b.created_at;
    if (!at) continue;
    const key = String(at).slice(0, 7);
    const cur = map.get(key) || { month: key, gross: 0, net: 0, bookings: 0 };
    cur.gross += n(b.customer_total);
    cur.net += netOf(b).net;
    cur.bookings += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, gross: round2(r.gross), net: round2(r.net) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Revenue concentration — the share from the top N guests.
 *
 * A genuine risk signal for a solo host: 70% of income from three people is a
 * different business from the same income spread over thirty, and nothing in
 * the console says so today.
 */
function concentration(bookings = [], top = 3) {
  const paid = bookings.filter(isPaid);
  const byGuest = new Map();
  for (const b of paid) {
    const key = b.client_id || b.guest_email || b.guest_phone || b.id;
    byGuest.set(key, (byGuest.get(key) || 0) + n(b.customer_total));
  }
  const totals = [...byGuest.values()].sort((a, b) => b - a);
  const gross = totals.reduce((s, v) => s + v, 0);
  const topSum = totals.slice(0, top).reduce((s, v) => s + v, 0);
  return {
    guests: totals.length,
    topN: top,
    // Null rather than 0 when there is no revenue: 0% would read as "no
    // concentration", which is a claim. There is simply nothing to measure.
    share: gross > 0 ? round2((topSum / gross) * 100) : null,
  };
}

/** Confirmed but not yet paid — firm money, not a projection. */
function upcoming(bookings = []) {
  const rows = bookings.filter(
    (b) => b?.payment_status !== 'paid'
      && b?.status !== 'cancelled'
      && n(b?.customer_total) > 0,
  );
  return {
    bookings: rows.length,
    value: round2(rows.reduce((s, b) => s + n(b.customer_total), 0)),
  };
}

module.exports = {
  isPaid, netOf, summarise, settlement, byService, byMonth, concentration, upcoming,
};
