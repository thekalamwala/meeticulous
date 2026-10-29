'use strict';
// host_first_booking — the tail of the activation funnel, keyed to the host.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/trackServer', () => ({ trackServer: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { trackServer } = require('../../utils/trackServer');
const { maybeTrackFirstBooking } = require('../../services/hostActivation');

const HOST = { id: 'h1' };
const PAID = { id: 'b1', vendor_amount: 500 };

// bookings count query → { count }
function wireCount(count) {
  supabaseAdmin.from.mockImplementation(() => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    // head:true count query resolves as a thenable returning { count }
    c.then = (resolve) => resolve({ count });
    return c;
  });
}

beforeEach(() => jest.clearAllMocks());

test('fires host_first_booking on the first paid booking (count === 1)', async () => {
  wireCount(1);
  const r = await maybeTrackFirstBooking({ host: HOST, booking: PAID });
  expect(r).toEqual({ tracked: true });
  expect(trackServer).toHaveBeenCalledWith('h1', 'host_first_booking',
    expect.objectContaining({ booking_id: 'b1', amount: 500 }),
    expect.objectContaining({ value: 500, currency: 'INR' })); // conversion → GA4 + Meta custom
});

test('does NOT fire on a later booking (count > 1)', async () => {
  wireCount(3);
  const r = await maybeTrackFirstBooking({ host: HOST, booking: PAID });
  expect(r).toEqual({ tracked: false });
  expect(trackServer).not.toHaveBeenCalled();
});

test('skips a free (₹0) booking', async () => {
  wireCount(1);
  const r = await maybeTrackFirstBooking({ host: HOST, booking: { id: 'b0', vendor_amount: 0 } });
  expect(r).toEqual({ tracked: false });
  expect(trackServer).not.toHaveBeenCalled();
});
