'use strict';
/**
 * guestRelationshipEngine.js — the relationship engine for GUESTS (relationship engine
 * PR-9). Guests (bookers) live in `contacts`, not `leads`, and are a different population
 * from the sales pipeline: they are customers, not prospects. So we do NOT shove them into
 * the leads pipeline — we run the SAME pure relationship functions
 * (relationshipHealth.compute / relationshipTouch.*) over a guest-shaped subject and emit
 * `touch_recommendations` with subject_type='guest' + contact_id. The Desk then unions
 * lead- and guest-backed recs (deskService).
 *
 * THE KEY REUSE: relationshipHealth's dominant signal is time-since-a-MEANINGFUL-human-
 * interaction. A guest almost never has one — so, for a guest, the meaningful interaction
 * IS A BOOKING (they showed up and transacted — a real relationship event). We feed the
 * guest's last booking as last_meaningful_interaction_at (unless we have since personally
 * contacted them, in which case the later of the two wins). Health then reads as "booked
 * recently → steady; hasn't rebooked in ~90d → cooling/at_risk", which is exactly the
 * guest relationship signal — with ZERO change to the pure functions.
 *
 * SCOPE: only ACTUAL customers (a paid booking) are processed — a contact who never booked
 * is not a customer relationship. Recent bookers read healthy → no rec (the Desk stays a
 * short, high-signal queue); only guests who have gone quiet, or hit a tenure/booking
 * milestone, surface. NOTHING is sent from here — sends stay gated by crm_admin_sends.
 *
 * Schema fallback: contacts' v3.139 columns may not exist yet on a DB. The health write
 * degrades (flips a flag, stops writing) and the rec write self-guards in
 * touchRecommendationService — so a tick never breaks on an un-migrated DB.
 */
const { supabaseAdmin } = require('../../config/supabase');
const relationshipHealth = require('./relationshipHealth');
const relationshipTouch = require('./relationshipTouch');
const touchRecommendationService = require('./touchRecommendationService');

const BATCH = Number(process.env.GUEST_ENGINE_BATCH) || 500;
const DEAD = new Set(['cancelled', 'no_show', 'refunded']); // dropped from customer counts
const norm = (e) => (e || '').trim().toLowerCase();
const maxIso = (a, b) => {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
};

let healthColumns = true; // flipped false on first "column missing" (pre-v3.139 DB)

// ── PURE (unit-tested) ───────────────────────────────────────────────────────

/**
 * Aggregate a guest's PAID, non-dead bookings into the ctx the pure functions read.
 * @param {object[]} bookings  rows with { payment_status, status, scheduled_at, created_at }
 * @returns {{hasBooking, isPaid, bookingsTotal, bookingsLast30d, firstBookingAt, lastBookingAt}}
 */
function guestCtxFromBookings(bookings = [], now = Date.now()) {
  const since30 = now - 30 * 864e5;
  let total = 0; let last30 = 0; let firstMs = Infinity; let lastMs = -Infinity;
  for (const b of bookings || []) {
    if (!b || b.payment_status !== 'paid') continue;
    if (b.status && DEAD.has(String(b.status).toLowerCase())) continue;
    total += 1;
    const t = b.scheduled_at || b.created_at;
    const ms = t ? new Date(t).getTime() : null;
    if (ms == null || Number.isNaN(ms)) continue;
    if (ms >= since30) last30 += 1;
    if (ms < firstMs) firstMs = ms;
    if (ms > lastMs) lastMs = ms;
  }
  return {
    hasBooking: total > 0,
    isPaid: total > 0,                 // a guest who paid for a booking is a paying customer
    bookingsTotal: total,
    bookingsLast30d: last30,
    firstBookingAt: Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : null,
    lastBookingAt: Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null,
  };
}

/**
 * A guest-shaped subject the pure relationship functions accept. The relationship starts
 * at the first booking (anniversary origin); the "meaningful interaction" is the later of
 * a real human contact and the last booking (see module docstring).
 */
function buildGuestSubject(contact, ctx = {}, now = Date.now()) {
  const meaningfulAt = maxIso(contact.last_meaningful_interaction_at, ctx.lastBookingAt);
  return {
    id: contact.id,
    status: null,                                   // not a lead — no sales status
    last_meaningful_interaction_at: meaningfulAt,
    last_reply_at: null,
    last_activity_at: contact.last_activity_at || ctx.lastBookingAt || null,
    created_at: ctx.firstBookingAt || contact.created_at || null,
  };
}

/** Remap a rec emitted for a guest subject (keyed as a lead by the pure fn) onto the
 *  guest subject: subject_type='guest', contact_id, no lead_id, contact: dedupe_key. */
const toGuestRec = (contactId) => (rec) => ({
  ...rec,
  subject_type: 'guest',
  lead_id: null,
  contact_id: contactId,
  dedupe_key: String(rec.dedupe_key).replace(/^lead:/, 'contact:'),
});

/** Compute a guest's health + touch recs (0..n) from its contact + ctx. PURE. */
function recommendationsForGuest(contact, ctx, now = Date.now()) {
  const subject = buildGuestSubject(contact, ctx, now);
  const health = relationshipHealth.compute(subject, ctx, now);
  const recs = [
    ...relationshipTouch.recommendationsFor(subject, health, ctx, now),
    ...relationshipTouch.milestoneRecommendationsFor(subject, ctx, now),
  ].map(toGuestRec(contact.id));
  return { health, recs };
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function loadGuestContacts() {
  const { data } = await supabaseAdmin.from('contacts')
    .select('id, email, phone, user_id, name, created_at, contact_type, last_meaningful_interaction_at, last_activity_at')
    .in('contact_type', ['guest', 'buyer'])
    .not('email', 'is', null)
    .order('updated_at', { ascending: true }).limit(BATCH);
  return data || [];
}

// Paid bookings for a set of guest emails, grouped by lowercased email.
async function bookingsByEmail(emails) {
  const map = new Map();
  const uniq = [...new Set(emails.map(norm).filter(Boolean))];
  if (!uniq.length) return map;
  const { data } = await supabaseAdmin.from('bookings')
    .select('guest_email, payment_status, status, scheduled_at, created_at')
    .eq('payment_status', 'paid').in('guest_email', uniq);
  for (const b of data || []) {
    const k = norm(b.guest_email);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(b);
  }
  return map;
}

// Guests with an escalated (waiting/assigned) support thread → supportOpen. Matched by
// the contact's linked profile id (user_id); a guest with no account carries no signal.
async function openSupportUserIds(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const { data } = await supabaseAdmin.from('support_threads')
    .select('user_id, status').eq('participant_type', 'guest')
    .in('user_id', ids).in('status', ['waiting', 'assigned']);
  return new Set((data || []).map((t) => t.user_id));
}

async function writeGuestHealth(contactId, health) {
  if (!healthColumns) return;
  const { error } = await supabaseAdmin.from('contacts').update({
    health_state: health.state, health_score: health.score,
    health_signals: health.signals, health_computed_at: new Date().toISOString(),
  }).eq('id', contactId);
  if (error && /column .* does not exist|Could not find/i.test(error.message || '')) {
    healthColumns = false;
    console.warn('[crm] guest engine: health columns missing (run v3.139) — skipping health writeback');
  }
}

/** Cron tick. Leader-elected by the caller. */
async function run(now = Date.now()) {
  const contacts = await loadGuestContacts();
  if (!contacts.length) return { scanned: 0, customers: 0, recs: 0 };
  const byEmail = await bookingsByEmail(contacts.map((c) => c.email));
  const supportOpen = await openSupportUserIds(contacts.map((c) => c.user_id));

  let customers = 0; let recsOut = 0;
  for (const c of contacts) {
    try {
      const ctx = guestCtxFromBookings(byEmail.get(norm(c.email)) || [], now);
      if (!ctx.hasBooking) continue;                 // only actual customers get a relationship pass
      customers += 1;
      ctx.supportOpen = supportOpen.has(c.user_id);
      ctx.negativeFeedback = false;                  // guest-side negative signal wiring is a follow-up
      const { health, recs } = recommendationsForGuest(c, ctx, now);
      await writeGuestHealth(c.id, health);
      if (recs.length) {
        const { inserted } = await touchRecommendationService.upsertOpen(recs, now);
        recsOut += inserted || 0;
      }
    } catch (err) {
      console.error(`[crm] guest engine: contact ${c.id} failed:`, err.message);
    }
  }
  return { scanned: contacts.length, customers, recs: recsOut };
}

module.exports = {
  run,
  // pure, exported for tests:
  guestCtxFromBookings, buildGuestSubject, toGuestRec, recommendationsForGuest,
};
