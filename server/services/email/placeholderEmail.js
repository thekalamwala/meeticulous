'use strict';
/**
 * placeholderEmail — recognise the synthetic address phone-only users get.
 *
 * A guest/host who signs up by phone with no email is given a deterministic
 * synthetic address `p<e164-digits>@users.bookasloth.app`
 * (authController.syntheticPhoneEmail) purely so an account row has a unique,
 * idempotent email — it is NEVER a real mailbox. Sending to it always bounces,
 * which wastes sends and erodes sender reputation (observed on prod: repeated
 * bounces to `p…@users.bookasloth.app`). Phone-only users are reachable on
 * WhatsApp, not email, so every email path skips these addresses.
 *
 * Kept dependency-free so both the CRM gate (sendGate) and the universal provider
 * layer (email/providers) can import it with no circular dependency.
 */
const PLACEHOLDER_EMAIL_DOMAIN = '@users.bookasloth.app';

/** True if `email` is a synthetic phone-only placeholder address (can't receive mail). */
function isPlaceholderEmail(email) {
  return typeof email === 'string'
    && email.trim().toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

module.exports = { PLACEHOLDER_EMAIL_DOMAIN, isPlaceholderEmail };
