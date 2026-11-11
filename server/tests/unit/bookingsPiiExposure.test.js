/**
 * tests/unit/bookingsPiiExposure.test.js
 *
 * Security audit F-01: the booking-list reads must join the counterparty
 * profile with an EXPLICIT column allowlist, never `profiles!…fkey(*)`. A
 * wildcard join returned the other party's private columns (date_of_birth,
 * is_banned, sessions_valid_after, failed_login_count, google_id, …) to any
 * host/guest with one booking.
 *
 * Column projection is enforced by PostgREST (the DB), not by JS, so the
 * meaningful regression guard is the SELECT STRING the controller sends: assert
 * it uses the allowlist and contains no wildcard profile join.
 */
const mockSelects = [];
jest.mock('../../config/supabase', () => {
  const make = () => {
    const b = {
      select: jest.fn((s) => { mockSelects.push(s); return b; }),
      eq:     jest.fn(() => b),
      neq:    jest.fn(() => b),
      order:  jest.fn(() => b),
      range:  jest.fn(() => b),
      or:     jest.fn(() => b),
      ilike:  jest.fn(() => b),
      gte:    jest.fn(() => b),
      lte:    jest.fn(() => b),
      single:      jest.fn(() => Promise.resolve({ data: { plan: 'free', phone: '9999999999' }, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: { plan: 'free', phone: '9999999999' }, error: null })),
      // Thenable so `await ...range()` resolves to an (empty) list.
      then: (resolve) => resolve({ data: [], error: null, count: 0 }),
    };
    return b;
  };
  return { supabaseAdmin: { from: jest.fn(() => make()) } };
});

const { getHostBookings, getGuestBookings } = require('../../controllers/bookingController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

const SENSITIVE = ['date_of_birth', 'is_banned', 'sessions_valid_after', 'failed_login_count', 'login_locked_until', 'google_id', 'linkedin_sub'];

beforeEach(() => { mockSelects.length = 0; });

describe('F-01 — booking lists must not wildcard-join the counterparty profile', () => {
  test('getHostBookings joins the guest profile with an explicit allowlist, not (*)', async () => {
    await getHostBookings({ user: { id: 'host-1' }, query: {} }, res());

    const sel = mockSelects.find((s) => s.includes('profiles!bookings_guest_id_fkey'));
    expect(sel).toBeDefined();
    // The leak: a wildcard profile join.
    expect(sel).not.toMatch(/profiles!bookings_guest_id_fkey\(\*\)/);
    // The fix: an explicit, minimal allowlist.
    expect(sel).toContain('profiles!bookings_guest_id_fkey(id, name, email, profile_image, phone)');
    // No private column is ever requested for the counterparty.
    for (const col of SENSITIVE) expect(sel).not.toContain(col);
  });

  test('getGuestBookings joins the host profile with an explicit allowlist, not (*)', async () => {
    await getGuestBookings({ user: { id: 'guest-1' }, query: {} }, res());

    const sel = mockSelects.find((s) => s.includes('profiles!bookings_host_id_fkey'));
    expect(sel).toBeDefined();
    expect(sel).not.toMatch(/profiles!bookings_host_id_fkey\(\*\)/);
    expect(sel).toContain('profiles!bookings_host_id_fkey(id, name, username, email, profile_image, phone)');
    for (const col of SENSITIVE) expect(sel).not.toContain(col);
  });
});
