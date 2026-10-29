# Invite Links — Lead-Source Attribution (`/invite/:slug`)

**Date:** 2026-07-20
**Status:** Design approved, spec for review
**Type:** New feature (net-new; no existing generic trackable-link system)

## Goal

Give the sales/marketing team shareable pretty links like
`meeticulous.com/invite/social` that:

1. **Attribute new host signups** to a named source (social platform, sales rep,
   campaign, QR code, etc.) — stored in our own DB, visible in admin.
2. Make vendors "feel invited" via a light VIP landing (marketing gimmick).

**Explicitly NOT in scope:** payouts / rewards. Attribution-only, kept fully
separate from the Refer & Earn `referrals` table and its payout machinery.

## Hard rules (loud)

- **Invite attribution NEVER creates a payout `referrals` row.** `profiles.invite_slug`
  is a separate axis from Refer & Earn. A host may have BOTH a `?ref` referrer
  (payout) AND an `invite_slug` (attribution); they never touch each other.
- **New host signups only.** Attribution is stamped once, at host-account
  creation. Existing/returning hosts are never stamped, even if they click an
  invite link.
- **Slugs are never deleted** — only `active` toggled off. Inactive OR unknown
  slug → silent redirect to `/`, never a 404.

## Non-goals (deferred, YAGNI)

- Per-slug custom landing content. ONE shared landing for all slugs first;
  invest per-slug only if it proves out.
- Per-slug perks / plan incentives.
- Guest attribution. Only **host** signups (vendors = the target).
- Paid-plan funnel column. Bolt on later via the existing `onReferredCharge` hook.

## Data model

### New table: `invite_links`
| column        | type        | notes |
|---------------|-------------|-------|
| `slug`          | text PK     | URL segment, e.g. `social`. Lowercased, validated, reserved-namespace-checked, unique. **Immutable after creation** — never editable. |
| `label`         | text        | Human name, shown in landing greeting + admin, e.g. "Social Squad". Editable. |
| `assigned_to`   | text NULL   | Free-text owner/source: sales rep, campaign, platform, "QR code". Editable. Group-by dimension in admin. |
| `active`        | boolean default true | Off → landing redirects to `/`. Editable. |
| `unique_visits` | bigint default 0 | Estimated unique landing hits (de-botted + IP/day deduped). Named `unique_visits` in DB and admin so the estimate is honest. |
| `metadata`      | jsonb default '{}' | Free-form campaign details (budget, notes, dates…) without a future migration. |
| `created_by`    | uuid NULL   | Admin/sales-manager who created it (FK → admin id). Audit + "my links" filter. |
| `created_at`    | timestamptz default now() | |

Only `label`, `assigned_to`, `active`, `metadata` are editable. `slug` is immutable.
RLS: on / service-role only (like other admin-config tables). No anon policy.

### New column: `profiles.invite_slug` (text NULL)
First-touch attribution, stamped once at **account creation** (the moment the
`profiles` row is inserted on first Google sign-in via the invite CTA) — NOT at
onboarding completion.

- **Atomic write-once at the DB level:** stamp via a single conditional update
  `UPDATE profiles SET invite_slug = $1 WHERE id = $2 AND invite_slug IS NULL`
  (or set inline in the creation INSERT). No read-then-write; no race, no overwrite.
- **Server-side validation before stamping:** the browser only carries the slug;
  the server confirms the slug EXISTS in `invite_links` before writing. (Existence
  only — see "Deactivation" below; a since-deactivated slug still attributes.)
- Signup count per slug = `COUNT(profiles WHERE invite_slug = <slug>)`.
- Partial index on `profiles(invite_slug) WHERE invite_slug IS NOT NULL`.

### Deactivation vs attribution
If a host clicked a then-valid invite and signs up AFTER the slug is deactivated,
they are **still attributed**. `active=false` gates the LANDING (redirect to `/`),
not attribution. Stamping validates slug *existence*, not `active`.

### Slug reservation
`invite` becomes a new top-level route. It is **already reserved server-side**
(`reservedNamespaces.js` → `ACCOUNT` array). It is **missing from the client**
`reservedSegments.js` → add `'invite'` there, or the `routeManifestSync` /
`reservedSegmentsSync` CI tests fail the whole deploy. (Known landmine — client
list only.)

## Components & flow

### 1. Public landing `GET /invite/:slug`
- ONE shared landing = trimmed homepage. Reuse existing homepage section
  components; do NOT fork the whole homepage. Sections, in order:
  1. **Hero** (with dynamic greeting — see below)
  2. **Numbers** — top 3 stat integrations from the current homepage
  3. **Why Meeticulous**
  4. **Pricing**
  5. **Testimonials**
  6. **Minimal footer** — bottom strip only (no full footer columns)
- On mount:
  - Fetch `GET /api/invite/:slug` → `{ label, active }`. Missing / `active:false`
    → redirect to `/`.
  - First-touch rule (single source of truth = `bas_invite`): **if `bas_invite`
    already exists, change neither attribution value.** Otherwise set
    `localStorage['bas_invite'] = slug` AND set the invite-specific UTM source to
    `invite/<slug>` in the UTM stash (`useUtm.js` / `sessionStorage['bas_utm']`).
    Existing non-invite UTM data is preserved per the existing UTM attribution
    rules. (`bas_invite` mirrors `bas_ref`, survives days/sessions; it — not
    sessionStorage — is the durable gate, so the two stores can't diverge on source.)
  - Fire-and-forget `POST /api/invite/:slug/visit`.
- Dynamic greeting: inject `label` into the hero headline, e.g.
  *"Welcome, {label} 🦥"*. One line; no per-slug design.
- CTA → existing host onboarding (Google-only). **At CTA click, read `bas_invite`
  and pass it into the Google OAuth `state`** (see Attribution capture). No new
  auth flow — same vendor-auth OAuth start, one extra field in `state`.

### 2. Bot / inflated-visit handling
Social + QR links attract preview/unfurl bots (WhatsApp, FB, Slack) and
scrapers. `POST /api/invite/:slug/visit`:
- Skip increment if request UA matches a known-bot list (bot UAs self-identify).
- De-dupe genuine hits by `(slug, client-IP, day)` — best-effort via a
  short-TTL in-memory cache. Result increments `unique_visits`.
- `// ponytail: UA-skip + IP/day dedupe is a heuristic, not exact. Upgrade to a
  visit-log table only if sales needs precise unique-visitor counts.`

### 3. Attribution capture — HYBRID: durable stash + OAuth-state + server-side stamp (LOCKED)
Chosen for the long term over both a pure client-POST (trusts the browser, extra
endpoint, can double-fire) and a pure OAuth-state approach (loses cross-session
first-touch). This combines durability with a single race-free server write.

**Slug carriage (durability):**
1. `/invite/:slug` stashes `bas_invite` in `localStorage`, first-touch — survives
   days / bookmarks / a signup that happens in a later session.
2. At the Google CTA, the client reads `bas_invite` and injects it into the OAuth
   `state` payload alongside the existing `flow: 'vendor_auth'`. (Same OAuth start
   as today — one extra field. localStorage carries it across sessions; `state`
   carries it race-free through the redirect.)

**Server stamp (correctness) — `authController.googleCallback`, Flow A:**
3. The stamp lives ONLY inside the brand-new-profile branch: `if (!profileId)`
   (authController.js ~line 487), right after `markGoogleVendorOnboarding`. Existing
   profiles NEVER enter the invite-attribution path — the branch, not a null-guard,
   is the gate. (An old account can have `invite_slug IS NULL`; a guard alone would
   wrongly stamp it.)
4. In that branch: read `slug` from OAuth `state`; validate it EXISTS in
   `invite_links` (existence only — a since-deactivated slug still attributes);
   set `invite_slug` inline in the `upsertProfile` INSERT (or an atomic conditional
   update `... WHERE id=$2 AND invite_slug IS NULL` as belt-and-suspenders).
   No separate `/api/invite/capture` endpoint. No client-POST-after-auth.
5. Independent of referral capture (`bas_ref` keeps its own client-POST path — a
   host may carry both a payout referrer AND an invite source).

**Fallback:** if `state` carries no slug (e.g. user disabled localStorage), no
attribution — acceptable; never guess a source.

### 4. Admin UI (alongside `AdminReferrals`)
- Create: `slug` + `label` + `assigned_to` (+ optional `metadata`). Slug validated
  against reserved namespaces + uniqueness.
- Edit: `label`, `assigned_to`, `active`, `metadata` only. **`slug` is immutable**
  (not shown as editable). No delete — deactivate via `active` toggle.
- Stats table: `slug · label · assigned_to · unique_visits · signups · conversion %`
  (conv % = signups / unique_visits). Optional group-by `assigned_to`.

### 5. API surface
| method | route | auth | purpose |
|--------|-------|------|---------|
| GET  | `/api/invite/:slug`             | public | landing config `{label, active}` |
| POST | `/api/invite/:slug/visit`       | public | de-botted `unique_visits++` (rate-limited, fire-and-forget) |
| GET  | `/api/admin/invite-links`       | admin  | list + stats |
| POST | `/api/admin/invite-links`       | admin  | create (slug immutable hereafter) |
| PATCH| `/api/admin/invite-links/:slug` | admin  | edit `label`/`assigned_to`/`active`/`metadata` only |

(No capture endpoint — the slug rides the Google OAuth `state` and is stamped
inline in `googleCallback`'s brand-new-profile branch. See Attribution capture.)

## Migration
- **File name:** `v3.90_invite_links.sql` is TAKEN (`v3.90_bot_escalation_rating.sql`
  exists). Use the next free number — `v3.91_invite_links.sql` (verify against
  `server/migrations/` at build time).
- Create `invite_links` (incl. `unique_visits`, `metadata jsonb`, `created_by`) +
  add `profiles.invite_slug` + partial index.
- SQL style (match `v3.77_referral_program.sql`): header comment w/ APPLY-ON-BOTH-DBs
  note, `create table if not exists`, additive `alter table … add column if not
  exists`, RLS enabled + `revoke all … from anon, authenticated` (service-role only),
  partial index `where invite_slug is not null`, idempotent seeds `on conflict do nothing`.
- Apply to **BOTH** DBs (prod Mumbai `PROD_PROJECT_REF` + staging Tokyo
  `STAGING_PROJECT_REF`). Additive only — no destructive changes.
- Code keeps schema-fallback (SELECT/INSERT degrade on "table/column not found")
  until confirmed applied everywhere. House rule.

## Error handling
- Unknown/inactive slug → redirect `/`, never 404.
- Visit counter best-effort: failure never blocks landing render.
- Capture write-once + idempotent; duplicates no-op.
- Reserved-slug / duplicate blocked at admin create.

## Testing (minimal, per house style)
- Backend: slug from OAuth `state` is stamped ONLY in `googleCallback`'s
  `if (!profileId)` branch (an EXISTING account whose `state` carries a slug is
  NOT stamped); server rejects a slug not in `invite_links`; a since-deactivated
  (but existing) slug STILL attributes; invite attribution NEVER writes a
  `referrals` row; bot UA skips `unique_visits` increment; inactive slug config
  returns `active:false`.
- Client: `/invite/:slug` stashes `bas_invite` first-touch, no overwrite; sets
  `utm_source=invite/<slug>`; CTA injects `bas_invite` into OAuth `state`.
- Route-manifest drift test passes (`invite` added to client `reservedSegments.js`).

## Rollout
1. Migration on both DBs.
2. Ship in normal deploy (additive, inert until a slug is created — no kill-switch).
3. Sales creates first slug in admin, shares `meeticulous.com/invite/<slug>`.
