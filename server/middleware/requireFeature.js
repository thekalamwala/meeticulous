/**
 * requireFeature(key) — route guard that 503s when an admin kill-switch is off.
 *
 * Usage:  router.post('/', requireFeature('guest_booking'), createBooking)
 *
 * Fail-OPEN: if the flag is unknown or the lookup errors, the request proceeds
 * (see services/featureFlags.isFeatureEnabled). A missing migration or DB blip
 * must never brick a live feature. Only an explicit `enabled = false` row blocks.
 *
 * Supreme bypass: when a flag is OFF, a caller whose plan carries
 * `bypasses_kill_switches` (the admin-only Supreme membership) still passes —
 * EXCEPT for SAFETY_KEYS (financial / auth / platform-freeze kills), which stay
 * hard for everyone. The bypass keys off the CALLER's plan, so it only opens a
 * host's own (vendor-scope) gates; customer-scope flags are hit by guests (no
 * plan) and are unaffected.
 */

const { isFeatureEnabled } = require('../services/featureFlags');
const { SAFETY_KEYS } = require('../config/featureRegistry');
const { supabaseAdmin } = require('../config/supabase');
const planService = require('../services/planService');

/**
 * Does the authenticated caller hold a kill-switch-bypassing plan?
 * Reuses attachPlan's req.vendorPlanData when present; otherwise one cached
 * profiles.plan lookup. Memoized on req so repeated gates don't re-query.
 * Fail-CLOSED: any error → no bypass (an off safety/maintenance kill must win).
 */
const callerBypassesFlags = async (req) => {
  if (req._supremeBypass !== undefined) return req._supremeBypass;
  let result = false;
  try {
    if (req.vendorPlanData) {
      result = !!req.vendorPlanData.bypasses_kill_switches;
    } else if (req.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('plan, plan_expires_at').eq('id', req.user.id).single();
      const plan = await planService.getPlan(planService.resolveVendorPlan(profile));
      result = !!plan?.bypasses_kill_switches;
    }
  } catch (_) {
    result = false;
  }
  req._supremeBypass = result;
  return result;
};

const requireFeature = (key) => async (req, res, next) => {
  try {
    if (await isFeatureEnabled(key)) return next();
    // Flag is OFF. Supreme punches through — unless this is a safety kill.
    if (req.user?.id && !SAFETY_KEYS.includes(key) && (await callerBypassesFlags(req))) {
      return next();
    }
    return res.status(503).json({
      message: 'This feature is currently turned off. Please try again later.',
      feature_disabled: key,
    });
  } catch (_) {
    return next(); // fail-open
  }
};

module.exports = { requireFeature, callerBypassesFlags };
