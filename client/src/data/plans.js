/**
 * Single source of truth for Meeticulous plan pricing + features (display side).
 *
 * Imported by the homepage (Home.jsx), the dedicated pricing page (Pricing.jsx),
 * the competitor landing pages (lp/*Alternative) and the profession landings, so
 * prices never drift between surfaces. Display names follow themeUtils
 * PLAN_DISPLAY (DB slugs free / premium → Starter / Pro).
 *
 * KEEP IN SYNC with server migration v3.230 (pricing v2, docs/pricing-v2-spec.md)
 * — the DB is the enforcement authority; this file is the copy that mirrors it.
 *
 * ── PRICES ARE GST-INCLUSIVE ────────────────────────────────────────────────
 * What the host is actually charged. The DB stores the ex-GST base and the
 * engine adds 18%, so the DB holds back-solved values (never rounded up):
 *
 *   monthly   DB 168.64  →  ₹199   (168.64 + 30.36)
 *   yearly    DB 1016.10 →  ₹1,199 (1016.10 + 182.90)
 *   founding  DB 761.86  →  ₹899   (charges ₹898.99 — a paisa under, by design)
 *
 * Yearly saves ₹1,189 = 50% ("pay for six months, get twelve"). ₹1,199 / 365 =
 * ₹3.28, the "₹3 a day" headline. Every price shown to a customer stays on this
 * one GST-inclusive basis.
 */

export const FREE_PLAN = {
  name: "Starter",
  slug: "free",
  tagline: "Everything you need to get booked.",
  badge: "9% per booking",
  accent: "#7A0A28", // --mt-maroon-dark (design system: no green brand accent)
  icon: "Sprout",
  persona: { title: "Just starting out", blurb: "Your booking page, your first customers, at zero cost." },
  monthly: 0,
  yearly: 0,
  features: [
    "Unlimited services & bookings",
    "Booking page + UPI payments",
    "24-hour and 1-hour reminders",
    "WhatsApp reminders for your first 60 days of bookings",
    "Online & in-person appointments",
    "Unlimited digital products, video courses & coupons",
    "Day-3 rebook automation",
    "GST invoices & payouts",
  ],
};

export const PREMIUM_PLAN = {
  name: "Pro",
  slug: "premium",
  tagline: "Keep every rupee. Automate the rest.",
  // GST-inclusive display — DB base 168.64 / 1016.10 + 18% (see the header note).
  monthly: 199,
  yearly: 1199,
  recommended: true,
  accent: "#960D32",
  icon: "Rocket",
  // ₹1,199 ÷ 12 ÷ 9% = ₹1,110/month of bookings: past that, Pro yearly costs less
  // than Starter's commission (spec §2.2 — ₹13,322 a year, about 2 bookings a month).
  persona: { title: "Booked and growing", blurb: "Taking over ₹1,110 a month in bookings? Pro already costs less than the 9%." },
  intro: "Everything in Starter, plus:",
  features: [
    "0% commission on appointments (3% above ₹25,000 a month)",
    "4% on products, courses & memberships",
    "WhatsApp reminders on every booking",
    "Guests reschedule themselves + reschedule alerts",
    "Client CRM: every client, full history & export",
    "Day-21 rebook automation",
    "Creator Intelligence: forecast, win-back, benchmarks",
    "Booking caps per day, week and guest",
    "Unlimited AI service writing",
    "Priority support",
  ],
};

/**
 * Founding campaign (spec §5): Pro yearly at ₹899 incl. GST, locked for life, for
 * the first `limit` paying Pro hosts; after that yearly is the standard ₹1,199.
 * Display only — the live count comes from GET /api/plans/founding and the price
 * from the premium_founding row (v3.230). Monthly is ₹199 either way.
 */
export const FOUNDING = { limit: 100, yearly: 899, nextYearly: 1199 };

/** Array form — several surfaces index into this ([0] / [length-1]). */
export const PAID_PLANS = [PREMIUM_PLAN];

/** Both plans in display order. */
export const ALL_PLANS = [FREE_PLAN, PREMIUM_PLAN];

/** Headline daily figure for Pro: ₹1,199 / 365 = ₹3.28. */
export const PREMIUM_PER_DAY = "₹3.28";

/**
 * Yearly billed as a monthly-equivalent: ₹1,199 / 12 = ₹99.92, shown as ₹99
 * (spec §1 / §2.2 "Pro is ₹99"). Floored, never rounded up to ₹100. Same
 * GST-inclusive basis as the yearly charge.
 */
export const PREMIUM_YEARLY_PER_MONTH = Math.floor(PREMIUM_PLAN.yearly / 12); // 99

/** Annual saving vs 12 × monthly — kept here so no surface recomputes it wrong. */
export const PREMIUM_ANNUAL_SAVING = PREMIUM_PLAN.monthly * 12 - PREMIUM_PLAN.yearly; // ₹1,189
export const PREMIUM_ANNUAL_SAVE_PCT = Math.round((PREMIUM_ANNUAL_SAVING / (PREMIUM_PLAN.monthly * 12)) * 100); // 50

/**
 * Pro outside India (USD). Shown to visitors whose country isn't IN (see
 * lib/pricingRegion.js). No GST — exports of services are zero-rated, so the
 * sticker is the charge.
 *
 * DISPLAY ONLY for now: Razorpay International Payments is not enabled, there
 * are no USD Razorpay plans, and subscription_plans has no USD column. So the
 * USD card shows "Get early access" (→ /contact) instead of checkout. To go
 * live: enable International on Razorpay, add USD plans + server pricing, then
 * swap the CTA in PricingCards.
 */
export const PREMIUM_PLAN_USD = { monthly: 19, yearly: 99 };
export const PREMIUM_USD_YEARLY_PER_MONTH = Math.round((PREMIUM_PLAN_USD.yearly / 12) * 100) / 100; // 8.25
export const PREMIUM_USD_ANNUAL_SAVE_PCT = Math.round((1 - PREMIUM_PLAN_USD.yearly / (PREMIUM_PLAN_USD.monthly * 12)) * 100); // 57

/* ────────────────────────────────────────────────────────────────────────────
 * Full feature comparison — drives the detailed table on /pricing (Pricing.jsx).
 * Mirrors docs/pricing-v2-spec.md §6.
 *
 * Honesty rule — never list what the server doesn't enforce. Each row maps to a
 * real gate: commission_rates · the ₹300 fee floor (pricingEngine) ·
 * limits.free_services · limits.categories · limits.reminder_flows ·
 * WhatsApp reminders (60-day taste, services/proTaste.js) · guest self-reschedule
 * + reschedule alerts (bookingController) · limits.crm (free = 50 most recent,
 * phones masked to the last 4 digits) · limits.followup_flows (day-3 / day-21) ·
 * contactVisibility (15-min window) · theme palettes (hostController) · booking
 * caps (lib/bookingCaps) · limits.ai_generations · limits.insights · support_type.
 *
 * Deliberately ABSENT (spec §6): calendar integrations (limits.calendar_integrations
 * is read by no server code), support response times, custom cancellation presets
 * (behind the OFF pro_cancellation_policy flag), and Explore priority (not built
 * yet — add the row when §4 item 10 ships).
 *
 * Cell values: true (✓) · false (—) · a plain string (verbatim) · limited(tip)
 * → a "Limited" chip whose exact figure lives in a tap/hover tooltip, so a small
 * free-plan number is never printed bare on the page.
 * ──────────────────────────────────────────────────────────────────────────── */

// A capped free-plan cell: renders "Limited", with the real figure in the tooltip.
const limited = (tip) => ({ v: "Limited", tip });

export const PLAN_COLUMNS = [
  { key: "free", name: "Starter", slug: "free" },
  { key: "premium", name: "Pro", slug: "premium", recommended: true },
];

const BOOKING_FEE = "₹10 flat on appointments, GST included · none under ₹300 · none on products, courses or memberships";

export const PLAN_MATRIX = [
  {
    group: "Price & commission",
    rows: [
      { label: "Monthly price", free: "₹0", premium: "₹199" },
      { label: "Yearly price", free: "₹0", premium: "₹1,199" },
      { label: "Commission on appointments", free: "9%", premium: "0% (3% above ₹25,000 a month)" },
      { label: "Commission on products, courses & memberships", free: "12%", premium: "4%" },
      { label: "Booking fee your guest pays", free: BOOKING_FEE, premium: BOOKING_FEE },
    ],
  },
  {
    group: "Selling",
    rows: [
      { label: "Booking page + custom URL", free: true, premium: true },
      { label: "Online & in-person appointments", free: true, premium: true },
      { label: "UPI & card payments", free: true, premium: true },
      { label: "Paid services, bookings & digital products", free: "Unlimited", premium: "Unlimited" },
      { label: "Free (₹0) services", free: limited("2 free services — a discovery call, not a whole business at ₹0"), premium: "Unlimited" },
      { label: "Service categories", free: limited("1 category — your primary profession"), premium: "Unlimited" },
      { label: "Video courses, memberships & coupons", free: true, premium: true },
    ],
  },
  {
    group: "Getting paid",
    rows: [
      { label: "GST tax invoices", free: true, premium: true },
      { label: "Payouts to your bank (KYC)", free: true, premium: true },
      { label: "Earnings & transaction history", free: true, premium: true },
      { label: "Commission tracker — see what you've paid", free: true, premium: true },
      { label: "TDS / TCS statements", free: true, premium: true },
    ],
  },
  {
    group: "Reminders & rescheduling",
    rows: [
      { label: "Confirmations & cancellation notices (email + WhatsApp)", free: true, premium: true },
      { label: "24-hour and 1-hour reminders", free: true, premium: true },
      { label: "WhatsApp reminders", free: limited("Free for 60 days from your first booking, then email reminders"), premium: "Always" },
      { label: "You can reschedule a booking", free: true, premium: true },
      { label: "Guests reschedule themselves", free: false, premium: true },
      { label: "Guest gets the new time by email", free: true, premium: true },
      { label: "WhatsApp alert when a guest reschedules", free: false, premium: true },
    ],
  },
  {
    group: "Clients & growth",
    rows: [
      { label: "Client CRM — records, notes, history, export", free: limited("Your 50 most recent clients (we show your true total); phone numbers show the last 4 digits"), premium: "Everyone, forever" },
      { label: "Guest phone number", free: "From 15 min before the session", premium: "From 15 min before + in your client book" },
      { label: "Day-3 rebook automation", free: true, premium: true },
      { label: "Day-21 rebook automation", free: false, premium: true },
      { label: "Booking caps per day, week & guest", free: false, premium: true },
      { label: "AI service writing", free: limited("10 generations a month"), premium: "Unlimited" },
      { label: "Creator Intelligence — forecast, win-back, benchmarks, audience, cohorts, moves", free: false, premium: true },
    ],
  },
  {
    group: "Profile & support",
    rows: [
      { label: "Testimonials & guest reviews", free: "Unlimited", premium: "Unlimited" },
      { label: "Page colours", free: limited("4 brand colours"), premium: "18 colours" },
      { label: "Social links", free: limited("4 — Instagram, Facebook, LinkedIn, email"), premium: "All 15" },
      { label: "Community forum + Tithi", free: true, premium: true },
      { label: "Support", free: "Email", premium: "Priority queue" },
    ],
  },
];
