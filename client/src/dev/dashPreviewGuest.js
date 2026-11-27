// DEV-ONLY guest console (/user/*) fixtures for the dashboard preview (see
// dashPreview.js). Made-up data covering every state the Kept guest pages show:
// an ended session awaiting "did it happen?", an upcoming one with a meeting link,
// completed, cancelled; one membership, two courses, two invoices, one review.
const at = (h) => new Date(Date.now() + h * 3600000).toISOString();
const HOST = { id: 'h1', name: 'Priya Sharma', username: 'priya', profile_image: null };
const HOST2 = { id: 'h2', name: 'Arjun Mehta', username: 'arjun', profile_image: null };
const svc = (title, slug, price, duration = 60) => ({ id: slug, title, slug, price, duration });

const bk = (id, o) => ({
  id, status: 'confirmed', payment_status: 'paid', customer_total: 1180, meeting_link: null,
  guest_name: 'Riya', guest_email: 'riya@example.com', profiles: HOST, services: svc('Morning Yoga', 'morning-yoga', 1000), ...o,
});

export const guestFixtures = () => ({
  '/bookings/guest': [
    bk('gb-wait', { scheduled_at: at(-3) }),
    bk('gb-next', { scheduled_at: at(52), meeting_link: 'https://meet.google.com/abc-defg-hij', services: svc('1:1 Career Coaching', 'career', 2500, 45), profiles: HOST2, customer_total: 2950 }),
    bk('gb-later', { scheduled_at: at(24 * 9) }),
    bk('gb-done', { status: 'completed', scheduled_at: at(-24 * 5) }),
    bk('gb-old', { status: 'completed', scheduled_at: at(-24 * 40), customer_total: 2950, services: svc('1:1 Career Coaching', 'career', 2500, 45), profiles: HOST2 }),
    bk('gb-cancel', { status: 'cancelled', payment_status: 'refunded', scheduled_at: at(-24 * 12) }),
  ],
  '/memberships/my-subscriptions': {
    subscriptions: [{ id: 'm1', host_id: 'h1', status: 'active', paid: true, current_period_end: at(24 * 20), host: HOST, tier: { name: 'Inner Circle', type: 'paid', price_inr: 499 } }],
  },
  '/courses/purchased': [
    { id: 'c1', title: 'Yoga for Desk Workers', slug: 'desk-yoga', thumbnail_url: null, profiles: HOST },
    { id: 'c2', title: 'Interview Mastery', slug: 'interviews', thumbnail_url: null, profiles: HOST2 },
  ],
  '/invoices/mine': [
    { id: 'i1', invoice_number: 'MT/25-26/00042', source_type: 'booking', issued_at: at(-24 * 5), total: 1180, access_token: 't' },
    { id: 'i2', invoice_number: 'MT/25-26/00031', source_type: 'subscription', issued_at: at(-24 * 10), total: 499, access_token: 't' },
  ],
  '/reviews/received': { reviews: [{ id: 'r1', rating: 5, comment: 'Always on time and well prepared. A joy to coach.', created_at: at(-24 * 39), profiles: HOST2, bookings: { services: { title: '1:1 Career Coaching' } } }], count: 1, avg: 5 },
  '/reviews/booking/gb-done': null,
  '/reviews/booking/gb-old': { rating: 4, comment: 'Clear, practical advice.' },
});
