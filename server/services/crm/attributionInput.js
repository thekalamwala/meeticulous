'use strict';
/**
 * attributionInput.js — normalize raw marketing-attribution input (from a client
 * request or an OAuth state payload) into the clean lead columns + a snapshot.
 * Pure, no DB. Whitelists keys, caps lengths, and tolerates both `utm_source`
 * and bare `source`-style keys so any caller shape works.
 */

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
// Raw ad click ids. Kept verbatim (not inferred) so a lead can be matched back to
// the exact Instagram/Meta or Google ad click — the utm_* columns hold the inferred
// source, these hold the join key. fbclid/gclid can be long, so cap at 255.
const CLICK_IDS = ['fbclid', 'gclid'];
// The flat columns a lead row carries (also what the schema-fallback strips).
const ATTRIBUTION_COLUMNS = [...UTM, ...CLICK_IDS, 'referrer', 'landing_page', 'first_touch', 'last_touch'];

const cap = (v, n = 200) => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, n);
  return s || null;
};

/**
 * @param {object} raw  { utm_source|source, utm_medium|medium, …, referrer, landing_page|landing }
 * @returns {object|null} clean flat columns, or null when nothing usable was given
 */
function cleanAttribution(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const k of UTM) out[k] = cap(raw[k] ?? raw[k.replace('utm_', '')]);
  for (const k of CLICK_IDS) out[k] = cap(raw[k], 255);
  out.referrer = cap(raw.referrer, 500);
  out.landing_page = cap(raw.landing_page ?? raw.landing, 500);
  const hasAny = UTM.some((k) => out[k]) || CLICK_IDS.some((k) => out[k]) || out.referrer || out.landing_page;
  return hasAny ? out : null;
}

/** A point-in-time snapshot for first_touch / last_touch jsonb. */
function touchSnapshot(clean, at) {
  return { ...clean, at: at || new Date().toISOString() };
}

/** Remove attribution columns from a row (schema-fallback when the migration
 *  hasn't run on this DB yet). Returns a new object. */
function stripAttributionColumns(row = {}) {
  const out = { ...row };
  for (const c of ATTRIBUTION_COLUMNS) delete out[c];
  return out;
}

/** Does a Supabase/Postgres error mean an attribution column is missing? */
function isMissingColumnError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = String(error.message || '');
  return code === '42703' || code === 'PGRST204' ||
    /column .* does not exist/i.test(msg) ||
    /could not find the '.*' column/i.test(msg);
}

module.exports = {
  UTM, CLICK_IDS, ATTRIBUTION_COLUMNS,
  cleanAttribution, touchSnapshot, stripAttributionColumns, isMissingColumnError,
};
