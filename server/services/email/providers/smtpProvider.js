/**
 * smtpProvider.js — Nodemailer/SMTP implementation of the provider interface.
 * Reuses the existing SMTP env config; this is the default provider.
 */
'use strict';
const nodemailer = require('nodemailer');

let _transporter = null;
const transporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Fail fast on a dead/misconfigured host — nodemailer's defaults (connection
    // 2min, socket 10min) let a bad SMTP config hang callers for minutes. Env-
    // overridable if a slow relay needs more headroom.
    connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 7000,
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS) || 5000,
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS) || 10000,
  });
  return _transporter;
};

async function sendEmail({ to, subject, html, text, fromName = 'Meeticulous', fromEmail, replyTo }) {
  try {
    const from = `"${fromName}" <${fromEmail || process.env.SMTP_USER}>`;
    const info = await transporter().sendMail({ from, to, subject, html, ...(text ? { text } : {}), ...(replyTo ? { replyTo } : {}) });
    return { success: true, id: info.messageId, response: { accepted: info.accepted, response: info.response } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { name: 'smtp', sendEmail };
