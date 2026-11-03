'use strict';

/**
 * proTaste.js — the 60-day "Pro taste" for free (Starter) hosts.
 *
 * A free host gets two Pro perks — WhatsApp booking reminders and reschedule
 * alerts — for TASTE_DAYS counted from their FIRST CONFIRMED BOOKING (not signup:
 * most hosts take weeks to land a booking, and a taste spent with no guests is a
 * taste never felt). After that those perks are Pro-only; paid/comped plans always
 * have them. A host with no booking yet hasn't started their taste, so it reads as
 * active (there is nothing to remind about anyway).
 *
 * Fail-open: a DB error reads as "no first booking yet" → active, so a blip never
 * downgrades a host's reminders. No migration — the anchor is derived from bookings.
 */

const { supabaseAdmin } = require('../config/supabase');
const planService = require('./planService');

const TASTE_DAYS = 60;
const DAY_MS = 86400000;

// First booking never changes once it exists, so a found anchor is cached for the
// process lifetime; "none yet" is re-checked after NONE_TTL_MS.
// ponytail: per-process Map, unbounded by host count — fine until ~100k hosts.
const NONE_TTL_MS = 10 * 60 * 1000;
const _cache = new Map(); // hostId -> { at, value: ISO string | null }

/** created_at of the host's first confirmed/completed booking, or null. */
async function firstBookingAt(hostId) {
  if (!hostId) return null;
  const hit = _cache.get(hostId);
  if (hit && (hit.value || Date.now() - hit.at < NONE_TTL_MS)) return hit.value;
  let value = null;
  try {
    const { data } = await supabaseAdmin
      .from('bookings').select('created_at')
      .eq('host_id', hostId).in('status', ['confirmed', 'completed'])
      .order('created_at', { ascending: true }).limit(1);
    value = data?.[0]?.created_at || null;
  } catch (_) { /* fail-open: treated as not started */ }
  _cache.set(hostId, { at: Date.now(), value });
  return value;
}

/** Pure: when the taste ends for a given first-booking time (null if not started). */
function tasteEndsAt(firstAt) {
  if (!firstAt) return null;
  return new Date(new Date(firstAt).getTime() + TASTE_DAYS * DAY_MS);
}

/** Pure: does this host get the taste perks right now? */
function tasteActiveSync(host, firstAt, now = Date.now()) {
  if (!planService.isFreeSlug(planService.resolveVendorPlan(host))) return true; // paid / comped
  const ends = tasteEndsAt(firstAt);
  return !ends || now < ends.getTime();
}

/** Async: WhatsApp reminders + reschedule alerts allowed for this host? */
async function tasteActive(host, hostId = host?.id) {
  // Some booking joins select only contact columns. Without `plan` a Pro host
  // would read as free, so load it rather than guess. Error → keep perks (fail-open).
  if (host?.plan === undefined && hostId) {
    try {
      const { data } = await supabaseAdmin
        .from('profiles').select('plan, plan_expires_at').eq('id', hostId).maybeSingle();
      if (!data) return true;
      host = { ...host, ...data };
    } catch (_) { return true; }
  }
  if (!planService.isFreeSlug(planService.resolveVendorPlan(host))) return true;
  return tasteActiveSync(host, await firstBookingAt(hostId));
}

/** Days left in the taste (0 when over, null when not started). */
function daysLeft(firstAt, now = Date.now()) {
  const ends = tasteEndsAt(firstAt);
  if (!ends) return null;
  return Math.max(0, Math.ceil((ends.getTime() - now) / DAY_MS));
}

const clearCache = () => _cache.clear();

module.exports = { TASTE_DAYS, firstBookingAt, tasteEndsAt, tasteActiveSync, tasteActive, daysLeft, clearCache };
