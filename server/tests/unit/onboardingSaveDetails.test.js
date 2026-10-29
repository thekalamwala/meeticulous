'use strict';
/**
 * saveDetails WhatsApp guard: a skip:true must NEVER wipe a number the host
 * already verified via /api/whatsapp/verify-otp (data-integrity regression #20).
 */

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() }, signInWithPassword: jest.fn() }));
jest.mock('../../utils/notify', () => ({ sendWhatsAppOtp: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ send: jest.fn(() => Promise.resolve()) }));

const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/vendorOnboardingController');

beforeEach(() => jest.clearAllMocks());

// Wires the two profiles calls saveDetails makes: (1) select cur, (2) update.
// Returns a getter for the object passed to .update().
function wire(cur) {
  let captured = null;
  supabaseAdmin.from
    .mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: cur }) }) }),
    })
    .mockReturnValueOnce({
      update: (u) => {
        captured = u;
        return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'v1', ...u } }) }) }) };
      },
    });
  return () => captured;
}

test('skip:true does NOT wipe an already-verified WhatsApp number', async () => {
  const getUpdates = wire({ onboarding_step_completed: 5, whatsapp_verified: true });
  await ctrl.saveDetails('v1', { whatsapp_skipped: true });
  const u = getUpdates();
  expect(u).not.toHaveProperty('whatsapp_number');
  expect(u).not.toHaveProperty('whatsapp_verified');
});

test('skip:true DOES record the skip when WhatsApp is not verified', async () => {
  const getUpdates = wire({ onboarding_step_completed: 5, whatsapp_verified: false });
  await ctrl.saveDetails('v1', { whatsapp_skipped: true });
  const u = getUpdates();
  expect(u.whatsapp_verified).toBe(false);
  expect(u.whatsapp_number).toBeNull();
});

test('location is persisted when provided (local-SEO onboarding capture)', async () => {
  const getUpdates = wire({ onboarding_step_completed: 5, whatsapp_verified: true });
  await ctrl.saveDetails('v1', { location: 'Nagpur, Maharashtra' });
  expect(getUpdates().location).toBe('Nagpur, Maharashtra');
});

test('blank location is stored as null; omitted location is left untouched', async () => {
  const getBlank = wire({ onboarding_step_completed: 5, whatsapp_verified: true });
  await ctrl.saveDetails('v1', { location: '' });
  expect(getBlank().location).toBeNull();

  const getOmitted = wire({ onboarding_step_completed: 5, whatsapp_verified: true });
  await ctrl.saveDetails('v1', { tagline: 'hi' });
  expect(getOmitted()).not.toHaveProperty('location');
});
