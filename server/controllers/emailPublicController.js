/**
 * emailPublicController.js — public (no-auth) email preference endpoints.
 *
 * The signed unsubscribe token IS the authentication: it proves the caller holds
 * a link we issued for a specific address, so a guest with no account can opt out
 * straight from an email. Routes are mounted at /api/email and rate-limited by the
 * global apiLimiter.
 *
 * Opt-out applies to MARKETING email only; transactional mail (OTP, booking,
 * payment, security) always sends — enforced in communicationEngine.
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../services/email/unsubscribeToken');
const communicationEngine = require('../services/email/communicationEngine');
const leadService = require('../services/crm/leadService');

const emailFromToken = (token) => verifyToken(token);

/** GET /api/email/unsubscribe?token= → { email, unsubscribed } for the page to render. */
async function getUnsubscribeStatus(req, res) {
  const email = emailFromToken(req.query.token);
  if (!email) return res.status(400).json({ message: 'Invalid or expired link.' });
  try {
    const { data } = await supabaseAdmin
      .from('email_unsubscribes').select('email').eq('email', email).maybeSingle();
    return res.json({ email, unsubscribed: !!data });
  } catch (_) {
    return res.json({ email, unsubscribed: false });
  }
}

/** POST /api/email/unsubscribe { token } → opt the address out of marketing email. */
async function unsubscribe(req, res) {
  const email = emailFromToken(req.body.token);
  if (!email) return res.status(400).json({ message: 'Invalid or expired link.' });
  try {
    const { error } = await supabaseAdmin
      .from('email_unsubscribes')
      .upsert({ email, unsubscribed_at: new Date().toISOString(), source: 'email_link' }, { onConflict: 'email' });
    if (error) return res.status(500).json({ message: 'Could not update your preference. Please try again.' });
    return res.json({ ok: true, email, unsubscribed: true });
  } catch (_) {
    return res.status(500).json({ message: 'Could not update your preference. Please try again.' });
  }
}

/** POST /api/email/resubscribe { token } → opt the address back in. */
async function resubscribe(req, res) {
  const email = emailFromToken(req.body.token);
  if (!email) return res.status(400).json({ message: 'Invalid or expired link.' });
  try {
    const { error } = await supabaseAdmin.from('email_unsubscribes').delete().eq('email', email);
    if (error) return res.status(500).json({ message: 'Could not update your preference. Please try again.' });
    return res.json({ ok: true, email, unsubscribed: false });
  } catch (_) {
    return res.status(500).json({ message: 'Could not update your preference. Please try again.' });
  }
}

/**
 * POST /api/email/subscribe { email } → opt an address into the newsletter
 * (single opt-in). Reuses the campaign `contacts` table so subscribers are
 * immediately reachable by existing email campaigns. No auth; rate-limited by
 * stacked email+IP limiters on the route.
 */
async function subscribe(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  try {
    // Don't clobber an existing contact's source / contact_type / attributes —
    // only (re)assert the marketing opt-in and tag them as a newsletter subscriber.
    const { data: existing } = await supabaseAdmin
      .from('contacts').select('id, attributes').eq('email', email).maybeSingle();

    // First-time newsletter join? Gates the one-shot welcome email so repeat
    // submitters are never re-welcomed.
    let firstTime;

    if (existing) {
      firstTime = !(existing.attributes && existing.attributes.newsletter === true);
      const attributes = { ...(existing.attributes || {}), newsletter: true };
      await supabaseAdmin
        .from('contacts')
        .update({ email_opt_in: true, email_suppressed: false, attributes, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      const { error: insErr } = await supabaseAdmin.from('contacts').insert({
        email,
        contact_type: 'guest',
        email_opt_in: true,
        email_suppressed: false,
        source: 'newsletter',
        attributes: { newsletter: true },
      });
      // Lost an insert race (unique email) → re-assert opt-in, treat as not-first.
      if (insErr && insErr.code === '23505') {
        firstTime = false;
        await supabaseAdmin
          .from('contacts')
          .update({ email_opt_in: true, email_suppressed: false, updated_at: new Date().toISOString() })
          .eq('email', email);
      } else if (insErr) {
        throw insErr;
      } else {
        firstTime = true;
      }
    }

    // Explicit opt-in overrides any prior marketing opt-out for this address.
    await supabaseAdmin.from('email_unsubscribes').delete().eq('email', email);

    // Also land the subscriber in the CRM as a lead so sales can work them.
    // Best-effort: upsertLead dedups by email (never a duplicate) and the
    // subscription must succeed even if the CRM write hiccups.
    try {
      await leadService.upsertLead({ email }, { source: 'newsletter', createdBy: 'newsletter', attribution: req.body?.attribution });
    } catch (_) { /* subscription already saved; lead capture is non-critical */ }

    // Identified intent signal — feeds the lead score once matched.
    require('../services/crm/intentEvents')
      .record({ event: 'newsletter_signup', email, source: 'newsletter' }).catch(() => {});

    // Welcome email — only on the first join, best-effort: a template/queue hiccup
    // must never fail the subscription itself. NEWSLETTER_WELCOME is transactional
    // (a direct response to their action), so it always delivers the single welcome.
    if (firstTime) {
      try {
        await communicationEngine.send({
          event: 'NEWSLETTER_WELCOME', to: email, audience: 'all', user: { email },
        });
      } catch (_) { /* subscription already saved; welcome is non-critical */ }
    }

    return res.json({ ok: true, email });
  } catch (_) {
    return res.status(500).json({ message: 'Could not subscribe right now. Please try again.' });
  }
}

module.exports = { getUnsubscribeStatus, unsubscribe, resubscribe, subscribe };
