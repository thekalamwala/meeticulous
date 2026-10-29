/**
 * earningsSeries.js
 * Pure helpers for the host Earnings trend chart. No React.
 *
 * Buckets a host's paid bookings into per-month series for the current and
 * previous N-month windows, across four metrics (net / gross / bookings / avg),
 * and computes window totals + period-over-period deltas.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const netOf = (b) =>
  b.vendor_amount != null ? b.vendor_amount : b.services?.price || 0;
const grossOf = (b) => b.services?.price || 0;

// Build a list of {y, m, key, label, labelLong}, oldest→newest, ending `offset`
// months before `now` (offset 0 = current window's newest month = now's month).
const monthSlots = (now, count, offset) => {
  const slots = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i - offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    slots.push({
      y,
      m,
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: MONTHS[m],
      labelLong: `${MONTHS[m]} '${String(y).slice(2)}`,
    });
  }
  return slots;
};

const emptyArr = (n) => Array.from({ length: n }, () => 0);

// Sum each booking's net/gross/count into the slot whose y+m it matches.
const fill = (slots, paid) => {
  const net = emptyArr(slots.length);
  const gross = emptyArr(slots.length);
  const bookings = emptyArr(slots.length);
  const indexByKey = {};
  slots.forEach((s, i) => {
    indexByKey[`${s.y}-${s.m}`] = i;
  });
  paid.forEach((b) => {
    const d = new Date(b.scheduled_at);
    const i = indexByKey[`${d.getFullYear()}-${d.getMonth()}`];
    if (i == null) return;
    net[i] += netOf(b);
    gross[i] += grossOf(b);
    bookings[i] += 1;
  });
  const avg = net.map((v, i) => (bookings[i] ? v / bookings[i] : 0));
  return { net, gross, bookings, avg };
};

const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const delta = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null);

const totalsFor = (cur, prev) => {
  const netCur = sum(cur.net), netPrev = sum(prev.net);
  const grossCur = sum(cur.gross), grossPrev = sum(prev.gross);
  const bkCur = sum(cur.bookings), bkPrev = sum(prev.bookings);
  const avgCur = bkCur ? netCur / bkCur : 0;
  const avgPrev = bkPrev ? netPrev / bkPrev : 0;
  return {
    net: { cur: netCur, prev: netPrev, delta: delta(netCur, netPrev) },
    gross: { cur: grossCur, prev: grossPrev, delta: delta(grossCur, grossPrev) },
    bookings: { cur: bkCur, prev: bkPrev, delta: delta(bkCur, bkPrev) },
    avg: { cur: avgCur, prev: avgPrev, delta: delta(avgCur, avgPrev) },
  };
};

/**
 * @param {Array} paid       bookings already filtered to payment_status === 'paid'
 * @param {number} rangeMonths  3 | 6 | 12
 * @param {Date} now
 */
export function buildSeries(paid = [], rangeMonths = 6, now = new Date()) {
  const curSlots = monthSlots(now, rangeMonths, 0);
  const prevSlots = monthSlots(now, rangeMonths, rangeMonths);
  const cur = fill(curSlots, paid);
  const prev = fill(prevSlots, paid);
  const totals = totalsFor(cur, prev);
  return {
    months: curSlots.map(({ key, label, labelLong }) => ({ key, label, labelLong })),
    series: {
      net: { cur: cur.net, prev: prev.net },
      gross: { cur: cur.gross, prev: prev.gross },
      bookings: { cur: cur.bookings, prev: prev.bookings },
      avg: { cur: cur.avg, prev: prev.avg },
    },
    totals,
    hasData: totals.bookings.cur > 0,
  };
}
