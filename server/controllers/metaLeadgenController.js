'use strict';
/**
 * metaLeadgenController — Facebook/Instagram Lead Ads webhook (public, signed).
 *
 * When someone submits a Meta Lead Ad form, Meta POSTs a `leadgen` change here
 * with a `leadgen_id` (the form data itself is NOT in the webhook). We verify the
 * X-Hub-Signature-256 over the RAW body (route mounted with express.raw), then
 * fetch the lead's field_data from the Graph API and upsert it into the CRM with
 * `meta_lead_id` = leadgen_id + source 'facebook_lead_ad'. That stored id is what
 * later flows to Meta CAPI as the raw `lead_id` (see utils/trackServer), closing
 * the attribution loop — CRM outcomes map back to the ad that generated the lead.
 *
 * Env:
 *   FB_WEBHOOK_VERIFY_TOKEN — echoed-challenge token for the GET handshake
 *   FB_APP_SECRET           — verifies the POST signature (app's secret)
 *   FB_PAGE_ACCESS_TOKEN    — reads the lead's field_data from the Graph API
 *   FB_API_VERSION          — optional, defaults v19.0 (same as trackServer)
 *
 * Always 200s a verified POST (so Meta doesn't retry a lead we simply can't fetch);
 * 401 only on a bad signature, 503 when unconfigured.
 */
const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const { safeUpsertLead } = require('../services/crm/leadService');

const FB_API_VER = process.env.FB_API_VERSION || 'v19.0';

// GET handshake: Meta calls this once when you subscribe the webhook.
function verifyMetaLeadgen(req, res) {
  const token = process.env.FB_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const verify = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && verify === token) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
}

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256(rawBody, appSecret), hex.
function verifySignature(rawBody, header, appSecret) {
  if (!header || !appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(String(header));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Meta lead field_data → { email, phone, name }. Field names are stable Meta keys;
// custom-question keys are ignored. full_name wins, else first+last.
function mapFieldData(fieldData = []) {
  const get = (name) => {
    const f = fieldData.find((x) => x && x.name === name);
    return f && Array.isArray(f.values) ? f.values[0] : undefined;
  };
  const name = get('full_name') ||
    [get('first_name'), get('last_name')].filter(Boolean).join(' ').trim() || undefined;
  return { email: get('email'), phone: get('phone_number'), name };
}

async function fetchLead(leadgenId, pageToken) {
  const url = `https://graph.facebook.com/${FB_API_VER}/${encodeURIComponent(leadgenId)}` +
    `?fields=field_data,ad_id,form_id,created_time&access_token=${encodeURIComponent(pageToken)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`graph ${resp.status}`);
  return resp.json();
}

async function handleMetaLeadgen(req, res) {
  try {
    const appSecret = process.env.FB_APP_SECRET;
    const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!appSecret || !pageToken) return res.status(503).json({ message: 'webhook not configured' });

    // req.body is a Buffer (express.raw). Sign over the exact bytes received.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    if (!verifySignature(raw, req.headers['x-hub-signature-256'], appSecret)) {
      return res.status(401).json({ message: 'invalid signature' });
    }

    let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).json({ message: 'bad json' }); }

    // Collect every leadgen change across entries. object should be 'page'.
    const leadgenIds = [];
    for (const entry of evt.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen' && change.value && change.value.leadgen_id) {
          leadgenIds.push(String(change.value.leadgen_id));
        }
      }
    }

    // Ack immediately; do the Graph fetch + CRM writes after responding so a slow
    // Graph call can never trip Meta's webhook timeout/retry.
    res.json({ ok: true, received: leadgenIds.length });

    for (const leadgenId of leadgenIds) {
      try {
        const lead = await fetchLead(leadgenId, pageToken);
        const { email, phone, name } = mapFieldData(lead.field_data);
        if (!email && !phone) continue; // nothing to identify the person by
        await safeUpsertLead(
          { email, phone, name, meta_lead_id: leadgenId },
          { source: 'facebook_lead_ad' },
        );
      } catch (e) {
        console.error('[meta-leadgen] fetch/upsert failed (non-fatal):', leadgenId, e.message);
      }
    }
  } catch (e) { safeError(res, e); }
}

module.exports = {
  verifyMetaLeadgen, handleMetaLeadgen,
  _internal: { verifySignature, mapFieldData },
};
