// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY UI preview fixtures.  TEMPORARY / REMOVABLE.
//
// Purpose: let us visually develop and verify the redesigned Dashboard, Calendar
// and Transactions pages even when the company backend is unavailable or empty.
//
// HARD SAFETY RAILS:
//   • Every getter's FIRST line is `if (!import.meta.env.DEV) return null;`. In a
//     production build that constant is statically `false`, so Vite/terser dead-
//     code-eliminates the fixtures — they cannot ship or render in production.
//   • Preview data is NEVER sent to any API and NEVER written to Supabase. The
//     pages read these fixtures in place of the API call; they do not POST them.
//   • Opt-in only. Off unless explicitly enabled (see isPreviewEnabled). When
//     off, the pages use real API data — and on an API failure they show the
//     error state, never a silent fall back to preview.
//
// ENABLE locally (pick one):
//   1. client/.env →  VITE_UI_PREVIEW=true           (then restart `npm run dev`)
//   2. DevTools console →  localStorage.setItem('bas_ui_preview','1')  then reload
// DISABLE: unset the flag / `localStorage.removeItem('bas_ui_preview')` + reload.
// REMOVE the feature: delete this file and the guarded `isPreviewEnabled()`
// branches in Dashboard.jsx and Transactions.jsx (search "previewData").
// ─────────────────────────────────────────────────────────────────────────────

// True only in a dev build AND when explicitly opted in. Defaults OFF so real
// API data is the default whenever preview mode is disabled.
export const isPreviewEnabled = () => {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_UI_PREVIEW === 'true') return true;
  try {
    return localStorage.getItem('bas_ui_preview') === '1';
  } catch {
    return false;
  }
};

// ── date helpers (anchor sample bookings to the CURRENT week so they land on the
//    calendar, which is anchored to today) ───────────────────────────────────
const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};
const weekDayAt = (dayOffset, h, m = 0) => {
  const mon = startOfWeek(new Date());
  const d = new Date(mon);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const daysAgo = (n, h = 12, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

/* ---------------------------------------------------------------------------
 * Dashboard calendar — sample bookings across weekdays, varied statuses so the
 * four card colours (confirmed→purple, completed→green, pending→orange,
 * no_show→pink) all appear. Shaped exactly like a real getHostBookings() row.
 * ------------------------------------------------------------------------- */
export function getPreviewBookings() {
  if (!import.meta.env.DEV) return null;
  // Fuller shape so the Bookings detail modal has realistic fields in preview.
  // staff_name / location / services.description are NOT in the real contract —
  // the modal shows them only when present (i.e. in preview), omits otherwise.
  const svc = (title, price = 1500, duration = 45, description) => ({ title, price, duration, description, meeting_mode: 'offline' });
  const base = (i, name, email) => ({
    id: `pv-b${i}`, guest_name: name, guest_email: email, guest_id: `pv-g${i}`,
    guest_phone: `+9198000000${String(i).padStart(2, '0')}`,
    created_at: daysAgo(3 + i, 10), host_id: 'pv-host',
    staff_name: ['Riya Sharma', 'Neha Verma', 'Priya Das'][i % 3],
    location: 'Main Branch, New Delhi',
  });
  const notes = 'Customer prefers organic products.';
  return [
    { ...base(1, 'Ananya Iyer',  'ananya@example.com'), status: 'confirmed', payment_status: 'paid',    scheduled_at: weekDayAt(0, 11, 0),  services: svc('Hair Spa', 1500, 60, 'Relax & rejuvenate with our premium hair spa.'), notes },
    { ...base(2, 'Rohit Sharma', 'rohit@example.com'),  status: 'completed', payment_status: 'paid',    scheduled_at: weekDayAt(0, 15, 0),  services: svc('Facial', 2000, 60, 'Deep-cleanse glow facial.') },
    { ...base(3, 'Meera Nair',   'meera@example.com'),  status: 'confirmed', payment_status: 'paid',    scheduled_at: weekDayAt(1, 10, 0),  services: svc('Hair Color', 2500, 120, 'Full hair colour with conditioning.') },
    { ...base(4, 'Kabir Khan',   'kabir@example.com'),  status: 'pending',   payment_status: 'pending', scheduled_at: weekDayAt(1, 13, 0),  services: svc('Hair Cut', 800, 45, 'Precision cut and style.') },
    { ...base(5, 'Diya Patel',   'diya@example.com'),   status: 'completed', payment_status: 'paid',    scheduled_at: weekDayAt(2, 12, 0),  services: svc('Manicure', 1200, 60, 'Classic manicure and polish.') },
    { ...base(6, 'Arjun Rao',    'arjun@example.com'),  status: 'no_show',   payment_status: 'paid',    scheduled_at: weekDayAt(2, 16, 0),  services: svc('Hair Spa', 1500, 60) },
    { ...base(7, 'Sara Ali',     'sara@example.com'),   status: 'confirmed', payment_status: 'paid',    scheduled_at: weekDayAt(3, 10, 30), services: svc('Facial', 2000, 45, 'Hydrating facial.') },
    { ...base(8, 'Vikram Sethi', 'vikram@example.com'), status: 'pending',   payment_status: 'pending', scheduled_at: weekDayAt(4, 13, 0),  services: svc('Hair Color', 2500, 90) },
    { ...base(9, 'Nisha Gupta',  'nisha@example.com'),  status: 'confirmed', payment_status: 'paid',    scheduled_at: weekDayAt(4, 15, 30), services: svc('Manicure', 1200, 45) },
  ];
}

// Sample payout balance (shape = computeSettlementBalance). Non-zero so the
// Dashboard withdraw card shows example amounts in preview.
export function getPreviewPayoutBalance() {
  if (!import.meta.env.DEV) return null;
  return { available: 18450, clearing: 3200, pendingCompletion: 1500, inflight: 0, paidOut: 42000, lifetimeEarned: 65150 };
}

/* ---------------------------------------------------------------------------
 * Transactions — sample paid-booking transactions, shaped exactly like a real
 * getTransactions() row. Varied dates, customers, services, amounts, payout
 * states (Paid out / In transit / Payout pending / Paid) and gateway presence.
 * ------------------------------------------------------------------------- */
export function getPreviewTransactions() {
  if (!import.meta.env.DEV) return null;
  const mk = (o) => ({
    payment_status: 'paid',
    commission_applied: 0,
    razorpay_fee_actual: 0,
    razorpay_tax_actual: 0,
    tds_amount: 0,
    tcs_amount: 0,
    ...o,
  });
  return [
    mk({ id: 'pv-t1', guest_name: 'Ananya Iyer',  guest_email: 'ananya@example.com', guest_phone: '+919800000001', status: 'completed', created_at: daysAgo(1, 10), scheduled_at: daysAgo(1, 11), services: { title: 'Strategy Call', price: 1500, duration: 45 }, vendor_amount: 1410, commission_applied: 60, razorpay_fee_actual: 30, transfer_status: 'processed', razorpay_order_id: 'order_PV0001', razorpay_payment_id: 'pay_PV0001' }),
    mk({ id: 'pv-t2', guest_name: 'Rohit Sharma', guest_email: 'rohit@example.com',  guest_phone: '+919800000002', status: 'completed', created_at: daysAgo(2, 14), scheduled_at: daysAgo(2, 15), services: { title: 'Portfolio Review', price: 2000, duration: 60 }, vendor_amount: 1880, commission_applied: 80, razorpay_fee_actual: 40, transfer_status: 'pending', razorpay_order_id: 'order_PV0002', razorpay_payment_id: 'pay_PV0002' }),
    mk({ id: 'pv-t3', guest_name: 'Meera Nair',   guest_email: 'meera@example.com',  guest_phone: '+919800000003', status: 'confirmed', created_at: daysAgo(3, 9), scheduled_at: daysAgo(3, 10), services: { title: 'Tax Consult', price: 1800, duration: 45 }, vendor_amount: 1710, commission_applied: 72, razorpay_fee_actual: 18, transfer_status: null, razorpay_order_id: 'order_PV0003', razorpay_payment_id: 'pay_PV0003' }),
    mk({ id: 'pv-t4', guest_name: 'Kabir Khan',   guest_email: 'kabir@example.com',  guest_phone: '+919800000004', status: 'completed', created_at: daysAgo(5, 16), scheduled_at: daysAgo(5, 17), services: { title: 'Design Review', price: 2500, duration: 60 }, vendor_amount: 2350, commission_applied: 100, razorpay_fee_actual: 50, transfer_status: 'processed', razorpay_order_id: 'order_PV0004', razorpay_payment_id: 'pay_PV0004' }),
    mk({ id: 'pv-t5', guest_name: 'Diya Patel',   guest_email: 'diya@example.com',   guest_phone: '+919800000005', status: 'completed', created_at: daysAgo(8, 11), scheduled_at: daysAgo(8, 12), services: { title: 'Intro Session', price: 0, duration: 30 }, vendor_amount: 0, transfer_status: null, razorpay_order_id: null, razorpay_payment_id: null }),
    mk({ id: 'pv-t6', guest_name: 'Sara Ali',     guest_email: 'sara@example.com',   guest_phone: '+919800000006', status: 'cancelled', created_at: daysAgo(10, 13), scheduled_at: daysAgo(10, 14), services: { title: 'Coaching Call', price: 1500, duration: 45 }, vendor_amount: 1410, commission_applied: 60, razorpay_fee_actual: 30, transfer_status: 'reversed', razorpay_order_id: 'order_PV0006', razorpay_payment_id: 'pay_PV0006' }),
    mk({ id: 'pv-t7', guest_name: 'Vikram Sethi', guest_email: 'vikram@example.com', guest_phone: '+919800000007', status: 'completed', created_at: daysAgo(12, 10), scheduled_at: daysAgo(12, 11), services: { title: 'Audit Session', price: 3000, duration: 90 }, vendor_amount: 2820, commission_applied: 120, razorpay_fee_actual: 60, transfer_status: 'processed', razorpay_order_id: 'order_PV0007', razorpay_payment_id: 'pay_PV0007' }),
  ];
}

// Client-side filter + sort for the Transactions preview, so the search / status
// / date / sort controls stay meaningful in preview mode (mirrors the backend
// query: search over name+email, status on booking lifecycle, dateFrom on
// created_at). Real mode still uses the server for these.
export function filterPreviewTransactions(list, { search = '', status = '', dateFrom, sort = 'desc' } = {}) {
  let out = list;
  const q = search.trim().toLowerCase();
  if (q) out = out.filter((t) => `${t.guest_name} ${t.guest_email}`.toLowerCase().includes(q));
  if (status) out = out.filter((t) => t.status === status);
  if (dateFrom) out = out.filter((t) => new Date(t.created_at) >= new Date(dateFrom));
  out = [...out].sort((a, b) => {
    const d = new Date(a.created_at) - new Date(b.created_at);
    return sort === 'asc' ? d : -d;
  });
  return out;
}
