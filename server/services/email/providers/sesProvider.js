/**
 * sesProvider.js — Amazon SES implementation of the provider interface.
 *
 * Active when email_settings.provider = 'ses'. Uses the SES v2 SendEmail HTTP
 * endpoint via SigV4 only if @aws-sdk/client-sesv2 is installed; otherwise
 * returns a clear "not configured" error so the abstraction stays swappable
 * without forcing the AWS SDK as a hard dependency.
 */
'use strict';

let _client = null;
function client() {
  if (_client) return _client;
  try {
    const { SESv2Client } = require('@aws-sdk/client-sesv2');
    _client = new SESv2Client({ region: process.env.AWS_REGION || 'ap-south-1' });
    return _client;
  } catch (_) {
    return null;
  }
}

async function sendEmail({ to, subject, html, text, fromName = 'Book A Sloth', fromEmail }) {
  const c = client();
  if (!c) return { success: false, error: 'SES not configured (install @aws-sdk/client-sesv2 and set AWS creds)' };
  try {
    const { SendEmailCommand } = require('@aws-sdk/client-sesv2');
    const from = `${fromName} <${fromEmail || process.env.SES_FROM || 'noreply@bookasloth.in'}>`;
    const body = { Html: { Data: html }, ...(text ? { Text: { Data: text } } : {}) };
    const out = await c.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: { Simple: { Subject: { Data: subject }, Body: body } },
    }));
    return { success: true, id: out.MessageId, response: { MessageId: out.MessageId } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { name: 'ses', sendEmail };
