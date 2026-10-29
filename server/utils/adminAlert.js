// Best-effort operational alerts to the founder (payment/webhook/cron failures).
//
// Two design rules, both load-bearing:
//   1. NEVER throws. Alerting must not break the request path it's called from.
//      A failed alert is logged and swallowed.
//   2. Throttled per `key`. A burst of identical failures — e.g. Razorpay
//      retrying the SAME failing webhook several times — must send one email,
//      not one per retry. Cooldown is in-memory (resets on deploy), which is
//      fine for alerting.
//
// Call it fire-and-forget (no await) from request handlers so it never adds
// latency to the response.

const sendEmail = require('./sendEmail');
const { logger } = require('./logger');
const { renderLayout } = require('../services/email/emailLayout');
const { themeForCategory } = require('../services/email/emailThemes');
const { infoCard, FONT } = require('../services/email/emailComponents');

// Comma-separated list supported (e.g. "bolt@bookasloth.in, ops@bookasloth.in").
// Providers wrap `to` as [to], so a comma string can't be one recipient — split
// and send one email per address.
const ADMIN_ALERT_EMAIL =
  process.env.ADMIN_ALERT_EMAIL || process.env.SUPER_ADMIN_EMAIL || process.env.SMTP_USER;
const recipients = () =>
  String(ADMIN_ALERT_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);

const COOLDOWN_MS = Number(process.env.ADMIN_ALERT_COOLDOWN_MS) || 15 * 60 * 1000;
const lastSentAt = new Map(); // throttleKey -> epoch ms

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Send a best-effort operational alert email to the founder. Never rejects.
 *
 * @param {object}   opts
 * @param {string}   opts.subject  Short subject (sent prefixed with "[Book A Sloth] ").
 * @param {string[]} [opts.lines]  Body lines; each is HTML-escaped.
 * @param {string}   [opts.key]    Throttle key; defaults to `subject`. Same key
 *                                 within the cooldown window is suppressed.
 * @param {string}   [opts.link]     Optional review URL rendered as a branded CTA button.
 * @param {string}   [opts.category] Optional email_category for header pill + accent
 *                                   theme (e.g. 'Payment Receipt', 'Security Alert').
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function adminAlert({ subject, lines = [], key, link, category = '' } = {}) {
  const to = recipients();
  if (!to.length) return { sent: false, reason: 'no_recipient' };
  if (!subject) return { sent: false, reason: 'no_subject' };

  const throttleKey = key || subject;
  const now = Date.now();
  const prev = lastSentAt.get(throttleKey);
  if (prev && now - prev < COOLDOWN_MS) return { sent: false, reason: 'throttled' };
  lastSentAt.set(throttleKey, now);

  // Render through the SAME branded shell the customer/host emails use
  // (emailLayout 'vendor' variant: Book a Sloth logo header, accent bar, category
  // pill, branded full-width CTA, minimal footer — no unsubscribe nav). This is
  // what makes an ops ping look like a real product email an admin taps into.
  // "K: value" lines become an accent infoCard; the rest render as text.
  const html = (() => {
    try {
      const theme = themeForCategory(category);
      const kv = [];
      const plain = [];
      for (const l of lines) {
        const m = /^([^:]{1,40}):\s*(.+)$/.exec(l);
        if (m) kv.push([m[1].trim(), m[2].trim()]);
        else plain.push(l);
      }
      const parts = [];
      if (plain.length) {
        parts.push(`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#202124;font-family:${FONT};">${escapeHtml(plain[0])}</p>`);
      }
      if (kv.length) parts.push(infoCard(theme, kv)); // infoCard HTML-escapes its own inputs
      for (const p of plain.slice(1)) {
        parts.push(`<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#5f6368;font-family:${FONT};">${escapeHtml(p)}</p>`);
      }
      return renderLayout({
        audience: 'vendor',
        bodyHtml: parts.join(''),
        previewText: escapeHtml(lines[0] || subject), // layout's esc() only handles quotes
        ctaLabel: link ? 'Open in admin' : '',
        ctaUrl: link || '',
        emailCategory: category || '',
        settings: {},
        data: {},
      });
    } catch (err) {
      // Layout must never break an alert — fall back to a plain body.
      logger.error({ event: 'admin_alert_render_failed', subject, message: err.message });
      const body = (lines.length ? lines : [subject]).map((l) => `<p>${escapeHtml(l)}</p>`).join('');
      const btn = link ? `<p><a href="${escapeHtml(link)}">Open in admin</a></p>` : '';
      return `<div style="font-family:sans-serif"><h3>${escapeHtml(subject)}</h3>${body}${btn}</div>`;
    }
  })();

  // text/plain twin — a strong "this is a personal/transactional message" signal
  // for inbox placement, and a graceful fallback for text-only clients.
  const text = [subject, '', ...(lines.length ? lines : []), link ? `\nOpen: ${link}` : '']
    .filter((l) => l !== undefined)
    .join('\n')
    .trim();

  // One email per recipient (providers can't split a comma string). A single
  // failure doesn't abort the rest; we report sent if at least one went out.
  let sentAny = false;
  for (const addr of to) {
    try {
      await sendEmail({ to: addr, subject: `[Book A Sloth] ${subject}`, html, text });
      sentAny = true;
    } catch (err) {
      logger.error({ event: 'admin_alert_failed', subject, to: addr, message: err.message });
    }
  }
  return sentAny ? { sent: true } : { sent: false, reason: 'send_error' };
}

// Test-only: clear the throttle map between cases.
adminAlert._resetThrottle = () => lastSentAt.clear();

module.exports = { adminAlert };
