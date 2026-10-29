/**
 * contactsService — builds the consented, contactable audience by syncing
 * profiles + bookings + product_purchases into the `contacts` table.
 * Derived data: never hand-edited except suppression toggles (preserved here).
 */
'use strict';
const { randomUUID } = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const norm = (e) => (e || '').trim().toLowerCase();

// prospect (cold CRM lead) is the LOWEST rank: syncing a lead never demotes a
// real guest/vendor/buyer, and a prospect who later books gets upgraded to guest.
const TYPE_RANK = { vendor: 3, buyer: 2, guest: 1, prospect: 0 };
const rankType = (a, b) => ((TYPE_RANK[b] || 0) > (TYPE_RANK[a] || 0) ? b : (a || b));

async function loadExistingByEmail() {
  const { data } = await supabaseAdmin.from('contacts').select('*');
  const map = new Map();
  for (const c of data || []) if (c.email) map.set(norm(c.email), c);
  return map;
}

/** Merge a source record into the working map, newest wins for display fields. */
function upsertInto(map, { email, name, phone, type, attrs = {}, userId = null, source }) {
  const key = norm(email);
  if (!key) return; // Phase 1: email channel only
  const prev = map.get(key) || {};
  map.set(key, {
    ...prev,
    email: key,
    name: name || prev.name || '',
    phone: phone || prev.phone || '',
    user_id: userId || prev.user_id || null,
    // vendor outranks buyer outranks guest when a person appears in several sources
    contact_type: rankType(prev.contact_type, type),
    attributes: { ...(prev.attributes || {}), ...attrs },
    source: prev.source ? `${prev.source},${source}` : source,
  });
}

async function sync() {
  const [{ data: profiles }, { data: bookings }, { data: purchases }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, email, name, phone, role, plan'),
    supabaseAdmin.from('bookings').select('guest_email, guest_name, guest_phone, scheduled_at'),
    supabaseAdmin.from('product_purchases').select('buyer_email, buyer_name, buyer_phone'),
  ]);

  const work = new Map();
  for (const p of profiles || []) {
    upsertInto(work, {
      email: p.email, name: p.name, phone: p.phone, type: p.role === 'host' ? 'vendor' : 'guest',
      userId: p.id, attrs: { plan: p.plan || null }, source: 'profile',
    });
  }
  for (const b of bookings || []) {
    upsertInto(work, {
      email: b.guest_email, name: b.guest_name, phone: b.guest_phone, type: 'guest',
      attrs: { last_booking_at: b.scheduled_at }, source: 'booking',
    });
  }
  for (const pu of purchases || []) {
    upsertInto(work, {
      email: pu.buyer_email, name: pu.buyer_name, phone: pu.buyer_phone, type: 'buyer', source: 'purchase',
    });
  }

  // Preserve consent/suppression from existing rows.
  const existing = await loadExistingByEmail();
  const now = new Date().toISOString();
  const rows = [];
  for (const [key, c] of work) {
    const prev = existing.get(key) || {};
    rows.push({
      // Always set id: a mixed batch (some rows with id, some without) makes
      // PostgREST insert an explicit NULL id for the id-less rows, which beats
      // the gen_random_uuid() default and fails the NOT NULL — so the whole
      // upsert errors and nothing syncs. Generate one for new contacts.
      id: prev.id || randomUUID(),
      email: c.email, name: c.name, phone: c.phone, user_id: c.user_id,
      contact_type: c.contact_type, attributes: c.attributes, source: c.source,
      email_opt_in:        prev.email_opt_in        ?? true,
      whatsapp_opt_in:     prev.whatsapp_opt_in     ?? true,
      email_suppressed:    prev.email_suppressed    ?? false,
      whatsapp_suppressed: prev.whatsapp_suppressed ?? false,
      last_synced_at: now, updated_at: now,
    });
  }

  if (rows.length) {
    const { error } = await supabaseAdmin.from('contacts').upsert(rows, { onConflict: 'email' }).select();
    if (error) return { upserted: 0, error: error.message };
  }
  return { upserted: rows.length };
}

// ── Leads → contacts sync ────────────────────────────────────────────────────
// The Sales CRM `leads` table is the source of truth for prospects; the
// marketing engine only sends to `contacts`. This mirrors email-bearing leads
// into contacts (tagged crm_lead, so segments can target them) and back-links
// leads.contact_id, WITHOUT ever clobbering a contact's consent/opt-out. A lead
// marked Do Not Contact is suppressed on both channels so no campaign reaches
// them, matching the CRM send gate.

/** Build the contacts upsert row for one lead, preserving an existing contact's consent. */
function buildLeadContactRow(lead, prev = {}, now) {
  const dnc = !!lead.do_not_contact || lead.status === 'do_not_contact';
  const prevSource = prev.source || '';
  // Cold imported prospects become contact_type='prospect' (firewalled from the
  // generic guest/all-contacts audiences) and carry their lead tags/profession/
  // grade onto the contact so campaign segments can target them.
  const isCold = ['import', 'cold_outreach'].includes(lead.source);
  const leadAttrs = lead.attributes || {};
  return {
    id: prev.id || randomUUID(), // see sync(): id-less rows in a mixed batch fail NOT NULL
    email: norm(lead.email),
    name: lead.name || prev.name || '',
    phone: lead.phone || prev.phone || '',
    user_id: prev.user_id || null,
    contact_type: rankType(prev.contact_type, isCold ? 'prospect' : 'guest'), // never demote a vendor/buyer
    attributes: {
      ...(prev.attributes || {}),
      crm_lead: true,
      lead_status: lead.status || null,
      ...(isCold ? {
        tags: Array.isArray(lead.tags) ? lead.tags : [],
        profession: lead.profession || '',
        grade: leadAttrs.grade || '',
        source_dataset: leadAttrs.source_dataset || '',
      } : {}),
    },
    source: prevSource ? (prevSource.includes('crm_lead') ? prevSource : `${prevSource},crm_lead`) : 'crm_lead',
    email_opt_in:        prev.email_opt_in        ?? true,
    whatsapp_opt_in:     prev.whatsapp_opt_in     ?? true,
    // DNC lead → suppress marketing on both channels; otherwise preserve prior state.
    email_suppressed:    dnc ? true : (prev.email_suppressed    ?? false),
    whatsapp_suppressed: dnc ? true : (prev.whatsapp_suppressed ?? false),
    last_synced_at: now, updated_at: now,
  };
}

async function syncLeads() {
  const { data: leads } = await supabaseAdmin.from('leads')
    .select('id, email, name, phone, status, do_not_contact, contact_id, source, tags, profession, attributes')
    .not('email', 'is', null);
  const withEmail = (leads || []).filter((l) => norm(l.email));
  if (!withEmail.length) return { upserted: 0, linked: 0 };

  const existing = await loadExistingByEmail();
  const now = new Date().toISOString();

  // Dedup leads by email (one contact per address); first lead wins.
  const byEmail = new Map();
  for (const l of withEmail) { const k = norm(l.email); if (!byEmail.has(k)) byEmail.set(k, l); }

  const rows = [...byEmail.values()].map((l) => buildLeadContactRow(l, existing.get(norm(l.email)) || {}, now));
  const { data: upserted, error } = await supabaseAdmin
    .from('contacts').upsert(rows, { onConflict: 'email' }).select('id, email');
  if (error) return { upserted: 0, linked: 0, error: error.message };

  // Back-link leads.contact_id for leads that don't have one yet.
  const idByEmail = new Map((upserted || []).map((c) => [norm(c.email), c.id]));
  let linked = 0;
  for (const l of withEmail) {
    if (l.contact_id) continue;
    const cid = idByEmail.get(norm(l.email));
    if (!cid) continue;
    await supabaseAdmin.from('leads').update({ contact_id: cid, updated_at: now }).eq('id', l.id).is('contact_id', null);
    linked++;
  }
  return { upserted: rows.length, linked };
}

module.exports = { sync, syncLeads, buildLeadContactRow, norm };
