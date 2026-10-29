/**
 * tests/unit/auditService.test.js
 * Append-only audit trail — records identity + action, never throws.
 */
jest.mock('../../config/supabase', () => {
  const insert = jest.fn().mockResolvedValue({ error: null });
  return { supabaseAdmin: { from: jest.fn(() => ({ insert })), _insert: insert } };
});

const { supabaseAdmin } = require('../../config/supabase');
const { audit } = require('../../services/auditService');

const reqWith = (admin) => ({
  admin,
  ip: '1.2.3.4',
  headers: { 'user-agent': 'jest' },
});

describe('audit', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes a row carrying the acting admin + action + resource', async () => {
    const req = reqWith({ id: 'a1', email: 'a@x.com', role: 'operations' });
    await audit(req, { action: 'user.suspend', resource_type: 'profile', resource_id: 'u9', after: { is_banned: true } });

    expect(supabaseAdmin.from).toHaveBeenCalledWith('admin_audit_logs');
    const row = supabaseAdmin._insert.mock.calls[0][0];
    expect(row).toMatchObject({
      admin_id: 'a1', admin_email: 'a@x.com', admin_role: 'operations',
      action: 'user.suspend', resource_type: 'profile', resource_id: 'u9',
      ip: '1.2.3.4', user_agent: 'jest',
    });
    expect(row.after).toEqual({ is_banned: true });
  });

  test('coerces resource_id to string and tolerates a missing admin', async () => {
    await audit({ headers: {} }, { action: 'booking.delete', resource_type: 'booking', resource_id: 12345 });
    const row = supabaseAdmin._insert.mock.calls[0][0];
    expect(row.resource_id).toBe('12345');
    expect(row.admin_id).toBeNull();
  });

  test('no-op when action is missing (nothing written)', async () => {
    await audit(reqWith({ id: 'a1' }), {});
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test('never throws even if the insert fails', async () => {
    // This path intentionally triggers a DB failure — silence the expected warn.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdmin._insert.mockRejectedValueOnce(new Error('db down'));
    await expect(audit(reqWith({ id: 'a1' }), { action: 'x.y' })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
