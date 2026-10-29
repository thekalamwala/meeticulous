// config/supabase.js fail-fasts at require-time if SUPABASE_SERVICE_ROLE_KEY
// isn't set (missing in CI/local shells without server/.env loaded). This test
// only exercises the pure validateLead/buildLeadEmail helpers, never
// supabaseAdmin, so mock it out — same pattern as tests/unit/adminController.test.js.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/sendEmail', () => jest.fn());

const { supabaseAdmin } = require('../../config/supabase');
const sendEmail = require('../../utils/sendEmail');
const { validateLead, buildLeadEmail, submitEnterpriseLead } = require('../../controllers/enterpriseLeadController');

describe('enterprise lead validation', () => {
  const valid = { orgName: 'Acme Health', email: 'ops@acme.com', phone: '9876543210' };

  test('accepts a valid lead', () => {
    expect(validateLead(valid)).toEqual({ ok: true });
  });
  test('rejects missing org name', () => {
    expect(validateLead({ ...valid, orgName: '' }).ok).toBe(false);
  });
  test('rejects invalid email', () => {
    expect(validateLead({ ...valid, email: 'not-an-email' }).ok).toBe(false);
  });
  test('rejects missing phone', () => {
    expect(validateLead({ ...valid, phone: '' }).ok).toBe(false);
  });
  test('escapes HTML in the email body', () => {
    const html = buildLeadEmail({ ...valid, requirements: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('submitEnterpriseLead', () => {
  const valid = { orgName: 'Acme Health', email: 'ops@acme.com', phone: '9876543210' };
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 500 when both the DB insert and the email fail', async () => {
    supabaseAdmin.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { message: 'relation missing' } }) });
    sendEmail.mockRejectedValue(new Error('smtp down'));

    const res = mockRes();
    await submitEnterpriseLead({ body: valid }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns 201 when the email succeeds even if the DB insert fails', async () => {
    supabaseAdmin.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { message: 'relation missing' } }) });
    sendEmail.mockResolvedValue();

    const res = mockRes();
    await submitEnterpriseLead({ body: valid }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 201 when the DB insert succeeds even if the email fails', async () => {
    supabaseAdmin.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) });
    sendEmail.mockRejectedValue(new Error('smtp down'));

    const res = mockRes();
    await submitEnterpriseLead({ body: valid }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
