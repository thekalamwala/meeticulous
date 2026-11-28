/**
 * contactVisibility.js — anti-disintermediation phone gating.
 *
 * Server-side redaction of phone numbers on any booking payload returned to a
 * client. Response-shaping ONLY: no schema change, no state column. Email and
 * location stay visible both directions (accepted residual — see
 * docs/superpowers/plans/2026-07-14-contact-visibility-gating.md).
 *
 * Policy:
 *   Guest phone → Host : hidden until the booking is imminent/past, on ANY plan
 *                        (pricing v2 §4 item 2), or always for Supreme. The full
 *                        number in the CRM client list/export stays Pro-only —
 *                        that is crmService's maskPhone, not this module.
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
    // Guest's number → host: every plan within the window, or Supreme always.
    const show = isSupreme(viewer.plan) || windowOpen(booking, now);
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
