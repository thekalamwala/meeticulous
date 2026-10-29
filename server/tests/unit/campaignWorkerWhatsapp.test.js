const state = {
  campaigns: [{ id: 'camp1', status: 'sending', channel: 'whatsapp', whatsapp_template_id: 'wt1', throttle_per_min: 100 }],
  recipients: [{ id: 'r1', campaign_id: 'camp1', contact_id: 'c1', destination: '919991112222', status: 'queued' }],
  contacts: { c1: { id: 'c1', phone: '919991112222', name: 'Asha Verma', whatsapp_opt_in: true, whatsapp_suppressed: false, attributes: { service_name: 'SEO' } } },
  waTemplates: { wt1: { id: 'wt1', aisensy_campaign_name: 'promo_june', param_count: 2, variable_map: { 1: 'first_name', 2: 'service_name' } } },
  providers: { aisensy: { provider: 'aisensy', api_key: 'k-1', is_active: true } },
};
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: (t) => {
    const q = { _f: {} };
    q.select = (_c, opts) => { q._opts = opts; return q; };
    q.eq = (c, v) => { q._f[c] = v; return q; }; q.limit = () => q;
    q.not = () => q; q.gte = () => q;
    q.single = () => {
      if (t === 'contacts') return Promise.resolve({ data: state.contacts[q._f.id], error: null });
      if (t === 'whatsapp_templates') return Promise.resolve({ data: state.waTemplates[q._f.id], error: null });
      if (t === 'notification_providers') return Promise.resolve({ data: state.providers[q._f.provider], error: null });
      return Promise.resolve({ data: null, error: null });
    };
    q.then = (res) => {
      if (q._opts && q._opts.head) return res({ count: 0, error: null }); // daily-cap count query
      if (t === 'email_campaigns') return res({ data: state.campaigns.filter((c) => c.status === 'sending'), error: null });
      if (t === 'campaign_recipients') return res({ data: state.recipients.filter((r) => r.campaign_id === q._f.campaign_id && r.status === (q._f.status || r.status)), error: null });
      return res({ data: [], error: null });
    };
    q.update = (ch) => ({ eq: (c, v) => {
      if (t === 'campaign_recipients') { const r = state.recipients.find((x) => x.id === v); if (r) Object.assign(r, ch); }
      if (t === 'email_campaigns') { const c = state.campaigns.find((x) => x.id === v); if (c) Object.assign(c, ch); }
      return Promise.resolve({ error: null });
    } });
    return q;
  } },
  supabase: {},
}));
const mockSend = jest.fn(async () => ({ success: true, response: { ok: 1 } }));
jest.mock('../../services/aisensyService', () => ({ sendCampaign: (...a) => mockSend(...a) }));
jest.mock('../../services/notificationEngine', () => ({ logResult: jest.fn(async () => {}) }));
jest.mock('../../services/email/communicationEngine', () => ({ enqueueCampaignEmail: jest.fn() }));

const worker = require('../../services/campaignWorker');
beforeEach(() => { state.recipients[0].status = 'queued'; state.campaigns[0].status = 'sending'; state.contacts.c1.whatsapp_suppressed = false; mockSend.mockClear(); });

test('sends WhatsApp via AiSensy with mapped params and marks sent', async () => {
  const r = await worker.processDue();
  expect(mockSend).toHaveBeenCalledTimes(1);
  const arg = mockSend.mock.calls[0][0];
  expect(arg.campaignName).toBe('promo_june');
  expect(arg.destination).toBe('919991112222');
  expect(arg.templateParams).toEqual(['Asha', 'SEO']);
  expect(state.recipients[0].status).toBe('sent');
  expect(r.enqueued).toBe(1);
});

test('marks campaign sent once drained', async () => {
  await worker.processDue();
  expect(state.campaigns[0].status).toBe('sent');
});

test('skips a suppressed / opted-out WhatsApp contact', async () => {
  state.contacts.c1.whatsapp_suppressed = true;
  await worker.processDue();
  expect(mockSend).not.toHaveBeenCalled();
  expect(state.recipients[0].status).toBe('skipped');
});
