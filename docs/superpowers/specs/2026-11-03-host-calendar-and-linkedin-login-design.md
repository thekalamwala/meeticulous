# Host calendar guarantee + LinkedIn host login — design

Date: 2026-11-03 · Status: draft, awaiting founder approval · Code refs are against `release/2026-11` (703cf81).

## Why

The founder wants to open host login beyond Google (starting with LinkedIn) **without** losing the
thing Google login gives for free today: a connected Google Calendar. A calendar is what stops
double-bookings (free/busy blocking), puts the booking on the host's calendar, and creates the Google
Meet link. Without it bookings still work, but a host's first clash with an outside commitment is
the likeliest way to lose them.

Recon (2026-11-03) found the calendar guarantee is already leaky with Google alone:

- Google's consent screen lets people untick the calendar boxes. `googleCallback` never checks the
  granted scopes; `attachGoogleToProfile` sets `google_calendar_connected = tokensStored`
  (`server/controllers/authController.js:563`). A host who refused calendar access is shown as
  connected until a guest's first slot lookup fails, at which point `availabilityService.js:224`
  flips the flag off and nudges. Until then bookings run fail-open with no clash check.
- Onboarding has no calendar step. `calendar_skipped` is hard-set `true` for every new Google host
  (`authController.js:470-488`) on the assumption the single consent screen covered it.
- Data can't tell us where signups drop (DB has 3 hosts, 3 leads; no failed/abandoned-auth events).

So the order, agreed with the founder: **Phase 1 — make calendar connection reliable; Phase 2 —
LinkedIn login on top**, landing LinkedIn hosts on the Phase 1 calendar step.

## Goals

1. `google_calendar_connected` is true **only** when we hold a token that can read free/busy and
   write events.
2. Every host who reaches the end of onboarding without a working calendar is asked to connect one,
   on a dedicated screen that explains why, and can skip.
3. Hosts can sign up and log in with LinkedIn on the host door (`/login-as-vendor`, signup entry
   points) with the same onboarding, welcome email, CRM lead and tracking as Google signups.
4. We can see the funnel: auth completed (by method), calendar connected / skipped / denied.

## Non-goals

- Outlook / Microsoft Graph calendar, Teams links, Jitsi or pasted meeting links (later, if demand).
- Splitting Google sign-in into two consent screens. Google hosts who grant everything keep the
  one-screen experience and never see the calendar step.
- Email/password or magic-link host login.
- Any change to the guest door (`/login`, WhatsApp OTP) or admin login.

## Anti-goals (failure even if it "works")

- A host shown "calendar connected" when we can't read their free/busy.
- Two accounts for one person because they used LinkedIn after Google (same email) or vice versa.
- LinkedIn login hijacking or replacing an existing session (crossing doors still forces logout of
  the other session, per the dual-login rule).
- A blocking calendar gate: the step is always skippable; nobody is locked out of publishing.

## Constraints

- Follow `CLAUDE.md`: no client-side trust, no new schema without a migration on the live DB
  (`spquowzrefozmrzoszkf`) plus a code-side schema fallback, preserve existing behaviour, keep
  business-logic comments, design system "Loop & Slot" for all UI.
- Host login rule in `CLAUDE.md` ("Google only") is deliberately changed by Phase 2 — update it and
  `docs/feature-map.md` / `docs/ai-context.md` in the same PR.
- Scope list stays as is (`server/config/google.js:21-28`): calendar.events, calendar.freebusy,
  calendar.settings.readonly + openid/email/profile.
- Ship each phase as its own PR against the open release train.

## Phase 1 — reliable calendar connection

### 1a. Check granted scopes (server)

- In `googleCallback` (both Flow A vendor_auth and Flow B calendar_connect), read the granted
  scopes from the token response (`tokens.scope`, space-separated).
- **Calendar OK** = both `calendar.events` and `calendar.freebusy` granted (or the legacy full
  `auth/calendar` scope). `calendar.settings.readonly` is optional (only used for timezone).
- When calendar is OK → current behaviour (`attachGoogleToProfile` stores tokens, flag = tokensStored).
- When calendar is NOT OK → do not store the refresh token as a calendar credential, set
  `google_calendar_connected=false`, `calendar_skipped=false`; still write `google_id` (identity) and
  still log the host in. Do not revoke or wipe a previously stored, working token on a plain
  returning login that happens to lack calendar scopes (today's `needsAttach` guard already skips
  attach for connected hosts; keep it).
- Put the scope check in one helper (e.g. `hasCalendarScopes(tokens)`) used by both flows, with a
  unit test for: full grant, events-only, freebusy-only, none, legacy full-calendar, missing
  `scope` field (treat as NOT OK and log).

### 1b. Stop pre-marking calendar as done

- `markGoogleVendorOnboarding` / `enableHostingForProfile` set `calendar_skipped` from the scope
  check instead of hard `true`: `true` only when calendar is OK. (Column already exists.)

### 1c. Calendar onboarding screen (client + small server)

- New screen `/vendor-register/:slug/calendar`, shown **after the plan step and before Live**, only
  when `!google_calendar_connected && !calendar_skipped`. Hosts with a working calendar go straight
  to Live, exactly as today. *(My call on placement: the host has a service and is about to share
  their link, so "stop guests booking you when you're busy" lands best here.)*
- Content: why (block busy times, booking appears on your calendar, Meet link), primary
  "Connect Google Calendar" button, secondary "Skip for now". Note that they can use any Google
  account — it need not match their login email (already supported).
- Connect reuses the existing `GET /api/auth/google` (calendar_connect, `prompt: consent`). Add an
  optional `return` path to its signed state (allowlist: same-origin relative paths under
  `/vendor-register/` and `/dashboard`) so the callback returns to the onboarding screen instead of
  always `/dashboard?google=connected`. On return the screen shows success or "calendar access
  wasn't granted — try again or skip".
- Skip calls a small authed endpoint that sets `calendar_skipped=true` (e.g. extend the existing
  `update-step` in `vendorOnboardingRoutes.js` or a dedicated `skip-calendar`; builder's choice).
- **Do not renumber `onboarding_step_completed`.** The calendar screen is a conditional interstitial,
  not a new numbered step; the onboarding guard (`useOnboardingGuard.js`) must allow it (e.g. treat
  `calendar` as reachable once plan is done) without breaking resume links.
- After onboarding, the existing Dashboard checklist item (`Dashboard.jsx:290`) and ProfileSetup
  connect button remain the nudge for skippers. **No new banner** *(my call)*: add a
  `calendar` signal + `dismissHostNudge` key to the existing single ranked "Next step" nudge
  (`Dashboard.jsx:118-150`), which deliberately replaced scattered banners.
- Dashboard handles a denied return too: alongside the `?google=connected` toast, show "calendar
  access wasn't granted" when Flow B finds the scopes missing (e.g. `?google=denied`).
- Expose `calendar_skipped` to the client: add it to `serializeProfile` and the onboarding status
  response (neither sends it today).

### 1f. Existing hosts *(my call)*

Goal 1 applies to current hosts too. A one-off script checks each host with
`google_calendar_connected=true` by asking Google what its stored token can do (tokeninfo /
a freebusy probe) and prints who lacks calendar scopes (dry run). After the founder reviews the
list, the same script with `--apply` flips those hosts to `false` so the Phase 1 nudge reaches them.
DB has 3 hosts today, so this is small.

### 1d. Timezone without calendar

- When no availability row exists and calendar settings weren't readable, seed timezone from the
  browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`); fall back to `Asia/Kolkata`
  (existing `normalizeSeedTimezone` rules apply). Flow A creates the profile before any client
  step runs, so the client passes `tz` on `GET /api/auth/google/vendor` and it travels in the
  signed state (like `invite`/`att`). LinkedIn passes it in the `/linkedin/host` body.

### 1e. Tracking

PostHog (client and/or `trackServer`), no new tables:
`auth_completed {method: 'google'|'linkedin', new: '1'|'upgrade'|'0'}`,
`calendar_connected {source: 'signup'|'onboarding'|'dashboard'|'profile'}`,
`calendar_scope_denied {source}`, `calendar_step_skipped`.

## Phase 2 — LinkedIn host login

### What exists

- Supabase `linkedin_oidc` provider is enabled and used for the "LinkedIn Verified" badge via
  `linkIdentity` (`client/src/pages/Dashboard.jsx:106`, `POST /api/auth/linkedin/verify`,
  migration v3.170). It is not used for login anywhere.
- Host Google login is custom OAuth + `mintSessionForEmail`; there is no `auth.users` trigger —
  profiles are created by server code (`upsertProfile`).

### Flow

1. Host clicks "Continue with LinkedIn" on `/login-as-vendor` and on the signup entry points that
   show the Google button (`HostLogin.jsx`, `onboarding/GoogleStart.jsx`, `BecomeAHost.jsx`,
   `Home.jsx` hero, `InviteLanding.jsx`). Invite code + UTM attribution must survive the round trip
   (store in `sessionStorage` before redirect, since Supabase OAuth has no signed-state slot we
   control).
2. Client calls `supabase.auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo:
   <origin>/auth/linkedin/done } })`. If a different session is active, sign it out first
   (door-crossing rule).
3. `/auth/linkedin/done` exchanges the PKCE code (`exchangeCodeForSession`; client runs with
   `detectSessionInUrl:false`), then calls a new authed endpoint `POST /api/auth/linkedin/host`
   with `{ intent, invite, att, tz }`.
4. Server (`POST /api/auth/linkedin/host`):
   - Trusts only the verified Supabase JWT; reads the auth user and confirms a `linkedin_oidc`
     identity is present (same check as `/linkedin/verify`).
   - Profile exists (same auth user id) and is host → login; customer → `enableHostingForProfile`;
     superadmin → refuse.
   - No profile → create host profile (`upsertProfile`, name/avatar from LinkedIn claims),
     onboarding step 1, `calendar_skipped=false`, invite stamp, `VENDOR_WELCOME`, CRM lead
     (`source: 'host_signup'`), `trackServer user_registered/lead_captured {method:'linkedin'}`.
     Factor the new-host side effects shared with Google Flow A into one helper so both doors stay
     identical.
   - Stamp `linkedin_verified_at` / `linkedin_sub` and kick `reconcileBadges` (LinkedIn login also
     earns the LinkedIn Verified badge).
   - Returns the serialized profile + a `new` flag; the client routes like `GoogleAuthDone.jsx`
     (onboarding for new/upgrade, dashboard for returning).
5. The new LinkedIn host has no calendar, so Phase 1's calendar screen appears before Live.

### Identity / duplicates

- Same email as an existing host (Google-created users are `email_confirm: true`): Supabase's
  automatic identity linking attaches LinkedIn to the **same** auth user → same profile. Verify this
  on the live project before relying on it; if Supabase creates a second user instead, the endpoint
  must refuse with a clear "this email already has a host account — sign in with Google" rather
  than create a duplicate profile.
- Different LinkedIn email than the Google one → a separate account is unavoidable; the login page
  copy says "Already a host? Use the same option you signed up with."
- **Calendar Google account ≠ login identity** *(my call)*. A LinkedIn host may connect a calendar
  from a Google account with another email (an assistant's or shared business account). Google
  login (Flow A) keeps matching **by email only** — a connected calendar never grants login,
  since that would let whoever owns the calendar account into the host's account. Instead, before
  Flow A creates a new host, it checks `profiles.google_id`: if that Google account is already
  attached as another host's calendar, it does **not** create an account and redirects to
  `/login-as-vendor?error=calendar_account` ("This Google account is connected as a calendar to an
  existing host — sign in with LinkedIn"). Onboarding copy keeps "any Google account".
- Superadmin: LinkedIn door refuses superadmin; Google Flow A behaviour for superadmin is unchanged
  (the shared new-host helper must not alter it).
- Supabase client: it runs with `detectSessionInUrl:false` and does not set PKCE today. Use
  `flowType: 'pkce'` for the LinkedIn sign-in (dedicated client instance or config change — builder
  confirms `linkIdentity` badge flow still works either way).
- Middleware: confirm the auth middleware accepts a valid Supabase JWT whose user has **no profile
  row yet** for this one endpoint (it must not 401/404 before creation).

### Rollout *(my call)*

Merging deploys to prod, so the LinkedIn button ships **hidden** behind a `feature_flags` row
`host_linkedin_login` (default OFF; table + `requireFeature` already exist — server endpoint
gated too). Phase 2's PR can merge before config is done. Founder then: does the config below,
runs the live linking test (LinkedIn account whose email matches an existing host → must land in
that same account), and flips the flag ON. The duplicate-user refusal is a safety net, not the
main path.

### Config (founder action, not code)

- Supabase Auth → URL configuration: add `<prod origin>/auth/linkedin/done` (and localhost) to
  redirect allowlist.
- Confirm LinkedIn app has "Sign In with LinkedIn using OpenID Connect" product (already true if
  badge verify works) and the redirect URI on LinkedIn is Supabase's callback.

## Testing

- Server (Jest): scope helper cases; Flow A new host with/without calendar scopes sets
  `google_calendar_connected` / `calendar_skipped` correctly; Flow B returns to allowed `return`
  paths and rejects others; `/linkedin/host` new host, existing host, customer upgrade, superadmin
  refused, missing identity refused, no duplicate profile.
- Client (Vitest): guard allows the calendar screen after plan; calendar screen hidden when
  connected; skip sets flag and moves to Live.
- Manual on staging/local: Google signup unticking calendar → lands on calendar screen; LinkedIn
  signup end to end → calendar screen → connect → Live.
- `cd server && npm test`, `cd client && npm run build` before each PR.

## Left to the builder

Exact component structure and copy (within design system), whether skip is a new endpoint or an
`update-step` value, where the shared new-host helper lives, PostHog event plumbing details, and
the dashboard banner's dismissal storage.
