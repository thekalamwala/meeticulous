/**
 * guestResolver.js — the identity layer under admin "Guest 360".
 *
 * A guest is NOT a clean table: bookings carry guest_id (null for logged-out OTP
 * bookings), plus guest_phone / guest_email in inconsistent formats. The stable
 * identity is the CRM customer key (utils/customerKey): phone-last-10 wins, else
 * email — the SAME rule the rest of the platform already derives clients by, so
 * Guest 360 agrees with the CRM instead of inventing a second notion of "who".
 *
 * These are pure functions over an array of booking rows so they can be unit-
 * tested without a DB (see the self-check at the bottom). The controller does the
 * supabase reads and hands rows in.
 *
 * ponytail: aggregates all bookings in Node. Fine at current volume (tens of
 * bookings); move the list to a GROUP-BY RPC if bookings cross ~10k.
 */
'use strict';

const { customerKey, phoneKey, emailKey, displayFromKey } = require('../utils/customerKey');

/** The stable key for a booking row, or null when it has no usable identity. */
const keyForBooking = (b) => customerKey({ phone: b.guest_phone, email: b.guest_email });

/**
 * Roll booking rows up into one entry per distinct guest.
 * @param {Array} bookings rows with guest_phone/guest_email/guest_id/guest_name,
 *   customer_total, payment_status, status, scheduled_at, created_at.
 * @returns {Array} guest summaries, most-recent booking first.
 */
function aggregateGuests(bookings = []) {
  const map = new Map();
  for (const b of bookings) {
    const key = keyForBooking(b);
    if (!key) continue; // no phone and no email → not a resolvable guest
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: '',
        phone: displayFromKey(key)?.type === 'phone' ? displayFromKey(key).value : null,
        email: null,
        guest_ids: new Set(),
        bookings: 0, spent: 0,
        completed: 0, cancelled: 0, no_show: 0,
        first_booking_at: null, last_booking_at: null,
        _nameTs: null,
      };
      map.set(key, g);
    }
    g.bookings += 1;
    if (b.guest_id) g.guest_ids.add(b.guest_id);
    if (!g.email && b.guest_email) g.email = String(b.guest_email).trim().toLowerCase();
    if (!g.phone && b.guest_phone) { const p = phoneKey(b.guest_phone); if (p) g.phone = p.slice(2); }

    // Name: take the one from the most recent booking (people fix typos over time).
    const nameTs = b.created_at || b.scheduled_at || null;
    if (b.guest_name && (!g._nameTs || (nameTs && nameTs > g._nameTs))) { g.name = b.guest_name; g._nameTs = nameTs; }

    if (b.payment_status === 'paid') g.spent += Number(b.customer_total) || 0;
    if (b.status === 'completed') g.completed += 1;
    else if (b.status === 'cancelled') g.cancelled += 1;
    else if (b.status === 'no_show') g.no_show += 1;

    const at = b.scheduled_at || b.created_at;
    if (at) {
      if (!g.first_booking_at || at < g.first_booking_at) g.first_booking_at = at;
      if (!g.last_booking_at || at > g.last_booking_at) g.last_booking_at = at;
    }
  }
  return [...map.values()]
    .map(finalize)
    .sort((a, b) => new Date(b.last_booking_at || 0) - new Date(a.last_booking_at || 0));
}

function finalize(g) {
  const guest_ids = [...g.guest_ids];
  return {
    key: g.key,
    name: g.name || 'Guest',
    phone: g.phone || null,
    email: g.email || null,
    guest_ids,
    has_account: guest_ids.length > 0,
    bookings: g.bookings,
    spent: Math.round(g.spent * 100) / 100,
    completed: g.completed,
    cancelled: g.cancelled,
    no_show: g.no_show,
    first_booking_at: g.first_booking_at,
    last_booking_at: g.last_booking_at,
  };
}

/** All booking rows belonging to one guest key. */
const filterBookingsForKey = (bookings, key) => (bookings || []).filter((b) => keyForBooking(b) === key);

/** Red-flag heuristics for a single aggregated guest. */
function redFlags(g, { refunded = 0, suppressed = false } = {}) {
  const flags = [];
  const decided = g.completed + g.cancelled + g.no_show;
  if (decided >= 3 && (g.cancelled + g.no_show) / decided > 0.5) flags.push('high_cancellation');
  if (g.no_show >= 2) flags.push('repeat_no_show');
  if (refunded >= 2) flags.push('repeat_refunds');
  if (suppressed) flags.push('marketing_suppressed');
  return flags;
}

module.exports = { keyForBooking, aggregateGuests, filterBookingsForKey, redFlags, customerKey, emailKey };

// ── self-check ──────────────────────────────────────────────────────────────
if (require.main === module) {
  const assert = require('assert');
  const rows = [
    // Same person, three phone formats + one with only email that also matches phone-key person by phone.
    { guest_phone: '+91 98765 43210', guest_name: 'Asha',  customer_total: 500, payment_status: 'paid',   status: 'completed', scheduled_at: '2026-01-01T10:00:00Z', created_at: '2026-01-01T09:00:00Z' },
    { guest_phone: '9876543210',      guest_name: 'Asha K', customer_total: 300, payment_status: 'paid',   status: 'no_show',   scheduled_at: '2026-02-01T10:00:00Z', created_at: '2026-02-01T09:00:00Z' },
    { guest_phone: '098765 43210',    guest_name: 'Asha K', customer_total: 999, payment_status: 'unpaid', status: 'cancelled', scheduled_at: '2026-03-01T10:00:00Z', created_at: '2026-03-01T09:00:00Z' },
    // A host who also booked as a guest — has guest_id, must NOT be a special case.
    { guest_phone: '8000000000', guest_id: 'host-uuid', guest_name: 'Ravi', customer_total: 200, payment_status: 'paid', status: 'completed', scheduled_at: '2026-01-05T10:00:00Z', created_at: '2026-01-05T10:00:00Z' },
    // No identity at all → skipped.
    { guest_name: 'Ghost', customer_total: 100, payment_status: 'paid', status: 'completed' },
  ];
  const guests = aggregateGuests(rows);
  assert.strictEqual(guests.length, 2, 'three phone formats collapse to one guest; no-identity row dropped → 2 total');

  const asha = guests.find((g) => g.key === 'p:9876543210');
  assert(asha, 'phone-key guest present');
  assert.strictEqual(asha.bookings, 3, 'all three formats counted');
  assert.strictEqual(asha.spent, 800, 'only PAID bookings sum into spent (500+300, not the 999 unpaid)');
  assert.strictEqual(asha.no_show, 1, 'no_show counted');
  assert.strictEqual(asha.cancelled, 1, 'cancelled counted');
  assert.strictEqual(asha.name, 'Asha K', 'name taken from the most recent booking');
  assert.strictEqual(asha.has_account, false, 'no guest_id on any row → no linked account');

  const ravi = guests.find((g) => g.key === 'p:8000000000');
  assert.strictEqual(ravi.has_account, true, 'a guest with a guest_id is just a linked account, not special-cased');

  assert.strictEqual(filterBookingsForKey(rows, 'p:9876543210').length, 3, 'filter returns exactly that guest\'s bookings');
  assert.deepStrictEqual(redFlags({ completed: 0, cancelled: 2, no_show: 2 }, { refunded: 2, suppressed: true }).sort(),
    ['high_cancellation', 'marketing_suppressed', 'repeat_no_show', 'repeat_refunds'].sort(), 'red flags fire');

  console.log('guestResolver self-check OK');
}
