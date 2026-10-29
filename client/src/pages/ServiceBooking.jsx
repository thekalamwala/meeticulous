import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getServiceBySlug,
  sendOtp,
  verifyOtp,
  createBooking,
  getBookedSlots,
  getAvailableSlots,
  createPaymentOrder,
  verifyPayment,
  getHostReviews,
  invoiceUrl,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { analytics, EVENTS, gaClientId } from "../services/analytics";
import useUtm from "../hooks/useUtm";
import toast from "react-hot-toast";
import {
  DEFAULT_THEME_COLOR,
  getContrastColor,
  getPlanBorderColor,
  SOCIAL_BRAND_COLORS,
  isValidHex,
  applyProfileTheme,
} from "../utils/themeUtils";
import { downloadReceipt } from "../utils/receipt";
import loadRazorpay from "../utils/loadRazorpay";
import PetalSpinner from "../components/common/PetalSpinner";
import { INDIAN_STATES } from "../lib/indianStates";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Build a Google Calendar "add event" URL from a UTC start ISO + duration (min).
const googleCalUrl = ({ title, details, location, startISO, durationMin }) => {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Booking",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: details || "",
    location: location || "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

// Generate a downloadable .ics blob URL for a single event.
const buildICS = ({ title, details, location, startISO, durationMin, uid }) => {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60000);
  const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meeticulous//Booking//EN",
    "BEGIN:VEVENT", `UID:${uid || fmt(start)}@bookasloth`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(location)}`, "END:VEVENT", "END:VCALENDAR",
  ];
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
};

// BUG-13 fix: convert a wall-clock time in the host's timezone to UTC
// Uses only the built-in Intl API — no external library needed.
const wallClockToUTC = (year, month, day, hour, minute, tz) => {
  // Step 1: treat the target time as if it were UTC to get a reference Date
  const fakeUTC = new Date(Date.UTC(year, month, day, hour, minute, 0));
  // Step 2: find what wall-clock time that UTC instant shows in `tz`
  const tzStr = fakeUTC.toLocaleString("sv", { timeZone: tz }); // "YYYY-MM-DD HH:MM:SS"
  const inTz = new Date(tzStr.replace(" ", "T") + "Z");
  // Step 3: the offset = fakeUTC − inTz
  const offsetMs = fakeUTC.getTime() - inTz.getTime();
  // Step 4: apply offset to get the true UTC instant
  return new Date(fakeUTC.getTime() + offsetMs).toISOString();
};

// Warmth: keyframes for the celebration + labour-illusion screen. Injected once.
const BAS_KEYFRAMES = `
@keyframes basPop {0%{transform:scale(.5);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes basBob {0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes basFade {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes otpPop {0%{transform:scale(.82)}55%{transform:scale(1.12)}100%{transform:scale(1)}}
.otp-pop{animation:otpPop .18s ease}
.bas-pop{animation:basPop .5s cubic-bezier(.2,.8,.2,1) both}
.bas-bob{animation:basBob 2.4s ease-in-out infinite}
.bas-fade{animation:basFade .5s ease both}
`;

// Skeleton placeholder shown while the slot list is being fetched, so the panel
// doesn't flash empty / jump when times arrive.
const SlotSkeleton = () => (
  <div className="grid grid-cols-3 gap-2" aria-hidden="true">
    {Array.from({ length: 9 }).map((_, i) => (
      <div key={i} className="h-[42px] rounded-lg bg-gray-200/70 animate-pulse" />
    ))}
  </div>
);

// Labour-illusion: a short "wrapping up" screen between the action (pay / verify)
// and the confirmed view. Operational transparency — makes the result feel
// earned and reassures the guest that real work is happening.
const FINALIZE_STEPS_PAID = [
  "Confirming your payment",
  "Securing your spot",
  "Sending your confirmation",
  "Adding it to your calendar",
];
const FINALIZE_STEPS_FREE = [
  "Securing your spot",
  "Sending your confirmation",
  "Adding it to your calendar",
];

const FinalizingScreen = ({ tc, textOnTheme, isPaid, task, onDone }) => {
  const steps = isPaid ? FINALIZE_STEPS_PAID : FINALIZE_STEPS_FREE;
  const [active, setActive] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const STEP_MS = 620;
    const timers = steps.map((_, i) =>
      setTimeout(() => { if (!cancelled) setActive(i + 1); }, (i + 1) * STEP_MS),
    );
    // The animation doubles as cover for the background work (e.g. payment
    // verify). Reveal only once BOTH the min animation time and the task settle.
    const minDelay = new Promise((res) => {
      timers.push(setTimeout(res, steps.length * STEP_MS + 300));
    });
    const work = task || Promise.resolve({ ok: true });
    Promise.all([work, minDelay]).then(([result]) => {
      if (!cancelled) onDone(result || { ok: true });
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
      <div className="max-w-md mx-auto text-center py-2">
        <div className="mb-4 flex justify-center"><PetalSpinner size={40} color={tc} /></div>
        <h2 className="text-xl font-bold mb-1">Wrapping things up…</h2>
        <p className="text-sm text-gray-500 mb-6">Hang tight — almost there.</p>
        <ul className="text-left max-w-xs mx-auto space-y-3">
          {steps.map((label, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li
                key={label}
                className="flex items-center gap-3 transition-opacity duration-300"
                style={{ opacity: done || current ? 1 : 0.45 }}
              >
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                  style={{ background: done ? tc : current ? `${tc}22` : "#f3f4f6" }}
                >
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke={textOnTheme} strokeWidth={3}
                      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : current ? (
                    <span className="w-3.5 h-3.5 rounded-full animate-spin"
                      style={{ border: `2px solid ${tc}`, borderTopColor: "transparent" }} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  )}
                </span>
                <span className="text-sm font-medium"
                  style={{ color: done || current ? "#1E0B4D" : "#9ca3af" }}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// Country dial codes offered on the phone field (India default).
const DIAL_CODES = ["+91", "+1", "+44", "+971"];

// Floating-label text input: label rests centered inside an empty field and
// animates up onto the top border on focus / when filled. Uses the CSS `peer`
// pattern — no extra JS. Focus color comes from the --tc var set on the step.
// Floating label: label sits inside the empty field and animates up to the
// border on focus / when filled.
const FloatingInput = ({ id, label, type = "text", value, onChange, required, autoComplete }) => (
  <div className="relative">
    <input
      id={id}
      type={type}
      required={required}
      autoComplete={autoComplete}
      placeholder={label}
      value={value}
      onChange={onChange}
      className="peer fb-input fb-input--sm !rounded-lg !border placeholder-transparent"
    />
    <label
      htmlFor={id}
      className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 transition-all
        peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400
        peer-focus:top-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[color:var(--tc)]"
    >
      {label}{required && <span style={{ color: "#e42527" }}> *</span>}
    </label>
  </div>
);

// 6-box OTP entry. Keeps the parent's joined string in sync (so verify +
// auto-submit are unchanged); auto-advances focus and pops each box on entry.
const OTP_LEN = 6;
const OtpBoxes = ({ value, onChange, tc }) => {
  const refs = useRef([]);
  const [pop, setPop] = useState(-1);
  const focus = (i) => refs.current[Math.max(0, Math.min(OTP_LEN - 1, i))]?.focus();

  const handleChange = (i, e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length === 1) {
      onChange((value.slice(0, i) + digits + value.slice(i + 1)).slice(0, OTP_LEN));
      setPop(i);
      window.setTimeout(() => setPop((p) => (p === i ? -1 : p)), 180);
      if (i < OTP_LEN - 1) focus(i + 1);
    } else {
      const next = (value.slice(0, i) + digits).slice(0, OTP_LEN);
      onChange(next);
      focus(next.length);
    }
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); focus(i - 1); }
    } else if (e.key === "ArrowLeft") focus(i - 1);
    else if (e.key === "ArrowRight") focus(i + 1);
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LEN);
    if (digits) { onChange(digits); focus(digits.length); }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
      {Array.from({ length: OTP_LEN }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          autoFocus={i === 0}
          className={`w-11 h-14 sm:w-12 text-center text-2xl font-bold rounded border-2 outline-none transition-colors ${pop === i ? "otp-pop" : ""}`}
          style={{ borderColor: value[i] ? tc : "var(--color-line)", color: "#111827" }}
        />
      ))}
    </div>
  );
};

const ServiceBooking = () => {
  const { profileSlug, serviceSlug } = useParams();
  const { user } = useAuth();

  const [host, setHost] = useState(null);
  const [service, setService] = useState(null);
  // Admin-editable booking charge (platform fee + GST), from the server so the
  // summary always matches what Razorpay charges. Defaults until fetched.
  const [fees, setFees] = useState({ bookingFee: 0, platformFee: 0, gstRate: 0.18, feeOnly: true });
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState("time"); // 'time'|'details'|'otp'(guest only)|'payment'|'confirmed'

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [bookedSlots, setBookedSlots] = useState([]);
  // Server-computed availability (working hours − bookings − Google busy −
  // blocked dates). null → fall back to the legacy client-side computation.
  const [serverSlots, setServerSlots] = useState(null);
  // True when the host's Google Calendar could not be checked for this date
  // (Google outage, no cache) — shown as a soft warning, booking still allowed.
  const [calendarUnverified, setCalendarUnverified] = useState(false);

  const [firstName, setFirstName] = useState(user?.name?.split(" ")[0] || "");
  const [lastName, setLastName] = useState(
    user?.name?.split(" ").slice(1).join(" ") || "",
  );
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [dialCode, setDialCode] = useState("+91"); // India default; USA/UK/UAE also offered
  // Full E.164-ish number actually sent (India: backend still normalizes to last-10).
  const fullPhone = `${dialCode}${phone.replace(/\D/g, "")}`;
  const [notes, setNotes] = useState("");
  const [billing, setBilling] = useState({
    name: user?.billing_details?.name || "",
    address: user?.billing_details?.address || "",
    state: user?.billing_details?.state || "",
    state_code: user?.billing_details?.state_code || "",
    gstin: user?.billing_details?.gstin || "",
    pan: user?.billing_details?.pan || "",
  });
  const [stateOpen, setStateOpen] = useState(false); // state combobox dropdown
  const [showBilling, setShowBilling] = useState(false); // reveal optional billing address / GSTIN / notes
  const [resendIn, setResendIn] = useState(0); // OTP resend cooldown (seconds)
  const [invoiceRef, setInvoiceRef] = useState(null); // {id, token}

  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const verifyingRef = useRef(false); // in-flight guard (auto-submit + button)
  const autoTriedRef = useRef("");     // last code auto-submitted — stops re-fire loop
  const [verifying, setVerifying] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const utm = useUtm(); // first-touch ad attribution → carried into the paid conversion event
  const [profileOpen, setProfileOpen] = useState(true); // permanent sidebar, expanded by default
  const [slotsLoading, setSlotsLoading] = useState(false); // skeleton while slots fetch
  const [finalizing, setFinalizing] = useState(false);     // labour-illusion screen
  const [finalizeMsg, setFinalizeMsg] = useState("");
  const [payError, setPayError] = useState(null);          // {type:'server'|'network'} after verify fail
  const finalizeTaskRef = useRef(null); // optional promise the finalize screen awaits

  // Labour-illusion: show the "wrapping up" screen, then reveal the confirmed view.
  // `task` (optional) is a promise the screen awaits before revealing — it must
  // resolve to { ok: true } on success or { ok: false, error } on failure, and
  // must never reject. The animation doubles as cover for that work so the
  // transition feels instant instead of waiting on a network round-trip.
  const triggerFinalize = (msg, task = null) => {
    finalizeTaskRef.current = task;
    setFinalizeMsg(msg || "");
    setPayError(null);
    setFinalizing(true);
  };
  const completeFinalize = (result) => {
    setFinalizing(false);
    finalizeTaskRef.current = null;
    if (result && result.ok === false) {
      // Payment verify failed. Distinguish a genuine server rejection from a
      // network/timeout (where the payment may actually have been captured).
      const isNetwork = !result.error?.response;
      setPayError({ type: isNetwork ? "network" : "server" });
      return;
    }
    setStep("confirmed");
    if (finalizeMsg) toast.success(finalizeMsg);
  };

  useEffect(() => {
    const fetchService = async () => {
      try {
        const { data } = await getServiceBySlug(profileSlug, serviceSlug);
        setHost(data.host);
        setService(data.service);
        setAvailability(data.availability);
        setFees({
          bookingFee:  Number(data.bookingFee ?? 0),
          platformFee: Number(data.platformFee ?? 0),
          gstRate:     Number(data.gstRate ?? 0.18),
          // Interim fee-only mode: a ₹0 service still pays the booking fee.
          feeOnly:     data.feeOnly ?? true,
        });
        // Section 1: host-level rating for the profile card (hidden when 0)
        try {
          const username = data.host?.username || profileSlug;
          const { data: rv } = await getHostReviews(username);
          setHost((h) => h ? { ...h, review_avg: rv?.avg ?? 0, review_count: rv?.count ?? 0 } : h);
        } catch { /* no reviews → row stays hidden */ }
        // SEO — update page title
        if (data.service?.title) {
          document.title = `Book ${data.service.title}${data.host?.name ? ` with ${data.host.name}` : ''} | Meeticulous`;
        }
        analytics.track(EVENTS.SERVICE_VIEWED, {
          service_id: data.service?.id,
          host_id: data.host?.id,
          price: Number(data.service?.price) || 0,
        });
      } catch {
        toast.error("Service not found");
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [profileSlug, serviceSlug]);

  // Fetch availability when the date changes. Prefer the server-computed
  // slot list (knows about Google Calendar busy times + blocked dates);
  // fall back to booked-slots + local computation if the endpoint is missing
  // (deploy skew) or errors.
  useEffect(() => {
    if (!selectedDate || !host) return;
    const d = selectedDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setServerSlots(null);
    setCalendarUnverified(false);
    setSlotsLoading(true);
    let cancelled = false;
    const tasks = [];
    if (service?.id) {
      tasks.push(
        getAvailableSlots(host.id, service.id, dateStr)
          .then(({ data }) => {
            if (cancelled) return;
            setServerSlots(Array.isArray(data?.slots) ? data.slots : null);
            setCalendarUnverified(!!data?.calendarUnverified);
          })
          .catch(() => { if (!cancelled) setServerSlots(null); }),
      );
    }
    tasks.push(
      getBookedSlots(host.id, dateStr)
        .then(({ data }) => { if (!cancelled) setBookedSlots(data || []); })
        .catch(() => { if (!cancelled) setBookedSlots([]); }),
    );
    Promise.allSettled(tasks).then(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate, host, service]);

  // Per-host theme → CSS vars (--profile-accent etc.) for the whole flow
  useEffect(() => {
    if (host) {
      const color = isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
      applyProfileTheme(document.documentElement, color);
    }
  }, [host]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m, y) => new Date(y, m, 1).getDay();

  const isDateSelectable = (day) => {
    const d = new Date(calYear, calMonth, day);
    if (d < today) return false;
    // Manual blocked dates ("YYYY-MM-DD" strings on the availability row)
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (Array.isArray(availability?.blocked_dates) &&
        availability.blocked_dates.some((b) => String(b).slice(0, 10) === dStr)) return false;
    if (!availability?.weekly_schedule) return true;
    const name = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][d.getDay()];
    const s = availability.weekly_schedule[name];
    return s && s.length > 0;
  };
  const isSameDate = (day) =>
    selectedDate &&
    selectedDate.getDate() === day &&
    selectedDate.getMonth() === calMonth &&
    selectedDate.getFullYear() === calYear;
  const isToday = (day) =>
    new Date(calYear, calMonth, day).toDateString() === today.toDateString();

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  };
  // autoModeRef: while true we're still auto-navigating to the first day with
  // open times. Any manual pick (a day or a slot) turns it off for good.
  const autoModeRef = useRef(true);
  const selectDate = (day) => {
    if (!isDateSelectable(day)) return;
    autoModeRef.current = false;
    setSelectedDate(new Date(calYear, calMonth, day));
    setSelectedTime("");
  };

  // Auto-pick the first schedule-selectable day (today onward) once the service
  // loads, so the guest lands on open times without clicking. Current real month
  // only; if none this month, leave unselected (guest browses forward).
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || !host || selectedDate) return;
    const now = new Date();
    if (calMonth !== now.getMonth() || calYear !== now.getFullYear()) return;
    autoPickedRef.current = true;
    for (let day = now.getDate(); day <= getDaysInMonth(calMonth, calYear); day++) {
      if (isDateSelectable(day)) { setSelectedDate(new Date(calYear, calMonth, day)); return; }
    }
  }, [host, availability, selectedDate, calMonth, calYear]);

  // A schedule-selectable day can still have zero open times (today's slots all
  // passed, or a fully-booked day). While auto-navigating, skip forward to the
  // next day that actually has slots; if the month runs out, clear the selection.
  useEffect(() => {
    if (!autoModeRef.current || slotsLoading || !selectedDate) return;
    const slots = serverSlots ?? getTimeSlots();
    if (slots.length > 0) return; // landed on a day with open times
    const d = selectedDate;
    if (d.getMonth() !== calMonth || d.getFullYear() !== calYear) return;
    for (let day = d.getDate() + 1; day <= getDaysInMonth(calMonth, calYear); day++) {
      if (isDateSelectable(day)) { setSelectedDate(new Date(calYear, calMonth, day)); return; }
    }
    autoModeRef.current = false;
    setSelectedDate(null); // no open day left this month → show the empty state
  }, [slotsLoading, serverSlots, selectedDate, calMonth, calYear]);

  // Task 4: host timezone label
  const hostTz = availability?.timezone || "Asia/Kolkata";
  const tzAbbr = (() => {
    try {
      return (
        new Intl.DateTimeFormat("en", {
          timeZone: hostTz,
          timeZoneName: "short",
        })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value || hostTz
      );
    } catch {
      return hostTz;
    }
  })();

  // Generate time slots: exclude past times (today), booked slots, and grace-period windows
  const getTimeSlots = () => {
    if (!selectedDate || !availability?.weekly_schedule) return [];
    const name = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][selectedDate.getDay()];
    const daySlots = availability.weekly_schedule[name] || [];
    const bufferMin = availability.buffer_minutes || 0;
    const svcDuration = service?.duration || 30;
    const svcGrace = service?.grace_period_minutes ?? 10;
    const stepMin = svcDuration + bufferMin;
    const slots = [];

    // For today, track current time so we don't show past slots
    const now = new Date();
    const isToday =
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate();
    // Add a small buffer (1 min) so a slot exactly at "now" is already excluded
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() + 1 : 0;

    for (const { start, end } of daySlots) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let cur = sh * 60 + sm;
      const endMin = eh * 60 + em;

      while (cur + svcDuration <= endMin) {
        const h = Math.floor(cur / 60),
          m = cur % 60;

        // Skip slots in the past for today
        if (isToday && cur < nowMin) {
          cur += stepMin;
          continue;
        }

        const tStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const sStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          h,
          m,
        );
        const sEnd = new Date(sStart.getTime() + svcDuration * 60000);

        // Block if slot overlaps with any existing booking's grace window
        const isBlocked = bookedSlots.some((b) => {
          const bS = new Date(b.scheduled_at);
          const bGrace = b.services?.grace_period_minutes ?? 10;
          const bE = new Date(
            bS.getTime() + (b.services?.duration || 30) * 60000,
          );
          // Slot is blocked if it falls within [bS - bGrace, bE + bGrace]
          return (
            sStart < new Date(bE.getTime() + bGrace * 60000) &&
            sEnd > new Date(bS.getTime() - bGrace * 60000)
          );
        });

        // Also block if any existing booking falls within this slot's grace window
        const graceClearsExisting = bookedSlots.some((b) => {
          const bS = new Date(b.scheduled_at);
          const bE = new Date(
            bS.getTime() + (b.services?.duration || 30) * 60000,
          );
          return (
            bS < new Date(sEnd.getTime() + svcGrace * 60000) &&
            bE > new Date(sStart.getTime() - svcGrace * 60000)
          );
        });

        if (!isBlocked && !graceClearsExisting) slots.push(tStr);
        cur += stepMin;
      }
    }
    return slots;
  };

  const formatTime = (t) => {
    if (timeFormat === "24h") return t;
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM",
      hr = h % 12 || 12;
    return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const getEndTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    const tot = h * 60 + m + (service?.duration || 30);
    return `${Math.floor(tot / 60)
      .toString()
      .padStart(2, "0")}:${(tot % 60).toString().padStart(2, "0")}`;
  };

  // Buyer billing snapshot for the GST invoice. A paid booking always carries the
  // billing STATE (required — it is the invoice's place of supply); the GSTIN /
  // business-name / address / PAN fields ride along only when the guest opts in.
  // A free booking owes no BAS tax invoice, so no billing is sent.
  const billingDetails = () => (isPaid ? billing : null);

  // BUG-16 fix: logged-in users skip OTP — book directly with their session
  const bookDirectly = async () => {
    setVerifying(true);
    try {
      const scheduledAt = wallClockToUTC( // BUG-13 fix: timezone-aware conversion
        selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
        ...selectedTime.split(":").map(Number), hostTz
      );
      const { data: bookingResult } = await createBooking({
        service_id: service.id,
        host_id: host.id,
        guest_id: user._id || user.id || null,
        guest_name: `${firstName} ${lastName}`.trim(),
        guest_email: email,
        guest_phone: fullPhone,
        scheduled_at: scheduledAt,
        notes,
        billing_details: billingDetails(),
      });
      setConfirmation(bookingResult);
      // Follow the server's decision: any amount payable (paid service OR the
      // interim ₹0-service booking fee) comes back as customer_total > 0.
      if (Number(bookingResult?.customer_total) > 0) {
        setStep("payment");
      } else {
        triggerFinalize("Booking confirmed!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed");
    } finally {
      setVerifying(false);
    }
  };

  const isPhoneValid = /^\+?[\d\s\-()]{8,17}$/.test(phone.trim());

  const handleSendOtp = async () => {
    if (!firstName || !email || !isPhoneValid) {
      toast.error("Name, email and a valid mobile number are required");
      return;
    }
    // BUG-16: logged-in users skip OTP entirely
    if (user) {
      await bookDirectly();
      return;
    }
    setOtpSending(true);
    try {
      await sendOtp({ email, phone: fullPhone, name: `${firstName} ${lastName}`.trim() });
      toast.success("Verification code sent to your WhatsApp!");
      setResendIn(30);
      setStep("otp");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send code");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyAndBook = async () => {
    if (verifyingRef.current) return; // guard: auto-submit + button can't double-fire
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    verifyingRef.current = true;
    setVerifying(true);
    try {
      const { data: otpResult } = await verifyOtp({ email, phone: fullPhone, otp });
      if (!otpResult.verified) {
        toast.error("Verification failed");
        return;
      }

      // BUG-13 fix: convert the host-timezone wall-clock time to UTC
      const scheduledAt = wallClockToUTC(
        selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
        ...selectedTime.split(":").map(Number), hostTz
      );

      const { data: bookingResult } = await createBooking({
        service_id: service.id,
        host_id: host.id,
        guest_id: otpResult.user?._id || null,
        guest_name: `${firstName} ${lastName}`.trim(),
        guest_email: email,
        guest_phone: fullPhone,
        scheduled_at: scheduledAt,
        notes,
        billing_details: billingDetails(),
        // H-1: short-lived grant proving this contact just passed OTP. The server
        // requires it for anonymous bookings (logged-in users use bookDirectly).
        booking_grant: otpResult.bookingGrant,
      });

      setConfirmation(bookingResult);
      // Follow the server's decision: any amount payable (paid service OR the
      // interim ₹0-service booking fee) comes back as customer_total > 0.
      if (Number(bookingResult?.customer_total) > 0) {
        setStep("payment");
      } else {
        triggerFinalize("Booking confirmed!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  // Principle #2: verify + book the moment all six digits land (typed or
  // pasted) — no separate "Verify" click. autoTriedRef stops the same failed
  // code re-firing; editing a digit re-arms it. Code kept on error so the user
  // can correct it.
  useEffect(() => {
    if (step === "otp" && otp.length === 6 && autoTriedRef.current !== otp) {
      autoTriedRef.current = otp;
      handleVerifyAndBook();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  // Task 7: Razorpay handler
  const handlePayment = async () => {
    if (paymentLoading) return;      // ignore double-clicks — one Razorpay modal at a time
    setPaymentLoading(true);         // disable the button BEFORE the async gateway load
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast.error("Payment gateway failed to load");
      setPaymentLoading(false);
      return;
    }
    analytics.track(EVENTS.CHECKOUT_STARTED, {
      booking_id: confirmation.id, service_id: service.id, host_id: host.id,
      value: Number(confirmation?.customer_total) || 0, currency: "INR",
      // event_id = booking id → Meta de-dupes this browser InitiateCheckout against
      // the server booking_created InitiateCheckout (trackServer eventId=booking.id).
      event_id: confirmation.id,
    });
    try {
      // BUG-02 fix: send guest_email so server can authorize the payment
      const { data: order } = await createPaymentOrder({
        booking_id: confirmation.id,
        guest_email: email,
      });
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Meeticulous",
        description: service.title,
        order_id: order.razorpay_order_id,
        handler: (response) => {
          // Browser-side conversion for retargeting. Authoritative count is the
          // server CAPI/MP hit (paymentController); Meta/GA4 de-dupe on the shared
          // event_id = razorpay_payment_id. UTM spread stitches ad-click → paid.
          analytics.track(EVENTS.BOOKING_PAID, {
            booking_id: confirmation.id, service_id: service.id, host_id: host.id,
            value: Number(confirmation?.customer_total) || 0, currency: "INR",
            event_id: response.razorpay_payment_id,
            transaction_id: response.razorpay_payment_id, // GA4 purchase de-dupe key
            ...utm,
          });
          // Move to the "wrapping up" screen INSTANTLY so the return from
          // Razorpay never feels frozen. The verify round-trip runs in the
          // background and the labour animation covers its latency; the screen
          // only reveals confirmed (or an error) once verify settles.
          const verifyTask = verifyPayment({
            booking_id: confirmation.id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            ga_client_id: gaClientId(),   // join server GA4 hit to this web session
          })
            .then(({ data: verifyData }) => {
              // Post-payment the server creates the calendar event; pick up link.
              if (verifyData?.booking) {
                setConfirmation((prev) => ({ ...prev, ...verifyData.booking }));
              }
              if (verifyData?.invoice) setInvoiceRef(verifyData.invoice);
              return { ok: true };
            })
            // Shape failures into a result so the promise never rejects: server
            // reject (err.response) vs network/timeout (no response) handled in
            // completeFinalize.
            .catch((error) => ({ ok: false, error }));
          triggerFinalize("Payment successful! Booking confirmed.", verifyTask);
        },
        prefill: {
          name: `${firstName} ${lastName}`.trim(),
          email,
          contact: fullPhone,
        },
        theme: { color: tc },
        // Guest closed the Razorpay modal without paying. Re-enable the Pay button
        // (stays on the payment step) so they can retry; booking remains unpaid.
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            toast("Payment cancelled — you can try again when ready.", { icon: "🫤" });
          },
        },
      };
      const rzp = new window.Razorpay(options);
      // A failed charge inside the modal (declined card / failed UPI). Surface a
      // message and keep the user on the payment step to retry.
      rzp.on("payment.failed", (resp) => {
        setPaymentLoading(false);
        toast.error(resp?.error?.description || "Payment failed — please try again.");
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initiate payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  // The host's theme colour is only known after the fetch resolves, but the
  // loading spinner paints before that. Seed it from a colour the profile page
  // stashed for this slug so the spinner matches the host immediately; fall back
  // to brand orange only for a cold direct link (never visited the profile).
  const seededTheme = useMemo(() => {
    try {
      const c = sessionStorage.getItem(`bas_theme:${profileSlug}`);
      return isValidHex(c) ? c : null;
    } catch { return null; }
  }, [profileSlug]);

  // Derive theme color from host profile (seed → default while host loads).
  const tc = host && isValidHex(host.theme_color)
    ? host.theme_color
    : (seededTheme || DEFAULT_THEME_COLOR);
  const textOnTheme = getContrastColor(tc);
  const borderColor = getPlanBorderColor(host?.plan || 'explorer');

  // OTP resend cooldown tick.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Masked phone for the verify screen: dial code + last 4, middle dotted.
  const maskedPhone = (() => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 4) return fullPhone;
    return `${dialCode} ${"•".repeat(Math.max(3, digits.length - 4))} ${digits.slice(-4)}`;
  })();

  // Once the host resolves, remember its theme colour so a refresh or a repeat
  // booking paints the spinner in the host's colour from the first frame.
  useEffect(() => {
    if (host && isValidHex(host.theme_color)) {
      try { sessionStorage.setItem(`bas_theme:${profileSlug}`, host.theme_color); } catch { /* private mode */ }
    }
  }, [host, profileSlug]);

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: `radial-gradient(circle at top, ${tc}0f, transparent 22rem), linear-gradient(180deg,#F8FAFC,#F1F5F9)` }}>
        <style>{`@keyframes bkspin{to{transform:rotate(360deg)}}`}</style>
        {/* Petal spinner — 8 rounded squares in one colour, stepped shades,
            rotating as a wheel. Overlap at the centre deepens the shade. */}
        <svg width="72" height="72" viewBox="0 0 100 100" role="img" aria-label="Loading"
          style={{ animation: 'bkspin 1.1s linear infinite' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x="37" y="9" width="26" height="26" rx="9"
              fill={tc} opacity={0.12 + i * 0.11}
              transform={`rotate(${i * 45} 50 50)`} />
          ))}
        </svg>
        <p className="mt-5 font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111' }}>Setting up your booking</p>
        <p className="mt-1 text-sm text-gray-400">Just a moment while we load the calendar…</p>
      </div>
    );
  if (!service)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Service not found</p>
      </div>
    );

  // Payment step is needed whenever there's an amount to pay: a paid service, OR
  // (interim fee-only mode) a ₹0 service that still owes the booking fee.
  // "Price on request" services are a no-payment enquiry — the host quotes the fee
  // offline — so they skip the payment step entirely (overrides fee-only too).
  const priceOnRequest = service.price_on_request === true;
  const isPaid = !priceOnRequest && (service.price > 0 || fees.feeOnly);
  // BUG-16 fix: logged-in users skip the OTP verification step
  const STEPS = [
    "time",
    "details",
    ...(user ? [] : ["otp"]),
    ...(isPaid ? ["payment"] : []),
    "confirmed",
  ];
  const LABELS = {
    time: "Time",
    details: "Details",
    otp: "Verify",
    payment: "Pay",
    confirmed: "Done",
  };
  const STEP_ICONS = {
    time:      <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    details:   <><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    otp:       <><path d="M12 3l7 4v5c0 4-3 7-7 8-4-1-7-4-7-8V7z" /><path d="M9 12l2 2 4-4" /></>,
    payment:   <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    confirmed: <path d="M5 13l4 4L19 7" />,
  };
  const daysInMonth = getDaysInMonth(calMonth, calYear);
  const firstDay = getFirstDayOfMonth(calMonth, calYear);
  // Server list is authoritative (includes Google busy + blocked dates);
  // local computation is the deploy-skew fallback only.
  const timeSlots = serverSlots ?? getTimeSlots();
  const calDays = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  return (
    <div
      className="bk-page min-h-screen"
      style={{
        background:
          `radial-gradient(circle at top, ${tc}0f, transparent 22rem), linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)`,
        paddingBottom: '48px',
      }}
    >
      <style>{BAS_KEYFRAMES}</style>
      {/* Focus affordance: the global fb-input focus draws a 6px green-grey ring.
          Scope it to this page so booking inputs get a slim on-brand orange ring
          + orange border instead. */}
      <style>{`
        .bk-page .fb-input:focus {
          border-color: ${tc};
          box-shadow: 0 0 0 3px color-mix(in srgb, ${tc} 22%, transparent);
        }
        .bk-page .bk-phone-wrap:focus-within {
          border-color: ${tc};
          box-shadow: 0 0 0 3px color-mix(in srgb, ${tc} 22%, transparent);
        }
      `}</style>
      {host?.is_verified === false && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700">
          ⚠️ This creator is pending admin verification. Bookings may be subject to confirmation.
        </div>
      )}
      <div className="app-container py-4 sm:py-5 flex flex-col lg:flex-row gap-4 lg:items-start">

        {/* ── LEFT: Permanent Profile Sidebar (content collapsible, column stays put) ── */}
        <div className="lg:w-[300px] flex-shrink-0">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(30,30,30,0.06)] lg:sticky lg:top-24">
            {/* Header toggle */}
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: tc }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile Information
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="border-t">
                {/* Section 1: Vendor Profile — cover at 3:1, same ratio everywhere */}
                <div className="aspect-[3/1] relative z-0 overflow-hidden"
                  style={{ background: host.cover_image ? undefined : `linear-gradient(135deg, ${tc}26, ${tc}55)` }}>
                  {host.cover_image && <img src={host.cover_image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex justify-center -mt-7 relative z-10">
                  <div className="w-14 h-14 rounded-full border-2 overflow-hidden bg-white" style={{ borderColor }}>
                    {host.profile_image
                      ? <img src={host.profile_image} alt={host.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: tc }}>
                          {host.name?.charAt(0)?.toUpperCase()}
                        </div>}
                  </div>
                </div>
                <div className="px-4 pt-2 pb-4 text-center">
                  <h2 className="text-base font-bold text-gray-900">{host.name}</h2>
                  {(host.tagline || host.profession) && (
                    <p className="text-xs text-gray-500 mt-0.5">{host.tagline || host.profession}</p>
                  )}
                </div>

                {/* Service being booked — eyebrow, prominent title, then a clean
                    price · duration · mode meta row. */}
                <div className="px-4 py-4 border-t text-left">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 mb-1.5">You're booking</div>
                  <h3 className="text-[15px] font-bold text-gray-900 leading-snug">{service.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2.5 text-sm text-gray-600">
                    <span className="font-bold" style={{ color: tc }}>
                      {priceOnRequest ? "On request" : service.price === 0 ? "Free" : `₹${service.price}`}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                      </svg>
                      {service.duration} min
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1.5">
                      {service.meeting_mode === "offline" ? (
                        <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      )}
                      {service.meeting_mode === "offline" ? "In-person" : "Online"}
                    </span>
                  </div>
                  {selectedDate && selectedTime && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t text-sm font-semibold text-gray-900">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tc }} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
                      {selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {formatTime(selectedTime)}
                    </div>
                  )}
                </div>

                {/* Assurances — set expectations up front, reduce abandonment.
                    Only claims we can stand behind (no reschedule-policy promise). */}
                <div className="px-4 py-3 border-t space-y-2">
                  {[
                    'Instant confirmation',
                    'Calendar invite + reminders',
                    ...(isPaid ? ['Secure payment via Razorpay'] : []),
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#16A34A' }} fill="none"
                        stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      {t}
                    </div>
                  ))}
                </div>

                {/* View full profile */}
                <div className="px-4 pb-4 border-t pt-4">
                  <Link to={`/${profileSlug}`}
                    className="flex items-center gap-2 text-sm font-semibold hover:opacity-75 transition-opacity"
                    style={{ color: tc }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8}
                      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    View full page
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Booking Engine ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Progress bar — only the ACTIVE step expands to a horizontal
              icon + label pill; done steps stay a solid orange icon, upcoming
              steps a grey icon. */}
          <div className="mb-5 flex items-center w-full">
            {STEPS.map((s, i) => {
              const idx = STEPS.indexOf(step);
              const active = i === idx;
              const done = i < idx;
              return (
                <div key={s} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  {active ? (
                    <div className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 h-7 flex-shrink-0"
                      style={{ background: tc, color: textOnTheme }} aria-current="step" aria-label={LABELS[s]}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.22)" }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.4}
                          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{STEP_ICONS[s]}</svg>
                      </span>
                      <span className="text-xs font-semibold whitespace-nowrap">{LABELS[s]}</span>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-colors"
                      style={done
                        ? { background: tc, color: textOnTheme, borderColor: tc }
                        : { background: "#fff", color: "#9ca3af", borderColor: "#d1d5db" }}
                      aria-label={LABELS[s]}>
                      {done ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.6}
                          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}
                          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{STEP_ICONS[s]}</svg>
                      )}
                    </div>
                  )}
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 transition-colors"
                      style={{ background: done ? tc : "#e5e7eb" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Labour-illusion: brief "wrapping up" screen before the confirmed view */}
          {finalizing && (
            <FinalizingScreen tc={tc} textOnTheme={textOnTheme} isPaid={isPaid}
              task={finalizeTaskRef.current} onDone={completeFinalize} />
          )}

          {/* Payment verify failed after the instant move — smart by failure type */}
          {!finalizing && payError && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
              <div className="max-w-md mx-auto text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: payError.type === "server" ? "#FEE2E2" : "#FEF3C7" }}>
                  {payError.type === "server" ? (
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                  )}
                </div>
                {payError.type === "server" ? (
                  <>
                    <h2 className="text-xl font-bold mb-2">We couldn't verify your payment</h2>
                    <p className="text-sm text-gray-500 mb-6">
                      If money was deducted, please <strong>don't pay again</strong> — contact us with your details and we'll sort it out right away.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-2">Still confirming your payment…</h2>
                    <p className="text-sm text-gray-500 mb-6">
                      This can take a moment on a slow connection. You'll get a confirmation email shortly — please <strong>don't pay again</strong>.
                    </p>
                  </>
                )}
                <a href="mailto:bolt@meeticulous.in"
                  className="btn w-full py-3 font-bold text-sm transition-opacity hover:opacity-85"
                  style={{ background: tc, color: textOnTheme }}>
                  Contact support
                </a>
                <Link to={`/${profileSlug}`} className="block mt-3 text-sm hover:underline" style={{ color: tc }}>
                  Back to {host.name}'s profile
                </Link>
              </div>
            </div>
          )}

          {/* STEP: time */}
          {!finalizing && step === "time" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-4">
                <Link
                  to={`/${profileSlug}`}
                  className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Services
                </Link>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold">When works for you?</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                    {tzAbbr}
                  </span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-5">
                {/* Calendar */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={prevMonth}
                      className="min-h-10 p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <h3 className="font-semibold">
                      {MONTHS[calMonth]} {calYear}
                    </h3>
                    <button
                      onClick={nextMonth}
                      className="min-h-10 p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                    {DAYS_SHORT.map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {calDays.map((day, i) => {
                      if (!day) return <div key={`e${i}`} />;
                      const sel = isSameDate(day),
                        td = isToday(day),
                        ok = isDateSelectable(day);
                      return (
                        <button
                          key={day}
                          onClick={() => selectDate(day)}
                          disabled={!ok}
                          className={`h-9 rounded text-sm transition-colors ${ok && !sel ? "hover:bg-gray-100 cursor-pointer" : ""} ${!ok ? "text-gray-300 cursor-default" : ""}`}
                          style={sel
                            ? { background: tc, color: textOnTheme, fontWeight: 700 }
                            : td && !sel
                              ? { color: tc, fontWeight: 700, boxShadow: `0 0 0 1.5px ${tc}55` }
                              : {}}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Times */}
                <div className="flex-1">
                  {selectedDate ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">
                          {DAYS_SHORT[selectedDate.getDay()]},{" "}
                          {MONTHS[selectedDate.getMonth()]}{" "}
                          {selectedDate.getDate()}
                        </h3>
                        <div className="flex border rounded-full overflow-hidden text-xs">
                          <button
                            onClick={() => setTimeFormat("12h")}
                            className="min-h-9 px-3 py-1"
                            style={timeFormat === "12h" ? { background: tc, color: textOnTheme } : { color: "#6b7280" }}
                          >
                            12h
                          </button>
                          <button
                            onClick={() => setTimeFormat("24h")}
                            className="min-h-9 px-3 py-1"
                            style={timeFormat === "24h" ? { background: tc, color: textOnTheme } : { color: "#6b7280" }}
                          >
                            24h
                          </button>
                        </div>
                      </div>
                      {slotsLoading ? (
                        <SlotSkeleton />
                      ) : (
                        <>
                          {calendarUnverified && timeSlots.length > 0 && (
                            <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              We couldn't reach {host.name?.split(" ")[0] || "the host"}'s calendar just now — these times may be subject to confirmation.
                            </div>
                          )}
                          {timeSlots.length === 0 ? (
                            <div className="py-8 text-center bas-fade">
                              <p className="text-sm font-medium text-gray-600">No open times that day</p>
                              <p className="text-xs text-gray-400 mt-1">Try another date — there's bound to be a good one.</p>
                            </div>
                          ) : (
                            <div className="max-h-[300px] overflow-y-auto pr-1 bas-fade space-y-4">
                              {[
                                { label: "Morning",   test: (h) => h < 12 },
                                { label: "Afternoon", test: (h) => h >= 12 && h < 17 },
                                { label: "Evening",   test: (h) => h >= 17 },
                              ].map((g) => {
                                const items = timeSlots.filter((t) => g.test(parseInt(t.slice(0, 2), 10)));
                                if (!items.length) return null;
                                return (
                                  <div key={g.label}>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">{g.label}</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                      {items.map((t) => (
                                        <button
                                          key={t}
                                          onClick={() => setSelectedTime(t)}
                                          className="btn btn--outline py-2.5 text-sm transition-all"
                                          style={selectedTime === t
                                            ? { background: tc, color: textOnTheme, fontWeight: 600 }
                                            : {}}
                                        >
                                          {formatTime(t)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <p className="text-sm font-medium text-gray-600">Pick a day to begin</p>
                      <p className="text-xs text-gray-400 mt-1">We'll show you {host.name?.split(" ")[0] || "the host"}'s open times.</p>
                    </div>
                  )}
                </div>
              </div>
              {selectedTime && (
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-4"
                  style={{ borderColor: "#f0ece6" }}>
                  <div className="text-sm text-gray-500">
                    Selected{" "}
                    <span className="font-bold text-gray-900">
                      {DAYS_SHORT[selectedDate.getDay()]} {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} · {formatTime(selectedTime)}
                    </span>{" "}
                    <span className="text-gray-400">({tzAbbr})</span>
                  </div>
                  <button
                    onClick={() => {
                      analytics.track(EVENTS.BOOKING_STARTED, {
                        service_id: service.id, host_id: host.id,
                        price: Number(service.price) || 0,
                      });
                      setStep("details");
                    }}
                    className="btn py-3 px-7 font-bold text-sm transition-opacity hover:opacity-85 flex-shrink-0"
                    style={{ background: tc, color: textOnTheme }}
                  >
                    Continue →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP: details */}
          {!finalizing && step === "details" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]" style={{ "--tc": tc }}>
              <button
                onClick={() => setStep("time")}
                className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 font-medium mb-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-bold leading-tight">Tell us who's coming</h2>
                <p className="text-sm text-gray-400 mt-1">We just need a few quick details to confirm your booking.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5">
                {/* LEFT: Booking Summary — icon-chip card */}
                <div className="order-2 lg:order-1">
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="p-4 space-y-0.5">
                      {/* Service */}
                      <div className="flex items-center gap-3 py-2.5">
                        <span className="flex items-center justify-center shrink-0 w-5" style={{ color: `color-mix(in srgb, ${tc} 50%, #111111)` }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm leading-snug text-gray-900">{service.title}</div>
                        </div>
                      </div>
                      {/* Date */}
                      <div className="flex items-center gap-3 py-2.5 border-t" style={{ borderColor: `${tc}14` }}>
                        <span className="flex items-center justify-center shrink-0 w-5" style={{ color: `color-mix(in srgb, ${tc} 50%, #111111)` }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-gray-400 leading-none mb-0.5">Date</div>
                          <div className="font-semibold text-sm text-gray-900">{selectedDate?.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</div>
                        </div>
                        <button type="button" onClick={() => setStep("time")} aria-label="Edit"
                          className="flex items-center justify-center p-1 transition-opacity hover:opacity-70 shrink-0"
                          style={{ color: tc }}>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                      </div>
                      {/* Time */}
                      <div className="flex items-center gap-3 py-2.5 border-t" style={{ borderColor: `${tc}14` }}>
                        <span className="flex items-center justify-center shrink-0 w-5" style={{ color: `color-mix(in srgb, ${tc} 50%, #111111)` }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-gray-400 leading-none mb-0.5">Time</div>
                          <div className="font-semibold text-sm text-gray-900">
                            {formatTime(selectedTime)} – {formatTime(getEndTime(selectedTime))}{" "}
                            <span className="text-gray-400 text-xs font-normal">({tzAbbr})</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setStep("time")} aria-label="Edit"
                          className="flex items-center justify-center p-1 transition-opacity hover:opacity-70 shrink-0"
                          style={{ color: tc }}>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                      </div>
                      {/* Platform fee */}
                      {isPaid && (
                        <div className="flex items-center gap-3 py-2.5 border-t" style={{ borderColor: `${tc}14` }}>
                          <span className="flex items-center justify-center shrink-0 w-5" style={{ color: `color-mix(in srgb, ${tc} 50%, #111111)` }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          </span>
                          <span className="flex-1 flex items-center justify-between gap-2">
                            <span className="text-sm text-gray-600 flex items-center gap-1.5">
                              Platform Fee (₹{fees.platformFee} + GST)
                              <span className="relative group inline-flex">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold leading-none cursor-help"
                                  style={{ background: "#9CA3AF" }}>i</span>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 rounded-2xl bg-gray-950 text-white text-xs p-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-10 shadow-2xl shadow-black/40 border border-white/10 backdrop-blur-sm">
                                  <span className="flex items-start gap-2.5">
                                    <svg className="w-3.5 h-3.5 mt-px shrink-0 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1a9 9 0 100 18A9 9 0 0010 1zm.75 13.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5V5.5h1.5V11.5z"/></svg>
                                    <span className="leading-relaxed text-white/85 tracking-wide">This fee secures your slot, handles payments, sends reminders, and adds the session to your calendar.</span>
                                  </span>
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-950"></span>
                                </span>
                              </span>
                            </span>
                            <span className="font-semibold text-sm text-gray-900">₹{fees.bookingFee}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Total band */}
                    <div className="flex items-center justify-between px-4 py-3.5" style={{ background: `${tc}17` }}>
                      <div>
                        <div className="font-bold text-[16px]">Total Amount</div>
                        {!priceOnRequest && <div className="text-[11px] text-gray-500">Inclusive of all taxes</div>}
                      </div>
                      <span className="font-bold text-[20px]" style={{ color: tc }}>
                        {priceOnRequest ? "Price on request" : isPaid ? `₹${Math.round((service.price + fees.bookingFee) * 100) / 100}` : "Free"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Customer Information — floating-label fields */}
                <div className="order-1 lg:order-2 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FloatingInput id="bk-first" label="First Name" required placeholder="e.g. Riya" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    <FloatingInput id="bk-last" label="Last Name" placeholder="e.g. Sharma" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                  <div className="space-y-3.5">
                    <FloatingInput id="bk-email" label="Email Address" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    {/* Mobile: floating label + country dial-code select + national number; sent as fullPhone. */}
                    <div className="relative">
                      <div className="bk-phone-wrap flex items-stretch rounded-lg border border-[color:var(--color-line)] overflow-hidden transition-shadow">
                        <select
                          aria-label="Country code"
                          className="w-[64px] shrink-0 bg-gray-50 text-sm font-medium text-gray-700 border-r pl-2 pr-0.5 outline-none cursor-pointer"
                          style={{ borderColor: "var(--color-line)" }}
                          value={dialCode}
                          onChange={(e) => setDialCode(e.target.value)}
                        >
                          {DIAL_CODES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input id="bk-phone" type="tel" required placeholder="98765 43210" className="peer flex-1 min-w-0 px-3 py-2 bg-transparent outline-none text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                      <label htmlFor="bk-phone" className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 transition-colors peer-focus:text-[color:var(--tc)]">
                        Mobile Number<span style={{ color: "#e42527" }}> *</span>
                      </label>
                      <p className="mt-1.5 text-xs text-gray-400">We'll send your booking details here.</p>
                    </div>
                  </div>
                  {/* State — place of supply for the GST invoice. Required for
                      paid bookings, so it stays visible; the rest of the billing
                      detail is optional and tucked behind the toggle below. */}
                  <div className="relative">
                    <input
                      id="bk-state"
                      placeholder="State"
                      autoComplete="off"
                      className="peer fb-input fb-input--sm !rounded-lg !border placeholder-transparent"
                      value={billing.state}
                      onFocus={() => setStateOpen(true)}
                      onBlur={() => setTimeout(() => setStateOpen(false), 120)}
                      onChange={(e) => {
                        const name = e.target.value;
                        const code = INDIAN_STATES.find((s) => s.name === name)?.code || "";
                        setStateOpen(true);
                        setBilling((b) => ({ ...b, state: name, state_code: code }));
                      }}
                    />
                    {stateOpen && billing.state.trim().length >= 3 && (() => {
                      const q = billing.state.trim().toLowerCase();
                      const matches = INDIAN_STATES.filter((s) => s.name.toLowerCase().includes(q));
                      if (!matches.length) return null;
                      return (
                        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                          {matches.map((s) => (
                            <li key={s.code}>
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setBilling((b) => ({ ...b, state: s.name, state_code: s.code }));
                                  setStateOpen(false);
                                }}
                              >
                                {s.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                    <label htmlFor="bk-state" className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 transition-all
                      peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400
                      peer-focus:top-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[color:var(--tc)]">
                      State{isPaid && <span style={{ color: "#e42527" }}> *</span>}
                    </label>
                  </div>

                  {/* GST toggle sits under State; its fields open full width below the grid. */}
                  <button type="button" onClick={() => setShowBilling((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "var(--color-line)" }}>
                    <span className="relative inline-flex rounded-full transition-colors flex-shrink-0"
                      style={{ width: 28, height: 16, background: showBilling ? tc : "#D1D5DB" }}>
                      <span className="absolute rounded-full bg-white transition-all"
                        style={{ top: 2, width: 12, height: 12, left: showBilling ? 14 : 2 }} />
                    </span>
                    Add GST Details or Notes
                    <span className="text-xs text-gray-400">Optional</span>
                  </button>
                </div>
              </div>

              {/* GST fields — open full width under both columns */}
              {showBilling && (
                <div className="mt-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FloatingInput id="bk-address" label="Billing address" value={billing.address}
                      onChange={(e) => setBilling((b) => ({ ...b, address: e.target.value }))} autoComplete="street-address" />
                    <FloatingInput id="bk-gstin" label="GSTIN" value={billing.gstin}
                      onChange={(e) => setBilling((b) => ({ ...b, gstin: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="relative">
                    <textarea id="bk-notes" placeholder="Add any notes or requests for this booking."
                      className="peer fb-input fb-input--sm !rounded-lg !border resize-none !min-h-0 !h-[88px] placeholder-transparent"
                      value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <label htmlFor="bk-notes" className="pointer-events-none absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 transition-all
                      peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400
                      peer-focus:top-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[color:var(--tc)]">
                      Notes <span className="font-normal text-gray-400">(Optional)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Full-width Continue */}
              <button
                onClick={handleSendOtp}
                disabled={otpSending || verifying || !firstName || !email || (!user && !isPhoneValid) || (isPaid && !billing.state_code)}
                className="btn mt-4 w-full py-2.5 font-bold text-sm transition-opacity hover:opacity-85 disabled:!bg-gray-200 disabled:!text-gray-500 disabled:cursor-not-allowed"
                style={{ background: tc, color: textOnTheme }}
              >
                {otpSending || verifying
                  ? "Please wait..."
                  : user
                  ? isPaid
                    ? "Continue to Payment"
                    : "Confirm Booking"
                  : "Send my code"}
              </button>
              <p className="mt-2 text-center text-xs text-gray-400">
                Free to cancel · We'll never spam you
              </p>
            </div>
          )}

          {/* STEP: otp */}
          {!finalizing && step === "otp" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
              <button
                onClick={() => setStep("details")}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>{" "}
                Back
              </button>
              <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "#25D3661f" }}>
                <svg className="w-8 h-8" fill="#25D366" viewBox="0 0 24 24">
                  <path d="M17.5 14.4c-.3-.15-1.7-.84-2-.94s-.46-.15-.65.15-.75.94-.92 1.13-.34.22-.63.07a8.2 8.2 0 0 1-2.4-1.48 9 9 0 0 1-1.67-2.06c-.17-.3 0-.46.13-.6s.3-.35.44-.53a2 2 0 0 0 .3-.5.55.55 0 0 0 0-.52c-.08-.15-.65-1.56-.9-2.14s-.47-.48-.65-.49h-.56a1.06 1.06 0 0 0-.77.36 3.25 3.25 0 0 0-1 2.4 5.66 5.66 0 0 0 1.18 3 12.9 12.9 0 0 0 4.94 4.37c.69.3 1.23.48 1.65.61a4 4 0 0 0 1.82.11 3 3 0 0 0 2-1.39 2.44 2.44 0 0 0 .17-1.39c-.07-.13-.26-.2-.55-.35zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Check WhatsApp</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a 6-digit code to <strong>{maskedPhone}</strong> on WhatsApp.
              </p>
              <OtpBoxes value={otp} onChange={setOtp} tc={tc} />
              <button
                onClick={handleVerifyAndBook}
                disabled={verifying || otp.length !== 6}
                className="btn mt-6 w-full py-3 font-bold text-sm transition-opacity hover:opacity-85 disabled:!bg-gray-200 disabled:!text-gray-500 disabled:cursor-not-allowed"
                style={{ background: tc, color: textOnTheme }}
              >
                {verifying
                  ? "Verifying..."
                  : isPaid
                    ? "Verify & Continue to Payment"
                    : "Verify & Confirm Booking"}
              </button>
              {resendIn > 0 ? (
                <p className="mt-3 text-xs text-gray-400">
                  Resend code in 0:{String(resendIn).padStart(2, "0")}
                </p>
              ) : (
                <button
                  onClick={handleSendOtp}
                  className="mt-3 text-xs font-medium hover:opacity-70"
                  style={{ color: tc }}
                >
                  Didn't receive it? Resend code
                </button>
              )}
              </div>{/* end max-w-md center wrapper */}
            </div>
          )}

          {/* STEP: payment */}
          {!finalizing && !payError && step === "payment" && confirmation && (() => {
            // Total the customer pays = service + platform fee + GST.
            // Prefer the server snapshot; fall back to a local estimate for legacy rows.
            const _fee = Number(confirmation?.platform_fee_amount ?? 10);
            const _gst = confirmation?.platform_fee_gst != null
              ? Number(confirmation.platform_fee_gst)
              : Math.round(_fee * 0.18 * 100) / 100;
            const checkoutTotal = confirmation?.customer_total != null
              ? Number(confirmation.customer_total)
              : Math.round((service.price + _fee + _gst) * 100) / 100;
            return (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
              <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${tc}18` }}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: tc }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">One last step</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your spot's saved — pay now to lock it in.
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-left space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{service.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>
                    {selectedDate?.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span>{formatTime(selectedTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service price</span>
                  <span>₹{service.price}</span>
                </div>
                {confirmation?.platform_fee_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform fee</span>
                    <span>₹{confirmation.platform_fee_amount}</span>
                  </div>
                )}
                {confirmation?.platform_fee_gst > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">GST (18% on platform fee)</span>
                    <span>₹{confirmation.platform_fee_gst}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t font-semibold text-base">
                  <span>Total you pay</span>
                  {/* Must equal the amount Razorpay charges (service + fee + GST) */}
                  <span style={{ color: tc }}>₹{checkoutTotal}</span>
                </div>
              </div>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className="btn w-full py-3 font-bold text-sm transition-opacity hover:opacity-85 disabled:!bg-gray-200 disabled:!text-gray-500 disabled:cursor-not-allowed"
                style={{ background: tc, color: textOnTheme }}
              >
                {paymentLoading
                  ? "Opening payment..."
                  : `Pay ₹${checkoutTotal} with Razorpay`}
              </button>
              <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Encrypted &amp; secured by Razorpay · UPI, Card &amp; Wallet accepted
              </p>
              <p className="text-[11px] text-gray-300 mt-1">
                Booking securely powered by Meeticulous
              </p>
              </div>{/* end max-w-md center wrapper */}
            </div>
            );
          })()}

          {/* STEP: confirmed */}
          {step === "confirmed" && confirmation && (() => {
            const scheduledISO = wallClockToUTC(
              selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
              ...selectedTime.split(":").map(Number), hostTz
            );
            const calTitle = `${service.title} with ${host.name}`;
            // Offline (in-person) services: use the host's map link / city as the
            // event location and directions; online services keep the Meet link.
            const isOffline = service.meeting_mode === "offline";
            const mapLink = host.map_link || "";
            const venueText = host.location || "In person";
            const calDetails = confirmation.meeting_link
              ? `Join: ${confirmation.meeting_link}`
              : (isOffline && mapLink ? `Directions: ${mapLink}` : "");
            const calLocation = confirmation.meeting_link
              || (isOffline ? (mapLink || venueText) : "Online");
            const gUrl = googleCalUrl({ title: calTitle, details: calDetails, location: calLocation, startISO: scheduledISO, durationMin: service.duration || 30 });
            const icsUrl = buildICS({ title: calTitle, details: calDetails, location: calLocation, startISO: scheduledISO, durationMin: service.duration || 30, uid: confirmation.id });
            const isPaidBooking = confirmation.payment_status === "paid";
            const receiptData = {
              receiptId: confirmation.id ? `#${String(confirmation.id).replace(/-/g, "").slice(0, 8).toUpperCase()}` : "—",
              bookingId: confirmation.id,
              whenText: `${selectedDate?.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${formatTime(selectedTime)} (${tzAbbr})`,
              serviceTitle: service.title,
              category: service.category,
              duration: service.duration,
              timezone: tzAbbr,
              venue: confirmation.meeting_link,
              hostName: host.name,
              guestName: `${firstName} ${lastName}`.trim(),
              guestEmail: email,
              customerPhone: fullPhone,
              status: confirmation.status,
              paymentStatus: confirmation.payment_status,
              paymentId: confirmation.payment_id,
              gateway: confirmation.payment_id ? "Razorpay" : "",
              price: service.price,
              platformFee: confirmation.platform_fee_amount,
              platformFeeGst: confirmation.platform_fee_gst,
              total: confirmation.customer_total,
            };
            // ponytail: inline SVGs instead of lucide — a missing lucide import breaks the whole /for build (known landmine), not worth a new import for 6 icons
            const Row = ({ icon, label, children }) => (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2.5 text-gray-500 shrink-0">
                  <span style={{ color: tc }}>{icon}</span>{label}
                </span>
                <span className="font-medium text-right text-gray-800">{children}</span>
              </div>
            );
            const ic = "w-4 h-4";
            const calIcon = <svg className={ic} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round"/></svg>;
            const clockIcon = <svg className={ic} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            const userIcon = <svg className={ic} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round"/></svg>;
            const pinIcon = <svg className={ic} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>;
            const docIcon = <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6" strokeLinejoin="round"/></svg>;
            const mailIcon = <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
            return (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-[0_4px_24px_rgba(30,30,30,0.06)]">
              <div className="max-w-3xl mx-auto">
                {/* Top: two columns — success message | booking details. Stacks on mobile. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:items-center">
                  {/* LEFT: success */}
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center bas-pop" style={{ background: `${tc}18` }}>
                      <svg className="w-10 h-10" fill="none" stroke={tc} strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2 bas-fade" style={{ color: tc }}>You&rsquo;re all set</h2>
                    <p className="text-sm text-gray-500 mb-5 bas-fade">
                      See you {selectedDate?.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })} at {formatTime(selectedTime)} ({tzAbbr})
                    </p>
                    <div className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3 bg-gray-50/40 text-left">
                      <span style={{ color: tc }}>{mailIcon}</span>
                      <span className="text-xs text-gray-500 leading-snug">Confirmation email sent to<br /><span className="text-gray-700 font-medium break-all">{email}</span></span>
                    </div>
                    {/* How to join / reminders */}
                    <div className="flex items-start gap-3 border border-gray-100 rounded-2xl p-3 bg-gray-50/40 text-left mt-3">
                      <span className="mt-0.5" style={{ color: tc }}>
                        {confirmation.meeting_link ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        )}
                      </span>
                      <span className="text-xs text-gray-500 leading-snug">
                        {confirmation.meeting_link ? (
                          <><span className="text-gray-700 font-medium">How to join:</span> your meeting link is in the confirmation email and calendar invite. </>
                        ) : (
                          <><span className="text-gray-700 font-medium">Reminders:</span> </>
                        )}
                        We&rsquo;ll remind you 24h and 1h before.
                      </span>
                    </div>
                  </div>
                  {/* RIGHT: booking details */}
                  <div className="border border-gray-100 rounded-xl px-4 py-1.5 text-sm text-left divide-y divide-gray-100 bg-gray-50/40">
                    <Row icon={calIcon} label="Service">{service.title}</Row>
                    <Row icon={calIcon} label="Date">{selectedDate?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Row>
                    <Row icon={clockIcon} label="Time">{formatTime(selectedTime)} ({tzAbbr})</Row>
                    <Row icon={userIcon} label="Customer">{`${firstName} ${lastName}`.trim()}</Row>
                    {confirmation.meeting_link && (
                      <Row icon={pinIcon} label="Meeting">
                        <a href={confirmation.meeting_link} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: tc }}>Join Link</a>
                      </Row>
                    )}
                    {isOffline && !confirmation.meeting_link && (
                      <Row icon={pinIcon} label="Location">
                        {mapLink ? (
                          <a href={mapLink} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: tc }}>Get directions</a>
                        ) : venueText}
                      </Row>
                    )}
                  </div>
                </div>

                {/* Row below: actions + footer, full width */}
                <div className="mt-6 max-w-md mx-auto text-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href={gUrl} target="_blank" rel="noreferrer"
                      className="btn btn--outline inline-flex items-center justify-center gap-2 py-2.5 px-3 font-semibold text-sm transition-opacity hover:opacity-85"
                      style={{ color: tc }}>
                      {calIcon} Add to Google Calendar
                    </a>
                    <a href={icsUrl} download={`${service.title.replace(/\s+/g, "-")}.ics`}
                      className="btn inline-flex items-center justify-center gap-2 py-2.5 px-3 font-semibold text-sm transition-opacity hover:opacity-85"
                      style={{ background: tc, color: textOnTheme }}>
                      {calIcon} Download iCal (.ics)
                    </a>
                  </div>
                  {/* One download: the GST invoice when we have it, else the receipt. */}
                  {invoiceRef ? (
                    <a href={invoiceUrl(invoiceRef.id, invoiceRef.token)} target="_blank" rel="noreferrer"
                      className="btn btn--outline mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 font-semibold text-sm transition-opacity hover:opacity-85"
                      style={{ color: tc }}>
                      {docIcon} Download invoice
                    </a>
                  ) : isPaidBooking && (
                    <button type="button" onClick={() => downloadReceipt(receiptData)}
                      className="btn btn--outline mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 font-semibold text-sm transition-opacity hover:opacity-85"
                      style={{ color: tc }}>
                      {docIcon} Download receipt
                    </button>
                  )}
                  <div className="border-t border-gray-100 mt-6 pt-4">
                    <Link to={`/${profileSlug}`} className="text-sm font-semibold hover:underline" style={{ color: tc }}>
                      ← Back to {host.name}'s profile
                    </Link>
                    {/* Manage link works without a session — the token IS the auth (#516). */}
                    {confirmation?.manage_token && (
                      <p className="mt-3 text-xs text-gray-400">
                        <Link to={`/manage-booking/${confirmation.manage_token}`} className="font-medium hover:underline" style={{ color: tc }}>
                          Manage or cancel this booking
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ServiceBooking;
