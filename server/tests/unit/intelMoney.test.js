/**
 * Intelligence · Revenue — the arithmetic.
 *
 * Phase 3's first acceptance criterion is that net revenue ties to a
 * hand-reconciled payout. These are that hand reconciliation, written out: the
 * fixture below is one realistic Starter booking with every deduction the
 * pricing engine applies, and the expected net is computed on paper in the
 * comment rather than by the code under test.
 */
const money = require('../../services/intel/money');

// ₹1,000 service on Starter (5% commission), with the real gateway fee:
//   gross            1000.00
//   − commission       50.00   (5%)
//   − commission GST    9.00   (18% of 50)
//   − razorpay fee     20.24
//   − razorpay tax      3.64
//   − TDS                7.00   ← deliberately NOT a statutory rate
//   − TCS               13.00   ← see note below
//   ─────────────────────────
//   net               897.12
//
// CA ruling 2026-11-17 (Q4): the withholding values here are ₹7 and ₹13, which
// correspond to no rate in force. This fixture tests ARITHMETIC — that the
// deductions sum and subtract correctly — and never a rate. Statutory numbers
// here would invite a later reader to "correct" them against a changed rate and
// believe they had validated something. Rate assertions live in
// pricingEngineWithholding.test.js, which is the only place they belong.
const PAID = {
  id: 'b1', payment_status: 'paid', status: 'completed',
  created_at: '2026-10-05T10:00:00Z', paid_at: '2026-10-05T10:02:00Z',
  customer_total: 1000, platform_fee_amount: 0, platform_fee_gst: 0,
  commission_applied: 50, commission_gst: 9,
  razorpay_fee_actual: 20.24, razorpay_tax_actual: 3.64,
  tds_amount: 7, tcs_amount: 13, refunded_amount: 0,
  vendor_amount: 897.12, settlement_status: 'settled', settled_at: '2026-10-07T00:00:00Z',
  client_id: 'g1', guest_name: 'Meera', services: { title: 'Consult' },
};

const UNPAID = { ...PAID, id: 'b2', payment_status: 'unpaid', vendor_amount: null, settled_at: null, settlement_status: null };

describe('net is the snapshot, not a recomputation', () => {
  it('uses vendor_amount when it is there', () => {
    // The payment path already recomputed this with the REAL gateway fee. If
    // this file recomputed instead, a later pricing change would silently
    // restate history and last quarter would stop matching last quarter's
    // payouts.
    expect(money.netOf(PAID)).toEqual({ net: 897.12, derived: false });
  });

  it('derives net only when the snapshot is missing, and says that it did', () => {
    const { vendor_amount, ...noSnapshot } = PAID;
    const r = money.netOf(noSnapshot);
    expect(r.net).toBe(897.12);
    expect(r.derived).toBe(true);
  });
});

describe('summarise', () => {
  it('ties to the hand reconciliation above', () => {
    const s = money.summarise([PAID]);
    expect(s).toMatchObject({
      bookings: 1, gross: 1000, commission: 50, commissionGst: 9,
      razorpayFee: 23.88, tds: 7, tcs: 13, net: 897.12, aov: 1000,
    });
  });

  it('counts only money that arrived', () => {
    // An unpaid booking is a hope, not revenue.
    expect(money.summarise([PAID, UNPAID]).bookings).toBe(1);
  });

  it('subtracts a refund rather than dropping the booking', () => {
    // A refunded booking still cost a gateway fee and still appears on the
    // host's statement. Excluding it would make this page disagree with their
    // bank for a reason they cannot see.
    const refunded = { ...PAID, id: 'b3', refunded_amount: 1000 };
    const s = money.summarise([refunded]);
    expect(s.gross).toBe(1000);
    expect(s.refunded).toBe(1000);
    expect(s.net).toBe(-102.88); // the fees were still paid
  });

  it('reports how many rows had no snapshot', () => {
    const { vendor_amount, ...noSnapshot } = PAID;
    expect(money.summarise([PAID, { ...noSnapshot, id: 'b9' }]).derivedRows).toBe(1);
  });

  it('is zero, not NaN, with nothing to add up', () => {
    expect(money.summarise([])).toMatchObject({ bookings: 0, gross: 0, net: 0, aov: 0 });
  });
});

describe('settlement', () => {
  it('separates what has left our hands from what has not', () => {
    const pending = { ...PAID, id: 'b4', settlement_status: null, settled_at: null };
    expect(money.settlement([PAID, pending])).toEqual({ settled: 897.12, pending: 897.12 });
  });
});

describe('breakdowns', () => {
  const two = [PAID, { ...PAID, id: 'b5', services: { title: 'Deep dive' }, customer_total: 2400, vendor_amount: 2100, client_id: 'g2' }];

  it('ranks services by gross', () => {
    expect(money.byService(two).map((r) => r.label)).toEqual(['Deep dive', 'Consult']);
  });

  it('groups by month, oldest first', () => {
    const rows = money.byMonth([PAID, { ...PAID, id: 'b6', paid_at: '2026-09-01T00:00:00Z' }]);
    expect(rows.map((r) => r.month)).toEqual(['2026-09', '2026-10']);
  });

  it('measures concentration across guests', () => {
    const c = money.concentration(two, 1);
    expect(c.guests).toBe(2);
    expect(c.share).toBe(70.59); // 2400 of 3400
  });

  it('returns a null share rather than 0% when there is no revenue', () => {
    // 0% would read as "no concentration", which is a claim. There is simply
    // nothing to measure.
    expect(money.concentration([]).share).toBeNull();
  });
});

describe('upcoming is firm money', () => {
  it('counts confirmed-but-unpaid, and not cancelled', () => {
    const cancelled = { ...UNPAID, id: 'b7', status: 'cancelled' };
    expect(money.upcoming([PAID, UNPAID, cancelled])).toEqual({ bookings: 1, value: 1000 });
  });
});
