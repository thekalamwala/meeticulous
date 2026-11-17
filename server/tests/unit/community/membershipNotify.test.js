'use strict';
// M8: membership notifications fire the right events to the right recipients, and the
// new-post fan-out only reaches entitled members (rank >= post required).

const sent = [];
jest.mock('../../../services/notificationEngine', () => ({
  send: jest.fn(async (p) => { sent.push(p); return { email: {}, whatsapp: {} }; }),
}));

let mockTier = null;   // audience tier lookup
let mockSubs = [];     // host's current subscriptions
jest.mock('../../../config/supabase', () => {
  const q = {
    select: () => q, eq: () => q, in: () => q, limit: () => q,
    maybeSingle: async () => ({ data: mockTier, error: null }),
    then: (res) => Promise.resolve({ data: mockSubs, error: null }).then(res),
  };
  return { supabaseAdmin: { from: () => q } };
});

const notify = require('../../../services/community/membershipNotify');
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { sent.length = 0; mockTier = null; mockSubs = []; });

test('newMember -> MEMBERSHIP_NEW_MEMBER to the host', async () => {
  notify.newMember({ hostId: 'h1', tierName: 'Premium' });
  await flush();
  expect(sent[0].event).toBe('MEMBERSHIP_NEW_MEMBER');
  expect(sent[0].data.recipientUserId).toBe('h1');
});

test('paymentFailed / renewed target the member', async () => {
  notify.paymentFailed({ memberId: 'm1' });
  notify.renewed({ memberId: 'm1' });
  await flush();
  expect(sent.map((s) => s.event)).toEqual(['MEMBERSHIP_PAYMENT_FAILED', 'MEMBERSHIP_RENEWED']);
  expect(sent.every((s) => s.data.recipientUserId === 'm1')).toBe(true);
});

test('missing recipient -> no send', async () => {
  notify.newMember({});
  notify.paymentFailed({});
  await flush();
  expect(sent).toHaveLength(0);
});

test('newPost notifies only entitled members (rank gate)', async () => {
  mockTier = { id: 'tx', type: 'paid', price_inr: 999 };            // premium post
  mockSubs = [
    { member_id: 'free_sub', tier: { type: 'free', price_inr: null } },     // below -> skip
    { member_id: 'premium_sub', tier: { type: 'paid', price_inr: 999 } },   // entitled -> notify
  ];
  await notify.newPost({ id: 'p1', audience: 'tier', audience_tier_id: 'tx', author_id: 'h1', kind: 'post', slug: 'hi' });
  await flush();
  const recipients = sent.filter((s) => s.event === 'MEMBERSHIP_NEW_POST').map((s) => s.data.recipientUserId);
  expect(recipients).toEqual(['premium_sub']);
});

test('newPost on a public post does nothing', async () => {
  await notify.newPost({ id: 'p2', audience: 'public', author_id: 'h1' });
  await flush();
  expect(sent).toHaveLength(0);
});
