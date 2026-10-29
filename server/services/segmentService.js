/**
 * segmentService — resolve a segment definition to a contactable recipient list.
 * Consent + suppression for the target channel are ALWAYS enforced here, so no
 * caller can message an opted-out contact.
 *
 * definition = { contact_type?: string, filters?: [{ field, op, value }] }
 *   field is a top-level contact column OR an attributes.<key>.
 *   op ∈ 'eq' | 'neq' | 'exists' | 'gt' | 'lt' | 'contains'
 *   'contains' tests membership in an array field (e.g. attributes.tags).
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');

const getField = (c, field) => (field in c ? c[field] : (c.attributes || {})[field]);

const passes = (c, f) => {
  const v = getField(c, f.field);
  switch (f.op) {
    case 'eq':     return v === f.value;
    case 'neq':    return v !== f.value;
    case 'exists': return v !== null && v !== undefined && v !== '';
    case 'gt':     return v != null && v > f.value;
    case 'lt':     return v != null && v < f.value;
    case 'contains': return Array.isArray(v) && v.includes(f.value);
    default:       return true;
  }
};

const contactable = (c, channel) =>
  channel === 'email'
    ? !!c.email && !!c.email_opt_in && !c.email_suppressed
    : !!c.phone && !!c.whatsapp_opt_in && !c.whatsapp_suppressed;

async function resolve(definition = {}, channel = 'email') {
  const { data, error } = await supabaseAdmin.from('contacts').select('*');
  if (error) return [];
  let rows = (data || []).filter((c) => contactable(c, channel));
  if (definition.contact_type) rows = rows.filter((c) => c.contact_type === definition.contact_type);
  for (const f of definition.filters || []) rows = rows.filter((c) => passes(c, f));
  return rows;
}

/** Count only (used by the builder preview). */
async function count(definition, channel = 'email') {
  return (await resolve(definition, channel)).length;
}

/**
 * Resolve an explicit pick (manual / single audience) to contactable rows.
 * ref = { contact_ids?: string[], emails?: string[] }. Consent + suppression
 * are enforced here too — a hand-picked opted-out contact is still dropped.
 */
async function resolveRefs(ref = {}, channel = 'email') {
  const ids = new Set(ref.contact_ids || []);
  const emails = new Set((ref.emails || []).map((e) => String(e).toLowerCase()));
  if (!ids.size && !emails.size) return [];
  const { data, error } = await supabaseAdmin.from('contacts').select('*');
  if (error) return [];
  return (data || [])
    .filter((c) => ids.has(c.id) || emails.has(String(c.email || '').toLowerCase()))
    .filter((c) => contactable(c, channel));
}

module.exports = { resolve, resolveRefs, count };
