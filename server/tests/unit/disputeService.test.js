'use strict';
/**
 * disputeService.recordDispute — dedup an open dispute per booking; never throw;
 * schema-fallback (missing table → null) so payout reversal still proceeds.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { recordDispute } = require('../../services/disputeService');

const chain = ({ existing = null, inserted = null, insertError = null }) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve({ data: existing, error: null }));
  c.insert = jest.fn(() => c);
  c.single = jest.fn(() => Promise.resolve({ data: inserted, error: insertError }));
  return c;
};

beforeEach(() => jest.clearAllMocks());

test('inserts a new dispute when none open', async () => {
  const c = chain({ inserted: { id: 'd1', booking_id: 'b1', status: 'open' } });
  supabaseAdmin.from.mockReturnValue(c);
  const res = await recordDispute({ bookingId: 'b1', raisedBy: 'guest', reason: 'no show' });
  expect(res).toMatchObject({ id: 'd1' });
  expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ booking_id: 'b1', raised_by: 'guest', reason: 'no show', payout_action: 'none' }));
});

test('dedups — returns the existing open dispute, no insert', async () => {
  const c = chain({ existing: { id: 'd0', status: 'open' } });
  supabaseAdmin.from.mockReturnValue(c);
  const res = await recordDispute({ bookingId: 'b1', raisedBy: 'admin' });
  expect(res).toMatchObject({ id: 'd0' });
  expect(c.insert).not.toHaveBeenCalled();
});

test('missing table → null (schema fallback), never throws', async () => {
  const c = chain({ insertError: { code: '42P01', message: 'relation "booking_disputes" does not exist' } });
  supabaseAdmin.from.mockReturnValue(c);
  const res = await recordDispute({ bookingId: 'b1', raisedBy: 'razorpay' });
  expect(res).toBeNull();
});
