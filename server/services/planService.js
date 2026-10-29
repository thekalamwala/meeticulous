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
 * Two public plans (v3.165): `free` ("Sloth") and `premium` ("Sloth Active").
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
// with migration v3.165 (the published pricing matrix) so a missing table never
// advertises numbers the live DB wouldn't enforce. Prices are EX-GST; the 18%
// is added by computeSubscriptionBreakdown (₹338.13 → ₹398.99 charged,
// ₹3,050 → ₹3,599 charged).
const PREMIUM_LIMITS = { services: -1, free_services: -1, bookings_per_year: -1, digital_products: -1, calendar_integrations: 2, profile_theme_colors: -1, reminder_flows: -1, followup_flows: -1, categories: -1, crm: -1, ai_generations: -1 };

const FALLBACK_PLANS = {
  free:         { name: 'Sloth', slug: 'free', annual_price: 0, monthly_price: 0, commission_percentage: 5, active: true,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { services: -1, free_services: 2, bookings_per_year: -1, digital_products: 3, calendar_integrations: 1, profile_theme_colors: -1, reminder_flows: 1, followup_flows: 0, categories: -1, crm: 10, ai_generations: 10 },
    features: {}, integrations: { calendar_apps: ['google_calendar'] }, support_type: 'standard', sort_order: 1 },
  premium:      { name: 'Sloth Active', slug: 'premium', annual_price: 3050, monthly_price: 338.13, commission_percentage: 0, active: true,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar', 'ical'] }, support_type: 'priority', sort_order: 2 },
  // Legacy paid tiers: hidden from the catalogue, but 3 live mandates still
  // renew on `creator`, so a missing table must not read them as free.
  creator:      { name: 'Sloth Active (Partner)', slug: 'creator', annual_price: 1499, monthly_price: 229, commission_percentage: 0, active: false,
    razorpay_plan_id_monthly: null, razorpay_plan_id_annual: null,
    limits: { ...PREMIUM_LIMITS },
    features: {}, integrations: { calendar_apps: ['google_calendar'] }, support_type: 'priority', sort_order: 3 },
  professional: { name: 'Sloth Active (Legacy Studio)', slug: 'professional', annual_price: 3650, monthly_price: 555, commission_percentage: 0, active: false,
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

/** Whether a plan receives BOOKING_RESCHEDULED notifications — a perk of the top
 *  reminder tier (a plan entitled to every reminder window). */
const rescheduleNotifyForPlan = async (slug) => {
  const n = await getLimit(slug, 'reminder_flows');
  return n < 0 || n >= REMINDER_WINDOWS.length;
};

/** Resolve a vendor's effective plan slug — expired paid plan falls back to free tier.
 *  Data is never touched: the host keeps every service, booking and client, and
 *  simply loses the Sloth Active capabilities until they resubscribe. */
const resolveVendorPlan = (profile) => {
  const raw = normalizeSlug(profile?.plan);
  const expired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date();
  return expired ? FREE_PLAN : raw;
};

// Every free-tier slug, so "is this host on the paid track?" checks treat all
// free variants alike: canonical `free` ("Sloth"), the retired `starter`, the
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

module.exports = { loadPlans, getPlan, getLimit, reminderWindowsForPlan, rescheduleNotifyForPlan, resolveVendorPlan, normalizeSlug, isFreeSlug, isCompedSlug, isSelfServable, clearCache, FALLBACK_PLANS, REMINDER_WINDOWS, FREE_PLAN };
