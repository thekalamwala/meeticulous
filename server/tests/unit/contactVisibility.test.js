const { redactBookingContact, GRACE_MS } = require('../../lib/contactVisibility');

// Pure function over a booking object — no DB mock needed (spec: do NOT mock DB).
const NOW = new Date('2026-07-15T12:00:00Z').getTime();

// Build a booking `mins` minutes from NOW (negative = past), with a meeting mode
// and both phone carriers (guest_phone column + counterparty profiles join).
const mk = (mins, mode = 'online') => ({
  scheduled_at: new Date(NOW + mins * 60000).toISOString(),
  guest_phone: '+919000000001',
  services: { meeting_mode: mode },
  profiles: { phone: '+919000000002', email: 'other@x.com' },
});

describe('redactBookingContact — guest phone → host', () => {
  const hostView = (plan) => ({ role: 'host', plan });

  it('Starter host never sees guest phone', () => {
    const b = redactBookingContact(mk(5), hostView('starter'), NOW);
    expect(b.guest_phone).toBeNull();
    expect(b.profiles.phone).toBeNull();
  });

  // v3.165: the legacy paid rows carry Pro entitlements, so `creator`
  // now sees the number inside the window just like `premium` does.
  it('Pro (premium) host sees guest phone inside the window', () => {
    expect(redactBookingContact(mk(-100), hostView('premium'), NOW).guest_phone).not.toBeNull();
  });

  it('legacy paid (creator) host sees guest phone inside the window', () => {
    expect(redactBookingContact(mk(-100), hostView('creator'), NOW).guest_phone).not.toBeNull();
  });

  it('free (Starter) host never sees guest phone, even inside the window', () => {
    expect(redactBookingContact(mk(-100), hostView('free'), NOW).guest_phone).toBeNull();
  });

  it('a viewer with no plan never sees guest phone', () => {
    expect(redactBookingContact(mk(-100), hostView(undefined), NOW).guest_phone).toBeNull();
  });

  it('Studio host: hidden while booking is far out', () => {
    const b = redactBookingContact(mk(3 * 24 * 60), hostView('professional'), NOW); // 3 days
    expect(b.guest_phone).toBeNull();
    expect(b.profiles.phone).toBeNull();
  });

  it('Studio host: visible from 15 min before (imminent)', () => {
    const b = redactBookingContact(mk(10), hostView('professional'), NOW);
    expect(b.guest_phone).toBe('+919000000001');
    expect(b.profiles.phone).toBe('+919000000002');
  });

  it('Studio host: exactly at the 15-min boundary is open', () => {
    // scheduled_at is exactly GRACE_MS ahead → now == open edge → visible.
    const b = { ...mk(0), scheduled_at: new Date(NOW + GRACE_MS).toISOString() };
    expect(redactBookingContact(b, hostView('professional'), NOW).guest_phone).toBe('+919000000001');
  });

  it('Studio host: visible permanently after the session (past)', () => {
    expect(redactBookingContact(mk(-500), hostView('professional'), NOW).guest_phone).toBe('+919000000001');
  });

  it('Supreme host: always visible, even far future', () => {
    expect(redactBookingContact(mk(10 * 24 * 60), hostView('supreme'), NOW).guest_phone).toBe('+919000000001');
  });
});

describe('redactBookingContact — host phone → guest', () => {
  const guestView = { role: 'guest' };

  it('online booking: host phone hidden even 1 min before', () => {
    expect(redactBookingContact(mk(1, 'online'), guestView, NOW).profiles.phone).toBeNull();
  });

  it('offline booking >15 min out: hidden', () => {
    expect(redactBookingContact(mk(60, 'offline'), guestView, NOW).profiles.phone).toBeNull();
  });

  it('offline booking within 15 min: visible', () => {
    expect(redactBookingContact(mk(10, 'offline'), guestView, NOW).profiles.phone).toBe('+919000000002');
  });

  it('offline booking in the past: visible (permanent)', () => {
    expect(redactBookingContact(mk(-60, 'offline'), guestView, NOW).profiles.phone).toBe('+919000000002');
  });
});

describe('redactBookingContact — untouched fields + edge cases', () => {
  it('email and location survive redaction', () => {
    const b = mk(3 * 24 * 60);
    b.guest_email = 'guest@x.com';
    b.location = 'MG Road';
    redactBookingContact(b, { role: 'host', plan: 'starter' }, NOW);
    expect(b.guest_email).toBe('guest@x.com');
    expect(b.location).toBe('MG Road');
    expect(b.profiles.email).toBe('other@x.com');
  });

  it('missing services defaults to online (host phone stays hidden for guest)', () => {
    const b = { scheduled_at: new Date(NOW + 5 * 60000).toISOString(), profiles: { phone: 'p' } };
    expect(redactBookingContact(b, { role: 'guest' }, NOW).profiles.phone).toBeNull();
  });

  it('null booking passes through', () => {
    expect(redactBookingContact(null, { role: 'host', plan: 'supreme' }, NOW)).toBeNull();
  });
});
