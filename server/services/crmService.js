// crmService.js — Studio Client CRM. Clients are DERIVED from bookings in-Node
// (grouped by customerKey); these functions never persist client identity —
// crm_customers only hangs host-authored data (attributes/notes/files) off a key.
// ponytail: naive in-Node groupBy; ceiling ~5k bookings/host. Add an aggregation
// RPC (Phase 8) only if a host crosses that.

const { supabaseAdmin } = require('../config/supabase');
const { customerKey, displayFromKey } = require('../utils/customerKey');

const LAPSE_DAYS = 60; // ponytail: hardcoded lapse window; make a host setting only if asked.
const num = (v) => (v == null ? 0 : Number(v) || 0);
const isPaid = (b) => b.payment_status === 'paid';
const bookedAt = (b) => b.scheduled_at || b.created_at;

// Columns pulled once for the whole host, then aggregated in-Node.
const BOOKING_COLS =
  'id, service_id, guest_name, guest_email, guest_phone, customer_total, status, payment_status, scheduled_at, created_at, source';

// Build the per-client aggregate map from a host's raw bookings.
const aggregate = (bookings, now) => {
  const byKey = new Map();
  for (const b of bookings) {
    const key = customerKey({ phone: b.guest_phone, email: b.guest_email });
    if (!key) continue; // no contact = not a CRM client
    let c = byKey.get(key);
    if (!c) {
      c = {
        customer_key: key,
        name: null, phone: null, email: null,
        bookings_count: 0, total_spent: 0,
        first_booked_at: null, last_booking_at: null, next_upcoming_at: null,
        no_show_count: 0, cancel_count: 0,
        _lastTs: 0,
      };
      byKey.set(key, c);
    }
    const ts = new Date(bookedAt(b)).getTime();
    // Identity fields come from the most-recent booking for this key.
    if (ts >= c._lastTs) {
      c._lastTs = ts;
      c.name = b.guest_name || c.name;
      c.phone = b.guest_phone || c.phone;
      c.email = b.guest_email || c.email;
    }
    if (b.status === 'no_show') c.no_show_count += 1;
    if (b.status === 'cancelled') c.cancel_count += 1;
    if (isPaid(b)) {
      c.bookings_count += 1;
      c.total_spent += num(b.customer_total);
      if (!c.first_booked_at || ts < new Date(c.first_booked_at).getTime()) c.first_booked_at = bookedAt(b);
      if (!c.last_booking_at || ts > new Date(c.last_booking_at).getTime()) c.last_booking_at = bookedAt(b);
    }
    // Next upcoming = earliest future, non-cancelled booking.
    if (b.status !== 'cancelled' && ts > now) {
      if (!c.next_upcoming_at || ts < new Date(c.next_upcoming_at).getTime()) c.next_upcoming_at = bookedAt(b);
    }
  }
  return byKey;
};

const shape = (c, crmRow) => ({
  id: crmRow ? crmRow.id : null,           // UUID handle (present once the client has notes/files/attrs)
  customer_key: c.customer_key,
  name: c.name,
  phone: displayFromKey(c.customer_key)?.type === 'phone' ? displayFromKey(c.customer_key).value : c.phone,
  email: c.email,
  bookings_count: c.bookings_count,
  total_spent: Math.round(c.total_spent * 100) / 100,
  ltv: Math.round(c.total_spent * 100) / 100,
  first_booked_at: c.first_booked_at,
  last_booking_at: c.last_booking_at,
  next_upcoming_at: c.next_upcoming_at,
  no_show_count: c.no_show_count,
  cancel_count: c.cancel_count,
  is_recurring: c.bookings_count > 1,
  tags: crmRow?.attributes?.tags || [],
  attributes: crmRow?.attributes || {},
});

// List a host's clients. Options: { q, page, pageSize, sort:'ltv'|'recent', filter:'lapsed', maxClients }
// maxClients: -1 = unlimited (paid plans + admin callers). A positive N caps the
// result to the N most-recent clients — the free Sloth plan's "your 10 most recent
// clients". This is a MONETIZATION gate on the host's OWN customers, not a privacy
// boundary, so a soft view cap is correct.
const listClients = async (hostId, { q = '', page = 1, pageSize = 50, sort = 'recent', filter = null, maxClients = -1 } = {}) => {
  const nowMs = Date.now();
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings').select(BOOKING_COLS).eq('host_id', hostId);
  if (error) throw error;

  const byKey = aggregate(bookings || [], nowMs);
  // Only clients with at least one PAID booking are "real" CRM clients.
  let clients = [...byKey.values()].filter((c) => c.bookings_count > 0);

  // Attach persisted crm_customers rows (host-scoped) so known clients carry their handle.
  const keys = clients.map((c) => c.customer_key);
  let crmByKey = new Map();
  if (keys.length) {
    const { data: rows } = await supabaseAdmin
      .from('crm_customers').select('id, customer_key, attributes').eq('host_id', hostId).in('customer_key', keys);
    crmByKey = new Map((rows || []).map((r) => [r.customer_key, r]));
  }

  let shaped = clients.map((c) => shape(c, crmByKey.get(c.customer_key)));

  if (q) {
    const needle = q.toLowerCase();
    shaped = shaped.filter((c) =>
      [c.name, c.phone, c.email].some((v) => v && String(v).toLowerCase().includes(needle)));
  }
  if (filter === 'lapsed') {
    const cutoff = nowMs - LAPSE_DAYS * 86400000;
    shaped = shaped.filter((c) =>
      c.bookings_count >= 2 && !c.next_upcoming_at &&
      c.last_booking_at && new Date(c.last_booking_at).getTime() < cutoff);
  }

  // Recency order first — it defines WHICH clients the free cap keeps ("most recent N").
  shaped.sort((a, b) => new Date(b.last_booking_at || 0) - new Date(a.last_booking_at || 0));

  // Free-plan cap: keep only the N most-recent clients. ponytail: caps the surfaced
  // list AND the CSV export (both route through here); getClient is not independently
  // capped, but the hidden clients' ids are never returned here, so a free host has no
  // way to address client N+1 — a monetization gate, not a data-protection boundary.
  if (maxClients >= 0) shaped = shaped.slice(0, maxClients);

  // Display sort — LTV re-orders the (capped) set; recency is already applied above.
  if (sort === 'ltv') shaped.sort((a, b) => b.total_spent - a.total_spent);

  const total = shaped.length;
  const start = (page - 1) * pageSize;
  return { clients: shaped.slice(start, start + pageSize), total, page, pageSize };
};

// Idempotent: resolve or create the crm_customers row for (host, key). Used before
// writing a note/file/attribute so a derived-only client gets a persistent handle.
const ensureCustomer = async (hostId, key) => {
  const { data: existing } = await supabaseAdmin
    .from('crm_customers').select('*').eq('host_id', hostId).eq('customer_key', key).maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabaseAdmin
    .from('crm_customers').insert({ host_id: hostId, customer_key: key }).select('*').single();
  if (error) throw error;
  return created;
};

// Full detail for one client (addressed by the crm_customers UUID handle).
// Returns null if the id isn't this host's. History/reviews are read LIVE.
const getClient = async (hostId, customerId) => {
  const { data: crmRow } = await supabaseAdmin
    .from('crm_customers').select('*').eq('id', customerId).eq('host_id', hostId).maybeSingle();
  if (!crmRow) return null;

  const { data: bookings } = await supabaseAdmin
    .from('bookings').select(BOOKING_COLS).eq('host_id', hostId);
  const byKey = aggregate((bookings || []).filter(
    (b) => customerKey({ phone: b.guest_phone, email: b.guest_email }) === crmRow.customer_key), Date.now());
  const agg = byKey.get(crmRow.customer_key);
  const customer = agg ? shape(agg, crmRow) : shape(
    { customer_key: crmRow.customer_key, name: null, phone: null, email: null, bookings_count: 0,
      total_spent: 0, first_booked_at: null, last_booking_at: null, next_upcoming_at: null,
      no_show_count: 0, cancel_count: 0 }, crmRow);

  const history = (bookings || [])
    .filter((b) => customerKey({ phone: b.guest_phone, email: b.guest_email }) === crmRow.customer_key)
    .sort((a, b) => new Date(bookedAt(b)) - new Date(bookedAt(a)));

  let reviews = [];
  const bookingIds = history.map((b) => b.id);
  if (bookingIds.length) {
    const { data: rv } = await supabaseAdmin
      .from('reviews').select('*').in('booking_id', bookingIds);
    reviews = rv || [];
  }
  return { customer, history, reviews };
};

module.exports = { listClients, getClient, ensureCustomer, aggregate, LAPSE_DAYS };
