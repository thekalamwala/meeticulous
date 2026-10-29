'use strict';
// maybeStampInvite: stamps ONLY when the OAuth state carries an invite slug.
// The heavy auth deps are mocked so we can load the controller without env/DB.
jest.mock('../config/supabase', () => ({ supabaseAdmin: {}, signInWithPassword: jest.fn(), mintSessionForEmail: jest.fn() }));
jest.mock('../config/google', () => ({ getAuthUrl: () => 'https://x', getTokensFromCode: jest.fn(), getCalendarTimezone: jest.fn(), oauth2Client: {} }));
jest.mock('../services/inviteService', () => ({ stampInviteSlug: jest.fn(async () => {}) }));

const inviteService = require('../services/inviteService');
const { maybeStampInvite } = require('../controllers/authController');

beforeEach(() => inviteService.stampInviteSlug.mockClear());

test('stamps when state carries an invite slug', async () => {
  await maybeStampInvite('new-id', { flow: 'vendor_auth', invite: 'social' });
  expect(inviteService.stampInviteSlug).toHaveBeenCalledWith('new-id', 'social');
});

test('no stamp when state has no invite', async () => {
  await maybeStampInvite('new-id', { flow: 'vendor_auth' });
  expect(inviteService.stampInviteSlug).not.toHaveBeenCalled();
});

test('no stamp when state is null', async () => {
  await maybeStampInvite('new-id', null);
  expect(inviteService.stampInviteSlug).not.toHaveBeenCalled();
});
