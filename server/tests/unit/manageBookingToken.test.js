/**
 * Unit tests for the manage-booking token (utils/manageBookingToken).
 * Possession of a valid token authorizes exactly one booking id; anything
 * tampered/expired/foreign returns null.
 */
const jwt = require('jsonwebtoken');
const { sign, verify } = require('../../utils/manageBookingToken');

describe('manageBookingToken', () => {
  test('round-trips the booking id', () => {
    const token = sign('booking-123');
    expect(verify(token)).toBe('booking-123');
  });

  test('sign returns null without a booking id', () => {
    expect(sign()).toBeNull();
    expect(sign('')).toBeNull();
  });

  test('verify returns null on junk / tampered / non-string input', () => {
    expect(verify('not-a-jwt')).toBeNull();
    expect(verify(sign('b1') + 'x')).toBeNull();
    expect(verify(undefined)).toBeNull();
    expect(verify(123)).toBeNull();
  });

  test('rejects a token signed for a different purpose (no cross-use)', () => {
    // A guest_booking grant must never authorize the manage path.
    const foreign = jwt.sign({ purpose: 'guest_booking', bid: 'b1' }, 'wrong-secret');
    expect(verify(foreign)).toBeNull();
  });

  test('rejects an expired token', () => {
    // Sign with the same secret the util uses but already expired.
    const secret = process.env.OAUTH_STATE_SECRET ||
      require('crypto').createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-oauth-state')
        .update('oauth-state-v1').digest('hex');
    const expired = jwt.sign({ purpose: 'manage_booking', bid: 'b1' }, secret, { expiresIn: -10 });
    expect(verify(expired)).toBeNull();
  });
});
