/**
 * Host-facing withholding disclosure copy.
 * CA ruling, 2026-11-17 (Q3). See PR #371.
 *
 * TWO CONSTANTS, NOT ONE, and that is the whole point of this module.
 *
 * The console currently tells hosts that TDS *and* TCS are "deposited with the
 * government against your PAN" (Transactions.jsx:174). That is true of the
 * income-tax leg and FALSE of the GST leg: GST TCS is credited against the
 * host's GSTIN into their electronic cash ledger and claimed through GSTR-3B,
 * not against a PAN. One shared sentence cannot be correct for both, which is
 * exactly how the live page came to carry a wrong one.
 *
 * SECTION NUMBERING: host-facing copy cites s.393(1) Table Sl. 8(v) of the
 * Income Tax Act 2025. "194-O" is the 1961 Act's numbering; it survives in
 * internal code comments and column names, but a host reading their dashboard
 * should see the section that is actually in force.
 *
 * Nothing here is a tax invoice. These are payment-advice figures.
 */

/** Income-tax withholding — PAN, Form 26AS / AIS, claimed at filing. */
const TDS_DISCLOSURE = 'Income-tax withheld under s.393(1) Table Sl. 8(v), Income Tax Act 2025, '
  + 'and deposited against your PAN. Claim credit when you file.';

/** GST collection at source — GSTIN, cash ledger, GSTR-3B. NOT a PAN credit. */
const TCS_DISCLOSURE = 'GST collected at source under s.52, CGST Act, and credited to your '
  + 'electronic cash ledger against your GSTIN. Claim it in GSTR-3B.';

/** The standing caveat on any aggregate of the two. */
const AGGREGATE_CAVEAT = 'Payment advice, not a tax invoice or a statutory statement. '
  + 'Refunds and cancellations after the period shown are not reflected here.';

/**
 * The disclosure block that accompanies every withholding aggregate.
 *
 * Carries its PERIOD and its AS-ON timestamp, both required by the ruling: a
 * withholding total with no period reconciles to no statutory record, and one
 * with no as-on cannot be matched against a return filed later.
 */
function withholdingDisclosure({ periodLabel, asOf = new Date().toISOString() }) {
  return {
    period: periodLabel,
    asOf,
    tds: TDS_DISCLOSURE,
    tcs: TCS_DISCLOSURE,
    caveat: AGGREGATE_CAVEAT,
  };
}

module.exports = { TDS_DISCLOSURE, TCS_DISCLOSURE, AGGREGATE_CAVEAT, withholdingDisclosure };
