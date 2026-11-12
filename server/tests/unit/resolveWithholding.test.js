/**
 * tests/unit/resolveWithholding.test.js
 *
 * The tds_tcs_v2 rate-selection rules (docs/tds-tcs-withholding-design.md §3).
 * Money-critical: a wrong rate here under/over-withholds real host payouts.
 *
 * Rule table (FY2026-27 defaults):
 *   flag OFF                                   → legacy 1% TDS + 1% TCS
 *   no PAN                                     → 5% TDS,   0.5% TCS
 *   individual/HUF + PAN, FY gross ≤ ₹5L       → 0% TDS,   0.5% TCS
 *   individual/HUF + PAN, FY gross > ₹5L       → 0.1% TDS, 0.5% TCS
 *   individual/HUF + PAN, FY gross UNKNOWN     → 0.1% TDS, 0.5% TCS  (fail toward deducting)
 *   company/firm/LLP + PAN                     → 0.1% TDS, 0.5% TCS  (no threshold)
 */
const { resolveWithholding, WITHHOLDING_DEFAULTS, LEGACY_WITHHOLDING } = require('../../lib/pricingEngine');

const D = WITHHOLDING_DEFAULTS;

describe('resolveWithholding — tds_tcs_v2 rate rules', () => {
  test('flag OFF → legacy 1% + 1%, whatever the context', () => {
    expect(resolveWithholding({ enabled: false, entityType: 'company_firm_llp', hasPan: false }))
      .toEqual({ ...LEGACY_WITHHOLDING });
    expect(LEGACY_WITHHOLDING).toEqual({ tdsRate: 0.01, tcsRate: 0.01 });
  });

  test('no PAN → 5% TDS + standard TCS (overrides entity/threshold)', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: false, fyGrossToDate: 0,
    })).toEqual({ tdsRate: D.tdsRateNoPan, tcsRate: D.tcsRate });
  });

  test('individual/HUF + PAN, FY gross ≤ ₹5L → TDS exempt (0%)', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true, fyGrossToDate: 100000,
    })).toEqual({ tdsRate: 0, tcsRate: D.tcsRate });
  });

  test('threshold is inclusive — exactly ₹5L is still exempt', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true, fyGrossToDate: D.tdsThresholdIndividual,
    })).toEqual({ tdsRate: 0, tcsRate: D.tcsRate });
  });

  test('individual/HUF + PAN, FY gross > ₹5L → 0.1% TDS', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true, fyGrossToDate: D.tdsThresholdIndividual + 1,
    })).toEqual({ tdsRate: D.tdsRate, tcsRate: D.tcsRate });
  });

  test('individual/HUF + PAN, FY gross UNKNOWN (null) → DEDUCT, never exempt', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true, fyGrossToDate: null,
    })).toEqual({ tdsRate: D.tdsRate, tcsRate: D.tcsRate });
    // undefined is treated the same (fail toward deducting)
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true,
    }).tdsRate).toBe(D.tdsRate);
  });

  test('company/firm/LLP + PAN → 0.1% from ₹1, no threshold even with low gross', () => {
    expect(resolveWithholding({
      enabled: true, entityType: 'company_firm_llp', hasPan: true, fyGrossToDate: 0,
    })).toEqual({ tdsRate: D.tdsRate, tcsRate: D.tcsRate });
  });

  test('unknown/missing entity type defaults to NOT exempt (deducts)', () => {
    expect(resolveWithholding({
      enabled: true, hasPan: true, fyGrossToDate: 100000, // under threshold but entity unknown
    })).toEqual({ tdsRate: D.tdsRate, tcsRate: D.tcsRate });
  });

  test('config overrides are honoured (CA-set rates from platform_settings)', () => {
    const config = { tdsRate: 0.002, tdsRateNoPan: 0.06, tcsRate: 0.0075, tdsThresholdIndividual: 1000000 };
    expect(resolveWithholding({ enabled: true, hasPan: false, config }))
      .toEqual({ tdsRate: 0.06, tcsRate: 0.0075 });
    expect(resolveWithholding({
      enabled: true, entityType: 'individual_huf', hasPan: true, fyGrossToDate: 900000, config,
    })).toEqual({ tdsRate: 0, tcsRate: 0.0075 }); // 900k ≤ new 1M threshold → exempt
  });
});
