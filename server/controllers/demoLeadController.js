'use strict';
/**
 * demoLeadController — public "Book a Demo" lead form on /be-a-sloth.
 *
 * Two steps, both public + rate-limited at the route:
 *   POST /api/demo-lead/send-otp  { name, phone, profession, attribution }
 *   POST /api/demo-lead           { name, phone, profession, otp }
 *
 * Capture model: the lead is stored the moment they tap "Book A Demo" (send-otp),
 * so a drop-off at the OTP step is still captured as a warm lead. The Meta Lead
 * event is DEFERRED until the phone verifies, and a verified lead is tagged
 * `phone-verified` — so sales can tell quality leads apart and Meta optimizes
 * toward the ones that actually verified.
 *
 * Deliberately reuses shared infrastructure rather than a parallel flow:
 *   - OTP:  utils/otpStore (type 'lead', phone-keyed) + utils/notify's
 *           sendOtpNotification (existing AiSensy BOOKING_OTP template). Phone-
 *           only, so NO guest account is created.
 *   - Lead: services/crm/leadService.safeUpsertLead — the ONE lead-ingestion layer
 *           (same as the Meta Lead Ads webhook + enterprise form). source 'website'.
 */
const otpStore = require('../utils/otpStore');
const { sendOtpNotification } = require('../utils/notify');
const { normalizePhone } = require('../services/aisensyService');
const { safeUpsertLead, addTag } = require('../services/crm/leadService');
const { safeError } = require('../utils/httpError');

const OTP_TYPE = 'lead';                       // isolates this code from login/booking OTPs
const VERIFIED_TAG = 'phone-verified';
const cap = (s = '', n) => String(s).trim().slice(0, n);

// POST /api/demo-lead/send-otp — captures the (unverified) lead, then sends OTP.
async function sendLeadOtp(req, res) {
  try {
    const b = req.body || {};
    if (b.company_hp) return res.json({ message: 'Verification code sent' }); // honeypot: pretend, drop
    const phone = normalizePhone(b.phone);
    if (!phone) return res.status(400).json({ message: 'A valid mobile number is required.' });

    const otp = otpStore.generate();
    const stored = await otpStore.set(phone, otp, OTP_TYPE);   // bcrypt-hashed, rate-limited
    if (stored && stored.ok === false) return res.status(429).json({ message: stored.reason });

    // Store the lead now (unverified) so a drop-off at OTP is still captured. Meta
    // Lead is suppressed here and fired only on verify (quality signal). Best-effort
    // — never block OTP delivery on a CRM hiccup.
    await safeUpsertLead(
      { name: cap(b.name, 120), phone, profession: cap(b.profession, 120) },
      { source: 'website', createdBy: 'book_demo_form', attribution: b.attribution, skipMetaLead: true }
    );

    // Respond immediately; WhatsApp delivery is slow (~6s) + best-effort.
    res.json({ message: 'Verification code sent' });
    Promise.resolve(sendOtpNotification({ phone, name: cap(b.name, 120), otp }))
      .catch((e) => console.error('[demo-lead] send-otp notify (non-fatal):', e.message));
  } catch (e) { safeError(res, e); }
}

// POST /api/demo-lead — verifies the OTP, tags the lead verified, fires Meta.
async function submitLead(req, res) {
  try {
    const b = req.body || {};
    if (b.company_hp) return res.status(201).json({ ok: true }); // honeypot

    const name = cap(b.name, 120);
    const phone = normalizePhone(b.phone);
    const profession = cap(b.profession, 120);
    const otp = String(b.otp || '').trim();

    if (!phone) return res.status(400).json({ error: 'A valid mobile number is required.' });
    if (!otp)   return res.status(400).json({ error: 'Enter the verification code.' });

    // Gate. otpStore.verify is single-use.
    const check = await otpStore.verify(phone, otp, OTP_TYPE);
    if (!check.valid) return res.status(400).json({ error: check.reason || 'Invalid verification code.' });

    // The lead already exists (created at send-otp); this merges + backfills any
    // field, via the SAME shared ingestion layer. Meta stays suppressed here — we
    // fire it explicitly below so the eventId de-dupes and it counts as verified.
    const result = await safeUpsertLead(
      { name, phone, profession },
      { source: 'website', createdBy: 'book_demo_form', attribution: b.attribution, skipMetaLead: true }
    );
    const lead = result && result.lead;

    if (lead && lead.id) {
      // Quality marker: sales filters on this; the tag + timeline record the verify.
      try { await addTag(lead.id, VERIFIED_TAG); } catch (e) { console.warn('[demo-lead] tag failed:', e.message); }
      // Meta Lead now — verified only, with EMQ (IP/UA/fbp/fbc) from this request.
      try {
        require('../utils/trackServer').sendMetaCrmLead({
          phone, leadId: lead.meta_lead_id, eventId: `crm_lead_${lead.id}`, req,
        });
      } catch (e) { console.warn('[demo-lead] meta lead skipped:', e.message); }
    }

    // High-intent verified inbound → feed the lead score. Best-effort.
    require('../services/crm/intentEvents')
      .record({ event: 'demo_request', phone, meta: { profession, page: 'book_demo', verified: true }, source: 'website' })
      .catch(() => {});

    return res.status(201).json({ ok: true, lead_id: lead && lead.id });
  } catch (e) { safeError(res, e); }
}

module.exports = { sendLeadOtp, submitLead };
