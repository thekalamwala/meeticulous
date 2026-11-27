/**
 * planService.js — database-driven subscription plan reads.
 *
 * Single source of truth for plan limits, features, commission and pricing.
 * No plan logic in code (spec v1.1 rule: database_driven, hardcoded_plans=false).
 *
 * - 60s in-process cache (clearCache() after admin edits)
 * - Legacy aliases: 'explorer' and 'starter' both resolve to the free tier
 * - Fallback defaults if the v2.1 migration hasn't been applied, so production
 *   never breaks (schema fallback pattern from docs/ai-context.md)
 *
 * Two public plans (v3.165): `free` ("Starter") and `premium` ("Pro").
 * Every legacy slug survives and still reads its own row — see FREE_SLUGS.
 */

const { supabaseAdmin } = require('../config/supabase');

// Free-tier slugs that collapse onto the canonical `free` row. `starter_legacy`
// is deliberately NOT aliased: it reads its own row (v3.56 grandfathering),
// which v3.165 brought up to the same limits anyway.
const LEGACY_ALIASES = { explorer: 'free', starter: 'free' };

// The canonical free slug. Used as the resolve-to default everywhere a plan is
// unknown, expired, or unreadable — never hardcode the literal downstream.
const FREE_PLAN = 'free';

// Fallback only used when subscription_plans table is missing. Kept in lockstep
// with migration v3.230 (pricing v2) so a missing table never advertises numbers
// the live DB wouldn't enforce. Prices are EX-GST, back-solved so the 18% that
// computeSubscriptionBreakdown adds lands on the GST-inclusive price: 168.64 →
// ₹199.00, 1016.10 → ₹1,199.00, 761.86 → ₹898.99 (never rounded up). Mirrors
// client/src/data/plans.js.
// `insights` gates Creator Intelligence (services/intel/gate.js): 0 or missing
// locks the six gated blocks, -1 unlocks.
const PREMIUM_LIMITS = { services: -1, free_services: -1, bookings_per_year: -1, digital_products: -1, calendar_integrations: 2, profile_theme_colors: -1, reminder_flows: -1, followup_flows: -1, categories: -1, crm: -1, ai_generations: -1, insights: -1 };

// Per-surface commission % (v3.229 `commission_rates`). GST-INCLUSIVE, like the
// scalar it replaces — pricingEngine backs the GST out. Only free + Pro rows carry
// a map; every other row falls back to its commission_percentage scalar.
const STARTER_RATES = { appointments: 9, products: 12, courses: 12, memberships: 12, appointment_band_inr: null, appointment_rate_above_band: null };
const PRO_RATES = { appointments: 0, products: 4, courses: 4, memberships: 4, appointment_band_inr: 25000, appointment_rate_above_band: 3 };

const FALLBACK_PLANS = {
  free:         { name: 'Starter', slug: 'free', annual_price: 0, monthly_price: 0, commission_percentage: 5, commission_rates: { ...STARTER_RATES }, active: true,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { services: -1, free_services: 2, bookings_per_year: -1, digital_products: -1, calendar_integrations: 1, profile_theme_colors: -1, reminder_flows: 2, followup_flows: 1, categories: 2, crm: 50, ai_generations: 10 },
    features: {}, integrations: { calendar_apps: ['google_calendar'] }, support_type: 'standard', sort_order: 1 },
  premium:      { name: 'Pro', slug: 'premium', annual_price: 1016.10, monthly_price: 168.64, commission_percentage: 0, commission_rates: { ...PRO_RATES }, active: true,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar', 'ical'] }, support_type: 'priority', sort_order: 2 },
  // Founding Pro (v3.184): archived copy of Pro at the campaign price. Pro
  // checkouts land here while founding spots are open; it keeps renewing at that
  // price after `premium` is repriced. Never in the public catalogue.
  premium_founding: { name: 'Pro (Founding)', slug: 'premium_founding', annual_price: 761.86, monthly_price: 168.64, commission_percentage: 0, commission_rates: { ...PRO_RATES }, active: false,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar', 'ical'] }, support_type: 'priority', sort_order: 2 },
  // Legacy paid tiers: hidden from the catalogue, but 3 live mandates still
  // renew on `creator`, so a missing table must not read them as free.
  creator:      { name: 'Pro (Partner)', slug: 'creator', annual_price: 1499, monthly_price: 229, commission_percentage: 0, active: false,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar'] }, support_type: 'priority', sort_order: 3 },
  professional: { name: 'Pro (Legacy Studio)', slug: 'professional', annual_price: 3650, monthly_price: 555, commission_percentage: 0, active: false,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar', 'ical'] }, support_type: 'priority', sort_order: 4 },
};

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, plans: null };

const _isMissingSchema = (error) =>
  error && /Could not find the|does not exist|relation .* does not exist/i.test(error.message || '');

const normalizeSlug = (slug) => {
  const s = (slug || FREE_PLAN).toLowerCase().trim();
  return LEGACY_ALIASES[s] || s;
};

/** All plans (active + archived), as a Map keyed by slug. */
const loadPlans = async () => {
  const now = Date.now();
  if (_cache.plans && now - _cache.at < CACHE_TTL_MS) return _cache.plans;

  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .order('sort_order');

  let plans;
  if (error || !data || data.length === 0) {
    if (error && !_isMissingSchema(error)) console.error('planService read error:', error.message);
    plans = new Map(Object.entries(FALLBACK_PLANS));
  } else {
    plans = new Map(data.map((p) => [p.slug, p]));
  }
  _cache = { at: now, plans };
  return plans;
};

const clearCache = () => { _cache = { at: 0, plans: null }; };

/** Plan by slug (legacy-alias aware). Unknown slug → free tier.
 *  `starter` is kept in the lookup chain so a DB that predates v3.165 (no
 *  `free` row yet) still resolves to its free plan rather than the fallback. */
const getPlan = async (slug) => {
  const plans = await loadPlans();
  return plans.get(normalizeSlug(slug))
    || plans.get(FREE_PLAN)
    || plans.get('starter')
    || FALLBACK_PLANS[FREE_PLAN];
};

/** Numeric limit for a plan. -1 = unlimited. Missing key = 0 (most restrictive). */
const getLimit = async (slug, key) => {
  const plan = await getPlan(slug);
  const v = plan.limits?.[key];
  return typeof v === 'number' ? v : 0;
};

// Booking-reminder lead-times, in flow-priority order: flow 1 = 24h, flow 2 = 1h.
// A plan's `reminder_flows` limit (DB-driven, admin-editable) decides how many of
// these a host's bookings get: 0 = none, 1 = 24h only, 2 = 24h + 1h, -1 = all.
const REMINDER_WINDOWS = [24, 1];

/** Reminder windows (hours-before-start) a plan is entitled to. Derived from the
 *  DB-driven `reminder_flows` limit so admins tune gating without code changes. */
const reminderWindowsForPlan = async (slug) => {
  const n = await getLimit(slug, 'reminder_flows');
  if (n < 0) return [...REMINDER_WINDOWS];          // unlimited (e.g. supreme)
  return REMINDER_WINDOWS.slice(0, n);
};

/** Whether a plan receives BOOKING_RESCHEDULED notifications — a perk of the
 *  UNLIMITED reminder tier (reminder_flows -1). Pricing v2 gives Starter both
 *  reminder windows (reminder_flows 2), so "has every window" no longer means
 *  paid; the host reschedule alert stays Pro-only (spec §4 item 8). */
const rescheduleNotifyForPlan = async (slug) => (await getLimit(slug, 'reminder_flows')) < 0;

/** Commission % (GST-inclusive) a plan pays on one surface: 'appointments' |
 *  'products' | 'courses' | 'memberships'. Reads the v3.229 rate map and falls
 *  back to the commission_percentage scalar, so a row without a map (an
 *  unmigrated DB, or a legacy tier) still prices exactly as before. */
const getRate = async (slug, surface) => {
  const plan = await getPlan(slug);
  const mapped = plan.commission_rates?.[surface];
  if (mapped != null && Number.isFinite(Number(mapped))) return Number(mapped);
  return Number(plan.commission_percentage) || 0;
};

/** Appointment commission % for the NEXT booking, given the host's month-to-date
 *  appointment GMV BEFORE that booking (sum of service_price, non-cancelled,
 *  since the 1st of the month IST — the caller reads it inside the booking-quota
 *  lock so two concurrent bookings can't both see "below band").
 *
 *  ponytail: deliberately does NOT split one booking across the band. The whole
 *  booking is charged at the rate MTD-before selects — ₹24,000 MTD + a ₹2,000
 *  booking is all 0%, the next one is all 3%. The rupee difference is trivial and
 *  a split adds a failure mode to every booking total (spec §2). */
const appointmentRateFor = async (slug, mtdGmvBefore) => {
  const base = await getRate(slug, 'appointments');
  const { appointment_band_inr: band, appointment_rate_above_band: above } = (await getPlan(slug)).commission_rates || {};
  if (band == null || above == null) return base;
  return (Number(mtdGmvBefore) || 0) >= Number(band) ? Number(above) : base;
};

/** Resolve a vendor's effective plan slug — expired paid plan falls back to free tier.
 *  Data is never touched: the host keeps every service, booking and client, and
 *  simply loses the Pro capabilities until they resubscribe. */
const resolveVendorPlan = (profile) => {
  const raw = normalizeSlug(profile?.plan);
  const expired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date();
  return expired ? FREE_PLAN : raw;
};

// Every free-tier slug, so "is this host on the paid track?" checks treat all
// free variants alike: canonical `free` ("Starter"), the retired `starter`, the
// legacy alias `explorer`, and `starter_legacy` (pre-v3.55 free users — see
// migration v3.56). starter_legacy is NOT aliased in normalizeSlug because it
// must read its OWN plan row rather than collapse onto `free`.
const FREE_SLUGS = new Set(['free', 'starter', 'explorer', 'starter_legacy']);
const isFreeSlug = (slug) => FREE_SLUGS.has(String(slug || '').toLowerCase().trim());

// Comped / internal tiers — real accounts but NOT paying customers (the Supreme
// god-tier, staff/test comps). Excluded from the paid CRM pipeline (they never
// enter Customer Relations). Distinct from free: they hold a non-free plan.
const COMPED_SLUGS = new Set(['supreme']);
const isCompedSlug = (slug) => COMPED_SLUGS.has(String(slug || '').toLowerCase().trim());

/**
 * May a host put this plan through self-serve checkout?
 *
 * Only rows in the public catalogue (active !== false). Archived rows still
 * RESOLVE — an existing subscriber keeps their entitlements and renews fine —
 * but they cannot be newly purchased from the upgrade page. That is what keeps
 * the legacy partner price (`creator`, ₹229) and the internal Supreme tier off
 * self-serve; both are sold, when sold at all, through an admin-issued link.
 *
 * Both public checkout endpoints previously accepted ANY priced slug, so
 * `supreme` was purchasable by anyone who guessed it. Gate every self-serve
 * purchase path through here.
 */
const isSelfServable = (plan) => !!plan && plan.active !== false;

module.exports = { loadPlans, getPlan, getLimit, getRate, appointmentRateFor, reminderWindowsForPlan, rescheduleNotifyForPlan, resolveVendorPlan, normalizeSlug, isFreeSlug, isCompedSlug, isSelfServable, clearCache, FALLBACK_PLANS, REMINDER_WINDOWS, FREE_PLAN };
