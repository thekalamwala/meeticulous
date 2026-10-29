# Permanent Usernames with History & Redirects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run superpowers:test-driven-development per task.
>
> **Status:** ✅ BUILT 2026-06-18 on branch `feat/permanent-usernames`. Migration `v3.17` APPLIED live (Supabase project `xwvciqkayammbvsidqig`); backfill verified (7/7 profiles → history as `source='auto'`), `change_username` RPC smoke-tested (gate + positive swap, prod state restored). Server suite 506/506, client 145/145. NOT committed/pushed yet.

**Goal:** Give every account a permanent, globally-unique username (Facebook/GitHub style). Username is a mutable alias over the immutable UUID identity. Old usernames are preserved forever, never reusable, and resolve to the current one via a true HTTP 301 redirect.

**Effort:** Large (~2 days). Identity model already supports it — NOT a major refactor. Size driven by edge-redirect infra, rate-window change logic, reserved-word guard, history table + backfill, and the new generator.

---

## Audit Summary (what already exists)

| Requirement | Status | Evidence |
|---|---|---|
| Immutable UUID identity | ✅ exists | `profiles.id UUID PK` = `auth.users(id)`, created by `handle_new_user()` trigger |
| `username` column, globally unique | ✅ exists | `profiles.username TEXT UNIQUE` |
| WhatsApp verification | ✅ exists, live (v3.11) | `whatsapp_verified` / `whatsapp_verified_at` / `whatsapp_number`; set in `whatsappController.js:42` |
| Public profile route | ✅ exists | API `GET /api/host/:username` → `getHostProfile`; client root route `/:profileSlug` → `HostProfile` (`App.jsx:304`) |
| Display name (independently editable) | ✅ exists | `profiles.name`, edited via `updateProfile` |
| Username generator | ⚠️ wrong shape | `slugifyUsername(name)` + numeric suffix (`hostController.js:7`); phone signups `user-${digits}` (`authController.js:635`) |
| Username editing | ⚠️ ungated | `updateProfile` (PUT `/api/host/profile`) allows unlimited free changes, no WhatsApp gate, overwrites + loses old value (`hostController.js:157-184`) |
| Username history | ❌ missing | nothing preserves old usernames |
| Change rate-limit / lock | ❌ missing | no flag, no timestamps tracked for change cadence |
| 301 redirect on stale URL | ❌ missing | `getHostProfile` 404s any non-current username |
| Non-reusability | ❌ missing | freed usernames re-registerable |
| Reserved-word guard | ❌ missing | **mandatory** because profiles live at ROOT `/:slug` (shares namespace with `/login`, `/dashboard`, `/admin`, …) |

---

## Confirmed Decisions (2026-06-18)

1. **301 strategy = Vercel edge redirect.** Real HTTP 301 emitted at the edge (React SPA cannot emit 301). SEO-grade.
2. **URL shape = keep root `/:slug`.** No new `/u/:username` route. Reserved-word guard therefore mandatory.
3. **Change policy = rate-limited, NOT one-time lock.** Max **2 user-initiated changes per rolling 365 days**, and **≥6 months between consecutive changes**. This OVERRIDES the original spec's "change once, lock permanently." Initial auto-generated username does not count as a change.

---

## Architecture

- **`username_history` is the source of truth** for username → user resolution and for non-reuse. `profiles.username` stays as a denormalized cache of the current alias (so existing read paths keep working).
- **Non-reuse** enforced by a global `UNIQUE (lower(username))` index over history — released rows remain forever and keep blocking the name.
- **Change cadence** derived entirely from `username_history` timestamps + a `source` marker (`'auto'` vs `'user'`). No boolean lock column needed.
- **301 redirect** handled by a Vercel edge function that looks up the slug, and for a stale (non-current) slug returns `301 Location: /<current>`. Current slugs fall through to the SPA. The API also returns canonical info so the client can self-correct as defense-in-depth.
- **Reserved words** in a single shared, exported list consumed by both the generator and the change endpoint.

**Tech stack:** Express 4, Supabase (`supabaseAdmin`), Jest (server), React 18 + Vite, Vitest (client), Vercel edge/serverless, Razorpay/AiSensy unaffected.

---

## File Structure

**New (server):**
- `server/migrations/v3.17_username_history.sql` — `username_history` table + indexes + `profiles` source backfill
- `server/utils/usernameGenerator.js` — `{adjective}-{noun}-{suffix}` generator + wordlists
- `server/utils/reservedUsernames.js` — shared reserved-word list + `isReserved()`
- `server/services/usernameService.js` — resolve / change / history helpers (atomic change op)
- `server/controllers/usernameController.js` — `changeUsername`, `resolveUsername`
- `server/routes/usernameRoutes.js` — `PUT /api/host/username` (protected), `GET /api/username/resolve/:slug` (public, for edge fn)
- `server/tests/unit/usernameGenerator.test.js`
- `server/tests/unit/usernameService.test.js`
- `server/tests/integration/usernameChange.test.js`

**New (client/infra):**
- `api/u/[slug].js` (or `vercel.json` rewrite + serverless) — Vercel edge 301 redirect for stale slugs

**Modified (server):**
- `server/controllers/hostController.js` — `getHostProfile` resolves via history, returns canonical + redirect signal; REMOVE username mutation from `updateProfile`
- `server/controllers/authController.js` — `upsertProfile` + `findOrCreateProfileByPhone` use new generator, insert initial `source='auto'` history row
- `server/server.js` — mount `/api/host/username` + `/api/username`

**Modified (client):**
- `client/src/services/api.js` — `changeUsername`, resolve helper
- `client/src/pages/HostProfile.jsx` — handle canonical redirect response (`navigate(replace)`)
- `client/src/pages/dashboard/ProfileSetup.jsx` (or settings) — username change UI gated on `whatsapp_verified`, shows next-eligible date / remaining changes

---

## Schema

```sql
-- v3.17_username_history.sql

CREATE TABLE IF NOT EXISTS username_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT true,
  source      TEXT NOT NULL DEFAULT 'user',   -- 'auto' (initial, uncounted) | 'user'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

-- Global non-reuse: a username, once used, is blocked forever (current OR historical).
CREATE UNIQUE INDEX IF NOT EXISTS username_history_username_key
  ON username_history (lower(username));

-- At most one current alias per user.
CREATE UNIQUE INDEX IF NOT EXISTS username_history_one_current
  ON username_history (user_id) WHERE is_current;

CREATE INDEX IF NOT EXISTS username_history_user_idx ON username_history (user_id);

-- Backfill existing usernames as the current alias (uncounted toward change limit).
INSERT INTO username_history (user_id, username, is_current, source)
SELECT id, username, true, 'auto'
FROM profiles
WHERE username IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: deny-all, service-role only (lookups go through the API, like otp_codes).
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;
-- (no policies = deny all for anon/authenticated; supabaseAdmin bypasses)
```

**Note:** `profiles.username_changed` boolean is intentionally NOT added — cadence is derived from history timestamps.

---

## Change-eligibility rule (server, enforced atomically)

A `PUT /api/host/username` succeeds only if ALL hold:
1. `profiles.whatsapp_verified = true`
2. new slug passes validation (format, length ≤ 60, lowercase, `isReserved()` = false)
3. new slug is globally free: no `username_history` row with `lower(username) = lower(new)`
4. **rate window:** count of `source='user'` history rows for this user with `created_at > now() - interval '365 days'` is `< 2`
5. **gap:** the most recent `source='user'` row for this user has `created_at <= now() - interval '6 months'` (first user-change has no prior, so passes)

On success, in one transaction (or a single Postgres RPC to avoid races):
- set current row `is_current = false, released_at = now()`
- insert new row `is_current = true, source = 'user'`
- update `profiles.username = <new>`

On failure return a clear reason, including next-eligible date when blocked by gap/limit.

---

## Tasks

### Task 1: DB migration + backfill
- [ ] Write `v3.17_username_history.sql` (above). Apply in Supabase SQL Editor. Verify backfill row count == non-null usernames.

### Task 2: Reserved list + generator
- [ ] `reservedUsernames.js` — include `login, signup, register, dashboard, admin, api, u, host, hello-sloth, settings, search, explore, about, privacy, help, unsubscribe` + route names. Export `isReserved()`.
- [ ] `usernameGenerator.js` — `{adjective}-{noun}-{suffix}`, lowercase. Suffix = base36 of crypto-random, ~5 chars. Retry on history collision and reserved hit. Unit tests: shape, lowercase, reserved-avoidance, collision-retry.

### Task 3: usernameService (resolve + atomic change)
- [ ] `resolve(slug)` → `{ userId, currentUsername, isCurrent }` or null.
- [ ] `changeUsername(userId, newSlug)` → enforces eligibility rule; atomic. Unit + integration tests covering all 5 reject paths + happy path + concurrent-change race.

### Task 4: Wire signup generator
- [ ] `authController.upsertProfile` + `findOrCreateProfileByPhone` → generate via new util, insert `source='auto'` history row alongside profile create.

### Task 5: Public resolution + redirect signal
- [ ] `getHostProfile` resolves via `username_history`. If requested ≠ current → respond with canonical username + redirect signal (e.g. `308`/payload). Render if current.
- [ ] Add public `GET /api/username/resolve/:slug` for the edge function.

### Task 6: Remove ungated username edit
- [ ] Strip username mutation from `updateProfile` (`hostController.js:157-184`). Username changes only via the new gated endpoint. Display name (`name`) stays editable here.

### Task 7: Change endpoint + route
- [ ] `usernameController.changeUsername` + `PUT /api/host/username` (protected). Mount in `server.js`.

### Task 8: Vercel edge 301
- [ ] Edge function / `vercel.json`: for `/:slug`, call resolve; if stale → `301 Location: /<current>`; else pass to SPA. Verify real 301 with `curl -I`.

### Task 9: Client
- [ ] `HostProfile.jsx` handles canonical redirect (`navigate(replace)`) as defense-in-depth.
- [ ] Dashboard username-change UI: gated on `whatsapp_verified`; shows remaining changes + next-eligible date; calls `changeUsername`.

### Task 10: Docs
- [ ] Update `docs/database-schema.md` (new table), `docs/feature-map.md` (username feature), `docs/current-work.md`. Add memory entry.

---

## SEO

301 (permanent) transfers link-equity from old URL to new and de-indexes the old — correct vs 302. Delivered via Vercel edge (decision #1). The API-driven client `navigate` is defense-in-depth only, not the SEO mechanism.

## Security

- **Non-reuse blocks impersonation** — global `lower(username)` unique over history; a freed handle can never be claimed by another user.
- **UUID is identity** — all FKs (`bookings.host_id`, `services.host_id`, …) key on UUID, so a rename touches zero relational data; no broken refs, no privilege confusion.
- **WhatsApp gate + rate limit** — ties permanent handle to a verified phone; throttles squatting/churn.
- **Reserved-word guard** — mandatory under root `/:slug` so a user can't shadow a real route.
- **Atomic change op** — prevents double `is_current` rows or a freed-but-unclaimable gap under concurrency.

## Open items / backfill caveats
- Backfill marks all existing usernames `source='auto'` → existing users get a fresh allowance (2/year), consistent with "auto names weren't deliberate."
- Confirm no existing `profiles.username` collides case-insensitively before applying the unique index (dedup first if so).
