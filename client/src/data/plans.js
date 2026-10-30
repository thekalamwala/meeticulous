/**
 * Single source of truth for Meeticulous plan pricing + features (display side).
 *
 * Imported by the homepage (Home.jsx), the dedicated pricing page (Pricing.jsx),
 * the competitor landing pages (lp/*Alternative) and the profession landings, so
 * prices never drift between surfaces. Display names follow themeUtils
 * PLAN_DISPLAY (DB slugs free / premium → Starter / Pro).
 *
 * KEEP IN SYNC with server migration v3.165 (subscription_plans) — the DB is the
 * enforcement authority; this file is the marketing copy that mirrors it.
 *
 * ── PRICES ARE GST-INCLUSIVE ────────────────────────────────────────────────
 * What the customer is actually charged. The DB stores the ex-GST base and the
 * engine adds 18% on top, so the numbers here are the DB values grossed up:
 *
 *   monthly   DB 199.00  →  ₹235   (charged ₹234.82 incl. 18% GST)
 *   yearly    DB 999.00  →  ₹1,179 (charged ₹1,178.82 incl. 18% GST)
 *
 * Yearly saves ₹1,641 = 58.2%, advertised as "Save 58%". ₹1,179 / 365 = ₹3.23,
 * the "under ₹4 a day" headline. Every price shown to a customer must stay on
 * this one basis — quoting monthly ex-GST against yearly incl-GST is what made
 * the old ₹300/₹3,650 pair read as if annual cost MORE than twelve months.
 */

export const FREE_PLAN = {
  name: "Starter",
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
  name: "Pro",
  slug: "premium",
  tagline: "Keep every rupee. Automate the rest.",
  // GST-inclusive display — DB base ₹199/₹999 + 18% (see the header note).
  monthly: 235,
  yearly: 1179,
  recommended: true,
  accent: "#960D32",
  icon: "Rocket",
  persona: { title: "Booked and growing", blurb: "Earning over ₹4,700 a month? This already costs you less than the 5%." },
  intro: "Everything in Starter, plus:",
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

/** Headline daily figure for Pro: ₹1,179 / 365 = ₹3.23. */
export const PREMIUM_PER_DAY = "₹3.23";

/**
 * Yearly billed as a monthly-equivalent: ₹1,179 / 12 = ₹98.25 → ₹98. Same
 * GST-inclusive basis as the yearly charge (see header note), so it reads as
 * "cheaper per month than monthly", never as annual costing more.
 */
export const PREMIUM_YEARLY_PER_MONTH = Math.round(PREMIUM_PLAN.yearly / 12); // 98

/** Annual saving vs 12 × monthly — kept here so no surface recomputes it wrong. */
export const PREMIUM_ANNUAL_SAVING = PREMIUM_PLAN.monthly * 12 - PREMIUM_PLAN.yearly; // ₹1,641
export const PREMIUM_ANNUAL_SAVE_PCT = Math.round((PREMIUM_ANNUAL_SAVING / (PREMIUM_PLAN.monthly * 12)) * 100); // 58

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
  { key: "free", name: "Starter", slug: "free" },
  { key: "premium", name: "Pro", slug: "premium", recommended: true },
];

export const PLAN_MATRIX = [
  {
    group: "Price & commission",
    rows: [
      { label: "Monthly price", free: "₹0", premium: "₹235" },
      { label: "Yearly price", free: "₹0", premium: "₹1,179" },
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
