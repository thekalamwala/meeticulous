const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require('../utils/httpError');
const { adminAlert } = require('../utils/adminAlert');
const { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = require("../config/google");
const featureFlags = require("../services/featureFlags");
const sendEmail = require("../utils/sendEmail");
const NotificationEngine = require("../services/notificationEngine");
const { checkBookingReceiveLimit } = require("../middleware/planMiddleware");
const { parseListRange } = require("../utils/pagination");
const { runExclusive } = require("../utils/keyedMutex");
const crypto = require("crypto");
const { computeBreakdown } = require("../lib/pricingEngine");
const planService = require("../services/planService");
const { redactBookingContact } = require("../lib/contactVisibility");
const platformConfig = require("../services/platformConfig");
const stateService = require("../services/stateService");
const availabilityService = require("../services/availabilityService");
const { decrypt: decryptToken } = require("../utils/cryptoTokens");
const { capture: phCapture, resolveGuestId } = require("../utils/posthog");
const { trackServer } = require("../utils/trackServer");
const manageBookingToken = require("../utils/manageBookingToken");
const { runInBackground } = require("../utils/background");
const { hostOf } = require("../utils/hostOf");
const profileSecrets = require("../utils/profileSecrets");
const guestGrant = require("../utils/bookingGrant");
const { inAppNotify } = require("../utils/inAppNotify");

// F13: the booking lifecycle state graph, in ONE place. The host/guest handlers
// enforce their slice of it inline (P0-2/P1-5/M-1), but the admin editor wrote
// `status` raw — so an admin could force cancelled→completed (re-recognising
// revenue for a cancelled session) or completed→confirmed (un-closing a settled
// row). This is the shared validator the admin path now calls; the terminal states
// (completed / cancelled / no_show) allow no onward transition. A no-op (from===to)
// is always allowed so an idempotent write doesn't 409.
const BOOKING_TRANSITIONS = Object.freeze({
  pending:   ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show:   [],
});
const isValidBookingTransition = (from, to) =>
  from === to || (BOOKING_TRANSITIONS[from] || []).includes(to);

// Redact the counterparty's phone on a single booking before returning it to the
// caller (anti-disintermediation). Role = host if the caller owns the host side,
// else guest; host plan fetched only when needed. See lib/contactVisibility.js.
const redactForRequest = async (booking, req, now = Date.now()) => {
  if (!booking) return booking;
  const role = req.user?.id === booking.host_id ? "host" : "guest";
  let plan;
  if (role === "host") {
    const { data: p } = await supabaseAdmin
      .from("profiles").select("plan, plan_expires_at").eq("id", req.user.id).single();
    plan = planService.resolveVendorPlan(p || {});
  }
  return redactBookingContact(booking, { role, plan }, now);
};

const emailHtml = (body) => `
  <div style="max-width:520px;margin:0 auto;padding:26px;border-radius:24px;background:#ffffff;font-family:'Plus Jakarta Sans','Poppins',sans-serif;color:#111827;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
    ${body}
    <div style="margin-top:24px;padding:18px;border-radius:18px;background:#f8fafc;color:#6b7280;font-size:14px;">Meeticulous — booking made easy.</div>
  </div>`;

const row = (label, value) =>
  `<p style="margin:0 0 12px;font-size:15px;color:#374151;"><strong>${label}:</strong> ${value}</p>`;

const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:12px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">${label}</a>`;

// WhatsApp template params for the approved AiSensy booking templates:
//   customer: [customerName, serviceTitle, vendorName, dateTime]
//   vendor:   [vendorName, customerName, serviceTitle, dateTime]
// `actionLink` is OPTIONAL and APPEND-ONLY: it fills a 5th body variable =
// join/directions link (Meet link when online, host map link when offline).
// Only the REMINDER AiSensy template carries this 5th var, so only the reminder
// caller passes actionLink. The CONFIRMED template is 4-var (its 5th link param
// was removed ~Jul 2026 — #649; sending it fails "Template params does not
// match"), and the cancelled/rescheduled templates are 4-var too, so those
// callers omit actionLink and keep the 4-param shape.
const customerParams = ({ guestName, serviceTitle, hostName, when, actionLink }) => {
  const p = [guestName || "Customer", serviceTitle || "Service", hostName || "Host", when];
  if (actionLink) p.push(actionLink);
  return p;
};
const vendorParams = ({ guestName, serviceTitle, hostName, when, actionLink }) => {
  const p = [hostName || "Host", guestName || "Customer", serviceTitle || "Service", when];
  if (actionLink) p.push(actionLink);
  return p;
};

// Resolve a host's display timezone from their availability row (audit P1-8).
// The cancel/complete/reschedule-ack/reminder notifications used to format the
// "when" string with a bare toLocaleString("en-IN") (no timeZone) → it rendered
// in the SERVER's timezone (Render = UTC), showing guests a time 5.5h off what
// they booked and causing missed sessions. Defaults to IST.
const resolveHostTz = async (hostId) => {
  try {
    const { data } = await supabaseAdmin
      .from("availability").select("timezone").eq("host_id", hostId).maybeSingle();
    return data?.timezone || "Asia/Kolkata";
  } catch (_) {
    return "Asia/Kolkata";
  }
};

// ── Email placeholder data for the Communication Engine templates ──
// Split a scheduled time into {{booking_date}} / {{booking_time}}.
const splitWhen = (scheduledAt, tz = "Asia/Kolkata") => {
  const d = new Date(scheduledAt);
  return {
    booking_date: d.toLocaleDateString("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    booking_time: d.toLocaleTimeString("en-IN", { timeZone: tz, hour: "2-digit", minute: "2-digit" }),
    booking_day: d.toLocaleDateString("en-IN", { timeZone: tz, day: "2-digit" }),
    booking_month: d.toLocaleDateString("en-IN", { timeZone: tz, month: "short" }).toUpperCase(),
    booking_year: d.toLocaleDateString("en-IN", { timeZone: tz, year: "numeric" }),
  };
};
// Placeholder map shared by customer + vendor booking emails.
const bookingEmailData = ({ serviceTitle, hostName, hostPhone, guestName, scheduledAt, tz, bookingId, online, actionLink, mapLink, hostLocation }) => {
  const dashboard = `${process.env.CLIENT_URL || "https://bookasloth.com"}/dashboard`;
  // Online → Meet link (or dashboard). Offline → the host's map link (or dashboard).
  const link = online ? (actionLink || dashboard) : (mapLink || dashboard);
  return {
    service_name: serviceTitle || "Service",
    vendor_name: hostName || "Host",
    vendor_phone: hostPhone || "",
    user_name: guestName || "Customer",
    booking_id: bookingId || "",
    // Location line: "Online" for online; the host's city text for offline (or a
    // neutral "In person" when only a map link is set). Empty when the caller
    // passes no venue info at all — preserves the lifecycle emails (cancel /
    // complete / reschedule) that don't carry mode/venue. Map link is the CTA below.
    location: online ? "Online" : (hostLocation || (mapLink ? "In person" : "")),
    // CTA: online → Join meeting when a Meet link exists; offline → Get directions
    // when the host set a map link. Falls back to a plain "View booking" otherwise.
    action_link: link,
    action_label: online
      ? (actionLink ? "Join meeting" : "View booking")
      : (mapLink ? "Get directions" : "View booking"),
    // Public, session-less manage/cancel link for THIS booking (#516). The
    // confirmed-customer email CTA points here so anonymous guests (no login)
    // aren't stranded. Falls back to the dashboard if no booking id.
    manage_url: bookingId
      ? `${process.env.CLIENT_URL || "https://bookasloth.com"}/manage-booking/${manageBookingToken.sign(bookingId)}`
      : dashboard,
    ...splitWhen(scheduledAt, tz),
  };
};

const BOOKING_SERVICE_SELECT =
  "scheduled_at, services(duration, grace_period_minutes)";
const BOOKING_SERVICE_SELECT_FALLBACK = "scheduled_at, services(duration)";

const selectBookingServiceRows = async (buildQuery) => {
  let result = await buildQuery(BOOKING_SERVICE_SELECT);
  // Retry with fallback if schema cache doesn't recognize newer columns
  if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
    result = await buildQuery(BOOKING_SERVICE_SELECT_FALLBACK);
  }
  return result;
};

const selectServiceWithFallback = async (query) => {
  let result = await query.select("*");
  // Fallback to core fields if schema cache is stale
  if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
    result = await query.select("id, service_id, host_id, guest_id, guest_name, guest_email, guest_phone, scheduled_at, status, payment_status, meeting_link, notes, created_at, updated_at");
  }
  return result;
};

// GET /api/bookings/service/:id  (public, unauthenticated)
const getServiceById = async (req, res) => {
  try {
    // Security audit M-7: this endpoint is unauthenticated, so only ACTIVE
    // services may be returned — otherwise anyone with a service UUID could read
    // a draft/deactivated listing. (The authenticated host dashboards use other
    // endpoints to preview their own inactive services.)
    let serviceResult = await supabaseAdmin
      .from("services")
      .select("*")
      .eq("id", req.params.id)
      .eq("is_active", true)
      .single();
    // Fallback if schema cache is stale
    if (serviceResult.error && /Could not find the|column.*does not exist/i.test(serviceResult.error.message)) {
      serviceResult = await supabaseAdmin
        .from("services")
        .select("id, host_id, title, description, type, duration, price, currency, meeting_mode, is_active, created_at, updated_at")
        .eq("id", req.params.id)
        .eq("is_active", true)
        .single();
    }
    const { data: service, error } = serviceResult;
    if (error || !service)
      return res.status(404).json({ message: "Service not found" });
    const { data: host } = await supabaseAdmin
      .from("profiles")
      // P2-13: no host email on this public/unauthenticated endpoint — service
      // UUIDs are public, and the booking UI doesn't need the host's email
      // (dropping it stops targeted phishing/spam harvesting of hosts).
      .select("id, name, username, tagline, profile_image, location, map_link")
      .eq("id", service.host_id)
      .single();
    res.json({ service, host });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/bookings/slots?host_id=&date=  — Task 3
const getBookedSlots = async (req, res) => {
  try {
    const { host_id, date } = req.query;
    if (!host_id || !date)
      return res.status(400).json({ message: "host_id and date are required" });
    // P3-5: bound the query in the HOST's timezone, not the server's (Render = UTC).
    // setHours ran in server-local time, shifting the "day" by the host's offset
    // (±5.5h for IST) and returning the wrong day's bookings near midnight.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
    if (!m) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    const { wallClockToUTC } = require("../services/availabilityService");
    const { data: bsAvail } = await supabaseAdmin
      .from("availability").select("timezone").eq("host_id", host_id).maybeSingle();
    const bsTz = bsAvail?.timezone || "Asia/Kolkata";
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    const start = wallClockToUTC(y, mo, d, 0, 0, bsTz);
    const end = wallClockToUTC(y, mo, d + 1, 0, 0, bsTz); // exclusive next host-local midnight
    const { data, error } = await selectBookingServiceRows((select) =>
      supabaseAdmin
        .from("bookings")
        .select(select)
        .eq("host_id", host_id)
        .neq("status", "cancelled")
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString()),
    );
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/bookings/available-slots?host_id=&service_id=&date=YYYY-MM-DD
// Server-computed availability: working hours − blocked dates − platform
// bookings − Google busy − buffers. The client renders this list verbatim.
const getAvailableSlots = async (req, res) => {
  try {
    const { host_id, service_id, date } = req.query;
    if (!host_id || !service_id || !date)
      return res.status(400).json({ message: "host_id, service_id and date are required" });

    const [{ data: service }, { data: host }, { data: availability }] = await Promise.all([
      supabaseAdmin.from("services").select("id, duration, grace_period_minutes").eq("id", service_id).single(),
      supabaseAdmin.from("profiles").select("id, google_calendar_connected").eq("id", host_id).single(),
      supabaseAdmin.from("availability").select("*").eq("host_id", host_id).maybeSingle(),
    ]);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (!host) return res.status(404).json({ message: "Host not found" });
    await profileSecrets.attachGoogleTokens(host);

    const result = await availabilityService.computeSlots({
      host, service, availability, dateStr: date,
    });
    res.json(result);
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/bookings
const createBooking = async (req, res) => {
  try {
    const {
      service_id,
      scheduled_at,
      notes,
      booking_grant,
    } = req.body;
    // guest contact is mutable: for an authenticated booker it is overridden
    // below with the account's verified contact (audit P1-4).
    let { guest_name, guest_email, guest_phone } = req.body;

    // ── Input validation (security audit M-5) — defence-in-depth; reject junk
    // before any DB work and before user-controlled values reach notifications. ──
    if (typeof service_id !== "string" || !service_id)
      return res.status(400).json({ message: "A valid service is required." });
    if (
      guest_email != null &&
      !(typeof guest_email === "string" &&
        guest_email.length <= 254 &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest_email))
    )
      return res.status(400).json({ message: "Enter a valid email address." });
    if (scheduled_at == null || Number.isNaN(new Date(scheduled_at).getTime()))
      return res.status(400).json({ message: "Choose a valid time slot." });

    // ── OTP gate (security audit H-1) ──
    // An anonymous booking must present a short-lived grant issued by
    // /auth/verify-otp, bound to the contact that received the code. Logged-in
    // users (req.user, set by `protect`) are already authenticated. Without this
    // the API trusts a bare guest_email/phone → anyone can create bookings for
    // any address (notification/phishing relay + slot squatting).
    if (!req.user) {
      if (!guest_email && !guestGrant.normalizePhone(guest_phone))
        return res.status(400).json({ message: "A valid email or mobile number is required." });
      if (!guestGrant.verify(booking_grant, { email: guest_email, phone: guest_phone }))
        return res
          .status(401)
          .json({ message: "Please verify your email or mobile with the code we sent, then book." });
    }
    // SECURITY: host_id is NEVER taken from the request body. The client could
    // pass any host_id (mismatched from the service) to attach a booking to the
    // wrong vendor, bypass that vendor's availability, or harvest another host's
    // booking cap. host_id is derived below from the service the booking is for.
    // guest_id is likewise never taken from the body (IDOR) — see resolvedGuestId.

    // Fetch the service first: it is the authority for host_id and must be a
    // live, bookable service. A missing OR inactive service is "not available".
    const { data: service } = await supabaseAdmin
      .from("services").select("*").eq("id", service_id).single();
    if (!service || service.is_active === false)
      return res.status(404).json({ message: "Service not available" });

    // Derive host_id from the service — the only trustworthy source.
    const host_id = service.host_id;

    // Host + availability are now keyed off the derived host_id. These two reads
    // are independent → fetch them in one round-trip.
    const [
      { data: host },
      { data: avail },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", host_id).single(),
      supabaseAdmin.from("availability").select("*").eq("host_id", host_id).maybeSingle(),
    ]);
    if (!host) return res.status(404).json({ message: "Host not found" });
    await profileSecrets.attachGoogleTokens(host);

    // Resolve guest_id server-side (never from the body, never from an email
    // lookup). Only a logged-in user links to their own id; an anonymous booking
    // gets guest_id = null and is identified solely by guest_email/name/phone.
    // (Matching an arbitrary email to an existing profile would let an attacker
    // file bookings under any victim's account.)
    const resolvedGuestId = req.user?.id || null;

    // P1-4: an authenticated booker's notification contact is their own verified
    // account contact, never the request body. Without this a logged-in user
    // could put any victim's email/phone in the body and the platform would send
    // host-branded "booking confirmed" emails/WhatsApp to them (auth'd relay).
    if (req.user) {
      const { data: gp } = await supabaseAdmin
        .from("profiles").select("name, email, phone").eq("id", req.user.id).single();
      guest_email = gp?.email || req.user.email || guest_email;
      guest_phone = gp?.phone || guest_phone || null;
      guest_name = guest_name || gp?.name || "Guest";
    }

    // A host cannot book their own service. It is circular money (the host pays
    // the platform, the platform pays the host back minus commission/PG/TDS/TCS,
    // so the host LOSES money to book himself) and it double-lists the one row in
    // both the host dashboard and the guest console. Block at creation — this is
    // the single choke point every booking routes through. guest_email/guest_phone
    // are, for a logged-in booker, already forced to their own account contact
    // just above, so the contact match below also catches a logged-OUT host who
    // enters their own email/phone.
    const digits10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
    const isSelfBooking =
      (resolvedGuestId && resolvedGuestId === host_id) ||
      (guest_email && host.email &&
        guest_email.trim().toLowerCase() === host.email.trim().toLowerCase()) ||
      (digits10(guest_phone).length === 10 &&
        digits10(guest_phone) === digits10(host.phone));
    if (isSelfBooking)
      return res.status(400).json({ message: "You can't book your own service." });
    // ponytail: a logged-OUT host using a burner email/phone still slips through —
    // with no account link it is indistinguishable from a real third-party guest
    // (no circular money at the account level). Not chased.

    const hostTimezone = avail?.timezone || "Asia/Kolkata";

    // Full availability validation: past, blocked dates, working-hours window,
    // platform double-booking (grace-aware) AND Google Calendar busy periods.
    const newStart = new Date(scheduled_at);
    const newEnd = new Date(newStart.getTime() + (service.duration || 30) * 60000);
    const slotCheck = await availabilityService.validateSlot({
      host, service, availability: avail, scheduledAtUTC: scheduled_at,
    });
    if (!slotCheck.ok) {
      const status = /past/i.test(slotCheck.reason) ? 400 : 409;
      return res.status(status).json({ message: slotCheck.reason });
    }

    // Plan limit: early check — fast-fail before we build pricing / a calendar
    // event, so a rejected booking leaves no orphan Google event. The
    // authoritative, race-safe recheck happens under the per-host lock right
    // before the insert (see below).
    const limitCheck = await checkBookingReceiveLimit(host_id);
    if (!limitCheck.allowed)
      return res.status(403).json({ message: limitCheck.message });

    // v4 — TDS 194-O: a PAID booking withholds income-tax from the host, which by
    // law requires the host's PAN. So a host must have PAN on file before they can
    // receive any paid booking. Free (₹0) bookings withhold nothing and are exempt.
    // (With PAN guaranteed on every paid booking, TDS is always the 1% with-PAN rate.)
    // "Price on request" books as a no-payment enquiry (host quotes offline), so
    // it is treated as ₹0 here: no PAN gate, no fee, no Razorpay. The stored price
    // is ignored for the money model — the flag wins.
    if (!service.price_on_request && service.price > 0) {
      const { data: panRow } = await supabaseAdmin
        .from("kyc_submissions")
        .select("user_id")
        .eq("user_id", host_id)
        .not("pan_number", "is", null)
        .maybeSingle();
      if (!panRow) {
        return res.status(409).json({
          message: "This host isn't set up to accept paid bookings yet. Please try again later.",
        });
      }
    }

    // ── Pricing snapshot (final money model — pricingEngine, no inline formulas) ──
    // Price-on-request → ₹0 enquiry (see PAN gate above): host discusses the fee
    // with the guest directly; the platform charges nothing at booking time.
    const bookingValue = service.price_on_request ? 0 : service.price; // service amount; add-ons not yet supported

    // Commission % is read from the vendor's subscription plan record (DB-driven,
    // admin-editable). Expired paid plans fall back to the free tier.
    const effectivePlanSlug = planService.resolveVendorPlan(host);
    const planRecord        = await planService.getPlan(effectivePlanSlug);
    const commissionPct     = Number(planRecord.commission_percentage) || 0;

    // Platform fee + GST rate are admin-editable settings. In fee-only mode every
    // booking still carries the platform fee even at ₹0 price — but a paid-enabled
    // host (pilot) is in normal paid mode, so the fee follows the real price.
    const { platformFee: feeSetting, gstRate } = await platformConfig.getConfig();
    const feeOnlyMode = await require('../services/paidMode').feeOnlyForHost(host_id);

    // Razorpay fee is vendor-borne and only known at capture → finalised in
    // paymentController.verifyPayment. Here razorpayFee = 0 (payout provisional).
    const pricing = computeBreakdown({
      servicePrice:         bookingValue,
      commissionPercentage: commissionPct,
      platformFee:          feeSetting,
      gstRate,
      razorpayFee:          0,
      // ₹0 service still owes the booking fee under fee-only mode — EXCEPT a
      // price-on-request enquiry, which is a pure no-payment lead (no fee at all).
      chargeFeeOnFree:      feeOnlyMode && !service.price_on_request,
    });
    const platformFee  = pricing.platformFee;
    const commission   = pricing.commission;
    const vendorPayout = pricing.vendorPayout;

    // Canonicalize the buyer's billing snapshot so the invoice's place of supply
    // is exact (typed "Maharashtra" → GST code 27). Backend is authoritative — a
    // frontend-supplied state/tax is never trusted. State is NOT required at
    // creation (a free booking owes no BAS tax invoice, and a paid booking's state
    // is ENFORCED before money moves in createOrder); a malformed GSTIN is rejected
    // here so a bad tax number never reaches an invoice.
    let normalizedBilling = null;
    if (req.body.billing_details) {
      const billingResult = stateService.normalizeBilling(req.body.billing_details, { requireState: false });
      if (!billingResult.ok) return res.status(400).json({ message: billingResult.error, field: 'billing_details' });
      normalizedBilling = billingResult.billing;
    }

    // Google Calendar — created at booking time ONLY for FREE services.
    // PAID services defer event creation to paymentController.verifyPayment so a
    // pending/unpaid booking does not place a placeholder event that would then
    // collide with itself during pre-payment slot re-validation (the "slot no
    // longer available" bug) and to avoid orphan events from abandoned checkouts.
    let meetingLink = "";
    let googleEventId = null;
    const isOnline = service.meeting_mode !== "offline";
    if (
      isOnline &&
      pricing.customerTotal === 0 &&
      host.google_calendar_connected &&
      host.google_refresh_token &&
      (await featureFlags.isFeatureEnabled("google_calendar"))
    ) {
      try {
        const startTime = new Date(scheduled_at);
        const endTime = new Date(
          startTime.getTime() + service.duration * 60000,
        );
        const event = await createCalendarEvent(
          decryptToken(host.google_access_token),
          decryptToken(host.google_refresh_token),
          {
            title: `${service.title} — ${guest_name || "Guest"}`,
            description: `Booked via Meeticulous\n${notes || ""}`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            timezone: hostTimezone,
            attendees: [
              // Organiser (host) owns this calendar — mark accepted so the event
              // shows the host as "Yes", not "awaiting". Google no longer auto-accepts
              // the organiser implicitly when they appear in attendees.
              { email: host.email, responseStatus: 'accepted' },
              ...(guest_email ? [{ email: guest_email }] : []),
            ],
          },
        );
        meetingLink = event.meetLink || "";
        googleEventId = event.eventId || null;
      } catch (calError) {
        console.error("Google Calendar error:", calError.message);
      }
    }

    // Base booking payload — fields present in all schema versions
    const bookingPayload = {
      service_id,
      host_id,
      guest_id: resolvedGuestId,
      guest_name,
      guest_email,
      guest_phone,
      scheduled_at,
      end_at: newEnd.toISOString(),  // backs the v2.5 no-overlap exclusion constraint
      grace_minutes: service.grace_period_minutes ?? 10, // v3.70: snapshot pads the exclusion constraint by this booking's own grace (gap enforced = graceA+graceB)
      notes,
      billing_details: normalizedBilling,  // v3.67 GST-invoice buyer snapshot (canonicalized)
      meeting_link: meetingLink,
      google_event_id: googleEventId,
      vendor_amount:       vendorPayout,
      platform_fee_amount: platformFee,
      platform_fee_gst:    pricing.gst,           // GST on platform fee (v2.2)
      customer_total:      pricing.customerTotal,  // service + fee + GST (v2.2)
      gst_rate:            gstRate,                // snapshot of rate used (v2.2)
      razorpay_fee_actual: 0,                      // set at payment capture (v2.2)
      razorpay_tax_actual: 0,                      // set at payment capture (v2.8)
      commission_applied:  commission,    // requires v1.7 migration
      commission_gst:        pricing.commissionGst,      // v4: GST EXTRACTED from inside the (inclusive) commission
      commission_taxable:    pricing.commissionTaxable,  // v3.93: commission ex-GST (host invoice taxable value)
      tds_amount:            pricing.tds,                // v3.93: 194-O withholding on host gross sale
      tcs_amount:            pricing.tcs,                // v3.93: GST Sec 52 collection
      commission_percentage: commissionPct,           // v2.8 snapshot
      vendor_plan_type:      effectivePlanSlug,       // v2.8 snapshot
      reminder_24h_sent: false,
      reminder_1h_sent: false,
      // Branch on the amount actually payable, not the host price: in fee-only
      // mode a ₹0 service still owes the booking fee, so it goes pending→pay.
      status: pricing.customerTotal === 0 ? "confirmed" : "pending",
      payment_status: pricing.customerTotal === 0 ? "paid" : "unpaid",
    };

    // Serialize the quota recheck + insert per host so two concurrent bookings
    // can't both pass the count check and push the host over their yearly cap
    // (TOCTOU). The recheck's count includes this pending row, so a queued peer
    // observes it. In-process lock — fully effective on the single API instance
    // today; a cross-instance lock is the Phase 3+ upgrade. See utils/keyedMutex.
    const guarded = await runExclusive(`booking-quota:${host_id}`, async () => {
      const recheck = await checkBookingReceiveLimit(host_id);
      if (!recheck.allowed) return { limited: recheck.message };
      return {
        result: await supabaseAdmin
          .from("bookings")
          .insert(bookingPayload)
          .select()
          .single(),
      };
    });
    if (guarded.limited)
      return res.status(403).json({ message: guarded.limited });
    let bookingResult = guarded.result;

    // Fallback: retry without commission_applied if v1.7 migration hasn't run yet
    if (
      bookingResult.error &&
      /Could not find the|column.*does not exist/i.test(bookingResult.error.message)
    ) {
      // Drop v1.7 + v2.2 + v2.8 + v3.70 columns if the migrations haven't been applied yet.
      // P0-4: end_at is DELIBERATELY kept — it backs the bookings_no_overlap
      // exclusion constraint (the only hard double-booking guarantee), whose
      // predicate requires end_at IS NOT NULL. Stripping it here silently disabled
      // that backstop. end_at has existed since v2.5; both DBs are well past it.
      // grace_minutes (v3.70) IS stripped here — a DB without that migration still
      // has the raw-range constraint, which end_at alone satisfies.
      const {
        commission_applied: _c, platform_fee_gst: _g, customer_total: _t,
        gst_rate: _r, razorpay_fee_actual: _f, razorpay_tax_actual: _rt,
        commission_gst: _cg, commission_percentage: _cp, vendor_plan_type: _vp,
        commission_taxable: _ctx, tds_amount: _tds, tcs_amount: _tcs,
        google_event_id: _gei, billing_details: _bd, grace_minutes: _gm,
        ...payloadCore
      } = bookingPayload;
      bookingResult = await supabaseAdmin
        .from("bookings")
        .insert(payloadCore)
        .select()
        .single();
    }

    // P2-04: the free-path Google event is minted BEFORE this insert; if the insert
    // failed (exclusion-constraint race or any error) delete the now-orphaned event
    // so it doesn't linger on the host's calendar with no backing booking.
    if (bookingResult.error && googleEventId && host.google_refresh_token) {
      try {
        await deleteCalendarEvent(
          decryptToken(host.google_access_token),
          decryptToken(host.google_refresh_token),
          googleEventId,
        );
      } catch (delErr) {
        console.error("Orphan calendar cleanup failed (non-fatal):", delErr.message);
      }
      googleEventId = null;
    }

    // Concurrency backstop: the v2.5 exclusion constraint rejects a racing
    // insert that passed the application-level check microseconds earlier.
    if (
      bookingResult.error &&
      (bookingResult.error.code === "23P01" ||
        /bookings_no_overlap|exclusion constraint/i.test(bookingResult.error.message))
    ) {
      // F8: the block may be THIS guest's OWN earlier unpaid hold, not a real
      // third-party conflict — a refresh, back-button, or app-switch during a UPI
      // redirect that lost the booking id. Telling them their own slot is taken (a
      // 45-minute lockout until the reaper runs) is the worst message the system
      // can produce, at the exact moment they were trying to pay. Instead, hand the
      // existing hold back so the client resumes payment on it. Matched by the same
      // OTP-verified / account contact used for the self-booking block above, so we
      // only ever return a hold the caller genuinely owns.
      const { data: holds } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("host_id", host_id)
        .eq("scheduled_at", scheduled_at)
        .eq("status", "pending")
        .eq("payment_status", "unpaid")
        .order("created_at", { ascending: false })
        .limit(5);
      const ownHold = (holds || []).find((h) =>
        (resolvedGuestId && h.guest_id === resolvedGuestId) ||
        (guest_email && h.guest_email &&
          h.guest_email.trim().toLowerCase() === guest_email.trim().toLowerCase()) ||
        (digits10(guest_phone).length === 10 && digits10(h.guest_phone) === digits10(guest_phone)),
      );
      if (ownHold) {
        // Existing row — no new notifications/analytics (those fired at its
        // creation). manage_token lets the client resume via /manage-booking too.
        return res
          .status(200)
          .json({ ...ownHold, manage_token: manageBookingToken.sign(ownHold.id), resumed: true });
      }
      return res.status(409).json({
        message: "This time slot is no longer available. Please choose another.",
      });
    }

    const { data: booking, error } = bookingResult;
    if (error) return safeError(res, error);

    // Respond now; confirmation emails (WhatsApp + SMTP) and analytics are
    // best-effort side-effects that should not add seconds to the user's wait.
    // manage_token lets an anonymous guest (no session) view/cancel THIS booking
    // via the public /manage-booking/:token page (MF3 #516).
    res.status(201).json({ ...booking, manage_token: manageBookingToken.sign(booking.id) });

    // In-app: notify the host of the new booking (fires for both free + paid).
    inAppNotify({
      userId: host_id,
      role: 'host',
      type: 'BOOKING_NEW',
      title: 'New booking request',
      body: `${guest_name} booked ${service.title}`,
      link: '/dashboard/bookings',
      data: { bookingId: booking.id },
    });

    const when = new Date(scheduled_at).toLocaleString("en-IN", {
      timeZone: hostTimezone,
    });

    // Only send confirmation emails when the booking is instant-confirmed (nothing
    // to pay). Anything with an amount payable — a paid service OR a ₹0 service that
    // still owes the booking fee in fee-only mode — sends emails in verifyPayment.
    if (pricing.customerTotal === 0) {
      runInBackground("createBooking:confirmation-emails", async () => {
        if (!(await featureFlags.isFeatureEnabled("confirmation_emails"))) return;
        // WhatsApp "Booking Confirmed" template is 4-var (no link) — the AiSensy
        // template dropped its 5th link param ~Jul 2026, and sending it made every
        // confirmation fail "Template params does not match" (#649). Keep this in
        // sync with the paid path (services/bookingConfirmation.js). The Meet/map
        // link still reaches people via email (below) + the calendar invite.
        const ctx = { guestName: guest_name, serviceTitle: service.title, hostName: host.name, when };
        const emailData = bookingEmailData({
          serviceTitle: service.title, hostName: host.name, hostPhone: host.phone,
          guestName: guest_name, scheduledAt: scheduled_at, tz: hostTimezone,
          bookingId: booking.id, online: !!meetingLink,
          mapLink: host.map_link, hostLocation: host.location,
        });
        await NotificationEngine.send({
          event: "BOOKING_CONFIRMED_CUSTOMER",
          data: {
            email: guest_email, phone: guest_phone, name: guest_name,
            templateParams: customerParams(ctx),
            emailData, emailUser: { name: guest_name, email: guest_email },
            recipientUserId: resolvedGuestId, bookingId: booking.id,
          },
        });
        await NotificationEngine.send({
          event: "BOOKING_CONFIRMED_VENDOR",
          data: {
            email: host.email, phone: host.phone, name: host.name,
            templateParams: vendorParams(ctx),
            emailData, emailUser: { name: host.name, email: host.email, username: host.username },
            recipientUserId: host_id, bookingId: booking.id,
          },
        });
        // In-app: notify the guest their free booking is confirmed (account holders only).
        if (resolvedGuestId) {
          inAppNotify({
            userId: resolvedGuestId,
            role: 'guest',
            type: 'BOOKING_CONFIRMED',
            title: 'Booking confirmed',
            link: '/user/my-bookings',
            data: { bookingId: booking.id },
          });
        }
        // Last-minute booking (start sooner than a reminder lead-time): fire the
        // catch-up reminder the 5-min cron's band would otherwise miss.
        await fireDueReminders({ ...booking, services: service }, host);
      });
    }

    // booking_created is a CONVERSION (GA4 begin_checkout / Meta InitiateCheckout).
    // trackServer forwards to PostHog unchanged AND fans out to GA4 MP + Meta CAPI
    // with the amount + match keys; eventId=booking.id de-dupes vs the browser pixel.
    trackServer(resolveGuestId({ guestId: resolvedGuestId, guestEmail: guest_email }), "booking_created", {
      booking_id: booking.id,
      service_id,
      service_title: service.title,
      host_id,
      price: service.price,
      is_paid: service.price > 0,
      payment_status: booking.payment_status,
    }, {
      value: service.price,
      currency: "INR",
      email: guest_email,
      req,                    // EMQ match keys: IP/UA/fbp/fbc
      eventId: booking.id,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/bookings/host
const getHostBookings = async (req, res) => {
  try {
    // Safety ceiling so a large account can't drag its entire paid-booking
    // history over the wire on every dashboard load. Optional ?limit/?offset;
    // response stays a bare array (unchanged shape). See utils/pagination.js.
    const { from, to } = parseListRange(req.query);
    // Vendors only see PAID bookings. An unpaid/pending booking is not yet the
    // vendor's booking — it is a lead and only Admin can see it. payment_status
    // 'paid' covers paid/confirmed and paid-then-cancelled (refund visibility);
    // 'unpaid' and 'failed' stay hidden. Admin endpoints see everything.
    let result = await supabaseAdmin
      .from("bookings")
      .select("*, services(*), profiles!bookings_guest_id_fkey(*)")
      .eq("host_id", req.user.id)
      .eq("payment_status", "paid")
      .order("scheduled_at", { ascending: true })
      .range(from, to);
    // Fallback if schema cache is stale
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      result = await supabaseAdmin
        .from("bookings")
        .select("id, service_id, host_id, guest_id, guest_name, guest_email, scheduled_at, status, payment_status, meeting_link, notes, created_at, updated_at, services(id, title, duration, price), profiles!bookings_guest_id_fkey(id, name, email)")
        .eq("host_id", req.user.id)
        .eq("payment_status", "paid")
        .order("scheduled_at", { ascending: true })
        .range(from, to);
    }
    const { data, error } = result;
    if (error) return safeError(res, error);
    // Anti-disintermediation: hide guest phone unless the host is Studio (with
    // window) or Supreme. Plan resolved once for the whole list.
    const { data: hp } = await supabaseAdmin
      .from("profiles").select("plan, plan_expires_at").eq("id", req.user.id).single();
    const hostPlan = planService.resolveVendorPlan(hp || {});
    const now = Date.now();
    res.json((data || []).map((b) => redactBookingContact(b, { role: "host", plan: hostPlan }, now)));
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/bookings/guest
const getGuestBookings = async (req, res) => {
  try {
    // Safety ceiling (optional ?limit/?offset); response stays a bare array.
    const { from, to } = parseListRange(req.query);
    // Identity match: a booking is linked to this guest by guest_id (booked while
    // logged in) OR — for bookings placed while logged OUT — only by the phone.
    // Match on both so the guest sees ALL their bookings after OTP login, not just
    // the guest_id-tagged slice. Phone is the OTP-verified login identity, so
    // matching on it is safe; normalise to the last 10 digits because guest_phone
    // is stored inconsistently (8637758344 / +918637758344 / 918637758344).
    const { data: me } = await supabaseAdmin
      .from("profiles").select("phone").eq("id", req.user.id).single();
    const d10 = String(me?.phone || req.user.phone || "").replace(/\D/g, "").slice(-10);
    const orFilter = d10.length === 10
      ? `guest_id.eq.${req.user.id},guest_phone.in.(${d10},+91${d10},91${d10},0${d10})`
      : null;
    const scoped = (q) => orFilter ? q.or(orFilter) : q.eq("guest_id", req.user.id);
    let result = await scoped(
      supabaseAdmin.from("bookings").select("*, services(*), profiles!bookings_host_id_fkey(*)"))
      .order("scheduled_at", { ascending: true })
      .range(from, to);
    // Fallback if schema cache is stale
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      result = await scoped(
        supabaseAdmin.from("bookings").select("id, service_id, host_id, guest_id, guest_name, guest_email, scheduled_at, status, payment_status, customer_total, paid_at, meeting_link, notes, created_at, updated_at, services(id, title, duration, price), profiles!bookings_host_id_fkey(id, name, email)"))
        .order("scheduled_at", { ascending: true })
        .range(from, to);
    }
    const { data, error } = result;
    if (error) return safeError(res, error);
    // Anti-disintermediation: hide host phone unless the service is offline and
    // the booking is imminent/past (window). Guest side never reveals via plan.
    const now = Date.now();
    res.json((data || []).map((b) => redactBookingContact(b, { role: "guest" }, now)));
  } catch (error) {
    safeError(res, error);
  }
};

// Shared cancel execution — runs AFTER the caller's auth + status guards. Flips
// the booking to cancelled, removes the Google event, notifies both parties and
// records analytics. Used by the session handler (cancelBooking) AND the
// token-authorized manage-booking path (manageBookingController). Returns the
// updated row; throws on a DB error (callers wrap in try/catch).
//   cancelledBy : 'host' | 'guest' (for analytics).
//   actorUserId : the acting user id, or null for an anonymous manage-link guest.
//                 The party that is NOT the actor gets the in-app notification.
const cancelBookingRecord = async (booking, { cancelledBy, actorUserId = null } = {}) => {
  const cancelUpdate = { status: "cancelled", settlement_status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  let { data, error } = await supabaseAdmin
    .from("bookings").update(cancelUpdate).eq("id", booking.id).select().single();
  // P3-2: cancelled_at is added by v3.104; on a DB without it yet, retry minimally.
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    const { cancelled_at: _ca, ...core } = cancelUpdate;
    ({ data, error } = await supabaseAdmin.from("bookings").update(core).eq("id", booking.id).select().single());
  }
  if (error) throw error;

  // Phase 2: a cancelled booking must not pay the host — reverse any held Route
  // transfer (fire-and-forget; the money returns to the platform balance).
  if (booking.razorpay_transfer_id) {
    require("../services/routeAutoPayoutService")
      .reverseHeldTransfer(booking, { reason: "booking cancelled" })
      .catch((e) => console.error("cancel transfer reverse failed:", e.message));
  }

  // P1-7: remove the Google Calendar event so a cancelled booking doesn't leave
  // a ghost event (with Meet link) on the host's + guest's calendars. Best-effort.
  if (booking.google_event_id && hostOf(booking).google_calendar_connected) {
    try {
      const calHost = { id: booking.host_id };
      await profileSecrets.attachGoogleTokens(calHost);
      if (calHost.google_refresh_token) {
        await deleteCalendarEvent(
          decryptToken(calHost.google_access_token),
          decryptToken(calHost.google_refresh_token),
          booking.google_event_id,
        );
      }
    } catch (calErr) {
      console.error("Cancel calendar delete (non-fatal):", calErr.message);
    }
  }

  // Notify both sides (engine decides channels per admin config)
  try {
    const host = hostOf(booking);
    const tz = await resolveHostTz(booking.host_id);
    const when = new Date(booking.scheduled_at).toLocaleString("en-IN", { timeZone: tz });
    const ctx = { guestName: booking.guest_name, serviceTitle: booking.services?.title, hostName: host.name, when };
    const emailData = bookingEmailData({
      serviceTitle: booking.services?.title, hostName: host.name, hostPhone: host.phone,
      guestName: booking.guest_name, scheduledAt: booking.scheduled_at, tz, bookingId: booking.id,
    });
    await NotificationEngine.send({
      event: "BOOKING_CANCELLED_CUSTOMER",
      data: {
        email: booking.guest_email, phone: booking.guest_phone, name: booking.guest_name,
        templateParams: customerParams(ctx),
        emailData, emailUser: { name: booking.guest_name, email: booking.guest_email },
        recipientUserId: booking.guest_id, bookingId: booking.id,
      },
    });
    await NotificationEngine.send({
      event: "BOOKING_CANCELLED_VENDOR",
      data: {
        email: host.email, phone: host.phone, name: host.name,
        templateParams: vendorParams(ctx),
        emailData, emailUser: { name: host.name, email: host.email, username: host.username },
        recipientUserId: booking.host_id, bookingId: booking.id,
      },
    });
    // In-app: notify the party that ISN'T the actor.
    if (booking.guest_id && booking.guest_id !== actorUserId) {
      inAppNotify({
        userId: booking.guest_id,
        role: 'guest',
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: `${booking.services?.title || 'Your booking'} has been cancelled`,
        link: '/user/my-bookings',
        data: { bookingId: booking.id },
      });
    }
    if (booking.host_id !== actorUserId) {
      inAppNotify({
        userId: booking.host_id,
        role: 'host',
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: `${booking.guest_name}'s booking for ${booking.services?.title || 'a service'} was cancelled`,
        link: '/dashboard/bookings',
        data: { bookingId: booking.id },
      });
    }
  } catch (notifyError) {
    console.error("Cancel notification error:", notifyError.message);
  }

  // F2: a PAID booking cancelled here now issues an AUTOMATIC refund per the
  // /refund policy — tiered on the service price for a GUEST cancellation (100% at
  // ≥24h, 50% at ≥6h, nothing under 6h), and a full customer_total refund when the
  // HOST cancelled (the guest did nothing wrong). Best-effort + backgrounded so it
  // never blocks or breaks the cancel response; the held Route payout is already
  // reversed above. If the refund can't be auto-issued (host already settled, or an
  // error), fall back to the manual alert so a paid cancel can never silently pocket
  // the guest's money.
  if (booking.payment_status === "paid") {
    const refundMode = cancelledBy === "host" ? "full" : "tiered";
    runInBackground("cancel:auto-refund", async () => {
      const { issueBookingRefund } = require("../services/refundService");
      const r = await issueBookingRefund({
        bookingId: booking.id,
        mode: refundMode,
        reason: `${cancelledBy || "guest"} cancellation`,
      });
      if (r.ok) {
        // Tell the guest their money is on the way (account holders; Razorpay also
        // emails the cardholder its own refund receipt for anonymous guests).
        if (booking.guest_id) {
          inAppNotify({
            userId: booking.guest_id, role: "guest", type: "REFUND_ISSUED",
            title: "Refund issued",
            body: `₹${r.amount} refunded for ${booking.services?.title || "your booking"}`,
            link: "/user/my-bookings", data: { bookingId: booking.id },
          });
        }
        return;
      }
      // not_eligible (inside the no-refund window) and already_refunded are correct,
      // expected outcomes — no alert. Anything else means the guest's money is still
      // captured and a human must decide: alert (throttled per booking).
      if (r.reason === "not_eligible" || r.reason === "already_refunded") return;
      adminAlert({
        key: `paid_cancel_refund:${booking.id}`,
        subject: `Paid booking cancelled — auto-refund could not be issued (${booking.id})`,
        lines: [
          `Service: ${booking.services?.title || "—"}`,
          `Guest: ${booking.guest_name || booking.guest_email || booking.guest_id || "—"}`,
          `Amount charged: ₹${booking.customer_total ?? "—"}`,
          `Cancelled by: ${cancelledBy || "unknown"} · attempted mode: ${refundMode}`,
          `Payment id: ${booking.razorpay_payment_id || booking.payment_id || "—"}`,
          r.blocked === "payout_settled"
            ? "BLOCKED: host payout already SETTLED — recover from the host, then refund in the Razorpay dashboard."
            : `Reason: ${r.blocked || r.reason || "unknown"}. Refund the guest in the Razorpay dashboard if due.`,
        ],
      });
    });
  }

  phCapture(actorUserId || booking.guest_id || booking.host_id, "booking_cancelled", {
    booking_id: booking.id,
    service_title: booking.services?.title,
    host_id: booking.host_id,
    cancelled_by: cancelledBy,
  });

  return data;
};

// PUT /api/bookings/:id/cancel
const cancelBooking = async (req, res) => {
  try {
    // BUG-01 fixed: verify caller owns this booking before allowing cancel
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, services(title), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link, google_calendar_connected)")
      .eq("id", req.params.id)
      .single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.host_id && req.user.id !== booking.guest_id) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" });
    }
    // P1-5: status guard + idempotency. A repeat cancel is a no-op (don't re-fire
    // notifications); a completed booking can't be walked back to cancelled (it
    // would diverge the ledger from the booking with no reversal).
    if (booking.status === "cancelled") return res.json(await redactForRequest(booking, req));
    if (booking.status === "completed" || booking.status === "no_show")
      return res.status(409).json({ message: "This booking is already closed and can't be cancelled." });

    const data = await cancelBookingRecord(booking, {
      cancelledBy: req.user.id === booking.host_id ? "host" : "guest",
      actorUserId: req.user.id,
    });
    res.json(await redactForRequest(data, req));
  } catch (error) {
    safeError(res, error);
  }
};

// Shared completion logic — used by the host action (completeBooking) AND the
// auto-complete cron (autoCompleteBookings) so the two can never drift. Stamps
// the revenue-recognition + settlement-eligibility fields and (optionally) fires
// the completion notifications + badge re-evaluation. `booking` must be a row
// selected with `services(title)` and the
// `profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)` join.
const markBookingCompleted = async (booking, { notify = true } = {}) => {
  const nowIso = new Date().toISOString();
  const completionUpdate = {
    status: "completed",
    completed_at: nowIso,
    revenue_recognized_at: nowIso,            // PRD Rule 2: commission recognised at completion
    revenue_recognition_status: "recognized",
    // Only a paid booking can actually be settled; P2 re-checks, but don't
    // write a knowingly-false eligibility value for unpaid/failed/refunded.
    settlement_status: booking.payment_status === "paid" ? "eligible_for_settlement" : "not_eligible",
    updated_at: nowIso,
  };
  let { data, error } = await supabaseAdmin
    .from("bookings")
    .update(completionUpdate)
    .eq("id", booking.id)
    .select()
    .single();

  // Legacy DB without v2.8 columns: retry with the original minimal update
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    ({ data, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "completed", updated_at: nowIso })
      .eq("id", booking.id)
      .select()
      .single());
  }
  if (error) return { data: null, error };

  if (notify) {
    try {
      const host = hostOf(booking);
      const tz = await resolveHostTz(booking.host_id);
      const when = new Date(booking.scheduled_at).toLocaleString("en-IN", { timeZone: tz });
      const ctx = { guestName: booking.guest_name, serviceTitle: booking.services?.title, hostName: host.name, when };
      const emailData = bookingEmailData({
        serviceTitle: booking.services?.title, hostName: host.name, hostPhone: host.phone,
        guestName: booking.guest_name, scheduledAt: booking.scheduled_at, tz, bookingId: booking.id,
      });
      // The review CTA ({{review_url}}) opens the dedicated review page for THIS
      // booking. Keep profile_url too (still referenced elsewhere / as fallback).
      const websiteBase = process.env.CLIENT_URL || "https://bookasloth.com";
      const completedCustomerData = {
        ...emailData,
        review_url: `${websiteBase}/review/${booking.id}`,
        ...(host.username ? { profile_url: `${websiteBase}/${host.username}` } : {}),
      };
      await NotificationEngine.send({
        event: "BOOKING_COMPLETED_CUSTOMER",
        data: {
          email: booking.guest_email, phone: booking.guest_phone, name: booking.guest_name,
          templateParams: customerParams(ctx),
          emailData: completedCustomerData, emailUser: { name: booking.guest_name, email: booking.guest_email },
          recipientUserId: booking.guest_id, bookingId: booking.id,
        },
      });
      await NotificationEngine.send({
        event: "BOOKING_COMPLETED_VENDOR",
        data: {
          email: host.email, phone: host.phone, name: host.name,
          templateParams: vendorParams(ctx),
          emailData, emailUser: { name: host.name, email: host.email, username: host.username },
          recipientUserId: booking.host_id, bookingId: booking.id,
        },
      });
      // In-app: notify the guest their session is complete and prompt a review.
      if (booking.guest_id) {
        inAppNotify({
          userId: booking.guest_id,
          role: 'guest',
          type: 'BOOKING_COMPLETED',
          title: 'Session completed',
          body: 'Leave a review',
          link: `/review/${booking.id}`,
          data: { bookingId: booking.id },
        });
      }
    } catch (notifyError) {
      console.error("Complete notification error:", notifyError.message);
    }
  }

  // Post-session follow-ups (rebook nudge). Best-effort — never block completion.
  try {
    const { scheduleFollowups } = require("../services/followups/followupService");
    await scheduleFollowups({
      sourceType: "booking",
      sourceId: booking.id,
      hostId: booking.host_id,
      entity: booking,
      completedAt: data?.completed_at || new Date().toISOString(),
    });
  } catch (e) {
    console.error("scheduleFollowups error:", e.message);
  }

  // Event-driven badge evaluation for this vendor (fire-and-forget)
  require("../services/badgeEngine")
    .evaluate({ vendorIds: [booking.host_id] })
    .catch((e) => console.error("Badge evaluation error:", e.message));

  return { data, error: null };
};

// PUT /api/bookings/:id/complete
const completeBooking = async (req, res) => {
  try {
    // BUG-01 fixed: only the host can mark a booking complete
    let { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, services(title, duration, grace_period_minutes), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)")
      .eq("id", req.params.id)
      .single();
    // Fallback for a schema-cache state without grace_period_minutes.
    if (!booking) {
      ({ data: booking } = await supabaseAdmin
        .from("bookings")
        .select("*, services(title, duration), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)")
        .eq("id", req.params.id)
        .single());
    }
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.host_id) {
      return res.status(403).json({ message: "Only the host can mark a booking as completed" });
    }
    // Idempotent: re-completing must not re-stamp completed_at/revenue_recognized_at
    // (would silently shift revenue across a reporting period) or re-fire notifications.
    if (booking.status === "completed") return res.json(await redactForRequest(booking, req));
    // P0-2: only a CONFIRMED booking may be completed. Without this a cancelled,
    // paid booking could be force-completed via the API — re-stamping revenue
    // recognition and re-entering the host's settlement balance for a session
    // that was cancelled (and, with no refund, paying the host for it). Also
    // blocks completing a pending/unpaid booking.
    if (booking.status !== "confirmed")
      return res.status(409).json({ message: "Only a confirmed booking can be completed." });

    // Security audit M-1: a host may only complete a booking AFTER its session has
    // ended (duration + grace). Otherwise a host could flip a far-future PAID
    // booking to 'completed' — recognising revenue and making it eligible for
    // settlement before the service is rendered, bypassing the post-session hold.
    const sessionMin = (booking.services?.duration || 30) + (booking.services?.grace_period_minutes || 0);
    const sessionEnd = new Date(booking.scheduled_at).getTime() + sessionMin * 60000;
    if (Number.isFinite(sessionEnd) && Date.now() < sessionEnd) {
      return res.status(409).json({ message: "You can mark this booking complete only after the session has ended." });
    }

    const { data, error } = await markBookingCompleted(booking, { notify: true });
    if (error) return safeError(res, error);
    res.json(await redactForRequest(data, req));
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/bookings/:id/guest-complete
// The GUEST confirms the session happened → marks it completed AND releases the
// host's held Route transfer immediately (instant payout). This is the trusted
// release signal: a host completing a booking (completeBooking) never releases
// money — only the customer's confirmation does, or Razorpay's +24h auto-release.
const guestConfirmComplete = async (req, res) => {
  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, services(title, duration, grace_period_minutes), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)")
      .eq("id", req.params.id)
      .single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    // Only the guest who owns this booking may confirm it.
    if (req.user.id !== booking.guest_id) {
      return res.status(403).json({ message: "Only the guest can confirm this booking." });
    }
    if (!["confirmed", "completed"].includes(booking.status)) {
      return res.status(409).json({ message: "Only a confirmed booking can be confirmed complete." });
    }
    // Can only confirm after the session has actually ended (mirrors host guard).
    const sessionMin = (booking.services?.duration || 30) + (booking.services?.grace_period_minutes || 0);
    const sessionEnd = new Date(booking.scheduled_at).getTime() + sessionMin * 60000;
    if (Number.isFinite(sessionEnd) && Date.now() < sessionEnd) {
      return res.status(409).json({ message: "You can confirm completion only after the session has ended." });
    }

    // Stamp completion if not already (idempotent inside markBookingCompleted).
    let row = booking;
    if (booking.status !== "completed") {
      const { data, error } = await markBookingCompleted(booking, { notify: false });
      if (error) return safeError(res, error);
      row = { ...booking, ...data };
    }

    // Release the host's held transfer now (fire-and-forget — the +24h auto-release
    // + transfer webhook are the backstop, and this must never fail the response).
    const { releaseHeldTransfer } = require("../services/routeAutoPayoutService");
    releaseHeldTransfer(row).catch((e) => console.error("guest-complete release failed:", e.message));

    res.json(await redactForRequest(row, req));
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/bookings/:id/report-problem  { reason? }
// The GUEST reports a problem (host no-show, service issue) → BLOCKS the host
// payout by reversing the held transfer (money returns to the platform balance)
// and alerts admin to resolve (refund the guest and/or pay the host manually).
const guestReportProblem = async (req, res) => {
  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings").select("*, services(title)").eq("id", req.params.id).single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.guest_id) {
      return res.status(403).json({ message: "Only the guest can report a problem on this booking." });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 500) || "guest reported a problem";

    // Reverse the held payout so the host is not paid while we investigate.
    let reversal = { ok: false };
    if (booking.razorpay_transfer_id) {
      reversal = await require("../services/routeAutoPayoutService")
        .reverseHeldTransfer(booking, { reason: `reported: ${reason}` });
    }

    // Open a dispute so it lands in the admin queue (best-effort).
    require("../services/disputeService")
      .recordDispute({ bookingId: booking.id, raisedBy: "guest", reason, payoutAction: reversal.ok ? "reversed" : "none" })
      .catch(() => {});

    // Alert admin to resolve (refund / manual payout decision).
    try {
      adminAlert({
        key: `booking_problem:${booking.id}`,
        subject: `Guest reported a problem — booking ${booking.id}`,
        lines: [
          `Service: ${booking.services?.title || "—"}`,
          `Guest: ${booking.guest_name || booking.guest_email || booking.guest_id}`,
          `Reason: ${reason}`,
          booking.razorpay_transfer_id
            ? `Held payout ${booking.razorpay_transfer_id}: ${reversal.ok ? "reversed (host not paid)" : `reverse FAILED — ${reversal.error || reversal.skipped}`}`
            : "No held payout for this booking.",
          `Decide: refund the guest and/or pay the host manually.`,
        ],
      });
    } catch (_) { /* non-fatal */ }

    res.json({ ok: true, payout_held: !!booking.razorpay_transfer_id, reversed: !!reversal.ok });
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/bookings/:id/no-show  (audit P1-6)
// Host records that the guest did not attend. Distinct, auditable terminal state
// — previously no-shows were silently auto-completed, so the host was paid and
// the guest was prompted to review a session that never happened.
const markNoShow = async (req, res) => {
  try {
    let { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, services(title, duration, grace_period_minutes), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)")
      .eq("id", req.params.id)
      .single();
    // Fallback for a schema-cache state without grace_period_minutes.
    if (!booking) {
      ({ data: booking } = await supabaseAdmin
        .from("bookings")
        .select("*, services(title, duration), profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)")
        .eq("id", req.params.id)
        .single());
    }
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.id !== booking.host_id)
      return res.status(403).json({ message: "Only the host can mark a booking as no-show" });
    if (booking.status === "no_show") return res.json(await redactForRequest(booking, req)); // idempotent
    if (booking.status !== "confirmed")
      return res.status(409).json({ message: "Only a confirmed booking can be marked no-show." });

    // Same time-gate as completion: can't mark no-show before the session window
    // (duration + grace) has fully elapsed.
    const sessionMin = (booking.services?.duration || 30) + (booking.services?.grace_period_minutes || 0);
    const sessionEnd = new Date(booking.scheduled_at).getTime() + sessionMin * 60000;
    if (Number.isFinite(sessionEnd) && Date.now() < sessionEnd)
      return res.status(409).json({ message: "You can mark a no-show only after the session window has passed." });

    const nowIso = new Date().toISOString();
    // Host-favourable: a paid no-show stays settlement-eligible (the host showed
    // up), but it is recorded as no_show — never silently "completed".
    const noShowUpdate = {
      status: "no_show",
      completed_at: nowIso,
      revenue_recognized_at: nowIso,
      revenue_recognition_status: "recognized",
      settlement_status: booking.payment_status === "paid" ? "eligible_for_settlement" : "not_eligible",
      updated_at: nowIso,
    };
    let { data, error } = await supabaseAdmin
      .from("bookings").update(noShowUpdate).eq("id", booking.id).select().single();
    // Legacy DB without the v2.8 settlement columns: retry with a minimal update.
    if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
      ({ data, error } = await supabaseAdmin
        .from("bookings").update({ status: "no_show", updated_at: nowIso }).eq("id", booking.id).select().single());
    }
    if (error) return safeError(res, error);

    // In-app note to the host (no guest-facing no_show template by design).
    inAppNotify({
      userId: booking.host_id, role: 'host', type: 'BOOKING_NO_SHOW',
      title: 'Marked as no-show',
      body: `${booking.guest_name || 'Guest'} — ${booking.services?.title || 'booking'}`,
      link: '/dashboard/bookings', data: { bookingId: booking.id },
    });

    res.json(await redactForRequest(data, req));
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/bookings/:id/reschedule
const rescheduleBooking = async (req, res) => {
  try {
    if (!(await featureFlags.isFeatureEnabled('reschedule'))) {
      return res.status(403).json({ message: 'Reschedule is currently disabled' });
    }

    const { scheduled_at } = req.body;
    if (!scheduled_at)
      return res.status(400).json({ message: "scheduled_at is required" });

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*, services(*), profiles!bookings_host_id_fkey(*)")
      .eq("id", req.params.id)
      .single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "cancelled")
      return res
        .status(400)
        .json({ message: "Cannot reschedule a cancelled booking" });
    // P2-07: a closed (completed / no_show) booking is settled/revenue-recognized —
    // don't let it be re-timed (it would move the calendar event and diverge the
    // row from its ledger/settlement snapshot).
    if (booking.status === "completed" || booking.status === "no_show")
      return res
        .status(409)
        .json({ message: "This booking is already closed and can't be rescheduled." });
    if (
      req.user &&
      req.user.id !== booking.guest_id &&
      req.user.id !== booking.host_id
    )
      return res
        .status(403)
        .json({ message: "Not authorized to reschedule this booking" });

    const { data: avail } = await supabaseAdmin
      .from("availability")
      .select("*")
      .eq("host_id", booking.host_id)
      .maybeSingle();
    const hostTimezone = avail?.timezone || "Asia/Kolkata";
    const newStart = new Date(scheduled_at);

    // Reject rescheduling to the past
    if (newStart <= new Date()) {
      return res
        .status(400)
        .json({ message: "Cannot reschedule to a time in the past." });
    }

    const newEnd = new Date(
      newStart.getTime() + (booking.services?.duration || 30) * 60000,
    );

    // P1-3: route reschedule through the SAME full availability validation as a
    // new booking — blocked dates, working-hours window, platform double-booking
    // (grace-aware) AND the host's live Google Calendar — instead of the old
    // hand-rolled conflict scan that checked none of those. Exclude this booking
    // so it can't collide with itself.
    const rescheduleHost = hostOf(booking);
    await profileSecrets.attachGoogleTokens(rescheduleHost);
    const slotCheck = await availabilityService.validateSlot({
      host: rescheduleHost,
      service: booking.services,
      availability: avail,
      scheduledAtUTC: scheduled_at,
      excludeBookingId: req.params.id,
    });
    if (!slotCheck.ok) {
      const status = /past/i.test(slotCheck.reason) ? 400 : 409;
      return res.status(status).json({ message: slotCheck.reason });
    }

    const isHostReschedule = req.user?.id === booking.host_id;
    const isGuestReschedule = !isHostReschedule;

    // Reschedule fee — platform-kept, "first reschedule free". A guest's first
    // move (reschedule_count 0) is always free; from the second onward, if the
    // reschedule_fee flag is ON and the vendor set a fee > 0, a valid Razorpay
    // fee payment is required BEFORE any DB mutation (402 otherwise).
    const { verifySignature } = require("../utils/razorpaySignature");
    const rzpConfig = require("../services/razorpayConfig");
    let feeChargedAmount = 0;
    let feeOrderId = null, feePaymentId = null;
    if (isGuestReschedule) {
      const hostRow = hostOf(booking);
      const vendorFee = Number(hostRow.reschedule_fee) || 0;
      const priorCount = Number(booking.reschedule_count) || 0;
      const feeFlagOn = await featureFlags.isFeatureEnabled('reschedule_fee');
      const feeApplies = priorCount >= 1 && feeFlagOn && vendorFee > 0;
      if (feeApplies) {
        const { fee_payment_id, fee_order_id, fee_signature } = req.body;
        const feeKeySecret = await rzpConfig.getKeySecret();
        if (!fee_payment_id || !fee_order_id || !fee_signature ||
            !verifySignature(fee_order_id, fee_payment_id, fee_signature, feeKeySecret)) {
          return res.status(402).json({ message: 'Reschedule fee payment required', fee: vendorFee });
        }
        // SECURITY: the HMAC signature only proves the order/payment pair is genuine —
        // it does NOT bind to which booking the fee was for, nor the amount. Without
        // this check a guest could pay a ₹10 fee on Booking A and reuse those tokens
        // to reschedule Booking B (fee ₹500), underpaying ₹490.
        // Fix: fetch the Razorpay order and assert it was created for THIS booking
        // at the correct amount before accepting the payment.
        let feeOrder;
        try {
          feeOrder = await (await rzpConfig.getClient()).orders.fetch(fee_order_id);
        } catch (_) {
          return res.status(402).json({ message: 'Reschedule fee order not found', fee: vendorFee });
        }
        if (String(feeOrder?.notes?.booking_id) !== String(booking.id) ||
            Number(feeOrder?.amount) !== Math.round(vendorFee * 100)) {
          return res.status(402).json({ message: 'Reschedule fee does not match this booking', fee: vendorFee });
        }
        feeChargedAmount = vendorFee;
        feeOrderId = fee_order_id;
        feePaymentId = fee_payment_id;
      }
    }

    // Idempotency: a given reschedule-fee payment backs exactly ONE reschedule.
    // Check BEFORE mutating the booking so a replay of the same fee tokens can't
    // re-reschedule for free. (DB unique index v3.17 is the hard backstop.)
    if (feePaymentId) {
      const { data: priorFee } = await supabaseAdmin
        .from('reschedule_payments')
        .select('id')
        .eq('razorpay_payment_id', feePaymentId)
        .limit(1)
        .maybeSingle();
      if (priorFee) {
        return res.status(409).json({ message: 'This reschedule fee payment has already been used.' });
      }
    }

    const ackToken = isHostReschedule
      ? crypto.randomBytes(24).toString("hex")
      : null;
    const rescheduleUpdate = {
      scheduled_at,
      end_at: newEnd.toISOString(), // keep the no-overlap constraint range in sync
      reminder_24h_sent: false,
      reminder_1h_sent: false,
      reschedule_status: isHostReschedule ? "awaiting_guest_ack" : "none",
      reschedule_ack_token: ackToken,
      // P3-1: ack tokens now expire (7 days). A leaked/emailed link can no longer
      // be used indefinitely. Null when there's no token (guest-initiated move).
      reschedule_ack_token_expires_at: ackToken ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : null,
      reschedule_acknowledged_at: null,
      reschedule_count: (Number(booking.reschedule_count) || 0) + (isGuestReschedule ? 1 : 0),
      updated_at: new Date().toISOString(),
    };
    let rescheduleResult = await supabaseAdmin
      .from("bookings")
      .update(rescheduleUpdate)
      .eq("id", req.params.id)
      .select()
      .single();
    // Pre-v2.5 DB without end_at / pre-v3.3 DB without reschedule_count
    if (
      rescheduleResult.error &&
      /Could not find the|column.*does not exist/i.test(rescheduleResult.error.message)
    ) {
      const { end_at: _e, reschedule_count: _rc, reschedule_ack_token_expires_at: _rae, ...coreUpdate } = rescheduleUpdate;
      rescheduleResult = await supabaseAdmin
        .from("bookings").update(coreUpdate).eq("id", req.params.id).select().single();
    }
    if (
      rescheduleResult.error &&
      (rescheduleResult.error.code === "23P01" ||
        /bookings_no_overlap|exclusion constraint/i.test(rescheduleResult.error.message))
    ) {
      return res.status(409).json({ message: "That time slot is already taken." });
    }
    const { data: updated, error } = rescheduleResult;
    if (error) return safeError(res, error);

    try {
      const hostRow = hostOf(booking);
      await profileSecrets.attachGoogleTokens(hostRow);
      if (booking.google_event_id && hostRow.google_calendar_connected && hostRow.google_refresh_token) {
        await updateCalendarEvent(
          decryptToken(hostRow.google_access_token),
          decryptToken(hostRow.google_refresh_token),
          booking.google_event_id,
          { startTime: newStart.toISOString(), endTime: newEnd.toISOString(), timezone: hostTimezone },
        );
      }
    } catch (calErr) {
      console.error("Reschedule calendar patch error (non-fatal):", calErr.message);
    }

    let rfRowId = null;
    if (feeChargedAmount > 0) {
      try {
        const { data: rfRow, error: rfErr } = await supabaseAdmin
          .from('reschedule_payments')
          .insert({ booking_id: booking.id, guest_id: booking.guest_id, host_id: booking.host_id,
                    amount: feeChargedAmount, razorpay_order_id: feeOrderId, razorpay_payment_id: feePaymentId })
          .select('id').single();
        if (rfErr) {
          // 23505 = unique_violation: a concurrent replay raced past the pre-check and
          // hit the DB unique index (v3.17). The booking was already updated — that's
          // acceptable. Surface a 409 instead of a 500.
          if (rfErr.code === '23505') {
            console.warn('Reschedule fee replay blocked by DB unique index (concurrent race):', feePaymentId);
            return res.status(409).json({ message: 'This reschedule fee payment has already been used.' });
          }
          throw rfErr;
        }
        rfRowId = rfRow.id;
        const { rescheduleFeeEntry } = require('../services/ledger/journalTemplates');
        const { post } = require('../services/ledger/postingService');
        // Rate comes from platform_settings, not a literal — the ledger and the
        // tax invoice below MUST agree, and a hardcoded 0.18 would silently
        // diverge from the invoice the moment an admin changed the rate.
        const { gstRate: rfGstRate } = await platformConfig.getConfig();
        await post({
          sourceType: 'RESCHEDULE_FEE',
          sourceId: rfRow.id,
          journalDate: new Date().toISOString().slice(0, 10),
          template: rescheduleFeeEntry({ booking_id: booking.id, host_id: booking.host_id, fee: feeChargedAmount, gstRate: rfGstRate }),
        });
      } catch (ledgerErr) {
        console.error('Reschedule fee ledger error (non-fatal):', ledgerErr.message);
      }
    }

    // Tax invoice for the reschedule fee. The fee is BAS's OWN revenue (see
    // rescheduleFeeEntry: it credits Platform Fee Revenue + GST Payable), so we
    // owe the guest a tax invoice for it exactly as we do for the booking fee.
    // Until now the GST was collected and booked as a payable with no document
    // backing the output tax, and the guest received nothing.
    //
    // Split is computed the SAME way rescheduleFeeEntry does it — GST-inclusive,
    // taxable first then GST as the remainder — so the invoice and the journal
    // can never disagree by a paisa. Idempotent: create_invoice takes an advisory
    // lock on (source_type, source_id) and returns the existing row. Best-effort
    // in its own try so an invoice failure can't undo a completed reschedule.
    if (rfRowId) {
      try {
        const { gstRate } = await platformConfig.getConfig();
        const { round2 } = require('../lib/pricingEngine');
        const gross = round2(feeChargedAmount);
        const taxable = round2(gross / (1 + gstRate));
        const b = booking.billing_details || {};
        await require('../services/invoiceService').generateInvoice({
          sourceType: 'reschedule',
          sourceId: rfRowId,
          paymentId: feePaymentId,
          issuedAt: new Date().toISOString(),
          buyer: {
            name: b.name || booking.guest_name || 'Customer',
            address: b.address || null,
            stateCode: b.state_code || null,
            stateName: b.state || null,
            gstin: b.gstin || null,
            pan: b.pan || null,
          },
          taxableValue: taxable,
          gstAmount: round2(gross - taxable),
        });
      } catch (invErr) {
        console.error('Reschedule fee invoice error (non-fatal):', invErr.message);
      }
    }

    const s = booking.services;
    const host = hostOf(booking);
    // Studio-tier perk: reschedule notifications (email/WhatsApp) only fire for
    // plans entitled to the full reminder set. Lower tiers still get the in-app
    // notice below, so the guest is never left unaware of the new time.
    const rescheduleNotify = await planService.rescheduleNotifyForPlan(
      planService.resolveVendorPlan(host),
    );
    const oldWhen = new Date(booking.scheduled_at).toLocaleString("en-IN", {
      timeZone: hostTimezone,
    });
    const newWhen = new Date(scheduled_at).toLocaleString("en-IN", {
      timeZone: hostTimezone,
    });
    const apiBaseUrl =
      process.env.API_URL || `${req.protocol}://${req.get("host")}`;
    const ackUrl = `${apiBaseUrl}/api/bookings/${booking.id}/confirm-reschedule?token=${ackToken}`;

    try {
      const rescheduleData = bookingEmailData({
        serviceTitle: s?.title, hostName: host.name, hostPhone: host.phone,
        guestName: booking.guest_name, scheduledAt: scheduled_at, tz: hostTimezone, bookingId: booking.id,
      });
      // WhatsApp + email both ride the engine. Guests are phone-identity (many have
      // NO email), so gate on either channel — not email alone — or phone-only guests
      // get no reschedule notice. templateParams match the 4-var AiSensy "Booking
      // Rescheduled" templates: customer [guest, service, host, newTime]; vendor
      // [host, guest, service, newTime] (same shape as customerParams/vendorParams,
      // no actionLink → exactly 4). The ack/confirm link stays in email + in-app.
      const rescheduleCtx = { guestName: booking.guest_name, serviceTitle: s?.title, hostName: host.name, when: newWhen };
      if (rescheduleNotify && (booking.guest_email || booking.guest_phone)) {
        await NotificationEngine.send({
          event: "BOOKING_RESCHEDULED_CUSTOMER",
          data: {
            email: booking.guest_email, phone: booking.guest_phone, name: booking.guest_name,
            templateParams: customerParams(rescheduleCtx),
            emailData: { ...rescheduleData, ack_url: isHostReschedule ? ackUrl : "" },
            emailUser: { name: booking.guest_name, email: booking.guest_email },
            recipientUserId: booking.guest_id, bookingId: booking.id,
          },
        });
      }
      if (rescheduleNotify && (host.email || host.phone)) {
        await NotificationEngine.send({
          event: "BOOKING_RESCHEDULED_VENDOR",
          data: {
            email: host.email, phone: host.phone, name: host.name,
            templateParams: vendorParams(rescheduleCtx),
            emailData: rescheduleData,
            emailUser: { name: host.name, email: host.email, username: host.username },
            recipientUserId: booking.host_id, bookingId: booking.id,
          },
        });
      }
      // In-app: notify the OTHER party about the reschedule (not the actor).
      if (booking.guest_id && booking.guest_id !== req.user.id) {
        inAppNotify({
          userId: booking.guest_id,
          role: 'guest',
          type: 'BOOKING_RESCHEDULED',
          title: 'Booking rescheduled',
          body: `New time: ${newWhen}`,
          link: '/user/my-bookings',
          data: { bookingId: booking.id },
        });
      }
      if (booking.host_id !== req.user.id) {
        inAppNotify({
          userId: booking.host_id,
          role: 'host',
          type: 'BOOKING_RESCHEDULED',
          title: 'Booking rescheduled',
          body: `New time: ${newWhen}`,
          link: '/dashboard/bookings',
          data: { bookingId: booking.id },
        });
      }
    } catch (emailError) {
      console.error("Reschedule email error:", emailError.message);
    }

    res.json(await redactForRequest(updated, req));

    // The reschedule reset the reminder flags (so the cron re-fires for the new
    // time). If that new time is itself last-minute, the cron's band would miss
    // it — fire the catch-up here. Self-gates on plan inside fireDueReminders.
    runInBackground("rescheduleBooking:catchup-reminder", () =>
      fireDueReminders({ ...booking, ...updated, services: booking.services }, host),
    );
  } catch (error) {
    safeError(res, error);
  }
};

// Task 6: reminder processor — called every 5 min from server.js
// GET /api/bookings/:id/confirm-reschedule?token=
const confirmReschedule = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("Missing confirmation token.");

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("*, services(*), profiles!bookings_host_id_fkey(*)")
      .eq("id", req.params.id)
      .eq("reschedule_ack_token", token)
      .single();

    if (error || !booking)
      return res
        .status(404)
        .send("This confirmation link is invalid or expired.");

    // P3-1: reject an expired ack token (column absent on a legacy DB → skip).
    if (
      booking.reschedule_ack_token_expires_at &&
      new Date(booking.reschedule_ack_token_expires_at) < new Date()
    )
      return res
        .status(410)
        .send("This confirmation link has expired. Please ask the host to resend the new time.");

    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        reschedule_status: "acknowledged",
        reschedule_ack_token: null,
        reschedule_acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error('reschedule ack update:', updateError.message);
      return res.status(500).send("Something went wrong confirming your reschedule. Please contact support.");
    }

    const s = booking.services;
    const host = hostOf(booking);
    const rescheduleNotify = await planService.rescheduleNotifyForPlan(
      planService.resolveVendorPlan(host),
    );
    const tz = await resolveHostTz(booking.host_id);
    const when = new Date(booking.scheduled_at).toLocaleString("en-IN", { timeZone: tz });

    try {
      if (rescheduleNotify && (host.email || host.phone)) {
        await NotificationEngine.send({
          event: "BOOKING_RESCHEDULED_VENDOR",
          data: {
            email: host.email, phone: host.phone, name: host.name,
            templateParams: vendorParams({ guestName: booking.guest_name, serviceTitle: s?.title, hostName: host.name, when }),
            emailData: bookingEmailData({
              serviceTitle: s?.title, hostName: host.name, hostPhone: host.phone,
              guestName: booking.guest_name, scheduledAt: booking.scheduled_at, tz, bookingId: booking.id,
            }),
            emailUser: { name: host.name, email: host.email, username: host.username },
            recipientUserId: booking.host_id, bookingId: booking.id,
          },
        });
      }
    } catch (emailError) {
      console.error(
        "Reschedule acknowledgement email error:",
        emailError.message,
      );
    }

    res.send(
      emailHtml(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.12em;">Confirmed</p>
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;">Thanks, the new time is acknowledged</h1>
      ${row("Service", escHtml(s?.title || "Service"))}
      ${row("When", escHtml(when))}
    `),
    );
  } catch (error) {
    console.error('acknowledgeReschedule:', error.message);
    res.status(500).send("Something went wrong. Please contact support.");
  }
};

// Which booking column tracks a given reminder window as already sent.
const reminderFlagFor = (windowHours) =>
  windowHours === 24 ? "reminder_24h_sent" : "reminder_1h_sent";

// Send the guest + host reminder pair for one booking. Content is identical for
// every lead-time (it shows the actual scheduled time), so callers don't pass
// the window — only the cron's flag bookkeeping differs.
// WhatsApp booking reminders are a paid perk. Free (Sloth) hosts get them for a
// grace window — their first 2 months — after which their reminders fall back to
// email; paid/comped plans always keep WhatsApp. The window is anchored no earlier
// than WHATSAPP_FREE_LAUNCH so EXISTING free hosts (all already >2 months old) are
// grandfathered a fresh window from the scaling launch rather than being cut off the
// day this ships. Suppressing `phone` on a reminder send makes NotificationEngine
// skip the WhatsApp attempt (it only fires when data.phone is set) while the email
// send is untouched. Applies to both the guest and the host reminder.
const WHATSAPP_FREE_DAYS = 60;
const WHATSAPP_FREE_LAUNCH_MS = Date.parse("2026-10-01T00:00:00+05:30");
const whatsappRemindersAllowed = (host) => {
  const plan = planService.resolveVendorPlan(host);
  if (!planService.isFreeSlug(plan)) return true;   // paid / comped → always WhatsApp
  if (!host?.created_at) return true;               // unknown signup → don't downgrade
  const anchor = Math.max(new Date(host.created_at).getTime(), WHATSAPP_FREE_LAUNCH_MS);
  return Date.now() < anchor + WHATSAPP_FREE_DAYS * 86400000;
};

const sendBookingReminder = async (b, host, tz) => {
  const s = b.services;
  const when = new Date(b.scheduled_at).toLocaleString("en-IN", { timeZone: tz });
  // Mode of truth = service.meeting_mode (NOT meeting_link presence — the Meet
  // link may not be minted yet). Online → join link; offline → dashboard for now.
  const isOnline = (s?.meeting_mode || (b.meeting_link ? "online" : "offline")) === "online";
  const dashboard = `${process.env.CLIENT_URL || "https://bookasloth.com"}/dashboard`;
  // WhatsApp reminder templates carry a 5th "join/directions" var: Meet link when
  // online, the host's map link when offline (falls back to the dashboard).
  const directions = host.map_link || "";
  const actionLink = isOnline
    ? (b.meeting_link || dashboard)
    : (directions || dashboard);
  const ctx = { guestName: b.guest_name, serviceTitle: s?.title, hostName: host.name, when, actionLink };
  const emailData = bookingEmailData({
    serviceTitle: s?.title, hostName: host.name, hostPhone: host.phone,
    guestName: b.guest_name, scheduledAt: b.scheduled_at, tz, bookingId: b.id,
    online: isOnline, actionLink: isOnline && b.meeting_link ? b.meeting_link : "",
    mapLink: directions, hostLocation: host.location,
  });
  // Gate WhatsApp behind the plan/grace window; null phone → email-only send.
  const waOk = whatsappRemindersAllowed(host);
  await NotificationEngine.send({
    event: "BOOKING_REMINDER_CUSTOMER",
    data: {
      email: b.guest_email, phone: waOk ? b.guest_phone : null, name: b.guest_name,
      templateParams: customerParams(ctx),
      emailData, emailUser: { name: b.guest_name, email: b.guest_email },
      recipientUserId: b.guest_id, bookingId: b.id,
    },
  });
  await NotificationEngine.send({
    event: "BOOKING_REMINDER_VENDOR",
    data: {
      email: host.email, phone: waOk ? host.phone : null, name: host.name,
      templateParams: vendorParams(ctx),
      emailData, emailUser: { name: host.name, email: host.email, username: host.username },
      recipientUserId: b.host_id, bookingId: b.id,
    },
  });
};

// Catch-up reminder for last-minute bookings. The 5-min cron only matches a
// ±10-min band around each lead-time, so a booking created INSIDE that band's
// past edge (e.g. booked 40 min before a session) would never trip the 1h
// reminder. Call this right after a booking becomes confirmed (or is moved to a
// new time): it fires a single nudge for any plan-entitled window whose lead-time
// has already elapsed, and marks every elapsed window's flag so the cron never
// double-sends. Still-future windows are left to the cron. Best-effort.
const fireDueReminders = async (booking, host) => {
  try {
    if (!booking || booking.status !== "confirmed") return;
    if (!(await featureFlags.isFeatureEnabled("booking_reminders"))) return;
    const windows = await planService.reminderWindowsForPlan(
      planService.resolveVendorPlan(host),
    );
    if (!windows.length) return;
    const now = Date.now();
    const startMs = new Date(booking.scheduled_at).getTime();
    if (!(startMs > now)) return; // already started — nothing to remind about
    // Entitled windows whose lead-time is already past and not yet sent.
    const due = windows.filter(
      (w) => startMs - w * 3600000 <= now && !booking[reminderFlagFor(w)],
    );
    if (!due.length) return;
    // Only send an INSTANT catch-up when the session is within the SMALLEST
    // entitled window. If a smaller window's reminder time is still in the future,
    // the cron will send it then — firing a "reminder" seconds after the booking
    // confirmation (e.g. a next-day booking tripping the 24h window) is redundant
    // noise. We still mark every elapsed window sent so the cron never fires a
    // stale one; a not-yet-due smaller window stays false for the cron to handle.
    const smallest = Math.min(...windows);
    const imminent = startMs - now <= smallest * 3600000;
    const flags = { updated_at: new Date().toISOString() };
    for (const w of due) flags[reminderFlagFor(w)] = true;
    if (imminent) {
      const tz = await resolveHostTz(booking.host_id);
      await sendBookingReminder(booking, host, tz);
    }
    await supabaseAdmin.from("bookings").update(flags).eq("id", booking.id);
  } catch (err) {
    console.error(`fireDueReminders error for booking ${booking?.id}:`, err.message);
  }
};

const processReminders = async () => {
  if (!(await featureFlags.isFeatureEnabled("booking_reminders"))) return;
  const now = new Date();
  // P1-8: render reminder times in each host's timezone, not the server's (UTC).
  // Cache per host so a batch doesn't re-query availability for every booking.
  const tzCache = new Map();
  const tzFor = async (hostId) => {
    if (!tzCache.has(hostId)) tzCache.set(hostId, await resolveHostTz(hostId));
    return tzCache.get(hostId);
  };
  // Memoize reminder windows per plan slug for the batch. planService.loadPlans
  // is already 60s-cached in memory (so this is a cheap read, not a DB round-trip),
  // but a batch of same-plan bookings would otherwise re-resolve the same slug on
  // every row — this collapses that to one lookup per distinct plan.
  const windowsCache = new Map();
  const windowsFor = async (slug) => {
    if (!windowsCache.has(slug)) windowsCache.set(slug, await planService.reminderWindowsForPlan(slug));
    return windowsCache.get(slug);
  };
  // P2-08: widen the lower (further-future) edge of each band by a catch-up margin
  // so a cron gap (deploy/restart/DB blip) doesn't let a booking slide past its
  // reminder window unsent forever. The lower edge is clamped to at least now+5min
  // so a started session is never "reminded"; the worst case is a reminder sent up
  // to CATCHUP_MIN late, which is harmless. Bands stay disjoint (24h vs 1h).
  const CATCHUP_MIN = Number(process.env.REMINDER_CATCHUP_MIN) || 30;
  for (const windowHours of [24, 1]) {
    const leadMin = windowHours * 60;
    const lowerOffsetMin = Math.max(5, leadMin - 10 - CATCHUP_MIN);
    const rangeStart = new Date(now.getTime() + lowerOffsetMin * 60000);
    const rangeEnd = new Date(now.getTime() + (leadMin + 10) * 60000);
    const sentFlag = reminderFlagFor(windowHours);

    const { data: bookings, error: remErr } = await supabaseAdmin
      .from("bookings")
      .select("*, services(*), profiles!bookings_host_id_fkey(*)")
      .eq("status", "confirmed")
      .eq(sentFlag, false)
      .gte("scheduled_at", rangeStart.toISOString())
      .lte("scheduled_at", rangeEnd.toISOString());
    // P2-06: don't swallow a query error — a transient DB failure was silently
    // no-op'ing a whole reminder window with no trace.
    if (remErr) {
      console.error(`processReminders query error (${windowHours}h window):`, remErr.message);
      continue;
    }

    for (const b of bookings || []) {
      const host = hostOf(b);
      // Plan gate (DB-driven reminder_flows): Starter gets none, Host+/Creator
      // gets 24h, Studio/Professional gets 24h + 1h. Not entitled → leave the
      // flag false and let the booking age out of the ±10-min band naturally.
      const windows = await windowsFor(planService.resolveVendorPlan(host));
      if (!windows.includes(windowHours)) continue;
      try {
        // Claim this reminder BEFORE sending: a conditional flip false→true so an
        // overlapping cron tick (or a second instance that lost the in-process
        // guard) cannot also send it. 0 rows updated → someone else already
        // claimed it; skip. This makes the flag the dedup key, not the send order.
        const { data: claimed } = await supabaseAdmin
          .from("bookings")
          .update({ [sentFlag]: true, updated_at: new Date().toISOString() })
          .eq("id", b.id)
          .eq(sentFlag, false)
          .select("id");
        if (!claimed || !claimed.length) continue; // claimed by another tick/instance
        try {
          const tz = await tzFor(b.host_id);
          await sendBookingReminder(b, host, tz);
        } catch (emailErr) {
          // Send threw — release the claim so a later tick retries rather than
          // leaving a reminder marked "sent" that never went out.
          try {
            await supabaseAdmin.from("bookings").update({ [sentFlag]: false }).eq("id", b.id);
          } catch (_) { /* best-effort release */ }
          console.error(`Reminder error for booking ${b.id}:`, emailErr.message);
        }
      } catch (claimErr) {
        console.error(`Reminder claim error for booking ${b.id}:`, claimErr.message);
      }
    }
  }
};

// ── Auto-completion cron ───────────────────────────────────────────
// Nobody can be relied on to click "Mark Completed" (especially for no-shows),
// which would leave a past session 'confirmed' forever — the lifecycle never
// closes and the intended revenue-recognition / settlement-eligibility path
// never fires (so the vendor's earnings never become settle-able). This sweep
// finds confirmed bookings whose session window has fully elapsed
// (duration + grace + hold) and completes them through the shared
// markBookingCompleted, identical to a host clicking "Mark Completed".
//
//   HOLD   (default 120 min) — post-session dispute/refund buffer before
//          revenue is recognised. Override with AUTO_COMPLETE_HOLD_MIN.
//   CUTOFF — bounds the first-run backfill: a session that ended before it is
//          ignored. Defaults to 3 days before boot (so a restart still catches
//          recent sessions but never mass-completes ancient history). Set
//          AUTO_COMPLETE_CUTOFF=<ISO> to the deploy timestamp for zero backfill.
const AUTO_COMPLETE_HOLD_MS = (Number(process.env.AUTO_COMPLETE_HOLD_MIN) || 120) * 60 * 1000;
const AUTO_COMPLETE_CUTOFF = process.env.AUTO_COMPLETE_CUTOFF
  ? new Date(process.env.AUTO_COMPLETE_CUTOFF)
  : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const AUTO_COMPLETE_BATCH = 200;

const autoCompleteBookings = async () => {
  const now = Date.now();
  const hostJoin = "profiles!bookings_host_id_fkey(name, email, phone, username, location, map_link)";
  // Coarse DB prefilter (confirmed + already past start); the precise
  // duration + grace + hold check is applied per-row in JS below because the
  // session end depends on each service's duration/grace.
  // F20: exclude pre-cutoff rows in SQL, not just in the JS skip below. With an
  // ascending, fixed-size batch, once 200+ un-completable confirmed bookings pile
  // up (a host who never completes, an outage) the oldest-first batch fills
  // entirely with pre-cutoff rows that are all skipped — and NO booking is ever
  // auto-completed again, silently, stalling host settlement. Bounding the query
  // to scheduled_at >= (cutoff − one day) keeps the batch full of ELIGIBLE rows in
  // the right (oldest-first) order; the one-day slack ensures a long session that
  // started before the cutoff but ended after it is still considered (the precise
  // sessionEnd < cutoff decision stays in the JS loop).
  const floorIso = new Date(AUTO_COMPLETE_CUTOFF.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const baseQuery = (svcCols) =>
    supabaseAdmin
      .from("bookings")
      .select(`*, services(title, ${svcCols}), ${hostJoin}`)
      .eq("status", "confirmed")
      .gte("scheduled_at", floorIso)
      .lte("scheduled_at", new Date(now).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(AUTO_COMPLETE_BATCH);

  let result = await baseQuery("duration, grace_period_minutes");
  // Fallback if the schema cache doesn't know grace_period_minutes yet.
  if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
    result = await baseQuery("duration");
  }
  const { data: rows, error } = result;
  if (error) {
    console.error("Auto-complete query error:", error.message);
    return { completed: 0 };
  }

  let completed = 0;
  for (const b of rows || []) {
    const sessionMin = (b.services?.duration || 30) + (b.services?.grace_period_minutes || 0);
    const sessionEnd = new Date(b.scheduled_at).getTime() + sessionMin * 60 * 1000;
    if (sessionEnd < AUTO_COMPLETE_CUTOFF.getTime()) continue; // pre-cutoff backlog — skip
    if (now < sessionEnd + AUTO_COMPLETE_HOLD_MS) continue;    // still inside the hold window
    const { error: e } = await markBookingCompleted(b, { notify: true });
    if (e) {
      console.error(`Auto-complete failed for booking ${b.id}:`, e.message);
      continue;
    }
    completed += 1;
  }
  if (completed) console.log(`Auto-complete: completed ${completed} booking(s)`);
  return { completed };
};

// ── Stale unpaid-hold reaper (security audit H-2) ──────────────────────────
// A paid-service booking is created status:'pending'/payment_status:'unpaid'
// and immediately reserves the slot (it counts as busy in availability and is
// covered by the bookings_no_overlap exclusion constraint). Nothing required
// payment to hold the slot and abandoned holds never expired — so abandoned
// checkouts (or an attacker spraying the API) could squat a host's whole
// calendar and deny real customers. This sweep cancels unpaid pending holds
// older than the hold window, releasing the slot for both the availability
// picker and the DB constraint (both ignore status='cancelled').
//
// The window must comfortably exceed a real checkout (incl. redirect-based UPI)
// so a genuine in-flight payment is never reaped mid-flow; the booking-payment
// reconciler also heals actually-paid bookings within minutes, well before this
// fires. P2-12: default widened to 45 min so a slow redirect/UPI capture can't
// land after the reap on an already-cancelled booking (money taken, no auto-refund).
// Override with PENDING_BOOKING_HOLD_MIN.
const PENDING_HOLD_MS = (Number(process.env.PENDING_BOOKING_HOLD_MIN) || 45) * 60 * 1000;
const PENDING_REAP_BATCH = 200;

const expireStalePendingBookings = async () => {
  const cutoff = new Date(Date.now() - PENDING_HOLD_MS).toISOString();
  const nowIso = new Date().toISOString();
  // F11: stamp settlement_status='cancelled' too, matching cancelBookingRecord.
  // The reaper is the OTHER writer of status='cancelled', and it used to set only
  // status — leaving reaped holds at settlement_status='pending_completion', an
  // impossible state (cancelled but still "awaiting completion") that every
  // settlement/payout reader (SKIP_SETTLE) has to special-case. These rows are
  // unpaid so no money is at risk, but the invariant "cancelled ⇒ settlement
  // cancelled" should hold for every cancel path.
  const reap = (extra) =>
    supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", settlement_status: "cancelled", updated_at: nowIso, ...extra })
      .eq("status", "pending")
      .eq("payment_status", "unpaid")
      .lt("created_at", cutoff)
      .select("id")
      .limit(PENDING_REAP_BATCH);

  let { data, error } = await reap({ cancelled_at: nowIso });
  // Legacy DB without a cancelled_at column: retry with the minimal update.
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    ({ data, error } = await reap({}));
  }
  if (error) {
    console.error("Pending-hold reaper error:", error.message);
    return { expired: 0 };
  }
  const expired = (data || []).length;
  if (expired) console.log(`Pending-hold reaper: expired ${expired} stale unpaid booking(s)`);
  return { expired };
};

module.exports = {
  getServiceById,
  getBookedSlots,
  getAvailableSlots,
  createBooking,
  getHostBookings,
  getGuestBookings,
  cancelBooking,
  cancelBookingRecord,
  completeBooking,
  guestConfirmComplete,
  guestReportProblem,
  markNoShow,
  markBookingCompleted,
  autoCompleteBookings,
  expireStalePendingBookings,
  isValidBookingTransition,
  rescheduleBooking,
  confirmReschedule,
  processReminders,
  fireDueReminders,
  bookingEmailData, // exported for unit testing (offline map-link surfacing)
  whatsappRemindersAllowed, // exported for unit testing (free 2-month WhatsApp grace)
};
