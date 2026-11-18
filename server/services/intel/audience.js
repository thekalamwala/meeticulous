/** Creator Intelligence — Audience. Pure: takes bookings rows, returns the block. */
const key = (r) => r.client_id || r.guest_phone || r.guest_email || null;
const live = (r) => !['cancelled', 'rejected', 'expired'].includes(r.status);

function buildAudience(rows = []) {
  const guests = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const g = guests.get(k) || { name: r.guest_name || 'Guest', bookings: 0, lifetime: 0 };
    g.bookings += 1;
    if (r.payment_status === 'paid') g.lifetime += Number(r.vendor_amount ?? r.customer_total) || 0;
    if (r.guest_name) g.name = r.guest_name;
    guests.set(k, g);
  }
  const all = [...guests.values()];
  const returningGuests = all.filter((g) => g.bookings > 1).length;
  const paidBookings = rows.filter((r) => r.payment_status === 'paid').length;
  return {
    newGuests: all.length - returningGuests,
    returningGuests,
    repeatRate: all.length ? returningGuests / all.length : 0,
    topGuests: all.sort((a, b) => b.lifetime - a.lifetime || b.bookings - a.bookings).slice(0, 8),
    funnel: {
      bookings: rows.filter(live).length,
      paidBookings,
      paidPct: rows.length ? paidBookings / rows.length : 0,
    },
  };
}

module.exports = { buildAudience };
