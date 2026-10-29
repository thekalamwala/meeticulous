// Bot self-service actions — supabase / confirmation / email mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/bookingConfirmation', () => ({ sendBookingConfirmation: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/sendEmail', () => jest.fn(() => Promise.resolve()));

const { supabaseAdmin } = require('../../config/supabase');
const { sendBookingConfirmation } = require('../../services/bookingConfirmation');
const sendEmail = require('../../utils/sendEmail');
const { detectAction, runAction } = require('../../services/supportActions');

// per-table result queue → chainable builder
function qb(result) {
  const b = {};
  ['select', 'eq', 'order', 'limit'].forEach((m) => { b[m] = () => b; });
  b.maybeSingle = () => Promise.resolve(result);
  b.then = (res) => res(result);
  return b;
}
function wire(map) {
  supabaseAdmin.from.mockImplementation((t) => qb((map[t] || []).shift() || { data: null }));
}
const GUEST = { userId: null, guestPhone: '+9199', isHost: false };

beforeEach(() => jest.clearAllMocks());

describe('detectAction', () => {
  it('classifies the three requests', () => {
    expect(detectAction('can you resend my booking confirmation?')).toBe('resend_confirmation');
    expect(detectAction('I need my invoice again')).toBe('resend_invoice');
    expect(detectAction('send me the calendar invite')).toBe('resend_calendar');
  });
  it('returns null for unrelated messages', () => {
    expect(detectAction('how do payouts work?')).toBeNull();
    expect(detectAction('')).toBeNull();
  });
});

describe('runAction', () => {
  const booking = { data: [{ id: 'bk1', service_id: 's1', scheduled_at: '2026-09-01T10:00:00Z', end_at: '2026-09-01T10:30:00Z', guest_name: 'Rahul', guest_email: 'rahul@example.com', host_id: 'h1' }] };
  const svc = { data: { title: 'Tarot Reading' } };

  it('resend_confirmation → calls sendBookingConfirmation with the real id', async () => {
    wire({ bookings: [booking], services: [svc] });
    const r = await runAction('resend_confirmation', GUEST);
    expect(sendBookingConfirmation).toHaveBeenCalledWith({ bookingId: 'bk1' });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Tarot Reading/);
  });

  it('resend_invoice → emails the invoice link', async () => {
    wire({ bookings: [booking], services: [svc], invoices: [{ data: { id: 'inv1', access_token: 'tok', invoice_number: 'INV-9' } }] });
    const r = await runAction('resend_invoice', GUEST);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('rahul@example.com');
    expect(sendEmail.mock.calls[0][0].html).toMatch(/inv1\?token=tok/);
    expect(r.ok).toBe(true);
  });

  it('resend_calendar → emails an .ics attachment', async () => {
    wire({ bookings: [booking], services: [svc] });
    const r = await runAction('resend_calendar', GUEST);
    const call = sendEmail.mock.calls[0][0];
    expect(call.attachments[0].filename).toBe('booking.ics');
    expect(Buffer.from(call.attachments[0].content, 'base64').toString()).toContain('BEGIN:VCALENDAR');
    expect(r.ok).toBe(true);
  });

  it('no booking → ok:false, offers a human, no side effects', async () => {
    wire({ bookings: [{ data: [] }] });
    const r = await runAction('resend_confirmation', GUEST);
    expect(r.ok).toBe(false);
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it('invoice not generated → ok:false, no email', async () => {
    wire({ bookings: [booking], services: [svc], invoices: [{ data: null }] });
    const r = await runAction('resend_invoice', GUEST);
    expect(r.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
