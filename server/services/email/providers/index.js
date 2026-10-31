/**
 * Email provider abstraction (PRD §18).
 *
 * Every provider implements one method:
 *   sendEmail({ to, subject, html, fromName, fromEmail }) → { success, id?, response?, error? }
 *
 * Business logic never imports a provider directly — it goes through the
 * Communication Engine, which selects the provider from email_settings.provider.
 * Swapping SMTP → Resend → SES is a settings change, no code change.
 */

'use strict';

const smtpProvider = require('./smtpProvider');
const resendProvider = require('./resendProvider');
const sesProvider = require('./sesProvider');
const brevoProvider = require('./brevoProvider');
const { isPlaceholderEmail } = require('../placeholderEmail');

const PROVIDERS = {
  smtp: smtpProvider,
  resend: resendProvider,
  ses: sesProvider,
  brevo: brevoProvider,
};

// The provider for BULK / marketing / sales-automation mail — deliberately the
// OTHER provider from transactional (email_settings.provider), so the two never
// share one free-tier daily cap and a marketing burst can't starve booking mail.
// Current split (both free tiers): transactional → Resend on notify.meeticulous.com
// (must-deliver booking/OTP mail), marketing → Brevo on news.meeticulous.com (bursty
// but delay-tolerant — the campaign worker throttles, and a big blast fails on THIS
// non-critical path instead of taking down confirmations). Normally the provider is
// driven by the sender row (deliver() prefers sender.provider); this constant is the
// fallback for marketing sends with no sender provider (sender-less campaigns,
// composer tests). HTTP-API only — PaaS blocks outbound SMTP.
const MARKETING_PROVIDER = 'brevo';

// Every outbound email replies to ONE monitored inbox, overriding whatever
// reply-to a caller/persona set (Aastha, Tithi, Durga, …). Forced here because
// this wrapper is the single send chokepoint, so no path can leak a reply to an
// unwatched persona box. Env-overridable if a flow ever needs its own reply-to.
const REPLY_TO = process.env.SUPPORT_REPLY_TO || 'team@meeticulous.com';

/**
 * Resolve a provider by name (default SMTP), wrapped with the universal
 * placeholder-recipient guard: a phone-only user's synthetic
 * p<phone>@users.bookasloth.app address can't receive mail, so we short-circuit to
 * a benign no-op success (never call the real provider → no bounce) for EVERY email
 * path — CRM, transactional and campaign alike — from this one chokepoint. Success
 * (not an error) so inline callers that throw on failure aren't broken.
 *
 * The same chokepoint forces reply-to to the support inbox on every send.
 */
function getProvider(name) {
  const provider = PROVIDERS[(name || 'smtp').toLowerCase()] || smtpProvider;
  return {
    ...provider,
    sendEmail: async (opts = {}) => {
      const to = Array.isArray(opts.to) ? opts.to[0] : opts.to;
      if (isPlaceholderEmail(to)) return { success: true, skipped: true, id: null, reason: 'placeholder_recipient' };
      return provider.sendEmail({ ...opts, replyTo: REPLY_TO });
    },
  };
}

module.exports = { getProvider, PROVIDERS, MARKETING_PROVIDER };
