/**
 * brevoProvider.js — Brevo (brevo.com, ex-Sendinblue) transactional HTTP API.
 *
 * This is the BULK / marketing / sales-automation transport, kept OFF Resend so
 * the Resend transactional quota stays reserved. It talks HTTP (port 443) like
 * resendProvider — deliberately NOT SMTP: PaaS hosts (Render) block/refuse
 * outbound SMTP ports, which is why the earlier Gmail-SMTP attempt timed out.
 *
 * Unlike Gmail SMTP, Brevo sends AS any address on a domain you've authenticated,
 * so the marketing persona (aastha@bookasloth.in) keeps its own From/Reply-To.
 *
 * Same interface as every provider:
 *   sendEmail({ to, subject, html, ... }) → { success, id?, response?, error? }
 * Never falls back to another provider — a failure is returned so the caller's
 * queue retries on Brevo, and bulk failures never spill onto Resend.
 */
'use strict';

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10000;

async function sendEmail({ to, subject, html, text, fromName = 'Meeticulous', fromEmail, replyTo, attachments, headers }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { success: false, error: 'BREVO_API_KEY not configured' };
  const senderEmail = fromEmail || process.env.BREVO_FROM || 'hello@news.meeticulous.com';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean).map((email) => ({ email }));
    const payload = {
      sender: { name: fromName, email: senderEmail },
      to: recipients,
      subject,
      htmlContent: html,
    };
    if (text) payload.textContent = text;
    if (replyTo) payload.replyTo = { email: replyTo };
    if (headers && Object.keys(headers).length) payload.headers = headers;
    // Brevo attachments are { name, content: <base64> } — map from the Resend-shaped
    // { filename, content } callers already pass (.ics invites etc.). No-op otherwise.
    if (Array.isArray(attachments) && attachments.length) {
      payload.attachment = attachments.map((a) => ({ name: a.filename || a.name, content: a.content }));
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: body?.message || `HTTP ${res.status}`, response: body };
    return { success: true, id: body.messageId, response: body };
  } catch (err) {
    const msg = err.name === 'AbortError' ? `Brevo timeout after ${EMAIL_TIMEOUT_MS}ms` : err.message;
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { name: 'brevo', sendEmail };
