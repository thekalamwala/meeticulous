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
    ['https://bookasloth.com/dashboard/services', 'host'],
    ['https://bookasloth.com/login-as-vendor', 'host'],
    ['https://bookasloth.com/pricing', 'host'],
    ['https://bookasloth.com/be-a-sloth', 'host'],
    ['https://bookasloth.com/for/therapists', 'host'],
    ['https://bookasloth.com/user/my-bookings', 'guest'],
    ['https://bookasloth.com/explore', 'guest'],
    ['https://bookasloth.com/some-host-slug/haircut', null], // a host profile / booking page — ambiguous, stay neutral
    ['https://bookasloth.com/', null],
    ['', null],
    [null, null],
  ])('%s → %s', (url, expected) => {
    expect(_inferAudienceFromUrl(url)).toBe(expected);
  });
});
