jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
    Promise.resolve({ data: { id: 1, provider: 'resend', from_name: 'BAS', from_email: 'no@bas.in', brand_color: '#FE5100', support_email: 's@bas.in', website_url: 'https://bas.in' }, error: null }) }) }) }) },
  supabase: {},
}));
let sent = null;
jest.mock('../../services/email/providers', () => ({
  getProvider: (n) => ({ name: n, sendEmail: async (m) => { sent = m; return { success: true, id: 'r1' }; } }),
}));

const ctrl = require('../../controllers/emailAdminController');

const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

beforeEach(() => { sent = null; });

test('testProvider sends via configured provider and reports success', async () => {
  const res = mkRes();
  await ctrl.testProvider({ body: { to: 'me@x.test' } }, res);
  expect(sent.to).toBe('me@x.test');
  expect(res.body.message).toMatch(/sent/i);
});

test('testProvider 400s without recipient', async () => {
  const res = mkRes();
  await ctrl.testProvider({ body: {} }, res);
  expect(res.code).toBe(400);
});
