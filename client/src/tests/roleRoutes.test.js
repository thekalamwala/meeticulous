import { describe, it, expect } from 'vitest';
import { hostPathToGuestPath, isHost } from '../utils/roleRoutes';

describe('hostPathToGuestPath', () => {
  it('maps /dashboard/bookings → /user/my-bookings', () => {
    expect(hostPathToGuestPath('/dashboard/bookings')).toBe('/user/my-bookings');
  });
  it('maps /dashboard/profile → /user/profile', () => {
    expect(hostPathToGuestPath('/dashboard/profile')).toBe('/user/profile');
  });
  it('falls back to /user/my-bookings when there is no guest equivalent', () => {
    expect(hostPathToGuestPath('/dashboard')).toBe('/user/my-bookings');
    expect(hostPathToGuestPath('/dashboard/earnings')).toBe('/user/my-bookings');
    expect(hostPathToGuestPath('/dashboard/payments/payouts')).toBe('/user/my-bookings');
  });
});

describe('isHost', () => {
  it('is true for host', () => { expect(isHost({ role: 'host' })).toBe(true); });
  it('is true for superadmin', () => { expect(isHost({ role: 'superadmin' })).toBe(true); });
  it('is false for a guest', () => { expect(isHost({ role: 'user' })).toBe(false); });
  it('is true when the is_host capability is set (v3.34)', () => {
    expect(isHost({ is_host: true })).toBe(true);
  });
  it('is false when is_host is false and there is no host role', () => {
    expect(isHost({ is_host: false, role: 'guest' })).toBe(false);
  });
  it('is false for null/undefined user', () => {
    expect(isHost(null)).toBe(false);
    expect(isHost(undefined)).toBe(false);
  });
});
