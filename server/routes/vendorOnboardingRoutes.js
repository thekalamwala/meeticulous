const express = require('express');
const router = express.Router();
const {
  slugAvailableForUser,
  claimSlug,
  updateOnboardingStep,
  savePersona,
  saveDetails,
  activateFreePlan,
  advanceToLive,
  markComplete,
  getOnboardingStatus,
} = require('../controllers/vendorOnboardingController');
const { protect } = require('../middleware/authMiddleware');
const { slugLimiter } = require('../middleware/security');
const { safeError } = require('../utils/httpError');

// ── Protected: Slug Availability Check (authed, history-backed, self-aware) ──
// POST /api/onboarding/slug-available
// Requires auth so we can exclude the caller's own name from "taken" checks.
// Uses usernameService.usernameOwner (history-backed) to match claimSlug's
// enforcement — live feedback and the write path now agree on what's taken.
router.post('/slug-available', protect, slugLimiter, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ message: 'Slug is required' });
    res.json(await slugAvailableForUser(req.user.id, slug));
  } catch (e) { safeError(res, e); }
});

// ── Protected: Claim Slug (step 2) ────────────────────────────────────────
// POST /api/onboarding/claim-slug
router.post('/claim-slug', protect, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ message: 'Slug is required' });
    res.json(await claimSlug(req.user.id, slug));
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ── Protected: Step 3+ - Update Onboarding Step ───────────────────────────
// POST /api/onboarding/update-step
router.post('/update-step', protect, async (req, res) => {
  try {
    const { slug, step, data } = req.body;
    if (!slug || !step) {
      return res.status(400).json({ message: 'Slug and step are required' });
    }

    const vendorId = req.user.id;
    const profile = await updateOnboardingStep(vendorId, slug, step, data);
    res.json({ message: 'Step updated', step, profile });
  } catch (error) {
    safeError(res, error);
  }
});

// ── Protected: Save persona (redesigned flow) ─────────────────────────────
// POST /api/onboarding/save-persona
// Body: { primary_category: 'life-coach' }
// Writes primary_category + categories, bumps step to max(current, 3).
router.post('/save-persona', protect, async (req, res) => {
  try {
    const { primary_category } = req.body;
    const profile = await savePersona(req.user.id, primary_category);
    res.json({ ok: true, profile });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ── Protected: Save details bundle (redesigned flow) ──────────────────────
// POST /api/onboarding/save-details
// Body: { vendor_type?, booking_type?, tagline?, location?, whatsapp_skipped? }
// Writes any provided fields, bumps step to max(current, 5). Requires
// persona already saved (step >= 3).
router.post('/save-details', protect, async (req, res) => {
  try {
    const profile = await saveDetails(req.user.id, req.body || {});
    res.json({ ok: true, profile });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ── Protected: Get Onboarding Status ──────────────────────────────────────
// GET /api/onboarding/status
router.get('/status', protect, async (req, res) => {
  try {
    const status = await getOnboardingStatus(req.user.id);
    if (!status) {
      return res.status(404).json({ message: 'Onboarding not found' });
    }
    res.json(status);
  } catch (error) {
    safeError(res, error);
  }
});

// ── Protected: Activate Free Plan ─────────────────────────────────────────
// POST /api/onboarding/activate-free
// Sets plan='explorer', advances onboarding_step_completed to 6.
// Does NOT set onboarding_completed — /live button (mark-complete) does that.
router.post('/activate-free', protect, async (req, res) => {
  try {
    await activateFreePlan(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── Protected: Advance to /live (paid path) ───────────────────────────────
// POST /api/onboarding/advance-to-live
// Called AFTER the paid subscription is confirmed active (via /payment/subscription/*).
// Sets onboarding_step_completed=6 WITHOUT setting onboarding_completed.
// Throws 400 if no active plan is found (prevents bypassing the plan step).
router.post('/advance-to-live', protect, async (req, res) => {
  try {
    await advanceToLive(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── Protected: Mark Onboarding Complete ──────────────────────────────────
// POST /api/onboarding/mark-complete
// The ONLY endpoint that sets onboarding_completed=true.
// Gated on the host having an active plan (free or paid).
// Client calls this when the user clicks "Go to Dashboard" on /live.
router.post('/mark-complete', protect, async (req, res) => {
  try {
    await markComplete(req.user.id);
    res.json({ onboarding_completed: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
