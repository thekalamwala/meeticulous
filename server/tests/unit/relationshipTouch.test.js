'use strict';
// PR-3: relationshipTouch maps a lead's health + account signals to the single most
// relevant relationship touch (who/why/channel/mode). Pure — one rec (or none) per lead.

const { recommendationsFor, milestoneRecommendationsFor } = require('../../services/crm/relationshipTouch');

const NOW = new Date('2026-06-01T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 864e5).toISOString();
const H = (state) => ({ state });

test('at_risk → high-priority winback; valued customer routes to a human founder note', () => {
  const lead = { id: 'L1', status: 'paid', last_meaningful_interaction_at: daysAgo(40) };

  const normal = recommendationsFor(lead, H('at_risk'), {}, NOW);
  expect(normal).toHaveLength(1);
  expect(normal[0]).toMatchObject({
    reason: 'at_risk', touch_type: 'winback', priority: 'high',
    suggested_channel: 'whatsapp', suggested_sender: 'owner', mode: 'recommend',
    dedupe_key: 'lead:L1:at_risk',
  });
  expect(normal[0].explanation).toContain('40d');

  const valued = recommendationsFor(lead, H('at_risk'), { meetsRoi: true }, NOW);
  expect(valued[0]).toMatchObject({ suggested_sender: 'founder', mode: 'human' });
});

test('first paid booking (won) → appreciation, recommend-to-human', () => {
  const recs = recommendationsFor({ id: 'L2', status: 'won' }, H('steady'), {}, NOW);
  expect(recs[0]).toMatchObject({
    reason: 'first_success', touch_type: 'appreciation', priority: 'high',
    suggested_channel: 'whatsapp', mode: 'recommend', dedupe_key: 'lead:L2:first_success',
  });
});

test('cooling → medium check-in by email', () => {
  const recs = recommendationsFor(
    { id: 'L3', status: 'paid', last_meaningful_interaction_at: daysAgo(25) }, H('cooling'), {}, NOW);
  expect(recs[0]).toMatchObject({
    reason: 'cooling', touch_type: 'check_in', priority: 'medium', suggested_channel: 'email', mode: 'recommend',
  });
  expect(recs[0].explanation).toContain('25d');
});

test('dormant wins back only a lead who was once a real customer', () => {
  const wasCustomer = recommendationsFor({ id: 'L4', status: 'paid' }, H('dormant'), { hasBooking: true }, NOW);
  expect(wasCustomer[0]).toMatchObject({ reason: 'dormant', touch_type: 'winback', priority: 'low' });

  const neverActivated = recommendationsFor({ id: 'L5', status: 'contacted' }, H('dormant'), { hasBooking: false }, NOW);
  expect(neverActivated).toEqual([]);
});

test('at_risk outranks a first-success celebration for the same lead', () => {
  // a won lead that has also gone at-risk → the urgent touch wins.
  const recs = recommendationsFor({ id: 'L6', status: 'won' }, H('at_risk'), {}, NOW);
  expect(recs[0].reason).toBe('at_risk');
});

test('healthy (thriving/steady) leads and null leads produce no touch', () => {
  expect(recommendationsFor({ id: 'L7', status: 'paid' }, H('thriving'), {}, NOW)).toEqual([]);
  expect(recommendationsFor({ id: 'L8', status: 'contacted' }, H('steady'), {}, NOW)).toEqual([]);
  expect(recommendationsFor(null, H('at_risk'), {}, NOW)).toEqual([]);
  expect(recommendationsFor({ id: 'L9' }, null, {}, NOW)).toEqual([]);
});

// ── milestone / anniversary touches (PR-6) ──
const daysBefore = (n) => new Date(NOW - n * 864e5).toISOString();

test('a 1-year anniversary → a human founder note, keyed once per year', () => {
  const recs = milestoneRecommendationsFor({ id: 'L1', created_at: daysBefore(400) }, {}, NOW);
  const ann = recs.find((r) => r.reason === 'anniversary');
  expect(ann).toMatchObject({ touch_type: 'founder_note', mode: 'human', suggested_sender: 'founder', dedupe_key: 'lead:L1:anniversary:1y' });
});

test('the one-month mark → a light recommend check-in', () => {
  const recs = milestoneRecommendationsFor({ id: 'L2', created_at: daysBefore(35) }, {}, NOW);
  expect(recs.find((r) => r.reason === 'anniversary')).toMatchObject({ dedupe_key: 'lead:L2:anniversary:30d', mode: 'recommend', priority: 'low' });
});

test('lifetime booking milestone fires the highest threshold reached, once', () => {
  const recs = milestoneRecommendationsFor({ id: 'L3', created_at: daysBefore(5) }, { bookingsTotal: 55 }, NOW);
  expect(recs.find((r) => r.reason === 'milestone')).toMatchObject({ dedupe_key: 'lead:L3:milestone:bookings:50', touch_type: 'appreciation' });
  // brand-new, no bookings, no tenure → nothing
  expect(milestoneRecommendationsFor({ id: 'L4', created_at: daysBefore(2) }, { bookingsTotal: 0 }, NOW)).toEqual([]);
});

test('anniversary and a booking milestone can both surface for one lead', () => {
  const recs = milestoneRecommendationsFor({ id: 'L5', created_at: daysBefore(800) }, { bookingsTotal: 120 }, NOW);
  expect(recs.map((r) => r.reason).sort()).toEqual(['anniversary', 'milestone']);
  expect(recs.find((r) => r.reason === 'anniversary').dedupe_key).toBe('lead:L5:anniversary:2y');
  expect(recs.find((r) => r.reason === 'milestone').dedupe_key).toBe('lead:L5:milestone:bookings:100');
});
