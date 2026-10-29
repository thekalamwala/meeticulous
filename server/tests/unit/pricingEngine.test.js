/**
 * tests/unit/pricingEngine.test.js
 *
 * Marketplace money model (v4 — docs/payment-model.md v4):
 *   Guest pays     = servicePrice + platformFee + GST(platformFee)   (GST ON TOP of fee)
 *   platformFee    = flat configurable (default ₹10), 0 for free services
 *   commission     = commissionPercentage % of servicePrice — GST-INCLUSIVE (GST inside)
 *   commissionGst  = GST extracted from inside the commission
 *   razorpayFee    = always host-borne (actual recorded fee)
 *   tds            = 194-O, 1% of servicePrice (base only). Pass-through to govt.
 *   tcs            = Sec 52,  1% of servicePrice (base only). Pass-through to govt.
 *   Host payout    = servicePrice − commission − razorpayFee − tds − tcs
 *
 * Worked reference: host lists ₹1000, PG ₹20.24 (illustrative).
 *   Scenario B — free-plan host  (5% commission): payout 909.76
 *   Scenario A — Atish, paid plan (0% commission): payout 959.76
 */

'use strict';

const {
  calculatePlatformFee,
  calculateGst,
  calculateCommission,
  calculateCommissionGst,
  calculateCommissionTaxable,
  calculateTds,
  calculateTcs,
  calculateVendorPayout,
  calculateCustomerTotal,
  computeBreakdown,
  computeSubscriptionBreakdown,
} = require('../../lib/pricingEngine');

// ─── calculatePlatformFee ─────────────────────────────────────────────────────
describe('calculatePlatformFee', () => {
  test('flat ₹10 default for any paid service', () => {
    expect(calculatePlatformFee(100)).toBe(10);
    expect(calculatePlatformFee(1)).toBe(10);
    expect(calculatePlatformFee(5000)).toBe(10);
  });
  test('₹0 for a free service', () => {
    expect(calculatePlatformFee(0)).toBe(0);
  });
  test('chargeFeeOnFree: a ₹0 service still carries the flat fee (interim fee-only mode)', () => {
    expect(calculatePlatformFee(0, { chargeFeeOnFree: true })).toBe(10);
    expect(calculatePlatformFee(0, { chargeFeeOnFree: true, platformFee: 12 })).toBe(12);
  });
  test('admin-configurable override is honoured', () => {
    expect(calculatePlatformFee(100, { platformFee: 15 })).toBe(15);
    expect(calculatePlatformFee(100, { platformFee: 0 })).toBe(0);
  });
  test('negative service price throws', () => {
    expect(() => calculatePlatformFee(-1)).toThrow('servicePrice cannot be negative');
  });
});

// ─── calculateGst (on the platform fee, ADDED on top) ─────────────────────────
describe('calculateGst', () => {
  test('18% of ₹10 platform fee = ₹1.80', () => {
    expect(calculateGst(10)).toBe(1.8);
  });
  test('₹0 fee → ₹0 GST', () => {
    expect(calculateGst(0)).toBe(0);
  });
  test('configurable rate', () => {
    expect(calculateGst(10, { gstRate: 0.05 })).toBe(0.5);
  });
});

// ─── calculateCommission (GST-inclusive gross) ────────────────────────────────
describe('calculateCommission', () => {
  test('5% of ₹1000 = ₹50 (free plan, GST-inclusive)', () => {
    expect(calculateCommission(1000, 5)).toBe(50);
  });
  test('0% = ₹0 (paid plans)', () => {
    expect(calculateCommission(1000, 0)).toBe(0);
    expect(calculateCommission(5000, 0)).toBe(0);
  });
  test('percentage is flat on full price (no floor, no grace)', () => {
    expect(calculateCommission(500, 5)).toBe(25);
    expect(calculateCommission(100, 5)).toBe(5);
  });
  test('free service → ₹0', () => {
    expect(calculateCommission(0, 5)).toBe(0);
  });
  test('negative inputs throw', () => {
    expect(() => calculateCommission(-1, 5)).toThrow('servicePrice cannot be negative');
    expect(() => calculateCommission(100, -5)).toThrow('commissionPercentage cannot be negative');
  });
});

// ─── commission GST is EXTRACTED from inside (inclusive) ──────────────────────
describe('calculateCommissionGst / calculateCommissionTaxable (inclusive split)', () => {
  test('₹50 commission = ₹42.37 taxable + ₹7.63 GST', () => {
    expect(calculateCommissionTaxable(50)).toBe(42.37);
    expect(calculateCommissionGst(50)).toBe(7.63);
  });
  test('taxable + GST reconstitutes the gross commission', () => {
    const gross = 50;
    expect(calculateCommissionTaxable(gross) + calculateCommissionGst(gross)).toBe(50);
  });
  test('₹5 commission = ₹4.24 taxable + ₹0.76 GST', () => {
    expect(calculateCommissionTaxable(5)).toBe(4.24);
    expect(calculateCommissionGst(5)).toBe(0.76);
  });
  test('₹0 commission → ₹0 both', () => {
    expect(calculateCommissionGst(0)).toBe(0);
    expect(calculateCommissionTaxable(0)).toBe(0);
  });
});

// ─── TDS (194-O) + TCS (Sec 52) — 1% each of base ─────────────────────────────
describe('calculateTds / calculateTcs', () => {
  test('1% of ₹1000 = ₹10 each (default rates)', () => {
    expect(calculateTds(1000)).toBe(10);
    expect(calculateTcs(1000)).toBe(10);
  });
  test('no-PAN TDS rate 5% = ₹50', () => {
    expect(calculateTds(1000, { tdsRate: 0.05 })).toBe(50);
  });
  test('₹0 base → ₹0', () => {
    expect(calculateTds(0)).toBe(0);
    expect(calculateTcs(0)).toBe(0);
  });
  test('negative base throws', () => {
    expect(() => calculateTds(-1)).toThrow('servicePrice cannot be negative');
    expect(() => calculateTcs(-1)).toThrow('servicePrice cannot be negative');
  });
});

// ─── calculateVendorPayout (commission inclusive; PG + TDS + TCS host-borne) ──
describe('calculateVendorPayout', () => {
  test('Atish free plan ₹1000: 1000 − 50 − 20.24 − 10 − 10 = ₹909.76', () => {
    expect(calculateVendorPayout(1000, 50, 20.24, 10, 10)).toBe(909.76);
  });
  test('Atish paid plan ₹1000: 1000 − 0 − 20.24 − 10 − 10 = ₹959.76', () => {
    expect(calculateVendorPayout(1000, 0, 20.24, 10, 10)).toBe(959.76);
  });
  test('PG / TDS / TCS default to 0 when unknown', () => {
    expect(calculateVendorPayout(500, 25)).toBe(475);
  });
  test('negative TDS / TCS throw', () => {
    expect(() => calculateVendorPayout(100, 0, 0, -1)).toThrow('tds cannot be negative');
    expect(() => calculateVendorPayout(100, 0, 0, 0, -1)).toThrow('tcs cannot be negative');
  });
  test('negative fee throws', () => {
    expect(() => calculateVendorPayout(100, 0, -1)).toThrow('razorpayFee cannot be negative');
  });
});

// ─── calculateCustomerTotal ───────────────────────────────────────────────────
describe('calculateCustomerTotal', () => {
  test('₹1000 + ₹10 + ₹1.80 = ₹1011.80', () => {
    expect(calculateCustomerTotal(1000, 10, 1.8)).toBe(1011.8);
  });
  test('free service totals ₹0', () => {
    expect(calculateCustomerTotal(0, 0, 0)).toBe(0);
  });
});

// ─── computeBreakdown — worked examples from payment-model.md §2 ──────────────
describe('computeBreakdown — marketplace v4 worked examples (₹1000 listing)', () => {
  // PG ₹20.24 = illustrative 2% of the ₹1011.80 guest total.
  const PG = 20.24;

  test('Scenario B — free-plan host, 5% commission → payout ₹909.76', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 5, razorpayFee: PG });
    expect(b.platformFee).toBe(10);
    expect(b.gst).toBe(1.8);
    expect(b.commission).toBe(50);
    expect(b.commissionTaxable).toBe(42.37);
    expect(b.commissionGst).toBe(7.63);
    expect(b.tds).toBe(10);
    expect(b.tcs).toBe(10);
    expect(b.customerTotal).toBe(1011.8);
    expect(b.vendorPayout).toBe(909.76);       // 1000 − 50 − 20.24 − 10 − 10
    expect(b.platformRevenue).toBe(52.37);      // fee 10 + commission ex-GST 42.37
  });

  test('Scenario A — Atish (paid plan), 0% commission → payout ₹959.76', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 0, razorpayFee: PG });
    expect(b.commission).toBe(0);
    expect(b.commissionGst).toBe(0);
    expect(b.tds).toBe(10);
    expect(b.tcs).toBe(10);
    expect(b.customerTotal).toBe(1011.8);
    expect(b.vendorPayout).toBe(959.76);        // 1000 − 0 − 20.24 − 10 − 10
    expect(b.platformRevenue).toBe(10);         // platform fee only
  });

  test('razorpay fee unknown at booking time → payout excludes PG (finalised at capture)', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 5 });
    expect(b.razorpayFee).toBe(0);
    expect(b.tds).toBe(10);
    expect(b.tcs).toBe(10);
    expect(b.vendorPayout).toBe(930);           // 1000 − 50 − 0 − 10 − 10; PG deducted at capture
  });

  test('free service (₹0) accrues no fee, commission, TDS or TCS', () => {
    const b = computeBreakdown({ servicePrice: 0, commissionPercentage: 5 });
    expect(b.platformFee).toBe(0);
    expect(b.commission).toBe(0);
    expect(b.tds).toBe(0);
    expect(b.tcs).toBe(0);
    expect(b.customerTotal).toBe(0);
    expect(b.vendorPayout).toBe(0);
  });

  test('interim fee-only: ₹0 service with chargeFeeOnFree charges only the fee + GST', () => {
    const b = computeBreakdown({ servicePrice: 0, commissionPercentage: 5, chargeFeeOnFree: true });
    expect(b.platformFee).toBe(10);
    expect(b.gst).toBe(1.8);
    expect(b.commission).toBe(0);        // no host price → no commission
    expect(b.tds).toBe(0);               // no host sale → no TDS/TCS
    expect(b.tcs).toBe(0);
    expect(b.customerTotal).toBe(11.8);  // 0 + 10 + 1.80
    expect(b.vendorPayout).toBe(0);      // host gets nothing (no host money moves)
    expect(b.platformRevenue).toBe(10);  // BAS keeps the fee
  });

  test('custom platform fee + GST rate flow through', () => {
    const b = computeBreakdown({ servicePrice: 200, commissionPercentage: 5, platformFee: 20, gstRate: 0.18, razorpayFee: 4.72 });
    expect(b.platformFee).toBe(20);
    expect(b.gst).toBe(3.6);
    expect(b.commission).toBe(10);
    expect(b.customerTotal).toBe(223.6);
    expect(b.tds).toBe(2);                       // 1% of 200
    expect(b.tcs).toBe(2);
    expect(b.vendorPayout).toBe(181.28);         // 200 − 10 − 4.72 − 2 − 2
  });

  test('configurable TDS rate (no-PAN 5%) flows through', () => {
    const b = computeBreakdown({ servicePrice: 1000, commissionPercentage: 0, razorpayFee: PG, tdsRate: 0.05 });
    expect(b.tds).toBe(50);
    expect(b.vendorPayout).toBe(919.76);         // 1000 − 0 − 20.24 − 50 − 10
  });
});

// ─── subscriptions unchanged (GST ON TOP of plan price) ───────────────────────
describe('computeSubscriptionBreakdown (unchanged, PRD §5.2)', () => {
  test('₹999 → GST 179.82, total 1178.82', () => {
    const s = computeSubscriptionBreakdown({ planPrice: 999, gstRate: 0.18 });
    expect(s.gstAmount).toBe(179.82);
    expect(s.totalCharged).toBe(1178.82);
  });
});

// ── platformNetFromBooking ──────────────────────────────────────────────────
// platform_fee_amount is stored EX-GST; commission_applied is GST-INCLUSIVE.
// Adding them raw reported the commission's GST as revenue while the same
// rupees were ALSO reported under taxes, and added a third time when gross was
// computed as revenue + taxes. These pin the published /host-fees ₹1,000 case.
describe('platformNetFromBooking', () => {
  const { platformNetFromBooking } = require('../../lib/pricingEngine');

  // ₹1,000 free-plan booking: fee ₹10 + GST ₹1.80, commission ₹50 incl ₹7.63 GST.
  const FREE_PLAN_ROW = {
    platform_fee_amount: 10, platform_fee_gst: 1.8,
    commission_applied: 50, commission_gst: 7.63, gst_rate: 0.18,
  };

  test('uses the commission EX-GST, not the inclusive figure', () => {
    expect(platformNetFromBooking(FREE_PLAN_ROW)).toBe(52.37);   // 10 + 42.37
    // The old expression, kept here as the thing that must never come back.
    const naive = FREE_PLAN_ROW.platform_fee_amount + FREE_PLAN_ROW.commission_applied;
    expect(naive).toBe(60);
    expect(platformNetFromBooking(FREE_PLAN_ROW)).not.toBe(naive);
  });

  test('net + taxes reconciles to what the guest actually paid us', () => {
    const net = platformNetFromBooking(FREE_PLAN_ROW);
    const taxes = FREE_PLAN_ROW.platform_fee_gst + FREE_PLAN_ROW.commission_gst; // 9.43
    // Guest paid the ₹10 fee + ₹1.80 GST; the host bore the ₹50 commission.
    expect(Math.round((net + taxes) * 100) / 100).toBe(61.8);
  });

  test('paid plan (0% commission) is just the fee', () => {
    expect(platformNetFromBooking({
      platform_fee_amount: 10, platform_fee_gst: 1.8, commission_applied: 0, commission_gst: 0,
    })).toBe(10);
  });

  test('derives the commission GST when the column was not selected', () => {
    // Same row without commission_gst — falls back to the booking's own gst_rate.
    expect(platformNetFromBooking({
      platform_fee_amount: 10, commission_applied: 50, gst_rate: 0.18,
    })).toBe(52.37);
  });

  test('defaults to 18% when neither commission_gst nor gst_rate is present', () => {
    expect(platformNetFromBooking({ platform_fee_amount: 10, commission_applied: 50 })).toBe(52.37);
  });

  test('a free (₹0) booking yields nothing', () => {
    expect(platformNetFromBooking({ platform_fee_amount: 0, commission_applied: 0 })).toBe(0);
  });

  test('missing / malformed rows never produce negative revenue', () => {
    expect(platformNetFromBooking(null)).toBe(0);
    expect(platformNetFromBooking({})).toBe(0);
    expect(platformNetFromBooking({ commission_applied: 10, commission_gst: 999 })).toBe(0);
  });
});
