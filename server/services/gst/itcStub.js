'use strict';
/**
 * itcStub.js — honest ITC placeholder.
 *
 * The platform does not capture ANY input/purchase GST (no vendor bills, no
 * expense-GST table) — confirmed with the requester. So Input Tax Credit has no
 * data source. Rather than fabricate numbers, every ITC surface returns zeros
 * plus an explicit `available:false` + reason, so the UI can render an honest
 * empty state (see docs/gst-finance-module-architecture.md G3/§9).
 *
 * When an input-GST data source is added later, replace this module — the API
 * shape (available/summary/atRisk) is the contract the ITC page consumes.
 */
const REASON = 'No input-GST / purchase data is captured in the platform. ITC cannot be computed.';

function itcReport() {
  return {
    available: false,
    reason: REASON,
    summary: { available: 0, claimed: 0, pending: 0, rejected: 0, reversed: 0, atRisk: 0 },
    atRisk: [],
  };
}

module.exports = { itcReport, ITC_REASON: REASON };
