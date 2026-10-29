'use strict';
/**
 * Unit tests for slugAvailableForUser.
 *
 * Tests the authed, history-backed, self-aware availability check that replaced
 * the old checkSlugAvailable on the POST /api/onboarding/slug-available route.
 *
 * Key invariants:
 *   - Returns available:true  for an unclaimed name
 *   - Returns available:true  when the owner IS the caller (self — idempotent)
 *   - Returns available:false reason:'taken'    when owned by a DIFFERENT user
 *   - Returns available:false reason:'reserved' for reserved words
 *   - Returns available:false reason:'invalid'  for invalid slugs
 */

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
  signInWithPassword: jest.fn(),
}));
jest.mock('../../utils/notify', () => ({ sendWhatsAppOtp: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ send: jest.fn() }));

// Mock usernameService at the module level BEFORE requiring the controller.
jest.mock('../../services/usernameService', () => ({
  usernameOwner: jest.fn(),
  usernameExists: jest.fn(),
  setOnboardingUsername: jest.fn(),
}));

const usernameService = require('../../services/usernameService');
const { slugAvailableForUser } = require('../../controllers/vendorOnboardingController');

const CALLER_ID  = 'user-aaa';
const OTHER_ID   = 'user-bbb';

beforeEach(() => jest.clearAllMocks());

describe('slugAvailableForUser', () => {
  test('returns available:true for a completely free slug', async () => {
    usernameService.usernameOwner.mockResolvedValue(null); // nobody owns it
    const result = await slugAvailableForUser(CALLER_ID, 'free-slug');
    expect(result).toEqual({ available: true });
    expect(usernameService.usernameOwner).toHaveBeenCalledWith('free-slug');
  });

  test('returns available:true when the slug owner IS the caller (self)', async () => {
    usernameService.usernameOwner.mockResolvedValue(CALLER_ID);
    const result = await slugAvailableForUser(CALLER_ID, 'my-own-slug');
    expect(result).toEqual({ available: true });
  });

  test('returns available:false reason:taken when slug owned by a different user', async () => {
    usernameService.usernameOwner.mockResolvedValue(OTHER_ID);
    const result = await slugAvailableForUser(CALLER_ID, 'other-slug');
    expect(result).toEqual({ available: false, reason: 'taken' });
  });

  test('returns available:false reason:reserved for a reserved word', async () => {
    // 'admin' is in the reserved list
    const result = await slugAvailableForUser(CALLER_ID, 'admin');
    expect(result).toEqual({ available: false, reason: 'reserved' });
    // Should NOT hit the DB for reserved words
    expect(usernameService.usernameOwner).not.toHaveBeenCalled();
  });

  test('returns available:false reason:invalid for a too-short slug', async () => {
    const result = await slugAvailableForUser(CALLER_ID, 'ab');
    expect(result).toEqual({ available: false, reason: 'invalid' });
    expect(usernameService.usernameOwner).not.toHaveBeenCalled();
  });

  test('returns available:false reason:invalid for slug with spaces', async () => {
    const result = await slugAvailableForUser(CALLER_ID, 'bad slug!');
    expect(result).toEqual({ available: false, reason: 'invalid' });
    expect(usernameService.usernameOwner).not.toHaveBeenCalled();
  });

  test('normalises to lowercase before checking (MyCoolSlug → mycoolslug, free)', async () => {
    usernameService.usernameOwner.mockResolvedValue(null);
    const result = await slugAvailableForUser(CALLER_ID, 'MyCoolSlug');
    // slugAvailableForUser does .toLowerCase() BEFORE isValidSlug, so
    // 'MyCoolSlug' → 'mycoolslug' which passes the regex and is free.
    expect(result).toEqual({ available: true });
  });

  test('trims whitespace before validation', async () => {
    usernameService.usernameOwner.mockResolvedValue(null);
    const result = await slugAvailableForUser(CALLER_ID, '  cool-slug  ');
    // after .toLowerCase().trim() → 'cool-slug' which is valid and free
    expect(result).toEqual({ available: true });
  });
});
