'use strict';

// Table-driven mock: each .from(table) returns a chainable query object whose
// terminal methods (eq/in/order) resolve to that table's configured rows.
// This lets one test file exercise the 3-query fan-out (subscription_payments
// -> bookings -> invoices) with real per-table data instead of one blanket stub.
// (jest.mock factories can't close over outer vars, so state + helpers live
// inside the factory and are exposed back out via __mockTables.)
jest.mock('../../config/supabase', () => {
  const mockTables = {};
  function makeQuery(name) {
    const result = () => Promise.resolve({ data: mockTables[name] || [], error: null });
    const query = { select: () => query, eq: () => result(), in: () => query, order: () => result() };
    return query;
  }
  return { supabaseAdmin: { from: (name) => makeQuery(name) }, __mockTables: mockTables };
});

const { listMyInvoices } = require('../../controllers/invoiceController');
const { __mockTables: tables } = require('../../config/supabase');
const setTable = (name, rows) => { tables[name] = rows; };

const mkRes = () => {
  const r = {};
  r.status = (c) => { r.code = c; return r; };
  r.json = (j) => { r.body = j; return r; };
  return r;
};

beforeEach(() => {
  Object.keys(tables).forEach((k) => delete tables[k]);
});

test('returns invoices for subscriptions and bookings owned by the user', async () => {
  setTable('subscription_payments', [{ id: 'sp1' }]);
  setTable('bookings', [{ id: 'bk1' }]);
  setTable('invoices', [
    { id: 'i1', invoice_number: 'BAS-SUB/26/00001', total: 1768.82, issued_at: '2026-07-01T00:00:00Z', access_token: 'tok1', source_type: 'subscription' },
    { id: 'i2', invoice_number: 'BAS-BKG/26/00001', total: 590, issued_at: '2026-07-02T00:00:00Z', access_token: 'tok2', source_type: 'booking' },
  ]);

  const res = mkRes();
  await listMyInvoices({ user: { id: 'u1' } }, res);

  expect(res.body).toHaveLength(2);
  expect(res.body.map((i) => i.invoice_number)).toEqual(['BAS-SUB/26/00001', 'BAS-BKG/26/00001']);
});

test('returns empty array when the user has no subscriptions or bookings', async () => {
  setTable('subscription_payments', []);
  setTable('bookings', []);
  // invoices table intentionally left populated to prove the short-circuit
  // (no source ids -> never queried) rather than an incidental empty result.
  setTable('invoices', [{ id: 'ix', invoice_number: 'BAS-BKG/26/00099', total: 100, issued_at: '2026-07-01T00:00:00Z', access_token: 'x', source_type: 'booking' }]);

  const res = mkRes();
  await listMyInvoices({ user: { id: 'u-none' } }, res);

  expect(res.body).toEqual([]);
});

test('500s when a query throws', async () => {
  jest.resetModules();
  jest.doMock('../../config/supabase', () => ({
    supabaseAdmin: { from: () => { throw new Error('db down'); } },
  }));
  const { listMyInvoices: listMyInvoicesThrows } = require('../../controllers/invoiceController');
  const res = mkRes();
  await listMyInvoicesThrows({ user: { id: 'u1' } }, res);
  expect(res.code).toBe(500);
});
