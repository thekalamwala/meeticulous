'use strict';
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const planService = require('../services/planService');
const { generateListing } = require('../services/ai/generateListing');
const anthropicClient = require('../services/ai/anthropicClient');
const { safeError } = require('../utils/httpError');

// Rolling-window (days) a plan must wait before its "generate" quota renews.
// Shorter = more generous (resets sooner). Keys are the real DB plan slugs
// (see server/services/planService.js FALLBACK_PLANS) — NOT the marketing
// names ("Starter" / "Pro"). `free` inherits the old Starter window.
// Any plan with ai_generations: -1 (premium, supreme, and the legacy paid
// tiers since v3.165) short-circuits before the window is ever consulted.
const WINDOW_DAYS = { free: 182, premium: 0, starter: 182, starter_legacy: 182, creator: 91, professional: 30, supreme: 0 };
const DEFAULT_WINDOW_DAYS = 182;
const TABLE = 'ai_listing_generations';

// Regenerate skips the generate quota by design (free within an owned
// session) — this bounds how many times one session can call the pricier
// regenerate model (MODELS.regenerate) before the host has to save the draft
// or start a new one.
const MAX_REGENERATIONS_PER_SESSION = 8;

// Missing-table degradation detector — same regex as planService.js's
// _isMissingSchema (not exported there, so replicated here; matches the local
// schemaMissing() pattern in serviceController.js/bookingController.js).
// Supabase's real error for an un-migrated table is "Could not find the table
// 'public.ai_listing_generations' in the schema cache", which the old
// substring check ('does not exist') missed — that let the count/ownership
// reads below re-throw uncaught and hang the request on a fresh DB.
const _isMissingSchema = (error) =>
  error && /Could not find the|does not exist|relation .* does not exist/i.test(error.message || '');

async function countGeneratesInWindow(hostId, windowDays) {
  const since = new Date(Date.now() - windowDays * 864e5).toISOString();
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('host_id', hostId)
      .eq('kind', 'generate')
      .gte('created_at', since);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    // Migration not yet applied on this DB — degrade to "no quota row" rather
    // than a 500 (graceful-degradation requirement; feature must not hard-fail
    // ahead of the ai_listing_generations table existing everywhere).
    if (_isMissingSchema(e)) return 0;
    throw e;
  }
}

// session_id is client-supplied and unvalidated. Treating its mere presence
// as "this is a free regenerate" (the old `Boolean(session_id)` gate) let any
// host forge an arbitrary id and always hit the free path — unlimited free
// generation. A request is only a real regenerate if a 'generate' row for
// THIS host and THIS session_id already exists. Degrades to "not owned" (same
// as the quota read) so a missing table falls through to the normal,
// quota-checked GENERATE path instead of throwing.
//
// ai_listing_generations.session_id is `UUID NOT NULL` — a non-UUID value
// (forged or garbage) made PostgREST throw 22P02 "invalid input syntax for
// type uuid" on the .eq('session_id', ...) read below, a shape
// _isMissingSchema doesn't match, so it re-threw uncaught and (Express 4, no
// async-error wrapper) hung the request. Reject non-UUIDs before they ever
// reach the DB, same "not owned" degradation as above.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isOwnedGenerateSession(hostId, sessionId) {
  if (!UUID_RE.test(sessionId)) return false;
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('host_id', hostId)
      .eq('session_id', sessionId)
      .eq('kind', 'generate');
    if (error) throw error;
    return (count || 0) > 0;
  } catch (e) {
    if (_isMissingSchema(e)) return false;
    throw e;
  }
}

// Per-session regenerate cap (MAX_REGENERATIONS_PER_SESSION). Same query
// shape + same missing-table degradation as countGeneratesInWindow /
// isOwnedGenerateSession above: an un-migrated table degrades to "0 used so
// far" rather than throwing.
async function countRegeneratesInSession(hostId, sessionId) {
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('host_id', hostId)
      .eq('session_id', sessionId)
      .eq('kind', 'regenerate');
    if (error) throw error;
    return count || 0;
  } catch (e) {
    if (_isMissingSchema(e)) return 0;
    throw e;
  }
}

async function logUsage(row) {
  try { await supabaseAdmin.from(TABLE).insert(row); } catch (_) { /* audit only; non-fatal */ }
}

// v1: allowedCategorySlugs is always []. resolveAndValidateCategory
// (server/lib/serviceCategory.js) only validates ONE candidate slug, it
// doesn't expose the host's full allowed-slug list, so there's no trivial
// import here — see task-5-report.md. The model simply omits `category`
// when it doesn't get a hint; the host still picks/corrects it on the form.
const allowedCategorySlugsFor = () => [];

async function generateAiListing(req, res) {
  const hostId = req.user.id;
  const plan = req.vendorPlan || planService.FREE_PLAN;
  const { title, category, price, duration, city, audience, session_id } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'A service title is required.' });
  }

  // Outer guard: everything below awaits Supabase/plan-service reads that can
  // reject with an error _isMissingSchema doesn't degrade (network blip, a
  // genuine DB outage, etc). Express 4 has no async-error wrapper, so an
  // uncaught rejection here used to hang the request instead of responding.
  // The inner try/catch around generateListing() below is unchanged — its
  // 503/429/422/502 mapping already handles every AI-side failure and always
  // returns; this outer catch only ever fires for the unexpected stuff.
  try {
    // Dormant feature short-circuit: no key configured → skip straight to the
    // same 503 the AI-side failure would produce, before touching the DB at
    // all (quota/ownership reads). Independent of subscription_plans.limits,
    // so an un-migrated plan row (ai_generations missing → getLimit returns
    // 0) never surfaces as a confusing "used your 0 generations" 429.
    if (!anthropicClient.isConfigured()) {
      return res.status(503).json({ message: 'AI writing is temporarily unavailable. Please fill the form manually.', ai_unavailable: true });
    }

    const isRegenerate = session_id ? await isOwnedGenerateSession(hostId, session_id) : false;

    if (!isRegenerate) {
      // Quota gate — generate only.
      const limit = await planService.getLimit(plan, 'ai_generations');
      if (limit !== -1) {
        const windowDays = WINDOW_DAYS[plan] ?? DEFAULT_WINDOW_DAYS;
        const used = await countGeneratesInWindow(hostId, windowDays);
        if (used >= limit) {
          const unlockAt = new Date(Date.now() + windowDays * 864e5).toISOString();
          return res.status(429).json({
            message: `You've used your ${limit} AI generation${limit === 1 ? '' : 's'} for the ${plan} plan.`,
            current_plan: plan, limit, unlock_at: unlockAt,
          });
        }
      }
    } else {
      // Regenerating within an owned session is free of the generate quota,
      // but capped so a session can't call the pricier regenerate model
      // unbounded.
      const regenCount = await countRegeneratesInSession(hostId, session_id);
      if (regenCount >= MAX_REGENERATIONS_PER_SESSION) {
        return res.status(429).json({
          message: "You've reached the regeneration limit for this draft. Save it or start a new one.",
        });
      }
    }

    let result;
    try {
      result = await generateListing({
        title, category, price, duration, city, audience,
        regenerate: isRegenerate,
        allowedCategorySlugs: allowedCategorySlugsFor(),
      });
    } catch (e) {
      if (e.message === 'AI_UNAVAILABLE') {
        return res.status(503).json({ message: 'AI writing is temporarily unavailable. Please fill the form manually.', ai_unavailable: true });
      }
      if (e.message === 'AI_INVALID') {
        return res.status(422).json({ message: 'Could not generate a listing from that title. Try a more descriptive title.' });
      }
      // Any other failure (SDK/network error etc.) is NOT ours to leak — log it
      // server-side and return a clean, generic 502 instead of an unhandled 500.
      console.error('generateAiListing: unmapped error from generateListing:', e);
      return res.status(502).json({ message: 'AI writing failed. Please try again in a moment.' });
    }

    // Only carry the caller's session_id forward when it was verified above as
    // an owned regenerate — an unowned/forged one is never reused.
    const sid = isRegenerate ? session_id : crypto.randomUUID();
    await logUsage({
      host_id: hostId, session_id: sid, plan_slug: plan,
      model: result.model.includes('sonnet') ? 'sonnet' : 'haiku',
      kind: isRegenerate ? 'regenerate' : 'generate',
    });

    return res.status(200).json({ fields: result.fields, session_id: sid, ai_generated: true, model: result.model });
  } catch (e) {
    return safeError(res, e);
  }
}

module.exports = { generateAiListing, countGeneratesInWindow, WINDOW_DAYS };
