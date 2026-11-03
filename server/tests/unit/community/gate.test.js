'use strict';
jest.mock('../../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { isFeatureEnabled } = require('../../../services/featureFlags');
const { supabaseAdmin } = require('../../../config/supabase');
const { communityGate, requireWrites, requireTerms, isEarlyAccess, CURRENT_TERMS_VERSION } = require('../../../middleware/communityGate');

const member = (row, error = null) => supabaseAdmin.from.mockReturnValue({
  select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error }) }) }),
});
const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const flags = (map) => isFeatureEnabled.mockImplementation(async (k) => !!map[k]);

beforeEach(() => { jest.clearAllMocks(); });

describe('communityGate', () => {
  test('flag on, no user -> next', async () => {
    flags({ community: true });
    const next = jest.fn();
    await communityGate({}, res(), next);
    expect(next).toHaveBeenCalled();
  });
  test('flag off, no user -> 404', async () => {
    flags({});
    const r = res(); const next = jest.fn();
    await communityGate({}, r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(r.json).toHaveBeenCalledWith({ message: 'Not found' });
    expect(next).not.toHaveBeenCalled();
  });
  test('flag off, early_access member -> next, cached', async () => {
    flags({}); member({ early_access: true });
    const req = { user: { id: 'u1' } }; const next = jest.fn();
    await communityGate(req, res(), next);
    expect(next).toHaveBeenCalled();
    expect(req.communityMember).toEqual({ early_access: true });
  });
  test('flag off, official badge -> next', async () => {
    flags({}); member({ badge: 'official' });
    const next = jest.fn();
    await communityGate({ user: { id: 'u1' } }, res(), next);
    expect(next).toHaveBeenCalled();
  });
  test('flag off, no member row -> 404', async () => {
    flags({}); member(null);
    const r = res();
    await communityGate({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(404);
  });
  test('flag off, table missing -> 404 (fail closed)', async () => {
    flags({}); member(null, { message: 'relation "community_members" does not exist' });
    const r = res();
    await communityGate({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(404);
  });
  test('member loaded once per request', async () => {
    flags({}); member({ early_access: true });
    const req = { user: { id: 'u1' } };
    await communityGate(req, res(), jest.fn());
    await requireTerms(req, res(), jest.fn());
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});

describe('requireWrites', () => {
  test('off + plain user -> 503', async () => {
    flags({}); member(null);
    const r = res();
    await requireWrites({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(503);
    expect(r.json.mock.calls[0][0].feature_disabled).toBe('community_writes');
  });
  test('off + staff -> next; on -> next', async () => {
    flags({}); member({ badge: 'staff' });
    const n1 = jest.fn(); await requireWrites({ user: { id: 'u1' } }, res(), n1);
    expect(n1).toHaveBeenCalled();
    flags({ community_writes: true });
    const n2 = jest.fn(); await requireWrites({ user: { id: 'u2' } }, res(), n2);
    expect(n2).toHaveBeenCalled();
  });
});

describe('requireTerms', () => {
  test('old version -> 403 TERMS_REQUIRED', async () => {
    member({ terms_version: 'old' });
    const r = res();
    await requireTerms({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith({ code: 'COMMUNITY_TERMS_REQUIRED', terms_version: CURRENT_TERMS_VERSION });
  });
  test('null terms_version -> TERMS_REQUIRED', async () => {
    member({ terms_version: null });
    const r = res();
    await requireTerms({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.json.mock.calls[0][0].code).toBe('COMMUNITY_TERMS_REQUIRED');
  });
  test('banned -> 403 BANNED', async () => {
    member({ terms_version: CURRENT_TERMS_VERSION, banned_until: new Date(Date.now() + 3600e3).toISOString() });
    const r = res();
    await requireTerms({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.json).toHaveBeenCalledWith({ code: 'COMMUNITY_BANNED' });
  });
  test('banned + old terms -> BANNED wins', async () => {
    member({ terms_version: 'old', banned_until: new Date(Date.now() + 3600e3).toISOString() });
    const r = res();
    await requireTerms({ user: { id: 'u1' } }, r, jest.fn());
    expect(r.json).toHaveBeenCalledWith({ code: 'COMMUNITY_BANNED' });
  });
  test('accepted + ban expired -> next', async () => {
    member({ terms_version: CURRENT_TERMS_VERSION, banned_until: new Date(Date.now() - 1000).toISOString() });
    const next = jest.fn();
    await requireTerms({ user: { id: 'u1' } }, res(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('isEarlyAccess', () => {
  test('flag/badge logic', async () => {
    member({ badge: 'staff' }); expect(await isEarlyAccess('u')).toBe(true);
    member({ badge: null, early_access: false }); expect(await isEarlyAccess('u')).toBe(false);
    member(null); expect(await isEarlyAccess('u')).toBe(false);
  });
});
