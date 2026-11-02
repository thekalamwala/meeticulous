// Plan enforcement middleware — fully database-driven (spec v1.1).
// Limits come from subscription_plans via planService; nothing hardcoded here.
// -1 = unlimited. Every block response includes an upgrade prompt.
const { supabaseAdmin } = require('../config/supabase');
const planService = require('../services/planService');
const { FREE_PLAN } = planService;

// Attach vendorPlan (slug) + vendorPlanData (full row) to req — call before limit checks
const attachPlan = async (req, res, next) => {
  try {
    if (!req.user?.id) return next();
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at').eq('id', req.user.id).single();

    req.vendorPlan = planService.resolveVendorPlan(profile);
    req.vendorPlanData = await planService.getPlan(req.vendorPlan);
    next();
  } catch (err) {
    // Fail-SAFE: fall back to the most-restrictive (free) plan on error.
    // This is intentionally NOT a hard deny — limit checks downstream are the
    // ones that fail closed; this only chooses the safest plan to evaluate against.
    console.error('attachPlan error:', err.message);
    req.vendorPlan = FREE_PLAN;
    next();
  }
};

const blockResponse = (res, { message, plan, limit }) =>
  res.status(403).json({ message, upgrade_required: true, current_plan: plan, limit });

// Minimum listing price (₹) for PAID services on the self-serve plans. Below this
// the flat ₹10 booking fee dwarfs the price (a ₹1 service makes the guest pay
// ~₹12.80, ~92% fee), so we don't sell there. Supreme is exempt; free (₹0)
// services stay allowed on every plan.
const MIN_SERVICE_PRICE = 100;

// Requires attachPlan to have set req.vendorPlan. Blocks a positive price under the
// floor on every customer-facing plan; leaves ₹0 (free) services and the comped
// internal tiers untouched. A body with no price (e.g. a partial update) is skipped.
const enforceMinPrice = (req, res, next) => {
  const price = Number(req.body?.price);
  const plan = req.vendorPlan || FREE_PLAN;
  if (!planService.isCompedSlug(plan) && Number.isFinite(price) && price > 0 && price < MIN_SERVICE_PRICE) {
    return res.status(400).json({
      message: `Paid services must be priced at least ₹${MIN_SERVICE_PRICE}. Set a higher price, or list it free (₹0).`,
      min_price: MIN_SERVICE_PRICE,
    });
  }
  return next();
};

// Block service creation beyond the plan's service limit
const checkServiceLimit = async (req, res, next) => {
  try {
    const plan = req.vendorPlan || FREE_PLAN;
    const planData = req.vendorPlanData || await planService.getPlan(plan);
    const limit = planData.limits?.services ?? 0;
    if (limit === -1) return next();

    const { count } = await supabaseAdmin
      .from('services').select('id', { count: 'exact', head: true })
      .eq('host_id', req.user.id).eq('is_active', true);

    if ((count || 0) >= limit) {
      return blockResponse(res, {
        message: `You've reached your ${limit}-service limit on the ${planData.name} plan. Upgrade for more services.`,
        plan, limit,
      });
    }
    next();
  } catch (err) {
    // Fail CLOSED: a transient DB error must not let a caller exceed their cap.
    console.error('checkServiceLimit error:', err.message);
    return res.status(503).json({ message: 'Could not verify your plan limit. Please try again.' });
  }
};

// Block product creation beyond the plan's digital_products limit
const checkProductLimit = async (req, res, next) => {
  try {
    const plan = req.vendorPlan || FREE_PLAN;
    const planData = req.vendorPlanData || await planService.getPlan(plan);
    const limit = planData.limits?.digital_products ?? 0;

    if (limit === 0) {
      return blockResponse(res, {
        message: 'Digital products are not included in your plan. Upgrade to sell products.',
        plan, limit,
      });
    }
    if (limit === -1) return next();

    const { count } = await supabaseAdmin
      .from('products').select('id', { count: 'exact', head: true })
      .eq('host_id', req.user.id).eq('is_active', true);

    if ((count || 0) >= limit) {
      return blockResponse(res, {
        message: `You've used all ${limit} digital product slots on the ${planData.name} plan. Upgrade for more.`,
        plan, limit,
      });
    }
    next();
  } catch (err) {
    // Fail CLOSED: a transient DB error must not let a caller exceed their cap.
    console.error('checkProductLimit error:', err.message);
    return res.status(503).json({ message: 'Could not verify your plan limit. Please try again.' });
  }
};

// Re-usable activation gate for the toggle/update paths (audit P1-1). The create
// routes run checkServiceLimit/checkProductLimit as middleware, but flipping an
// existing row's is_active false→true (PUT /:id/toggle, PUT /:id) had NO cap
// check — so create-up-to-cap → deactivate → create-more → reactivate-all let a
// host exceed their paid-tier limit. Controllers call this BEFORE activating.
//   kind: 'services' | 'digital_products'
// Returns { ok:true } or { ok:false, status, message }. Fails CLOSED on error.
const canActivateMore = async (hostId, kind) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at, plan_activated_at, created_at').eq('id', hostId).single();
    const plan = planService.resolveVendorPlan(profile);
    const planData = await planService.getPlan(plan);
    const limit = planData.limits?.[kind] ?? 0;
    if (limit === -1) return { ok: true };               // unlimited
    const noun = kind === 'services' ? 'service' : 'digital product';
    if (limit === 0)
      return { ok: false, status: 403, message: `${noun[0].toUpperCase() + noun.slice(1)}s are not included in your plan. Upgrade to activate.` };

    const table = kind === 'services' ? 'services' : 'products';
    const { count } = await supabaseAdmin
      .from(table).select('id', { count: 'exact', head: true })
      .eq('host_id', hostId).eq('is_active', true);
    if ((count || 0) >= limit)
      return { ok: false, status: 403, message: `You've reached your ${limit}-${noun} limit on the ${planData.name} plan. Deactivate another or upgrade to activate more.` };
    return { ok: true };
  } catch (err) {
    // Fail CLOSED: a transient DB error must not let a caller exceed their cap.
    console.error('canActivateMore error:', err.message);
    return { ok: false, status: 503, message: 'Could not verify your plan limit. Please try again.' };
  }
};

// Free-service sub-cap (v3.54): `limits.free_services` bounds how many ACTIVE
// price-0 services a host may list. Sits INSIDE the total `services` cap — a free
// service counts toward both. -1 = unlimited; an ABSENT key defaults to unlimited
// (permissive) so a pre-migration DB never accidentally blocks paid-tier hosts —
// the v3.54 migration is what actually switches the Starter cap on.
//
// Call from every path that can yield an active free service:
//   - create a price-0 service          → no excludeId (count all active free)
//   - activate an inactive free service → excludeId = id (it isn't counted yet)
//   - edit an active service down to ₹0 → excludeId = id (don't double-count self)
// Returns { ok:true } or { ok:false, status, message }. Fails CLOSED on error.
const canAddFreeService = async (hostId, { excludeId = null } = {}) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at, plan_activated_at, created_at').eq('id', hostId).single();
    const plan = planService.resolveVendorPlan(profile);
    const planData = await planService.getPlan(plan);
    const limit = planData.limits?.free_services ?? -1;   // absent → unlimited
    if (limit === -1) return { ok: true };
    if (limit === 0)
      return { ok: false, status: 403, message: `Free services aren't available on the ${planData.name} plan. Set a price, or upgrade.` };

    let q = supabaseAdmin
      .from('services').select('id', { count: 'exact', head: true })
      .eq('host_id', hostId).eq('is_active', true).eq('price', 0);
    if (excludeId) q = q.neq('id', excludeId);
    const { count } = await q;

    if ((count || 0) >= limit)
      return { ok: false, status: 403, message: `You can list up to ${limit} free services on the ${planData.name} plan. Set a price on this one, or deactivate another free service.` };
    return { ok: true };
  } catch (err) {
    // Fail CLOSED: a transient DB error must not let a caller exceed the free cap.
    console.error('canAddFreeService error:', err.message);
    return { ok: false, status: 503, message: 'Could not verify your plan limit. Please try again.' };
  }
};

// Yearly booking-receive limit (spec v1.1: bookings_per_year, all plans capped)
// NOTE: this count→insert is still TOCTOU-racy — two concurrent bookings can
// each read count = limit-1 and both insert, briefly exceeding the cap. We do
// NOT add a DB transaction here; the database-level constraint/index is the
// backstop for the rare race. This check fails closed only on errors (below).
const checkBookingReceiveLimit = async (hostId) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at, plan_activated_at, created_at').eq('id', hostId).single();

    const plan = planService.resolveVendorPlan(profile);
    const planData = await planService.getPlan(plan);
    const limit = planData.limits?.bookings_per_year ?? 0;
    if (limit === -1) return { allowed: true };

    // Subscription year starts at plan activation (or account creation for free tier)
    const anchor = new Date(profile?.plan_activated_at || profile?.created_at || Date.now());
    const yearStart = new Date(anchor);
    yearStart.setFullYear(yearStart.getFullYear() + Math.floor((Date.now() - anchor.getTime()) / (365 * 24 * 3600 * 1000)));

    const { count } = await supabaseAdmin
      .from('bookings').select('id', { count: 'exact', head: true })
      .eq('host_id', hostId).neq('status', 'cancelled')
      .gte('created_at', yearStart.toISOString());

    if ((count || 0) >= limit) {
      return {
        allowed: false,
        message: `This creator has reached their booking limit for this subscription year (${planData.name} plan: ${limit}/year). Bookings resume when the plan renews or upgrades.`,
      };
    }
    return { allowed: true };
  } catch (err) {
    // Fail CLOSED: deny on a transient DB error rather than letting the host
    // silently exceed their yearly booking cap.
    console.error('checkBookingReceiveLimit error:', err.message);
    return { allowed: false, message: 'Could not verify availability. Please try again.' };
  }
};

// Client CRM gate (limits.crm: -1 = full/unlimited on Pro and the legacy
// paid tiers, a POSITIVE N = a capped view — the free Starter plan gets its N most
// recent clients, N enforced downstream in crmService.listClients — and 0/absent
// = fully blocked). Requires attachPlan to have run first. Fails CLOSED.
const requireCrm = async (req, res, next) => {
  try {
    const plan = req.vendorPlan || FREE_PLAN;
    const planData = req.vendorPlanData || await planService.getPlan(plan);
    const limit = planData.limits?.crm ?? 0;
    if (limit === -1 || limit > 0) return next();
    return blockResponse(res, {
      message: 'The Client CRM is a Pro feature. Upgrade to manage client records.',
      plan, limit,
    });
  } catch (err) {
    console.error('requireCrm error:', err.message);
    return res.status(503).json({ message: 'Could not verify your plan. Please try again.' });
  }
};

module.exports = { attachPlan, checkServiceLimit, checkProductLimit, checkBookingReceiveLimit, canActivateMore, canAddFreeService, requireCrm, enforceMinPrice, MIN_SERVICE_PRICE };
