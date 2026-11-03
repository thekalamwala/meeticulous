# Founding-100 → ₹1,499 Pro cutover runbook

**When:** the founder alert "Founding 100 is full — run the Pro price cutover" arrives
(`foundingSpots.checkFoundingMilestones`, daily). A "90 founding Pro spots taken" alert comes
first, so there's time to prepare.

**How founding works (v3.184):** while fewer than 100 hosts pay for Pro, every Pro checkout lands
on the archived `premium_founding` row (₹199/mo · ₹999/yr ex-GST). Founding hosts keep that row
through monthly ↔ yearly switches. If they cancel *and* lapse, they lose it — the next checkout
goes to `premium` at the current price. Their Razorpay mandates are bound to the founding Razorpay
plan, so renewals never change.

## Steps

1. **Check the count.** `GET /api/plans/founding` should show `taken >= 100`, `open: false`.
   New Pro checkouts now go to `premium` automatically. No code change is needed.
2. **Raise the price.** Admin → Plans → **Pro** (`premium`) → set **annual price = 1499**. Leave
   monthly at 199 (decision 2026-11-03). Saving clears `razorpay_plan_id_annual`, so the next
   checkout creates a new ₹1,768.82 Razorpay plan. Existing mandates are untouched.
   **Do not edit `premium_founding`.**
3. **Update the display copy** (one PR to the release train):
   - `client/src/data/plans.js` → `PREMIUM_PLAN.yearly: 1769`, `PREMIUM_PER_DAY: "₹4.85"`,
     recompute `PREMIUM_YEARLY_PER_MONTH` (147) and the save % (auto from the constants).
   - `server/services/planService.js` → `FALLBACK_PLANS.premium.annual_price: 1499`.
   - `client/src/data/__tests__/plans.pricing.test.js` → new numbers.
   - `server/services/upgradeNudge.js` → `THRESHOLD_INR` default `147` (Pro yearly / 12).
   - Founding copy in `config/emailTemplates.js` (`PRO_TASTE_ENDING`, `FOUNDING_SPOTS_LOW`) and
     `client/src/lib/hostNudges.js` mentions "₹999/yr, locked for life" — switch to
     "₹1,769/yr". `FoundingNote` hides itself once `open` is false.
4. **Verify:** open `/pricing` and `/dashboard/upgrade` as a free test host — ₹1,769/yr and no
   founding line. Check one existing founding host's profile still shows `premium_founding`.

## Rollback

Set `premium.annual_price` back to 999 in admin. Nothing else depends on the price.
