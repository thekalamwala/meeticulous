const {
  orderPaymentEntry, subscriptionPaymentEntry, productPaymentEntry, bankTransferEntry, reversalEntry, refundEntry,
} = require('../../services/ledger/journalTemplates');
const { ACCOUNTS } = require('../../lib/ledgerAccounts');

const sum = (lines, side) => Math.round(lines.reduce((s, l) => s + (l[side] || 0), 0) * 100) / 100;
const lineFor = (lines, code, side) => lines.find((l) => l.account_code === code && l[side] > 0);

describe('orderPaymentEntry (marketplace v4)', () => {
  // v4 fixture: free plan ₹1000, fee ₹10 + GST ₹1.80, commission ₹50 GST-INCLUSIVE
  // (taxable ₹42.37 + GST ₹7.63), TDS ₹10, TCS ₹10, gateway ₹20.24. payout ₹909.76.
  const snapshot = {
    booking_id: 'b1', host_id: 'v1',
    service_price: 1000, platform_fee_amount: 10, platform_fee_gst: 1.8,
    commission_applied: 50, commission_gst: 7.63, commission_taxable: 42.37,
    tds_amount: 10, tcs_amount: 10,
    razorpay_fee_actual: 20.24, razorpay_tax_actual: 0,
    vendor_amount: 909.76, customer_total: 1011.8,
  };

  test('balances; commission books at taxable; TDS/TCS booked (free plan)', () => {
    const { lines, description } = orderPaymentEntry(snapshot);
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(1011.8);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(20.24); // gateway relief
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(909.76);
    expect(lineFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(9.43); // 1.80 + 7.63
    expect(lineFor(lines, ACCOUNTS.COMMISSION_REVENUE, 'credit').credit).toBe(42.37); // ex-GST
    expect(lineFor(lines, ACCOUNTS.TDS_PAYABLE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.TCS_PAYABLE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'debit').debit).toBe(20.24);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'credit').credit).toBe(20.24); // vendor-borne, nets 0
    expect(description).toContain('b1');
    expect(lines.every((l) => l.order_item_id === 'b1')).toBe(true);
    expect(lines.every((l) => l.vendor_id === 'v1')).toBe(true);
  });

  test('paid plan omits commission line; TDS/TCS still booked', () => {
    const { lines } = orderPaymentEntry({
      ...snapshot, commission_applied: 0, commission_gst: 0, commission_taxable: 0, vendor_amount: 959.76,
    });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.COMMISSION_REVENUE)).toBeUndefined();
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(959.76);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(1.8);
    expect(lineFor(lines, ACCOUNTS.TDS_PAYABLE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.TCS_PAYABLE, 'credit').credit).toBe(10);
  });

  test('zero gateway fee (fee unknown at capture) omits charge lines and stays balanced', () => {
    const { lines } = orderPaymentEntry({ ...snapshot, razorpay_fee_actual: 0, razorpay_tax_actual: 0, vendor_amount: 930 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.RZP_CHARGES_ORDERS)).toBeUndefined();
  });

  test('fee-only ₹0 booking: host owed nothing, BAS bears the gateway fee, no negative/zero line', () => {
    // The exact shape behind the production bug (F1): a ₹0 fee-only service.
    // customer_total = fee 10 + GST 1.80; host payout 0; Razorpay fee ₹0.28.
    // Old behaviour subtracted the fee from a 0 payout → vendor_amount -0.28 →
    // a NEGATIVE journal line the RPC rejects → the entry never posted.
    const feeOnly = {
      booking_id: 'bf', host_id: 'v1',
      service_price: 0, platform_fee_amount: 10, platform_fee_gst: 1.8,
      commission_applied: 0, commission_gst: 0, commission_taxable: 0,
      tds_amount: 0, tcs_amount: 0,
      razorpay_fee_actual: 0.28, razorpay_tax_actual: 0,
      vendor_amount: 0, customer_total: 11.8,
    };
    const { lines } = orderPaymentEntry(feeOnly);

    // Balances.
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    // No host-payout line at all (a zero-value line is rejected by the RPC).
    expect(lines.find((l) => l.account_code === ACCOUNTS.VENDOR_PAYABLES)).toBeUndefined();
    // Gateway is BAS-borne: expensed once, NOT credited back (no net-to-zero pair).
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'debit').debit).toBe(0.28);
    expect(lines.find((l) => l.account_code === ACCOUNTS.RZP_CHARGES_ORDERS && l.credit > 0)).toBeUndefined();
    // Receivable relieved to the net cash Razorpay actually remits.
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(0.28);

    // The two invariants post_journal_entry enforces line-by-line: no negative
    // amount, and exactly one of debit/credit positive per line.
    for (const l of lines) {
      expect(l.debit >= 0 && l.credit >= 0).toBe(true);
      expect((l.debit > 0) !== (l.credit > 0)).toBe(true);
    }
  });

  test('legacy pre-v4 row (no commission_taxable/TDS/TCS) books commission gross and balances', () => {
    const legacy = {
      booking_id: 'b0', host_id: 'v1',
      service_price: 1000, platform_fee_amount: 10, platform_fee_gst: 1.8,
      commission_applied: 50, commission_gst: 9,
      razorpay_fee_actual: 20, razorpay_tax_actual: 3.6,
      vendor_amount: 917.4, customer_total: 1011.8,
    };
    const { lines } = orderPaymentEntry(legacy);
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.COMMISSION_REVENUE, 'credit').credit).toBe(50); // gross, old regime
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(10.8); // 1.80 + 9
    expect(lines.find((l) => l.account_code === ACCOUNTS.TDS_PAYABLE)).toBeUndefined();
    expect(lines.find((l) => l.account_code === ACCOUNTS.TCS_PAYABLE)).toBeUndefined();
  });
});

describe('subscriptionPaymentEntry', () => {
  test('PRD §5.2/§11.3: ₹999 + GST, platform-borne gateway fee', () => {
    const { lines } = subscriptionPaymentEntry({
      id: 's1', vendor_id: 'v1', plan_price: 999, gst_amount: 179.82,
      total_charged: 1178.82, razorpay_fee: 23.58, razorpay_tax: 4.24,
    });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(1178.82);
    expect(lineFor(lines, ACCOUNTS.SUBSCRIPTION_REVENUE, 'credit').credit).toBe(999);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'credit').credit).toBe(179.82);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_SUBS, 'debit').debit).toBe(27.82); // platform expense stays
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(27.82);
    expect(lines.every((l) => l.subscription_payment_id === 's1')).toBe(true);
  });
});

describe('productPaymentEntry', () => {
  // Paid product: price ₹500 + platform fee ₹10. Gateway ₹12.04 (fee 10.20 +
  // tax 1.84), VENDOR-borne (mirrors orderPaymentEntry). No commission, no GST.
  const snapshot = {
    purchase_id: 'p1', host_id: 'v1',
    product_price: 500, platform_fee: 10,
    razorpay_fee_actual: 10.2, razorpay_tax_actual: 1.84,
    customer_total: 510, vendor_amount: 487.96, // 500 − 12.04
  };

  test('balances; vendor bears gateway; no commission/GST legs', () => {
    const { lines, description } = productPaymentEntry(snapshot);
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(510);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(12.04); // gateway relief
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(487.96);
    expect(lineFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE, 'credit').credit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'debit').debit).toBe(12.04);
    expect(lineFor(lines, ACCOUNTS.RZP_CHARGES_ORDERS, 'credit').credit).toBe(12.04); // vendor-borne, nets 0
    expect(lines.find((l) => l.account_code === ACCOUNTS.COMMISSION_REVENUE)).toBeUndefined();
    expect(lines.find((l) => l.account_code === ACCOUNTS.GST_PAYABLE)).toBeUndefined();
    expect(lines.find((l) => l.account_code === ACCOUNTS.SUBSCRIPTION_REVENUE)).toBeUndefined();
    expect(description).toContain('p1');
    expect(lines.every((l) => l.order_item_id === 'p1')).toBe(true);
    expect(lines.every((l) => l.vendor_id === 'v1')).toBe(true);
  });

  test('zero gateway fee (fetch failed) omits charge lines; vendor gets full price', () => {
    const { lines } = productPaymentEntry({ ...snapshot, razorpay_fee_actual: 0, razorpay_tax_actual: 0, vendor_amount: 500 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.RZP_CHARGES_ORDERS)).toBeUndefined();
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(500);
  });

  test('no platform fee (₹0 product fee tier) omits the revenue line, stays balanced', () => {
    const { lines } = productPaymentEntry({ ...snapshot, platform_fee: 0, customer_total: 500, vendor_amount: 487.96 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lines.find((l) => l.account_code === ACCOUNTS.PLATFORM_FEE_REVENUE)).toBeUndefined();
  });

  test('derives customer_total and vendor_amount when the snapshot omits them', () => {
    const { lines } = productPaymentEntry({
      purchase_id: 'p2', host_id: 'v2', product_price: 500, platform_fee: 10,
      razorpay_fee_actual: 10.2, razorpay_tax_actual: 1.84,
    });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(510);
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'credit').credit).toBe(487.96);
  });
});

describe('bankTransferEntry', () => {
  test('DR Bank / CR Receivable', () => {
    const { lines } = bankTransferEntry({ amount: 5000, reference: 'setl_x' });
    expect(lines).toHaveLength(2);
    expect(lineFor(lines, ACCOUNTS.BANK, 'debit').debit).toBe(5000);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(5000);
  });
});

describe('refundEntry (loophole fix — reverses the right legs, always balances)', () => {
  // Paid-plan booking snapshot (0% commission): price 1000, fee 10 + GST 1.80,
  // TDS 10, TCS 10, gateway 20.24 → vendor payout 959.76, guest paid 1011.80.
  const paidSnap = {
    booking_id: 'b1', host_id: 'v1', refund_id: 'rfnd_1', service_price: 1000,
    vendor_amount: 959.76, commission_taxable: 0, commission_gst: 0,
    platform_fee_amount: 10, platform_fee_gst: 1.8, tds_amount: 10, tcs_amount: 10,
  };
  // Starter booking snapshot (5% commission): payout 909.76, commission 50
  // (taxable 42.37 + GST 7.63).
  const starterSnap = {
    booking_id: 'b2', host_id: 'v1', refund_id: 'rfnd_2', service_price: 1000,
    vendor_amount: 909.76, commission_taxable: 42.37, commission_gst: 7.63,
    platform_fee_amount: 10, platform_fee_gst: 1.8, tds_amount: 10, tcs_amount: 10,
  };

  test('full refund (host no-show, ₹1011.80): reverses every leg, MDR → Refund Losses; balances', () => {
    const { lines } = refundEntry({ ...paidSnap, refund_amount: 1011.8 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(1011.8);
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'debit').debit).toBe(959.76);
    expect(lineFor(lines, ACCOUNTS.TDS_PAYABLE, 'debit').debit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.TCS_PAYABLE, 'debit').debit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.PLATFORM_FEE_REVENUE, 'debit').debit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.GST_PAYABLE, 'debit').debit).toBe(1.8); // fee GST
    // Remainder = 1011.80 − 959.76 − 10 − 10 − 10 − 1.80 = 20.24 (the gateway MDR BAS eats).
    expect(lineFor(lines, ACCOUNTS.REFUND_LOSSES, 'debit').debit).toBe(20.24);
    expect(lines.every((l) => l.order_item_id === 'b1' && l.vendor_id === 'v1')).toBe(true);
  });

  test('guest-cancel refund (price only, ₹1000): fee retained; host-price legs reversed; balances', () => {
    const { lines } = refundEntry({ ...paidSnap, refund_amount: 1000 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'credit').credit).toBe(1000);
    expect(lineFor(lines, ACCOUNTS.VENDOR_PAYABLES, 'debit').debit).toBe(959.76);
    expect(lineFor(lines, ACCOUNTS.TDS_PAYABLE, 'debit').debit).toBe(10);
    expect(lineFor(lines, ACCOUNTS.TCS_PAYABLE, 'debit').debit).toBe(10);
    // Fee + fee-GST NOT reversed (retained on guest cancel).
    expect(lines.find((l) => l.account_code === ACCOUNTS.PLATFORM_FEE_REVENUE)).toBeUndefined();
    // Remainder = 1000 − 959.76 − 10 − 10 = 20.24 (gateway BAS eats).
    expect(lineFor(lines, ACCOUNTS.REFUND_LOSSES, 'debit').debit).toBe(20.24);
  });

  test('starter full refund also reverses commission + its GST; balances', () => {
    const { lines } = refundEntry({ ...starterSnap, refund_amount: 1011.8 });
    expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    expect(lineFor(lines, ACCOUNTS.COMMISSION_REVENUE, 'debit').debit).toBe(42.37);
    // GST reversed = commission GST 7.63 + fee GST 1.80 = 9.43 (two 2100 debit lines).
    expect(sum(lines.filter((l) => l.account_code === ACCOUNTS.GST_PAYABLE), 'debit')).toBe(9.43);
    expect(lineFor(lines, ACCOUNTS.REFUND_LOSSES, 'debit').debit).toBe(20.24);
  });

  test('rejects a non-positive refund amount', () => {
    expect(() => refundEntry({ ...paidSnap, refund_amount: 0 })).toThrow(/positive refund_amount/);
  });
});

describe('reversalEntry', () => {
  test('swaps debits and credits of original lines', () => {
    const original = [
      { account_code: ACCOUNTS.BANK, debit: 100, credit: 0 },
      { account_code: ACCOUNTS.RAZORPAY_RECEIVABLE, debit: 0, credit: 100 },
    ];
    const { lines } = reversalEntry({ journal_number: 'JNL-2026-000001', lines: original });
    expect(lineFor(lines, ACCOUNTS.BANK, 'credit').credit).toBe(100);
    expect(lineFor(lines, ACCOUNTS.RAZORPAY_RECEIVABLE, 'debit').debit).toBe(100);
  });
});
