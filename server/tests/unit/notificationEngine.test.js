/**
 * tests/unit/notificationEngine.test.js
 * Notification engine unit tests — mocked Supabase, sendEmail and AiSensy.
 */

const mockTables = {
  notification_events: [],
  notification_providers: [],
  notification_logs: [],
  contacts: [],
};

jest.mock('../../config/supabase', () => {
  const admin = {
    from(table) {
      const rows = () => mockTables[table] || [];
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push([col, val]); return builder; },
        maybeSingle() {
          const match = rows().find((r) => filters.every(([c, v]) => r[c] === v));
          return Promise.resolve({ data: match || null, error: null });
        },
        insert(row) {
          (mockTables.notification_logs ||= []).push(row);
          return Promise.resolve({ error: null });
        },
        // Awaitable directly (loadConfig does `await from(t).select('*')`).
        then(resolve, reject) {
          return Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { supabaseAdmin: admin, supabase: admin };
});

// The email path now delegates to the Communication Engine (DB templates + queue).
jest.mock('../../services/email/communicationEngine', () => ({
  send: jest.fn().mockResolvedValue({ ok: true, status: 'queued', logId: 'log1' }),
}));
jest.mock('../../services/aisensyService', () => ({
  sendCampaign: jest.fn().mockResolvedValue({ success: true, response: { ok: true } }),
  testConnection: jest.fn(),
  // Mirror the real module's public API (the engine uses this to match the
  // AiSensy-normalized contacts.phone for the STOP opt-out check).
  normalizePhone: (p) => (p ? String(p).replace(/[^\d]/g, '') : null),
}));
// Admin alert fired on a WhatsApp send failure (surfaces silent template/credit breakage).
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));

const communicationEngine = require('../../services/email/communicationEngine');
const aisensy = require('../../services/aisensyService');
const { adminAlert } = require('../../utils/adminAlert');
const NotificationEngine = require('../../services/notificationEngine');

const CONFIRMED_EVENT = {
  event_key: 'BOOKING_CONFIRMED_CUSTOMER',
  whatsapp_enabled: true,
  email_enabled: true,
  campaign_name: 'booking_confirmation_user',
  email_subject: 'Booking confirmed',
  is_active: true,
};
const AISENSY_PROVIDER = { provider: 'aisensy', api_key: 'k-123', is_active: true, settings_json: {} };

describe('NotificationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTables.notification_events = [CONFIRMED_EVENT];
    mockTables.notification_providers = [AISENSY_PROVIDER];
    mockTables.notification_logs = [];
    mockTables.contacts = [];
    NotificationEngine.clearCache();
  });

  test('sends WhatsApp + email when both channels enabled', async () => {
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: {
        phone: '919876543210', name: 'Shubham',
        templateParams: ['Shubham', 'SEO Consultation', 'Meeticulous', '21/10 10:00'],
        email: 'guest@example.com', emailData: { service_name: 'SEO Consultation' },
      },
    });
    expect(result.whatsapp.success).toBe(true);
    expect(result.email.success).toBe(true);
    expect(adminAlert).not.toHaveBeenCalled(); // no alert on a successful send
    // Engine, not caller, resolves the campaign name from config
    expect(aisensy.sendCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ campaignName: 'booking_confirmation_user', apiKey: 'k-123' })
    );
    // Email delegated to the Communication Engine by event (no inline HTML)
    expect(communicationEngine.send).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'BOOKING_CONFIRMED_CUSTOMER', to: 'guest@example.com' })
    );
    // Both channels logged in notification_logs (cross-channel summary)
    expect(mockTables.notification_logs).toHaveLength(2);
    expect(mockTables.notification_logs.map((l) => l.channel).sort()).toEqual(['email', 'whatsapp']);
  });

  test('skips WhatsApp when event has whatsapp_enabled=false', async () => {
    mockTables.notification_events = [{ ...CONFIRMED_EVENT, whatsapp_enabled: false }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', email: 'a@b.com' },
    });
    expect(result.whatsapp.attempted).toBe(false);
    expect(aisensy.sendCampaign).not.toHaveBeenCalled();
    expect(result.email.success).toBe(true);
  });

  test('skips WhatsApp when provider is inactive', async () => {
    mockTables.notification_providers = [{ ...AISENSY_PROVIDER, is_active: false }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', email: 'a@b.com' },
    });
    expect(result.whatsapp.attempted).toBe(false);
  });

  test('skips email when event has email_enabled=false', async () => {
    mockTables.notification_events = [{ ...CONFIRMED_EVENT, email_enabled: false }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', email: 'a@b.com' },
    });
    expect(result.email.attempted).toBe(false);
    expect(communicationEngine.send).not.toHaveBeenCalled();
    expect(result.whatsapp.success).toBe(true);
  });

  test('inactive event sends nothing', async () => {
    mockTables.notification_events = [{ ...CONFIRMED_EVENT, is_active: false }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', email: 'a@b.com' },
    });
    expect(result.whatsapp.attempted).toBe(false);
    expect(result.email.attempted).toBe(false);
  });

  test('unknown event falls back to email-only defaults', async () => {
    const result = await NotificationEngine.send({
      event: 'SOME_FUTURE_EVENT',
      data: { phone: '919876543210', email: 'a@b.com' },
    });
    expect(result.whatsapp.attempted).toBe(false);
    expect(result.email.success).toBe(true);
  });

  test('logs a failed WhatsApp delivery with the error', async () => {
    aisensy.sendCampaign.mockResolvedValueOnce({ success: false, error: 'Template not found' });
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', name: 'X', templateParams: ['a'] },
    });
    expect(result.whatsapp.success).toBe(false);
    const log = mockTables.notification_logs.find((l) => l.channel === 'whatsapp');
    expect(log.status).toBe('failed');
    expect(log.error).toBe('Template not found');
    // A failed WhatsApp send raises a throttled admin alert keyed by event.
    expect(adminAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'wa_fail:BOOKING_CONFIRMED_CUSTOMER' })
    );
  });

  test('skips WhatsApp for a STOP-suppressed contact but still emails (P1-06)', async () => {
    mockTables.contacts = [{ phone: '919876543210', whatsapp_suppressed: true }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { phone: '919876543210', name: 'X', templateParams: ['a'], email: 'a@b.com' },
    });
    expect(aisensy.sendCampaign).not.toHaveBeenCalled();
    expect(result.whatsapp.suppressed).toBe(true);
    expect(result.email.success).toBe(true);
    const waLog = mockTables.notification_logs.find((l) => l.channel === 'whatsapp');
    expect(waLog.status).toBe('suppressed');
    expect(adminAlert).not.toHaveBeenCalled(); // opt-out is not a failure
  });

  test('still sends OTP over WhatsApp for a suppressed contact (exempt event, P1-06)', async () => {
    mockTables.notification_events = [{ ...CONFIRMED_EVENT, event_key: 'BOOKING_OTP', campaign_name: 'otp' }];
    mockTables.contacts = [{ phone: '919876543210', whatsapp_suppressed: true }];
    const result = await NotificationEngine.send({
      event: 'BOOKING_OTP',
      data: { phone: '919876543210', name: 'X', templateParams: ['123456'] },
    });
    expect(aisensy.sendCampaign).toHaveBeenCalled();
    expect(result.whatsapp.success).toBe(true);
  });

  test('email failure from the engine is captured, not thrown', async () => {
    communicationEngine.send.mockResolvedValueOnce({ ok: false, status: 'failed', error: 'no_template' });
    const result = await NotificationEngine.send({
      event: 'BOOKING_CONFIRMED_CUSTOMER',
      data: { email: 'a@b.com' },
    });
    expect(result.email.success).toBe(false);
    expect(result.email.error).toBe('no_template');
  });

  test('forwards inferred vendor audience to the communication engine (_VENDOR event)', async () => {
    mockTables.notification_events = [{ ...CONFIRMED_EVENT, event_key: 'BOOKING_CONFIRMED_VENDOR' }];
    await NotificationEngine.send({ event: 'BOOKING_CONFIRMED_VENDOR', data: { email: 'host@x.com' } });
    expect(communicationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ audience: 'vendor' }));
  });

  test('explicit data.audience overrides inference', async () => {
    await NotificationEngine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', data: { email: 'a@b.com', audience: 'vendor' } });
    expect(communicationEngine.send).toHaveBeenCalledWith(expect.objectContaining({ audience: 'vendor' }));
  });
});

describe('NotificationEngine.inferAudience', () => {
  const { inferAudience } = NotificationEngine;
  test('explicit wins', () => expect(inferAudience('BOOKING_CONFIRMED_CUSTOMER', 'vendor')).toBe('vendor'));
  test('_VENDOR suffix → vendor', () => expect(inferAudience('BOOKING_REMINDER_VENDOR')).toBe('vendor'));
  test('_CUSTOMER suffix → customer', () => expect(inferAudience('BOOKING_REMINDER_CUSTOMER')).toBe('customer'));
  test('vendor-lifecycle event → vendor', () => {
    expect(inferAudience('VENDOR_WELCOME')).toBe('vendor');
    expect(inferAudience('PROFILE_VERIFIED')).toBe('vendor');
    expect(inferAudience('SUBSCRIPTION_PURCHASED')).toBe('vendor');
  });
  test('auth/security/generic → all (customer shell)', () => {
    expect(inferAudience('BOOKING_OTP')).toBe('all');
    expect(inferAudience('PASSWORD_RESET')).toBe('all');
    expect(inferAudience('SECURITY_PASSWORD_CHANGED')).toBe('all');
  });
});
