'use strict';

/**
 * pitchDeckController.js — passcode + WhatsApp-OTP gate for the investor deck.
 *
 * Flow (see routes/pitchDeckRoutes.js):
 *   1. POST /check-passcode {passcode}       → validate code only (step 1, no OTP)
 *   2. POST /request-otp {passcode, phone}    → send WhatsApp OTP (step 2)
 *   3. POST /verify-otp  {passcode, phone, otp} → 45-min token + log access (step 3)
 *   4. GET  /data  (Bearer)                   → confidential figures
 *   5. POST /access-log {passcode}            → who verified + when (founder view)
 *
 * Reuses: otpStore ('pitch_deck'), notify.sendWhatsAppVerifyOtp, aisensy
 * normalizePhone, pitchDeckToken (OAUTH_STATE_SECRET). Access log = pitch_deck_access.
 */

const otpStore = require('../utils/otpStore');
const { sendWhatsAppVerifyOtp } = require('../utils/notify');
const { normalizePhone } = require('../services/aisensyService');
const { getClientIp } = require('../lib/clientIp');
const { supabaseAdmin } = require('../config/supabase');
const pitchToken = require('../utils/pitchDeckToken');
const { DATA, isConfigured, isExpired, checkPasscode } = require('../data/pitchDeck');

const otpKey = (phone) => `pitch:${phone}`;

// Shared gate guard — returns true (and responds) if the request should stop.
const gated = (res) => {
  if (!isConfigured()) { res.status(503).json({ message: 'Pitch deck access is not configured yet.' }); return true; }
  if (isExpired()) { res.status(410).json({ message: 'This pitch deck link has expired.' }); return true; }
  return false;
};

// POST /check-passcode — step 1: validate the code, reveal nothing, send no OTP.
const checkPasscodeOnly = (req, res) => {
  if (gated(res)) return;
  if (!checkPasscode(req.body?.passcode)) return res.status(401).json({ message: 'Invalid access code.' });
  return res.json({ ok: true });
};

// POST /request-otp — step 2.
const requestOtp = async (req, res) => {
  try {
    if (gated(res)) return;
    const { passcode, phone } = req.body || {};
    if (!checkPasscode(passcode)) return res.status(401).json({ message: 'Invalid access code.' });
    const norm = normalizePhone(phone);
    if (!norm) return res.status(400).json({ message: 'Enter a valid phone number.' });

    const otp = otpStore.generate();
    const stored = await otpStore.set(otpKey(norm), otp, 'pitch_deck');
    if (stored.ok === false) return res.status(429).json({ message: stored.reason || 'Too many code requests. Please wait.' });

    res.json({ message: 'Verification code sent on WhatsApp.' });
    sendWhatsAppVerifyOtp({ phone: norm, otp, name: 'Investor' })
      .catch((err) => console.error('[pitch-deck] OTP send failed:', err?.message || err));
  } catch (err) {
    console.error('[pitch-deck] requestOtp error:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ message: 'Could not send code. Try again.' });
  }
};

// POST /verify-otp — step 3: verify, issue token, log the access.
const verifyOtp = async (req, res) => {
  try {
    if (gated(res)) return;
    const { passcode, phone, otp } = req.body || {};
    if (!checkPasscode(passcode)) return res.status(401).json({ message: 'Invalid access code.' });
    const norm = normalizePhone(phone);
    if (!norm) return res.status(400).json({ message: 'Enter a valid phone number.' });
    if (!otp) return res.status(400).json({ message: 'Enter the code.' });

    const result = await otpStore.verify(otpKey(norm), otp, 'pitch_deck');
    if (!result.valid) return res.status(400).json({ message: result.reason || 'Incorrect or expired code.' });

    // Access log — fire-and-forget; never blocks the viewer. Table is additive +
    // RLS/service-role-only, so this degrades silently if it's ever missing.
    supabaseAdmin
      .from('pitch_deck_access')
      .insert({ phone: norm, ip: getClientIp(req) || null, user_agent: (req.headers['user-agent'] || '').slice(0, 300) })
      .then(({ error }) => { if (error) console.error('[pitch-deck] access-log insert:', error.message); });

    const token = pitchToken.issue(norm);
    return res.json({ token, expiresInSec: pitchToken.TTL_SEC });
  } catch (err) {
    console.error('[pitch-deck] verifyOtp error:', err?.message || err);
    return res.status(500).json({ message: 'Could not verify. Try again.' });
  }
};

// GET /data — the confidential payload, token-gated.
const getData = (req, res) => {
  try {
    if (gated(res)) return;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!pitchToken.verifyToken(token)) return res.status(401).json({ message: 'Session expired. Please verify again.' });
    return res.json(DATA);
  } catch (err) {
    console.error('[pitch-deck] getData error:', err?.message || err);
    return res.status(500).json({ message: 'Could not load deck.' });
  }
};

// POST /access-log {passcode} — founder view of who verified + when.
const accessLog = async (req, res) => {
  try {
    if (!isConfigured()) return res.status(503).json({ message: 'Pitch deck access is not configured yet.' });
    if (!checkPasscode(req.body?.passcode)) return res.status(401).json({ message: 'Invalid access code.' });
    const { data, error } = await supabaseAdmin
      .from('pitch_deck_access')
      .select('phone, ip, verified_at')
      .order('verified_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ message: 'Could not load the access log.' });
    return res.json({ count: data.length, entries: data });
  } catch (err) {
    console.error('[pitch-deck] accessLog error:', err?.message || err);
    return res.status(500).json({ message: 'Could not load the access log.' });
  }
};

module.exports = { checkPasscodeOnly, requestOtp, verifyOtp, getData, accessLog };
