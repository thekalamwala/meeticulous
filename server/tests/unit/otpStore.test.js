/**
 * tests/unit/otpStore.test.js
 * Secure OTP store unit tests — fully mocked Supabase, no real DB or .env.
 *
 * v1.9 security model under test:
 *   - bcrypt hash (no plaintext stored)
 *   - 10 min expiry, single use
 *   - max 3 verify attempts → 15 min lockout
 *   - max 3 sends/hour → 15 min lockout
 */

jest.mock('../../config/supabase', () => {
  const _store = new Map();

  const admin = {
    _store,

    from(_table) {
      return {
        upsert(data) {
          const prev = _store.get(data.email) || {};
          _store.set(data.email, { ...prev, ...data });
          return Promise.resolve({ error: null });
        },

        update(changes) {
          // Supports chained .eq().eq() (AND across all filters), like the real
          // PostgREST filter builder. Applies on await (thenable).
          const filters = {};
          const apply = () => {
            for (const [k, v] of _store.entries()) {
              if (Object.entries(filters).every(([fc, fv]) => v[fc] === fv)) _store.set(k, { ...v, ...changes });
            }
            return { error: null };
          };
          const chain = {
            eq(col, val) { filters[col] = val; return chain; },
            then(resolve) { resolve(apply()); },
          };
          return chain;
        },

        select(_cols) {
          const filters = {};
          const builder = {
            eq(col, val)  { filters[col] = val; return builder; },
            order()       { return builder; },
            limit()       { return builder; },
            maybeSingle() {
              const record = _store.get(filters.email);
              return Promise.resolve({ data: record ? { ...record } : null, error: null });
            },
            single() {
              const record = _store.get(filters.email);
              if (!record) return Promise.resolve({ data: null, error: { message: 'not found' } });
              return Promise.resolve({ data: { ...record }, error: null });
            },
          };
          return builder;
        },

        delete() {
          // .eq() chains (AND) and applies on await; .lt().or()/.then() kept for cleanup.
          const filters = {};
          const applyEq = () => {
            for (const [k, v] of _store.entries()) {
              if (Object.entries(filters).every(([fc, fv]) => v[fc] === fv)) _store.delete(k);
            }
            return { error: null };
          };
          const delBuilder = {
            eq(col, val) { filters[col] = val; return delBuilder; },
            then(resolve) { resolve(applyEq()); },
            lt(col, val) {
              const ltChain = {
                or() {
                  for (const [k, v] of _store.entries()) {
                    if (v[col] < val) _store.delete(k);
                  }
                  return Promise.resolve({ error: null });
                },
                then(resolve) {
                  for (const [k, v] of _store.entries()) {
                    if (v[col] < val) _store.delete(k);
                  }
                  resolve({ error: null });
                },
              };
              return ltChain;
            },
          };
          return delBuilder;
        },
      };
    },
  };

  return { supabaseAdmin: admin, supabase: admin };
});

const { supabaseAdmin } = require('../../config/supabase');
const { set, verify, cleanup, generate } = require('../../utils/otpStore');

describe('otpStore (secure)', () => {
  const EMAIL = 'test@example.com';
  const OTP   = '123456';

  beforeEach(() => {
    supabaseAdmin._store.clear();
  });

  test('generate produces a 6-digit code', () => {
    const otp = generate();
    expect(otp).toMatch(/^\d{6}$/);
  });

  test('stores OTP and verifies it successfully', async () => {
    const r = await set(EMAIL, OTP);
    expect(r.ok).toBe(true);
    const result = await verify(EMAIL, OTP);
    expect(result.valid).toBe(true);
  });

  test('never stores the plaintext OTP', async () => {
    await set(EMAIL, OTP);
    const record = supabaseAdmin._store.get(EMAIL);
    expect(record.otp).toBe('');
    expect(record.otp_hash).toBeTruthy();
    expect(record.otp_hash).not.toContain(OTP);
  });

  test('is case-insensitive on email normalisation', async () => {
    await set('TEST@Example.COM', OTP);
    const result = await verify('test@example.com', OTP);
    expect(result.valid).toBe(true);
  });

  test('returns invalid for wrong OTP and counts attempts', async () => {
    await set(EMAIL, OTP);
    const result = await verify(EMAIL, '000000');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid/i);
    expect(supabaseAdmin._store.get(EMAIL).attempts).toBe(1);
  });

  test('locks out after 3 failed attempts', async () => {
    await set(EMAIL, OTP);
    await verify(EMAIL, '000000');
    await verify(EMAIL, '000001');
    const third = await verify(EMAIL, '000002');
    expect(third.valid).toBe(false);
    expect(third.reason).toMatch(/too many/i);
    // Even the correct OTP is now rejected
    const correct = await verify(EMAIL, OTP);
    expect(correct.valid).toBe(false);
    expect(correct.reason).toMatch(/try again/i);
  });

  test('rate limits to 3 sends per hour with 15-min lockout', async () => {
    expect((await set(EMAIL, OTP)).ok).toBe(true);
    expect((await set(EMAIL, OTP)).ok).toBe(true);
    expect((await set(EMAIL, OTP)).ok).toBe(true);
    const fourth = await set(EMAIL, OTP);
    expect(fourth.ok).toBe(false);
    expect(fourth.reason).toMatch(/too many/i);
  });

  test('send counter resets after the 1-hour window', async () => {
    await set(EMAIL, OTP); await set(EMAIL, OTP); await set(EMAIL, OTP);
    const realNow = Date.now;
    Date.now = () => realNow() + 61 * 60 * 1000;
    const again = await set(EMAIL, OTP);
    Date.now = realNow;
    expect(again.ok).toBe(true);
  });

  test('returns invalid when no OTP has been set', async () => {
    const result = await verify('nobody@example.com', '999999');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no otp/i);
  });

  test('is single-use: second verify fails', async () => {
    await set(EMAIL, OTP);
    await verify(EMAIL, OTP);
    const second = await verify(EMAIL, OTP);
    expect(second.valid).toBe(false);
  });

  test('overwrites previous OTP when set is called again', async () => {
    await set(EMAIL, '111111');
    await set(EMAIL, '222222');
    const old = await verify(EMAIL, '111111');
    expect(old.valid).toBe(false);
    const fresh = await verify(EMAIL, '222222');
    expect(fresh.valid).toBe(true);
  });

  test('expires after TTL (mocked Date.now)', async () => {
    await set(EMAIL, OTP);
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60 * 1000;
    const result = await verify(EMAIL, OTP);
    Date.now = realNow;
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  test('cleanup removes expired entries', async () => {
    await set(EMAIL, OTP);
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60 * 1000;
    await cleanup();
    Date.now = realNow;
    const result = await verify(EMAIL, OTP);
    expect(result.valid).toBe(false);
  });

  test('cleanup does not remove valid entries', async () => {
    await set(EMAIL, OTP);
    await cleanup();
    const result = await verify(EMAIL, OTP);
    expect(result.valid).toBe(true);
  });

  // Security audit M-2: a code is bound to the purpose it was issued for. A
  // password-reset code must not be redeemable on the booking/login path.
  test('rejects a code whose type does not match the expected purpose', async () => {
    await set(EMAIL, OTP);                                  // stored as type 'booking'
    supabaseAdmin._store.get(EMAIL).type = 'password_reset'; // becomes a reset code
    const asBooking = await verify(EMAIL, OTP);             // default expectedType 'booking'
    expect(asBooking.valid).toBe(false);
    expect(asBooking.reason).toMatch(/no otp/i);
    // Still valid when the caller expects that purpose.
    const asReset = await verify(EMAIL, OTP, 'password_reset');
    expect(asReset.valid).toBe(true);
  });
});
