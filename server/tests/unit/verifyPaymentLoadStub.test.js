'use strict';
/**
 * signatureValid() — the Razorpay signature gate is bypassed only under
 * LOAD_TEST_MODE (off by default, never in prod) so JMeter can exercise the
 * payment-verify path without a real client-side checkout.
 *
 * Mock preamble mirrors verifySubscription.test.js so paymentController imports.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn() }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: String(e && e.message || e) }) }));
jest.mock('../../utils/razorpaySignature', () => ({ verifySignature: jest.fn() }));
jest.mock('../../services/razorpayConfig', () => ({ getKeySecret: jest.fn(), getClient: jest.fn(), getWebhookSecret: jest.fn() }));
jest.mock('../../services/planService', () => ({ normalizeSlug: (s) => (s || '').toLowerCase(), isFreeSlug: (s) => ['starter','explorer','free','starter_legacy'].includes((s || '').toLowerCase().trim()), getPlan: jest.fn() }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ getClient: jest.fn() }));
jest.mock('../../services/subscriptionService', () => ({ activateFromSubscription: jest.fn() }));
jest.mock('../../services/ledger/journalTemplates', () => ({ subscriptionPaymentEntry: jest.fn(() => ({ lines: [] })), orderPaymentEntry: jest.fn(() => ({ lines: [] })) }));
jest.mock('../../services/ledger/postingService', () => ({ postSafe: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/sendEmail', () => jest.fn());
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn() }));
jest.mock('../../config/google', () => ({ createCalendarEvent: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: jest.fn((v) => v) }));

const { verifySignature } = require('../../utils/razorpaySignature');
const { signatureValid } = require('../../controllers/paymentController');

describe('signatureValid (Razorpay gate, LOAD_TEST_MODE bypass)', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; jest.clearAllMocks(); });
  afterAll(() => { process.env = OLD; });

  test('flag OFF: delegates to verifySignature (false stays false)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    verifySignature.mockReturnValue(false);
    expect(signatureValid('o', 'p', 's', 'k')).toBe(false);
    expect(verifySignature).toHaveBeenCalledWith('o', 'p', 's', 'k');
  });

  test('flag OFF: delegates to verifySignature (true stays true)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    verifySignature.mockReturnValue(true);
    expect(signatureValid('o', 'p', 's', 'k')).toBe(true);
  });

  test('flag ON: always valid, verifySignature NOT called', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    verifySignature.mockReturnValue(false);
    expect(signatureValid('o', 'p', 's', 'k')).toBe(true);
    expect(verifySignature).not.toHaveBeenCalled();
  });

  test('production fail-safe: flag ignored, delegates (false stays false)', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOAD_TEST_MODE = 'true';
    verifySignature.mockReturnValue(false);
    expect(signatureValid('o', 'p', 's', 'k')).toBe(false);
  });
});
