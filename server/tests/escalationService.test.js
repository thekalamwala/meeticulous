'use strict';
// Pure-helper coverage for escalationService. Its heavy deps are mocked so we can load
// the module without env/DB — we only exercise the deterministic reference + OTP key.
jest.mock('../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../services/ai/anthropicClient', () => ({ isConfigured: () => false, getClient: () => null, MODELS: {} }));
jest.mock('../lib/botBudget', () => ({ tryConsume: async () => ({ allowed: false }) }));
jest.mock('../utils/otpStore', () => ({ generate: () => '000000', set: async () => ({ ok: true }), verify: async () => ({ valid: true }) }));
jest.mock('../utils/notify', () => ({ sendWhatsAppVerifyOtp: async () => true }));
jest.mock('../utils/sendEmail', () => async () => {});
jest.mock('../services/botService', () => ({ getRecentMessages: async () => [], redactPii: (s) => s }));

const svc = require('../services/bot/escalationService');

describe('escalationService.buildReference', () => {
  it('derives CHAT-<6 hex upper> from the conversation UUID', () => {
    expect(svc.buildReference('8f92abcd-1111-4111-8111-111111111111')).toBe('CHAT-8F92AB');
  });
  it('pads / falls back when the id is short or missing', () => {
    expect(svc.buildReference(null)).toBe('CHAT-000000');
    expect(svc.buildReference('ab')).toBe('CHAT-AB0000');
  });
  it('is deterministic for the same id', () => {
    const id = '12345678-1234-4123-8123-123456789012';
    expect(svc.buildReference(id)).toBe(svc.buildReference(id));
  });
});

describe('escalationService.otpKey', () => {
  it('namespaces + lowercases so bot OTPs never collide with booking/login codes', () => {
    expect(svc.otpKey('whatsapp', '919876543210')).toBe('bot:wa:919876543210');
    expect(svc.otpKey('email', 'A@B.com')).toBe('bot:em:a@b.com');
  });
});
