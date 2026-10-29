'use strict';
/**
 * intentEvents.js — record identified top-of-funnel intent into lead_events and
 * feed the lead score.
 *
 * Only allow-listed events with an identifier (email/phone) are useful: an event
 * with no identifier can't attribute to a person, so we drop it (that's PostHog's
 * job). A matched lead gets its last_engaged_at bumped — the behavioural term the
 * score already reads (leadScore) — plus a timeline row, so intent immediately
 * makes the lead rank hotter and shows on the Sales Desk. Events that arrive
 * BEFORE the lead exists sit unattributed until attachToLead() stitches them on
 * lead creation.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { normalizePhone } = require('../aisensyService');

// Buying-intent signals worth scoring. Anything else is rejected so the sink
// can't be spammed with arbitrary slugs.
const ALLOWED = new Set([
  'pricing_viewed', 'plan_viewed', 'demo_requested', 'signup_started',
  'service_viewed', 'newsletter_signup', 'enterprise_inquiry',
]);

const normEmail = (e) => (e ? String(e).trim().toLowerCase() : null);
const normPhone = (p) => normalizePhone(p) || null;

/** Pure: validate + normalise into the lead_events row (lead_id filled later). */
function buildEventRow({ event, email, phone, meta = {}, source = 'web', occurredAt }) {
  if (!ALLOWED.has(event)) return { ok: false, reason: 'unknown_event' };
  const e = normEmail(email);
  const p = normPhone(phone);
  if (!e && !p) return { ok: false, reason: 'no_identifier' };
  return {
    ok: true,
    row: {
      event, email: e, phone: p,
      meta: meta && typeof meta === 'object' ? meta : {},
      source: source || 'web',
      occurred_at: occurredAt || new Date().toISOString(),
    },
  };
}

async function findLead(email, phone) {
  if (phone) {
    const { data } = await supabaseAdmin.from('leads').select('id').eq('phone', phone).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabaseAdmin.from('leads').select('id').eq('email', email).maybeSingle();
    if (data) return data;
  }
  return null;
}

// Bump the behavioural score input + drop a timeline row. Never throws.
async function bumpLead(leadId, event) {
  const now = new Date().toISOString();
  try {
    await supabaseAdmin.from('leads')
      .update({ last_engaged_at: now, last_activity_at: now, updated_at: now }).eq('id', leadId);
    await supabaseAdmin.from('lead_activities').insert({
      lead_id: leadId, type: `intent_${event}`, title: `Intent: ${event.replace(/_/g, ' ')}`,
      meta: { event }, occurred_at: now,
    });
  } catch (_) { /* best-effort */ }
}

/**
 * Record one intent event. Inserts the row, attributes it to a lead if one
 * matches now, and feeds the score. Never throws.
 * @returns {{ stored:boolean, matched?:boolean, reason?:string }}
 */
async function record({ event, email, phone, meta, source, occurredAt } = {}) {
  const built = buildEventRow({ event, email, phone, meta, source, occurredAt });
  if (!built.ok) return { stored: false, reason: built.reason };
  try {
    const lead = await findLead(built.row.email, built.row.phone);
    const { error } = await supabaseAdmin.from('lead_events').insert({ ...built.row, lead_id: lead?.id || null });
    if (error) return { stored: false, reason: error.message };
    if (lead) await bumpLead(lead.id, event);
    return { stored: true, matched: !!lead };
  } catch (e) {
    return { stored: false, reason: e.message };
  }
}

/**
 * On lead creation, attribute any earlier unattributed intent events for this
 * person and bump the score once. Fire-and-forget from the lead create path.
 */
async function attachToLead(lead) {
  if (!lead?.id) return { attributed: 0 };
  const email = normEmail(lead.email);
  const phone = normPhone(lead.phone);
  if (!email && !phone) return { attributed: 0 };
  try {
    const ids = new Set();
    const now = new Date().toISOString();
    if (email) {
      const { data } = await supabaseAdmin.from('lead_events')
        .update({ lead_id: lead.id }).is('lead_id', null).eq('email', email).select('id');
      (data || []).forEach((r) => ids.add(r.id));
    }
    if (phone) {
      const { data } = await supabaseAdmin.from('lead_events')
        .update({ lead_id: lead.id }).is('lead_id', null).eq('phone', phone).select('id');
      (data || []).forEach((r) => ids.add(r.id));
    }
    if (ids.size) {
      await supabaseAdmin.from('leads')
        .update({ last_engaged_at: now, last_activity_at: now, updated_at: now }).eq('id', lead.id);
    }
    return { attributed: ids.size };
  } catch (_) { return { attributed: 0 }; }
}

module.exports = { record, attachToLead, buildEventRow, ALLOWED };
