// Money + KYC sample data for the dev-only dashboard preview (see ./dashPreview.js).
// Shapes mirror /vendor/transactions (paid bookings with the Route transfer and
// settlement columns), /vendor/payout/balance, /kyc/me and /invoices/mine. Every
// person, id and figure is made up. Never reaches the real payout API.
const day = 86_400_000;
const at = (days, h = 11) => { const d = new Date(Date.now() + days * day); d.setHours(h, 0, 0, 0); return d.toISOString(); };

const GUESTS = ['Aarav Shah', 'Meera Iyer', 'Kabir Rao', 'Ananya Gupta', 'Rohan Das', 'Ishita Menon', 'Vikram Joshi'];
const SVC = [
  { title: 'Funnel Teardown', price: 1499, duration: 45 },
  { title: 'Growth Sprint Workshop', price: 999, duration: 60 },
];

let n = 0;
const paid = (days, svc, extra = {}) => {
  n += 1;
  const s = SVC[svc];
  const commission = Math.round(s.price * 0.05 * 100) / 100;
  return {
    id: `tx-${String(n).padStart(4, '0')}-preview`, host_id: 'host-preview',
    guest_name: GUESTS[n % GUESTS.length], guest_email: `guest${n}@example.com`, guest_phone: '+910000000000',
    scheduled_at: at(days), created_at: at(days - 3), status: days < 0 ? 'completed' : 'confirmed',
    payment_status: 'paid', customer_total: s.price, amount: s.price,
    commission_applied: commission, vendor_amount: Math.round((s.price - commission) * 100) / 100,
    razorpay_fee_actual: 0, razorpay_tax_actual: 0, tds_amount: 0, tcs_amount: 0,
    razorpay_order_id: `order_PRV${n}x`, razorpay_payment_id: `pay_PRV${n}x`,
    services: { ...s },
    transfer_status: null, razorpay_transfer_id: null, transfer_hold_until: null, transfer_released_at: null,
    transfer_settlement_status: null, recipient_settlement_id: null, transfer_settled_at: null,
    ...extra,
  };
};
// A payment that has reached the host's bank inside settlement `setl` on `days`.
const deposited = (days, svc, setl, depositDay) => paid(days, svc, {
  razorpay_transfer_id: `trf_PRV${n + 1}`, transfer_status: 'processed', transfer_released_at: at(depositDay - 1),
  transfer_settlement_status: 'settled', recipient_settlement_id: setl, transfer_settled_at: at(depositDay, 9),
});

// Verified host with history: three bank deposits, money on the way, one upcoming.
export const verifiedRows = () => {
  n = 0;
  return [
    paid(4, 0),                                                   // session not held yet
    paid(-2, 1, { razorpay_transfer_id: 'trf_PRVhold', transfer_status: 'pending', transfer_hold_until: at(5) }), // held transfer
    paid(-9, 0, { razorpay_transfer_id: 'trf_PRVsent', transfer_status: 'processed', transfer_released_at: at(-1), transfer_settlement_status: 'pending' }),
    deposited(-14, 0, 'setl_PRV003', -4), deposited(-15, 1, 'setl_PRV003', -4), deposited(-16, 0, 'setl_PRV003', -4),
    deposited(-24, 1, 'setl_PRV002', -13), deposited(-26, 0, 'setl_PRV002', -13),
    deposited(-33, 0, 'setl_PRV001', -21), deposited(-35, 1, 'setl_PRV001', -21), deposited(-36, 1, 'setl_PRV001', -21), deposited(-38, 0, 'setl_PRV001', -21),
    paid(-40, 1, { razorpay_transfer_id: 'trf_PRVrev', transfer_status: 'reversed', transfer_released_at: at(-39), status: 'cancelled' }),
  ];
};

// New host, not verified yet: paid bookings waiting, nothing has moved.
export const newHostRows = () => { n = 0; return [paid(3, 0), paid(-1, 1), paid(-12, 0)]; };

const sum = (rows, f) => Math.round(rows.filter(f).reduce((a, r) => a + r.vendor_amount, 0) * 100) / 100;

export const balanceFor = (rows, { verified }) => {
  const now = Date.now();
  const pendingCompletion = sum(rows, (r) => !r.transfer_status && new Date(r.scheduled_at) > now);
  const matured = sum(rows, (r) => !r.transfer_status && new Date(r.scheduled_at) <= now);
  const clearing = sum(rows, (r) => r.transfer_status === 'pending');
  const paidOut = sum(rows, (r) => r.transfer_status === 'processed');
  return {
    available: verified ? matured : 0, heldForKyc: verified ? 0 : matured, clearing, pendingCompletion,
    inflight: 0, paidOut, lifetimeEarned: matured + clearing + pendingCompletion + paidOut, payoutsBlocked: !verified,
  };
};

export const page = (rows) => ({ data: rows, total: rows.length, page: 1, limit: 50 });

const INVOICES = [
  { id: 'inv-1', invoice_number: 'MT/26-27/000412', source_type: 'subscription', issued_at: at(-6), total: 1178.82, access_token: 'preview' },
  { id: 'inv-2', invoice_number: 'MT/26-27/000301', source_type: 'subscription', issued_at: at(-36), total: 1178.82, access_token: 'preview' },
  { id: 'inv-3', invoice_number: 'MT/26-27/000288', source_type: 'booking', issued_at: at(-41), total: 499, access_token: 'preview' },
];

// The default preview keeps /kyc/me and /vendor/payout/balance from dashPreviewFixtures
// (Today reads those); Money's own lists come from here. Other states are switched in
// with window.__DASH_PREVIEW_STATE (see dashPreview.js) — `moneyStates` has them ready.
// localStorage['dash-preview-money'] = 'verified' | 'notStarted' | … picks a state.
export const buildMoneyFixtures = () => {
  try {
    const s = localStorage.getItem('dash-preview-money');
    if (s && !window.__DASH_PREVIEW_STATE) window.__DASH_PREVIEW_STATE = moneyStates()[s]; // eslint-disable-line no-use-before-define
  } catch { /* storage blocked: default state */ }
  return { '/vendor/transactions': page(newHostRows()), '/invoices/mine': INVOICES };
};

const kyc = (status, extra = {}) => ({
  status, pending_earnings: 0, payouts_ready: status === 'approved',
  ...(status === 'not_started' ? {} : { pan_number: 'ABCDE••••F', aadhaar_number: '••••••••4321', bank_name: 'HDFC Bank', account_number: '••••••7788' }),
  ...extra,
});

// Ready-made window.__DASH_PREVIEW_STATE values for screenshots, one per honest state.
export const moneyStates = () => {
  const v = verifiedRows();
  const fresh = newHostRows();
  const big = verifiedRows().map((r) => ({ ...r, vendor_amount: r.vendor_amount * 6700, guest_name: 'Shreya Venkataraghavan-Krishnamurthy', services: { ...r.services, title: 'Quarterly growth strategy deep-dive for founding teams' } }));
  return {
    verified: { '/kyc/me': { data: kyc('approved') }, '/vendor/payout/balance': { data: balanceFor(v, { verified: true }) }, '/vendor/transactions': { data: page(v) } },
    notStarted: { '/kyc/me': { data: kyc('not_started') }, '/vendor/payout/balance': { data: balanceFor(fresh, { verified: false }) }, '/vendor/transactions': { data: page(fresh) } },
    pending: { '/kyc/me': { data: kyc('pending') }, '/vendor/payout/balance': { data: balanceFor(fresh, { verified: false }) }, '/vendor/transactions': { data: page(fresh) } },
    rejected: { '/kyc/me': { data: kyc('rejected', { review_note: 'The name on the PAN does not match the bank account holder.' }) }, '/vendor/payout/balance': { data: balanceFor(fresh, { verified: false }) }, '/vendor/transactions': { data: page(fresh) } },
    empty: { '/kyc/me': { data: kyc('approved') }, '/vendor/payout/balance': { data: balanceFor([], { verified: true }) }, '/vendor/transactions': { data: page([]) }, '/invoices/mine': { data: [] } },
    crore: { '/kyc/me': { data: kyc('approved') }, '/vendor/payout/balance': { data: balanceFor(big, { verified: true }) }, '/vendor/transactions': { data: page(big) } },
    error: { '/vendor/payout/balance': { status: 500 }, '/vendor/transactions': { status: 500 }, '/invoices/mine': { status: 500 } },
    loading: { '/vendor/payout/balance': { delay: 60000 }, '/vendor/transactions': { delay: 60000 }, '/invoices/mine': { delay: 60000 }, '/kyc/me': { delay: 60000 } },
  };
};
