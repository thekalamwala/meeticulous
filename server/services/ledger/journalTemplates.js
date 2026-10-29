/**
 * journalTemplates.js — pure builders of balanced journal lines.
 * No DB, no side effects. Output shape consumed by postingService:
 *   { description, lines: [{ account_code, debit, credit, vendor_id?, order_item_id?, subscription_payment_id? }] }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LEDGER LEGEND — whose money is in each account, and its normal balance.
 * Read this once and every entry below is self-explanatory. Full worked examples
 * (booking + subscription) live in docs/ledger.md. The four owners are:
 *   • BAS revenue        — Book A Sloth keeps it (fee + commission + subs, ex-GST)
 *   • Host pass-through  — the host's money, a liability we owe on to the host
 *   • Government payable  — GST / TDS(194-O) / TCS(§52); collected, never revenue
 *   • Razorpay cost      — gateway MDR; host-borne on bookings, BAS-borne on subs
 *
 *  Code  Account                Normal  Owner                Meaning
 *  1000  Bank                   DEBIT   BAS asset            Cash actually in bank
 *  1100  Razorpay Receivable    DEBIT   BAS asset            Collected by Razorpay, not yet settled to bank
 *  2000  Vendor Payables        CREDIT  Host pass-through    Host's net payout we still owe the host
 *  2100  GST Payable            CREDIT  Government payable    GST collected, owed to the government
 *  2200  Refund Liability       CREDIT  BAS liability        Refund owed but not yet paid out (reserved)
 *  2300  TDS Payable            CREDIT  Government payable    194-O income-tax withheld from the host
 *  2400  TCS Payable            CREDIT  Government payable    §52 GST-TCS collected from the host
 *  4000  Platform Fee Revenue   CREDIT  BAS revenue          Booking fee (ex-GST) — BAS earns
 *  4100  Commission Revenue     CREDIT  BAS revenue          Commission (ex-GST) — BAS earns
 *  4200  Subscription Revenue   CREDIT  BAS revenue          Host plan fee (ex-GST) — BAS earns
 *  5000  Razorpay Charges Ord.  DEBIT   Razorpay cost        Booking gateway MDR — HOST-borne (nets to 0 here)
 *  5100  Razorpay Charges Subs  DEBIT   Razorpay cost        Subscription gateway MDR — BAS-borne (real expense)
 *  5200  Settlement Charges     DEBIT   Razorpay cost        Payout/settlement fees — BAS-borne
 *  5300  Refund Losses          DEBIT   BAS cost             Refund money BAS eats (e.g. non-recoverable MDR)
 *  5400  Referral Expense       DEBIT   BAS cost             Host referral reward — marketing spend
 *
 * Every template below balances (Σ debit === Σ credit); the DB RPC re-checks it.
 * The host's SERVICE PRICE is never booked as BAS revenue — it flows straight
 * into Vendor Payables (2000) and out again at settlement.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Order-payment template (deviation from PRD §11.1, documented in the plan):
 * gross receivable + same-entry gateway-fee relief, so Razorpay Receivable
 * always equals the net cash Razorpay will remit, gateway charges are visible
 * on the 5000 debit side, and the expense nets 0 (vendor bears the fee).
 */
'use strict';

const { ACCOUNTS } = require('../../lib/ledgerAccounts');
const { round2 } = require('../../lib/pricingEngine');

const line = (account_code, side, amount, tags = {}) => {
  const value = round2(amount);
  if (!Number.isFinite(value)) {
    throw new Error(`journal line for account ${account_code} has a non-numeric amount (${amount})`);
  }
  return {
    account_code,
    debit:  side === 'debit'  ? value : 0,
    credit: side === 'credit' ? value : 0,
    ...tags,
  };
};

/** ORDER_PAYMENT — from the booking's immutable snapshot (v2.8 columns). */
function orderPaymentEntry(snapshot) {
  const tags = { vendor_id: snapshot.host_id, order_item_id: snapshot.booking_id };
  const gatewayTotal = round2(Number(snapshot.razorpay_fee_actual || 0) + Number(snapshot.razorpay_tax_actual || 0));
  const gstTotal = round2(Number(snapshot.platform_fee_gst || 0) + Number(snapshot.commission_gst || 0));

  // The host bears the gateway fee only when they were actually paid something
  // (it was netted out of vendor_amount). On a ₹0 fee-only booking the host is
  // owed nothing, so BAS — which kept the booking fee — bears the MDR instead.
  const hostBorneFee = Number(snapshot.vendor_amount) > 0;

  const lines = [
    // BAS asset — cash Razorpay collected from the guest (gross of gateway MDR).
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', snapshot.customer_total, tags),
  ];
  if (Number(snapshot.vendor_amount) > 0) {
    // Host pass-through — the host's net payout we now owe the host (NOT revenue).
    // Skipped entirely when 0: post_journal_entry rejects a zero-value line
    // ("each line must have exactly one of debit/credit > 0").
    lines.push(line(ACCOUNTS.VENDOR_PAYABLES, 'credit', snapshot.vendor_amount, tags));
  }
  if (Number(snapshot.platform_fee_amount) > 0) {
    // BAS revenue — the booking fee, ex-GST.
    lines.push(line(ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit', snapshot.platform_fee_amount, tags));
  }
  // Government payable — GST on the fee + GST inside the commission (never revenue).
  if (gstTotal > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', gstTotal, tags));
  if (Number(snapshot.commission_applied) > 0) {
    // v4: commission is GST-inclusive, so revenue books at the ex-GST taxable value
    // (its GST is already in gstTotal). Legacy pre-v4 rows have no commission_taxable
    // snapshot — those booked commission GST on top, so credit the gross amount to
    // keep the historical entry balanced.
    const commissionRevenue = snapshot.commission_taxable != null
      ? Number(snapshot.commission_taxable)
      : Number(snapshot.commission_applied);
    // BAS revenue — commission, ex-GST (its GST is already inside gstTotal above).
    lines.push(line(ACCOUNTS.COMMISSION_REVENUE, 'credit', commissionRevenue, tags));
  }
  // Government payable — v4 statutory withholdings collected from the host.
  const tds = round2(Number(snapshot.tds_amount || 0));
  const tcs = round2(Number(snapshot.tcs_amount || 0));
  if (tds > 0) lines.push(line(ACCOUNTS.TDS_PAYABLE, 'credit', tds, tags));   // 194-O income-tax
  if (tcs > 0) lines.push(line(ACCOUNTS.TCS_PAYABLE, 'credit', tcs, tags));   // §52 GST-TCS
  if (gatewayTotal > 0 && hostBorneFee) {
    // Razorpay cost, HOST-borne: MDR is deducted from the remittance, so relieve
    // the receivable and expense it, then credit the expense back — the 5000
    // account nets to 0 because the host (not BAS) bears it (already netted out
    // of vendor_amount). It stays visible on both sides for auditability.
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'credit', gatewayTotal, tags));
  } else if (gatewayTotal > 0) {
    // Razorpay cost, BAS-borne (fee-only ₹0 service — the host is owed nothing,
    // so no payout absorbed the MDR). Mirror the subscription path: a REAL
    // platform expense with no credit-back. Relieve the receivable to the net
    // cash Razorpay actually remits, and book the fee as a 5000 expense. This is
    // what keeps a fee-only booking's entry balanced with no negative/zero line.
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
  }
  return {
    description: `Order payment — booking ${snapshot.booking_id}`,
    lines,
  };
}

/** SUBSCRIPTION_PAYMENT — gateway fee is a PLATFORM expense (PRD §5.3/§11.3). */
function subscriptionPaymentEntry(payment) {
  const tags = { vendor_id: payment.vendor_id, subscription_payment_id: payment.id };
  const gatewayTotal = round2(Number(payment.razorpay_fee || 0) + Number(payment.razorpay_tax || 0));

  const lines = [
    // BAS asset — cash Razorpay collected from the host for their plan.
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', payment.total_charged, tags),
    // BAS revenue — the plan price, ex-GST (subscription IS a BAS sale to the host).
    line(ACCOUNTS.SUBSCRIPTION_REVENUE, 'credit', payment.plan_price, tags),
  ];
  // Government payable — 18% GST added ON TOP of the plan price.
  if (Number(payment.gst_amount) > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', payment.gst_amount, tags));
  if (gatewayTotal > 0) {
    // Razorpay cost, BAS-borne: on subscriptions BAS eats the MDR, so the 5100
    // expense is REAL (no credit-back) — it stays as a platform cost.
    lines.push(line(ACCOUNTS.RZP_CHARGES_SUBS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
  }
  return {
    description: `Subscription payment — ${payment.plan_type || 'plan'} by vendor ${payment.vendor_id}`,
    lines,
  };
}

/**
 * PRODUCT_PAYMENT — paid digital product. Customer pays price + platform_fee.
 * Products carry NO commission and the checkout charges NO GST, so those legs
 * are absent. Gateway fee is VENDOR-borne (mirrors orderPaymentEntry): the
 * expense nets to 0 and is already subtracted from vendor_amount.
 * customer_total / vendor_amount fall back to derivation from price + fee when
 * the snapshot omits them (pre-v3.37 rows healed by the reconciler).
 */
function productPaymentEntry(snapshot) {
  const tags = { vendor_id: snapshot.host_id, order_item_id: snapshot.purchase_id };
  const price = Number(snapshot.product_price || 0);
  const platformFee = round2(Number(snapshot.platform_fee || 0));
  const gatewayTotal = round2(Number(snapshot.razorpay_fee_actual || 0) + Number(snapshot.razorpay_tax_actual || 0));
  const customerTotal = round2(snapshot.customer_total != null ? snapshot.customer_total : price + platformFee);
  const vendorAmount = round2(snapshot.vendor_amount != null ? snapshot.vendor_amount : price - gatewayTotal);

  const lines = [
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', customerTotal, tags),
    line(ACCOUNTS.VENDOR_PAYABLES, 'credit', vendorAmount, tags),
  ];
  if (platformFee > 0) {
    lines.push(line(ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit', platformFee, tags));
  }
  if (gatewayTotal > 0) {
    // Gateway deducts its fee from the remittance (relieve receivable)…
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
    // …and the vendor bears it (already netted out of vendor_amount).
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'credit', gatewayTotal, tags));
  }
  return {
    description: `Product payment — purchase ${snapshot.purchase_id}`,
    lines,
  };
}

/** BANK_TRANSFER — Razorpay settlement remitted to the bank (PRD §11.6). */
function bankTransferEntry({ amount, reference }) {
  return {
    description: `Razorpay → bank transfer ${reference || ''}`.trim(),
    lines: [
      line(ACCOUNTS.BANK, 'debit', amount),
      line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', amount),
    ],
  };
}

/** SETTLEMENT (vendor payout) — relieve Vendor Payables when cash is sent. */
function payoutEntry({ host_id, amount, reference }) {
  const tags = { vendor_id: host_id };
  return {
    description: `Vendor payout ${reference || ''}`.trim(),
    lines: [
      line(ACCOUNTS.VENDOR_PAYABLES, 'debit', amount, tags),
      line(ACCOUNTS.BANK, 'credit', amount, tags),
    ],
  };
}

/** RESCHEDULE_FEE — platform keeps the fee; platform bears the gateway charge. */
function rescheduleFeeEntry({ booking_id, host_id, fee, gstRate = 0.18, razorpay_fee = 0, razorpay_tax = 0 }) {
  const tags = { vendor_id: host_id, order_item_id: booking_id };
  const gross = round2(fee);
  // Fee is GST-inclusive: revenue = gross / (1+gstRate); gst = remainder.
  const net = round2(gross / (1 + gstRate));
  const gst = round2(gross - net);
  const gatewayTotal = round2(Number(razorpay_fee || 0) + Number(razorpay_tax || 0));
  const lines = [
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit', gross, tags),
    line(ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit', net, tags),
  ];
  if (gst > 0) lines.push(line(ACCOUNTS.GST_PAYABLE, 'credit', gst, tags));
  if (gatewayTotal > 0) {
    lines.push(line(ACCOUNTS.RZP_CHARGES_ORDERS, 'debit', gatewayTotal, tags));
    lines.push(line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', gatewayTotal, tags));
  }
  return { description: `Reschedule fee — booking ${booking_id}`, lines };
}

/**
 * REFERRAL_REWARD — host referral bonus (v3.77). A marketing expense that
 * credits the referrer's payable balance; the cash is later withdrawn through
 * the normal payout rail (which posts its own SETTLEMENT entry Vendor Payables →
 * Bank). Posted at release, after the hold window survives.
 */
function referralRewardEntry({ host_id, amount }) {
  const tags = { vendor_id: host_id };
  return {
    description: `Referral reward — host ${host_id}`,
    lines: [
      line(ACCOUNTS.REFERRAL_EXPENSE, 'debit', amount, tags),
      line(ACCOUNTS.VENDOR_PAYABLES, 'credit', amount, tags),
    ],
  };
}

/**
 * REFUND — records cash refunded to a guest against a paid booking.
 *
 * LOOPHOLE FIX: refunds are issued MANUALLY in the Razorpay dashboard (no refund
 * API call anywhere), and the webhook ignored `refund.*`. So refund cash left
 * the Razorpay balance with NO journal entry: Vendor Payables (2000) stayed
 * credited forever (the books said we still owed the host money we had clawed
 * back), and nothing recorded the outflow. This entry closes that gap.
 *
 * The refund is split into a PRICE bucket and a FEE bucket, each reclaimed from
 * OUR credits, so the entry is correct for both policy cases in
 * docs/payment-model.md without guessing the reason:
 *   §5.4 guest cancels  → refund = the host's price only (fee + MDR retained):
 *                         only the PRICE bucket runs — reverses Vendor Payables +
 *                         TDS + TCS + commission; the non-recoverable MDR share of
 *                         the price falls to Refund Losses. The fee is untouched.
 *   §5.5 host no-show    → refund = the full guest total: both buckets run —
 *                         every leg reverses, MDR included, ending at Refund Losses.
 * The refund up to `service_price` is the price bucket; anything above it is the
 * fee bucket. Whatever a bucket cannot map to a reversible credit (chiefly the
 * gateway MDR Razorpay keeps on a refund) lands in Refund Losses (5300) — money
 * BAS actually eats. The entry always balances to the refund amount.
 *
 * Owner of each debit leg is labelled inline. Credit is the cash leaving via the
 * Razorpay balance (reduces the BAS asset 1100).
 *
 * NOTE: assumes the host has NOT yet been paid (the held-transfer + hold window
 * exist precisely so refunds happen first; the refund webhook also reverses the
 * held transfer). If the host was already settled, book a manual clawback
 * adjustment (Vendor Payables would already be relieved for that booking).
 *
 * @param {object} a
 * @param {string} a.booking_id
 * @param {string} a.host_id
 * @param {number} a.refund_amount        ₹ actually refunded to the guest
 * @param {string} [a.refund_id]          Razorpay refund id (for the description)
 * @param {number} [a.service_price]      host listed price — the price/fee split point
 * @param {number} [a.vendor_amount]      host net payout on the booking snapshot
 * @param {number} [a.commission_taxable] commission ex-GST (BAS revenue to reverse)
 * @param {number} [a.commission_gst]     GST inside the commission
 * @param {number} [a.platform_fee_amount] booking fee ex-GST
 * @param {number} [a.platform_fee_gst]   GST on the booking fee
 * @param {number} [a.tds_amount]         194-O TDS withheld
 * @param {number} [a.tcs_amount]         §52 TCS collected
 */
function refundEntry({
  booking_id, host_id, refund_amount, refund_id, service_price = 0,
  vendor_amount = 0, commission_taxable = 0, commission_gst = 0,
  platform_fee_amount = 0, platform_fee_gst = 0, tds_amount = 0, tcs_amount = 0,
}) {
  const tags = { vendor_id: host_id, order_item_id: booking_id };
  const total = round2(refund_amount);
  if (!(total > 0)) throw new Error(`refundEntry needs a positive refund_amount (got ${refund_amount})`);

  const debits = [];
  // Reclaim a bucket of the refund from OUR credits in order; each debit is
  // capped at what the credit holds AND at what is left in the bucket. Whatever
  // the bucket can't map to a credit falls to Refund Losses (the MDR BAS eats).
  const runBucket = (bucketAmount, legs) => {
    let remaining = round2(bucketAmount);
    if (!(remaining > 0)) return;
    for (const [account, available] of legs) {
      const amt = round2(Math.min(remaining, round2(Number(available) || 0)));
      if (amt > 0) {
        debits.push(line(account, 'debit', amt, tags));
        remaining = round2(remaining - amt);
      }
    }
    if (remaining > 0) {
      // BAS cost — the part BAS cannot reclaim (the gateway MDR Razorpay keeps on
      // a refund). A real loss on the platform's books.
      debits.push(line(ACCOUNTS.REFUND_LOSSES, 'debit', remaining, tags));
    }
  };

  // PRICE bucket (refund up to the host's price) — the money a guest-cancel
  // refund returns. Reverses the host's payable, the govt withholdings on the
  // price, and the commission. Fee legs are NOT here, so a price-only refund
  // never touches the (retained) booking fee.
  const priceBucket = Math.min(total, round2(service_price) || total);
  runBucket(priceBucket, [
    [ACCOUNTS.VENDOR_PAYABLES, vendor_amount],       // Host pass-through — no longer owed to host
    [ACCOUNTS.TDS_PAYABLE, tds_amount],              // Government payable — 194-O reversed
    [ACCOUNTS.TCS_PAYABLE, tcs_amount],              // Government payable — §52 reversed
    [ACCOUNTS.COMMISSION_REVENUE, commission_taxable], // BAS revenue — commission un-earned
    [ACCOUNTS.GST_PAYABLE, commission_gst],          // Government payable — commission GST reversed
  ]);
  // FEE bucket (refund above the price) — only a full refund reaches it. Reverses
  // the booking fee BAS earned and its GST.
  runBucket(round2(total - priceBucket), [
    [ACCOUNTS.PLATFORM_FEE_REVENUE, platform_fee_amount], // BAS revenue — fee un-earned
    [ACCOUNTS.GST_PAYABLE, platform_fee_gst],             // Government payable — fee GST reversed
  ]);

  const lines = [
    ...debits,
    // BAS asset — cash leaving via the Razorpay balance to the guest.
    line(ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit', total, tags),
  ];
  return {
    description: `Refund — booking ${booking_id}${refund_id ? ` (${refund_id})` : ''}`,
    lines,
  };
}

/** ADJUSTMENT — admin-supplied balanced lines (validated again by the RPC). */
function adjustmentEntry({ description, lines }) {
  return { description: description || 'Manual adjustment', lines };
}

/**
 * REVERSAL — mirror of an existing entry's lines.
 * Caller must supply lines with `account_code` (persisted journal_lines rows
 * carry account_id only — join chart_of_accounts before calling).
 */
function reversalEntry(original) {
  return {
    description: `Reversal of ${original.journal_number}`,
    lines: original.lines.map((l) => ({
      account_code: l.account_code,
      debit: round2(l.credit || 0),
      credit: round2(l.debit || 0),
      vendor_id: l.vendor_id || null,
      order_item_id: l.order_item_id || null,
      subscription_payment_id: l.subscription_payment_id || null,
    })),
  };
}

module.exports = {
  orderPaymentEntry,
  subscriptionPaymentEntry,
  productPaymentEntry,
  bankTransferEntry,
  payoutEntry,
  referralRewardEntry,
  rescheduleFeeEntry,
  refundEntry,
  adjustmentEntry,
  reversalEntry,
};
