jest.mock('../../services/contactsService', () => ({ sync: async () => ({ upserted: 7 }), syncLeads: async () => ({ upserted: 3, linked: 2 }) }));
jest.mock('../../services/segmentService', () => ({ count: async () => 4 }));
jest.mock('../../services/campaignService', () => ({
  create: async (b) => ({ campaign: { id: 'camp1', ...b } }),
  launch: async () => ({ recipients: 3 }),
  stats: async () => ({ total: 3, queued: 0, sent: 3, failed: 0, skipped: 0 }),
}));
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({
    select() { return this; }, order() { return this; }, eq() { return this; },
    insert(row) { return { select: () => ({ single: () => Promise.resolve({ data: { id: 'wt1', ...[].concat(row)[0] }, error: null }) }) }; },
    update(row) { return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'wt1', ...row }, error: null }) }) }) }; },
    then: (res) => res({ data: [{ id: 'wt1', name: 'Promo WA' }], error: null }),
  }) }, supabase: {},
}));
const ctrl = require('../../controllers/campaignAdminController');
const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

test('syncContacts returns upserted count', async () => {
  const res = mkRes(); await ctrl.syncContacts({}, res);
  expect(res.body.upserted).toBe(10); // 7 base + 3 leads
});
test('previewSegment returns a count', async () => {
  const res = mkRes(); await ctrl.previewSegment({ body: { definition: {} } }, res);
  expect(res.body.count).toBe(4);
});
test('createCampaign returns created campaign', async () => {
  const res = mkRes(); await ctrl.createCampaign({ body: { name: 'Promo' } }, res);
  expect(res.body.campaign.id).toBe('camp1');
});
test('createCampaign 400s without a name', async () => {
  const res = mkRes(); await ctrl.createCampaign({ body: {} }, res);
  expect(res.code).toBe(400);
});
test('launchCampaign returns recipient count', async () => {
  const res = mkRes(); await ctrl.launchCampaign({ params: { id: 'camp1' } }, res);
  expect(res.body.recipients).toBe(3);
});
test('listWaTemplates returns the registry', async () => {
  const res = mkRes(); await ctrl.listWaTemplates({}, res);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body[0].id).toBe('wt1');
});
test('createWaTemplate requires name + aisensy_campaign_name', async () => {
  const res = mkRes(); await ctrl.createWaTemplate({ body: { name: 'X' } }, res);
  expect(res.code).toBe(400);
});
test('createWaTemplate creates a template', async () => {
  const res = mkRes(); await ctrl.createWaTemplate({ body: { name: 'Promo WA', aisensy_campaign_name: 'promo_june', param_count: 2 } }, res);
  expect(res.code).toBe(201);
  expect(res.body.aisensy_campaign_name).toBe('promo_june');
});
