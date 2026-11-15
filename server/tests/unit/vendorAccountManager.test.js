/**
 * tests/unit/vendorAccountManager.test.js
 *
 * getMyAccountManager (intern bug #7): surfaces the host's admin-assigned
 * account manager, or null when unassigned / inactive / schema absent.
 */
jest.mock('../../config/supabase', () => {
  // Per-table queued results: { profiles: {...}, account_managers: {...} }.
  const tables = {};
  const makeBuilder = (table) => {
    const b = {
      select: jest.fn(function () { return this; }),
      eq: jest.fn(function () { return this; }),
      maybeSingle: jest.fn(() => Promise.resolve(tables[table] || { data: null, error: null })),
    };
    return b;
  };
  return {
    supabaseAdmin: {
      __tables: tables,
      from: jest.fn((table) => makeBuilder(table)),
    },
  };
});

const { supabaseAdmin } = require('../../config/supabase');
const { getMyAccountManager } = require('../../controllers/vendorController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const req = { user: { id: 'host-1' } };

beforeEach(() => {
  Object.keys(supabaseAdmin.__tables).forEach((k) => delete supabaseAdmin.__tables[k]);
  supabaseAdmin.from.mockClear();
});

test('returns the assigned active manager contact', async () => {
  supabaseAdmin.__tables.profiles = { data: { account_manager_id: 'am-1' }, error: null };
  supabaseAdmin.__tables.account_managers = { data: { name: 'Ravi', email: 'ravi@x.com', phone: '+91', is_active: true }, error: null };
  const r = res();
  await getMyAccountManager(req, r);
  expect(r.json).toHaveBeenCalledWith({ account_manager: { name: 'Ravi', email: 'ravi@x.com', phone: '+91' } });
});

test('returns null when the host has no manager assigned', async () => {
  supabaseAdmin.__tables.profiles = { data: { account_manager_id: null }, error: null };
  const r = res();
  await getMyAccountManager(req, r);
  expect(r.json).toHaveBeenCalledWith({ account_manager: null });
});

test('returns null when the assigned manager is inactive', async () => {
  supabaseAdmin.__tables.profiles = { data: { account_manager_id: 'am-1' }, error: null };
  supabaseAdmin.__tables.account_managers = { data: { name: 'Ravi', is_active: false }, error: null };
  const r = res();
  await getMyAccountManager(req, r);
  expect(r.json).toHaveBeenCalledWith({ account_manager: null });
});

test('schema-fallback: missing column → null, not an error', async () => {
  supabaseAdmin.__tables.profiles = { data: null, error: { message: 'column profiles.account_manager_id does not exist' } };
  const r = res();
  await getMyAccountManager(req, r);
  expect(r.json).toHaveBeenCalledWith({ account_manager: null });
  expect(r.status).not.toHaveBeenCalledWith(500);
});
