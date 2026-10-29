// gscClient.js — thin wrapper around googleapis' Search Console client for a
// single non-rotating service-account credential (GSC_SA_KEY + GSC_PROPERTY).
// Never throws on missing/malformed creds — callers no-op via isConfigured().
const { google } = require('googleapis');

let cached = null;

const isConfigured = () => !!(process.env.GSC_SA_KEY && process.env.GSC_PROPERTY);

const siteUrl = () => process.env.GSC_PROPERTY;

const getClient = () => {
  if (!isConfigured()) return null;
  if (cached) return cached;
  let credentials;
  try {
    // Accept the key as raw JSON OR base64-encoded JSON. Env UIs (Render) mangle
    // the newlines inside private_key when raw JSON is pasted, breaking JSON.parse;
    // a base64 blob is one line with nothing to mangle. Raw JSON starts with '{'.
    let raw = (process.env.GSC_SA_KEY || '').trim();
    if (raw && raw[0] !== '{') raw = Buffer.from(raw, 'base64').toString('utf8');
    credentials = JSON.parse(raw);
  } catch (err) {
    console.warn('[gscClient] GSC_SA_KEY is not valid JSON (raw or base64) — skipping:', err.message);
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  cached = google.searchconsole({ version: 'v1', auth });
  return cached;
};

module.exports = { isConfigured, siteUrl, getClient };
