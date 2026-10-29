'use strict';
/**
 * kycController — host-facing KYC. The guarantees under test are the security
 * ones stated in the controller header: PII is encrypted at rest, never returned
 * raw, documents are magic-byte sniffed, and a host can only attach keys they
 * themselves uploaded.
 *
 * kycCrypto is NOT mocked — real AES round-trips are the point (it falls back to
 * a dev key when KYC_ENCRYPTION_KEY is unset, so this runs anywhere).
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock('../../utils/httpError', () => ({
  safeError: (res, e, code = 500, msg) => res.status(code).json({ message: msg || e.message }),
}));
// Autopilot off by default → existing tests exercise the manual 'pending' path.
jest.mock('../../services/kycOnboarding', () => ({
  isAutopilot: jest.fn(() => Promise.resolve(false)),
  onKycApproved: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { encrypt, decrypt } = require('../../utils/kycCrypto');
const ctrl = require('../../controllers/kycController');
const { isAutopilot, onKycApproved } = require('../../services/kycOnboarding');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const USER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

// from('kyc_submissions'): .select().eq().maybeSingle() for reads, .upsert() for writes.
const tableChain = (row) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve({ data: row, error: null }));
  c.upsert = jest.fn(() => Promise.resolve({ error: null }));
  return c;
};
const storageChain = () => {
  const c = {};
  c.upload = jest.fn(() => Promise.resolve({ error: null }));
  return c;
};

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(64)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64)]); // not on the allow-list

const validBody = () => ({
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '9876543210',
  pan_number: 'ABCDE1234F',
  aadhaar_number: '123412341234',
  holder_name: 'Asha Rao',
  bank_name: 'HDFC',
  account_number: '123456789012',
  ifsc: 'HDFC0001234',
  branch: 'Indiranagar',
  account_type: 'savings',
  addr_street1: '1 MG Road',
  addr_street2: 'Indiranagar',
  addr_city: 'Bengaluru',
  addr_state: 'Karnataka',
  addr_postal_code: '560001',
  selfie_url: `${USER}/selfie_1.jpg`,
  pan_doc_url: `${USER}/pan_1.jpg`,
  aadhaar_doc_url: `${USER}/aadhaar_1.pdf`,
});

beforeEach(() => jest.clearAllMocks());

// ── submitKyc: encryption at rest ───────────────────────────────
test('submitKyc encrypts PAN/Aadhaar/account and stores no plaintext', async () => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  const res = mockRes();

  await ctrl.submitKyc({ user: { id: USER }, body: validBody() }, res);

  expect(res.status).toHaveBeenCalledWith(201);
  const [payload] = chain.upsert.mock.calls[0];
  // Round-trips back to the original value...
  expect(decrypt(payload.pan_number)).toBe('ABCDE1234F');
  expect(decrypt(payload.aadhaar_number)).toBe('123412341234');
  expect(decrypt(payload.account_number)).toBe('123456789012');
  // ...but the stored blob is not the plaintext.
  const stored = JSON.stringify(payload);
  expect(stored).not.toContain('ABCDE1234F');
  expect(stored).not.toContain('123412341234');
  expect(stored).not.toContain('123456789012');
  expect(payload.status).toBe('pending');
});

test('submitKyc upserts on user_id so re-submission returns to pending', async () => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  await ctrl.submitKyc({ user: { id: USER }, body: validBody() }, mockRes());
  expect(chain.upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
});

test('autopilot: submitKyc auto-approves + kicks off onboarding, returns approved', async () => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  isAutopilot.mockResolvedValueOnce(true);
  const res = mockRes();

  await ctrl.submitKyc({ user: { id: USER }, body: validBody() }, res);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json.mock.calls[0][0]).toEqual({ status: 'approved' });
  const [payload] = chain.upsert.mock.calls[0];
  expect(payload.status).toBe('approved');
  expect(payload.reviewed_at).toBeTruthy();
  expect(onKycApproved).toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));
});

// ── submitKyc: validation ───────────────────────────────────────
test.each([
  ['pan_number', 'ABC123', 'PAN must match ABCDE1234F.'],
  ['aadhaar_number', '1234', 'Aadhaar must be 12 digits.'],
  ['ifsc', 'BAD', 'IFSC must match ABCD0123456.'],
  ['email', 'not-an-email', 'Valid email is required.'],
  ['phone', '123', 'Valid phone number is required.'],
  ['account_type', 'crypto', 'Account type must be savings or current.'],
])('submitKyc rejects a bad %s with 400', async (field, value, message) => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  const res = mockRes();

  await ctrl.submitKyc({ user: { id: USER }, body: { ...validBody(), [field]: value } }, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].errors).toContain(message);
  expect(chain.upsert).not.toHaveBeenCalled();
});

test('submitKyc refuses document keys belonging to another user', async () => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  const res = mockRes();
  const body = { ...validBody(), pan_doc_url: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb/pan_1.jpg' };

  await ctrl.submitKyc({ user: { id: USER }, body }, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].errors).toContain('Invalid document reference.');
  expect(chain.upsert).not.toHaveBeenCalled();
});

test('submitKyc succeeds with NO documents and no Aadhaar (lean KYC)', async () => {
  const chain = tableChain(null);
  supabaseAdmin.from.mockReturnValue(chain);
  const res = mockRes();
  const b = { ...validBody() };
  delete b.aadhaar_number; delete b.selfie_url; delete b.pan_doc_url; delete b.aadhaar_doc_url;

  await ctrl.submitKyc({ user: { id: USER }, body: b }, res);

  expect(res.status).toHaveBeenCalledWith(201);
  const [payload] = chain.upsert.mock.calls[0];
  expect(payload.aadhaar_number).toBeNull();
  expect(payload.selfie_url).toBeNull();
});

// ── getMyKyc: masked reads only ─────────────────────────────────
test('getMyKyc masks PII and never returns raw values or storage keys', async () => {
  supabaseAdmin.from.mockReturnValue(tableChain({
    status: 'approved',
    full_name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '9876543210',
    pan_number: encrypt('ABCDE1234F'),
    aadhaar_number: encrypt('123412341234'),
    account_number: encrypt('123456789012'),
    ifsc: 'HDFC0001234',
    selfie_url: `${USER}/selfie_1.jpg`,
    pan_doc_url: `${USER}/pan_1.jpg`,
    aadhaar_doc_url: null,
  }));
  const res = mockRes();

  await ctrl.getMyKyc({ user: { id: USER } }, res);

  const out = res.json.mock.calls[0][0];
  expect(out.pan_number).toBe('XXXXXX234F');
  expect(out.aadhaar_number).toBe('XXXXXXXX1234');
  expect(out.account_number).toBe('XXXXXX9012');
  expect(out.phone).toBe('XXXXXX3210');
  // Presence booleans instead of the private-bucket keys.
  expect(out).toMatchObject({ has_selfie: true, has_pan_doc: true, has_aadhaar_doc: false });
  expect(JSON.stringify(out)).not.toContain('selfie_1.jpg');
});

test('getMyKyc returns not_started (with earnings signal) when the host has no submission', async () => {
  supabaseAdmin.from.mockReturnValue(tableChain(null));
  const res = mockRes();
  await ctrl.getMyKyc({ user: { id: USER } }, res);
  // Deferred KYC: not_started still carries pending_earnings + payouts_ready so a
  // host who earned before starting KYC gets the dashboard nudge.
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'not_started', payouts_ready: false }));
});

// ── uploadKycFile: magic-byte sniffing ──────────────────────────
test('uploadKycFile keys the object under the caller id and trusts magic bytes, not mimetype', async () => {
  const store = storageChain();
  supabaseAdmin.storage.from.mockReturnValue(store);
  const res = mockRes();

  // Client claims PDF; the bytes are a real PNG. The sniffed type wins.
  await ctrl.uploadKycFile(
    { user: { id: USER }, query: { type: 'pan' }, file: { size: 100, buffer: PNG, mimetype: 'application/pdf' } },
    res,
  );

  const key = res.json.mock.calls[0][0].key;
  expect(key.startsWith(`${USER}/pan_`)).toBe(true);
  expect(key.endsWith('.png')).toBe(true);
  expect(store.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png', contentDisposition: 'attachment' });
});

test('uploadKycFile rejects a disallowed file type', async () => {
  const store = storageChain();
  supabaseAdmin.storage.from.mockReturnValue(store);
  const res = mockRes();

  await ctrl.uploadKycFile(
    { user: { id: USER }, query: { type: 'pan' }, file: { size: 100, buffer: GIF, mimetype: 'image/png' } },
    res,
  );

  expect(res.status).toHaveBeenCalledWith(400);
  expect(store.upload).not.toHaveBeenCalled();
});

test('uploadKycFile allows PDF for documents but not for the selfie', async () => {
  const store = storageChain();
  supabaseAdmin.storage.from.mockReturnValue(store);

  const ok = mockRes();
  await ctrl.uploadKycFile({ user: { id: USER }, query: { type: 'aadhaar' }, file: { size: 100, buffer: PDF } }, ok);
  expect(ok.json.mock.calls[0][0].key.endsWith('.pdf')).toBe(true);

  const bad = mockRes();
  await ctrl.uploadKycFile({ user: { id: USER }, query: { type: 'selfie' }, file: { size: 100, buffer: PDF } }, bad);
  expect(bad.status).toHaveBeenCalledWith(400);
  expect(store.upload).toHaveBeenCalledTimes(1); // only the aadhaar one
});

test('uploadKycFile rejects an unknown document type and oversized files', async () => {
  const store = storageChain();
  supabaseAdmin.storage.from.mockReturnValue(store);

  const badType = mockRes();
  await ctrl.uploadKycFile({ user: { id: USER }, query: { type: 'passport' }, file: { size: 100, buffer: JPEG } }, badType);
  expect(badType.status).toHaveBeenCalledWith(400);

  const tooBig = mockRes();
  await ctrl.uploadKycFile(
    { user: { id: USER }, query: { type: 'selfie' }, file: { size: 6 * 1024 * 1024, buffer: JPEG } },
    tooBig,
  );
  expect(tooBig.status).toHaveBeenCalledWith(400);
  expect(store.upload).not.toHaveBeenCalled();
});

test('uploadKycFile requires a file', async () => {
  const res = mockRes();
  await ctrl.uploadKycFile({ user: { id: USER }, query: { type: 'selfie' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});
