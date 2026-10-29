/**
 * tests/unit/bookingEmailDataOffline.test.js
 *
 * Offline-booking Phase 2: the booking email/WhatsApp placeholder builder must
 * surface the host's map link for offline (in-person) services, while keeping
 * online services ("Online" + Join meeting) and the venue-less lifecycle emails
 * (cancel / complete / reschedule) unchanged.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));

const { bookingEmailData } = require('../../controllers/bookingController');

const base = { serviceTitle: 'Turf', hostName: 'Host', guestName: 'G', scheduledAt: '2026-08-01T10:00:00Z', tz: 'Asia/Kolkata', bookingId: 'b1' };

describe('bookingEmailData — offline map link', () => {
  test('online: location "Online", Join meeting when a link exists', () => {
    const d = bookingEmailData({ ...base, online: true, actionLink: 'https://meet.google.com/x' });
    expect(d.location).toBe('Online');
    expect(d.action_link).toBe('https://meet.google.com/x');
    expect(d.action_label).toBe('Join meeting');
  });

  test('offline with map link: city location + Get directions to the map link', () => {
    const d = bookingEmailData({ ...base, online: false, mapLink: 'https://maps.app.goo.gl/abc', hostLocation: 'Nagpur' });
    expect(d.location).toBe('Nagpur');
    expect(d.action_link).toBe('https://maps.app.goo.gl/abc');
    expect(d.action_label).toBe('Get directions');
  });

  test('offline with map link but no city: falls back to "In person"', () => {
    const d = bookingEmailData({ ...base, online: false, mapLink: 'https://maps.app.goo.gl/abc' });
    expect(d.location).toBe('In person');
    expect(d.action_label).toBe('Get directions');
  });

  test('lifecycle email (no online/venue info): empty location, plain View booking', () => {
    const d = bookingEmailData({ ...base });
    expect(d.location).toBe('');
    expect(d.action_label).toBe('View booking');
  });
});
