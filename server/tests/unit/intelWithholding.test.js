/**
 * Withholding aggregates — FY-scoped, measured-only.
 * CA ruling 2026-11-17 (Gate A, Q3, Q5). See PR #371.
 *
 * Deliberately non-statutory amounts throughout. The rates live in
 * pricingEngineWithholding.test.js and nowhere else; these assert SCOPE and
 * PROVENANCE, which are the two things the ruling said an all-time, mixed
 * aggregate gets wrong.
 */
const { withholding, summarise } = require('../../services/intel/money');
const { TDS_DISCLOSURE, TCS_DISCLOSURE } = require('../../services/intel/disclosures');

// Mid-FY-2026-27, which runs 1 Apr 2026 → 31 Mar 2027 IST.
const NOW = Date.parse('2026-11-17T00:00:00Z');

const paid = (over = {}) => ({
  payment_status: 'paid', customer_total: 1000,
  tds_amount: 7, tcs_amount: 13, vendor_amount: 900,
  paid_at: '2026-11-01T00:00:00Z', ...over,
});

describe('the window is the financial year, not all time', () => {
  it('counts only this FY', () => {
    // An all-time withholding total reconciles to no statutory record: TDS and
    // TCS are deposited, returned and credited per FY.
    const rows = [paid(), paid({ paid_at: '2026-02-01T00:00:00Z', tds_amount: 999, tcs_amount: 999 })];
    const w = withholding(rows, { now: NOW });
    expect(w.tds).toBe(7);
    expect(w.tcs).toBe(13);
  });

  it('starts on 1 April IST, not 1 April UTC', () => {
    // 31 Mar 2026 20:00 UTC is already 1 Apr 01:30 IST — inside FY 2026-27.
    // A UTC boundary would file it under the previous year.
    const w = withholding([paid({ paid_at: '2026-03-31T20:00:00Z' })], { now: NOW });
    expect(w.tds).toBe(7);

    // ...while 31 Mar 2026 12:00 UTC is 17:30 IST on 31 March: previous FY.
    const prev = withholding([paid({ paid_at: '2026-03-31T12:00:00Z' })], { now: NOW });
    expect(prev.tds).toBe(0);
  });

  it('labels the period it is reporting', () => {
    // A figure with no period cannot be matched to anything a host holds.
    const w = withholding([paid()], { now: NOW });
    expect(w.fyLabel).toBe('FY 2026-27 to date');
    expect(w.disclosure.period).toBe('FY 2026-27 to date');
  });

  it('carries an as-on timestamp', () => {
    expect(Date.parse(withholding([paid()], { now: NOW }).disclosure.asOf)).toBeGreaterThan(0);
  });
});

describe('measured only — a derived figure is not a withholding figure', () => {
  it('excludes rows with no snapshot from the totals', () => {
    const rows = [paid(), paid({ vendor_amount: null, tds_amount: 500, tcs_amount: 500 })];
    const w = withholding(rows, { now: NOW });
    // The 500s are NOT added, because the row they sit on did not capture
    // cleanly — folding them in would make the total look authoritative.
    expect(w.tds).toBe(7);
    expect(w.tcs).toBe(13);
    expect(w.bookingsMeasured).toBe(1);
    expect(w.bookingsUnknown).toBe(1);
  });

  it('states what the excluded rows are worth, without adding them in', () => {
    const rows = [paid(), paid({ vendor_amount: null, customer_total: 4321 })];
    expect(withholding(rows, { now: NOW }).unknownGross).toBe(4321);
  });

  it('leads with the caveat once unknowns pass 5%', () => {
    // 1 of 19 = 5.26%, above the line.
    const eighteen = Array.from({ length: 18 }, () => paid());
    expect(withholding([...eighteen, paid({ vendor_amount: null })], { now: NOW }).unknownLeads).toBe(true);
  });

  it('does not lead at exactly 5%', () => {
    // "Above ~5%" is above, not at. 1 of 20 is the boundary and stays quiet —
    // asserted so a later refactor to >= is a deliberate choice, not a slip.
    const nineteen = Array.from({ length: 19 }, () => paid());
    expect(withholding([...nineteen, paid({ vendor_amount: null })], { now: NOW }).unknownLeads).toBe(false);
  });
});

describe('the two disclosures are not interchangeable', () => {
  it('credits income tax against a PAN', () => {
    const d = withholding([paid()], { now: NOW }).disclosure;
    expect(d.tds).toBe(TDS_DISCLOSURE);
    expect(d.tds).toMatch(/PAN/);
    expect(d.tds).toMatch(/s\.393\(1\)/);
  });

  it('credits GST to a cash ledger against a GSTIN, never a PAN', () => {
    // The live console tells hosts BOTH are credited "against your PAN". That
    // is false for the GST leg and is the reason these are two constants.
    const d = withholding([paid()], { now: NOW }).disclosure;
    expect(d.tcs).toBe(TCS_DISCLOSURE);
    expect(d.tcs).toMatch(/GSTIN/);
    expect(d.tcs).toMatch(/GSTR-3B/);
    expect(d.tcs).not.toMatch(/PAN/);
  });

  it('does not cite the repealed section in host-facing copy', () => {
    // 194-O is the 1961 Act's numbering. Internal columns may keep it; a host
    // should see the section actually in force.
    const d = withholding([paid()], { now: NOW }).disclosure;
    expect(`${d.tds} ${d.tcs}`).not.toMatch(/194-?O/);
  });

  it('says it is not a statutory statement, and that later refunds are not in it', () => {
    const d = withholding([paid()], { now: NOW }).disclosure;
    expect(d.caveat).toMatch(/not a tax invoice/i);
    expect(d.caveat).toMatch(/refunds and cancellations/i);
  });
});

describe('summarise reports provenance alongside the money', () => {
  it('gives both the count and the value of derived rows', () => {
    const { vendor_amount, ...noSnapshot } = paid();
    const s = summarise([paid(), { ...noSnapshot, customer_total: 1000 }]);
    expect(s.derivedRows).toBe(1);
    expect(s.derivedValue).toBeGreaterThan(0);
  });

  it('flags when derived rows are more than a rounding error', () => {
    const { vendor_amount, ...noSnapshot } = paid();
    expect(summarise([paid(), noSnapshot]).derivedLeads).toBe(true);
    expect(summarise(Array.from({ length: 30 }, () => paid())).derivedLeads).toBe(false);
  });
});
