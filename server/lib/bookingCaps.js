// Host-configurable booking caps (Pro power-host control). See migration v3.207.
//
// A host sets any of cap_per_day / cap_per_week / cap_per_guest on their
// `availability` row. A new booking is blocked if it would push the host over a
// set cap. Enforced inside createBooking's `booking-quota:<host>` lock so the
// count→insert is race-safe, exactly like the yearly plan cap.
//
// Caps are enforced for PRO hosts only; a free host's values are ignored (and
// the server strips them on save). null / <=0 on a cap = that cap is off.
const { wallClockToUTC } = require("../services/availabilityService");
const planService = require("../services/planService");

const digits10 = (s) => String(s || "").replace(/\D/g, "").slice(-10);

// Pure decision: given the caps and the current counts (NOT yet including the
// new booking), is one more booking allowed? Exported for unit testing.
// `counts` omits a window when that cap is off, so it's never queried.
function capDecision({ caps = {}, counts = {} }) {
  const over = (cap, count) => {
    const c = Number(cap);
    return Number.isFinite(c) && c >= 1 && Number(count || 0) >= c;
  };
  if (over(caps.cap_per_day, counts.day))
    return { allowed: false, message: "This host isn't taking any more bookings on that day. Please pick another date." };
  if (over(caps.cap_per_week, counts.week))
    return { allowed: false, message: "This host is fully booked for that week. Please pick a date in another week." };
  if (over(caps.cap_per_guest, counts.guest))
    return { allowed: false, message: "You've reached the maximum number of bookings this host allows per guest." };
  return { allowed: true };
}

// UTC [start, end) bounds of the host-tz calendar day and ISO week (Mon–Sun)
// that `scheduledAt` falls in. Reuses availabilityService.wallClockToUTC so the
// day boundaries match slot generation exactly. Date.UTC normalises day overflow
// (e.g. d+1 past month end), so no manual roll-over is needed.
function windowsFor(scheduledAt, tz) {
  const s = new Date(scheduledAt).toLocaleString("sv", { timeZone: tz }); // "YYYY-MM-DD HH:MM:SS"
  const y = +s.slice(0, 4), mo = +s.slice(5, 7) - 1, d = +s.slice(8, 10);
  const dow = new Date(s.replace(" ", "T") + "Z").getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (dow + 6) % 7; // days since Monday
  return {
    dayStart: wallClockToUTC(y, mo, d, 0, 0, tz),
    dayEnd: wallClockToUTC(y, mo, d + 1, 0, 0, tz),
    weekStart: wallClockToUTC(y, mo, d - mondayOffset, 0, 0, tz),
    weekEnd: wallClockToUTC(y, mo, d - mondayOffset + 7, 0, 0, tz),
  };
}

// DB-backed enforcement. Returns { allowed } or { allowed:false, message }.
// Fails OPEN on error — a cap is a host convenience, not a money/security gate,
// so a transient DB hiccup should not block a legitimate booking.
async function checkBookingCaps({
  supabaseAdmin, hostId, hostProfile, planSlug, avail,
  scheduledAt, guestId, guestEmail, guestPhone,
}) {
  try {
    const caps = {
      cap_per_day: avail?.cap_per_day,
      cap_per_week: avail?.cap_per_week,
      cap_per_guest: avail?.cap_per_guest,
    };
    const anySet = ["cap_per_day", "cap_per_week", "cap_per_guest"]
      .some((k) => Number(caps[k]) >= 1);
    if (!anySet) return { allowed: true };

    // Pro-only: free hosts' caps are dormant.
    const slug = planSlug || planService.resolveVendorPlan(hostProfile);
    if (planService.isFreeSlug(slug)) return { allowed: true };

    const counts = {};

    if (Number(caps.cap_per_day) >= 1 || Number(caps.cap_per_week) >= 1) {
      const tz = avail?.timezone || "Asia/Kolkata";
      const w = windowsFor(scheduledAt, tz);
      const countRange = async (from, to) => {
        const { count } = await supabaseAdmin
          .from("bookings").select("id", { count: "exact", head: true })
          .eq("host_id", hostId).neq("status", "cancelled")
          .gte("scheduled_at", from.toISOString())
          .lt("scheduled_at", to.toISOString());
        return count || 0;
      };
      if (Number(caps.cap_per_day) >= 1) counts.day = await countRange(w.dayStart, w.dayEnd);
      if (Number(caps.cap_per_week) >= 1) counts.week = await countRange(w.weekStart, w.weekEnd);
    }

    if (Number(caps.cap_per_guest) >= 1) {
      // Per-guest = lifetime non-cancelled bookings for this host+guest. Guest
      // identity is phone-first (product rule), falling back to account id then
      // email — whichever the booking carries.
      let q = supabaseAdmin
        .from("bookings").select("id", { count: "exact", head: true })
        .eq("host_id", hostId).neq("status", "cancelled");
      const phone = digits10(guestPhone);
      if (guestId) q = q.eq("guest_id", guestId);
      else if (phone.length === 10) q = q.ilike("guest_phone", `%${phone}`);
      else if (guestEmail) q = q.eq("guest_email", guestEmail);
      else return capDecision({ caps, counts }); // no identity → can't attribute, skip guest cap
      const { count } = await q;
      counts.guest = count || 0;
    }

    return capDecision({ caps, counts });
  } catch (err) {
    console.error("checkBookingCaps error (failing open):", err.message);
    return { allowed: true };
  }
}

module.exports = { capDecision, checkBookingCaps, windowsFor };
