/**
 * Withholding RATES — the statutory assertions.
 * CA ruling 2026-11-17, Gate A on Q4. See PR #371.
 *
 * This is the only file in the repo that asserts a rate. Everything else that
 * touches withholding tests arithmetic with deliberately non-statutory numbers,
 * so that a changed rate cannot be "fixed" into a fixture and mistaken for
 * validation. If a rate is wrong, it is wrong HERE, loudly, in one place.
 *
 * What is in force (FY 2026-27):
 *   · Income tax  0.1%  — s.393(1) Table Sl. 8(v), IT Act 2025 (was 194-O),
 *                          cut from 1% w.e.f. 01-Oct-2024
 *   · No PAN      5%    — the §206AA-equivalent floor
 *   · Exemption   ₹5L   — resident individual/HUF with PAN, per FY
 *   · GST TCS     0.5%  — s.52 CGST, cut from 1% w.e.f. 10-Jul-2024
 *                          (Notif. 15/2024-CT), and NIL without a GSTIN
 *
 * These assertions describe the v2 engine, which ships behind `tds_tcs_v2`.
 * That flag is OFF, so the LIVE path still withholds the legacy 1% + 1%. That
 * gap is a live-money question raised on #371, not something a test can settle
 * — the legacy branch is asserted below as what it is, not as what is correct.
 */
const { resolveWithholding } = require('../../lib/pricingEngine');

const v2 = (over = {}) => resolveWithholding({
  enabled: true, entityType: 'company', hasPan: true, hasGstin: true, ...over,
});

describe('the legacy path, asserted as legacy', () => {
  it('returns 1% + 1% when the flag is off', () => {
    // Documented, not endorsed. Statutory is 0.1% / 0.5%; whether the amounts
    // deducted at these rates were deposited at them is the open question on
    // #371, and no host-facing aggregate should ship until it is answered.
    expect(resolveWithholding({ enabled: false })).toEqual({ tdsRate: 0.01, tcsRate: 0.01 });
  });

  it('ignores entity, PAN and GSTIN entirely while off', () => {
    // The legacy rule is flat for everyone — which is why a no-PAN host is
    // currently under-withheld against the 5% floor as well.
    expect(resolveWithholding({ enabled: false, hasPan: false, hasGstin: false }))
      .toEqual({ tdsRate: 0.01, tcsRate: 0.01 });
  });
});

describe('income tax', () => {
  it('withholds 0.1% from a host with a PAN', () => {
    expect(v2().tdsRate).toBe(0.001);
  });

  it('withholds 5% where there is no PAN', () => {
    expect(v2({ hasPan: false }).tdsRate).toBe(0.05);
  });

  it('applies the no-PAN floor regardless of entity type', () => {
    expect(v2({ hasPan: false, entityType: 'individual_huf', fyGrossToDate: 0 }).tdsRate).toBe(0.05);
  });
});

describe('the ₹5L exemption is for resident individual/HUF only', () => {
  it('exempts an individual/HUF under the threshold', () => {
    expect(v2({ entityType: 'individual_huf', fyGrossToDate: 499_999 }).tdsRate).toBe(0);
  });

  it('exempts exactly at the threshold', () => {
    // ₹5,00,000 "to date" has not exceeded the limit.
    expect(v2({ entityType: 'individual_huf', fyGrossToDate: 500_000 }).tdsRate).toBe(0);
  });

  it('withholds the moment the threshold is passed', () => {
    expect(v2({ entityType: 'individual_huf', fyGrossToDate: 500_001 }).tdsRate).toBe(0.001);
  });

  it('never exempts a company, however small', () => {
    expect(v2({ entityType: 'company', fyGrossToDate: 1 }).tdsRate).toBe(0.001);
  });

  it('does not exempt when gross-to-date is unknown', () => {
    // No figure means no proof of being under the limit. Withholding is the
    // safe direction: an over-deduction is refundable at filing, a shortfall
    // is the platform's liability.
    expect(v2({ entityType: 'individual_huf', fyGrossToDate: null }).tdsRate).toBe(0.001);
  });
});

describe('GST collection at source', () => {
  it('collects 0.5% from a GST-registered host', () => {
    expect(v2().tcsRate).toBe(0.005);
  });

  it('collects nothing without a GSTIN', () => {
    // s.52 bites only on a registered supplier. Collecting from an
    // unregistered host would credit a ledger that does not exist.
    expect(v2({ hasGstin: false }).tcsRate).toBe(0);
  });

  it('is independent of PAN status', () => {
    expect(v2({ hasPan: false, hasGstin: true }).tcsRate).toBe(0.005);
    expect(v2({ hasPan: true, hasGstin: false }).tcsRate).toBe(0);
  });
});

describe('a sparse config cannot silently revert a rate', () => {
  it('falls back per field rather than spreading undefined', () => {
    // The bug this guards: a spread would set tdsRate to undefined and the
    // booking would quietly fall back to the legacy 1%.
    const r = resolveWithholding({ enabled: true, hasPan: true, hasGstin: true, entityType: 'company', config: { tcsRate: 0.01 } });
    expect(r.tdsRate).toBe(0.001);
    expect(r.tcsRate).toBe(0.01);
  });
});

/**
 * STATE SPLIT, named and deliberately not asserted.
 *
 * The ruling lists "0.5% GST TCS with state split" among the rate assertions.
 * resolveWithholding returns a single tcsRate and the engine carries no
 * intra-state/inter-state distinction, so there is nothing here to assert
 * against — the 0.5% is undifferentiated.
 *
 * Writing a test that passes by ignoring the split would be worse than none,
 * so this records the gap instead: whether CGST+SGST vs IGST needs to be
 * distinguished in collection, and in GSTR-8 reporting, is open and belongs
 * with the deposit-rate question on #371.
 */
describe.skip('state split (CGST+SGST vs IGST)', () => {
  it('is not modelled by the engine — see the note above', () => {});
});
