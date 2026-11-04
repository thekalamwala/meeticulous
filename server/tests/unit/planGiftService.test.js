'use strict';
// Gifted Pro (v3.190): grant / extend / revoke / convert-on-paid / expiry cron.
// Founder rules under test: never gift a payer, revoke tells the host, paying ends the gift.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn().mockResolvedValue({}) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../utils/inAppNotify', () => ({ resolveInApp: jest.fn() }));
jest.mock('../../services/crm/leadService', () => ({ recordAccountEvent: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const NotificationEngine = require('../../services/notificationEngine');
const { audit } = require('../../services/auditService');
const gifts = require('../../services/planGiftService');

const DAY = 86400000;
const admin = { id: 'adm1', email: 'founder@x.com', role: 'super' };
const req = { admin };

// Tiny PostgREST fake: every query is recorded as { table, op, payload, filters },
// and `respond(q)` decides what it resolves to.
let calls = [];
let respond = () => ({ data: null, error: null });
function wire(fn) {
  respond = fn;
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

const freeHost = (over = {}) => ({ id: 'h1', name: 'Asha Rao', email: 'asha@x.com', role: 'host', plan: 'free', plan_expires_at: null, subscription_status: null, razorpay_subscription_id: null, ...over });
const activeGift = (over = {}) => ({ id: 'g1', host_id: 'h1', months: 1, extended_months: 0, status: 'active', ends_at: '2026-12-04T10:00:00.000Z', note: 'Thanks for the feedback!', ending_notified_days: [], ...over });

beforeEach(() => { jest.clearAllMocks(); calls = []; });

describe('addMonths / tenureLabel', () => {
  test('every tenure lands on the same calendar day', () => {
    const from = new Date('2026-11-04T10:00:00Z');
    expect(gifts.TENURES.map((m) => gifts.addMonths(from, m).toISOString().slice(0, 10)))
      .toEqual(['2026-12-04', '2027-01-04', '2027-05-04', '2027-11-04', '2028-11-04', '2031-11-04']);
  });
  test('month-end clamps (31 Jan + 1 → end of Feb, leap aware)', () => {
    expect(gifts.addMonths(new Date('2027-01-31T10:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(gifts.addMonths(new Date('2028-01-31T10:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
  });
  test('labels', () => {
    expect([1, 2, 12, 24, 60].map(gifts.tenureLabel)).toEqual(['1 month', '2 months', '1 year', '2 years', '5 years']);
  });
});

describe('ineligibleReason — never gift a payer', () => {
  const r = gifts.ineligibleReason;
  test('free host with no gift is eligible', () => expect(r(freeHost(), null)).toBeNull());
  test.each(['active', 'authenticated', 'pending', 'halted'])('mandate %s → paying customer', (status) => {
    expect(r(freeHost({ plan: 'premium', subscription_status: status, razorpay_subscription_id: 'sub_1' }), null)).toBe('paying customer');
    expect(r(freeHost({ plan: 'premium', subscription_status: status, razorpay_subscription_id: 'sub_1' }), activeGift(), { extend: true })).toBe('paying customer');
  });
  test('cancelled mandate (in or past its period) → has a past mandate, matching the grant guard', () => {
    const inPeriod = freeHost({ plan: 'premium', subscription_status: 'cancelled', razorpay_subscription_id: 'sub_1', plan_expires_at: new Date(Date.now() + 10 * DAY).toISOString() });
    const churned = freeHost({ plan: 'free', subscription_status: 'cancelled', razorpay_subscription_id: 'sub_1' });
    expect(r(inPeriod, null)).toBe('has a past mandate');
    expect(r(churned, null)).toBe('has a past mandate');
    expect(r(churned, activeGift(), { extend: true })).toBe('has a past mandate');
  });
  test('supreme / legacy paid / manual comp → blocked; expired paid → eligible', () => {
    expect(r(freeHost({ plan: 'supreme' }), null)).toBe('on a paid or comped plan');
    expect(r(freeHost({ plan: 'creator', plan_expires_at: new Date(Date.now() + DAY).toISOString() }), null)).toBe('on a paid or comped plan');
    expect(r(freeHost({ plan: 'premium', plan_expires_at: new Date(Date.now() - DAY).toISOString() }), null)).toBeNull();
  });
  test('second gift → extend instead; extend needs a gift; guests refused', () => {
    expect(r(freeHost({ plan: 'premium' }), activeGift())).toBe('already gifted (extend instead)');
    expect(r(freeHost(), null, { extend: true })).toBe('no active gift');
    expect(r(freeHost({ role: 'guest', is_host: false }), null)).toBe('not a host');
    expect(r(null, null)).toBe('host not found');
  });
});

describe('grantGift', () => {
  const grantWorld = (profiles, { profileUpdate = (q) => [{ id: q.filters['eq:id'] }] } = {}) => wire((q) => {
    if (q.table === 'profiles' && q.op === 'select') return { data: profiles[q.filters['eq:id']] || null, error: null };
    if (q.table === 'profiles' && q.op === 'update') return { data: profileUpdate(q), error: null };
    if (q.table === 'plan_gifts' && q.op === 'select') return { data: null, error: null }; // no active gift
    if (q.table === 'plan_gifts' && q.op === 'insert') return { data: { id: `g-${q.payload.host_id}`, extended_months: 0, ...q.payload }, error: null };
    return { data: null, error: null };
  });

  test('free host: gift row + premium until end + audit + gift email', async () => {
    grantWorld({ h1: freeHost() });
    const out = await gifts.grantGift(req, { hostIds: ['h1'], months: 12, reason: 'Beta tester', note: 'Thank you!', campaign: 'beta' });

    expect(out.skipped).toEqual([]);
    expect(out.granted).toHaveLength(1);
    const [ins] = writes('plan_gifts', 'insert');
    expect(ins.payload).toMatchObject({ host_id: 'h1', months: 12, reason: 'Beta tester', note: 'Thank you!', campaign: 'beta', granted_by: 'adm1' });
    const [up] = writes('profiles', 'update');
    expect(up.payload).toMatchObject({ plan: 'premium', plan_expires_at: ins.payload.ends_at });
    expect(up.filters['is:razorpay_subscription_id']).toBeNull();
    expect(audit).toHaveBeenCalledWith(req, expect.objectContaining({ action: 'plan.gift.grant', resource_id: 'h1' }));
    const sent = NotificationEngine.send.mock.calls[0][0];
    expect(sent.event).toBe('PLAN_GIFT_RECEIVED');
    expect(sent.data.emailData).toMatchObject({ first_name: 'Asha', tenure: '1 year', gift_note: 'Thank you!', gift_headline: "I'm gifting you Pro" });
    expect(sent.data.inApp.title).toMatch(/Pro/);
  });

  test('bulk: payers and comps are skipped with a reason, the rest granted', async () => {
    grantWorld({
      h1: freeHost(),
      h2: freeHost({ id: 'h2', plan: 'premium', subscription_status: 'active', razorpay_subscription_id: 'sub_2' }),
      h3: freeHost({ id: 'h3', plan: 'supreme' }),
    });
    const out = await gifts.grantGift(req, { hostIds: ['h1', 'h2', 'h3', 'h1', 'missing'], months: 1, reason: 'Nov cohort' });
    expect(out.granted.map((g) => g.host_id)).toEqual(['h1']);
    expect(out.skipped).toEqual([
      { host_id: 'h2', reason: 'paying customer' },
      { host_id: 'h3', reason: 'on a paid or comped plan' },
      { host_id: 'missing', reason: 'host not found' },
    ]);
    expect(writes('plan_gifts', 'insert')).toHaveLength(1);
  });

  test('host started paying between check and write → gift deleted, profile untouched', async () => {
    grantWorld({ h1: freeHost() }, { profileUpdate: () => [] });
    const out = await gifts.grantGift(req, { hostIds: ['h1'], months: 1, reason: 'x' });
    expect(out.granted).toEqual([]);
    expect(out.skipped).toEqual([{ host_id: 'h1', reason: 'paying customer' }]);
    expect(writes('plan_gifts', 'delete')).toHaveLength(1);
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('missing table → GIFTS_UNAVAILABLE', async () => {
    wire((q) => {
      if (q.table === 'profiles') return { data: freeHost(), error: null };
      if (q.op === 'insert') return { data: null, error: { message: 'relation "plan_gifts" does not exist' } };
      return { data: null, error: null };
    });
    await expect(gifts.grantGift(req, { hostIds: ['h1'], months: 1, reason: 'x' })).rejects.toMatchObject({ code: 'GIFTS_UNAVAILABLE' });
  });
});

describe('extendGift / revokeGift', () => {
  const world = (gift, profile, { profileUpdate = [{ id: 'h1' }] } = {}) => wire((q) => {
    if (q.table === 'plan_gifts' && q.op === 'select') return { data: gift, error: null };
    if (q.table === 'plan_gifts' && q.op === 'update') return { data: { ...gift, ...q.payload }, error: null };
    if (q.table === 'profiles' && q.op === 'select') return { data: profile, error: null };
    if (q.table === 'profiles' && q.op === 'update') return { data: profileUpdate, error: null };
    return { data: null, error: null };
  });

  test('extend during a checkout that lands mid-write → gift row reverted, no email, INELIGIBLE', async () => {
    const gift = activeGift({ ends_at: new Date(Date.now() + 5 * DAY).toISOString(), extended_months: 1, ending_notified_days: [7] });
    world(gift, freeHost({ plan: 'premium', plan_expires_at: gift.ends_at }), { profileUpdate: [] });
    await expect(gifts.extendGift(req, 'g1', 2)).rejects.toMatchObject({ code: 'INELIGIBLE', message: expect.stringMatching(/checkout in progress/) });

    const [ext, revert] = writes('plan_gifts', 'update');
    expect(revert.payload).toMatchObject({ ends_at: gift.ends_at, extended_months: 1, ending_notified_days: [7] });
    expect(revert.filters).toMatchObject({ 'eq:id': 'g1', 'eq:ends_at': ext.payload.ends_at });
    expect(NotificationEngine.send).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  test('extend adds months from the current end and re-arms the ending notices', async () => {
    const gift = activeGift({ ends_at: new Date(Date.now() + 5 * DAY).toISOString(), ending_notified_days: [7] });
    world(gift, freeHost({ plan: 'premium', plan_expires_at: gift.ends_at }));
    const next = await gifts.extendGift(req, 'g1', 2);

    expect(next.ends_at).toBe(gifts.addMonths(new Date(gift.ends_at), 2).toISOString());
    expect(next.extended_months).toBe(2);
    expect(next.ending_notified_days).toEqual([]);
    expect(writes('profiles', 'update')[0].payload.plan_expires_at).toBe(next.ends_at);
    expect(audit).toHaveBeenCalledWith(req, expect.objectContaining({ action: 'plan.gift.extend' }));
    const sent = NotificationEngine.send.mock.calls[0][0];
    expect(sent.event).toBe('PLAN_GIFT_RECEIVED');
    expect(sent.data.emailData).toMatchObject({ gift_headline: "I've extended your gifted Pro", tenure: '3 months' });
  });

  test('extend refuses a closed gift', async () => {
    world(activeGift({ status: 'revoked' }), freeHost());
    await expect(gifts.extendGift(req, 'g1', 1)).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });

  test('revoke: closes, drops to Starter (guarded) and tells the host it expired', async () => {
    const gift = activeGift();
    world(gift, freeHost({ plan: 'premium', plan_expires_at: gift.ends_at }));
    const closed = await gifts.revokeGift(req, 'g1', 'Duplicate account');

    expect(closed).toMatchObject({ status: 'revoked', closed_by: 'adm1', close_reason: 'Duplicate account' });
    const [down] = writes('profiles', 'update');
    expect(down.payload).toMatchObject({ plan: 'free', plan_expires_at: null });
    expect(down.filters).toMatchObject({ 'eq:plan': 'premium', 'is:razorpay_subscription_id': null, 'eq:plan_expires_at': gift.ends_at });
    expect(NotificationEngine.send.mock.calls[0][0].event).toBe('PLAN_GIFT_ENDED');
    expect(audit).toHaveBeenCalledWith(req, expect.objectContaining({ action: 'plan.gift.revoke' }));
  });
});

describe('endOnPaid', () => {
  test('closes the active gift as converted and returns it', async () => {
    wire((q) => (q.table === 'plan_gifts' && q.op === 'update' ? { data: activeGift({ ...q.payload }), error: null } : { data: null, error: null }));
    const g = await gifts.endOnPaid('h1');
    expect(g.status).toBe('converted');
    expect(writes('plan_gifts', 'update')[0].filters).toMatchObject({ 'eq:host_id': 'h1', 'eq:status': 'active' });
  });
  test('no gift / missing table / thrown error → null, never throws', async () => {
    wire(() => ({ data: null, error: null }));
    expect(await gifts.endOnPaid('h1')).toBeNull();
    wire(() => ({ data: null, error: { message: 'relation "plan_gifts" does not exist' } }));
    expect(await gifts.endOnPaid('h1')).toBeNull();
    supabaseAdmin.from.mockImplementation(() => { throw new Error('boom'); });
    expect(await gifts.endOnPaid('h1')).toBeNull();
  });
});

describe('processGiftExpiry', () => {
  const world = (rows, profile) => wire((q) => {
    if (q.table === 'plan_gifts' && q.op === 'select') return { data: rows, error: null };
    if (q.table === 'plan_gifts' && q.op === 'update') return { data: { id: q.filters['eq:id'], ...q.payload }, error: null };
    if (q.table === 'profiles' && q.op === 'select') return { data: profile, error: null };
    return { data: null, error: null };
  });
  const inDays = (d) => new Date(Date.now() + d * DAY - 60000).toISOString(); // ceil → d

  test('T-7: one "ends soon" notice, then marked so it never repeats', async () => {
    const g = activeGift({ ends_at: inDays(7) });
    world([g], freeHost({ plan: 'premium', plan_expires_at: g.ends_at }));
    expect(await gifts.processGiftExpiry()).toMatchObject({ ending: 1 });
    const sent = NotificationEngine.send.mock.calls[0][0];
    expect(sent.event).toBe('PLAN_GIFT_ENDING');
    expect(sent.data.emailData).toMatchObject({ days_left: 7, ends_in: 'in 7 days' });
    expect(writes('plan_gifts', 'update')[0].payload.ending_notified_days).toEqual([7]);

    jest.clearAllMocks(); calls = [];
    world([{ ...g, ending_notified_days: [7] }], freeHost({ plan: 'premium', plan_expires_at: g.ends_at }));
    expect(await gifts.processGiftExpiry()).toMatchObject({ ending: 0 });
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('T-1 says "tomorrow"; T-3 sends nothing', async () => {
    const g = activeGift({ ends_at: inDays(1) });
    world([g], freeHost({ plan: 'premium', plan_expires_at: g.ends_at }));
    await gifts.processGiftExpiry();
    expect(NotificationEngine.send.mock.calls[0][0].data.emailData.ends_in).toBe('tomorrow');

    jest.clearAllMocks(); calls = [];
    const g3 = activeGift({ ends_at: inDays(3) });
    world([g3], freeHost({ plan: 'premium', plan_expires_at: g3.ends_at }));
    await gifts.processGiftExpiry();
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('ended: close, back to Starter, "gift has expired" notice', async () => {
    const g = activeGift({ ends_at: new Date(Date.now() - 3600000).toISOString() });
    world([g], freeHost({ plan: 'premium', plan_expires_at: g.ends_at }));
    expect(await gifts.processGiftExpiry()).toMatchObject({ ended: 1 });
    expect(writes('plan_gifts', 'update')[0].payload.status).toBe('ended');
    expect(writes('profiles', 'update')[0].payload).toMatchObject({ plan: 'free', plan_expires_at: null });
    expect(NotificationEngine.send.mock.calls[0][0].event).toBe('PLAN_GIFT_ENDED');
  });

  test('ended but the host is now paying → closed as converted, no "expired" mail, no downgrade', async () => {
    const g = activeGift({ ends_at: new Date(Date.now() - 3600000).toISOString() });
    world([g], freeHost({ plan: 'premium', subscription_status: 'active', razorpay_subscription_id: 'sub_9', plan_expires_at: new Date(Date.now() + 30 * DAY).toISOString() }));
    expect(await gifts.processGiftExpiry()).toMatchObject({ ended: 0, converted: 1 });
    expect(writes('plan_gifts', 'update')[0].payload.status).toBe('converted');
    expect(writes('profiles', 'update')).toHaveLength(0);
    expect(NotificationEngine.send).not.toHaveBeenCalled();
  });

  test('missing table → no-op', async () => {
    wire(() => ({ data: null, error: { message: 'relation "plan_gifts" does not exist' } }));
    expect(await gifts.processGiftExpiry()).toEqual({ ending: 0, ended: 0, converted: 0 });
  });
});

describe('session + renewal helpers', () => {
  test('giftForSession reads only for an un-mandated premium host', async () => {
    wire(() => ({ data: activeGift({ ends_at: new Date(Date.now() + DAY).toISOString(), extended_months: 2 }), error: null }));
    expect(await gifts.giftForSession(freeHost())).toBeNull();
    expect(await gifts.giftForSession(freeHost({ plan: 'premium', razorpay_subscription_id: 'sub_1' }))).toBeNull();
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(await gifts.giftForSession(freeHost({ plan: 'premium' }))).toMatchObject({ months: 3, note: 'Thanks for the feedback!' });
  });
  test('giftForSession ignores a lapsed gift and DB errors', async () => {
    wire(() => ({ data: activeGift({ ends_at: new Date(Date.now() - DAY).toISOString() }), error: null }));
    expect(await gifts.giftForSession(freeHost({ plan: 'premium' }))).toBeNull();
    wire(() => ({ data: null, error: { message: 'connection reset' } }));
    expect(await gifts.giftForSession(freeHost({ plan: 'premium' }))).toBeNull();
  });
  test('giftedHostIds is fail-soft', async () => {
    wire(() => ({ data: [{ host_id: 'h1' }], error: null }));
    expect([...(await gifts.giftedHostIds(['h1', 'h2']))]).toEqual(['h1']);
    wire(() => ({ data: null, error: { message: 'nope' } }));
    expect((await gifts.giftedHostIds(['h1'])).size).toBe(0);
  });
});
