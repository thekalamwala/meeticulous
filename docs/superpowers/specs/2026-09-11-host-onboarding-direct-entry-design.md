# Host Onboarding — Direct-Entry Revamp

**Date:** 2026-09-11
**Status:** Design (awaiting review) — no code yet
**Author:** Claude Opus 4.8 + founder
**Branch:** `docs/onboarding-direct-entry-spec`

---

## 1. Problem

Host onboarding today is a **4-screen wizard wall**: after Google auth a host is
forced through `claim → category → preview → live` before they can touch the
product. The dashboard is unreachable until the wizard is finished (a redirect in
`ProtectedRoute` bounces incomplete hosts back into `/vendor-register/:slug/…`).

We want the **"pro" pattern**: host lands **directly in their dashboard** after Google
auth, with a fully valid (if empty) account, and completes detail **later, optionally**,
via a dashboard checklist — never a wall.

## 2. The key insight (why this is small)

**The backend already does provision-then-nudge.** On the very first Google sign-in a
brand-new host is already fully provisioned — nothing new needs building at the data
layer:

- `authController.js` Flow A (`flow==="vendor_auth"`, `:573-627`) creates the auth user,
  then `upsertProfile({ role:"host", … })` (`:602-611`). The `sync_host_role` trigger
  mirrors `role='host' → is_host=true` (`v3.34_host_capability.sql:18-25`).
- **An auto-slug is already assigned**: `upsertProfile` calls
  `usernameService.createInitialUsername()` → `{adjective}-{noun}-{suffix}`, written to
  `profiles.username` and recorded in `username_history` as `source='auto'`
  (`usernameService.js:82-101`).
- Onboarding is seeded: `markGoogleVendorOnboarding` sets `onboarding_slug=username`,
  `onboarding_step_completed=1`, `onboarding_completed=false`, `calendar_skipped=true`
  (`authController.js:417-434`).

So the account, the host role, and the auto-slug **already exist the instant Google auth
returns.** The wizard is a client-side wall in front of an account that is already valid.

**Therefore the revamp is mostly deletion + un-gating**, plus: relocating two side-effects
(free-plan activation, completion), reseeding the existing auto-slug from the display name
(§5.4), one soft category modal reusing an existing picker (§5.5), and one SEO guardrail
(§5.6). No new tables. No migration required (see §8).

## 3. Goals / Non-goals

**Goals**
- Google auth → land on `/dashboard` immediately. No wizard.
- Empty account is valid: no slug-choosing, no category, no service required to be "in".
- Detail is completed later via a dashboard **Finish-setup checklist** (already exists).
- A host becomes publicly **live implicitly** when they have ≥1 active service (existing
  discovery semantics — no publish button, no `is_published` flag).
- Empty (zero-service) host profiles must **not** leak into the index (protect the
  Soft-404 work currently in flight).

**Non-goals**
- No paywall changes — every host stays on the free `explorer` plan at entry (unchanged
  policy, just relocated).
- No KYC/payout changes — payouts stay gated on KYC.
- No slug-purchase / premium-name flow.
- No `is_published` column (YAGNI — `services.is_active` already is the publish/hide
  mechanic).

## 4. Current state (cited facts this design depends on)

| Area | Fact | Source |
|---|---|---|
| The wall | Incomplete host at `/dashboard` is redirected into the wizard | `ProtectedRoute.jsx:71-76` |
| Resume map | `RESUME` map + per-step guard drive the wizard | `useOnboardingGuard.js` |
| Wizard routes | `claim/category/category-all/preview/plan/live` | `App.jsx:452-458` |
| Provisioning | Host + auto-slug + onboarding seed on Google auth | `authController.js:573-627`, `:417-434` |
| Onboarding status | `getOnboardingStatus` → `{slug, stepCompleted, isComplete, name, profileImage, primaryCategory}` from `profiles` | `vendorOnboardingController.js:368-387` |
| Completed flag | `onboarding_completed=true` written **only** by `markComplete`, gated on active plan + non-null `primary_category` | `vendorOnboardingController.js:329-361` |
| Free plan | `activateFreePlan` sets `plan='explorer'` (called today in PreviewStep) | `vendorOnboardingController.js:319-325` |
| First service | `ExploreWithBolt` `svcCreate` with defaults `service_type/meeting_mode='online'`, title-seeded descriptions, `feeOnly→₹0`, profession category load | `ExploreWithBolt.jsx:103-132` |
| Dashboard checklist | `checklist` array (`photo/profile/service/pricing/gcal/verify/whatsapp`) + completion meter + "Finish setup" card **already exist** | `Dashboard.jsx:246-260`, `:544-586` |
| Profile-URL prompt | "Set up your public profile / Add a username" card already exists | `Dashboard.jsx:385-437` |
| Live hero | "You're live! 🎉 share your link" hero when live host has a service + 0 bookings | `Dashboard.jsx:277-319` |
| Auto-slug seed (today) | `createInitialUsername()` seeds `{adjective}-{noun}-{suffix}` via `generateUnique` (loops until free; checks history-uniqueness + reserved + adult filter) | `usernameService.js:82-101` |
| Slug change (later) | `change_username` RPC gated: `whatsapp_verified` required, `<2` changes/365d, `≥6mo` gap | `v3.33_reserved_slugs.sql:85-118` |
| Category picker (search+add) | `CategoryStep` = live substring filter + "Add" row when typed value isn't listed → `suggestCategory()` (returns `pending`/`added`, auto-selects) → `saveOnboardingPersona` | `CategoryStep.jsx:49-96` |
| Sitemap gate | Hosts listed on `is_verified AND is_indexable AND NOT is_banned AND username` — **never on service count** | `sitemapService.js:161-185` |
| Robots meta | Host-profile `noindex` derived **only** from `is_indexable` — never from service count | `seo.js:117-118`, `prerenderController.js:175` |
| Empty profile | Zero-service host renders a 200 "No services available yet." page — thin/soft-404 shape, no noindex | `HostProfile.jsx:749-753`, `hostController.js:272-323` |

## 5. Proposed design

### 5.1 Entry — kill the wall, keep the provisioning

Provisioning is unchanged (§2). The change is what happens **after** auth returns:

- **`ProtectedRoute` no longer force-resumes.** Delete the redirect block
  (`ProtectedRoute.jsx:71-76`) and the `RESUME` import. An authenticated host always
  lands on `/dashboard`. Onboarding-status becomes checklist *data*, not a redirect
  trigger.
- **Relocate free-plan activation to provisioning.** Move `activateFreePlan`'s effect
  (`plan='explorer'`) into the provisioning path (`authController.js` Flow A + the
  `enableHostingForProfile` upgrade path) so every host has the free plan from birth —
  today PreviewStep does this, and PreviewStep is going away.
- **Retire `onboarding_completed` as a gate.** Nothing bounces on it once the redirect is
  gone. Set `onboarding_completed=true` at provisioning (bypassing `markComplete`'s
  plan+category gate, which no longer fits a deferred-detail model). `getOnboardingStatus`
  stays (feeds the checklist), but `isComplete` is no longer load-bearing for routing.

### 5.2 The wizard screens → soft category modal + dashboard checklist

The 4 wizard screens don't die — their functionality splits between **one soft modal**
(category, §5.5) and the **dashboard checklist that already exists** (`Dashboard.jsx:246-260`).
Mapping:

| Wizard screen | Becomes | Reuse |
|---|---|---|
| SlugClaim | **removed** — slug is auto-assigned from name (§5.4), no claim step | — |
| PersonaStep / CategoryStep | **soft category modal** over the live dashboard (§5.5) | `CategoryStep` search+select+add UX (`getCategories`/`suggestCategory`/`savePersona`) |
| PreviewStep (booking_type, tagline, WhatsApp) | folded into `/dashboard/profile` + WhatsApp checklist item | `saveDetails`, existing `WhatsAppVerify` component |
| ExploreWithBolt (first service) | "Add a service" checklist item (already present) | preserve `svcCreate` defaults, profession category load, `SERVICE_PUBLISHED {source:'onboarding'}` analytics |

The checklist items for profile / service / WhatsApp already exist — no "Claim your URL"
item is added (slug is automatic). Crossing the **"Add a service"** item is the moment the
host goes live (§5.3).

**Delete** the wizard route components + routes (`App.jsx:452-458`), `OnboardingStepper`,
`useOnboardingGuard`/`RESUME`, `SlugClaim`, and the exit-door/`cancelHosting` half-host
patch (an always-valid account can't be a trapped half-host, so the patch is dead weight).
`CategoryStep`'s picker body is extracted for reuse in the modal (§5.5); its standalone
route is removed.

### 5.3 Publish = implicit (no flag)

A host is "live" when they have ≥1 `is_active` service — the existing discovery gate
(`exploreController.js:105`). Nothing to toggle:
- **Publish** = a service is `is_active:true` (already the default on create).
- **Hide** = deactivate services (`hostController.js:700`, already exists).

The "You're live! 🎉" hero (`Dashboard.jsx:277-319`) already fires exactly on this
condition — no work.

### 5.4 Slug — fully automatic, no claim step

There is **no slug-choosing step anywhere**. At provisioning the slug is auto-assigned from
the host's **Google display name**:

- Seed = `slugify(name)` (lowercase, spaces/punct → `-`, strip unsafe chars).
- **Collision ladder:** `base` → `base-host` → `base-2` → `base-3` … first free wins.
- Each candidate is checked against the existing machinery `generateUnique` already runs:
  history-uniqueness (`username_history`), reserved namespace (L1 + L2), adult-content
  filter. So an unavailable/reserved/blocked base just advances the ladder.
- **Fallbacks:** name missing/empties-to-nothing after slugify → email local-part as the
  seed; if that also empties → the current `{adjective}-{noun}` random seed. Never fail
  provisioning on slug.

Implementation = change the **seed** passed into `createInitialUsername()`/`generateUnique`
(`usernameService.js:82-101`) from adjective-noun to name-based, plus the `-host`/`-N`
ladder. Everything downstream (history record `source='auto'`, `onboarding_slug`) is
unchanged.

A host who wants a custom URL later still uses `change_username` with its normal gates
(`v3.33_reserved_slugs.sql:85-118`) — that path is untouched and simply isn't part of
onboarding anymore.

> Note: name is already shown publicly on the profile, so a name-based public URL leaks no
> new PII (this is why we chose name over email local-part as the seed).

### 5.5 Soft category modal (the "21st" pattern)

A single **dismissible modal that floats over the already-loaded dashboard** — never a wall.
Collects one thing: the host's **category / profession** (we need `primary_category` for
explore + category pages; it's the one detail worth an active prompt).

- **Trigger:** shown once on dashboard load when `primary_category` is null. Dismissible
  (X / "skip for now"); a dismissed host still reaches everything and can set category later
  from the checklist. Suppressed after set or dismiss (a `localStorage` seen-flag is enough;
  the real gate is `primary_category != null`).
- **Content:** reuse `CategoryStep`'s **search + select + add-new** body — live substring
  filter over `getCategories`, and when the typed value isn't listed an "Add" row calls
  `suggestCategory()` (returns `pending` for admin review or `added`, then auto-selects)
  (`CategoryStep.jsx:49-96`). Extract that picker into a small reusable component so both the
  modal and the checklist item render it.
- **Persist:** `savePersona` (`POST /save-persona`) — already writes
  `primary_category` + `categories`.
- **Style:** match the screenshots — centered card, brandmark, progress dots if we later add
  steps (single step for now, so dots optional). No attribution field, no use-case split
  (every host is "work").

> YAGNI: kept to one step (category). "Where did you hear about us" / multi-step survey is
> deliberately out — no attribution column exists and BAS doesn't need the work/personal/edu
> split. Easy to add a second step later if marketing wants attribution.

### 5.6 SEO guardrail — do NOT index empty profiles

This is the **one net-new piece of logic** and it's small. Because visibility keys off
`is_verified/is_indexable` and robots off `is_indexable` — **never service count** —
an empty auto-provisioned host could render an indexable thin page. Two guards:

1. **Robots meta:** emit `noindex,nofollow` for a host profile with **zero active
   services**, in both paths that must stay in sync ([[profile-aeo-schema]] — two JSON-LD
   paths):
   - client `seo.js:resolveProfileSeo` (`:117-118`)
   - server `prerenderController.js:resolveProfileMeta` (`:175`)
2. **Sitemap:** add a "has ≥1 active service" filter to `sitemapService.fetchHosts`
   (`:161-185`) so empty hosts never enter `sitemap-hosts.xml` (and therefore never enter
   the prerender set, which is sitemap-driven — `prerender.mjs:223-225`).

> Open item: confirm the DB defaults for `is_verified` / `is_indexable` at provisioning
> (`upsertProfile` sets neither). If `is_verified` defaults `false`, empty hosts are
> already out of the sitemap and guard (2) is belt-and-suspenders; guard (1) is required
> regardless. (§10)

## 6. Components (units + responsibilities)

- **`authController` provisioning** — now also: activate free plan, set
  `onboarding_completed=true`. (already creates host + auto-slug)
- **`usernameService.createInitialUsername`** — seed the auto-slug from the Google display
  name with the `-host` / `-N` ladder instead of adjective-noun (§5.4).
- **`ProtectedRoute`** — drop onboarding force-resume; auth + role only.
- **Category modal** — new small component wrapping the extracted `CategoryStep` picker;
  shown over `/dashboard` when `primary_category` is null; persists via `savePersona`.
- **`Dashboard` checklist** — wire existing items to existing endpoints (`savePersona`,
  `saveDetails`, `svcCreate`, WhatsApp verify). No slug item.
- **SEO robots (`seo.js` + `prerenderController.js`)** — noindex zero-service hosts.
- **`sitemapService.fetchHosts`** — require ≥1 active service.
- **Deletions** — wizard routes/components, `OnboardingStepper`, `useOnboardingGuard`,
  `RESUME`, `SlugClaim`, exit-door/`cancelHosting`. `CategoryStep` route removed (picker
  extracted into the modal).

## 7. Data flow

```
Google auth (vendor_auth)
  └─ authController Flow A:
       create auth user → upsertProfile(role=host)  [is_host via trigger]
       auto-slug = slugify(name) → -host → -N       ← name-seeded (source='auto')
       activateFreePlan (plan='explorer')          ← relocated from PreviewStep
       onboarding_completed = true                 ← set here, not via markComplete
  └─ redirect → /dashboard   (ProtectedRoute no longer bounces)

/dashboard
  └─ soft category modal if primary_category is null (dismissible) → savePersona
  └─ getOnboardingStatus + profile/services → checklist state (data only)
  └─ checklist items (all optional):
       Pick category → savePersona          (also the modal)
       Add service → svcCreate  ── crossing this ⇒ is_active service ⇒ LIVE + share hero
       Complete profile / WhatsApp → saveDetails / WhatsAppVerify
       KYC → (unchanged; gates payouts only)
  (no slug step — URL already assigned; custom URL later via change_username, gated)

Public /:slug
  └─ 0 active services ⇒ noindex + absent from sitemap   ← new guardrail
  └─ ≥1 active service ⇒ index,follow + in sitemap
```

## 8. Migration

**None required.** All columns used (`onboarding_*`, `plan`, `primary_category`,
`is_active`, `is_verified`, `is_indexable`, `username_history.source`) already exist. This
is code-only: relocations, deletions, two robots checks, one sitemap filter.

## 9. Testing

Client deploy gate = **full vitest must pass** ([[deploy-gate-full-vitest-and-prerender-403]]),
so touched/renamed tests are release-blocking — run `npx vitest run` before the client PR.

- **Guard:** `RouteGuards.test.jsx` / `useOnboardingGuard.test.jsx` / `onboardingResume.test.jsx`
  — rewrite/delete for "host always reaches /dashboard, no resume redirect."
- **Provisioning:** assert a fresh Google host lands with `plan='explorer'` +
  `onboarding_completed=true` + a name-seeded slug (extend `AuthContextBecomeHost.test.jsx`).
- **Slug ladder (new):** `slugify(name)` free → `base`; taken → `base-host`; both taken →
  `base-2`; reserved/adult base → advances ladder; empty name → email/random fallback.
  One small unit test on `createInitialUsername`.
- **SEO guardrail (new):** host with 0 active services → `noindex`; ≥1 → `index`. Assert on
  both `seo.js` and the prerender meta. Assert `fetchHosts` excludes zero-service hosts.
- **Category modal:** shown when `primary_category` null; search filters; typing an unlisted
  value shows the Add row → `suggestCategory`; select → `savePersona`; dismiss suppresses it.
- **Delete/repoint** wizard-step tests: `SlugClaim`, `PlansStep`, `plansStepEmptyFallback`,
  `onboardingFirstService` → delete. `CategoryStep.test.jsx` → repoint to the extracted
  picker / modal (the picker survives, the route doesn't).

## 10. Open questions (resolve at implementation, non-blocking)

1. **`is_verified` / `is_indexable` defaults** at provisioning — confirm (§5.6). Guard (1)
   is required either way; guard (2) may be redundant if `is_verified` defaults false.
2. **`onboarding_completed=true` at provisioning** — audit for any downstream reader that
   treats it as "has finished setup" vs "is a real host" (e.g. reminders, CRM lifecycle,
   admin views) before flipping it early. If any reader depends on the old meaning, gate
   on `has active service` instead.
3. **Name→slug edge cases** — non-Latin / emoji / very short display names after slugify
   (e.g. a name that reduces to 1 char or empties). The email/random fallback covers empties;
   confirm the min-length + reserved checks in `generateUnique` handle the rest.
4. **Rollout** — behind a kill-switch? Reuses the existing feature-flag pattern
   ([[feature-kill-switches]]); flag lets us revert to the wizard without a deploy. Decide
   whether to ship flagged or clean-cut.

## 11. Risks / landmines

- **OneDrive sync + concurrent sessions** — commit early; isolated branch
  ([[onedrive-sync-hazard]], [[concurrent-session-worktree-collision]]).
- **Two JSON-LD/robots paths must stay in sync** — client `seo.js` and server
  `prerenderController.js`; change both or profiles bake stale meta
  ([[profile-aeo-schema]]).
- **Prerender is sitemap-driven** — fixing `fetchHosts` automatically fixes the prerender
  set; don't also hand-edit prerender host lists.
- **Deleting the exit-door** — safe only because the account is always valid post-revamp;
  verify no other caller of `cancelHosting` before deleting.
- **`markComplete` bypass** — setting `onboarding_completed` directly skips its
  plan+category gate; acceptable because the paywall+category are now deferred, but see
  open question 2.

---

## Skipped (YAGNI)
- `is_published` column / explicit publish toggle → `is_active` covers publish + hide.
- Hybrid "temporarily hide" switch → redundant with service deactivation.
- New checklist/completion component → the existing inline one is extended, not replaced.
