# Reserved Namespace System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the platform always own its URL namespace — one authoritative reserved-slug resolver, enforced at every username/slug write point, with admin + premium reservation and a route-derived list that cannot drift.

**Architecture:** Hybrid 3-layer. L1 = route-derived static constants in `server/config/reservedNamespaces.js` (version-controlled, enforcement authority). L2 = `reserved_slugs` DB table (admin/premium/prefix, runtime). L3 = existing `username_history` (taken). A single `reservedSlugService.checkAvailability()` unions them; `normalizeSlug()` canonicalizes input before format + reserved checks. A CI test binds the client route manifest to L1 so new routes can't be silently claimable.

**Tech Stack:** Node 22 + Express, Jest (server), Supabase Postgres + plpgsql RPC, React 18 + Vite, Vitest (client).

**Baseline:** server 758 tests green, client 254 green (2026-06-24). Keep green throughout.

---

## File Structure

**New (server)**
- `server/config/reservedNamespaces.js` — L1 categorized constants + `RESERVED_SET` + `isStaticReserved(norm)`.
- `server/utils/slugNormalize.js` — `normalizeSlug(raw)`, `confusableFold(s)` hook.
- `server/utils/slugFormat.js` — `SLUG_RE`, `formatError(norm)`.
- `server/services/reservedSlugService.js` — `checkAvailability`, L2 reads, TTL cache, `bustReservedCache`.
- `server/controllers/reservedSlugAdminController.js` — admin CRUD + check.
- `server/migrations/v3.33_reserved_slugs.sql` — table, RLS, `is_reserved_slug()`, RPC guard hardening.

**New (client)**
- `client/src/config/reservedSegments.js` — route-segment manifest (edge + sync test).
- `client/src/pages/admin/AdminReservedSlugs.jsx` — admin page.

**New (tests/docs)**
- `server/tests/unit/slugNormalize.test.js`, `server/tests/unit/reservedSlugService.test.js`
- `server/tests/integration/reservedSlugs.test.js`
- `client/src/__tests__/routeManifestSync.test.jsx`
- `docs/reserved-namespace-audit.md`

**Modified**
- `server/utils/reservedUsernames.js` — delegate to L1 (keep `isReserved`, `RESERVED`).
- `server/controllers/usernameController.js`, `server/controllers/vendorOnboardingController.js`, `server/controllers/authController.js`
- `server/services/usernameService.js`
- `server/routes/adminRoutes.js`
- `client/middleware.js`, `client/src/App.jsx`

---

## Phase A — Foundation (pure logic, no behavior change)

### Task A1: Normalization pipeline

**Files:** Create `server/utils/slugNormalize.js`; Test `server/tests/unit/slugNormalize.test.js`

- [ ] **Step 1: Write failing test** (`server/tests/unit/slugNormalize.test.js`)

```js
const { normalizeSlug } = require('../../utils/slugNormalize');

describe('normalizeSlug', () => {
  test('case + whitespace', () => {
    expect(normalizeSlug('Admin')).toBe('admin');
    expect(normalizeSlug('  ADMIN  ')).toBe('admin');
    expect(normalizeSlug('aDmIn')).toBe('admin');
  });
  test('fullwidth + circled (NFKC)', () => {
    expect(normalizeSlug('ＡＤＭＩＮ')).toBe('admin'); // ＡＤＭＩＮ
    expect(normalizeSlug('ⓐdmin')).toBe('admin');                     // ⓐdmin
  });
  test('strips zero-width / soft-hyphen / BOM / bidi', () => {
    expect(normalizeSlug('ad​min')).toBe('admin'); // ZWSP
    expect(normalizeSlug('ad‌min')).toBe('admin'); // ZWNJ
    expect(normalizeSlug('admin­')).toBe('admin'); // soft hyphen
    expect(normalizeSlug('﻿admin')).toBe('admin'); // BOM
    expect(normalizeSlug('admin‎')).toBe('admin'); // LRM
  });
  test('separator mapping + collapse + trim hyphens', () => {
    expect(normalizeSlug('astro_guru')).toBe('astro-guru');
    expect(normalizeSlug('astro.guru')).toBe('astro-guru');
    expect(normalizeSlug('astro guru')).toBe('astro-guru');
    expect(normalizeSlug('a--dmin')).toBe('a-dmin');
    expect(normalizeSlug('-admin-')).toBe('admin');
    expect(normalizeSlug('jane–doe')).toBe('jane-doe'); // en dash
  });
  test('non-ascii survivors are left for the format gate to reject', () => {
    expect(normalizeSlug('аdmin')).toBe('аdmin'); // Cyrillic а — NOT folded
    expect(normalizeSlug('admın')).toBe('admın'); // dotless ı — NOT folded
  });
  test('nullish', () => {
    expect(normalizeSlug(null)).toBe('');
    expect(normalizeSlug(undefined)).toBe('');
    expect(normalizeSlug('')).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `cd server && npx jest tests/unit/slugNormalize.test.js`

- [ ] **Step 3: Implement** (`server/utils/slugNormalize.js`)

```js
// Canonicalize a user-supplied slug/username to a single comparison key.
// Order matters: NFKC → strip invisibles → trim/collapse ws → lowercase →
// map separators → collapse/trim hyphens. ALWAYS run before format + reserved
// checks so confusable/zero-width variants of reserved words map onto them.

// Unicode format/invisible chars to delete (zero-width, BOM, soft hyphen, bidi).
// \p{Cf} (format) covers most; we also delete soft hyphen (U+00AD, category Pd? no -> Cf? it's Cf? actually U+00AD is Cf) explicitly for safety.
const INVISIBLE_RE = /[­​-‏‪-‮⁠-⁯﻿\p{Cf}]/gu;
// Separators a human might use instead of a hyphen.
const SEP_RE = /[\s_.·–—•]+/g;

function confusableFold(s) {
  // Extension point for a future homoglyph table. ASCII-locked storage already
  // blocks confusables at the format gate, so this is a no-op today.
  return s;
}

function normalizeSlug(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw);
  if (s.normalize) s = s.normalize('NFKC');
  s = s.replace(INVISIBLE_RE, '');
  s = s.trim().replace(/\s+/g, ' ');
  s = s.toLowerCase();
  s = confusableFold(s);
  s = s.replace(SEP_RE, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

module.exports = { normalizeSlug, confusableFold };
```

- [ ] **Step 4: Run, expect PASS.** Note: NFKC folds `ⓐ` (ⓐ)→a and fullwidth→ascii; ZWNJ/ZWSP are `\p{Cf}` so removed. Verify the Cyrillic/dotless tests stay non-ascii (they are NOT `Cf`).

- [ ] **Step 5: Commit** — `git add server/utils/slugNormalize.js server/tests/unit/slugNormalize.test.js && git commit -m "feat(reserved-slugs): slug normalization pipeline"`

---

### Task A2: Unified format gate

**Files:** Create `server/utils/slugFormat.js` (test folded into A3/service tests)

- [ ] **Step 1: Implement** (`server/utils/slugFormat.js`)

```js
// Single source for username/slug format. Replaces the divergent regexes in
// usernameController (3-30 strict) and vendorOnboardingController (3-60 loose).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN = 3, MAX = 30;

// Returns an error string for a NORMALIZED slug, or null if the format is valid.
function formatError(norm) {
  if (!norm || norm.length < MIN || norm.length > MAX) {
    return `Must be ${MIN}–${MAX} characters.`;
  }
  if (!SLUG_RE.test(norm)) {
    return 'Use only lowercase letters, numbers, and single hyphens.';
  }
  return null;
}

module.exports = { SLUG_RE, formatError, MIN, MAX };
```

- [ ] **Step 2: Commit** — `git add server/utils/slugFormat.js && git commit -m "feat(reserved-slugs): unified slug format gate"`

---

### Task A3: L1 reserved namespaces + rewire `reservedUsernames.js`

**Files:** Create `server/config/reservedNamespaces.js`; Modify `server/utils/reservedUsernames.js`. Existing tests `server/tests/unit/reservedUsernames.test.js` + `usernameGenerator.test.js` MUST stay green.

- [ ] **Step 1: Implement L1** (`server/config/reservedNamespaces.js`)

```js
// L1 — route-derived + future-namespace reservations. Version-controlled
// enforcement authority. A CI test (client routeManifestSync) asserts every
// app route's first path-segment appears here, so this can never drift behind
// the router. Grouped by category for auditability.
const { normalizeSlug } = require('../utils/slugNormalize');

// Every first path-segment owned by the app today (client App.jsx + server root routes).
const ROUTES = [
  'login','logout','signin','signup','register','forgot-password','reset-password',
  'help','about','privacy','terms','refund','unsubscribe','support','explore',
  'be-a-sloth','login-as-vendor','vendor','vendor-register','auth',
  'hello-sloth','super-dashboard','admin','dashboard','user','review','lp',
  'my-bookings','profile','reviews','loyalty','settings','search',
  'sitemap','robots','health','manifest','favicon',
];
// Infra / technical.
const INFRA = [
  'api','www','cdn','static','assets','public','media','files','img','images',
  'download','downloads','webhook','webhooks','oauth','sso','saml','callback',
  'well-known','healthz','ping','status','metrics','debug','internal','system','root',
];
// Future product / marketing namespaces — reserved today so they can launch later.
const FUTURE = [
  'docs','doc','blog','blogs','pricing','plans','plan','features','feature',
  'changelog','roadmap','security','legal','cookies','careers','jobs','press',
  'newsroom','contact','faq','guides','guide','tutorials','tutorial','resources',
  'learn','academy','courses','partners','affiliates','developers','developer',
  'api-docs','enterprise','teams','team','org','orgs','organization','organizations',
  'workspace','workspaces','community','communities','marketplace','store','shop','market',
];
// Auth / account / commerce.
const ACCOUNT = [
  'account','accounts','billing','invoice','invoices','checkout','cart','verify',
  'confirm','activate','welcome','onboarding','get-started','start','join','invite',
  'refer','referral','book','booking','bookings','schedule','appointment','appointments',
  'slot','slots','availability','service','services','product','products','order','orders',
  'payment','payments','pay','subscribe','subscription','subscriptions','upgrade',
  'redeem','gift','promo','coupon','deals','offers','notifications','campaigns','badges',
  'categories','category','feedback',
];
// Brand / role / safety / impersonation.
const BRAND = [
  'bookasloth','book-a-sloth','sloth','slothofficial','official','verified','staff',
  'moderator','mod','administrator','superadmin','team-sloth','no-reply','noreply',
  'postmaster','abuse','hostmaster','mail','email','hosts','host','users','vendors',
  'home','index','me','guest','app','apps','web','go',
];
// Single/short letters — premium landgrab guard (also reserved at L1).
const SHORT = ['a','i','u','s','p','c','e','r','o','x','m'];
// Literal hazards.
const HAZARD = ['null','undefined','true','false','nan','none','nil','void'];

const ALL = [...ROUTES, ...INFRA, ...FUTURE, ...ACCOUNT, ...BRAND, ...SHORT, ...HAZARD];
const RESERVED_SET = new Set(ALL.map(normalizeSlug));

// True if a NORMALIZED slug exactly matches an L1 reserved name.
function isStaticReserved(norm) {
  return RESERVED_SET.has(norm);
}

module.exports = {
  RESERVED_SET, isStaticReserved,
  CATEGORIES: { ROUTES, INFRA, FUTURE, ACCOUNT, BRAND, SHORT, HAZARD },
};
```

- [ ] **Step 2: Rewire** (`server/utils/reservedUsernames.js`) — keep public API, delegate to L1 + normalize.

```js
// Reserved usernames — public guard kept for backward-compat. Internals now
// delegate to the L1 registry (server/config/reservedNamespaces.js) and the
// shared normalizer so every caller gets the full route-derived list + unicode/
// separator hardening for free.
const { normalizeSlug } = require('./slugNormalize');
const { isStaticReserved, RESERVED_SET } = require('../config/reservedNamespaces');

// Case/unicode/separator-insensitive check on the full slug. Empty => reserved.
function isReserved(slug) {
  if (slug === null || slug === undefined || slug === '') return true;
  const norm = normalizeSlug(slug);
  if (!norm) return true;
  return isStaticReserved(norm);
}

// RESERVED kept as a named export for any legacy importer; now the L1 set.
module.exports = { isReserved, RESERVED: RESERVED_SET };
```

- [ ] **Step 3: Run existing guards** — `cd server && npx jest tests/unit/reservedUsernames.test.js tests/unit/usernameGenerator.test.js`
Expected PASS. Checks: `isReserved('login')` true; `isReserved('Dashboard')` true; `isReserved('astro_guru')` → normalize `astro-guru` → false ✓; `isReserved('jane-doe')` false; whitespace/upper variants true.

- [ ] **Step 4: Commit** — `git add server/config/reservedNamespaces.js server/utils/reservedUsernames.js && git commit -m "feat(reserved-slugs): L1 route-derived registry + rewire isReserved"`

---

### Task A4: Client route manifest + sync test

**Files:** Create `client/src/config/reservedSegments.js`; Test `client/src/__tests__/routeManifestSync.test.jsx`; Modify `client/middleware.js`.

- [ ] **Step 1: Implement manifest** (`client/src/config/reservedSegments.js`)

```js
// First path-segment of every top-level app route. Consumed by the Vercel edge
// middleware (SKIP optimization) and asserted ⊆ server L1 by CI. Adding a route
// to App.jsx without adding its segment here fails the sync test.
export const RESERVED_FIRST_SEGMENTS = [
  'login','logout','signin','signup','register','forgot-password','reset-password',
  'help','about','privacy','terms','refund','unsubscribe','support','explore',
  'be-a-sloth','login-as-vendor','vendor','vendor-register','auth',
  'hello-sloth','super-dashboard','admin','dashboard','user','review','lp',
  'my-bookings','profile','reviews','loyalty','sitemap','robots','health',
];
```

- [ ] **Step 2: Sync test** (`client/src/__tests__/routeManifestSync.test.jsx`) — parse App.jsx for `path="..."`, assert each first segment ∈ manifest.

```jsx
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RESERVED_FIRST_SEGMENTS } from '../config/reservedSegments';

const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.jsx'), 'utf8');
const paths = [...appSrc.matchAll(/path=\"([^\"]+)\"/g)].map((m) => m[1]);

describe('route manifest covers the router', () => {
  it('every static first-segment is reserved', () => {
    const manifest = new Set(RESERVED_FIRST_SEGMENTS);
    const missing = [];
    for (const p of paths) {
      const seg = p.replace(/^\//, '').split('/')[0];
      if (!seg || seg.startsWith(':') || seg === '*') continue; // dynamic/catch-all
      if (!manifest.has(seg)) missing.push(seg);
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
```

- [ ] **Step 3: Edge import** (`client/middleware.js`) — replace the hardcoded `SKIP` set.

Replace lines 22-26 (`const SKIP = new Set([...])`) with:
```js
import { RESERVED_FIRST_SEGMENTS } from './src/config/reservedSegments.js';
const SKIP = new Set(RESERVED_FIRST_SEGMENTS);
```
(Move the import to the top with the other module-level constants.)

- [ ] **Step 4: Run** — `cd client && npx vitest run src/__tests__/routeManifestSync.test.jsx`. If `missing` non-empty, add those segments to BOTH `reservedSegments.js` and server `ROUTES`. Expected PASS.

- [ ] **Step 5: Commit** — `git add client/src/config/reservedSegments.js client/src/__tests__/routeManifestSync.test.jsx client/middleware.js && git commit -m "feat(reserved-slugs): client route manifest + edge import + sync test"`

---

## Phase B — DB + Service

### Task B1: `reserved_slugs` migration

**Files:** Create `server/migrations/v3.33_reserved_slugs.sql`

- [ ] **Step 1: Write migration** (idempotent; table + RLS + `is_reserved_slug()` + harden both RPCs to call it)

```sql
-- v3.33 Reserved slugs: admin/premium/prefix reservations (L2). System/route
-- names stay in code (L1). RLS deny-all (service-role only). is_reserved_slug()
-- lets the username RPCs reject L2 names without duplicating the L1 list in SQL.
CREATE TABLE IF NOT EXISTS reserved_slugs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  kind        text NOT NULL DEFAULT 'admin',
  reason      text,
  is_prefix   boolean NOT NULL DEFAULT false,
  premium     boolean NOT NULL DEFAULT false,
  assignable  boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS reserved_slugs_slug_active
  ON reserved_slugs (lower(slug)) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS reserved_slugs_kind_idx
  ON reserved_slugs (kind) WHERE released_at IS NULL;

ALTER TABLE reserved_slugs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reserved_slugs' AND policyname='deny_all') THEN
    CREATE POLICY deny_all ON reserved_slugs FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;
REVOKE ALL ON reserved_slugs FROM anon, authenticated;

-- Exact + prefix match against ACTIVE L2 rows. SECURITY DEFINER so the RPCs
-- (also definer) can call it; checks only the table, never the L1 code list.
CREATE OR REPLACE FUNCTION is_reserved_slug(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM reserved_slugs
    WHERE released_at IS NULL
      AND (
        lower(slug) = lower(p_slug)
        OR (is_prefix AND lower(p_slug) LIKE lower(slug) || '-%')
      )
  );
$$;
REVOKE ALL ON FUNCTION is_reserved_slug(text) FROM PUBLIC, anon, authenticated;
```

NOTE: The RPC hardening (adding `IF is_reserved_slug(v_new) THEN RETURN ...`) is appended in this same migration by re-creating both functions. Copy the CURRENT bodies of `change_username` (v3.17) and `set_onboarding_username` (v3.32) verbatim and insert, right after the name is normalized, an L2 guard. **During execution, read those two files first and reproduce their full bodies** — do not hand-wave. The inserted guard for `change_username`:
```sql
  IF is_reserved_slug(v_new) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;
```
and for `set_onboarding_username` (which RAISEs):
```sql
  IF is_reserved_slug(v_clean) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;
```

- [ ] **Step 2: Commit** (applied to live DBs in Phase E, not here) — `git add server/migrations/v3.33_reserved_slugs.sql && git commit -m "feat(reserved-slugs): reserved_slugs table + is_reserved_slug + RPC guard"`

---

### Task B2: `reservedSlugService`

**Files:** Create `server/services/reservedSlugService.js`; Test `server/tests/unit/reservedSlugService.test.js`

- [ ] **Step 1: Failing test** — mock `supabaseAdmin`; assert reasons.

```js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/usernameService', () => ({ usernameOwner: jest.fn() }));
const svc = require('../../services/reservedSlugService');
const usernameService = require('../../services/usernameService');

function mockDb(rows) {
  const { supabaseAdmin } = require('../../config/supabase');
  supabaseAdmin.from.mockReturnValue({
    select: () => ({ is: () => ({ then: (r) => r({ data: rows }) }) }),
  });
}

describe('checkAvailability', () => {
  beforeEach(() => { jest.clearAllMocks(); svc._clearCache(); });
  test('reserved route (L1) blocks before DB', async () => {
    usernameService.usernameOwner.mockResolvedValue(null);
    const r = await svc.checkAvailability('Admin');
    expect(r).toMatchObject({ ok: false, reason: 'reserved_route', normalized: 'admin' });
  });
  test('format error', async () => {
    const r = await svc.checkAvailability('ab');
    expect(r.reason).toBe('format');
  });
  test('available name passes', async () => {
    mockDb([]); usernameService.usernameOwner.mockResolvedValue(null);
    const r = await svc.checkAvailability('jane-doe');
    expect(r).toMatchObject({ ok: true, reason: 'ok', normalized: 'jane-doe' });
  });
  test('taken by someone else', async () => {
    mockDb([]); usernameService.usernameOwner.mockResolvedValue('other-id');
    const r = await svc.checkAvailability('jane-doe', { selfUserId: 'me' });
    expect(r.reason).toBe('taken');
  });
  test('self-owned is ok (idempotent)', async () => {
    mockDb([]); usernameService.usernameOwner.mockResolvedValue('me');
    const r = await svc.checkAvailability('jane-doe', { selfUserId: 'me' });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** (`server/services/reservedSlugService.js`)

```js
const { supabaseAdmin } = require('../config/supabase');
const { normalizeSlug } = require('../utils/slugNormalize');
const { formatError } = require('../utils/slugFormat');
const { isStaticReserved } = require('../config/reservedNamespaces');
const usernameService = require('./usernameService');

const TTL_MS = 60 * 1000;
let _cache = null; // { rows, at }

async function _loadDynamic() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.rows;
  const { data } = await supabaseAdmin
    .from('reserved_slugs')
    .select('slug,is_prefix')
    .is('released_at', null);
  _cache = { rows: data || [], at: Date.now() };
  return _cache.rows;
}
function _clearCache() { _cache = null; }
function bustReservedCache() { _cache = null; }

function _matchesDynamic(norm, rows) {
  for (const r of rows) {
    const s = normalizeSlug(r.slug);
    if (s === norm) return true;
    if (r.is_prefix && norm.startsWith(s + '-')) return true;
  }
  return false;
}

// Unified availability across L1 (route/system), L2 (admin/premium/prefix),
// L3 (username_history). Returns { ok, reason, normalized }.
async function checkAvailability(raw, { selfUserId = null } = {}) {
  const normalized = normalizeSlug(raw);
  const fmt = formatError(normalized);
  if (fmt) return { ok: false, reason: 'format', normalized, message: fmt };
  if (isStaticReserved(normalized)) return { ok: false, reason: 'reserved_route', normalized };
  const rows = await _loadDynamic();
  if (_matchesDynamic(normalized, rows)) return { ok: false, reason: 'reserved_admin', normalized };
  const owner = await usernameService.usernameOwner(normalized);
  if (owner && owner !== selfUserId) return { ok: false, reason: 'taken', normalized };
  return { ok: true, reason: 'ok', normalized };
}

module.exports = { checkAvailability, bustReservedCache, _clearCache };
```

(If the chained-mock in Step 1 fights the real query builder shape, simplify the test to mock `_loadDynamic` via `jest.spyOn` instead — the contract under test is the reason ladder, not Supabase's builder.)

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git add server/services/reservedSlugService.js server/tests/unit/reservedSlugService.test.js && git commit -m "feat(reserved-slugs): unified reservedSlugService"`

---

## Phase C — Enforcement wiring

### Task C1: usernameController

**Files:** Modify `server/controllers/usernameController.js`

- [ ] **Step 1:** Replace `validateFormat` + the two handlers' inline lowercasing with the service. Keep response contracts.
  - Import: `const { normalizeSlug } = require('../utils/slugNormalize'); const { formatError } = require('../utils/slugFormat'); const reservedSlugService = require('../services/reservedSlugService');`
  - `checkUsername`: `const norm = normalizeSlug(req.params.slug); const r = await reservedSlugService.checkAvailability(norm, { selfUserId: req.user?.id }); return res.json({ available: r.ok, reason: r.ok ? null : (r.message || reasonText(r.reason)) });`
  - `changeUsername`: compute `const norm = normalizeSlug(req.body?.username);` then `const avail = await reservedSlugService.checkAvailability(norm, { selfUserId: req.user.id });` — if `!avail.ok && avail.reason !== 'taken'` return 400 with message (taken is allowed to fall through to the RPC which gives the precise gated reason). Then call `usernameService.changeUsername(req.user.id, norm)` as today.
  - Add `reasonText(reason)` map: `format`→generic, `reserved_route`/`reserved_admin`→'That username is reserved.', `taken`→'That username is taken.'

- [ ] **Step 2:** Run `npx jest tests/unit tests/integration -t username` and the username test files. Adjust expectations if any assert old copy. Commit.

### Task C2: vendorOnboardingController

**Files:** Modify `server/controllers/vendorOnboardingController.js`

- [ ] **Step 1:** Replace `isValidSlug` usage in `slugAvailableForUser` + `claimSlug` with `reservedSlugService.checkAvailability(clean, { selfUserId: vendorId })`. Map `reason` → existing `{ available:false, reason }` shape (`format`→'invalid', `reserved_route`/`reserved_admin`→'reserved', `taken`→'taken'). In `claimSlug`, throw the matching errors as today. Keep `setOnboardingUsername` call. Leave `generateUniqueSlug`/`checkSlugAvailable` (legacy onboarding_slug helpers) intact but note deprecation.
- [ ] **Step 2:** Run onboarding tests, fix copy expectations, commit.

### Task C3: authController phone-login bypass fix

**Files:** Modify `server/controllers/authController.js` (`findOrCreateProfileByPhone`, ~line 664-682)

- [ ] **Step 1:** Before upserting `username: "user-${digits}"`, normalize + check: `const base = normalizeSlug('user-' + digits); let uname = base; if (isReserved(base) || await usernameService.usernameExists(base)) { uname = await usernameService.createInitialUsername(); }` then use `uname`. (`isReserved` already imported; ensure `usernameService` imported — it is.)
- [ ] **Step 2:** Add integration test: a phone whose `user-<digits>` would be reserved falls back to a generated name; commit.

### Task C4: usernameService service-level guard

**Files:** Modify `server/services/usernameService.js`

- [ ] **Step 1:** In `setOnboardingUsername` and `changeUsername`, normalize via `normalizeSlug` (replace ad-hoc `toLowerCase().trim()`), and before the RPC call add `if (require('../config/reservedNamespaces').isStaticReserved(clean)) return { ok:false, reason:'taken' };` (defense-in-depth for future callers; controllers already gate). Keep behavior identical for valid names.
- [ ] **Step 2:** Run full server unit+integration; commit.

### Task C5: Integration sweep

**Files:** `server/tests/integration/reservedSlugs.test.js`

- [ ] **Step 1:** Tests: `PUT /api/host/username` with `Admin`/`ＡＤＭＩＮ`/`ad​min` → 400 reserved; `POST /api/onboarding/claim-slug` reserved → error; a non-reserved valid name still succeeds (mock RPC). Run, commit.

---

## Phase D — Admin API + UI

### Task D1: Admin controller + routes

**Files:** Create `server/controllers/reservedSlugAdminController.js`; Modify `server/routes/adminRoutes.js`

- [ ] **Step 1:** Controller: `list` (`select * order by created_at desc where released_at is null`), `create` (`{slug,kind,reason,is_prefix,premium}` → normalize slug, insert `created_by: req.admin.id`, `bustReservedCache()`), `release` (set `released_at=now()` by id, bust), `check` (`reservedSlugService.checkAvailability(req.params.slug)` → `{ available, reason, normalized }`). Use `safeError`.
- [ ] **Step 2:** Routes (after the settings block in `adminRoutes.js`):
```js
const reservedSlugs = require('../controllers/reservedSlugAdminController');
router.get('/reserved-slugs',            requireAdmin('settings.manage'), reservedSlugs.list);
router.post('/reserved-slugs',           requireAdmin('settings.manage'), reservedSlugs.create);
router.get('/reserved-slugs/check/:slug',requireAdmin('settings.manage'), reservedSlugs.check);
router.delete('/reserved-slugs/:id',     requireAdmin('settings.manage'), reservedSlugs.release);
```
- [ ] **Step 3:** Integration test (admin token): create → list shows it → check returns reserved_admin → release. Commit.

### Task D2: Admin UI

**Files:** Create `client/src/pages/admin/AdminReservedSlugs.jsx`; Modify `client/src/App.jsx` (route under AdminLayout at `/admin/system/reserved`); add `getReservedSlugs/createReservedSlug/releaseReservedSlug/checkReservedSlug` to `client/src/services/api.js`.

- [ ] **Step 1:** Page: table of active reservations + create form (slug, kind select, reason, is_prefix, premium checkboxes) + a "check a name" input showing which layer blocks it + a read-only collapsible list of L1 categories (import a small JSON or call check). Follow existing AdminLayout page patterns.
- [ ] **Step 2:** Wire route + api; `cd client && npx vitest run` stays green; smoke via preview if time. Commit.

---

## Phase E — Deliverables + rollout

### Task E1: Audit deliverables doc

**Files:** Create `docs/reserved-namespace-audit.md` — route inventory, reserved-namespace inventory (L1 categories), collision report (prod `demo` + `user-<phone>`; staging clean), files modified, validation points, security matrix, residual risks, scaling recommendations. Commit.

### Task E2: Apply migrations + verify + PR

- [ ] Apply `v3.33_reserved_slugs.sql` to **staging then prod** via Supabase MCP `apply_migration` (idempotent). Verify `reserved_slugs` exists + `is_reserved_slug('demo')` false (no L2 row yet), RPCs updated.
- [ ] Full suites: `cd server && npm test` (expect ≥ 758 + new), `cd client && npm test` (expect ≥ 254 + new). Build client: `npm run build`.
- [ ] Push branch, open PR to `main` with summary + collision report. (Render + Vercel auto-deploy on merge.)

---

## Self-Review notes

- **Spec coverage:** Phases 1-2 → A3/E1 inventories; 3 → A3+B1+B2; 4 → C1-C5; 5 → A1/A2; 6 → A3 (exact) + B1/B2 (`is_prefix`); 7 → live audit + E1 + grandfather policy; 8 → D1/D2; 9 → B1 schema + D1 grant/reclaim; 10 → A1 matrix + C5; 11 → E1. ✓
- **Type consistency:** `normalizeSlug`, `formatError`, `isStaticReserved`, `checkAvailability({reason})`, `bustReservedCache` used consistently across tasks.
- **Grandfathering:** no task mutates existing usernames. ✓
- **Landmines:** unique migration name (dup-version history); never commit client lockfile; keep both RPC bodies verbatim when hardening; isolated worktree (drift).
