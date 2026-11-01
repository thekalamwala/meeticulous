'use strict';
// Audience hint: anonymous visitors get an inferred host/guest side from the page
// they're chatting on; ambiguous pages stay neutral (null → no nudge). Heavy deps
// are mocked so requiring the controller doesn't touch network/DB.

jest.mock('../../services/ai/voyageClient', () => ({ isConfigured: () => true, embedQuery: jest.fn(), MODEL: 'v' }));
jest.mock('../../services/ai/anthropicClient', () => ({ MODELS: { generate: 'gen' }, isConfigured: () => true, getClient: () => ({}) }));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { rpc: jest.fn(), from: jest.fn() } }));

const { _inferAudienceFromUrl } = require('../../controllers/botController');

describe('inferAudienceFromUrl', () => {
  test.each([
    ['https://meeticulous.com/dashboard/services', 'host'],
    ['https://meeticulous.com/login-as-vendor', 'host'],
    ['https://meeticulous.com/pricing', 'host'],
    ['https://meeticulous.com/become-a-host', 'host'],
    ['https://meeticulous.com/for/therapists', 'host'],
    ['https://meeticulous.com/user/my-bookings', 'guest'],
    ['https://meeticulous.com/explore', 'guest'],
    ['https://meeticulous.com/some-host-slug/haircut', null], // a host profile / booking page — ambiguous, stay neutral
    ['https://meeticulous.com/', null],
    ['', null],
    [null, null],
  ])('%s → %s', (url, expected) => {
    expect(_inferAudienceFromUrl(url)).toBe(expected);
  });
});
