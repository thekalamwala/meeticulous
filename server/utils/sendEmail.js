'use strict';
/**
 * sendEmail — ad-hoc transactional email (contact form, enterprise-lead form,
 * password reset, Bolt 958 support escalation) that isn't a templated business
 * event and so doesn't go through communicationEngine.send(event, ...).
 *
 * It now routes through the SAME provider abstraction the Communication Engine
 * uses — `email_settings.provider` (Resend in prod) via getProvider — instead of
 * the raw nodemailer/SMTP transport this file used to own. That raw path went
 * stale when the platform moved transactional mail to Resend, so every request
 * that awaits sendEmail inline was hitting a dead SMTP host. One chokepoint here
 * fixes all inline callers at once and keeps them on the healthy provider.
 *
 * Signature ({ to, subject, html }) and throw-on-failure contract are unchanged,
 * so callers (which catch → 5xx, or swallow for fire-and-forget) are untouched.
 */
const { isLoadTestMode } = require('../config/loadTestMode');
const { loadSettings } = require('../services/email/communicationEngine');
const { getProvider } = require('../services/email/providers');

const sendEmail = async ({ to, subject, html, text, attachments, fromName, fromEmail, replyTo, provider: providerName }) => {
  if (isLoadTestMode()) return; // no email egress in load mode
  const settings = await loadSettings();
  // `provider` override lets a bulk caller (CRM sales automation) force the
  // marketing SMTP transport; ad-hoc transactional callers omit it → global provider.
  const provider = getProvider(providerName || settings.provider);
  const res = await provider.sendEmail({
    to, subject, html, text, attachments,
    // Optional per-send persona override (CRM Tithi/Sujata); else the global default.
    fromName: fromName || settings.from_name,
    fromEmail: fromEmail || settings.from_email,
    // Replies route to the only monitored inbox (bolt@) even when From is a persona.
    replyTo: replyTo || settings.support_email || 'bolt@bookasloth.in',
  });
  // Preserve the old raw-SMTP behaviour: a failed send throws so inline callers
  // (contactController etc.) still return their 5xx; fire-and-forget callers
  // (bot escalation) already swallow it.
  if (!res || !res.success) throw new Error(res && res.error ? res.error : 'email send failed');
  return res;
};

module.exports = sendEmail;
