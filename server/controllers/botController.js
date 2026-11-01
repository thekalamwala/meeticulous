'use strict';
// Bolt 958 support bot — thin HTTP layer over botService + escalationService.
// Public + rate-limited. Routes use optionalProtect, so req.user is set when the
// caller is logged in (host or guest) and absent for anonymous visitors.
//
// Escalation flow:
//   • logged-in → escalate immediately, auto-attaching identity + a one-line summary.
//   • anonymous → DON'T email yet; the client asks how to be reached (WhatsApp/email),
//     verifies via OTP, then hits /escalate/verify which records + emails support.

const { askBot, askBotStream, recordFeedback } = require('../services/botService');
const escalation = require('../services/bot/escalationService');
const { safeError } = require('../utils/httpError');
const { getClientIp } = require('../lib/clientIp');

const MAX_QUESTION_LEN = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OTP_RE = /^\d{6}$/;

// Normalize a contact so the OTP is stored + verified under the same key, and so the
// WhatsApp number carries a country code (10 digits → 91XXXXXXXXXX).
function normalizeContact(channel, raw) {
  const s = String(raw || '').trim();
  if (channel === 'email') return s.toLowerCase();
  const digits = s.replace(/[^\d]/g, '');
  if (/^\d{10}$/.test(digits)) return '91' + digits;
  return digits; // already has country code (or invalid — caller validates length)
}
const validContact = (channel, c) =>
  channel === 'email' ? EMAIL_RE.test(c) : /^\d{10,15}$/.test(c);

// Pull the logged-in caller's identity for auto-attach. Best-effort — a lookup miss
// still escalates, just with thinner detail.
async function resolveIdentity(req, visitorUuid) {
  if (!req.user?.id) {
    return { logged_in: false, visitor_uuid: visitorUuid || null };
  }
  const { supabaseAdmin } = require('../config/supabase'); // lazy: only the logged-in path needs it
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('name, email, phone, whatsapp_number, is_host')
      .eq('id', req.user.id)
      .single();
    const p = data || {};
    return {
      logged_in: true,
      user_id: req.user.id,
      is_host: !!p.is_host,
      name: p.name || null,
      email: p.email || req.user.email || null,
      phone: p.phone || p.whatsapp_number || null,
      contact_channel: 'auto',
      contact_verified: true,
    };
  } catch (_) {
    return { logged_in: true, user_id: req.user.id, email: req.user.email || null, contact_channel: 'auto', contact_verified: true };
  }
}

// Which side of the marketplace is asking, for the model's audience nudge.
// Logged-in → real is_host (one indexed single-row read; cheap next to the embed +
// model call the same request makes). Anonymous → inferred from the page they're on,
// null when the page is ambiguous (the model then stays neutral).
const HOST_URL_RE  = /\/(dashboard|login-as-vendor|become-a-host|pricing|for)\b/i;
const GUEST_URL_RE = /\/(user|my-bookings|book|explore)\b/i;
function inferAudienceFromUrl(pageUrl) {
  const u = String(pageUrl || '');
  if (HOST_URL_RE.test(u)) return 'host';
  if (GUEST_URL_RE.test(u)) return 'guest';
  return null;
}
async function resolveAudience(req) {
  if (req.user?.id) {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      const { data } = await supabaseAdmin.from('profiles').select('is_host').eq('id', req.user.id).single();
      return data?.is_host ? 'host' : 'guest';
    } catch (_) { return null; }
  }
  return inferAudienceFromUrl(req.body?.pageUrl);
}

exports.ask = async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    const conversationId = req.body?.conversationId || null;
    if (!question) return res.status(400).json({ message: 'Please enter a question.' });
    if (question.length > MAX_QUESTION_LEN) return res.status(400).json({ message: 'That question is too long. Please shorten it.' });
    if (conversationId && !UUID_RE.test(conversationId)) return res.status(400).json({ message: 'Invalid conversation reference.' });

    const sessionRef = req.user?.id || req.body?.visitorId || null;
    const audience = await resolveAudience(req);
    const result = await askBot({ question, conversationId, sessionRef, ip: getClientIp(req), audience });

    let reference = null;
    let escalationId = null;
    let channel = null;
    let contact = null;
    let needsContact = false;
    if (result.escalate) {
      if (req.user?.id) {
        const identity = await resolveIdentity(req);
        const rec = await escalation.recordAndNotify({
          conversationId: result.conversationId, question, reason: result.escalateReason,
          pageUrl: req.body?.pageUrl, userAgent: req.get('user-agent'), identity,
        });
        reference = rec.reference;
        escalationId = rec.escalationId;
        channel = rec.channel;
        contact = rec.contact;
      } else {
        needsContact = true; // anon: client will collect a verified contact, then /escalate/verify
      }
    }

    return res.json({
      answer: result.answer, cited_sources: result.cited_sources, escalate: result.escalate,
      escalateReason: result.escalateReason || null, needsContact, reference, escalationId, channel, contact,
      conversationId: result.conversationId, messageId: result.messageId,
      pills: result.pills || [], locked: !!result.locked,
    });
  } catch (err) {
    return safeError(res, err);
  }
};

exports.askStream = async (req, res) => {
  const question = String(req.body?.question || '').trim();
  const conversationId = req.body?.conversationId || null;
  if (!question) return res.status(400).json({ message: 'Please enter a question.' });
  if (question.length > MAX_QUESTION_LEN) return res.status(400).json({ message: 'That question is too long. Please shorten it.' });
  if (conversationId && !UUID_RE.test(conversationId)) return res.status(400).json({ message: 'Invalid conversation reference.' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const sse = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const sessionRef = req.user?.id || req.body?.visitorId || null;
    const audience = await resolveAudience(req);
    const result = await askBotStream({ question, conversationId, sessionRef, ip: getClientIp(req), audience, onDelta: (text) => sse('delta', { text }) });

    let reference = null;
    let escalationId = null;
    let channel = null;
    let contact = null;
    let needsContact = false;
    if (result.escalate) {
      if (req.user?.id) {
        const identity = await resolveIdentity(req);
        // Await only the fast insert (summary + email run in the background) so the
        // done event carries the reference + id the rating step needs.
        const rec = await escalation.recordAndNotify({
          conversationId: result.conversationId, question, reason: result.escalateReason,
          pageUrl: req.body?.pageUrl, userAgent: req.get('user-agent'), identity,
        });
        reference = rec.reference;
        escalationId = rec.escalationId;
        channel = rec.channel;
        contact = rec.contact;
      } else {
        needsContact = true;
      }
    }

    sse('done', {
      escalate: result.escalate, escalateReason: result.escalateReason || null,
      needsContact, reference, escalationId, channel, contact,
      cited_sources: result.cited_sources, followups: result.followups || [],
      conversationId: result.conversationId, messageId: result.messageId,
      pills: result.pills || [], locked: !!result.locked,
    });
    res.end();
  } catch (err) {
    console.error('[bot] stream failed:', err.message);
    sse('error', { message: 'Something went wrong. Please try again.' });
    res.end();
  }
};

// Anonymous visitor: send an OTP to the chosen WhatsApp number / email.
exports.escalateSendOtp = async (req, res) => {
  try {
    const channel = req.body?.channel;
    const conversationId = req.body?.conversationId || null;
    if (channel !== 'whatsapp' && channel !== 'email') return res.status(400).json({ message: 'Choose WhatsApp or email.' });
    if (conversationId && !UUID_RE.test(conversationId)) return res.status(400).json({ message: 'Invalid conversation reference.' });
    const contact = normalizeContact(channel, req.body?.contact);
    if (!validContact(channel, contact)) return res.status(400).json({ message: channel === 'email' ? 'Enter a valid email.' : 'Enter a valid phone number.' });

    const out = await escalation.sendContactOtp({ channel, contact, name: req.body?.name });
    if (!out.ok) {
      const code = out.reason === 'rate_limited' || out.reason === 'locked_out' ? 429 : 502;
      return res.status(code).json({ message: out.reason === 'delivery_failed' ? "Couldn't send the code — try the other channel." : 'Too many attempts. Try again later.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return safeError(res, err);
  }
};

// Anonymous visitor: verify the OTP, then record + email the escalation.
exports.escalateVerifyOtp = async (req, res) => {
  try {
    const channel = req.body?.channel;
    const conversationId = req.body?.conversationId || null;
    const otp = String(req.body?.otp || '').trim();
    if (channel !== 'whatsapp' && channel !== 'email') return res.status(400).json({ message: 'Choose WhatsApp or email.' });
    if (!OTP_RE.test(otp)) return res.status(400).json({ message: 'Enter the 6-digit code.' });
    if (conversationId && !UUID_RE.test(conversationId)) return res.status(400).json({ message: 'Invalid conversation reference.' });
    const contact = normalizeContact(channel, req.body?.contact);
    if (!validContact(channel, contact)) return res.status(400).json({ message: 'Invalid contact.' });

    const v = await escalation.verifyContactOtp({ channel, contact, otp });
    if (!v.valid) return res.status(400).json({ message: v.reason === 'expired' ? 'That code expired. Request a new one.' : 'Incorrect code. Try again.' });

    const identity = {
      logged_in: false,
      visitor_uuid: req.body?.visitorId || null,
      name: req.body?.name || null,
      contact_channel: channel,
      contact_verified: true,
      email: channel === 'email' ? contact : null,
      phone: channel === 'whatsapp' ? contact : null,
    };
    const rec = await escalation.recordAndNotify({
      conversationId, question: req.body?.question || '', reason: req.body?.reason || 'model_unsure',
      pageUrl: req.body?.pageUrl, userAgent: req.get('user-agent'), identity,
    });
    return res.json({ ok: true, reference: rec.reference, escalationId: rec.escalationId });
  } catch (err) {
    return safeError(res, err);
  }
};

// Post-handoff satisfaction rating (1–5) from the widget's emoji picker.
exports.escalateRating = async (req, res) => {
  try {
    const escalationId = req.body?.escalationId;
    const rating = req.body?.rating;
    if (!escalationId || !UUID_RE.test(escalationId)) return res.status(400).json({ message: 'Invalid escalation id.' });
    const out = await escalation.recordRating(escalationId, rating);
    if (!out.ok) return res.status(400).json({ message: 'Rating must be 1–5.' });
    return res.json({ ok: true });
  } catch (err) {
    return safeError(res, err);
  }
};

exports.feedback = async (req, res) => {
  try {
    const { messageId, feedback } = req.body || {};
    if (!messageId || !UUID_RE.test(messageId)) return res.status(400).json({ message: 'A valid messageId is required.' });
    if (feedback !== 'up' && feedback !== 'down') return res.status(400).json({ message: "feedback must be 'up' or 'down'." });
    await recordFeedback(messageId, feedback);
    return res.json({ ok: true });
  } catch (err) {
    return safeError(res, err);
  }
};

// Exported for unit tests.
exports._inferAudienceFromUrl = inferAudienceFromUrl;
