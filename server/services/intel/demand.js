/** Creator Intelligence — Demand. Pure: takes bookings rows, returns the block. */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const IST_MS = 330 * 60 * 1000;

function buildDemand(rows = []) {
  const byWeekday = DAYS.map((day) => ({ day, bookings: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: 0 }));
  const perGuest = new Map();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (!Number.isNaN(t)) {
      const d = new Date(t + IST_MS); // shifted, so UTC getters read the IST wall clock
      byWeekday[(d.getUTCDay() + 6) % 7].bookings += 1;
      byHour[d.getUTCHours()].bookings += 1;
    }
    const k = r.client_id || r.guest_phone || r.guest_email;
    if (k) perGuest.set(k, (perGuest.get(k) || 0) + 1);
  }
  const counts = [...perGuest.values()];
  return {
    byWeekday,
    byHour,
    retention: {
      repeatGuestPct: counts.length ? counts.filter((c) => c > 1).length / counts.length : 0,
      avgBookingsPerGuest: counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
    },
    // leadTimeDays omitted: BOOKING_COLUMNS carries no appointment-date field.
  };
}

module.exports = { buildDemand };
