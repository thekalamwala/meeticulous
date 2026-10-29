// crmController.js — Studio Client CRM endpoints. Every handler is host-scoped:
// hostId ALWAYS comes from req.user.id (the auth token), never the request body.
// The Studio gate (requireCrm) runs as route middleware before any of these.
const { supabaseAdmin } = require('../config/supabase');
const crmService = require('../services/crmService');
const { customerKey } = require('../utils/customerKey');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX = 5000;
const fail = (res, err, msg) => { console.error('crm:', msg, err?.message || err); return res.status(500).json({ message: msg }); };

// GET /api/crm/customers?q=&page=&sort=&filter=
const listCustomers = async (req, res) => {
  try {
    const { q = '', page = '1', sort = 'recent', filter = null } = req.query;
    // Free plan sees its N most-recent clients (limits.crm); paid = -1 (unlimited).
    // requireCrm has already blocked crm 0/absent, so this is 10 (free) or -1 (paid).
    const maxClients = req.vendorPlanData?.limits?.crm ?? -1;
    const out = await crmService.listClients(req.user.id, {
      q: String(q), page: Math.max(1, parseInt(page, 10) || 1), sort, filter, maxClients,
    });
    return res.json(out);
  } catch (err) { return fail(res, err, 'Could not load clients.'); }
};

// GET /api/crm/customers/:id
const getCustomer = async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ message: 'Client not found.' });
    const detail = await crmService.getClient(req.user.id, req.params.id);
    if (!detail) return res.status(404).json({ message: 'Client not found.' });
    return res.json(detail);
  } catch (err) { return fail(res, err, 'Could not load client.'); }
};

// GET /api/crm/customers.csv  — fulfils the "Data export" Studio row.
const exportCsv = async (req, res) => {
  try {
    // Export honours the same plan cap as the list — a free host exports only their
    // N most-recent clients, a paid host exports everything (maxClients -1).
    const maxClients = req.vendorPlanData?.limits?.crm ?? -1;
    const { clients } = await crmService.listClients(req.user.id, { pageSize: 100000, sort: 'ltv', maxClients });
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Name', 'Phone', 'Email', 'Bookings', 'Total Spent', 'First Booked', 'Last Booking', 'Recurring'];
    const rows = clients.map((c) => [c.name, c.phone, c.email, c.bookings_count, c.total_spent,
      c.first_booked_at, c.last_booking_at, c.is_recurring ? 'yes' : 'no'].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    return res.send([header.join(','), ...rows].join('\n'));
  } catch (err) { return fail(res, err, 'Could not export clients.'); }
};

// POST /api/crm/customers/resolve { customer_key } → { id }
// Derived-only clients have no persisted row (list returns id:null) until they
// get a note/attribute. The client calls this to obtain a stable UUID handle
// before opening the detail page. Host-scoped; key travels in the BODY (no PII
// in URLs). ensureCustomer is idempotent.
const resolveCustomer = async (req, res) => {
  try {
    const key = String(req.body?.customer_key || '').trim();
    if (!/^[pe]:/.test(key)) return res.status(400).json({ message: 'Invalid client key.' });
    const row = await crmService.ensureCustomer(req.user.id, key);
    return res.json({ id: row.id });
  } catch (err) { return fail(res, err, 'Could not open client.'); }
};

// Resolve the crm_customers handle in :id to a host-owned row (or null).
const ownedCustomer = async (hostId, id) => {
  if (!UUID_RE.test(id)) return null;
  const { data } = await supabaseAdmin
    .from('crm_customers').select('*').eq('id', id).eq('host_id', hostId).maybeSingle();
  return data || null;
};

// POST /api/crm/customers/:id/notes  { body, booking_id? }
const addNote = async (req, res) => {
  try {
    const cust = await ownedCustomer(req.user.id, req.params.id);
    if (!cust) return res.status(404).json({ message: 'Client not found.' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Note cannot be empty.' });
    if (body.length > NOTE_MAX) return res.status(400).json({ message: `Note too long (max ${NOTE_MAX}).` });

    let booking_id = req.body?.booking_id || null;
    if (booking_id) {
      // A pinned note must reference a booking THIS host owns.
      const { data: bk } = await supabaseAdmin
        .from('bookings').select('id').eq('id', booking_id).eq('host_id', req.user.id).maybeSingle();
      if (!bk) return res.status(404).json({ message: 'Booking not found.' });
    }
    const { data, error } = await supabaseAdmin
      .from('crm_notes').insert({ customer_id: cust.id, host_id: req.user.id, body, booking_id })
      .select('*').single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) { return fail(res, err, 'Could not save note.'); }
};

// GET /api/crm/customers/:id/notes
const listNotes = async (req, res) => {
  try {
    const cust = await ownedCustomer(req.user.id, req.params.id);
    if (!cust) return res.status(404).json({ message: 'Client not found.' });
    const { data, error } = await supabaseAdmin
      .from('crm_notes').select('*').eq('customer_id', cust.id).eq('host_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ notes: data || [] });
  } catch (err) { return fail(res, err, 'Could not load notes.'); }
};

// DELETE /api/crm/customers/:id/notes/:noteId
const deleteNote = async (req, res) => {
  try {
    const cust = await ownedCustomer(req.user.id, req.params.id);
    if (!cust) return res.status(404).json({ message: 'Client not found.' });
    const { data, error } = await supabaseAdmin
      .from('crm_notes').delete().eq('id', req.params.noteId).eq('host_id', req.user.id)
      .eq('customer_id', cust.id).select('id');
    if (error) throw error;
    if (!data || !data.length) return res.status(404).json({ message: 'Note not found.' });
    return res.status(204).end();
  } catch (err) { return fail(res, err, 'Could not delete note.'); }
};

// PATCH /api/crm/customers/:id/attributes  { tags?, ... } — shallow-merge into jsonb.
const patchAttributes = async (req, res) => {
  try {
    const cust = await ownedCustomer(req.user.id, req.params.id);
    if (!cust) return res.status(404).json({ message: 'Client not found.' });
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    if (Array.isArray(incoming.tags)) {
      incoming.tags = [...new Set(incoming.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 50);
    }
    const merged = { ...(cust.attributes || {}), ...incoming };
    const { data, error } = await supabaseAdmin
      .from('crm_customers').update({ attributes: merged, updated_at: new Date().toISOString() })
      .eq('id', cust.id).eq('host_id', req.user.id).select('*').single();
    if (error) throw error;
    return res.json(data);
  } catch (err) { return fail(res, err, 'Could not update client.'); }
};

// POST /api/crm/manual-booking  { name, phone?, email?, service_id, amount, date }
// Walk-in / cash record. source='manual_cash' → INCLUDED in host revenue+CRM,
// EXCLUDED from all platform aggregations (enforced by the source filter elsewhere).
// SILENT: no notify / reminder / calendar / invoice / Razorpay / review.
const createManualBooking = async (req, res) => {
  try {
    const { name, phone, email, service_id, amount, date } = req.body || {};
    if (!customerKey({ phone, email }))
      return res.status(400).json({ message: 'A phone number or email is required to log a walk-in.' });
    if (!service_id || !UUID_RE.test(String(service_id)))
      return res.status(400).json({ message: 'Select a service.' });
    const amt = Number(amount);
    if (!(amt >= 0)) return res.status(400).json({ message: 'Enter a valid amount.' });

    // Service must belong to this host (no cross-host manual bookings).
    const { data: svc } = await supabaseAdmin
      .from('services').select('id, duration, grace_period_minutes').eq('id', service_id).eq('host_id', req.user.id).maybeSingle();
    if (!svc) return res.status(404).json({ message: 'Service not found.' });

    const startDt = date ? new Date(date) : new Date();
    const when = startDt.toISOString();
    // P3-12: end_at is NOT NULL (v3.42) and grace_minutes pads the no-overlap
    // constraint — a walk-in insert without them would 23502 the moment this
    // (currently parked) route is enabled.
    const endAt = new Date(startDt.getTime() + (svc.duration || 30) * 60000).toISOString();
    const { data, error } = await supabaseAdmin.from('bookings').insert({
      host_id: req.user.id,
      service_id,
      guest_name: name || null,
      guest_phone: phone || null,
      guest_email: email || null,
      customer_total: amt,
      status: 'completed',
      payment_status: 'paid',
      scheduled_at: when,
      end_at: endAt,
      grace_minutes: svc.grace_period_minutes ?? 10,
      source: 'manual_cash',
    }).select('id, source').single();
    if (error) throw error;
    return res.status(201).json({ booking: data });
  } catch (err) { return fail(res, err, 'Could not log the walk-in.'); }
};

module.exports = {
  listCustomers, getCustomer, exportCsv, resolveCustomer,
  addNote, listNotes, deleteNote, patchAttributes,
  createManualBooking,
};
