const state = { campaign: { id: 'camp1', status: 'draft', channel: 'email', segment_id: 'seg1', template_id: 'tA' },
  segment: { id: 'seg1', definition: { contact_type: 'vendor' } }, recipients: [], updated: {} };

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: (t) => ({
    select() { return this; }, eq() { return this; },
    single() {
      if (t === 'email_campaigns') return Promise.resolve({ data: state.campaign, error: null });
      if (t === 'segments')        return Promise.resolve({ data: state.segment, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    insert(rows) { state.recipients.push(...[].concat(rows)); return { select: () => Promise.resolve({ data: [].concat(rows), error: null }) }; },
    update(ch) { Object.assign(state.updated, ch); return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { ...state.campaign, ...ch }, error: null }) }) }) }; },
  }) },
  supabase: {},
}));
jest.mock('../../services/segmentService', () => ({
  resolve: async () => ([
    { id: 'c1', email: 'a@x', name: 'A', user_id: 'u1', attributes: {} },
    { id: 'c2', email: 'b@x', name: 'B', user_id: null, attributes: {} },
  ]),
}));
const campaignService = require('../../services/campaignService');

beforeEach(() => { state.recipients = []; state.updated = {}; state.campaign = { id: 'camp1', status: 'draft', channel: 'email', segment_id: 'seg1', template_id: 'tA' }; });

test('launch snapshots resolved recipients and sets status sending', async () => {
  const r = await campaignService.launch('camp1');
  expect(state.recipients).toHaveLength(2);
  expect(state.recipients[0]).toMatchObject({ campaign_id: 'camp1', channel: 'email', status: 'queued' });
  expect(state.updated.status).toBe('sending');
  expect(r.recipients).toBe(2);
});

test('email campaign with neither template nor composed HTML is rejected', async () => {
  state.campaign = { id: 'camp1', status: 'draft', channel: 'email', segment_id: 'seg1', template_id: null, html_content: null };
  const r = await campaignService.launch('camp1');
  expect(r.error).toBe('no_content');
});

test('email campaign with composed HTML (no template) can launch', async () => {
  state.campaign = { id: 'camp2', status: 'draft', channel: 'email', segment_id: 'seg1', template_id: null, html_content: '<table></table>' };
  const r = await campaignService.launch('camp2');
  expect(r.error).toBeUndefined();
});

test('whatsapp campaign without wa template is rejected', async () => {
  state.campaign = { id: 'camp1', status: 'draft', channel: 'whatsapp', segment_id: 'seg1', whatsapp_template_id: null };
  const r = await campaignService.launch('camp1');
  expect(r.error).toBe('no_whatsapp_template');
});

test('whatsapp launch snapshots recipients on the whatsapp channel', async () => {
  state.campaign = { id: 'camp1', status: 'draft', channel: 'whatsapp', segment_id: 'seg1', whatsapp_template_id: 'wt1' };
  await campaignService.launch('camp1');
  expect(state.recipients).toHaveLength(2);
  expect(state.recipients[0].channel).toBe('whatsapp');
});
