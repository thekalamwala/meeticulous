# Spec — AI Page Builder (onboarding "Build with Bolt")

Status: built on branch `feat/ai-page-builder-onboarding` · Author: founder + Claude · 2026-09-19

## Goal
A new host's *first* service listing is written by AI from a one-line title, at the
onboarding activation moment. Turns the "you're live" first-service form into an
"describe it → AI builds the page" moment. Earns an honest "AI-Powered" hook right
where the funnel currently leaks (lifetime: 9 listed → 6 booked).

## What it does (user flow)
1. Host finishes onboarding → lands on the `/vendor-register/:slug/live` screen
   (`ExploreWithBolt.jsx`), the existing first-service mini-form.
2. Types a short title ("45-min career coaching for students") → taps **Build with Bolt**.
3. AI returns a refined title, real short + long description, a suggested duration,
   and a category (when it maps to the host's profession list).
4. Host reviews, sets the price (AI never touches money), taps **Publish**.
5. Service is created with the AI copy instead of the old title-as-description seed.

## Why this shape
- **Reuses the existing Write-with-Bolt stack** (`/services/ai/listing`,
  `generateListing`, `listingContract`, `ai_listing_generations` quota). ~90% existed.
- **No new create path.** The `/live` screen already calls `svcCreate` (the sanctioned
  place — the "onboarding never creates a service" rule is about the *earlier* steps).
- **No ServiceForm handoff.** Everything happens on one screen.
- **Price deferred (phase 2).** The generator deliberately refuses to invent prices
  (`SYSTEM` "NEVER invent prices" + `FABRICATION` regex blanks any `₹`/`Rs`/`%`), and
  there's a min-₹100 rule. Price stays the host's field.
- **FAQs / included / excluded deferred (phase 2).** The generator produces them, but
  `ExploreWithBolt`'s `svcCreate` only sends title + short + long description to keep the
  onboarding payload known-good. Enriching the create payload = a separate PR that audits
  `hostController.createService`.

## Changes
### Server (no migration)
- `services/ai/listingContract.js` — added `duration_minutes` (integer) to the tool
  schema; sanitizer clamps to 5–480 min, omits otherwise (optional field, not in `required`).
- `services/ai/generateListing.js` — `SYSTEM` now asks for a duration suggestion; the
  no-price rule is untouched.
- `controllers/aiController.js` — unchanged. Already accepts the title, gates on
  `ai_generations` quota, and returns `fields` (now including `duration_minutes`).

### Client
- `pages/onboarding/ExploreWithBolt.jsx` — "Build with Bolt" button + `runBolt()`:
  calls `aiGenerateListing`, applies refined title, stores the description copy,
  snaps duration/category only when dropdown-safe, and `handlePublish` sends the stored
  AI copy (falls back to the title seed when Bolt wasn't used). Gated by `BOLT_ENABLED`.
- `services/api.js` — unchanged (`aiGenerateListing` passes the body through).

## Quota
Plain reuse of `ai_generations` (host's chosen policy). The host's first generate spends
one plan generation (Starter 1 / Creator 2 / Professional 2). In-session regenerate is
free (existing behaviour, capped at 8), so refining the onboarding copy costs nothing
extra. No free-build exemption — it would add an abuse path (0-service hosts spamming
generate) and a `kind`-constraint risk for marginal gain.

**Open product call:** spending the single Starter generation at onboarding means a
Starter host can't use Write-with-Bolt again in the dashboard until the window resets.
Acceptable for activation-first; revisit if hosts complain.

## Guardrails / landmines respected
- Price untouched by AI (anti-fabrication guard intact).
- Category only set when the slug is in the host's profession list → FK-safe
  (`chk_category_pair` / `fk_services_category`).
- `BOLT_ENABLED` gates the whole affordance.
- Graceful degradation: 429/503/422 → toast, host fills manually; the form still works
  with Bolt fully off.

## Tests + deploy gate
- Server: `cd server && npm test` — added duration sanitize cases.
- Client: `cd client && npx vitest run` (full run — one stale client test blocks all
  Vercel deploys) — added an `ExploreWithBolt` "Build with Bolt" test.

## Phase 2 (out of scope here)
Price suggestion (guardrailed, separate endpoint) · carry FAQs/included/excluded into the
onboarding create payload · free-text "brief" input distinct from the title.
