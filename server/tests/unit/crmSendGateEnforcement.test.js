'use strict';
/**
 * PR-8 closing proof: "sends ON" can never mean "uncapped / ungated".
 *
 * Before flipping crm_admin_sends on, lock the end-to-end invariant that BOTH CRM
 * send primitives (emailService.send / whatsappService.send) actually reach the
 * provider ONLY when the full gate chain allows it — and skip WITHOUT touching the
 * provider on kill-switch off, do-not-contact, opt-out, or a governor cap — even with
 * the master flag ON. Leaf providers (sendEmail / aisensy.sendCampaign) are mocked;
 * the real sendGate + touchGovernor delegation runs.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/crm/touchGovernor', () => ({ canTouch: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../utils/sendEmail', () => jest.fn(async () => ({ success: true, id: 'em1' })));
jest.mock('../../services/aisensyService', () => ({
  sendCampaign: jest.fn(async () => ({ success: true, response: { submitted_message_id: 'wa1' } })),
  normalizePhone: (p) => (p ? String(p) : null),
}));
// Email branding deps (fail-open in emailService); stub to keep the chain DB-free.
jest.mock('../../services/email/communicationEngine', () => ({ loadSettings: jest.fn(async () => ({})) }));
jest.mock('../../services/email/emailLayout', () => ({ renderLayout: ({ bodyHtml }) => bodyHtml }));
jest.mock('../../services/email/unsubscribeToken', () => ({ makeToken: () => 'tok' }));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const governor = require('../../services/crm/touchGovernor');
const sendEmail = require('../../utils/sendEmail');
const aisensy = require('../../services/aisensyService');
const emailService = require('../../services/crm/emailService');
const whatsappService = require('../../services/crm/whatsappService');

const chain = (result) => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }) });
const emailLead = { id: 'L1', email: 'a@b.com' };
const waLead = { id: 'L1', phone: '9876543210' };

beforeEach(() => {
  jest.clearAllMocks();
  featureFlags.isFeatureEnabled.mockResolvedValue(true);   // master flag ON for the whole file
  governor.canTouch.mockResolvedValue({ ok: true });
  supabaseAdmin.from.mockImplementation((t) =>
    t === 'notification_providers'
      ? chain({ data: { api_key: 'k', is_active: true } })   // WhatsApp provider configured
      : chain({ data: null }));                              // email_unsubscribes / contacts → no opt-out
  whatsappService._clearKeyCache();
});
afterEach(() => jest.useRealTimers());

describe('sends ON + clean subject → the provider IS reached', () => {
  test('email sends exactly once', async () => {
    const r = await emailService.send({ lead: emailLead, subject: 'Hi', html: '<p>x</p>' });
    expect(r.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('whatsapp sends exactly once', async () => {
    const r = await whatsappService.send({ lead: waLead, templateKey: 'camp1' });
    expect(r.success).toBe(true);
    expect(aisensy.sendCampaign).toHaveBeenCalledTimes(1);
  });
});

describe('sends ON but the gate blocks → the provider is NEVER reached', () => {
  test('kill-switch OFF still blocks (fail-closed master gate)', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(false);
    const r = await emailService.send({ lead: emailLead, subject: 'Hi', html: '<p>x</p>' });
    expect(r).toMatchObject({ skipped: true, reason: 'sends_disabled' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('do_not_contact is skipped', async () => {
    const r = await emailService.send({ lead: { ...emailLead, do_not_contact: true }, subject: 'Hi', html: '<p>x</p>' });
    expect(r).toMatchObject({ skipped: true, reason: 'do_not_contact' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('an email opt-out is skipped', async () => {
    supabaseAdmin.from.mockImplementation((t) =>
      t === 'email_unsubscribes' ? chain({ data: { email: 'a@b.com' } }) : chain({ data: null }));
    const r = await emailService.send({ lead: emailLead, subject: 'Hi', html: '<p>x</p>' });
    expect(r).toMatchObject({ skipped: true, reason: 'email_unsubscribed' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('a governor cap defers an automated send — the cap holds even with sends ON', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T06:30:00Z')); // 12:00 IST — inside the send window
    governor.canTouch.mockResolvedValue({ ok: false, reason: 'frequency_capped' });
    const r = await whatsappService.send({ lead: waLead, templateKey: 'camp1', automated: true });
    expect(r).toMatchObject({ skipped: true, defer: true, reason: 'frequency_capped' });
    expect(aisensy.sendCampaign).not.toHaveBeenCalled();
  });
});
