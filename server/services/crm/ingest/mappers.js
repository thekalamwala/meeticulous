'use strict';
/**
 * mappers.js — normalize an external provider's payload into a lead upsert
 * (CRM audit Phase 5). Pure, no DB. Each mapper returns:
 *   { patch, externalId, source, attribution }
 * where `patch` is a leads column subset upsertLead understands, `externalId`
 * is the provider's own lead id (idempotency key), and `attribution` feeds the
 * v3.120 UTM columns. Unknown providers throw so the caller can 400.
 */

const cap = (v, n = 200) => (v == null ? null : String(v).trim().slice(0, n) || null);
const firstNonEmpty = (...xs) => xs.map((x) => cap(x)).find(Boolean) || null;

// Pull a value out of Meta's field_data ([{ name, values:[...] }]) by any alias.
function fromFieldData(fieldData = [], names) {
  const want = new Set(names.map((n) => n.toLowerCase()));
  for (const f of fieldData) {
    if (f && want.has(String(f.name || '').toLowerCase())) {
      const v = Array.isArray(f.values) ? f.values[0] : f.value;
      if (v) return cap(v);
    }
  }
  return null;
}

// Meta Lead Ads. Accepts the leadgen object { leadgen_id, form_id, campaign_id/
// campaign_name, ad_id, field_data:[{name,values}] }.
function metaMapper(p = {}) {
  const fd = p.field_data || p.fieldData || [];
  const patch = {
    name: firstNonEmpty(p.full_name, fromFieldData(fd, ['full_name', 'name'])),
    email: firstNonEmpty(p.email, fromFieldData(fd, ['email'])),
    phone: firstNonEmpty(p.phone, fromFieldData(fd, ['phone_number', 'phone'])),
    business_name: fromFieldData(fd, ['company_name', 'business_name']),
    city: fromFieldData(fd, ['city']),
  };
  const campaign = firstNonEmpty(p.campaign_name, p.campaign_id);
  return {
    patch,
    externalId: cap(p.leadgen_id || p.id, 120),
    source: 'meta',
    attribution: {
      utm_source: 'facebook', utm_medium: 'paid_social',
      utm_campaign: campaign, utm_content: cap(p.ad_id, 120),
    },
  };
}

// Zoho CRM lead. Accepts a Zoho lead record (Full_Name / First_Name+Last_Name,
// Email, Phone/Mobile, Company, Lead_Source, City).
function zohoMapper(p = {}) {
  const name = firstNonEmpty(p.Full_Name, [p.First_Name, p.Last_Name].filter(Boolean).join(' '));
  return {
    patch: {
      name,
      email: firstNonEmpty(p.Email, p.Secondary_Email),
      phone: firstNonEmpty(p.Phone, p.Mobile),
      business_name: cap(p.Company),
      city: cap(p.City),
    },
    externalId: cap(p.id, 120),
    source: 'zoho',
    attribution: p.Lead_Source ? { utm_source: cap(p.Lead_Source) } : null,
  };
}

// Generic website / partner form. Passes through a flat, already-close shape and
// forwards any utm_* the form captured.
function formMapper(p = {}) {
  const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer', 'landing_page'];
  const attribution = {};
  for (const k of UTM) if (p[k]) attribution[k] = cap(p[k], 500);
  return {
    patch: {
      name: firstNonEmpty(p.name, p.full_name),
      email: cap(p.email),
      phone: cap(p.phone),
      business_name: firstNonEmpty(p.business_name, p.company),
      city: cap(p.city),
      profession: cap(p.profession),
    },
    externalId: cap(p.external_id || p.id, 120),
    source: cap(p.source) || 'form',
    attribution: Object.keys(attribution).length ? attribution : null,
  };
}

const MAPPERS = { meta: metaMapper, zoho: zohoMapper, form: formMapper };

/** Map a provider payload → normalized ingest result. Throws on unknown provider. */
function mapPayload(provider, payload) {
  const fn = MAPPERS[String(provider || '').toLowerCase()];
  if (!fn) throw new Error(`unknown ingest provider: ${provider}`);
  const out = fn(payload || {});
  // A lead needs at least one identity field to be useful.
  const { name, email, phone } = out.patch || {};
  out.usable = !!(email || phone || name);
  return out;
}

module.exports = { mapPayload, metaMapper, zohoMapper, formMapper, PROVIDERS: Object.keys(MAPPERS) };
