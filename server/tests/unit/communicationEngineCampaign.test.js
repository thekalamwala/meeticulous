const db = {
  email_settings: { id: 1, provider: 'resend', from_name: 'BAS', support_email: 's@x', website_url: 'https://x', brand_color: '#FE5100' },
  email_templates: [{ id: 'tA', event_key: 'CAMPAIGN_PROMO', audience: 'all', status: 'active', subject: 'Hi {{first_name}}', html_content: '<p>{{first_name}}</p>', preview_text: '', cta_label: '', cta_url: '' }],
  email_logs: [],
};
jest.mock('../../config/supabase', () => {
  const make = (table) => ({
    select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
    maybeSingle() { return Promise.resolve({ data: table === 'email_settings' ? db.email_settings : null, error: null }); },
    single() { return Promise.resolve({ data: db.email_templates[0], error: null }); },
    insert(row) { const r = { id: `log${db.email_logs.length + 1}`, ...row }; db.email_logs.push(r); return { select: () => ({ single: () => Promise.resolve({ data: { id: r.id }, error: null }) }) }; },
    then(res) { if (table === 'email_templates') return res({ data: db.email_templates, error: null }); return res({ data: [], error: null }); },
  });
  return { supabaseAdmin: { from: (t) => make(t) }, supabase: {} };
});
jest.mock('../../services/email/providers', () => ({ getProvider: () => ({ name: 'resend', sendEmail: async () => ({ success: true }) }) }));

const engine = require('../../services/email/communicationEngine');
beforeEach(() => { db.email_logs = []; engine.clearCache(); });

test('enqueues a campaign email as a queued log tagged with campaign_id', async () => {
  const r = await engine.enqueueCampaignEmail({
    templateId: 'tA', to: 'a@x.test', data: { first_name: 'Asha' },
    user: { name: 'Asha', email: 'a@x.test' }, campaignId: 'camp1',
  });
  expect(r.ok).toBe(true);
  expect(r.status).toBe('queued');
  expect(db.email_logs).toHaveLength(1);
  expect(db.email_logs[0].campaign_id).toBe('camp1');
  expect(db.email_logs[0].status).toBe('queued');
  expect(db.email_logs[0].subject).toBe('Hi Asha');
  expect(db.email_logs[0].html).toContain('Asha');
});

test('enqueues a composer (custom-HTML) campaign email with no template', async () => {
  const r = await engine.enqueueCampaignEmail({
    bodyHtml: '<table><tr><td>Hey {{first_name}}</td></tr></table>',
    subject: 'Custom {{first_name}}', previewText: 'preheader', audience: 'customer',
    to: 'b@x.test', data: { first_name: 'Ravi' },
    user: { name: 'Ravi', email: 'b@x.test' }, campaignId: 'camp2',
  });
  expect(r.ok).toBe(true);
  expect(r.status).toBe('queued');
  expect(db.email_logs[0].template_id).toBeNull();
  expect(db.email_logs[0].campaign_id).toBe('camp2');
  expect(db.email_logs[0].subject).toBe('Custom Ravi');   // token resolved in composed subject
  expect(db.email_logs[0].html).toContain('Hey Ravi');    // token resolved in composed body
  expect(db.email_logs[0].html).toContain('unsubscribe');  // wrapped in customer shell
});

test('rejects an enqueue with neither templateId nor bodyHtml', async () => {
  const r = await engine.enqueueCampaignEmail({ to: 'c@x.test', campaignId: 'camp3' });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/templateId or bodyHtml/);
});

test('sendComposedTest delivers now and logs an is_test row', async () => {
  const r = await engine.sendComposedTest({
    bodyHtml: '<table><tr><td>Hi {{first_name}}</td></tr></table>',
    subject: 'Draft {{first_name}}', previewText: 'p', audience: 'customer', to: 'admin@x.test',
  });
  expect(r.ok).toBe(true);
  expect(db.email_logs).toHaveLength(1);
  expect(db.email_logs[0].is_test).toBe(true);
  expect(db.email_logs[0].status).toBe('test');
  expect(db.email_logs[0].recipient).toBe('admin@x.test');
  expect(db.email_logs[0].html).toContain('Hi there'); // {{first_name}} → 'there' in a test send
});

test('sendComposedTest rejects without a body or recipient', async () => {
  expect((await engine.sendComposedTest({ to: 'a@x.test' })).ok).toBe(false);
  expect((await engine.sendComposedTest({ bodyHtml: '<b/>' })).ok).toBe(false);
});
