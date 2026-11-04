'use strict';
// Gifted Pro growth hooks: pay-it-forward codes + redeem, share-to-extend.
// Same PostgREST fake as planGiftService.test.js.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({}) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ resolveInApp: jest.fn() }));
jest.mock('../../services/crm/leadService', () => ({ recordAccountEvent: jest.fn() }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn(() => Promise.resolve({ sent: true })) }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { audit } = require('../../services/auditService');
const { adminAlert } = require('../../utils/adminAlert');
const gifts = require('../../services/planGiftService');

const DAY = 86400000;
const req = { admin: { id: 'adm1', email: 'founder@x.com', role: 'super' } };

let calls = [];
function wire(respond) {
  supabaseAdmin.from.mockImplementation((table) => {
    const q = { table, op: 'select', payload: null, filters: {} };
    const c = {};
    const filt = (k) => (col, val) => { q.filters[`${k}:${col}`] = val; return c; };
    c.select = () => c;
    c.insert = (p) => { q.op = 'insert'; q.payload = p; return c; };
    c.update = (p) => { q.op = 'update'; q.payload = p; return c; };
    c.delete = () => { q.op = 'delete'; return c; };
    c.eq = filt('eq'); c.is = filt('is'); c.in = filt('in'); c.lte = filt('lte');
    c.order = () => c; c.limit = () => c; c.range = () => c;
    const done = () => { calls.push(q); return Promise.resolve(respond(q)); };
    c.maybeSingle = done; c.single = done;
    c.then = (r, j) => done().then(r, j);
    return c;
  });
}
const writes = (table, op) => calls.filter((q) => q.table === table && q.op === op);

const host = (over = {}) => ({ id: 'h1', name: 'Asha Rao', email: 'asha@x.com', role: 'host', plan: 'free', plan_expires_at: null, subscription_status: null, razorpay_subscription_id: null, ...over });
const activeGift = (over = {}) => ({ id: 'g1', host_id: 'h1', months: 1, extended_months: 0, status: 'active', ends_at: new Date(Date.now() + 10 * DAY).toISOString(), note: null, ending_notified_days: [], share_status: null, ...over });

beforeEach(() => { jest.clearAllMocks(); calls = []; });

describe('forward codes', () => {
  test('10 chars from the unambiguous alphabet, unique per mint', () => {
    const a = gifts.mintForwardCode();
    expect(a).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
    expect(a).not.toBe(gifts.mintForwardCode());
  });

  test('a team gift mints a code; a forwarded gift does not', async () => {
    wire((q) => {
      if (q.table === 'profiles' && q.op === 'select') return { data: host({ id: q.filters['eq:id'] }), error: null };
      if (q.table === 'profiles' && q.op === 'update') return { data: [{ id: 'x' }], error: null };
      if (q.table === 'plan_gifts' && q.op === 'insert') return { data: { id: 'g', extended_months: 0, ...q.payload }, error: null };
      return { data: null, error: null };
    });
    await gifts.grantGift(req, { hostIds: ['h1'], months: 1, reason: 'x' });
    await gifts.grantGift(req, { hostIds: ['h2'], months: 1, reason: 'y', forwardedFrom: 'g0' });
    const [team, fwd] = writes('plan_gifts', 'insert').map((q) => q.payload);
    expect(team.forward_code).toMatch(/^[A-Z2-9]{10}$/);
    expect(team.forwarded_from).toBeNull();
    expect(fwd).toMatchObject({ forward_code: null, forwarded_from: 'g0' });
  });

  test('giftForSession exposes share status and the forward link', async () => {
    wire(() => ({ data: activeGift({ share_status: 'pending', forward_code: 'ABCDEFGH23', forward_redeemed_by: null }), error: null }));
    expect(await gifts.giftForSession(host({ plan: 'premium' })))
      .toMatchObject({ share_status: 'pending', forward: { code: 'ABCDEFGH23', redeemed: false } });
  });
});

describe('share-to-extend', () => {
  test('isShareUrl: https posts on the listed networks only', () => {
    expect(gifts.isShareUrl('https://www.linkedin.com/posts/asha_123')).toBe(true);
    expect(gifts.isShareUrl('https://x.com/asha/status/1')).toBe(true);
    expect(gifts.isShareUrl('http://www.linkedin.com/posts/asha')).toBe(false);
    expect(gifts.isShareUrl('https://linkedin.com.evil.io/x')).toBe(false);
    expect(gifts.isShareUrl('javascript:alert(1)')).toBe(false);
    expect(gifts.isShareUrl('')).toBe(false);
  });

  test('submit queues the post once and alerts the team', async () => {
    const g = activeGift();
    wire((q) => {
      if (q.table === 'plan_gifts' && q.op === 'select') return { data: g, error: null };
      if (q.table === 'plan_gifts' && q.op === 'update') return { data: { ...g, ...q.payload }, error: null };
      return { data: null, error: null };
    });
    const out = await gifts.submitShare('h1', ' https://www.linkedin.com/posts/asha_1 ');
    expect(out.share_status).toBe('pending');
    const [up] = writes('plan_gifts', 'update');
    expect(up.payload.share_url).toBe('https://www.linkedin.com/posts/asha_1');
    expect(up.filters).toMatchObject({ 'eq:status': 'active', 'is:share_status': null });
    expect(adminAlert).toHaveBeenCalled();
  });

  test('submit refuses a bad URL, no gift, or a second post', async () => {
    await expect(gifts.submitShare('h1', 'https://example.com/x')).rejects.toMatchObject({ code: 'BAD_URL' });
    wire(() => ({ data: null, error: null }));
    await expect(gifts.submitShare('h1', 'https://x.com/a/status/1')).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
    wire(() => ({ data: activeGift({ share_status: 'rejected' }), error: null }));
    await expect(gifts.submitShare('h1', 'https://x.com/a/status/1')).rejects.toMatchObject({ code: 'ALREADY_SHARED' });
  });

  // `claimWins` = whether the conditional pending→verdict update finds the row.
  const reviewWorld = (gift, { claimWins = true, profileUpdate = [{ id: 'h1' }] } = {}) => wire((q) => {
    if (q.table === 'plan_gifts' && q.op === 'select') return { data: gift, error: null };
    if (q.table === 'plan_gifts' && q.op === 'update' && q.filters['eq:share_status'] === 'pending' && !claimWins) return { data: null, error: null };
    if (q.table === 'plan_gifts' && q.op === 'update') return { data: { ...gift, ...q.payload }, error: null };
    if (q.table === 'profiles' && q.op === 'select') return { data: host({ plan: 'premium', plan_expires_at: gift.ends_at }), error: null };
    if (q.table === 'profiles' && q.op === 'update') return { data: profileUpdate, error: null };
    return { data: null, error: null };
  });

  test('approve: claims pending→approved first, then +1 month, audit-logged', async () => {
    reviewWorld(activeGift({ share_status: 'pending', share_url: 'https://x.com/a/status/1' }));
    const out = await gifts.reviewShare(req, 'g1', true);
    const ups = writes('plan_gifts', 'update');
    expect(ups[0].payload.share_status).toBe('approved');
    expect(ups[0].filters['eq:share_status']).toBe('pending');
    expect(ups[1].payload.extended_months).toBe(1);
    expect(out.extended_months).toBe(1);
    expect(NotificationEngine.send.mock.calls[0][0].event).toBe('PLAN_GIFT_RECEIVED');
    expect(audit).toHaveBeenCalledWith(req, expect.objectContaining({ action: 'plan.gift.share_approve' }));
  });

  test('reject: no extension, no email; nothing pending → NOT_PENDING', async () => {
    reviewWorld(activeGift({ share_status: 'pending' }));
    await gifts.reviewShare(req, 'g1', false);
    expect(writes('plan_gifts', 'update').map((q) => q.payload)).toEqual([expect.objectContaining({ share_status: 'rejected' })]);
    expect(NotificationEngine.send).not.toHaveBeenCalled();

    reviewWorld(activeGift({ share_status: null }));
    await expect(gifts.reviewShare(req, 'g1', true)).rejects.toMatchObject({ code: 'NOT_PENDING' });
  });

  test('double approve: the second click loses the claim → no second month', async () => {
    reviewWorld(activeGift({ share_status: 'pending' }), { claimWins: false });
    await expect(gifts.reviewShare(req, 'g1', true)).rejects.toMatchObject({ code: 'NOT_PENDING' });
    expect(writes('plan_gifts', 'update').some((q) => 'extended_months' in q.payload)).toBe(false);
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('approve but the extend fails → share back to pending', async () => {
    reviewWorld(activeGift({ share_status: 'pending' }), { profileUpdate: [] });
    await expect(gifts.reviewShare(req, 'g1', true)).rejects.toMatchObject({ code: 'INELIGIBLE' });
    const back = writes('plan_gifts', 'update').find((q) => q.payload.share_status === 'pending');
    expect(back.filters).toMatchObject({ 'eq:id': 'g1', 'eq:share_status': 'approved' });
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('redeemForward (pay-it-forward)', () => {
  const SOURCE = { id: 'g0', host_id: 'giver', created_at: '2026-11-01T00:00:00Z', forward_redeemed_by: null };
  const friend = (over = {}) => host({ id: 'friend', onboarding_completed: true, created_at: '2026-11-03T00:00:00Z', ...over });
  const world = ({ source = SOURCE, profile = friend(), claim = { id: 'g0' }, grantLands = true } = {}) => wire((q) => {
    if (q.table === 'plan_gifts' && q.op === 'select' && 'eq:forward_code' in q.filters) return { data: source, error: null };
    if (q.table === 'plan_gifts' && q.op === 'select') return { data: null, error: null }; // friend has no gift
    if (q.table === 'plan_gifts' && q.op === 'update') return { data: q.filters['is:forward_redeemed_by'] === null ? claim : null, error: null };
    if (q.table === 'plan_gifts' && q.op === 'insert') return { data: { id: 'gF', extended_months: 0, ...q.payload }, error: null };
    if (q.table === 'profiles' && q.op === 'select') return { data: q.filters['eq:id'] === 'giver' ? host({ id: 'giver', name: 'Ravi Kumar' }) : profile, error: null };
    if (q.table === 'profiles' && q.op === 'update') return { data: grantLands ? [{ id: 'friend' }] : [], error: null };
    return { data: null, error: null };
  });

  test('new onboarded host: claims the code, gets 1 month, no code of their own', async () => {
    world();
    const out = await gifts.redeemForward('friend', ' abcd-efgh23 ');
    expect(out.redeemed).toBe(true);
    expect(writes('plan_gifts', 'select')[0].filters['eq:forward_code']).toBe('ABCDEFGH23');
    const [ins] = writes('plan_gifts', 'insert');
    expect(ins.payload).toMatchObject({ host_id: 'friend', months: 1, campaign: 'pay-it-forward', forwarded_from: 'g0', forward_code: null, granted_by: null });
    expect(NotificationEngine.send.mock.calls[0][0].data.emailData.gift_headline).toBe('Ravi sent you a month of Pro');
  });

  test('onboarding not finished → keep the code for later', async () => {
    world({ profile: friend({ onboarding_completed: false }) });
    expect(await gifts.redeemForward('friend', 'ABCDEFGH23')).toEqual({ redeemed: false, reason: 'finish onboarding first', keep: true });
    expect(writes('plan_gifts', 'insert')).toHaveLength(0);
  });

  test.each([
    ['unknown code', { source: null }, 'invalid code'],
    ['used code', { source: { ...SOURCE, forward_redeemed_by: 'someone' } }, 'already used'],
    ['code from a revoked gift', { source: { ...SOURCE, status: 'revoked' } }, 'gift revoked'],
    ['churned host (past mandate)', { profile: friend({ subscription_status: 'cancelled', razorpay_subscription_id: 'sub_1' }) }, 'has a past mandate'],
    ['own code', { source: { ...SOURCE, host_id: 'friend' } }, 'own code'],
    ['account older than the link', { profile: friend({ created_at: '2026-10-01T00:00:00Z' }) }, 'not a new host'],
    ['paying host', { profile: friend({ plan: 'premium', subscription_status: 'active', razorpay_subscription_id: 'sub_1' }) }, 'paying customer'],
    ['lost the claim race', { claim: null }, 'already used'],
  ])('%s → no grant', async (_name, opts, reason) => {
    world(opts);
    expect(await gifts.redeemForward('friend', 'ABCDEFGH23')).toMatchObject({ redeemed: false, reason });
    expect(writes('plan_gifts', 'insert')).toHaveLength(0);
  });

  test('grant does not land after the claim → code released', async () => {
    world({ grantLands: false });
    expect((await gifts.redeemForward('friend', 'ABCDEFGH23')).redeemed).toBe(false);
    const release = writes('plan_gifts', 'update').find((q) => q.payload.forward_redeemed_by === null);
    expect(release.filters).toMatchObject({ 'eq:id': 'g0', 'eq:forward_redeemed_by': 'friend' });
  });
});
