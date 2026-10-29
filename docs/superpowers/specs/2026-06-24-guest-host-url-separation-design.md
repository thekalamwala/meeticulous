# Guest / Host URL Separation

**Date:** 2026-06-24
**Branch:** `feat/guest-host-url-separation`
**Status:** Approved design → planning
**Supersedes:** the account-model decision in [2026-06-23-account-role-separation-design.md](2026-06-23-account-role-separation-design.md) (unified + opt-in → **separate, one-identity-one-type**).

## Problem

A logged-in **guest** can still navigate into the **host** URL space. The server already
blocks host *APIs* for guests (`requireHost`, PR #134), but the **client** does not block host
*routes*: typing `domain.com/dashboard/bookings` renders the host dashboard shell for a guest
(its API calls then 403, producing a broken page rather than a redirect).

The founder's decision: guest and host are **separate accounts, one identity = one type**.
- **Guest** identity = phone / WhatsApp number (phone-OTP, auto-created at booking).
- **Host** identity = email (Google auth).

This is already enforced at signup (`registerUser` rejects host emails; `registerVendor`/Google
rejects guest emails; `profiles_phone_unique_idx` makes phone globally unique). This work
enforces the same separation at the **routing / navigation** layer and gives guests their own
URL namespace.

### Already in place (not part of this work)
- Server role guard `requireHost` on all `/api/host/*`, `/api/services` mutations, etc. (live).
- Auth-key separation at registration (phone=guest, email=host).
- Navbar already swaps nav sets by `user.role === 'host'` — guests don't *see* host links;
  only direct URL entry leaks.

## Decisions (from brainstorming)

1. **Account model:** **Separate, one identity = one type.** No account holds both capabilities.
   Reverses decision #2/#3 of the 2026-06-23 spec.
2. **Wall is two-way.** Guests are bounced out of host space; hosts are bounced out of guest space.
3. **Guest URLs are namespaced under `/user/*`.**
4. **`become-host` in-place role flip is removed.** "Become a host" routes to host signup
   (a separate email/Google account), never a role flip.
5. **The leave-review page stays shared** (role-agnostic, ownership-checked) — not namespaced.

## Architecture

### A. Guest URL namespace (`/user/*`)

| Old (flat) | New |
|---|---|
| `/my-bookings` | `/user/my-bookings` |
| `/profile` | `/user/profile` |
| `/reviews` | `/user/reviews` |
| `/loyalty` | `/user/loyalty` |

`/review/:bookingId` (leave-a-review, reached from the booking-completed email) **stays at its
current top-level path** and stays role-agnostic — it is a per-booking, ownership-checked action
that either party to a booking may use. Namespacing it would risk breaking host-side review CTAs
and would force an immediate server email change. Out of the `/user` namespace by design.

### B. Role-aware route guards (the wall)

Define host space as `role ∈ { host, superadmin }`; guest space as any other authenticated user.
Both spaces still require login first (existing `ProtectedRoute` behavior is preserved — unauth
→ `/login?redirect=…`).

Two small wrappers (composing the existing `ProtectedRoute`), so the redirect target is explicit
per space:

- **`HostRoute`** wraps `/dashboard/*`. Auth required. If `role ∉ {host, superadmin}` → redirect
  to the guest equivalent (table below).
- **`GuestRoute`** wraps `/user/*`. Auth required. If `role ∈ {host, superadmin}` → redirect to
  `/dashboard`.

The existing host **onboarding-resume** logic inside `ProtectedRoute` (incomplete-onboarding host
→ `/vendor-register/:slug/:step`) is retained and runs only for hosts who pass the host guard.

**Guest → host-URL redirect map** (only `/dashboard/*` paths a guest could type):

| Guest hits | → |
|---|---|
| `/dashboard/bookings` | `/user/my-bookings` |
| `/dashboard/profile` | `/user/profile` |
| `/dashboard` and every other `/dashboard/*` (earnings, services, service/*, availability, products, upgrade, payments/*, feedback) | `/user/my-bookings` (no guest equivalent → guest home) |

**Host → guest-URL redirect:** any `/user/*` → `/dashboard`.

### C. Backward-compatibility redirects (mandatory)

Already-sent emails, bookmarks, and `robots.txt`/sitemap reference the old flat paths. Keep them
working:

- `App.jsx`: add `<Route path="/my-bookings" element={<Navigate to="/user/my-bookings" replace />} />`
  and the same for `/profile`, `/reviews`, `/loyalty`. These run **before** the `/:profileSlug`
  catch-all (same ordering constraint as today).
- A guest who lands on an old flat path is forwarded to `/user/*`; a host on an old flat path is
  forwarded by `GuestRoute` to `/dashboard`. (Old path → Navigate → GuestRoute handles role.)

### D. Remove the in-place `become-host` opt-in

The flip contradicts one-identity-one-type (a phone-guest cannot become an email-host by toggling
a column).

- `client/src/pages/Dashboard.jsx`: the guest "Want to offer services? / Become a host" action no
  longer calls `activateHost()`. It links to `/be-a-sloth` (host signup with a separate account).
- `client/src/pages/BeASloth.jsx`: when a logged-in **guest** views it, the CTA starts the
  **host Google signup** (separate account) rather than `activateHost()`. A logged-in **host**
  still routes to `/dashboard`.
- `client/src/context/AuthContext.jsx`: remove the `activateHost` helper (and its export from
  context value + the `api.js` import).
- `client/src/services/api.js`: remove `activateHost` (`POST /auth/become-host`).
- Server `POST /api/auth/become-host`: **remove** the route (`authRoutes.js`) and the `becomeHost`
  handler (`authController.js`). Nothing calls it after this change, and a live role-flip endpoint
  is an unnecessary surface under the separate-account model.
- Update affected tests: `client/src/tests/AuthContext.test.jsx` (drops the `activateHost`
  describe block + mock).

### E. Server / static references to update (forward-looking)

These emit or list the **old** guest paths; update them so new output uses `/user/*` (old paths
still redirect for in-flight emails):

- `server/services/email/emailLayout.js` — footer link `/my-bookings` → `/user/my-bookings`.
- `server/tests/unit/emailLayout.test.js` — assertion `…/my-bookings` → `…/user/my-bookings`.
- `client/public/robots.txt` — `Disallow: /my-bookings`, `/loyalty` → `/user/my-bookings`,
  `/user/loyalty`.
- `server/services/sitemapService.js` — **remove** the `/reviews` static entry. It points at the
  auth-gated `CustomerReviews` page (a guest's own received reviews — different login, never
  public). Public review content stays indexed via the per-host-profile pages
  (`/:profileSlug`), which the dynamic sitemap already covers. Auth-gated `/user/*` pages are
  never added to the sitemap.
- `client/src/pages/Login.jsx` — default post-login redirect `"/my-bookings"` → `"/user/my-bookings"`.
- In-app links to update: `Navbar.jsx` (CUSTOMER_NAV, CUSTOMER_DROPDOWN), `CustomerProfile.jsx`
  ("← Back to bookings"), `ReviewPage.jsx` (two "back to bookings" links).

`server/controllers/bookingController.js:617` (`review_url = …/review/${id}`) is **unchanged** —
the leave-review page keeps its path (decision A).

### F. Data / migration

**None.** No schema change, no role backfill. Pure routing/UI.

### G. Testing

- **Client guard tests** (Vitest, `MemoryRouter`):
  - Guest at `/dashboard/bookings` → redirected to `/user/my-bookings`.
  - Guest at `/dashboard/earnings` (no equivalent) → `/user/my-bookings`.
  - Host at `/user/my-bookings` → `/dashboard`.
  - Unauth at `/dashboard/*` and `/user/*` → `/login?redirect=…` (existing behavior preserved).
  - Old `/my-bookings` → `/user/my-bookings`; old `/profile` → `/user/profile`.
  - Host with incomplete onboarding still resumes onboarding (existing test stays green).
- **Become-host removal:** `AuthContext.test.jsx` updated; no test asserts the old flip.
- **Server:** `emailLayout.test.js` updated to new path. Full suites stay green:
  `cd server && npm test`, `cd client && npm test`.

### H. Rollout

Additive, client-led. Server email/robots/sitemap path updates can deploy in the same release.
Old flat routes redirect indefinitely (cheap), so no email/bookmark breakage. No feature flag —
the wall must not be toggleable (flag-off reopens the leak).

## Out of scope

- Capability-flag refactor (`is_host`/`is_guest`) — the single `role` enum stays.
- Booking-ownership checks (separate issue; those routes remain role-agnostic).
- "Stop being a host" / host→guest downgrade.
- Any change to host (`/dashboard/*`) internal structure beyond the entry guard.
- Admin space (`/super-dashboard`, `/admin/*`) — separate session, untouched.

## Risk summary

Low. Client routing + link renames + two guard wrappers + redirects; no DB change; server change
limited to path strings in email/robots/sitemap. Main risks: (1) a guest path missed in the link
sweep (mitigated by the grep-backed file list in §E); (2) redirect-ordering regressions vs the
`/:profileSlug` catch-all (mitigated by placing redirect routes before it, as today); (3) the
onboarding-resume host flow accidentally broken (mitigated by retaining `ProtectedRoute`'s resume
logic and its existing test).
