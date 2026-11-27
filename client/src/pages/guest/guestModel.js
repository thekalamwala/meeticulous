// Guest console rules, in one place, pure (no React) so they are unit-tested
// (tests/guestModel.test.js). Home, Bookings, booking detail and Rewards all read
// from here, so a booking can never be "upcoming" on one screen and "past" on
// another. Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md §5.

const CANCELLED = ['cancelled', 'canceled'];
const DAY = 86400000;
// A booking can auto-complete on a timer even if nobody joined, so the guest keeps
// a window after completion to say it didn't happen (same endpoint as Report).
export const REPORT_WINDOW_DAYS = 14;

const t = (iso) => new Date(iso).getTime();
const status = (b) => String(b?.status || '').toLowerCase();

// PostgREST names the host embed after the FK hint on the full select and plain
// `profiles` on the fallback select — read both.
export const hostOf = (b) => b?.['profiles!bookings_host_id_fkey'] || b?.profiles || {};
export const svcOf = (b) => b?.services || {};

export const isCancelled = (b) => CANCELLED.includes(status(b));
export const isUpcoming = (b, now = new Date()) =>
  t(b?.scheduled_at) >= +now && !isCancelled(b) && status(b) !== 'completed' && status(b) !== 'no_show';

// The session time has passed, it was paid and confirmed: ask the guest whether it
// happened. Yes releases the host's held payout now (Razorpay auto-releases ~24h
// later otherwise); Report reverses it and opens a dispute.
export const canConfirm = (b, now = new Date()) =>
  status(b) === 'confirmed' && b?.payment_status === 'paid' && t(b?.scheduled_at) < +now;

export const canReportCompleted = (b, now = new Date()) =>
  status(b) === 'completed' && b?.payment_status === 'paid'
  && t(b?.scheduled_at) >= +now - REPORT_WINDOW_DAYS * DAY;

/** Bookings tab: upcoming · past · cancelled. Past is everything else whose time
 *  has passed — completed, but also awaiting-confirm, pending and no_show, so the
 *  confirm/dispute rows are never hidden. */
export const bucketOf = (b, now = new Date()) => {
  if (isCancelled(b)) return 'cancelled';
  return isUpcoming(b, now) ? 'upcoming' : 'past';
};

const byWhen = (a, b) => t(a.scheduled_at) - t(b.scheduled_at);

/** Home band, first match wins: an ended session waiting on the guest, the next
 *  session, book again with the last host, or a first booking. */
export const homeBand = (bookings = [], now = new Date()) => {
  const waiting = bookings.filter((b) => canConfirm(b, now)).sort(byWhen).pop();
  if (waiting) return { kind: 'confirm', booking: waiting };
  const next = bookings.filter((b) => isUpcoming(b, now)).sort(byWhen)[0];
  if (next) return { kind: 'next', booking: next };
  const again = bookings
    .filter((b) => !isUpcoming(b, now) && hostOf(b).username && svcOf(b).slug)
    .sort(byWhen).pop();
  if (again) return { kind: 'again', booking: again };
  return { kind: 'first' };
};

export const rebookHref = (b) => {
  const h = hostOf(b); const s = svcOf(b);
  return h.username && s.slug ? `/${h.username}/booking/${s.slug}` : null;
};

/* ── Money / labels ─────────────────────────────────────────────────────── */

export const shortId = (id) => (id ? `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '—');

// customer_total = service price + platform fee + GST; legacy rows fall back to list price.
export const totalOf = (b) => Number(b?.customer_total ?? svcOf(b).price ?? 0) || 0;

export const amountPaid = (b) => {
  const total = totalOf(b);
  if (total === 0) return 'Free';
  const amt = `₹${total.toLocaleString('en-IN')}`;
  if (b.payment_status === 'refunded') return `${amt} (refunded)`;
  if (b.payment_status === 'paid') return amt;
  return `${amt} · Unpaid`;
};

export const fmtWhen = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  : '');

export const relWhen = (iso, now = new Date()) => {
  const min = Math.round((t(iso) - +now) / 60000);
  if (min < 1) return 'starting now';
  if (min < 60) return `in ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr} hr`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'tomorrow' : `in ${d} days`;
};

/* ── Rewards (spec §5, option A: real progress, perks not yet applied) ──── */

// Spend thresholds (₹). Placeholder values carried from the original Loyalty page;
// admin-tunable later. Perks are worded as discounts, never stored credits
// (no-wallet rule), and none is applied yet.
export const TIERS = [
  { name: 'Bronze', spend: 0, perks: ['Welcome offers from hosts'] },
  { name: 'Silver', spend: 5000, perks: ['5% off your bookings'] },
  { name: 'Gold', spend: 15000, perks: ['10% off your bookings', 'Priority slots'] },
  { name: 'Platinum', spend: 40000, perks: ['Exclusive drops', 'Concierge support'] },
];

/** Total the guest has paid, from paid bookings only (refunded, unpaid and free
 *  bookings don't count). Courses and memberships aren't in a guest feed yet. */
export const spendOf = (bookings = []) =>
  bookings.reduce((sum, b) => (b?.payment_status === 'paid' ? sum + totalOf(b) : sum), 0);

/** Current tier, the next one, how much is left to it and progress 0..1. */
export const tierProgress = (spent) => {
  const s = Math.max(0, Number(spent) || 0);
  let i = 0;
  while (i + 1 < TIERS.length && s >= TIERS[i + 1].spend) i += 1;
  const tier = TIERS[i];
  const next = TIERS[i + 1] || null;
  if (!next) return { tier, next: null, gap: 0, pct: 1, index: i };
  return { tier, next, gap: next.spend - s, pct: (s - tier.spend) / (next.spend - tier.spend), index: i };
};
