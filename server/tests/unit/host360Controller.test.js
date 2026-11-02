'use strict';
/**
 * host360Controller — admin Host 360 (v3.80).
 *
 * Focus is on the things a green build won't catch on its own: the loadHost gate
 * every :id route depends on, KYC masking on the documents tab, and the write
 * actions (suspend / plan / assign-AM / email) validating and auditing.
 *
 * kycCrypto is real so the masking assertions exercise an actual AES round-trip.
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/settlementService', () => ({
  computeSettlementBalance: jest.fn(() => Promise.resolve({
    lifetimeEarned: 5000, available: 1000, clearing: 500, paidOut: 3500, pendingCompletion: 0,
  })),
  computeAllSettlementBalances: jest.fn(() => Promise.resolve(new Map())),
}));
jest.mock('../../services/crmService', () => ({ listClients: jest.fn(() => Promise.resolve({ clients: [], total: 0 })) }));
jest.mock('../../services/planService', () => ({
  getPlan: jest.fn(), normalizeSlug: jest.fn((s) => s),
}));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn(() => Promise.resolve({ clearingDays: 7 })) }));
jest.mock('../../services/email/communicationEngine', () => ({
  loadSettings: jest.fn(() => Promise.resolve({ provider: 'smtp', from_name: 'Meeticulous', from_email: 'bolt@meeticulous.com' })),
}));
jest.mock('../../services/email/providers', () => ({ getProvider: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { audit } = require('../../services/auditService');
const planService = require('../../services/planService');
const { getProvider } = require('../../services/email/providers');
const { encrypt } = require('../../utils/kycCrypto');
const ctrl = require('../../controllers/host360Controller');

const HOST = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const AM = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const NOTE = 'cccccccc-3333-4333-8333-cccccccccccc';
const admin = {
  id: 'adm1', email: 'ops@meeticulous.com', role: 'operations',
  permissions: ['users.view', 'users.edit', 'kyc.view', 'documents.view', 'documents.manage'],
};
// A KYC reviewer with no documents grant — support's shape after v3.81.
const kycOnlyAdmin = { id: 'adm2', email: 'support@meeticulous.com', role: 'support', permissions: ['kyc.view'] };
const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// Supabase query builders are chainable and awaitable. One thenable stub covers
// every shape the controller uses (.select().eq()…, .single(), bare await).
const chainFor = (result) => {
  const c = {};
  const self = () => c;
  for (const m of ['select', 'eq', 'neq', 'gt', 'lt', 'in', 'not', 'or', 'order', 'range', 'limit', 'update', 'insert', 'upsert', 'delete']) {
    c[m] = jest.fn(self);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return c;
};

// Per-table results; anything unstubbed resolves to an empty set.
let tables = {};
const chains = {};
const setTables = (map) => {
  tables = map;
  supabaseAdmin.from.mockImplementation((t) => {
    const c = chainFor(tables[t] || { data: [], error: null, count: 0 });
    chains[t] = c;
    return c;
  });
};

const hostRow = (over = {}) => ({
  id: HOST, role: 'host', name: 'Asha Rao', email: 'asha@example.com', username: 'asha',
  plan: 'starter', is_banned: false, is_verified: true, account_manager_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  google_access_token: 'ya29.secret', google_refresh_token: 'rt.secret',
  otp_code: '123456', otp_expires_at: '2026-01-01T00:05:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  setTables({ profiles: { data: hostRow(), error: null } });
});

// ── loadHost gate ───────────────────────────────────────────────
const idRoutes = [
  ['getHost', 'getHost'], ['getUsage', 'getUsage'], ['getBilling', 'getBilling'],
  ['getTimeline', 'getTimeline'], ['getCustomers', 'getCustomers'], ['getSupport', 'getSupport'],
  ['getDocuments', 'getDocuments'], ['uploadHostDocument', 'uploadHostDocument'],
  ['deleteHostDocument', 'deleteHostDocument'], ['revealKycPii', 'revealKycPii'],
  ['listNotes', 'listNotes'], ['suspendHost', 'suspendHost'],
  ['assignHostPlan', 'assignHostPlan'], ['assignAccountManager', 'assignAccountManager'], ['emailHost', 'emailHost'],
];

test.each(idRoutes)('%s rejects a non-uuid id with 400 before touching the db', async (_l, fn) => {
  const res = mockRes();
  await ctrl[fn]({ params: { id: 'not-a-uuid' }, query: {}, body: {}, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test.each(idRoutes)('%s 404s when the profile is a guest, not a host', async (_l, fn) => {
  setTables({ profiles: { data: hostRow({ role: 'user' }), error: null } });
  const res = mockRes();
  await ctrl[fn]({ params: { id: HOST }, query: {}, body: {}, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('getHost 404s when the profile does not exist', async () => {
  setTables({ profiles: { data: null, error: null } });
  const res = mockRes();
  await ctrl.getHost({ params: { id: HOST }, query: {}, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

// ── getHost ─────────────────────────────────────────────────────
test('getHost strips OAuth tokens and OTP secrets from the profile', async () => {
  const res = mockRes();
  await ctrl.getHost({ params: { id: HOST }, query: {}, admin }, res);

  const out = res.json.mock.calls[0][0];
  expect(out.host.name).toBe('Asha Rao');
  for (const k of ['google_access_token', 'google_refresh_token', 'otp_code', 'otp_expires_at']) {
    expect(out.host).not.toHaveProperty(k);
  }
  expect(JSON.stringify(out)).not.toContain('ya29.secret');
});

test('getHost raises red flags for suspended, unverified and expiring hosts', async () => {
  setTables({
    profiles: {
      data: hostRow({
        is_banned: true,
        is_verified: false,
        plan_expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
      error: null,
    },
  });
  const res = mockRes();
  await ctrl.getHost({ params: { id: HOST }, query: {}, admin }, res);
  expect(res.json.mock.calls[0][0].red_flags).toEqual(
    expect.arrayContaining(['suspended', 'unverified', 'trial_ending']),
  );
});

test('getHost does not flag trial_ending for a plan expiring far out', async () => {
  setTables({ profiles: { data: hostRow({ plan_expires_at: new Date(Date.now() + 90 * 86400000).toISOString() }), error: null } });
  const res = mockRes();
  await ctrl.getHost({ params: { id: HOST }, query: {}, admin }, res);
  expect(res.json.mock.calls[0][0].red_flags).not.toContain('trial_ending');
});

// ── getDocuments ────────────────────────────────────────────────
const withKyc = (over = {}) => {
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: {
      data: {
        status: 'approved',
        full_name: 'Asha Rao',
        phone: '9876543210',
        pan_number: encrypt('ABCDE1234F'),
        aadhaar_number: encrypt('123412341234'),
        account_number: encrypt('123456789012'),
        ifsc: 'HDFC0001234',
        selfie_url: `${HOST}/selfie_1.jpg`,
        pan_doc_url: `${HOST}/pan_1.jpg`,
        aadhaar_doc_url: null,
        created_at: '2026-02-01T00:00:00.000Z',
        ...over,
      },
      error: null,
    },
    host_documents: { data: [], error: null },
  });
  supabaseAdmin.storage.from.mockReturnValue({
    createSignedUrl: jest.fn((key) => Promise.resolve({ data: { signedUrl: `https://signed/${key}` } })),
  });
};

test('getDocuments masks KYC identity numbers and never returns raw PII', async () => {
  withKyc();
  const res = mockRes();
  await ctrl.getDocuments({ params: { id: HOST }, admin }, res);

  const { kyc } = res.json.mock.calls[0][0];
  expect(kyc.pan_number).toBe('XXXXXX234F');
  expect(kyc.aadhaar_number).toBe('XXXXXXXX1234');
  expect(kyc.account_number).toBe('XXXXXX9012');
  expect(kyc.phone).toBe('XXXXXX3210');
  expect(kyc.bank_masked).toBe('XXXXXX9012 · HDFC0001234');

  const body = JSON.stringify(res.json.mock.calls[0][0]);
  expect(body).not.toContain('ABCDE1234F');
  expect(body).not.toContain('123412341234');
  expect(body).not.toContain('123456789012');
  expect(body).not.toContain('9876543210');
});

test('getDocuments signs only the KYC documents that exist', async () => {
  withKyc();
  const res = mockRes();
  await ctrl.getDocuments({ params: { id: HOST }, admin }, res);

  const labels = res.json.mock.calls[0][0].kyc.documents.map((d) => d.label);
  expect(labels).toEqual(['Selfie', 'PAN card']); // aadhaar_doc_url was null
});

test('getDocuments signs storage keys with a short-lived url', async () => {
  withKyc();
  const store = { createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed/x' } })) };
  supabaseAdmin.storage.from.mockReturnValue(store);

  await ctrl.getDocuments({ params: { id: HOST }, admin }, mockRes());

  expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('kyc');
  for (const call of store.createSignedUrl.mock.calls) expect(call[1]).toBe(60);
});

test('getDocuments returns kyc null when the host never submitted', async () => {
  setTables({ profiles: { data: hostRow(), error: null }, kyc_submissions: { data: null, error: null } });
  const res = mockRes();
  await ctrl.getDocuments({ params: { id: HOST }, admin }, res);
  expect(res.json.mock.calls[0][0]).toMatchObject({ kyc: null, documents: [] });
});

// ── v3.81: documents.view is a separate grant from kyc.view ──────
const DOC = 'dddddddd-4444-4444-8444-dddddddddddd';
const withDocs = () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: { data: null, error: null },
    host_documents: { data: [{ id: DOC, file_name: 'signed-contract.pdf', doc_type: 'contract', size_bytes: 1024, storage_key: `host-docs/${HOST}/1.pdf`, created_at: '2026-03-01T00:00:00.000Z' }], error: null },
  });
  supabaseAdmin.storage.from.mockReturnValue({
    createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed/doc' } })),
    upload: jest.fn(() => Promise.resolve({ error: null })),
    remove: jest.fn(() => Promise.resolve({ error: null })),
  });
};

test('getDocuments serves admin paperwork to an admin holding documents.view', async () => {
  withDocs();
  const res = mockRes();
  await ctrl.getDocuments({ params: { id: HOST }, admin }, res);
  const out = res.json.mock.calls[0][0];
  expect(out.documents).toHaveLength(1);
  expect(out.documents[0]).toMatchObject({ name: 'signed-contract.pdf', url: 'https://signed/doc' });
  expect(out.documents_locked).toBe(false);
});

test('getDocuments hides admin paperwork from a kyc.view-only admin, but still serves KYC', async () => {
  withKyc();
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: { data: { status: 'approved', pan_number: encrypt('ABCDE1234F'), phone: '9876543210', created_at: 'x' }, error: null },
    host_documents: { data: [{ id: DOC, file_name: 'signed-contract.pdf', storage_key: 'k' }], error: null },
  });
  const res = mockRes();

  await ctrl.getDocuments({ params: { id: HOST }, admin: kycOnlyAdmin }, res);

  const out = res.json.mock.calls[0][0];
  expect(out.kyc.pan_number).toBe('XXXXXX234F'); // KYC review still works
  expect(out.documents).toEqual([]);             // paperwork does not
  expect(out.documents_locked).toBe(true);
  expect(JSON.stringify(out)).not.toContain('signed-contract.pdf');
});

test('getDocuments does not even query host_documents without the grant', async () => {
  withDocs();
  await ctrl.getDocuments({ params: { id: HOST }, admin: kycOnlyAdmin }, mockRes());
  expect(supabaseAdmin.from).not.toHaveBeenCalledWith('host_documents');
});

// ── reveal (unmasked PII) ───────────────────────────────────────
const revealAdmin = { id: 'adm3', email: 'kyc@meeticulous.com', role: 'operations', permissions: ['kyc.view', 'kyc.decide'] };

test('revealKycPii returns the decrypted values and audits who revealed what', async () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: {
      data: {
        id: 'kyc1',
        pan_number: encrypt('ABCDE1234F'),
        aadhaar_number: encrypt('123412341234'),
        account_number: encrypt('123456789012'),
        phone: '9876543210', ifsc: 'HDFC0001234',
      },
      error: null,
    },
  });
  const res = mockRes();

  await ctrl.revealKycPii({ params: { id: HOST }, admin: revealAdmin }, res);

  expect(res.json.mock.calls[0][0]).toMatchObject({
    pan_number: 'ABCDE1234F',
    aadhaar_number: '123412341234',
    account_number: '123456789012',
    ifsc: 'HDFC0001234',
  });
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    action: 'kyc.pii_revealed', resource_type: 'profile', resource_id: HOST,
  }));
});

test('revealKycPii audits before responding, so a reveal is always on the record', async () => {
  const order = [];
  audit.mockImplementation(() => { order.push('audit'); return Promise.resolve(); });
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: { data: { id: 'kyc1', pan_number: encrypt('ABCDE1234F') }, error: null },
  });
  const res = mockRes();
  res.json = jest.fn(() => { order.push('json'); return res; });

  await ctrl.revealKycPii({ params: { id: HOST }, admin: revealAdmin }, res);

  expect(order).toEqual(['audit', 'json']);
});

test('revealKycPii 404s when the host has no submission, and audits nothing', async () => {
  setTables({ profiles: { data: hostRow(), error: null }, kyc_submissions: { data: null, error: null } });
  const res = mockRes();
  await ctrl.revealKycPii({ params: { id: HOST }, admin: revealAdmin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(audit).not.toHaveBeenCalled();
});

test('revealKycPii returns nulls rather than throwing when the key cannot decrypt', async () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    kyc_submissions: { data: { id: 'kyc1', pan_number: 'garbage:not:decryptable', aadhaar_number: null, account_number: null }, error: null },
  });
  const res = mockRes();
  await ctrl.revealKycPii({ params: { id: HOST }, admin: revealAdmin }, res);
  expect(res.json.mock.calls[0][0].pan_number).toBeNull();
});

// ── upload / delete ─────────────────────────────────────────────
const PDF = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(64)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64)]);

test('uploadHostDocument stores under host-docs/<hostId>/ and records the row', async () => {
  withDocs();
  const store = {
    upload: jest.fn(() => Promise.resolve({ error: null })),
    createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'x' } })),
  };
  supabaseAdmin.storage.from.mockReturnValue(store);
  setTables({
    profiles: { data: hostRow(), error: null },
    host_documents: { data: { id: DOC, file_name: 'contract.pdf' }, error: null },
  });
  const res = mockRes();

  await ctrl.uploadHostDocument({
    params: { id: HOST }, admin, body: { doc_type: 'contract' },
    file: { size: 2048, buffer: PDF, originalname: 'contract.pdf' },
  }, res);

  expect(supabaseAdmin.storage.from).toHaveBeenCalledWith('kyc');
  const key = store.upload.mock.calls[0][0];
  expect(key.startsWith(`host-docs/${HOST}/`)).toBe(true);
  expect(key.endsWith('.pdf')).toBe(true);
  expect(store.upload.mock.calls[0][2]).toMatchObject({ contentDisposition: 'attachment', upsert: false });
  expect(chains.host_documents.insert.mock.calls[0][0]).toMatchObject({
    host_id: HOST, uploaded_by: 'adm1', storage_key: key, file_name: 'contract.pdf',
    mime_type: 'application/pdf', size_bytes: 2048, doc_type: 'contract',
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'host_document.upload' }));
});

test('uploadHostDocument strips any path from the supplied file name', async () => {
  withDocs();
  setTables({ profiles: { data: hostRow(), error: null }, host_documents: { data: { id: DOC }, error: null } });
  supabaseAdmin.storage.from.mockReturnValue({ upload: jest.fn(() => Promise.resolve({ error: null })) });

  await ctrl.uploadHostDocument({
    params: { id: HOST }, admin, body: {},
    file: { size: 10, buffer: PDF, originalname: '../../etc/passwd.pdf' },
  }, mockRes());

  expect(chains.host_documents.insert.mock.calls[0][0].file_name).toBe('passwd.pdf');
});

test('uploadHostDocument rejects a disallowed type on magic bytes, not extension', async () => {
  withDocs();
  const store = { upload: jest.fn() };
  supabaseAdmin.storage.from.mockReturnValue(store);
  const res = mockRes();

  await ctrl.uploadHostDocument({
    params: { id: HOST }, admin, body: {},
    file: { size: 10, buffer: GIF, originalname: 'totally-a.pdf' },
  }, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(store.upload).not.toHaveBeenCalled();
});

test('uploadHostDocument rejects an oversized file and a missing file', async () => {
  withDocs();
  const big = mockRes();
  await ctrl.uploadHostDocument({ params: { id: HOST }, admin, body: {}, file: { size: 6 * 1024 * 1024, buffer: PDF } }, big);
  expect(big.status).toHaveBeenCalledWith(400);

  const none = mockRes();
  await ctrl.uploadHostDocument({ params: { id: HOST }, admin, body: {} }, none);
  expect(none.status).toHaveBeenCalledWith(400);
});

test('deleteHostDocument removes the row, the object, and audits', async () => {
  withDocs();
  const store = { remove: jest.fn(() => Promise.resolve({ error: null })) };
  supabaseAdmin.storage.from.mockReturnValue(store);
  setTables({
    profiles: { data: hostRow(), error: null },
    host_documents: { data: { id: DOC, storage_key: `host-docs/${HOST}/1.pdf`, file_name: 'c.pdf' }, error: null },
  });
  const res = mockRes();

  await ctrl.deleteHostDocument({ params: { id: HOST, docId: DOC }, admin }, res);

  expect(chains.host_documents.eq).toHaveBeenCalledWith('host_id', HOST); // cannot cross hosts
  expect(store.remove).toHaveBeenCalledWith([`host-docs/${HOST}/1.pdf`]);
  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'host_document.delete' }));
  expect(res.json).toHaveBeenCalledWith({ ok: true });
});

test('deleteHostDocument 404s on an unknown document and 400s on a bad id', async () => {
  setTables({ profiles: { data: hostRow(), error: null }, host_documents: { data: null, error: null } });
  const missing = mockRes();
  await ctrl.deleteHostDocument({ params: { id: HOST, docId: DOC }, admin }, missing);
  expect(missing.status).toHaveBeenCalledWith(404);

  const bad = mockRes();
  await ctrl.deleteHostDocument({ params: { id: HOST, docId: 'nope' }, admin }, bad);
  expect(bad.status).toHaveBeenCalledWith(400);
});

test('deleteHostDocument still succeeds when storage removal fails', async () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    host_documents: { data: { id: DOC, storage_key: 'k', file_name: 'c.pdf' }, error: null },
  });
  supabaseAdmin.storage.from.mockReturnValue({ remove: jest.fn(() => Promise.reject(new Error('storage down'))) });
  const res = mockRes();

  await ctrl.deleteHostDocument({ params: { id: HOST, docId: DOC }, admin }, res);

  expect(res.json).toHaveBeenCalledWith({ ok: true });
});

// ── actions ─────────────────────────────────────────────────────
test('suspendHost flips is_banned and audits the before/after', async () => {
  setTables({ profiles: { data: hostRow({ is_banned: true }), error: null } });
  const res = mockRes();

  await ctrl.suspendHost({ params: { id: HOST }, body: { suspend: true }, admin }, res);

  expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    action: 'user.suspend', resource_id: HOST,
  }));
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
});

test('assignHostPlan requires a plan_slug', async () => {
  const res = mockRes();
  await ctrl.assignHostPlan({ params: { id: HOST }, body: {}, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(audit).not.toHaveBeenCalled();
});

test('assignHostPlan 404s on an unknown plan', async () => {
  planService.getPlan.mockResolvedValue(null);
  const res = mockRes();
  await ctrl.assignHostPlan({ params: { id: HOST }, body: { plan_slug: 'nope' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('assignHostPlan rejects a slug that is not its own canonical form', async () => {
  planService.getPlan.mockResolvedValue({ slug: 'host_plus', annual_price: 1499 });
  planService.normalizeSlug.mockReturnValue('studio');
  const res = mockRes();
  await ctrl.assignHostPlan({ params: { id: HOST }, body: { plan_slug: 'host_plus' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('assignHostPlan sets an expiry for a paid plan and none for a free one', async () => {
  planService.normalizeSlug.mockImplementation((s) => s);

  planService.getPlan.mockResolvedValue({ slug: 'host_plus', annual_price: 1499 });
  setTables({ profiles: { data: hostRow(), error: null } });
  await ctrl.assignHostPlan({ params: { id: HOST }, body: { plan_slug: 'host_plus' }, admin }, mockRes());
  const paid = chains.profiles.update.mock.calls[0][0];
  expect(paid.plan).toBe('host_plus');
  expect(Date.parse(paid.plan_expires_at)).toBeGreaterThan(Date.now());

  planService.getPlan.mockResolvedValue({ slug: 'starter', annual_price: 0 });
  setTables({ profiles: { data: hostRow(), error: null } });
  await ctrl.assignHostPlan({ params: { id: HOST }, body: { plan_slug: 'starter' }, admin }, mockRes());
  expect(chains.profiles.update.mock.calls[0][0].plan_expires_at).toBeNull();
});

test('assignHostPlan does not touch the onboarding step', async () => {
  planService.normalizeSlug.mockImplementation((s) => s);
  planService.getPlan.mockResolvedValue({ slug: 'host_plus', annual_price: 1499 });
  setTables({ profiles: { data: hostRow(), error: null } });

  await ctrl.assignHostPlan({ params: { id: HOST }, body: { plan_slug: 'host_plus' }, admin }, mockRes());

  // Granting a plan must not fast-forward a host through onboarding.
  expect(chains.profiles.update.mock.calls[0][0]).not.toHaveProperty('onboarding_step_completed');
  expect(chains.profiles.update.mock.calls[0][0]).not.toHaveProperty('onboarding_completed');
});

test('assignAccountManager rejects a non-uuid manager id', async () => {
  const res = mockRes();
  await ctrl.assignAccountManager({ params: { id: HOST }, body: { account_manager_id: 'nope' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('assignAccountManager 404s on an unknown manager', async () => {
  setTables({ profiles: { data: hostRow(), error: null }, account_managers: { data: null, error: null } });
  const res = mockRes();
  await ctrl.assignAccountManager({ params: { id: HOST }, body: { account_manager_id: AM }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test('assignAccountManager accepts null to unassign', async () => {
  const res = mockRes();
  await ctrl.assignAccountManager({ params: { id: HOST }, body: { account_manager_id: null }, admin }, res);
  expect(chains.profiles.update.mock.calls[0][0].account_manager_id).toBeNull();
  expect(res.json).toHaveBeenCalledWith({ ok: true });
});

// ── notes ───────────────────────────────────────────────────────
test('createNote requires a non-blank body', async () => {
  const res = mockRes();
  await ctrl.createNote({ params: { id: HOST }, body: { body: '   ' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('createNote stamps the acting admin', async () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    host_admin_notes: { data: { id: NOTE, body: 'Called host', admin_email: admin.email }, error: null },
  });
  const res = mockRes();
  await ctrl.createNote({ params: { id: HOST }, body: { body: 'Called host' }, admin }, res);
  expect(chains.host_admin_notes.insert.mock.calls[0][0]).toMatchObject({
    host_id: HOST, admin_id: 'adm1', admin_email: admin.email, body: 'Called host',
  });
  expect(res.status).toHaveBeenCalledWith(201);
});

test('updateNote and deleteNote scope by host so a note cannot be reached via another host', async () => {
  setTables({
    profiles: { data: hostRow(), error: null },
    host_admin_notes: { data: { id: NOTE, body: 'x' }, error: null, count: 1 },
  });

  await ctrl.updateNote({ params: { id: HOST, noteId: NOTE }, body: { body: 'x' }, admin }, mockRes());
  expect(chains.host_admin_notes.eq).toHaveBeenCalledWith('host_id', HOST);

  await ctrl.deleteNote({ params: { id: HOST, noteId: NOTE }, admin }, mockRes());
  expect(chains.host_admin_notes.eq).toHaveBeenCalledWith('host_id', HOST);
});

test('deleteNote 404s when nothing matched', async () => {
  setTables({ profiles: { data: hostRow(), error: null }, host_admin_notes: { data: null, error: null, count: 0 } });
  const res = mockRes();
  await ctrl.deleteNote({ params: { id: HOST, noteId: NOTE }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

// ── email ───────────────────────────────────────────────────────
test('emailHost requires a subject and body', async () => {
  const res = mockRes();
  await ctrl.emailHost({ params: { id: HOST }, body: { subject: 'Hi' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('emailHost 400s when the host has no email on file', async () => {
  setTables({ profiles: { data: hostRow({ email: null }), error: null } });
  const res = mockRes();
  await ctrl.emailHost({ params: { id: HOST }, body: { subject: 'Hi', body: 'There' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('emailHost sends to the host and audits the subject only, never the body', async () => {
  const sendEmail = jest.fn(() => Promise.resolve({ success: true }));
  getProvider.mockReturnValue({ sendEmail });
  const res = mockRes();

  await ctrl.emailHost({ params: { id: HOST }, body: { subject: 'Check-in', body: 'secret body text' }, admin }, res);

  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'asha@example.com', subject: 'Check-in' }));
  const auditArg = audit.mock.calls[0][1];
  expect(auditArg).toMatchObject({ action: 'host.email_sent', after: { subject: 'Check-in' } });
  expect(JSON.stringify(auditArg)).not.toContain('secret body text');
});

test('emailHost surfaces a provider failure as 502', async () => {
  getProvider.mockReturnValue({ sendEmail: jest.fn(() => Promise.resolve({ success: false, error: 'smtp down' })) });
  const res = mockRes();
  await ctrl.emailHost({ params: { id: HOST }, body: { subject: 'Hi', body: 'There' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(502);
  expect(audit).not.toHaveBeenCalled();
});

// ── list ────────────────────────────────────────────────────────
test('listHosts only ever lists hosts and caps the page size', async () => {
  setTables({ profiles: { data: [], error: null, count: 0 } });
  await ctrl.listHosts({ query: { limit: '5000' }, admin }, mockRes());
  expect(chains.profiles.eq).toHaveBeenCalledWith('role', 'host');
  expect(chains.profiles.range).toHaveBeenCalledWith(0, 99); // 100 cap
});

test('listHosts survives a settlement read failure with revenue 0', async () => {
  const { computeAllSettlementBalances } = require('../../services/settlementService');
  computeAllSettlementBalances.mockRejectedValueOnce(new Error('settlement down'));
  setTables({ profiles: { data: [{ id: HOST, name: 'Asha' }], error: null, count: 1 } });
  const res = mockRes();

  await ctrl.listHosts({ query: {}, admin }, res);

  expect(res.json.mock.calls[0][0].hosts[0].revenue).toBe(0);
});

test('listHosts averages guest ratings per host and rounds to one decimal', async () => {
  const OTHER = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee';
  setTables({
    profiles: { data: [{ id: HOST, name: 'Asha' }, { id: OTHER, name: 'Ravi' }], error: null, count: 2 },
    reviews: { data: [
      { host_id: HOST, rating: 5 }, { host_id: HOST, rating: 4 }, { host_id: HOST, rating: 4 }, // 4.333 → 4.3
      { host_id: OTHER, rating: 3 },
    ], error: null },
  });
  const res = mockRes();

  await ctrl.listHosts({ query: {}, admin }, res);

  const hosts = res.json.mock.calls[0][0].hosts;
  expect(hosts.find(h => h.id === HOST)).toMatchObject({ rating: 4.3, reviews_count: 3 });
  expect(hosts.find(h => h.id === OTHER)).toMatchObject({ rating: 3, reviews_count: 1 });
  // Public rule: guest-facing reviews only, admin-hidden excluded.
  expect(chains.reviews.eq).toHaveBeenCalledWith('direction', 'guest_to_host');
  expect(chains.reviews.neq).toHaveBeenCalledWith('status', 'hidden');
});

test('listHosts reports rating null (not 0) for a host with no reviews', async () => {
  setTables({
    profiles: { data: [{ id: HOST, name: 'Asha' }], error: null, count: 1 },
    reviews: { data: [], error: null },
  });
  const res = mockRes();
  await ctrl.listHosts({ query: {}, admin }, res);
  expect(res.json.mock.calls[0][0].hosts[0]).toMatchObject({ rating: null, reviews_count: 0 });
});

test('listHosts exposes the contact + photo the directory renders', async () => {
  setTables({
    profiles: { data: [{ id: HOST, name: 'Asha', email: 'a@x.com', phone: null, whatsapp_number: '9876543210', profile_image: 'https://img/a.jpg' }], error: null, count: 1 },
  });
  const res = mockRes();
  await ctrl.listHosts({ query: {}, admin }, res);
  // phone falls back to the verified whatsapp number when phone is unset.
  expect(res.json.mock.calls[0][0].hosts[0]).toMatchObject({
    phone: '9876543210', email: 'a@x.com', profile_image: 'https://img/a.jpg',
  });
});

test('listHosts ignores a non-uuid account_manager_id filter', async () => {
  setTables({ profiles: { data: [], error: null, count: 0 } });
  await ctrl.listHosts({ query: { account_manager_id: 'nope' }, admin }, mockRes());
  expect(chains.profiles.eq).not.toHaveBeenCalledWith('account_manager_id', 'nope');
});

// ── account managers ────────────────────────────────────────────
test('createManager requires a name', async () => {
  const res = mockRes();
  await ctrl.createManager({ body: { email: 'x@y.com' }, admin }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('updateManager only writes allow-listed fields', async () => {
  setTables({ account_managers: { data: { id: AM, name: 'Ravi' }, error: null } });
  await ctrl.updateManager({ params: { id: AM }, body: { name: 'Ravi', is_active: false, id: 'hijack' }, admin }, mockRes());
  const updates = chains.account_managers.update.mock.calls[0][0];
  expect(updates).toMatchObject({ name: 'Ravi', is_active: false });
  expect(updates.id).toBeUndefined();
});
