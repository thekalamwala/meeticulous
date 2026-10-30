/**
 * resendProvider.js — Resend (resend.com) implementation of the provider
 * interface. Active when email_settings.provider = 'resend' and RESEND_API_KEY
 * is set. Uses the HTTP API directly (no SDK dependency).
 */
'use strict';

// Hard timeout on the Resend HTTP call, mirroring aisensyService. Without a bound
// a hung provider stalls the queue worker (and blocks an immediate OTP send inside
// the request). 10s default, override with EMAIL_TIMEOUT_MS.
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10000;

async function sendEmail({ to, subject, html, text, fromName = 'Meeticulous', fromEmail, replyTo, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };
  const from = `${fromName} <${fromEmail || process.env.RESEND_FROM || 'noreply@mail.meeticulous.in'}>`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    // text (plain-text alternative) is sent alongside html when present — a
    // multipart message reads as transactional and lands better in the inbox.
    const payload = { from, to: [to], subject, html };
    if (text) payload.text = text;
    // reply_to lets a persona sender (Tithi/Durga/…) route replies to a real,
    // monitored mailbox even though the send goes through Resend.
    if (replyTo) payload.reply_to = replyTo;
    // Optional attachments (e.g. an .ics calendar invite). Resend expects
    // { filename, content: <base64> }. No-op for callers that don't pass any.
    if (Array.isArray(attachments) && attachments.length) payload.attachments = attachments;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body?.message || `HTTP ${res.status}`, response: body };
    return { success: true, id: body.id, response: body };
  } catch (err) {
    const msg = err.name === 'AbortError' ? `Resend timeout after ${EMAIL_TIMEOUT_MS}ms` : err.message;
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { name: 'resend', sendEmail };
