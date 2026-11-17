const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
const { exportRevenue } = require('../../controllers/revenueSyncController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const req = ({ token, query = {} }) => ({ query, get: (h) => (h === 'x-sync-token' ? token : undefined) });

// Mock supabaseAdmin.from(table) → a thenable query builder that resolves to the
// table's canned result regardless of which chain method ends the call.
const mockTables = (tables) => mockFrom.mockImplementation((table) => {
  const q = { then: (resolve, reject) => Promise.resolve(tables[table] || { data: [], error: null }).then(resolve, reject) };
  for (const m of ['select', 'gte', 'lt', 'order', 'in', 'eq']) q[m] = jest.fn(() => q);
  return q;
});

beforeEach(() => { jest.clearAllMocks(); delete process.env.SYNC_REVENUE_TOKEN; delete process.env.API_URL; });

// ── Auth: fail-closed ────────────────────────────────────────────────
test('503 when SYNC_REVENUE_TOKEN is unset (endpoint disabled)', async () => {
  const r = res();
  await exportRevenue(req({ token: 'anything', query: { since: '2026-11-01' } }), r);
  expect(r.status).toHaveBeenCalledWith(503);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('401 on a mismatched token', async () => {
  process.env.SYNC_REVENUE_TOKEN = 'secret';
  const r = res();
  await exportRevenue(req({ token: 'wrong', query: { since: '2026-11-01' } }), r);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(mockFrom).not.toHaveBeenCalled();
});

test('400 when since is missing/malformed', async () => {
  process.env.SYNC_REVENUE_TOKEN = 'secret';
  const r = res();
  await exportRevenue(req({ token: 'secret', query: {} }), r);
  expect(r.status).toHaveBeenCalledWith(400);
});

// ── Mapping ──────────────────────────────────────────────────────────
test('maps an ORDER_PAYMENT entry to split platform_fee + commission rows, and a subscription + razorpay_charge', async () => {
  process.env.SYNC_REVENUE_TOKEN = 'secret';
  mockTables({
    journal_entries: { data: [
      { id: 'E1', journal_date: '2026-11-10', source_type: 'ORDER_PAYMENT', source_id: 'B1', description: 'Order payment — booking B1' },
      { id: 'E2', journal_date: '2026-11-11', source_type: 'SUBSCRIPTION_PAYMENT', source_id: 'S1', description: 'Subscription payment — Pro' },
    ], error: null },
    journal_lines: { data: [
      // E1: no invoice → gross/gst derived at the flat 18% rate.
      { journal_entry_id: 'E1', debit: 354, credit: 0, chart_of_accounts: { code: '1100' } },
      { journal_entry_id: 'E1', debit: 0, credit: 100, chart_of_accounts: { code: '4000' } }, // platform fee ex-GST
      { journal_entry_id: 'E1', debit: 0, credit: 200, chart_of_accounts: { code: '4100' } }, // commission ex-GST
      { journal_entry_id: 'E1', debit: 0, credit: 54, chart_of_accounts: { code: '2100' } },  // combined GST
      // E2: subscription with an invoice + a BAS-borne subscription MDR (5100).
      { journal_entry_id: 'E2', debit: 1178.82, credit: 0, chart_of_accounts: { code: '1100' } },
      { journal_entry_id: 'E2', debit: 0, credit: 999, chart_of_accounts: { code: '4200' } },
      { journal_entry_id: 'E2', debit: 0, credit: 179.82, chart_of_accounts: { code: '2100' } },
      { journal_entry_id: 'E2', debit: 30, credit: 0, chart_of_accounts: { code: '5100' } },
    ], error: null },
    invoices: { data: [
      { id: 'INV2', access_token: 'tok2', source_type: 'subscription', source_id: 'S1', total: 1178.82, cgst: 0, sgst: 0, igst: 179.82 },
    ], error: null },
  });

  const r = res();
  await exportRevenue(req({ token: 'secret', query: { since: '2026-11-01', until: '2026-11-13' } }), r);

  const body = r.json.mock.calls[0][0];
  expect(body.since).toBe('2026-11-01');
  expect(body.until).toBe('2026-11-13');
  const byId = Object.fromEntries(body.entries.map((e) => [e.journal_id, e]));

  // ORDER_PAYMENT splits into two typed rows, each with a composite journal_id.
  expect(byId['E1:platform_fee']).toMatchObject({ type: 'platform_fee', gross: 118, gst: 18, currency: 'INR', invoice_url: null });
  expect(byId['E1:commission']).toMatchObject({ type: 'commission', gross: 236, gst: 36, invoice_url: null });

  // Subscription uses the invoice as the authoritative gross/gst + a working URL.
  expect(byId['E2:subscription']).toMatchObject({
    type: 'subscription', gross: 1178.82, gst: 179.82,
    invoice_url: 'https://api.meeticulous.com/api/invoices/INV2?token=tok2',
  });

  // Subscription MDR is a real BAS cost; GST on a cost is 0.
  expect(byId['E2:razorpay_charge']).toMatchObject({ type: 'razorpay_charge', gross: 30, gst: 0, invoice_url: null });

  // No stray rows (e.g. the 1100 pass-through / 2000 payable are never emitted).
  expect(body.entries).toHaveLength(4);
});

test('order-MDR that nets to zero (host-borne 5000) is NOT emitted as a cost', async () => {
  process.env.SYNC_REVENUE_TOKEN = 'secret';
  mockTables({
    journal_entries: { data: [
      { id: 'E3', journal_date: '2026-11-10', source_type: 'ORDER_PAYMENT', source_id: 'B3', description: 'Order payment — booking B3' },
    ], error: null },
    journal_lines: { data: [
      { journal_entry_id: 'E3', debit: 0, credit: 100, chart_of_accounts: { code: '4000' } },
      { journal_entry_id: 'E3', debit: 0, credit: 18, chart_of_accounts: { code: '2100' } },
      // Host-borne gateway fee: debit + credit-back on 5000 → nets to 0.
      { journal_entry_id: 'E3', debit: 12, credit: 0, chart_of_accounts: { code: '5000' } },
      { journal_entry_id: 'E3', debit: 0, credit: 12, chart_of_accounts: { code: '5000' } },
    ], error: null },
    invoices: { data: [], error: null },
  });

  const r = res();
  await exportRevenue(req({ token: 'secret', query: { since: '2026-11-01' } }), r);
  const body = r.json.mock.calls[0][0];
  expect(body.entries.map((e) => e.type)).toEqual(['platform_fee']); // no razorpay_charge
});
