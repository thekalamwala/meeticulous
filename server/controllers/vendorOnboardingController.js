const crypto = require("crypto");
const { supabaseAdmin } = require("../config/supabase");
const { isReserved } = require("../utils/reservedUsernames");
const { isBlocked } = require("../utils/adultContentFilter");
const usernameService = require("../services/usernameService");
const planService = require("../services/planService");
const { capture: phCapture } = require("../utils/posthog");
const { MIN: SLUG_MIN, MAX: SLUG_MAX } = require("../utils/slugFormat");

// ─── Slug validation & generation ───────────────────────────────────────
const isValidSlug = (slug) => {
  // URL-safe: lowercase, no spaces, alphanumeric + hyphens. Length bounds come
  // from the canonical slugFormat (3–30) so onboarding can't persist a slug that
  // changeUsername would later reject — the old 60-char cap was that divergence.
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= SLUG_MIN && slug.length <= SLUG_MAX;
};

const checkSlugAvailable = async (slug) => {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("onboarding_slug", slug)
    .maybeSingle();
  return !data;
};

const generateUniqueSlug = async (baseName) => {
  let slug = baseName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .slice(0, 50);

  let i = 2;
  let attempts = 0;
  while (true) {
    const available = await checkSlugAvailable(slug);
    if (available) return slug;
    // Bound the loop (audit P3): after 50 tries, append a random suffix and stop
    // rather than spinning forever on a pathological collision set.
    if (++attempts > 50) return `${slug.slice(0, 40)}-${crypto.randomBytes(3).toString("hex")}`;
    slug = `${slug.slice(0, 45)}-${i++}`;
  }
};

// ─── Authed Slug Availability (history-backed, self-aware) ─────────────────
// Used by POST /api/onboarding/slug-available (requires auth).
// Returns { available: true } when:
//   a) the slug is free globally, OR
//   b) the caller owns it (idempotent — lets them re-confirm the seeded name).
// Returns { available: false, reason } for invalid/reserved/taken-by-someone-else.
//
// WHY this replaces checkSlugAvailable for the live-feedback route:
//   checkSlugAvailable queries `profiles WHERE onboarding_slug = slug`.
//   On Google signup markGoogleVendorOnboarding seeds onboarding_slug = auto-name.
//   So the host's OWN pre-filled slug immediately returns available:false — bugged.
//   Additionally checkSlugAvailable ignores username_history, disagreeing with
//   claimSlug's authority on taken names (divergence between feedback and enforce).
const slugAvailableForUser = async (vendorId, slug) => {
  const clean = (slug || '').toLowerCase().trim();
  if (!isValidSlug(clean)) return { available: false, reason: 'invalid' };
  if (isReserved(clean))   return { available: false, reason: 'reserved' };
  if (isBlocked(clean))    return { available: false, reason: 'blocked' };
  // History-backed: rejects names that are current OR retired in username_history.
  // Allow the caller's own name through (self-aware / idempotent).
  const owner = await usernameService.usernameOwner(clean);
  if (owner && owner !== vendorId) return { available: false, reason: 'taken' };
  return { available: true };
};

// ─── Authed Slug Claim (Google flow, step 2) ─────────────────────────────
// Called after Google auth confirms identity (step 1). Claims a slug for the
// authenticated vendor, advances to step 2, and makes /<slug> the host's live
// public profile URL.
//
// Why we don't call usernameService.changeUsername here:
//   The change_username RPC enforces WhatsApp-verified gate, 2/365-day cap, and
//   6-month gap. None apply to onboarding — this is the host's FIRST real name
//   choice (the auto name from upsertProfile was a placeholder). We call
//   usernameService.setOnboardingUsername instead, which atomically swaps the
//   history row (source='onboarding') without triggering the gating rules.
const claimSlug = async (vendorId, slug) => {
  const clean = (slug || "").toLowerCase().trim();
  if (!isValidSlug(clean)) {
    throw new Error(`Slug must be lowercase, ${SLUG_MIN}-${SLUG_MAX} chars, alphanumeric with hyphens only`);
  }
  // Reuse the same reserved-word set that guards changeUsername
  if (isReserved(clean)) {
    throw new Error("That name is reserved");
  }
  // Adult/sexual-content guard — same generic wording as the reserved case.
  if (isBlocked(clean)) {
    throw new Error("That name isn't available");
  }

  // History-backed availability check: rejects names that are current OR retired
  // in username_history, enforcing the global non-reuse invariant.
  // Allow the caller's own slug through (idempotent re-claim).
  //
  // SECURITY NOTE: we check username_history ownership, NOT profiles.username.
  // profiles.username is a denormalized cache that can temporarily diverge from
  // username_history (e.g. after a partial write). Querying history directly is
  // the authoritative check and prevents a divergence window from being exploited
  // to bypass the "taken by someone else" guard.
  const taken = await usernameService.usernameExists(clean);
  if (taken) {
    const ownerId = await usernameService.usernameOwner(clean);
    if (ownerId !== vendorId) {
      throw new Error("Slug already taken");
    }
    // ownerId === vendorId: this is the caller's own name — idempotent re-claim.
  }

  // Atomic swap in username_history (retire auto row, insert onboarding row,
  // update profiles.username). Does NOT run the change_username RPC's gating.
  const result = await usernameService.setOnboardingUsername(vendorId, clean);
  if (!result.ok) {
    if (result.reason === "taken") throw new Error("Slug already taken");
    // Log the raw DB detail server-side; never leak it to the browser (the route
    // returns e.message verbatim). Host sees a generic, actionable message.
    if (result.detail) console.error("claimSlug setOnboardingUsername failed:", result.detail);
    throw new Error("Couldn't claim this URL. Please try again.");
  }

  // Record onboarding_slug and advance step (username already updated by service).
  // Never move the step BACKWARD: a later-step host can navigate Back to /claim
  // (the guard allows revisiting earlier steps) and re-claim their slug — a hard
  // write of 2 would regress their progress and re-walk them through the flow.
  const { data: cur } = await supabaseAdmin
    .from("profiles").select("onboarding_step_completed").eq("id", vendorId).maybeSingle();
  const nextStep = Math.max(cur?.onboarding_step_completed || 0, 2);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      onboarding_slug: clean,
      onboarding_step_completed: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId)
    .select()
    .single();
  if (error) throw error;
  return { slug: clean, profile: data };
};

// ─── Update Onboarding Step ──────────────────────────────────────────────
const updateOnboardingStep = async (vendorId, slug, stepNumber, data) => {
  // P2-7: enforce monotonic progression server-side. The client guard sequences
  // steps, but a scripted call could jump (e.g. step 2 → 6) and land in the
  // dashboard with no category/about. Allow re-saving the current step or
  // advancing by exactly one; reject a forward jump.
  const { data: cur } = await supabaseAdmin
    .from("profiles").select("onboarding_step_completed").eq("id", vendorId).maybeSingle();
  const current = cur?.onboarding_step_completed || 0;
  if (stepNumber > current + 1) {
    throw new Error("Please complete the previous step first.");
  }

  const updates = {
    onboarding_step_completed: stepNumber,
    updated_at: new Date().toISOString(),
  };

  // Map step-specific data to columns (7-step Google-first flow)
  if (stepNumber === 3) {
    // About step: vendor_type + booking_type
    updates.vendor_type  = data.vendor_type  || null;
    updates.booking_type = data.booking_type || null;
  } else if (stepNumber === 4) {
    // Category step: single primary category (plan-gated expansion handled client-side)
    const cats = Array.isArray(data.categories) ? data.categories.filter(Boolean) : [];
    const primary = data.primary_category || cats[0] || null;
    updates.primary_category = primary;
    updates.categories = primary ? [primary] : [];
  } else if (stepNumber === 5) {
    // WhatsApp step. Verified data is written by /api/whatsapp/verify-otp.
    // Only the skip path writes the "unverified" state here.
    if (data.whatsapp_skipped) {
      updates.whatsapp_verified = false;
      updates.whatsapp_number = null;
    }
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", vendorId)
    .select()
    .single();

  if (error) throw error;
  // Onboarding funnel: each completed step. First-occurrence-per-step in PostHog
  // gives the drop-off/abandonment funnel. PostHog-only (not an ad conversion).
  phCapture(vendorId, "onboarding_step_completed", { step: stepNumber });
  return profile;
};

// ─── Batch writers (host-onboarding redesign, PR 2) ─────────────────────
//
// The classic step-per-column endpoint (updateOnboardingStep) is fine for the
// legacy 6-step wizard, but the redesigned flow folds About + WhatsApp into
// one screen with a live preview. These batch writers accept only the fields
// they own and advance the step monotonically, so a client crash mid-save
// never leaves the host at a lower step than the data on disk implies.

// Save persona selection: writes primary_category + categories, bumps step to
// max(current, 3). Requires the slug to already be claimed (step >= 2).
// Called from the new persona picker (PersonaStep) — decouples the picker
// from the numeric step-to-column mapping in updateOnboardingStep.
const savePersona = async (vendorId, primaryCategory) => {
  if (!primaryCategory || typeof primaryCategory !== "string") {
    throw new Error("Pick a category to continue.");
  }
  const { data: cur } = await supabaseAdmin
    .from("profiles").select("onboarding_step_completed").eq("id", vendorId).maybeSingle();
  const current = cur?.onboarding_step_completed || 0;
  if (current < 2) throw new Error("Please claim your URL first.");
  const nextStep = Math.max(current, 3);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      primary_category: primaryCategory,
      categories: [primaryCategory],
      onboarding_step_completed: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId)
    .select()
    .single();
  if (error) throw error;
  phCapture(vendorId, "onboarding_step_completed", { step: nextStep });
  return data;
};

// Save "about you + WhatsApp" bundle. All fields optional; only provided ones
// are written. Bumps step to max(current, 5). Requires persona already saved
// (step >= 3) so we cannot skip the taxonomy write.
// data: { vendor_type?, booking_type?, whatsapp_skipped?, tagline?, location? }
// WhatsApp verification itself still goes through /api/whatsapp/verify-otp —
// this endpoint only records the skip choice.
const saveDetails = async (vendorId, data = {}) => {
  const { data: cur } = await supabaseAdmin
    .from("profiles").select("onboarding_step_completed, whatsapp_verified").eq("id", vendorId).maybeSingle();
  const current = cur?.onboarding_step_completed || 0;
  if (current < 3) throw new Error("Pick your category before this step.");

  const updates = {
    onboarding_step_completed: Math.max(current, 5),
    updated_at: new Date().toISOString(),
  };
  if (data.vendor_type)  updates.vendor_type  = data.vendor_type;
  if (data.booking_type) updates.booking_type = data.booking_type;
  if (data.tagline !== undefined) updates.tagline = data.tagline || null;
  if (data.location !== undefined) updates.location = data.location || null;
  // Only record the skip if WhatsApp isn't already verified — a stale/duplicate
  // skip:true must never wipe a number the host verified via /api/whatsapp/verify-otp.
  if (data.whatsapp_skipped === true && !cur?.whatsapp_verified) {
    updates.whatsapp_verified = false;
    updates.whatsapp_number = null;
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", vendorId)
    .select()
    .single();
  if (error) throw error;
  phCapture(vendorId, "onboarding_step_completed", { step: updates.onboarding_step_completed });
  return profile;
};

// ─── Completion helpers (state-machine contract) ────────────────────────
//
// The /live screen sits between plan activation and dashboard. The contract:
//   activatePlan (via /payment/subscription/*) → plan set, step stays < 6
//   activateFreePlan / advanceToLive           → step = 6, onboarding_completed STAYS false
//   markComplete (/live "Go to Dashboard")     → ONLY writer of onboarding_completed=true
//
// Why split: if activatePlan set onboarding_completed=true, the client guard
// (done>=6 → show /live) would bounce the host past the celebration screen
// directly to /dashboard. The /live screen must be reachable after plan choice.

// Returns the host's currently-active plan slug, or null if none/expired.
// The canonical free tier counts as active (no expiry). Paid requires
// plan_expires_at in the future.
const getActivePlan = async (vendorId) => {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", vendorId)
    .maybeSingle();
  if (!p || !p.plan) return null;
  // Free tier is always active. isFreeSlug covers every free variant — canonical
  // 'starter', legacy 'explorer'/'free', and grandfathered 'starter_legacy'.
  if (planService.isFreeSlug(p.plan)) return p.plan;
  if (p.plan_expires_at && new Date(p.plan_expires_at) > new Date()) return p.plan;
  return null;
};

// Advance to the terminal step WITHOUT completing — lets /live render.
// Throws if no plan has been activated yet (prevents bypassing plan step).
const advanceToLive = async (vendorId) => {
  const plan = await getActivePlan(vendorId);
  if (!plan) throw new Error("Choose a plan first");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ onboarding_step_completed: 6, updated_at: new Date().toISOString() })
    .eq("id", vendorId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// Free plan: activate explorer, then advance to /live (NOT complete).
// onboarding_completed is NOT set here — only markComplete sets it.
const activateFreePlan = async (vendorId) => {
  await supabaseAdmin
    .from("profiles")
    .update({ plan: planService.FREE_PLAN, plan_activated_at: new Date().toISOString() })
    .eq("id", vendorId);
  return advanceToLive(vendorId);
};

// /live button — the ONLY writer of onboarding_completed.
// Gated on the host having an active plan (free or paid).
const markComplete = async (vendorId) => {
  const plan = await getActivePlan(vendorId);
  if (!plan) throw new Error("Choose and activate a plan before finishing");
  // P2-7: don't complete onboarding without the required profile data. A missing
  // primary_category lands the host in a broken state (createService later fails
  // category validation). markComplete is the sole writer of onboarding_completed.
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("primary_category").eq("id", vendorId).maybeSingle();
  if (!prof?.primary_category) throw new Error("Add your category before finishing onboarding.");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_step_completed: 6,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId)
    .select()
    .single();
  if (error) throw error;
  // Activation milestone: onboarding finished (sole writer of onboarding_completed).
  // PostHog-only — the acquisition conversion already fired at user_registered.
  phCapture(vendorId, "onboarding_completed", { plan });
  // Celebrate the activation moment in the bell — you're discoverable now. Once
  // per host (dedupeKey); in-app only, fire-and-forget, never blocks the response.
  require("../utils/inAppNotify").inAppNotify({
    userId: vendorId, role: "host", type: "ONBOARDING_COMPLETE",
    title: "You're live 🎉",
    body: "Your profile is discoverable and ready for bookings. Share your page to get your first one.",
    link: "/dashboard", dedupeKey: `onboarding_complete:${vendorId}`,
  });
  return data;
};

// ─── Get Onboarding Status ──────────────────────────────────────────────
// Returns just enough profile state for the client to (a) route to the right
// step and (b) hydrate the live-preview card on PreviewStep without a second
// round-trip. Additive fields (name/photo/persona) are safe to ignore in the
// legacy guard consumer, which only reads slug/stepCompleted/isComplete.
const getOnboardingStatus = async (vendorId) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("onboarding_slug, onboarding_step_completed, onboarding_completed, name, profile_image, primary_category")
    .eq("id", vendorId)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return {
    slug: profile.onboarding_slug,
    stepCompleted: profile.onboarding_step_completed || 0,
    isComplete: profile.onboarding_completed || false,
    name: profile.name || null,
    profileImage: profile.profile_image || null,
    primaryCategory: profile.primary_category || null,
  };
};

module.exports = {
  isValidSlug,
  slugAvailableForUser,
  generateUniqueSlug,
  claimSlug,
  updateOnboardingStep,
  savePersona,
  saveDetails,
  getActivePlan,
  advanceToLive,
  activateFreePlan,
  markComplete,
  getOnboardingStatus,
};
