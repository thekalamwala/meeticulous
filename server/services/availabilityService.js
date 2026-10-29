/**
 * availabilityService.js — single source of truth for slot availability.
 *
 * Available = Working Hours
 *           − Manual Blocked Dates (availability.blocked_dates)
 *           − Existing Platform Bookings (grace-period aware)
 *           − Google Calendar busy intervals (Free/Busy API)
 *           − Buffer Times (availability.buffer_minutes)
 *
 * Design notes:
 *   - All comparisons happen in UTC; working hours are wall-clock in the
 *     host's timezone and converted per-day with the Intl API (no deps).
 *   - A Google API failure NEVER blocks bookings — it logs and falls back to
 *     platform-only availability (an outage must not take the marketplace down).
 *   - The HARD double-booking guarantee lives in the DB (bookings_no_overlap
 *     exclusion constraint, migration v2.5); this service is the UX layer.
 */

const { supabaseAdmin } = require("../config/supabase");
const { getFreeBusy } = require("../config/google");
const { decrypt: decryptToken } = require("../utils/cryptoTokens");
const { inAppNotify } = require("../utils/inAppNotify");

// P2-03: a connected host whose Google grant is revoked/unreadable silently stops
// getting calendar events + Meet links on every booking, with no signal. On a
// classified auth failure, flip google_calendar_connected off (idempotent — only
// the first flip matches a row) and nudge the host in-app to reconnect. Best-effort,
// fire-and-forget, never throws; subsequent polls short-circuit once the flag is off.
const flagGoogleDisconnected = async (host) => {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .update({ google_calendar_connected: false })
      .eq("id", host.id)
      .eq("google_calendar_connected", true)
      .select("id");
    if (data && data.length) {
      inAppNotify({
        userId: host.id, role: "host", type: "GOOGLE_CALENDAR_DISCONNECTED",
        title: "Reconnect Google Calendar",
        body: "We couldn't access your Google Calendar. New bookings won't get a Meet link until you reconnect it in your profile.",
        link: "/dashboard/profile", data: {},
      });
    }
  } catch (e) {
    console.error("flagGoogleDisconnected failed (non-fatal):", e.message);
  }
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Platform default working hours, applied when a host has set NO availability of
// their own (empty or missing weekly_schedule). Keeps brand-new vendors instantly
// bookable instead of showing an empty calendar. Mon–Sat 10:00–18:00, Sunday off.
// The instant a host adds any custom window, their schedule becomes authoritative.
const DEFAULT_DAY_WINDOWS = Object.freeze([Object.freeze({ start: "10:00", end: "18:00" })]);
const DEFAULT_WEEKLY_SCHEDULE = Object.freeze({
  monday: DEFAULT_DAY_WINDOWS,
  tuesday: DEFAULT_DAY_WINDOWS,
  wednesday: DEFAULT_DAY_WINDOWS,
  thursday: DEFAULT_DAY_WINDOWS,
  friday: DEFAULT_DAY_WINDOWS,
  saturday: DEFAULT_DAY_WINDOWS,
  sunday: [],
});

// Resolve the schedule actually used for slot math. A host with at least one
// custom window keeps their own schedule (including days they deliberately left
// empty = closed). A host with none falls back to DEFAULT_WEEKLY_SCHEDULE.
const effectiveSchedule = (weeklySchedule) => {
  const s = weeklySchedule || {};
  const hasCustom = DAY_NAMES.some((d) => Array.isArray(s[d]) && s[d].length > 0);
  return hasCustom ? s : DEFAULT_WEEKLY_SCHEDULE;
};

// Convert a wall-clock time in `tz` to a UTC Date (mirror of the client's
// wallClockToUTC in ServiceBooking.jsx — keep the two in sync).
const wallClockToUTC = (year, month, day, hour, minute, tz) => {
  const fakeUTC = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const tzStr = fakeUTC.toLocaleString("sv", { timeZone: tz });
  const inTz = new Date(tzStr.replace(" ", "T") + "Z");
  const offsetMs = fakeUTC.getTime() - inTz.getTime();
  return new Date(fakeUTC.getTime() + offsetMs);
};

// Date parts ("YYYY-MM-DD" → {y,m,d}); returns null on bad input.
const parseDateStr = (dateStr) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) };
};

// What calendar date (and weekday) a UTC instant falls on in `tz`.
const dateInTz = (utcDate, tz) => {
  const s = utcDate.toLocaleString("sv", { timeZone: tz }); // "YYYY-MM-DD HH:MM:SS"
  return { dateStr: s.slice(0, 10), dayName: DAY_NAMES[new Date(s.replace(" ", "T") + "Z").getUTCDay()] };
};

const isDateBlocked = (blockedDates, dateStr) =>
  Array.isArray(blockedDates) && blockedDates.some((b) => String(b).slice(0, 10) === dateStr);

// ── Busy intervals ───────────────────────────────────────────────────────────

// Platform bookings overlapping [windowStart, windowEnd], grace-padded.
const getPlatformBusy = async (hostId, windowStart, windowEnd) => {
  const select = "scheduled_at, services(duration, grace_period_minutes)";
  let result = await supabaseAdmin
    .from("bookings")
    .select(select)
    .eq("host_id", hostId)
    .neq("status", "cancelled")
    .gte("scheduled_at", new Date(windowStart.getTime() - 26 * 3600 * 1000).toISOString())
    .lte("scheduled_at", windowEnd.toISOString());
  if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
    result = await supabaseAdmin
      .from("bookings")
      .select("scheduled_at, services(duration)")
      .eq("host_id", hostId)
      .neq("status", "cancelled")
      .gte("scheduled_at", new Date(windowStart.getTime() - 26 * 3600 * 1000).toISOString())
      .lte("scheduled_at", windowEnd.toISOString());
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data || []).map((b) => {
    const start = new Date(b.scheduled_at);
    const grace = (b.services?.grace_period_minutes ?? 10) * 60000;
    const end = new Date(start.getTime() + (b.services?.duration || 30) * 60000);
    return { start: new Date(start.getTime() - grace), end: new Date(end.getTime() + grace) };
  });
};

// Persisted last-good FreeBusy cache (one row per host+day). Survives restarts
// and is shared across instances, so a Google outage degrades to the most
// recent known busy set instead of a blind "all free".
const CACHE_TABLE = "google_freebusy_cache";

// Latency cache TTL: how long a successful FreeBusy fetch is reused before we
// hit Google live again. The slots endpoint is polled per date-pick, so without
// this every click is a ~1s Google round-trip. Tradeoff: an external-calendar
// change can take up to TTL to surface in the picker (platform double-booking
// is still hard-guaranteed by the v2.5 DB exclusion constraint, independent of
// this cache). Env-overridable; default 60s.
const FREEBUSY_TTL_MS = Number(process.env.FREEBUSY_CACHE_TTL_MS) || 60_000;

const readFreeBusyCache = async (hostId, day) => {
  const { data, error } = await supabaseAdmin
    .from(CACHE_TABLE).select("busy, fetched_at")
    .eq("host_id", hostId).eq("day", day).maybeSingle();
  if (error || !data) return null;
  return {
    intervals: (data.busy || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
    fetchedAt: data.fetched_at,
  };
};

const writeFreeBusyCache = async (hostId, day, busy) => {
  try {
    await supabaseAdmin.from(CACHE_TABLE).upsert(
      { host_id: hostId, day, busy, fetched_at: new Date().toISOString() },
      { onConflict: "host_id,day" },
    );
  } catch (err) {
    // Cache table missing (pre-v2.6) or write race — never fatal.
    if (!/Could not find the|does not exist|relation .* does not exist/i.test(err.message || "")) {
      console.error("freebusy cache write failed (non-fatal):", err.message);
    }
  }
};

// Google Calendar busy intervals for the given calendar `day` ("YYYY-MM-DD").
// Returns { intervals, unverified }:
//   - not connected           → { intervals: [], unverified: false }
//   - fresh cache hit (< TTL)  → { intervals: <cached>, unverified: false }
//   - live fetch ok            → { intervals, unverified: false } (and caches)
//   - live fetch FAILS, cache  → { intervals: <cached>, unverified: true }
//   - live fetch FAILS, none   → { intervals: [], unverified: true }
// Fail-open is preserved (an outage never blocks bookings) but the caller now
// knows the calendar could not be verified and can warn the guest.
const getGoogleBusy = async (host, windowStart, windowEnd, day, { useCache = true } = {}) => {
  if (!host?.google_calendar_connected || !host?.google_refresh_token)
    return { intervals: [], unverified: false };

  // Latency cache: reuse a recent successful fetch so a polled date-picker does
  // not make a live Google round-trip on every request. A fresh hit is treated
  // as verified (it was a real successful fetch, just recent). Disabled by the
  // caller (validateSlot) for the booking-time hard check, which must see the
  // host's live external calendar and runs once per booking, not on every poll.
  if (day && useCache) {
    const cached = await readFreeBusyCache(host.id, day);
    if (cached?.fetchedAt &&
        Date.now() - new Date(cached.fetchedAt).getTime() < FREEBUSY_TTL_MS) {
      return { intervals: cached.intervals, unverified: false };
    }
  }

  // A connected host whose refresh token won't decrypt (key rotation, corrupt
  // ciphertext, or a grant revoked/narrowed under #560) can never have their
  // calendar read — every poll would throw and flag the guest with the amber
  // "couldn't reach calendar" banner. decryptToken SILENTLY returns '' on failure,
  // so without this it looks identical to a Google outage. Detect it, log it
  // distinctly + actionably (the fix is a HOST reconnect, not a retry), and skip
  // the doomed live call. Still fail-open + unverified (we genuinely can't check).
  const refreshTok = decryptToken(host.google_refresh_token);
  if (!refreshTok) {
    console.error(`google freebusy: host ${host.id} calendar token unreadable — host must reconnect Google (fail-open)`);
    flagGoogleDisconnected(host); // surface it to the host (idempotent)
    const cached = day ? await readFreeBusyCache(host.id, day) : null;
    return { intervals: cached?.intervals || [], unverified: true };
  }

  try {
    const busy = await getFreeBusy(
      decryptToken(host.google_access_token),
      refreshTok,
      windowStart.toISOString(),
      windowEnd.toISOString(),
    );
    const intervals = busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    if (day) writeFreeBusyCache(host.id, day, busy); // fire-and-forget
    return { intervals, unverified: false };
  } catch (err) {
    // Classify: an auth error (invalid_grant / 401 / 403 / insufficient scope)
    // means the host must reconnect; anything else is a transient Google blip.
    const authFail = /invalid_grant|invalid_credentials|unauthorized|no access|insufficient|401|403/i.test(err.message || "");
    console.error(
      `google freebusy failed for host ${host.id} (${authFail ? "auth — host must reconnect Google" : "transient outage"}, fail-open):`,
      err.message,
    );
    if (authFail) flagGoogleDisconnected(host); // only on a real auth failure, not a transient outage
    if (day) {
      const cached = await readFreeBusyCache(host.id, day);
      if (cached) return { intervals: cached.intervals, unverified: true };
    }
    return { intervals: [], unverified: true };
  }
};

const overlaps = (aStart, aEnd, intervals) =>
  intervals.some((i) => aStart < i.end && aEnd > i.start);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute bookable slots for one date.
 * @returns { slots: ["HH:MM", ...], timezone, blocked: bool }
 */
const computeSlots = async ({ host, service, availability, dateStr, now = new Date() }) => {
  const tz = availability?.timezone || "Asia/Kolkata";
  const parts = parseDateStr(dateStr);
  if (!parts) return { slots: [], timezone: tz, blocked: false };

  if (isDateBlocked(availability?.blocked_dates, dateStr))
    return { slots: [], timezone: tz, blocked: true };

  const schedule = effectiveSchedule(availability?.weekly_schedule);
  // Weekday of this calendar date in the host's tz (noon avoids DST edges)
  const noonUTC = wallClockToUTC(parts.y, parts.mo, parts.d, 12, 0, tz);
  const { dayName } = dateInTz(noonUTC, tz);
  const windows = schedule[dayName] || [];
  if (!windows.length) return { slots: [], timezone: tz, blocked: false };

  const bufferMin = availability?.buffer_minutes || 0;
  const duration = service?.duration || 30;
  const grace = (service?.grace_period_minutes ?? 10) * 60000;
  const stepMin = duration + bufferMin;

  const dayStart = wallClockToUTC(parts.y, parts.mo, parts.d, 0, 0, tz);
  const dayEnd = wallClockToUTC(parts.y, parts.mo, parts.d, 23, 59, tz);
  const [platformBusy, google] = await Promise.all([
    getPlatformBusy(host.id, dayStart, dayEnd),
    getGoogleBusy(host, dayStart, dayEnd, dateStr),
  ]);

  const slots = [];
  for (const { start, end } of windows) {
    const [sh, sm] = String(start).split(":").map(Number);
    const [eh, em] = String(end).split(":").map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) continue;
    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cur + duration <= endMin) {
      const h = Math.floor(cur / 60), m = cur % 60;
      const sStart = wallClockToUTC(parts.y, parts.mo, parts.d, h, m, tz);
      const sEnd = new Date(sStart.getTime() + duration * 60000);
      const sStartPadded = new Date(sStart.getTime() - grace);
      const sEndPadded = new Date(sEnd.getTime() + grace);
      const free =
        sStart > now &&
        !overlaps(sStartPadded, sEndPadded, platformBusy) &&
        !overlaps(sStart, sEnd, google.intervals);
      if (free) slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      cur += stepMin;
    }
  }
  // calendarUnverified: Google was connected but FreeBusy could not be fetched
  // (and no cache) — the slot list may not reflect external calendar events.
  return { slots, timezone: tz, blocked: false, calendarUnverified: google.unverified };
};

/**
 * Validate one concrete slot (used by createBooking + createOrder).
 * @returns { ok: true } | { ok: false, reason }
 */
const validateSlot = async ({ host, service, availability, scheduledAtUTC, excludeBookingId = null, now = new Date() }) => {
  const tz = availability?.timezone || "Asia/Kolkata";
  const start = new Date(scheduledAtUTC);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Invalid time." };
  if (start <= now) return { ok: false, reason: "Cannot book a slot in the past. Please choose a future time." };

  const duration = service?.duration || 30;
  const grace = (service?.grace_period_minutes ?? 10) * 60000;
  const end = new Date(start.getTime() + duration * 60000);
  const { dateStr, dayName } = dateInTz(start, tz);

  if (isDateBlocked(availability?.blocked_dates, dateStr))
    return { ok: false, reason: "The host is unavailable on this date." };

  // Inside a working-hours window? Uses the effective schedule, so a host who
  // hasn't customised is bookable on the platform default (Mon–Sat 10:00–18:00)
  // and a host's own schedule (incl. days left empty = closed) is authoritative.
  const windows = effectiveSchedule(availability?.weekly_schedule)[dayName];
  if (!windows || !windows.length)
    return { ok: false, reason: "The host does not take bookings on this day." };

  const [platformBusy, google] = await Promise.all([
    getPlatformBusyExcluding(host.id, start, end, excludeBookingId),
    getGoogleBusy(host, start, end, dateStr, { useCache: false }), // booking-time check: always live
  ]);
  if (overlaps(new Date(start.getTime() - grace), new Date(end.getTime() + grace), platformBusy))
    return { ok: false, reason: "This time slot is no longer available. Please choose another." };
  if (overlaps(start, end, google.intervals))
    return { ok: false, reason: "The host is busy at this time. Please choose another slot." };
  return { ok: true };
};

// Same as getPlatformBusy but can exclude one booking (payment re-validation
// must not collide with the booking being paid for).
const getPlatformBusyExcluding = async (hostId, windowStart, windowEnd, excludeBookingId) => {
  const run = async (select) => {
    let q = supabaseAdmin
      .from("bookings")
      .select(select)
      .eq("host_id", hostId)
      .neq("status", "cancelled")
      .gte("scheduled_at", new Date(windowStart.getTime() - 26 * 3600 * 1000).toISOString())
      .lte("scheduled_at", new Date(windowEnd.getTime() + 26 * 3600 * 1000).toISOString());
    if (excludeBookingId) q = q.neq("id", excludeBookingId);
    return q;
  };
  let result = await run("id, scheduled_at, services(duration, grace_period_minutes)");
  if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
    result = await run("id, scheduled_at, services(duration)");
  }
  if (result.error) throw new Error(result.error.message);
  return (result.data || []).map((b) => {
    const s = new Date(b.scheduled_at);
    const g = (b.services?.grace_period_minutes ?? 10) * 60000;
    const e = new Date(s.getTime() + (b.services?.duration || 30) * 60000);
    return { start: new Date(s.getTime() - g), end: new Date(e.getTime() + g) };
  });
};

module.exports = { computeSlots, validateSlot, wallClockToUTC, isDateBlocked, effectiveSchedule, DEFAULT_WEEKLY_SCHEDULE };
