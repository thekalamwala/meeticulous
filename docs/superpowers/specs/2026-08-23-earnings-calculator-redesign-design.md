# Earnings Calculator Redesign — Design Spec

**Date:** 2026-08-23
**Route:** `/earnings-calculator`
**File:** `client/src/pages/EarningsCalculator.jsx` (rebuild, single file)
**Math source:** `client/src/lib/morPricing.js` (unchanged — server mirror)
**Pricing source:** `client/src/data/plans.js` (annual numbers already live here)
**Scope guardrail:** one page file; reuse existing math + pricing data; no invented
numbers; no new dependencies.

---

## 1. Goal

Turn the calculator from a static spreadsheet into an interactive tool people want
to play with, that honestly makes the top annual plan feel like the obvious
high-value choice.

Priority order: **Engagement → Perceived Value → Trust → Plan Desire → Annual
Conversion.**

## 2. The honesty constraint (load-bearing)

Verified against the pricing engine: **Host+ and Studio have identical per-booking
take-home** (both 0% commission, same 2.5% PG, same ₹10 booking charge). Studio's
higher fee buys **capacity + tools, not higher take-home**. Therefore Studio must
NOT be positioned as "you keep more" — that would be false.

The honest lever to the top plan is real and already in the data:
**Host+ caps at 1,000 bookings/year (~83/mo); Studio is unlimited.** When the
user's own volume approaches/exceeds that ceiling, Studio becomes *necessary*, not
just nicer. That is the only honest path to "top plan makes sense," and the page
uses it.

Corollary: at low volume the tool honestly recommends Host+ (or even Starter).
That honesty is what makes the Studio recommendation credible when it appears.

## 3. Audit of the current page (ranked problems)

1. **Annual pricing never appears** — calc uses monthly fees only (₹0/229/555).
   The entire conversion goal is unwired.
2. **No loss moment** — only shows what you keep, never what a wrong plan costs.
3. **Instant static reveal** — 3 cards render before any input; nothing to
   discover, nothing rewards interaction.
4. **Top plan has no honest job** — Studio can't win the take-home metric yet is
   the `recommended` tier; page gives it no role.
5. **No objection handling** — "is this real / what's the catch / why yearly" all
   unanswered at the decision point.
6. **Flat headline** — "What will you actually take home?" states, doesn't provoke.
7. **No personality/feedback** — two inputs, static output, reads as a form.

## 4. Ideal journey

Curiosity (provocative H1 + realistic pre-filled numbers, result already alive) →
Input (drag, instant response) → Discovery (take-home counts up) → **Loss**
(Starter commission bleed, ₹X/yr) → Solved (0% flips loss to ₹0) → Compare
(annual, big take-home vs tiny fee) → **Ceiling** (crank volume → Host+ hits cap →
Studio unlocks) → "Top annual plan makes sense" → CTA.

## 5. Page structure (final — nothing that doesn't serve the journey)

1. **Hero + live calculator, fused, above the fold.** No separate intro paragraph.
   Provocative H1, two pre-filled inputs, headline result already computed on load.
2. **Reveal strip** — one big animated number (annual take-home on Meeticulous)
   beside the commission-bleed loss counter.
3. **Three plan cards, annual-first**, best-for-you highlighted honestly by volume;
   monthly/annual toggle, annual default.
4. **Ceiling nudge** — renders only when volume is high enough (approaching/over the
   Host+ 1,000/yr cap): the top-plan moment, shown not told.
5. **Objection resolver** — 3–4 tight lines.
6. **CTA** — single primary, contextual to the winning plan; comparison demoted to
   a text link.

**Removed:** standalone intro paragraph; co-equal "See full comparison" button
(demote to link). Existing GST/host-fees note kept but condensed into the objection
resolver / footnote.

## 6. Inputs & outputs (exact)

**Inputs (2 — do not add more):**
| Input | Control | Range | Default |
|---|---|---|---|
| Price per session (₹) | slider + number | 100–10,000, step 50 | 1,500 |
| Sessions per month | slider + number | 1–120, step 1 | 12 |

Sessions max raised 100→120 so users can cross the ~83/mo Studio ceiling and
trigger the honest top-plan moment.

**Per-plan outputs:** annual take-home (headline), per-session take-home, guest
pays, plan fee (annual). Honest tags: *"Best for your volume"* /
*"You'd outgrow this"* (Host+ when annual volume > 1,000) / Starter ₹5,000
per-session cap warning.

**Global outputs (all computed live):**
- Annual take-home on the winning plan.
- Commission lost on Starter over a year (5% × price × 12 × sessions).
- Annual-vs-monthly saving on the winning **paid** plan (per plan: Host+ saves
  ₹1,249/yr, Studio saves ₹3,010/yr — derived, not hardcoded).

## 7. Reveal / animation

- Take-home number **counts up** on every input change. Respect
  `prefers-reduced-motion` (snap to final value when set).
- Loss counter animates in, settles; shows "− ₹X/yr in commission" when
  Starter-relevant, flips to "₹0 lost" on paid plans.
- Winning card: subtle lift + accent ring on change; crown/badge moves to winner.
- Ceiling nudge fades in when monthly volume crosses ~70/mo (approaching cap),
  hardens past ~83/mo.
- Implementation: CSS transforms + one small count-up hook (`requestAnimationFrame`,
  ~500ms, reduced-motion aware). **No animation library** (GSAP available but
  overkill). Mark with a `// ponytail:` note.

## 8. Annual plan positioning (the top-plan logic)

- **Default billing = annual**; monthly toggle shows the saving forfeited
  (anchoring).
- **Small-vs-big anchor:** annual plan fee sits next to annual take-home so the fee
  reads as a rounding error — real ROI, honestly framed.
- **Studio's pitch = capacity + tools, triggered by the user's numbers:** near the
  Host+ ceiling, Studio's card leads with "Uncapped — Host+ stops at 1,000/yr"
  instead of a take-home claim. Below that, the tool honestly points to Host+.

## 9. Copy (draft — final numbers computed live, examples illustrative)

- **H1:** "See what you'd actually pocket."
- **Sub:** "Drag the numbers. Watch your year add up — and see what the wrong plan
  quietly costs you."
- **Loss line:** "On Starter, 5% walks out the door — **₹X this year.** On Host+ and
  Studio, that's ₹0."
- **Winner line:** "At {n} sessions a month at ₹{price}, you keep the most on
  **{plan} (annual)** — **₹{annual take-home}/year.**"
- **Ceiling nudge:** "You're booking past Host+'s 1,000/year limit. **Studio keeps
  you uncapped** — same 0% cut, room to grow."
- **Annual toggle:** "Pay yearly · save ₹{saving}"
- **Primary CTA:** "Start on {winning plan} →"
- **Objection microcopy:** "Real payout math, not a sales number." · "Cancel
  anytime." · "Same take-home whether or not you're GST-registered." · GST/illustration
  footnote retained.

## 10. Technical notes

- Keep `Seo`, canonical, `ogCard('earnings-calculator','png')`, `ROUTE_START`
  (`/be-a-sloth`), existing design tokens (accents, `rounded-[6px]`, ink/neutral,
  4px borders per UI rules), and the `#f7f5ef` / `bg-white` surface language.
- Extend `CALC_PLANS` consumption to include annual fee: import `PAID_PLANS`
  yearly values from `data/plans.js` (single source) rather than adding numbers to
  `morPricing.js`. `monthlyForPlan` stays the per-booking authority; add an
  annual-aware wrapper in the page (billing cycle → which fee to subtract).
- Winner selection stays honest: highest net take-home among non-capped plans
  (Host+ will usually win take-home); Studio surfaced via the **ceiling** rule, not
  by faking a higher take-home.
- Tests: update `client/src/tests/` calculator test if present; add a check that
  (a) annual saving math matches plans.js, (b) Host+ "outgrow" tag fires above
  1,000/yr, (c) reduced-motion path renders final number. Run `npx vitest run`
  before PR (Vercel gate). Run `npm run build`.

## 11. Out of scope

Pricing changes, server math, new deps, other pages. Untracked `leadScore` files in
the working tree are unrelated and will not be touched.
