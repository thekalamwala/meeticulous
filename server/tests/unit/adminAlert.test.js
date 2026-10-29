// Unit tests for the best-effort operational alert helper.
// sendEmail and logger are mocked so nothing leaves the process.
//
// adminAlert reads ADMIN_ALERT_EMAIL at module load, so each test loads the
// module fresh (jest.resetModules) with the env it needs — and grabs the mock
// instances from that same fresh module registry so identities line up.

jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(undefined));
jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const OLD_ENV = process.env;

function loadFresh(env = {}) {
  jest.resetModules();
  process.env = { ...OLD_ENV, ...env };
  const sendEmail = require('../../utils/sendEmail');
  const { logger } = require('../../utils/logger');
  const { adminAlert } = require('../../utils/adminAlert');
  return { adminAlert, sendEmail, logger };
}

afterAll(() => { process.env = OLD_ENV; });

describe('adminAlert', () => {
  test('sends an email when a recipient is configured', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    const r = await adminAlert({ subject: 'Test alert', lines: ['line one', 'line two'] });

    expect(r).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe('founder@example.com');
    expect(arg.subject).toBe('[Book A Sloth] Test alert');
    expect(arg.html).toContain('line one');
    expect(arg.html).toContain('line two');
  });

  test('no-ops (no throw) when no recipient is configured', async () => {
    const { adminAlert, sendEmail } = loadFresh({
      ADMIN_ALERT_EMAIL: '', SUPER_ADMIN_EMAIL: '', SMTP_USER: '',
    });
    const r = await adminAlert({ subject: 'Test alert' });

    expect(r).toEqual({ sent: false, reason: 'no_recipient' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('falls back to SUPER_ADMIN_EMAIL then SMTP_USER for the recipient', async () => {
    const { adminAlert, sendEmail } = loadFresh({
      ADMIN_ALERT_EMAIL: '', SUPER_ADMIN_EMAIL: '', SMTP_USER: 'smtp@example.com',
    });
    await adminAlert({ subject: 'Test alert' });
    expect(sendEmail.mock.calls[0][0].to).toBe('smtp@example.com');
  });

  test('throttles repeated alerts with the same key within the cooldown', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });

    const first = await adminAlert({ key: 'webhook_error:payment.captured', subject: 'A' });
    const second = await adminAlert({ key: 'webhook_error:payment.captured', subject: 'A' });

    expect(first).toEqual({ sent: true });
    expect(second).toEqual({ sent: false, reason: 'throttled' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('does not throttle different keys', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });

    await adminAlert({ key: 'k1', subject: 'A' });
    await adminAlert({ key: 'k2', subject: 'B' });

    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  test('never throws when sendEmail rejects; logs and returns send_error', async () => {
    const { adminAlert, sendEmail, logger } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const r = await adminAlert({ key: 'unique-fail', subject: 'Boom' });

    expect(r).toEqual({ sent: false, reason: 'send_error' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('HTML-escapes body lines to avoid markup injection', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    await adminAlert({ key: 'esc', subject: 'X', lines: ['<script>alert(1)</script>'] });

    const html = sendEmail.mock.calls[0][0].html;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  test('sends one email per recipient for a comma-separated list', async () => {
    const { adminAlert, sendEmail } = loadFresh({
      ADMIN_ALERT_EMAIL: 'bolt@bookasloth.in, sndatarkar@gmail.com',
    });
    const r = await adminAlert({ key: 'multi', subject: 'New host' });

    expect(r).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(
      ['bolt@bookasloth.in', 'sndatarkar@gmail.com']);
  });

  test('renders a Review button when a link is passed', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    await adminAlert({ key: 'lnk', subject: 'X', link: 'https://bookasloth.com/admin/kyc/pending' });

    const html = sendEmail.mock.calls[0][0].html;
    expect(html).toContain('href="https://bookasloth.com/admin/kyc/pending"');
    expect(html).toContain('Open in admin');
  });

  test('sends a text/plain twin alongside the html (inbox-placement signal)', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    await adminAlert({ key: 'txt', subject: 'New subscription', lines: ['Eureka', 'Amount: ₹270'], link: 'https://bookasloth.com/admin/host360/x' });

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.text).toContain('New subscription');
    expect(arg.text).toContain('Eureka');
    expect(arg.text).toContain('Open: https://bookasloth.com/admin/host360/x');
    expect(arg.text).not.toContain('<'); // plain text, no markup
  });

  test('returns no_subject when subject is missing', async () => {
    const { adminAlert, sendEmail } = loadFresh({ ADMIN_ALERT_EMAIL: 'founder@example.com' });
    const r = await adminAlert({ lines: ['orphan'] });

    expect(r).toEqual({ sent: false, reason: 'no_subject' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
