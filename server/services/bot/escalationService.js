'use strict';
// escalationService.js — turns a bot escalation into something support can ACT on.
//
// Reuses existing infra only (no new deps): otpStore for verify, notify/AiSensy for
// WhatsApp OTP, sendEmail for email OTP + the support handoff, botService for the
// transcript + PII redaction, anthropicClient+botBudget for the one-line summary.
//
// The human reference (CHAT-8F92AB) is DERIVED from the conversation UUID that's
// already persisted — no extra column, deterministic, so the same chat always shows
// the same ref. Everything here is best-effort: a DB/mail hiccup must never break the
// chat (the caller still streams the handoff copy).

const { supabaseAdmin } = require('../../config/supabase');
const anthropicClient = require('../ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const otpStore = require('../../utils/otpStore');
const notify = require('../../utils/notify');
const sendEmail = require('../../utils/sendEmail');
const { getRecentMessages, redactPii } = require('../botService');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'team@meeticulous.com';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only added-in-v3.89 tables — swallow "not applied yet" so the bot still ships.
const isMissingSchema = (e) =>
  e && (e.code === '42P01' || e.code === '42703' || /does not exist|schema cache/i.test(e.message || ''));

// CHAT-8F92AB from the conversation UUID. Deterministic, storage-free.
function buildReference(conversationId) {
  const hex = String(conversationId || '').replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();
  return 'CHAT-' + (hex.padEnd(6, '0') || '000000');
}

// OTP store key, namespaced so bot-contact codes never collide with booking/login/
// host-verify OTPs (mirrors whatsappController's `wa:` pattern).
function otpKey(channel, contact) {
  return `bot:${channel === 'whatsapp' ? 'wa' : 'em'}:${String(contact || '').toLowerCase().trim()}`;
}

// One-sentence summary of the issue, so support gets the gist without reading 80 lines.
// Budget-gated Haiku; falls back to the first user message. Never throws.
async function summarize(conversationId, question, preHistory) {
  const firstLine = () => {
    const base = String(question || '').replace(/\s+/g, ' ').trim();
    return base ? (base.length > 140 ? base.slice(0, 137) + '…' : base) : 'Visitor needs help (no question captured).';
  };
  try {
    const history = preHistory || await getRecentMessages(conversationId, 12);
    const transcript = history.length
      ? history.map((m) => `${m.role}: ${m.content}`).join('\n')
      : `user: ${redactPii(question)}`;
    if (!anthropicClient.isConfigured()) return firstLine();
    const budget = await botBudget.tryConsume();
    if (!budget.allowed) return firstLine();
    const client = anthropicClient.getClient();
    if (!client) return firstLine();

    const resp = await client.messages.create({
      model: anthropicClient.MODELS.generate,
      max_tokens: 40,
      system:
        'Summarize what the customer needs in ONE short sentence a support agent can ' +
        'act on. No preamble, no quotes. Examples: "Customer cannot update booking ' +
        'date." / "User wants a GST invoice for a previous booking."',
      messages: [{ role: 'user', content: transcript.slice(0, 4000) }],
    });
    const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    return text || firstLine();
  } catch (_) {
    return firstLine();
  }
}

// ---- Anonymous contact verification (WhatsApp / email) ---------------------
// verify-only: never creates an account or a session (reuses otpStore directly).
async function sendContactOtp({ channel, contact, name }) {
  const otp = otpStore.generate();
  const set = await otpStore.set(otpKey(channel, contact), otp, 'bot_contact');
  if (!set.ok) return { ok: false, reason: set.reason };
  try {
    if (channel === 'whatsapp') {
      const sent = await notify.sendWhatsAppVerifyOtp({ phone: contact, otp, name });
      if (!sent) return { ok: false, reason: 'delivery_failed' };
    } else {
      await sendEmail({
        to: contact,
        subject: 'Your Meeticulous verification code',
        html: `<p>Your verification code is <strong style="font-size:18px">${esc(otp)}</strong>.</p>
               <p>It expires in 10 minutes. Enter it in the chat to reach our support team.</p>`,
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'delivery_failed' };
  }
}

async function verifyContactOtp({ channel, contact, otp }) {
  const res = await otpStore.verify(otpKey(channel, contact), otp, 'bot_contact');
  return { valid: !!res.valid, reason: res.reason };
}

// ---- Persist + notify ------------------------------------------------------
// identity: { logged_in, user_id, is_host, name, email, phone, contact_channel,
//             contact_verified, visitor_uuid }
async function recordAndNotify({ conversationId, question, reason, pageUrl, userAgent, identity = {} }) {
  const reference = buildReference(conversationId);
  // Resolve the concrete channel we'll actually reach them on. Anon flows pin a
  // verified channel; logged-in identities are 'auto' (both on file) — prefer
  // WhatsApp when a number exists, else email. Returned so the widget can confirm it.
  const channel =
    identity.contact_channel === 'whatsapp' ? 'whatsapp'
      : identity.contact_channel === 'email' ? 'email'
        : (identity.phone ? 'whatsapp' : 'email');
  const contact = channel === 'whatsapp' ? identity.phone : identity.email;

  // 1. Insert the record NOW (fast) so the caller gets an id back for the rating step.
  //    The one-line summary (Haiku) and the support email (SMTP) are slow, so they run
  //    in the background — the "Support Request Sent" confirmation must not wait on them.
  let escalationId = null;
  try {
    // supabase-js resolves { data, error } — it does NOT throw on a query error, so
    // the error field must be inspected explicitly or genuine insert failures
    // (schema missing, constraint, RLS) go silent and escalationId stays null.
    const { data, error } = await supabaseAdmin
      .from('bot_escalations')
      .insert({
        conversation_id: conversationId || null,
        reference,
        visitor_uuid: identity.visitor_uuid || null,
        logged_in: !!identity.logged_in,
        user_id: identity.user_id || null,
        is_host: typeof identity.is_host === 'boolean' ? identity.is_host : null,
        name: identity.name || null,
        email: identity.email || null,
        phone: identity.phone || null,
        contact_channel: identity.contact_channel || null,
        contact_verified: !!identity.contact_verified,
        page_url: pageUrl || null,
        user_agent: userAgent || null,
        reason: reason || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    escalationId = data ? data.id : null;
  } catch (e) {
    if (!isMissingSchema(e)) console.error('[bot] escalation record failed:', e.message);
  }

  // 2. Background: summarize → store the summary → email support. Best-effort.
  (async () => {
    // Fetch the transcript once; summarize and the support email both reuse it.
    const history = await getRecentMessages(conversationId, 12);
    const summary = await summarize(conversationId, question, history);
    if (escalationId) {
      try { await supabaseAdmin.from('bot_escalations').update({ summary }).eq('id', escalationId); }
      catch (_) { /* summary is a nice-to-have */ }
    }
    try {
      const transcript = history.length
        ? history.map((m) => `<p><strong>${esc(m.role)}:</strong> ${esc(m.content)}</p>`).join('')
        : `<p><strong>user:</strong> ${esc(redactPii(question))}</p>`;
      const who = identity.logged_in
        ? `${esc(identity.name || '—')} · ${identity.is_host ? 'Host' : 'Guest'} · ${esc(identity.user_id || '')}`
        : 'Anonymous visitor';
      await sendEmail({
        to: SUPPORT_EMAIL,
        subject: `[Tithi] ${reference} — ${esc(summary)}`,
        html: `
          <h2>Tithi handed a conversation to support</h2>
          <p style="font-size:15px"><strong>${esc(summary)}</strong></p>
          <table cellpadding="4" style="border-collapse:collapse;font-size:13px">
            <tr><td><strong>Reference</strong></td><td>${esc(reference)}</td></tr>
            <tr><td><strong>Who</strong></td><td>${who}</td></tr>
            <tr><td><strong>Logged in</strong></td><td>${identity.logged_in ? 'Yes' : 'No'}</td></tr>
            <tr><td><strong>Contact</strong></td><td>${esc(contact || '—')} (${esc(channel)}${identity.contact_verified ? ', verified' : ''})</td></tr>
            <tr><td><strong>Email</strong></td><td>${esc(identity.email || '—')}</td></tr>
            <tr><td><strong>Phone</strong></td><td>${esc(identity.phone || '—')}</td></tr>
            <tr><td><strong>Conversation</strong></td><td>${esc(conversationId || '—')}</td></tr>
            <tr><td><strong>Visitor UUID</strong></td><td>${esc(identity.visitor_uuid || '—')}</td></tr>
            <tr><td><strong>Reason</strong></td><td>${esc(reason || '—')}</td></tr>
            <tr><td><strong>Page</strong></td><td>${esc(pageUrl || '—')}</td></tr>
            <tr><td><strong>Browser</strong></td><td>${esc(userAgent || '—')}</td></tr>
          </table>
          <hr/>
          <h3>Transcript</h3>
          ${transcript}
        `,
      });
    } catch (err) {
      console.error('[bot] escalation email failed:', err.message);
    }
  })().catch(() => {});

  return { reference, escalationId, channel, contact };
}

// Store the 1–5 satisfaction rating the widget collects after the handoff.
async function recordRating(escalationId, rating) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return { ok: false, reason: 'bad_rating' };
  try {
    const { error } = await supabaseAdmin.from('bot_escalations').update({ rating: r }).eq('id', escalationId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    if (isMissingSchema(e)) return { ok: true }; // column not applied yet — don't error the user
    console.error('[bot] rating save failed:', e.message);
    return { ok: false, reason: 'save_failed' };
  }
}

module.exports = {
  buildReference, otpKey, summarize,
  sendContactOtp, verifyContactOtp, recordAndNotify, recordRating,
  _isMissingSchema: isMissingSchema,
};
