// Sample Clients (host CRM) data for the dev-only dashboard preview (./dashPreview.js).
// Shapes mirror GET /crm/customers and GET /crm/customers/:id (crmService.shape +
// getClient). Every person and figure here is made up.
const day = 86_400_000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();

const SVC = ['svc-1', 'svc-2'];
const PRICE = { 'svc-1': 1499, 'svc-2': 999 };

// [id, name, phone, email, visit offsets in days (negative = upcoming), no-shows, tags]
const PEOPLE = [
  ['c-aarav', 'Aarav Shah', '+919800000001', 'aarav@example.com', [4, 19, 33, 48, 70, 96, -5], 0, ['Founder']],
  ['c-meera', 'Meera Iyer', '+919800000002', 'meera@example.com', [74, 101, 130], 0, []],
  ['c-kabir', 'Kabir Rao', '+919800000003', 'kabir@example.com', [90, 121], 1, []],
  ['c-ananya', 'Ananya Gupta', '+919800000004', 'ananya@example.com', [10], 0, []],
  ['c-rohan', 'Rohan Das', '+919800000005', 'rohan@example.com', [15, 29, 44, 58, -1], 0, ['Retainer']],
  ['c-ishita', 'Ishita Menon', '+919800000006', null, [2], 0, []],
  ['c-vikram', 'Vikram Joshi', null, 'vikram@example.com', [33, 61], 0, []],
];

const historyOf = ([id, name, phone, email, visits, noShows]) => visits.map((d, i) => {
  const service_id = SVC[i % SVC.length];
  const upcoming = d < 0;
  const status = upcoming ? 'confirmed' : i === visits.length - 1 && noShows ? 'no_show' : 'completed';
  return {
    id: `${id}-b${i}`, service_id, guest_name: name, guest_email: email, guest_phone: phone,
    customer_total: PRICE[service_id], status,
    payment_status: 'paid',
    scheduled_at: ago(d), created_at: ago(d + 4), source: 'platform',
  };
}).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

const customerOf = (p) => {
  const [id, name, phone, email, , noShows, tags] = p;
  const hist = historyOf(p);
  // Same rule as crmService.aggregate: only paid bookings count (upcoming prepaid ones too).
  const paid = hist.filter((b) => b.payment_status === 'paid');
  const past = paid.map((b) => b.scheduled_at).sort();
  const next = hist.filter((b) => new Date(b.scheduled_at) > Date.now()).map((b) => b.scheduled_at).sort()[0] || null;
  const total = paid.reduce((n, b) => n + (b.customer_total || 0), 0);
  return {
    id, customer_key: phone ? `p:${phone}` : `e:${email}`, name, phone, email,
    bookings_count: paid.length, total_spent: total, ltv: total,
    first_booked_at: past[0] || null, last_booking_at: past.at(-1) || null, next_upcoming_at: next,
    no_show_count: noShows, cancel_count: 0, is_recurring: paid.length > 1,
    tags, attributes: { tags },
  };
};

export const buildCrmFixtures = () => {
  const clients = PEOPLE.map(customerOf).sort((a, b) => new Date(b.last_booking_at) - new Date(a.last_booking_at));
  const out = {
    '/crm/customers': { clients, total: clients.length, page: 1, pageSize: 50, hidden_count: 0 },
    // svcGetAll: the profile timeline's service titles (ids match dashPreviewFixtures SERVICES).
    '/services': [{ id: 'svc-1', title: 'Funnel Teardown' }, { id: 'svc-2', title: 'Growth Sprint Workshop' }],
  };
  PEOPLE.forEach((p) => {
    const id = p[0];
    out[`/crm/customers/${id}`] = {
      customer: customerOf(p),
      history: historyOf(p),
      reviews: id === 'c-aarav' ? [{ id: 'rv-1', booking_id: `${id}-b1`, rating: 5, comment: 'Sharp, practical, worth every minute.' }] : [],
    };
    out[`/crm/customers/${id}/notes`] = {
      notes: id === 'c-aarav'
        ? [{ id: 'n-1', body: 'Runs a 6-person D2C team. Wants the checkout funnel looked at next.', created_at: ago(4) }]
        : [],
    };
  });
  return out;
};
