/**
 * contactVisibility.js — anti-disintermediation phone gating.
 *
 * Server-side redaction of phone numbers on any booking payload returned to a
 * client. Response-shaping ONLY: no schema change, no state column. Email and
 * location stay visible both directions (accepted residual — see
 * docs/superpowers/plans/2026-07-14-contact-visibility-gating.md).
 *
 * Policy:
 *   Guest phone → Host : hidden unless host is Studio (professional) and the
 *                        booking is imminent/past, or host is Supreme (always).
 *   Host phone  → Guest: hidden unless the service is offline (in-person) and
 *                        the booking is imminent/past.
 *
 * "15 min before → permanent" is a pure time rule (no state): the number opens
 * 15 min before scheduled_at and stays open forever after. Blocks bulk
 * pre-harvest of a far-future calendar while keeping "revealed once, revealed
 * for good".
 */

const GRACE_MS = 15 * 60 * 1000;

// Booking's number is visible from 15 min before start onward (imminent + past).
const windowOpen = (booking, now) =>
  now >= new Date(booking.scheduled_at).getTime() - GRACE_MS;

// Free tiers never see the counterparty's number; every paid tier does, once
// the window opens. Since v3.165 that means Pro AND the legacy paid
// rows (creator/professional), which now carry the same entitlements.
// Kept as a local set rather than importing planService so this module stays
// pure and DB-free — keep it in lockstep with planService.FREE_SLUGS.
const FREE_SLUGS = new Set(['free', 'starter', 'starter_legacy', 'explorer']);
// An absent/blank plan (a guest viewer) is NOT paid — fail closed.
const isPaid = (slug) => {
  const s = String(slug || '').toLowerCase().trim();
  return !!s && !FREE_SLUGS.has(s);
};
const isSupreme = (slug) => slug === 'supreme';     // hidden god tier — sees all

/**
 * Mutate + return `booking` with the counterparty's phone redacted per policy.
 * Pure over the booking object (+ now); no DB access.
 *
 * @param booking  a booking row; may carry `services` (for meeting_mode) and a
 *                 `profiles` join (the counterparty's profile) and `guest_phone`.
 * @param viewer   { role: 'host' | 'guest', plan?: <slug> }  plan only used for host.
 * @param now      epoch ms (default Date.now()).
 */
function redactBookingContact(booking, viewer, now = Date.now()) {
  if (!booking) return booking;
  const mode = booking.services?.meeting_mode || 'online';

  if (viewer.role === 'host') {
    // Guest's number → host: any paid plan within the window, or Supreme always.
    const show = isSupreme(viewer.plan)
      || (isPaid(viewer.plan) && windowOpen(booking, now));
    if (!show) {
      booking.guest_phone = null;
      if (booking.profiles) booking.profiles.phone = null; // guest profile join
    }
  } else {
    // Host's number → guest: only for offline (in-person) bookings, with window.
    const show = mode === 'offline' && windowOpen(booking, now);
    if (!show && booking.profiles) booking.profiles.phone = null; // host profile join
  }
  return booking;
  // ponytail: email + notes free-text disintermediation accepted (spec residuals)
}

module.exports = { redactBookingContact, windowOpen, GRACE_MS };
