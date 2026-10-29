'use strict';
/**
 * Public product resolver + lost-link resend.
 *   - getProductPublic resolves by (username, slug) and falls back to id, and
 *     attaches a server-computed platform_fee.
 *   - resendDownloadLink is OTP-gated and oracle-safe: a bad/absent code is
 *     rejected the same way whether or not a purchase exists for the email.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: String((e && e.message) || e) }) }));
jest.mock('../../utils/otpStore', () => ({ verify: jest.fn() }));
jest.mock('../../utils/productEmail', () => ({ sendProductDownloadEmail: jest.fn() }));
jest.mock('../../utils/background', () => ({ runInBackground: (label, fn) => { fn(); } }));

const { supabaseAdmin } = require('../../config/supabase');
const otpStore = require('../../utils/otpStore');
const { sendProductDownloadEmail } = require('../../utils/productEmail');
const { getProductPublic, resendDownloadLink } = require('../../controllers/productController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

const PRODUCT = { id: 'prod_1', title: 'Guide', price: 199, slug: 'guide', profiles: { name: 'John', username: 'john' } };
const hostChain = (data) => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data }) }) }) });
const productMaybe = (data) => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data }) }) }) }) }) });

describe('getProductPublic — slug then id', () => {
  test('resolves by slug and attaches platform_fee', async () => {
    supabaseAdmin.from.mockImplementation((t) => {
      if (t === 'profiles') return hostChain({ id: 'h1' });
      if (t === 'products') return productMaybe(PRODUCT);
      throw new Error(t);
    });
    const r = res();
    await getProductPublic({ params: { username: 'john', key: 'guide' } }, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod_1', platform_fee: 10 }));
  });

  test('falls back to id lookup when the key is a UUID and no slug matches', async () => {
    let pc = 0;
    supabaseAdmin.from.mockImplementation((t) => {
      if (t === 'profiles') return hostChain({ id: 'h1' });
      if (t === 'products') { pc += 1; return productMaybe(pc === 1 ? null : PRODUCT); }
      throw new Error(t);
    });
    const r = res();
    await getProductPublic({ params: { username: 'john', key: '11111111-1111-1111-1111-111111111111' } }, r);
    expect(pc).toBe(2); // slug miss, then id fallback
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod_1' }));
  });

  test('404 when the host does not exist', async () => {
    supabaseAdmin.from.mockImplementation(() => hostChain(null));
    const r = res();
    await getProductPublic({ params: { username: 'ghost', key: 'guide' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

describe('resendDownloadLink — OTP gate + no oracle', () => {
  const purchaseLookup = (data) => ({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data }) }) }) }) }) }) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  });

  test('rejects a malformed email', async () => {
    const r = res();
    await resendDownloadLink({ body: { product_id: 'prod_1', buyer_email: 'nope', otp: '123456' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(otpStore.verify).not.toHaveBeenCalled();
  });

  test('bad OTP is rejected even though a purchase exists (no oracle)', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid or expired code' });
    supabaseAdmin.from.mockImplementation(() => purchaseLookup({ id: 'pp1', buyer_id: null }));
    const r = res();
    await resendDownloadLink({ body: { product_id: 'prod_1', buyer_email: 'b@x.com', otp: '000000' } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(sendProductDownloadEmail).not.toHaveBeenCalled();
  });

  test('valid OTP + existing purchase re-mints token and emails the link', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    supabaseAdmin.from.mockImplementation((t) => {
      if (t === 'product_purchases') return purchaseLookup({ id: 'pp1', buyer_id: null });
      if (t === 'products') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'prod_1', title: 'Guide', file_url: 'https://cdn/x.pdf', profiles: { username: 'john', name: 'John' } } }) }) }) };
      throw new Error(t);
    });
    const r = res();
    await resendDownloadLink({ body: { product_id: 'prod_1', buyer_email: 'b@x.com', otp: '123456' } }, r);
    expect(sendProductDownloadEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@x.com', productId: 'prod_1' }));
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ download_token: expect.any(String) }));
  });

  test('valid OTP but no purchase returns the generic message, no token', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    supabaseAdmin.from.mockImplementation(() => purchaseLookup(null));
    const r = res();
    await resendDownloadLink({ body: { product_id: 'prod_1', buyer_email: 'b@x.com', otp: '123456' } }, r);
    const payload = r.json.mock.calls[0][0];
    expect(payload.download_token).toBeUndefined();
    expect(payload.message).toMatch(/if a purchase exists/i);
  });
});
