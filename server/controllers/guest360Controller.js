/**
 * guest360Controller.js — admin "Guest 360" module (read-only v1).
 *
 * The demand-side mirror of Host 360: a per-guest command center for the people
 * who BOOK. Guests aren't a table — identity is resolved from bookings via the
 * CRM customer key (guestResolver). This module only READS and aggregates; write
 * actions (email/WhatsApp, suspend, merge, notes) are a later phase, and the UI
 * deep-links to the existing action screens (booking detail, Host 360, refunds)
 * meanwhile.
 *
 * Every sub-read past the core booking set is best-effort (rowsOrEmpty) so a
 * sparse/missing source degrades the page instead of 500-ing it — same posture
 * as host360Controller's timeline.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { isUuid } = require('../utils/searchSanitize');
const { audit } = require('../services/auditService');
const communicationEngine = require('../services/email/communicationEngine');
const { getProvider } = require('../services/email/providers');
const { aggregateGuests, filterBookingsForKey, redFlags, customerKey } = require('../services/guestResolver');

const BOOKING_COLS = 'id, host_id, service_id, guest_id, guest_name, guest_email, guest_phone, customer_total, payment_status, status, scheduled_at, created_at, updated_at';
const MAX_BOOKINGS = 10000; // ponytail: whole-table scan; fine at current volume, RPC past this.

const rowsOrEmpty = async (builder) => { try { const { data } = await builder; return data || []; } catch (_) { return []; } };

// Every booking row, newest first, capped. One read backs both list and detail.
const allBookings = () => rowsOrEmpty(
  supabaseAdmin.from('bookings').select(BOOKING_COLS).order('created_at', { ascending: false }).range(0, MAX_BOOKINGS - 1),
);

// Resolve a set of profile ids / service ids → Map(id → row) in one query each.
const nameMap = async (table, ids, cols) => {
  const out = new Map();
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return out;
  const rows = await rowsOrEmpty(supabaseAdmin.from(table).select(cols).in('id', list));
  for (const r of rows) out.set(r.id, r);
  return out;
};

// ══════════════════════════════════════
// LIST  GET /api/admin/guest360
// ══════════════════════════════════════
const listGuests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    let guests = aggregateGuests(await allBookings());

    const s = String(req.query.search || '').trim().toLowerCase();
    if (s) {
      const digits = s.replace(/\D/g, '');
      guests = guests.filter((g) =>
        (g.name && g.name.toLowerCase().includes(s)) ||
        (g.email && g.email.includes(s)) ||
        (digits && g.phone && g.phone.includes(digits)));
    }

    const total = guests.length;
    const start = (page - 1) * pageSize;
    res.json({ guests: guests.slice(start, start + pageSize), total, page, pageSize });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// DETAIL  GET /api/admin/guest360/:key   (key = 'p:<10digits>' | 'e:<email>')
// ══════════════════════════════════════
const getGuest = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key || '');
    if (!/^[pe]:.+/.test(key)) return res.status(400).json({ message: 'Invalid guest key' });

    const all = await allBookings();
    const mine = filterBookingsForKey(all, key);
    if (!mine.length) return res.status(404).json({ message: 'Guest not found' });

    const guest = aggregateGuests(mine)[0];
    const bookingIds = mine.map((b) => b.id);

    // Names for the hosts booked with + the services booked.
    const [hosts, services] = await Promise.all([
      nameMap('profiles', mine.map((b) => b.host_id), 'id, name, username'),
      nameMap('services', mine.map((b) => b.service_id), 'id, title'),
    ]);

    const bookings = mine
      .map((b) => ({
        id: b.id, status: b.status, payment_status: b.payment_status,
        customer_total: Number(b.customer_total) || 0,
        scheduled_at: b.scheduled_at, created_at: b.created_at,
        host: b.host_id ? { id: b.host_id, name: hosts.get(b.host_id)?.name || null } : null,
        service: b.service_id ? { id: b.service_id, title: services.get(b.service_id)?.title || null } : null,
      }))
      .sort((a, b) => new Date(b.scheduled_at || b.created_at || 0) - new Date(a.scheduled_at || a.created_at || 0));

    const hostsBooked = [...hosts.values()].map((h) => ({ id: h.id, name: h.name, username: h.username }));
    const refunded = mine.filter((b) => b.payment_status === 'refunded').length;

    // Reviews this guest LEFT (reviews are keyed to their booking).
    const reviews = (await rowsOrEmpty(supabaseAdmin.from('reviews')
      .select('id, booking_id, host_id, rating, comment, created_at').in('booking_id', bookingIds)))
      .map((r) => ({ ...r, host_name: hosts.get(r.host_id)?.name || null }));

    // Support threads — only guests with an account (user_id) have them.
    let support = [];
    if (guest.guest_ids.length) {
      support = await rowsOrEmpty(supabaseAdmin.from('support_threads')
        .select('id, status, rating, created_at').eq('participant_type', 'guest').in('user_id', guest.guest_ids)
        .order('created_at', { ascending: false }));
    }

    // Marketing / CRM contact: matched by phone first, then email. Suppression +
    // opt-out are what an admin needs before deciding to reach out.
    let marketing = null, suppressed = false;
    {
      // select('*') — contact column names vary by migration; read fields
      // defensively below so a schema drift can't blank the whole block.
      let contact = null;
      if (guest.phone) contact = (await rowsOrEmpty(supabaseAdmin.from('contacts')
        .select('*').eq('phone', guest.phone).limit(1)))[0] || null;
      if (!contact && guest.email) contact = (await rowsOrEmpty(supabaseAdmin.from('contacts')
        .select('*').eq('email', guest.email).limit(1)))[0] || null;
      if (contact) {
        // Real column is email_suppressed (not email_optout — that was the v1 bug).
        suppressed = !!(contact.email_suppressed || contact.whatsapp_suppressed || contact.do_not_contact);
        marketing = {
          contact_type: contact.contact_type || null,
          email_suppressed: !!contact.email_suppressed,
          whatsapp_suppressed: !!contact.whatsapp_suppressed,
          do_not_contact: !!contact.do_not_contact,
        };
      }
    }

    // Timeline: bookings + reviews + support + emails to this guest, merged desc.
    const events = [];
    const push = (ts, type, label) => { if (ts) events.push({ ts: new Date(ts).toISOString(), type, label }); };
    mine.forEach((b) => push(b.created_at, 'booking', `Booked ${services.get(b.service_id)?.title || 'a service'}`));
    reviews.forEach((r) => push(r.created_at, 'review', `Left a ${r.rating}★ review`));
    support.forEach((t) => push(t.created_at, 'support', `Support thread (${t.status})`));
    if (guest.guest_ids.length) {
      const emails = await rowsOrEmpty(supabaseAdmin.from('email_logs')
        .select('event_key, status, created_at').in('recipient_user_id', guest.guest_ids)
        .order('created_at', { ascending: false }).limit(50));
      emails.forEach((e) => push(e.created_at, 'email', `Email: ${e.event_key} (${e.status})`));
    }
    events.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    res.json({
      guest: { ...guest, refunded },
      red_flags: redFlags(guest, { refunded, suppressed }),
      hosts_booked: hostsBooked,
      bookings,
      reviews,
      support,
      marketing,
      timeline: events.slice(0, 60),
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// PHASE 3 — WRITE ACTIONS (audited)
// ══════════════════════════════════════

// Resolve one guest (identity + email/phone/linked accounts) from a key, or null.
// Sends the 400/404 itself and returns null so callers can early-return.
const loadGuestByKey = async (req, res) => {
  const key = decodeURIComponent(req.params.key || '');
  if (!/^[pe]:.+/.test(key)) { res.status(400).json({ message: 'Invalid guest key' }); return null; }
  const mine = filterBookingsForKey(await allBookings(), key);
  if (!mine.length) { res.status(404).json({ message: 'Guest not found' }); return null; }
  return aggregateGuests(mine)[0];
};

// ── Notes (guest_admin_notes; keyed by customer key, service-role only) ─────────
const listNotes = async (req, res) => {
  try {
    const guest = await loadGuestByKey(req, res);
    if (!guest) return;
    const { data, error } = await supabaseAdmin.from('guest_admin_notes')
      .select('id, body, admin_email, created_at, updated_at')
      .eq('guest_key', guest.key).order('created_at', { ascending: false });
    // Schema-fallback: table not applied yet → empty list, never a 500.
    if (error) return res.json({ notes: [] });
    res.json({ notes: data || [] });
  } catch (error) { safeError(res, error); }
};

const createNote = async (req, res) => {
  try {
    const guest = await loadGuestByKey(req, res);
    if (!guest) return;
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'body is required' });
    const { data, error } = await supabaseAdmin.from('guest_admin_notes')
      .insert({ guest_key: guest.key, admin_id: req.admin?.id || null, admin_email: req.admin?.email || null, body })
      .select('id, body, admin_email, created_at, updated_at').single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'guest_note.create', resource_type: 'guest', resource_id: guest.key, after: { note_id: data.id } });
    res.status(201).json({ note: data });
  } catch (error) { safeError(res, error); }
};

const deleteNote = async (req, res) => {
  try {
    const guest = await loadGuestByKey(req, res);
    if (!guest) return;
    if (!isUuid(req.params.noteId)) return res.status(400).json({ message: 'Invalid note id' });
    // Scoped by guest_key so a note can't be reached through another guest.
    const { error, count } = await supabaseAdmin.from('guest_admin_notes')
      .delete({ count: 'exact' }).eq('id', req.params.noteId).eq('guest_key', guest.key);
    if (error) return safeError(res, error);
    if (!count) return res.status(404).json({ message: 'Note not found' });
    await audit(req, { action: 'guest_note.delete', resource_type: 'guest', resource_id: guest.key, after: { note_id: req.params.noteId } });
    res.json({ ok: true });
  } catch (error) { safeError(res, error); }
};

// ── Email the guest (ad-hoc, audited) ───────────────────────────────────────
const emailGuest = async (req, res) => {
  try {
    const guest = await loadGuestByKey(req, res);
    if (!guest) return;
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!subject || !body) return res.status(400).json({ message: 'subject and body are required' });
    if (!guest.email) return res.status(400).json({ message: 'This guest has no email on file' });

    const settings = await communicationEngine.loadSettings();
    const provider = getProvider(settings.provider);
    const r = await provider.sendEmail({
      to: guest.email, subject, html: `<div>${body}</div>`,
      fromName: settings.from_name, fromEmail: settings.from_email,
    });
    if (!r.success) return res.status(502).json({ error: `Send failed: ${r.error}` });

    await audit(req, { action: 'guest.email_sent', resource_type: 'guest', resource_id: guest.key, after: { subject } });
    res.json({ ok: true, to: guest.email });
  } catch (error) { safeError(res, error); }
};

// ── Suspend a REGISTERED guest (needs a linked account) ─────────────────────
// A logged-out OTP guest has no profile to ban — 400s rather than pretending.
// Bans every linked profile id and stamps the session watermark (mirrors
// host360.suspendHost: authMiddleware.accountGate revokes issued tokens).
const suspendGuest = async (req, res) => {
  try {
    const guest = await loadGuestByKey(req, res);
    if (!guest) return;
    if (!guest.guest_ids.length) return res.status(400).json({ message: 'This guest has no registered account to suspend' });
    const suspend = !!req.body?.suspend;
    const patch = { is_banned: suspend, updated_at: new Date().toISOString() };
    if (suspend) patch.sessions_valid_after = new Date().toISOString();
    const { error } = await supabaseAdmin.from('profiles').update(patch).in('id', guest.guest_ids);
    if (error) return safeError(res, error);
    await audit(req, { action: 'guest.suspend', resource_type: 'guest', resource_id: guest.key,
      after: { is_banned: suspend, profile_ids: guest.guest_ids } });
    res.json({ ok: true, is_banned: suspend });
  } catch (error) { safeError(res, error); }
};

module.exports = { listGuests, getGuest, listNotes, createNote, deleteNote, emailGuest, suspendGuest };
