# Host Onboarding — Google-first flow

> Rewritten 2026-08-23. This file previously described a 10-step
> OTP/email/password flow that **no longer exists**. Hosts sign in with Google
> only (no OTP, no password, no email account-creation step). The reshape
> (`docs/superpowers/plans/2026-06-23-onboarding-google-first-reshape.md`) and
> the Aug-2026 "butter" pass are the current source of truth.

## In one line
A host signs in with Google, claims their URL, picks a profession, fills a few
details, and lands on a **live, bookable** page where they publish their first
service. Four screens; every step persists server-side so the host can resume.

## The flow

```
GoogleStart (/vendor-register)
      │  Google OAuth (identity + calendar consent)
      ▼
SlugClaim (/:slug/claim)              step 2  — claim booking URL
      ▼
PersonaStep (/:slug/category)         step 3  — pick profession
      │        └─ escape hatch: CategoryStep (/:slug/category/all) — search all
      ▼
PreviewStep (/:slug/preview)          step 5  — booking type + tagline + (optional) WhatsApp
      │        activates FREE plan  →  step 6
      ▼
ExploreWithBolt (/:slug/live)         "You're live!" — publish first service → /dashboard
```

`PlansStep (/:slug/plan)` still exists but is **not a forced step** — it's the
resume target for a host who left off at step 5, and a place paid plans can be
chosen. The paywall is otherwise **deferred to the dashboard** (see below).
`AboutYouStep` and `WhatsAppStep` were deleted — their content folded into
`PreviewStep`.

## State machine (`server/controllers/vendorOnboardingController.js`)

`profiles.onboarding_step_completed` advances monotonically (a forward jump is
rejected server-side):

| step | meaning | writer |
|------|---------|--------|
| 1 | Google identity attached | `attachGoogleToProfile` (auth callback) |
| 2 | slug claimed | `claimSlug` |
| 3 | persona (primary_category) saved | `savePersona` |
| 5 | details (booking_type, tagline, WhatsApp choice) saved | `saveDetails` |
| 6 | advanced to /live (a plan is active) | `advanceToLive` / `activateFreePlan` |
| — | `onboarding_completed = true` | `markComplete` **only** |

Notes:
- Step 4 is legacy (`updateOnboardingStep` step 4, still used by the
  CategoryStep escape hatch); the guard rolls it forward to `preview`.
- `advanceToLive` sets step 6 but **does not** complete onboarding — the `/live`
  screen must remain reachable after plan choice. `markComplete` is the sole
  writer of `onboarding_completed`, gated on an active plan **and** a
  `primary_category`.
- **Payment is NOT required to finish.** The free plan (`explorer`/`starter`)
  counts as active, so `markComplete` succeeds with no payment.
- **KYC is NOT required to list.** It gates payout only.

## Screens

### GoogleStart — `/vendor-register`
Single "Continue with Google" action. One consent screen covers identity +
Google Calendar scopes. The callback mints a session and attaches tokens
(`attachGoogleToProfile`): OAuth tokens are written to the server-only
`profile_private` table **first**, and `google_calendar_connected` is set only
if that write succeeds — a failed token write leaves the flag false (reconnect
path), never a "connected" profile with no tokens.

### SlugClaim — `/:slug/claim` (step 2)
Claim the booking URL. Debounced availability check; lowercase, 3–30 chars,
alphanumeric + single hyphens (canonical bounds from `utils/slugFormat.js`,
mirrored client-side). A network/500 blip is shown as "couldn't check, try
again" — **not** as "taken". Claiming swaps the username atomically via
`setOnboardingUsername` (no `changeUsername` gating — this is the first real
name choice).

### PersonaStep — `/:slug/category` (step 3)
Pick one profession tile → `saveOnboardingPersona`. "See all" opens
`CategoryStep` (`/:slug/category/all`), a searchable list that can suggest a new
category; it saves via `updateOnboardingStep` (step 4) and returns to
`/preview`.

### PreviewStep — `/:slug/preview` (step 5)
A single screen with a **live preview** of the future profile card:
- **Booking type** (required): Online / In person / Both.
- **Tagline** (optional, ≤120 chars).
- **WhatsApp** (optional): verify via `/api/whatsapp/*`. Verifying only marks
  verified — it does **not** auto-advance (that used to skip the tagline).
- Continue → `saveOnboardingDetails({ booking_type, tagline, whatsapp_skipped })`,
  then **activates the free plan** and goes straight to `/live`.

Solo/Team (`vendor_type`) was removed — it was written but never read.

### ExploreWithBolt — `/:slug/live` ("You're live!")
The money moment. On mount: celebration + `markOnboardingComplete` (idempotent,
so closing the tab still completes). Inline **first-service** mini-form —
title, category (scoped to the profession), duration, price — publishing via
`POST /api/host/services`:
- Defaults to `meeting_mode: 'online'` so a new host never trips the in-person
  venue **map-link** requirement mid-onboarding (they switch to in-person and
  add the venue later from the dashboard).
- Fires `service_published { source: 'onboarding' }` so the
  `onboarding_completed → first-service` funnel is measurable.
- "Skip for now" escape hatch → dashboard. Never traps the host.

## Resume guard (`client/src/pages/onboarding/useOnboardingGuard.js`)
On each step mount, `GET /api/onboarding/status` returns
`{ slug, stepCompleted, isComplete }`:
- `isComplete` → redirect to `/dashboard`.
- otherwise resume to `RESUME[stepCompleted]` — `{1:claim, 2:category, 3:preview, 4:preview, 5:plan}`.
- Forward order for the block-skip check: `['claim','category','preview','plan']`.
  The guard allows revisiting earlier steps (Back works) and blocks only jumps
  ahead of the resume target.

The guard reads `window.location.pathname` directly (not React Router) — tests
must set the URL accordingly.

## Paywall (deferred)
`PlansStep` is no longer on the critical path. Every host goes live on the free
plan; upgrades live in the dashboard and are surfaced **after** first-booking
value, not as a wall before it. `PlansStep` remains reachable (resume at step 5,
or a direct upgrade) and has a retry + "go live free" fallback if
`getPublicPlans` fails or returns empty.

## API endpoints
All under `/api/onboarding`, all **JWT-protected** (there are no public
OTP/account-creation endpoints anymore):

```
POST /onboarding/slug-available   { slug }                → { available, reason? }
POST /onboarding/claim-slug       { slug }                → advances to step 2
POST /onboarding/save-persona     { primary_category }    → step 3
POST /onboarding/update-step      { slug, step, data }    → legacy step writer (CategoryStep)
POST /onboarding/save-details     { booking_type, tagline?, whatsapp_skipped? } → step 5
GET  /onboarding/status                                   → { slug, stepCompleted, isComplete }
POST /onboarding/activate-free                            → free plan + advance to /live (step 6)
POST /onboarding/advance-to-live                          → step 6 (requires an active plan)
POST /onboarding/mark-complete                            → onboarding_completed = true

POST /whatsapp/send-otp     { phone }                     → sends WhatsApp OTP (502 + throttled admin alert on failure)
POST /whatsapp/verify-otp   { phone, otp }                → stores the NORMALIZED number, marks verified
```

First-service creation reuses the normal service API: `POST /api/host/services`.

## Data model — `profiles` columns (migration `v1.8_vendor_onboarding.sql` + later)
`onboarding_slug`, `onboarding_step_completed`, `primary_category`, `categories`,
`booking_type`, `tagline`, `google_calendar_connected`, `calendar_skipped`,
`whatsapp_number`, `whatsapp_verified`, `onboarding_completed`, `plan`,
`plan_activated_at`, `map_link`. `vendor_type` still exists in the schema but is
**no longer written** by onboarding (the Solo/Team picker was removed).

## What was removed (do not reintroduce)
- OTP/email/password account creation (`send-otp`, `verify-otp`,
  `create-account`, `create-order`, `verify-payment` onboarding endpoints).
- `AboutYouStep`, `WhatsAppStep` screens and their `/about` `/whatsapp` routes.
- The Solo/Team (`vendor_type`) picker.
- The forced plan-selection step before first value.
