/**
 * securityRisc.test.js — RISC receiver: event-type filtering + token rejection.
 *
 * Signature verification against Google's live JWKS is NOT exercised here (that
 * needs a real/mocked key). These cover the pure decision logic and the reject
 * paths that must never act without a valid SET: a garbage token fails at decode
 * (no `kid`) BEFORE any network call, and a missing body is a 400.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/profileSecrets', () => ({ setGoogleTokens: jest.fn() }));

const {
  receiveRiscEvent,
  actionableEventTypes,
  ACTIONABLE_EVENTS,
} = require('../../controllers/securityRiscController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

describe('actionableEventTypes', () => {
  test('keeps only the four actionable RISC event URIs', () => {
    const base = 'https://schemas.openid.net/secevent/risc/event-type/';
    const events = {
      [`${base}tokens-revoked`]: {},
      [`${base}account-disabled`]: {},
      [`${base}verification`]: {}, // ping — not actionable
      'https://example.com/other': {},
    };
    const got = actionableEventTypes(events);
    expect(got.sort()).toEqual([`${base}account-disabled`, `${base}tokens-revoked`].sort());
    expect(got.every((e) => ACTIONABLE_EVENTS.has(e))).toBe(true);
  });

  test('empty / missing events → no actions', () => {
    expect(actionableEventTypes(undefined)).toEqual([]);
    expect(actionableEventTypes({})).toEqual([]);
  });
});

describe('receiveRiscEvent — reject paths (never act without a valid SET)', () => {
  test('missing token → 400', async () => {
    const r = res();
    await receiveRiscEvent({ body: '' }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  test('garbage token → 401, no revocation', async () => {
    const profileSecrets = require('../../utils/profileSecrets');
    const r = res();
    await receiveRiscEvent({ body: 'not-a-jwt' }, r);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(profileSecrets.setGoogleTokens).not.toHaveBeenCalled();
  });
});
