# Host Calendar Guarantee + LinkedIn Host Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host is marked calendar-connected only when Google actually granted calendar access, hosts without a calendar are asked to connect one before going live, and hosts can sign up / log in with LinkedIn (flag-gated) landing on that same calendar step.

**Architecture:** Phase 1 adds a scope check in the existing Google OAuth callback, a conditional onboarding screen between Plan and Live that reuses the existing calendar-connect OAuth flow, and a `calendar` entry in the dashboard's existing "Next step" nudge. Phase 2 adds Supabase `linkedin_oidc` sign-in on the client plus one authed server endpoint that creates/upgrades the host with the same side effects as Google signup.

**Tech Stack:** Express 4 + Jest (server), React 18 + Vite + Vitest (client), Supabase Auth/Postgres, googleapis.

**Spec:** `docs/superpowers/specs/2026-11-03-host-calendar-and-linkedin-login-design.md`

## Global Constraints

- Branch off `origin/release/2026-11` (main is behind the train), PR `--base release/2026-11`. Phase 1 and Phase 2 are separate branches/PRs; Phase 2 starts after Phase 1 merges into the train. Never merge — stop at the PR.
- Calendar OK = token `scope` contains both `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.freebusy`, OR the legacy `https://www.googleapis.com/auth/calendar`. `calendar.settings.readonly` is optional.
- Do not renumber `onboarding_step_completed`. The calendar screen is a conditional interstitial.
- No new dashboard banner — use the existing ranked nudge (`client/src/lib/hostNudges.js`).
- New migration only for the Phase 2 flag (`v3.186`), seeded `enabled=false`, plus a matching `featureRegistry.js` entry. Applying it to the live DB (`spquowzrefozmrzoszkf`) needs the founder's go-ahead.
- All UI follows `design-system/BRAND_RULES.md` (tokens, `.mt-btn`/`.mt-card`, radius scale); run its checklist on new screens.
- Keep existing business-logic comments; extend, don't delete.
- Before each PR: `cd server && npm test` and `cd client && npm run build` (and `npm test`).

## Review Focus

1. A token response with **no `scope` field** must count as NOT calendar-OK (and log) — never as connected. → Task 1 test.
2. A **returning, already-connected host** logging in again (no new refresh token, partial `scope`) must keep `google_calendar_connected=true` — the scope check must not disconnect working hosts. → Task 2 test.
3. The calendar-connect **`return` path is an open-redirect vector**: `//evil.com`, `https://evil.com`, `/dashboard/../x`, `/vendor-register/x/calendar?next=…` must all be dropped (fall back to `/dashboard`). → Task 3 test.
4. A LinkedIn sign-in whose **email already belongs to a different auth user's profile** must not create a second profile. → Task 13 test.
5. Landing on **`/vendor-register/:slug/calendar` when already connected** (back button, stale tab) must skip straight to Live, and the `?google=` return handler must run once under StrictMode. → Task 6 test.

---

# Phase 1 — reliable calendar connection (branch `feat/host-calendar-guarantee`)

### Task 1: Scope helper

**Files:**
- Modify: `server/config/google.js` (export alongside `SCOPES`)
- Test: `server/tests/unit/googleScopes.test.js` (create)

**Interfaces:**
- Produces: `hasCalendarScopes(tokens: { scope?: string }) -> boolean` exported from `server/config/google.js`.

- [ ] **Step 1: Write the failing tests** — `hasCalendarScopes`:
  - full scope string (events + freebusy + settings.readonly + openid email profile) → `true`
  - events + freebusy only → `true`
  - events only → `false`; freebusy only → `false`
  - `openid email profile` only → `false`
  - legacy `https://www.googleapis.com/auth/calendar openid` → `true`
  - `{}` (no `scope`) → `false`; `undefined` → `false`
- [ ] **Step 2:** `cd server && npx jest tests/unit/googleScopes.test.js` → FAIL (not a function).
- [ ] **Step 3: Implement** — split `tokens?.scope` on whitespace into a Set; log `console.warn` once when `scope` is missing.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Commit** `feat(auth): hasCalendarScopes helper`.

### Task 2: Callback honours granted scopes

**Files:**
- Modify: `server/controllers/authController.js` — `attachGoogleToProfile` (:506), `markGoogleVendorOnboarding` (:470), `googleCallback` Flow A (:634-750) and Flow B (:755-770)
- Test: `server/tests/unit/authGoogleOAuth.test.js` (extend)

**Interfaces:**
- Consumes: `hasCalendarScopes` (Task 1).
- Produces:
  - `attachGoogleToProfile(profileId, tokens, googleUser, { calendarOk: boolean, seedTz?: string })` — when `calendarOk` is false: no token write, no legacy revoke, writes `{ google_calendar_connected: false, calendar_skipped: false, google_id }`, and skips the Google timezone call (`seedTz` is wired in Task 4). When true: today's behaviour unchanged.
  - `markGoogleVendorOnboarding(profileId, username, { calendarOk })` — writes `calendar_skipped: calendarOk` (was hard `true`).
  - Flow B redirects `?google=denied` (instead of `connected`) when `calendarOk` is false.
  - Server event `trackServer(profileId, 'auth_completed', { method: 'google', new: newFlag })` in Flow A; `trackServer(profileId, 'calendar_scope_denied', { source: 'signup'|'onboarding'|'dashboard' })` when denied.

- [ ] **Step 1: Update the test harness** — default `getTokensFromCode` mock returns `scope: 'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.settings.readonly'` so existing tests keep their meaning. Add helper `profileUpdates()` returning every `update()` payload passed on `from('profiles')` chains.
- [ ] **Step 2: Write the failing tests:**
  - `signup without calendar scopes → google_calendar_connected:false, calendar_skipped:false, still mints session, new=1`
  - `signup with full scopes → calendar_skipped:true and google_calendar_connected:true` (pins the Task 2 change to `markGoogleVendorOnboarding`)
  - `existing connected host, tokens without refresh_token and scope 'openid email profile' → no profiles update sets google_calendar_connected:false` (Review Focus 2)
  - `upgraded customer without calendar scopes → calendar_skipped:false written`
  - `calendar_connect without calendar scopes → redirect https://app.test/dashboard?google=denied`
- [ ] **Step 3:** `npx jest tests/unit/authGoogleOAuth.test.js` → new tests FAIL.
- [ ] **Step 4: Implement.** Compute `calendarOk = hasCalendarScopes(tokens)` once per callback. Keep the `needsAttach` guard as is (Review Focus 2). For the upgrade path, include `calendar_skipped: calendarOk` in the attach write. Update the comment above `markGoogleVendorOnboarding` (it currently says calendar is always connected here).
- [ ] **Step 5:** run the whole file → PASS; `npm test` → no new failures.
- [ ] **Step 6: Commit** `fix(auth): only mark calendar connected when Google granted calendar scopes`.

### Task 3: Calendar-connect return path

**Files:**
- Modify: `server/controllers/authController.js` — `googleAuth` (:423) and Flow B redirect
- Modify: `client/src/services/api.js:125` — `getGoogleAuthUrl(returnPath?)`
- Modify: `client/src/context/AuthContext.jsx:187` — `connectGoogleCalendar(returnPath?)`
- Test: `server/tests/unit/authGoogleOAuth.test.js` (extend)

**Interfaces:**
- Produces:
  - `safeReturnPath(p: string) -> string | null` (module-private in authController) — accepts exactly `/dashboard` or `/vendor-register/<slug>/calendar` where slug matches `^[a-z0-9-]{1,40}$`; anything else → `null`.
  - `GET /api/auth/google?return=<path>` puts `ret` in the signed state; Flow B redirects to `${CLIENT_URL}${ret || '/dashboard'}?google=connected|denied`.
  - Client: `getGoogleAuthUrl(returnPath)` sends `{ params: { return: returnPath } }` when given; `connectGoogleCalendar(returnPath)` forwards it.

- [ ] **Step 1: Write the failing tests:**
  - `return=/vendor-register/my-page/calendar → state.ret set; callback redirects https://app.test/vendor-register/my-page/calendar?google=connected`
  - each of `//evil.com`, `https://evil.com`, `/dashboard/../x`, `/vendor-register/x/calendar?next=/y` → no `ret` in state; callback redirects to `/dashboard?google=connected` (Review Focus 3)
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** server + the two client signature changes (existing callers pass nothing → unchanged behaviour).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(auth): calendar connect can return to onboarding`.

### Task 4: Browser timezone fallback

**Files:**
- Modify: `server/controllers/authController.js` — `googleVendorAuth` (:438), `attachGoogleToProfile` timezone block (:577-592)
- Modify: `client/src/services/api.js:129` — `getVendorGoogleUrl` adds `tz`
- Test: `server/tests/unit/authGoogleOAuth.test.js` (extend)

**Interfaces:**
- Produces: `validTz(tz: unknown) -> string | null` (module-private in authController; ≤64 chars and accepted by `new Intl.DateTimeFormat('en', { timeZone })`). `GET /api/auth/google/vendor?tz=<IANA>` carries `validTz(tz)` as `tz` in the signed state; invalid → omitted. `attachGoogleToProfile` uses `seedTz` when calendar is not OK or Google's settings call fails; both paths go through `normalizeSeedTimezone`.
- Client sends `Intl.DateTimeFormat().resolvedOptions().timeZone`.

- [ ] **Step 1: Write the failing tests:**
  - `tz=Europe/London → state.tz === 'Europe/London'`; `tz=Not/AZone → no tz in state`
  - `signup without calendar scopes and state tz Asia/Dubai → availability upsert with timezone 'Asia/Dubai'`
  - `signup without calendar scopes and no tz → availability upsert with timezone 'Asia/Kolkata'`
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(auth): seed host timezone from browser when calendar unavailable`.

### Task 5: Expose calendar state + skip endpoint

**Files:**
- Modify: `server/controllers/authController.js:162` — `serializeProfile` adds `calendar_skipped: !!profile.calendar_skipped`
- Modify: `server/controllers/vendorOnboardingController.js:369` — `getOnboardingStatus` selects and returns `calendarConnected`, `calendarSkipped`
- Modify: `server/routes/vendorOnboardingRoutes.js` — add `POST /skip-calendar`
- Modify: `client/src/services/api.js` (near :384) — `skipCalendar()`
- Test: `server/tests/unit/onboardingCalendarSkip.test.js` (create, following `onboardingClaimSlug.test.js` mocking style)

**Interfaces:**
- Produces:
  - `getOnboardingStatus(vendorId)` → adds `calendarConnected: boolean`, `calendarSkipped: boolean`.
  - `POST /api/onboarding/skip-calendar` (protect) → sets `calendar_skipped=true`, returns `{ ok: true }`; fires `trackServer(id, 'calendar_step_skipped', {})`.
  - Client `skipCalendar() => API.post('/onboarding/skip-calendar')`.

- [ ] **Step 1: Write the failing tests:** status returns both booleans from the row (and `false` when columns null); skip-calendar writes `{ calendar_skipped: true }` for `req.user.id` only.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(onboarding): expose calendar state and allow skipping`.

### Task 6: Calendar onboarding screen

**Files:**
- Create: `client/src/pages/onboarding/CalendarStep.jsx`
- Modify: `client/src/App.jsx:533` — route `/vendor-register/:slug/calendar`
- Modify: `client/src/pages/onboarding/useOnboardingGuard.js:21` — `ORDER = ['claim', 'category', 'preview', 'plan', 'calendar']`
- Modify: `client/src/pages/onboarding/PlansStep.jsx:87` — `goNext` goes to `/calendar` when `needsCalendar(user)`, else `/live`
- Create: `client/src/pages/onboarding/needsCalendar.js`
- Modify: `client/src/services/analytics/events.js` — `CALENDAR_CONNECTED: 'calendar_connected'` (skips are tracked server-side in Task 5)
- Test: `client/src/tests/CalendarStep.test.jsx` (create), `client/src/tests/useOnboardingGuard.test.jsx` (extend)

**Interfaces:**
- Consumes: `connectGoogleCalendar(returnPath)` (Task 3), `skipCalendar()` (Task 5), `user.google_calendar_connected` / `user.calendar_skipped` (Task 5).
- Produces: `needsCalendar(user) -> boolean` = `!user?.google_calendar_connected && !user?.calendar_skipped`.

Screen behaviour: guarded with `useOnboardingGuard`; if `!needsCalendar(user)` on mount and no `?google=` param → `navigate('/vendor-register/:slug/live', { replace: true })`. Copy covers the three reasons (busy times blocked, booking lands on your calendar, Meet link) and "any Google account works". Primary `.mt-btn` "Connect Google Calendar" → `connectGoogleCalendar('/vendor-register/<slug>/calendar')`. Secondary "Skip for now" → `skipCalendar()`, navigate to `/live`. On `?google=connected`: `refreshUser()` (or `getMe` + `updateUser`), track `CALENDAR_CONNECTED {source:'onboarding'}`, success toast, navigate to `/live`. On `?google=denied`: stay, show "Calendar access wasn't granted — tick the calendar boxes on Google's screen, or skip for now." Return handler guarded by a `useRef` (StrictMode).

- [ ] **Step 1: Write the failing tests:**
  - guard: `stepCompleted 6 at /calendar → ready`; `stepCompleted 5 at /calendar → redirect to /plan`
  - `needsCalendar`: connected → false; skipped → false; neither → true
  - CalendarStep: `already connected, no ?google → navigates to /live` (Review Focus 5)
  - `?google=connected → navigates to /live once` even when rendered in `<StrictMode>` (Review Focus 5)
  - `?google=denied → shows the not-granted message and both buttons`
  - `Skip for now → calls skipCalendar then navigates to /live`
  - PlansStep: `goNext with user needing calendar → /calendar` (extend `PlansStep.test.jsx`)
- [ ] **Step 2:** `cd client && npx vitest run src/tests/CalendarStep.test.jsx src/tests/useOnboardingGuard.test.jsx src/tests/PlansStep.test.jsx` → FAIL.
- [ ] **Step 3: Implement.** Run the BRAND_RULES checklist on the new screen.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Commit** `feat(onboarding): calendar step before going live`.

### Task 7: Dashboard nudge + denied toast

**Files:**
- Modify: `client/src/lib/hostNudges.js` — new `calendar` nudge
- Modify: `client/src/pages/Dashboard.jsx` (:137 `buildNudges` ctx; :168-178 `?google=` handler; card CTA)
- Modify: `server/controllers/hostNudgeController.js:16` — add `'calendar'` to `DISMISSIBLE`
- Test: `client/src/tests/hostNudges.test.js` (create or extend), existing server nudge test if present

**Interfaces:**
- Produces: `buildNudges` ctx key `calendarConnected: boolean`; when `isHost && !calendarConnected` push `{ key: 'calendar', priority: 75, dismissible: true, tone: 'primary', icon: 'CalendarCheck', title: 'Connect your calendar so guests never book you when you're busy', cta: 'Connect', action: 'connectCalendar', to: null }`. Dashboard runs `connectGoogleCalendar('/dashboard')` for `action === 'connectCalendar'`. `?google=denied` → error toast "Calendar access wasn't granted. Tick the calendar boxes on Google's screen and try again." The existing `?google=connected` handler also tracks `CALENDAR_CONNECTED { source: 'dashboard' }` (ProfileSetup's connect returns to `/dashboard`, so it is covered).

- [ ] **Step 1: Write the failing tests:** calendar nudge present when not connected, absent when connected; ranks below `upgrade` (80) and above `share` (70); server dismiss accepts `calendar`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(dashboard): calendar nudge in Next step`.

### Task 8: Existing-host scope audit script

**Files:**
- Create: `server/scripts/auditCalendarScopes.js`

**Interfaces:**
- Consumes: `hasCalendarScopes` (Task 1), `profileSecrets` token read, `decryptToken`, googleapis `OAuth2.getAccessToken()` + `getTokenInfo(accessToken)` (returns `scopes: string[]`).
- Produces: `node scripts/auditCalendarScopes.js` prints `host_id, email, status (ok|missing_scopes|token_error)` for every host with `google_calendar_connected=true`; `--apply` sets `google_calendar_connected=false, calendar_skipped=false` for `missing_scopes` and `token_error` rows only.

- [ ] **Step 1: Implement** (map `getTokenInfo().scopes` to `{ scope: scopes.join(' ') }` and reuse `hasCalendarScopes`). Dry-run is the default.
- [ ] **Step 2: Verify** `node -e "require('./scripts/auditCalendarScopes.js')"` loads without running when required (guard with `require.main === module`).
- [ ] **Step 3: Commit** `chore(scripts): audit stored calendar scopes`. Running it against the live DB (dry run, then `--apply`) is a founder-approved step after merge — list it in the PR body.

### Task 9: Phase 1 PR

- [ ] Update `docs/current-work.md` (what changed) and `docs/feature-map.md` (CalendarStep, skip-calendar, audit script).
- [ ] `cd server && npm test` → pass (report only pre-existing failures); `cd client && npm test && npm run build` → pass.
- [ ] Push branch; `gh pr create --base release/2026-11` with summary, test plan (manual: Google signup unticking calendar → calendar screen → connect → Live), and the post-merge audit-script step. Stop at the PR.

---

# Phase 2 — LinkedIn host login (branch `feat/host-linkedin-login`, after Phase 1 merges)

### Task 10: Feature flag

**Files:**
- Create: `server/migrations/v3.186_host_linkedin_login_flag.sql` (pattern: `v3.35_unified_login_flag.sql`)
- Modify: `server/config/featureRegistry.js` (next to `unified_login`, :67)

**Interfaces:**
- Produces: flag key `host_linkedin_login`, label `LinkedIn host login`, category `Auth`, scope `both`, seeded `enabled=false`, `ON CONFLICT (key) DO NOTHING`.

- [ ] **Step 1:** write migration + registry entry.
- [ ] **Step 2:** `npm test` (featureFlags/featureRegistry tests) → pass.
- [ ] **Step 3: Commit** `feat(flags): host_linkedin_login (off)`. Applying the migration to the live DB: ask the founder first; apply **before** merging (the registry boot upsert would otherwise seed it enabled).

### Task 11: Shared new-host side effects

**Files:**
- Modify: `server/controllers/authController.js` — extract from Flow A (:680-718)
- Test: existing `authGoogleOAuth.test.js` must stay green (pure refactor)

**Interfaces:**
- Produces: `onNewHostCreated({ profile, email, method: 'google'|'linkedin', statePayload, req }) -> Promise<void>` — callers still seed onboarding themselves; this runs `maybeStampInvite`, `trackServer user_registered` + `lead_captured` with `{ method, role: 'host' }`, `VENDOR_WELCOME`, `safeUpsertLead({ source: 'host_signup', attribution: statePayload?.att })`. Never throws.

- [ ] **Step 1:** extract; Flow A calls `onNewHostCreated({ ..., method: 'google' })`.
- [ ] **Step 2:** `npx jest tests/unit/authGoogleOAuth.test.js` → PASS unchanged; add one assertion that `trackServer` got `method: 'google'`.
- [ ] **Step 3: Commit** `refactor(auth): shared new-host side effects`.

### Task 12: Google door refuses calendar-only accounts

**Files:**
- Modify: `server/controllers/authController.js` Flow A, before `admin.createUser`
- Test: `authGoogleOAuth.test.js` (extend)

**Interfaces:**
- Produces: when no profile matches the email **and** a host profile has `google_id = googleUser.id`, redirect `${CLIENT_URL}/login-as-vendor?error=calendar_account` and create nothing.

- [ ] **Step 1: Failing test** `new email but google_id attached to another host → redirect error=calendar_account, createUser not called`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `fix(auth): calendar Google account can't create a duplicate host`.

### Task 13: `POST /api/auth/linkedin/host`

**Files:**
- Modify: `server/controllers/authController.js` — new `linkedinHostAuth`
- Modify: `server/routes/authRoutes.js` — `router.post('/linkedin/host', protect, authLimiter, requireFeature('host_linkedin_login'), linkedinHostAuth)`
- Test: `server/tests/unit/authLinkedinHost.test.js` (create; reuse the supabase mock style from `authGoogleOAuth.test.js`, with `auth.admin.getUserById`)

**Interfaces:**
- Consumes: `onNewHostCreated` (Task 11), `enableHostingForProfile`, `upsertProfile`, `markGoogleVendorOnboarding(id, username, { calendarOk: false })`, `serializeProfile`, `reconcileBadges`, Task 4's tz validation (extract it as `validTz(tz) -> string|null` in Task 4 if not already).
- Produces: body `{ intent?: 'signup'|'login', invite?: string, att?: object, tz?: string }`; responses:
  - `200 { profile, new: '1'|'upgrade'|'0' }`
  - `400 { code: 'no_linkedin_identity' }` — auth user has no `linkedin_oidc` identity (same lookup as `verifyLinkedin` :1411-1418)
  - `403 { code: 'superadmin' }`
  - `409 { code: 'email_has_account' }` — no profile for `req.user.id` but a profile with the same email exists (Review Focus 4)
  - Always stamps `linkedin_verified_at` + `linkedin_sub` (schema fallback as in `verifyLinkedin`), calls `reconcileBadges`, fires `trackServer('auth_completed', { method: 'linkedin', new })`. New host: name/avatar from `identity_data` (`name`, `picture`), `role: 'host'`, availability timezone from `validTz(tz)` → `normalizeSeedTimezone`.

- [ ] **Step 1: Failing tests:** new host → creates profile, onboarding step 1 with `calendar_skipped:false`, `onNewHostCreated` called with `method:'linkedin'`, `new:'1'`; existing host → `new:'0'`, no create; existing customer → `enableHostingForProfile`, `new:'upgrade'`; superadmin → 403; no identity → 400; same email different id → 409 and no profile insert; flag off → 503 (via `requireFeature`).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** confirm `accountGate` in `authMiddleware.js` tolerates a user with no profile row (null → not banned/revoked); add a test there if it doesn't already.
- [ ] **Step 4: Commit** `feat(auth): LinkedIn host sign-in endpoint`.

### Task 14: Client LinkedIn sign-in + return page

**Files:**
- Modify: `client/src/context/AuthContext.jsx` — `startLinkedinHostAuth(intent)`
- Modify: `client/src/services/api.js` — `linkedinHostAuth(body, token)`
- Create: `client/src/pages/LinkedinAuthDone.jsx`; route `/auth/linkedin/done` in `App.jsx` next to `/auth/google/done`
- Test: `client/src/tests/LinkedinAuthDone.test.jsx` (create)

**Interfaces:**
- Produces:
  - `startLinkedinHostAuth(intent)`: tracks `SIGNUP_STARTED` for signup; stores `{ intent, invite: readInvite(), att: getAttribution(), tz }` in `sessionStorage['li_host_auth']`; if a session exists, signs out first (door-crossing rule); `sb.auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo: origin + '/auth/linkedin/done' } })`.
  - `linkedinHostAuth(body, token) => API.post('/auth/linkedin/host', body, { headers: { Authorization: 'Bearer ' + token } })`.
  - `LinkedinAuthDone`: reads `code` (query) → `exchangeCodeForSession`, or `access_token`/`refresh_token` (hash); reads + clears `li_host_auth`; calls `linkedinHostAuth` **before** `adoptSession` (getMe needs the profile); then `adoptSession({ token, refresh_token })` and routes like `GoogleAuthDone.jsx` by `new`. Errors: 409 → `/login-as-vendor?error=email_has_account`, 503 → `?error=linkedin_off`, other → `?error=auth_failed`. Ref-guarded for StrictMode.
- Builder confirms whether the shared Supabase client needs `flowType: 'pkce'`; if changed, re-test the Dashboard LinkedIn verify (`linkIdentity`) flow.

- [ ] **Step 1: Failing tests:** code in query → exchange then API then adoptSession in that order; 409 → navigates to `error=email_has_account`; new=1 → onboarding route; runs once in StrictMode.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** `feat(auth): LinkedIn host sign-in on the client`.

### Task 15: Buttons, error copy, docs, PR

**Files:**
- Create: `client/src/components/ContinueWithLinkedIn.jsx` (design-system button; hidden unless `useFeature('host_linkedin_login')`)
- Modify: `HostLogin.jsx` (login), `onboarding/GoogleStart.jsx`, `BecomeAHost.jsx`, `Home.jsx` hero, `InviteLanding.jsx` (signup) — render next to the Google button
- Modify: `HostLogin.jsx` error map — `calendar_account`: "This Google account is connected as a calendar to an existing host. Sign in with LinkedIn instead."; `email_has_account`: "This email already has a host account. Sign in with Google."; `linkedin_off`: "LinkedIn sign-in isn't available right now."; plus line "Already a host? Use the same option you signed up with."
- Modify: `CLAUDE.md` Product Rules (host login: Google or LinkedIn), `docs/feature-map.md`, `docs/ai-context.md`, `docs/current-work.md`
- Test: `client/src/tests/ContinueWithLinkedIn.test.jsx` — hidden when flag off, calls `startLinkedinHostAuth(intent)` when on

- [ ] **Step 1:** failing test → implement → PASS.
- [ ] **Step 2:** `cd server && npm test`; `cd client && npm test && npm run build`.
- [ ] **Step 3:** PR `--base release/2026-11`. PR body lists founder steps: apply v3.186 (before merge); Supabase redirect allowlist `/auth/linkedin/done` (prod + localhost); live test with a LinkedIn account whose email matches an existing host → same account; then flip `host_linkedin_login` ON. Stop at the PR.
