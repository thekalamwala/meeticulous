/**
 * Single source of truth for Meeticulous plan pricing + features (display side).
 *
 * Imported by the homepage (Home.jsx), the dedicated pricing page (Pricing.jsx),
 * the competitor landing pages (lp/*Alternative) and the profession landings, so
 * prices never drift between surfaces. Display names follow themeUtils
 * PLAN_DISPLAY (DB slugs free / premium → Sloth / Sloth Active).
 *
 * KEEP IN SYNC with server migration v3.165 (subscription_plans) — the DB is the
 * enforcement authority; this file is the marketing copy that mirrors it.
 *
 * ── PRICES ARE GST-INCLUSIVE ────────────────────────────────────────────────
 * What the customer is actually charged. The DB stores the ex-GST base and the
 * engine adds 18% on top, so the numbers here are the DB values grossed up:
 *
 *   monthly   DB 338.13  →  ₹399   (charged ₹398.99 — a paisa under, never over)
 *   yearly    DB 3050.00 →  ₹3,599
 *
 * Yearly saves ₹1,189 = 24.83%, advertised as "Save 25%". ₹3,599 / 365 = ₹9.86,
 * the "under ₹10 a day" headline. Every price shown to a customer must stay on
 * this one basis — quoting monthly ex-GST against yearly incl-GST is what made
 * the old ₹300/₹3,650 pair read as if annual cost MORE than twelve months.
 */

export const FREE_PLAN = {
  name: "Sloth",
  slug: "free",
  tagline: "Everything you need to get booked.",
  badge: "5% per booking",
  accent: "#4AB765",
  icon: "Sprout",
  persona: { title: "Just starting out", blurb: "Your booking page, your first customers, at zero cost." },
  monthly: 0,
  yearly: 0,
  features: [
    "Unlimited services & bookings",
    "Booking page + UPI payments",
    "24-hour booking reminders",
    "Online & in-person appointments",
    "Google Calendar & Meet",
    "3 digital products",
    "GST invoices & payouts",
  ],
};

export const PREMIUM_PLAN = {
  name: "Sloth Active",
  slug: "premium",
  tagline: "Keep every rupee. Automate the rest.",
  // GST-inclusive — see the header note.
  monthly: 399,
  yearly: 3599,
  recommended: true,
  accent: "#2E1065",
  icon: "Rocket",
  persona: { title: "Booked and growing", blurb: "Earning over ₹6,000 a month? This already costs you less than the 5%." },
  intro: "Everything in Sloth, plus:",
  features: [
    "0% commission — keep it all",
    "Client CRM with notes & history",
    "1-hour reminders + reschedule alerts",
    "Follow-up & rebook automation",
    "Unlimited digital products",
    "2 calendar integrations",
    "Unlimited AI service writing",
    "Priority WhatsApp support",
  ],
};

/** Array form — several surfaces index into this ([0] / [length-1]). */
export const PAID_PLANS = [PREMIUM_PLAN];

/** Both plans in display order. */
export const ALL_PLANS = [FREE_PLAN, PREMIUM_PLAN];

/** Headline daily figure for Sloth Active: ₹3,599 / 365 = ₹9.86. */
export const PREMIUM_PER_DAY = "₹9.86";

/**
 * Yearly billed as a monthly-equivalent: ₹3,599 / 12 = ₹299.9 → ₹300. Same
 * GST-inclusive basis as the yearly charge (see header note), so it reads as
 * "cheaper per month than monthly", never as annual costing more.
 */
export const PREMIUM_YEARLY_PER_MONTH = Math.round(PREMIUM_PLAN.yearly / 12); // 300

/** Annual saving vs 12 × monthly — kept here so no surface recomputes it wrong. */
export const PREMIUM_ANNUAL_SAVING = PREMIUM_PLAN.monthly * 12 - PREMIUM_PLAN.yearly; // ₹1,189
export const PREMIUM_ANNUAL_SAVE_PCT = Math.round((PREMIUM_ANNUAL_SAVING / (PREMIUM_PLAN.monthly * 12)) * 100); // 25

/* ────────────────────────────────────────────────────────────────────────────
 * Full feature comparison — drives the detailed table on /pricing (Pricing.jsx).
 *
 * Every row maps to a REAL, enforced gate (honesty rule — never list what the
 * server doesn't enforce):
 *   commission_percentage · limits.free_services · limits.crm (free = 10 most
 *   recent) · limits.reminder_flows (1h + reschedule alerts) · WhatsApp reminders
 *   (free 2-month grace then email — bookingController.whatsappRemindersAllowed) ·
 *   limits.followup_flows · limits.digital_products · limits.calendar_integrations ·
 *   limits.ai_generations · support_type.
 *
 * Deliberately ABSENT: advanced_reports and data_export — they live in
 * subscription_plans.features, which nothing on the server reads. Listing them
 * would be a promise the product doesn't keep. Add the rows when the gates exist.
 *
 * Cell values: true (✓) · false (—) · a plain string (verbatim) · limited(tip)
 * → a "Limited" chip whose exact figure lives in a tap/hover tooltip, so a small
 * free-plan number is never printed bare on the page.
 * ──────────────────────────────────────────────────────────────────────────── */

// A capped free-plan cell: renders "Limited", with the real figure in the tooltip.
const limited = (tip) => ({ v: "Limited", tip });

export const PLAN_COLUMNS = [
  { key: "free", name: "Sloth", slug: "free" },
  { key: "premium", name: "Sloth Active", slug: "premium", recommended: true },
];

export const PLAN_MATRIX = [
  {
    group: "Price & commission",
    rows: [
      { label: "Monthly price", free: "₹0", premium: "₹399" },
      { label: "Yearly price", free: "₹0", premium: "₹3,599" },
      { label: "Commission on your bookings", free: "5%", premium: "0%" },
    ],
  },
  {
    group: "Selling",
    rows: [
      { label: "Public booking page + custom URL", free: true, premium: true },
      { label: "Online & in-person appointments", free: true, premium: true },
      { label: "Paid services", free: "Unlimited", premium: "Unlimited" },
      { label: "Free (₹0) services", free: limited("2 free services — a discovery call, not a whole business at ₹0"), premium: "Unlimited" },
      { label: "Bookings", free: "Unlimited", premium: "Unlimited" },
      { label: "Service categories", free: "Unlimited", premium: "Unlimited" },
      { label: "UPI & card payments", free: true, premium: true },
    ],
  },
  {
    group: "Getting paid",
    rows: [
      { label: "GST tax invoices", free: true, premium: true },
      { label: "Payouts to your bank (KYC)", free: true, premium: true },
      { label: "Earnings & transaction history", free: true, premium: true },
      { label: "Commission tracker — see what you've paid", free: true, premium: true },
    ],
  },
  {
    group: "Reminders",
    rows: [
      { label: "Booking confirmations (email + WhatsApp)", free: true, premium: true },
      { label: "24-hour reminder", free: true, premium: true },
      { label: "1-hour reminder", free: false, premium: true },
      { label: "WhatsApp reminders", free: limited("Free for your first 2 months, then email reminders"), premium: true },
      { label: "Reschedule & cancellation alerts", free: false, premium: true },
    ],
  },
  {
    group: "Clients & growth",
    rows: [
      { label: "Client CRM — records, notes, history", free: limited("Your 10 most recent clients"), premium: "Full" },
      { label: "Follow-up & rebook automation", free: false, premium: true },
      { label: "Digital products", free: limited("3 digital products"), premium: "Unlimited" },
      { label: "AI service writing", free: limited("10 generations every 6 months"), premium: "Unlimited" },
      { label: "Calendar integrations", free: limited("1 calendar (Google)"), premium: "2 (Google + iCal)" },
    ],
  },
  {
    group: "Profile & support",
    rows: [
      { label: "Profile theme colours", free: true, premium: true },
      { label: "Guest reviews", free: true, premium: true },
      { label: "Support", free: "Email", premium: "Priority — WhatsApp + email" },
    ],
  },
];
