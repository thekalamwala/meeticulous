/**
 * contactController.js — public "Contact us" form → email to support.
 * Mounted at POST /api/contact. No auth; IP rate-limited at the route.
 */
'use strict';

const sendEmail = require('../utils/sendEmail');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'hello@meeticulous.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escape user input before dropping it into the email HTML body.
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

exports.submitContact = async (req, res) => {
  const name = (req.body?.name || '').trim();
  const email = (req.body?.email || '').trim();
  const phone = (req.body?.phone || '').trim();
  const subject = (req.body?.subject || '').trim();
  const message = (req.body?.message || '').trim();

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'Name, email, subject and message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (message.length > 5000 || subject.length > 200 || name.length > 120) {
    return res.status(400).json({ message: 'One or more fields are too long.' });
  }

  const html = `
    <h2>New contact form message</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Phone:</strong> ${esc(phone) || '—'}</p>
    <p><strong>Subject:</strong> ${esc(subject)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${esc(message)}</p>
  `;

  try {
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Contact] ${subject}`,
      html,
    });
    return res.json({ message: "Thanks — we've received your message and will get back to you soon." });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    return res.status(500).json({ message: 'Could not send your message. Please try again later.' });
  }
};
