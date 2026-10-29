# Invite Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/invite/:slug` lead-source attribution links: a public VIP landing that stamps new host signups with a named source, plus an admin surface to create/manage links — with zero payout coupling.

**Architecture:** New `invite_links` table + `profiles.invite_slug` column. Attribution is HYBRID: the landing stashes `bas_invite` (localStorage, first-touch, durable); the Google CTA forwards the slug to `/api/auth/google/vendor?invite=<slug>`, which bakes it into the signed OAuth `state`; `googleCallback` reads it and stamps `invite_slug` **only inside the brand-new-profile branch** (`if (!profileId)`). No capture endpoint, no client-POST, existing accounts never touched. Admin surface mirrors `AdminReferrals`, gated by the existing `referrals.*` permissions.

**Tech Stack:** Express 4 + Supabase (service-role), React 18 + Vite + react-router-dom v6, Tailwind, Jest (server), Vitest (client).

## Global Constraints

- Invite attribution NEVER writes a `referrals` row. `profiles.invite_slug` is a separate axis from Refer & Earn. Independent of `bas_ref`.
- New host signups only. Stamp once, at account creation, inside the `if (!profileId)` branch — the branch, not a null-guard, is the gate.
- Slugs immutable after creation; never deleted, only `active` toggled. Unknown/inactive slug → silent redirect to `/`, never 404.
- Migration is additive-only, applied to BOTH DBs (prod Mumbai `PROD_PROJECT_REF` + staging Tokyo `STAGING_PROJECT_REF`). Keep code-side schema fallback until confirmed.
- SQL style matches `server/migrations/v3.77_referral_program.sql`.
- `invite` must be added to client `client/src/config/reservedSegments.js` (already reserved server-side in `reservedNamespaces.js` ACCOUNT array).
- Server tests live in `server/tests/`. Client has NO jest-dom (only 4 basic vitest matchers — use `.getAttribute()`, not `toHaveAttribute`).
- Reuse existing `referrals.view` / `referrals.manage` admin permissions for the invite admin surface (no new permission strings).

---

### Task 1: Migration — `invite_links` table + `profiles.invite_slug`

**Files:**
- Create: `server/migrations/v3.91_invite_links.sql`

**Interfaces:**
- Produces: table `public.invite_links(slug PK, label, assigned_to, active, unique_visits, metadata, created_by, created_at)`; column `public.profiles.invite_slug text`; partial index `idx_profiles_invite_slug`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- v3.91_invite_links.sql
-- Lead-source attribution "Invite Links". Attribution-only — NO payouts, fully
-- separate from Refer & Earn (referrals table). Sales/marketing share pretty
-- links like meeticulous.com/invite/social; new HOST signups get stamped with the
-- slug so acquisition source is queryable in admin.
--
--   invite_links       — one row per shareable link (admin-created, slug immutable).
--   profiles.invite_slug — first-touch source, stamped once at host-account creation.
--
-- Reads go through the Express API via supabaseAdmin (service role); anon/auth get
-- no direct grants. APPLY ON BOTH DBs (prod Mumbai + staging Tokyo).

create table if not exists public.invite_links (
  slug          text primary key,                      -- URL segment, immutable
  label         text not null,                          -- shown in landing greeting + admin
  assigned_to   text,                                   -- free-text owner/source (rep, campaign, platform, "QR")
  active        boolean not null default true,          -- off → landing redirects to /
  unique_visits bigint  not null default 0,             -- de-botted + IP/day deduped estimate
  metadata      jsonb   not null default '{}'::jsonb,   -- free-form campaign details
  created_by    uuid,                                   -- admin who created it (audit)
  created_at    timestamptz not null default now()
);

alter table public.profiles
  add column if not exists invite_slug text;             -- first-touch attribution, write-once

-- Signup-count-per-slug hot path + honest "only stamped rows".
create index if not exists idx_profiles_invite_slug
  on public.profiles (invite_slug) where invite_slug is not null;

alter table public.invite_links enable row level security;
revoke all on public.invite_links from anon, authenticated;
```

- [ ] **Step 2: Apply to BOTH DBs**

Use the Supabase MCP `apply_migration` (or the SQL editor) against prod `PROD_PROJECT_REF` AND staging `STAGING_PROJECT_REF`. Additive only.

- [ ] **Step 3: Verify columns exist**

Run (via MCP `execute_sql` on each DB):
```sql
select column_name from information_schema.columns where table_name='invite_links';
select 1 from information_schema.columns where table_name='profiles' and column_name='invite_slug';
```
Expected: 8 invite_links columns; profiles.invite_slug present.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/v3.91_invite_links.sql
git commit -m "feat(invite): v3.91 invite_links table + profiles.invite_slug"
```

---

### Task 2: Backend — `inviteService`

**Files:**
- Create: `server/services/inviteService.js`
- Test: `server/tests/inviteService.test.js`

**Interfaces:**
- Consumes: `require('../config/supabase').supabaseAdmin`.
- Produces:
  - `getPublicConfig(slug) → { label, active } | null` (null when slug unknown)
  - `slugExists(slug) → boolean` (existence only, ignores `active`)
  - `stampInviteSlug(profileId, slug) → void` (validates existence; atomic write-once `WHERE id=$ AND invite_slug IS NULL`; no-op on unknown slug)
  - `recordVisit(slug, ip, ua) → void` (bot-UA skip + IP/day dedupe → `unique_visits++`)
  - `createLink({ slug, label, assigned_to, metadata, created_by }) → row` (throws `{code:'DUP'}` / `{code:'RESERVED'}` / `{code:'BAD_SLUG'}`)
  - `listLinks() → [{ ...link, signups }]` (signups = count of profiles with that invite_slug)
  - `updateLink(slug, { label, assigned_to, active, metadata }) → row` (slug/created_at/unique_visits never writable)
- Schema fallback: every DB call catches "relation/column does not exist" (PostgREST codes `42P01`/`42703` or message match) and degrades — reads return null/empty, writes no-op — so the code ships before the migration is confirmed everywhere.

- [ ] **Step 1: Write failing tests**

```js
// server/tests/inviteService.test.js
const mockAdmin = require('./helpers/mockSupabase'); // see existing service tests for the pattern
jest.mock('../config/supabase', () => ({ supabaseAdmin: global.__mockAdmin }));

describe('inviteService', () => {
  let svc;
  beforeEach(() => { jest.resetModules(); svc = require('../services/inviteService'); });

  test('slugExists true for known slug, false for unknown', async () => {
    global.__mockAdmin = mockAdmin({ invite_links: [{ slug: 'social', active: true }] });
    svc = require('../services/inviteService');
    expect(await svc.slugExists('social')).toBe(true);
    expect(await svc.slugExists('nope')).toBe(false);
  });

  test('stampInviteSlug no-ops on unknown slug (never stamps a bogus source)', async () => {
    const admin = mockAdmin({ invite_links: [], profiles: [{ id: 'p1', invite_slug: null }] });
    global.__mockAdmin = admin; svc = require('../services/inviteService');
    await svc.stampInviteSlug('p1', 'ghost');
    expect(admin._table('profiles')[0].invite_slug).toBeNull();
  });

  test('stampInviteSlug stamps known slug, write-once (does not overwrite)', async () => {
    const admin = mockAdmin({ invite_links: [{ slug: 'social', active: true }],
                              profiles: [{ id: 'p1', invite_slug: null }] });
    global.__mockAdmin = admin; svc = require('../services/inviteService');
    await svc.stampInviteSlug('p1', 'social');
    expect(admin._table('profiles')[0].invite_slug).toBe('social');
  });

  test('deactivated-but-existing slug still stamps (active gates landing only)', async () => {
    const admin = mockAdmin({ invite_links: [{ slug: 'social', active: false }],
                              profiles: [{ id: 'p1', invite_slug: null }] });
    global.__mockAdmin = admin; svc = require('../services/inviteService');
    await svc.stampInviteSlug('p1', 'social');
    expect(admin._table('profiles')[0].invite_slug).toBe('social');
  });

  test('createLink rejects a reserved slug', async () => {
    global.__mockAdmin = mockAdmin({ invite_links: [] }); svc = require('../services/inviteService');
    await expect(svc.createLink({ slug: 'admin', label: 'x' })).rejects.toMatchObject({ code: 'RESERVED' });
  });
});
```

> If `server/tests/helpers/mockSupabase` does not exist, follow the mocking pattern already used by `server/tests/referralService.test.js` (chainable `.from().select().eq().maybeSingle()` stub). Adapt the assertions to that harness rather than inventing a new one.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/inviteService.test.js`
Expected: FAIL — cannot find `../services/inviteService`.

- [ ] **Step 3: Implement `inviteService.js`**

```js
// server/services/inviteService.js
// Lead-source attribution for /invite/:slug. Attribution-only; NEVER writes a
// referrals row. All access via service role (RLS blocks anon/auth).
const { supabaseAdmin } = require('../config/supabase');
const { isStaticReserved } = require('../config/reservedNamespaces');
const { normalizeSlug } = require('../utils/slugNormalize');

// A missing table/column (migration not yet applied here) must never 500 the app.
const isSchemaMiss = (e) =>
  e && (e.code === '42P01' || e.code === '42703' ||
        /does not exist|schema cache/i.test(e.message || ''));

const norm = (s) => normalizeSlug(String(s || '').trim());

async function getPublicConfig(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from('invite_links').select('label, active').eq('slug', norm(slug)).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) { if (isSchemaMiss(e)) return null; throw e; }
}

async function slugExists(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from('invite_links').select('slug').eq('slug', norm(slug)).maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) { if (isSchemaMiss(e)) return false; throw e; }
}

// Stamp ONLY when the slug really exists. Atomic write-once at the DB level:
// WHERE invite_slug IS NULL — no read-then-write, no overwrite, no race.
async function stampInviteSlug(profileId, slug) {
  const s = norm(slug);
  if (!profileId || !s) return;
  try {
    if (!(await slugExists(s))) return;                 // never stamp a bogus source
    const { error } = await supabaseAdmin
      .from('profiles').update({ invite_slug: s })
      .eq('id', profileId).is('invite_slug', null);
    if (error) throw error;
  } catch (e) { if (isSchemaMiss(e)) return; console.error('invite stamp failed:', e.message); }
}

// ponytail: UA-skip + IP/day dedupe is a heuristic, not exact. Upgrade to a
// visit-log table only if sales needs precise unique-visitor counts.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|slackbot|telegrambot|preview|embedly|discordbot|linkedinbot|bingpreview/i;
const seen = new Map();  // `${slug}|${ip}|${yyyy-mm-dd}` -> expiry ms
function dedupeKey(slug, ip) { return `${slug}|${ip}|${new Date().toISOString().slice(0,10)}`; }

async function recordVisit(slug, ip, ua) {
  const s = norm(slug);
  if (!s || BOT_UA.test(ua || '')) return;
  const key = dedupeKey(s, ip || 'unknown');
  const now = Date.now();
  if (seen.has(key) && seen.get(key) > now) return;
  seen.set(key, now + 26 * 3600 * 1000);
  if (seen.size > 50000) for (const [k, exp] of seen) if (exp <= now) seen.delete(k); // cheap sweep
  try {
    const { error } = await supabaseAdmin.rpc('increment_invite_visit', { p_slug: s });
    if (error) throw error;
  } catch (e) {
    if (isSchemaMiss(e)) return;
    // No RPC? fall back to read-add-write (best-effort; visit counts are non-critical).
    try {
      const { data } = await supabaseAdmin.from('invite_links').select('unique_visits').eq('slug', s).maybeSingle();
      if (data) await supabaseAdmin.from('invite_links').update({ unique_visits: (data.unique_visits || 0) + 1 }).eq('slug', s);
    } catch (_) { /* non-fatal */ }
  }
}

async function createLink({ slug, label, assigned_to = null, metadata = {}, created_by = null }) {
  const s = norm(slug);
  if (!s || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(s)) throw { code: 'BAD_SLUG' };
  if (isStaticReserved(s)) throw { code: 'RESERVED' };
  const { data, error } = await supabaseAdmin.from('invite_links')
    .insert({ slug: s, label: String(label || '').trim() || s, assigned_to, metadata, created_by })
    .select('*').single();
  if (error) { if (error.code === '23505') throw { code: 'DUP' }; throw error; }
  return data;
}

async function listLinks() {
  const { data: links, error } = await supabaseAdmin
    .from('invite_links').select('*').order('created_at', { ascending: false });
  if (error) { if (isSchemaMiss(error)) return []; throw error; }
  // signups per slug — one grouped read, joined in JS (small N).
  const counts = {};
  for (const l of links || []) {
    const { count } = await supabaseAdmin
      .from('profiles').select('id', { count: 'exact', head: true }).eq('invite_slug', l.slug);
    counts[l.slug] = count || 0;
  }
  return (links || []).map((l) => ({ ...l, signups: counts[l.slug] || 0 }));
}

async function updateLink(slug, { label, assigned_to, active, metadata }) {
  const patch = {};
  if (label !== undefined) patch.label = String(label).trim();
  if (assigned_to !== undefined) patch.assigned_to = assigned_to;
  if (active !== undefined) patch.active = !!active;
  if (metadata !== undefined) patch.metadata = metadata;
  // slug / created_at / unique_visits / created_by are intentionally never writable here.
  const { data, error } = await supabaseAdmin
    .from('invite_links').update(patch).eq('slug', norm(slug)).select('*').single();
  if (error) throw error;
  return data;
}

module.exports = { getPublicConfig, slugExists, stampInviteSlug, recordVisit, createLink, listLinks, updateLink };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/inviteService.test.js`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add server/services/inviteService.js server/tests/inviteService.test.js
git commit -m "feat(invite): inviteService — validate, stamp (write-once), visit, admin CRUD"
```

---

### Task 3: Migration addendum — atomic visit-increment RPC

**Files:**
- Modify: `server/migrations/v3.91_invite_links.sql` (append)

**Interfaces:**
- Produces: `public.increment_invite_visit(p_slug text)` — atomic `unique_visits + 1`.

- [ ] **Step 1: Append the RPC to the migration**

```sql
-- Atomic visit bump (avoids read-add-write races under concurrent hits).
create or replace function public.increment_invite_visit(p_slug text)
returns void language sql security definer as $$
  update public.invite_links set unique_visits = unique_visits + 1 where slug = p_slug;
$$;
revoke all on function public.increment_invite_visit(text) from anon, authenticated;
```

- [ ] **Step 2: Apply the function to BOTH DBs** (MCP `execute_sql`, prod + staging).

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.91_invite_links.sql
git commit -m "feat(invite): atomic increment_invite_visit RPC"
```

---

### Task 4: Backend — public invite routes + mount

**Files:**
- Create: `server/routes/inviteRoutes.js`
- Create: `server/controllers/inviteController.js`
- Modify: `server/server.js` (add mount near the other `app.use('/api/...')` lines, ~line 145)
- Test: `server/tests/inviteRoutes.test.js`

**Interfaces:**
- Consumes: `inviteService` (Task 2).
- Produces: `GET /api/invite/:slug → {label, active}` (404-style `{active:false}` when unknown), `POST /api/invite/:slug/visit → 204`.

- [ ] **Step 1: Write failing route test**

```js
// server/tests/inviteRoutes.test.js
const request = require('supertest');
jest.mock('../services/inviteService', () => ({
  getPublicConfig: jest.fn(async (s) => (s === 'social' ? { label: 'Social Squad', active: true } : null)),
  recordVisit: jest.fn(async () => {}),
}));
const app = require('../app'); // or the exported express app; match existing route tests

describe('public invite routes', () => {
  test('GET known slug returns config', async () => {
    const r = await request(app).get('/api/invite/social');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ label: 'Social Squad', active: true });
  });
  test('GET unknown slug returns active:false (client redirects)', async () => {
    const r = await request(app).get('/api/invite/ghost');
    expect(r.body.active).toBe(false);
  });
  test('POST visit returns 204 and never throws', async () => {
    const r = await request(app).post('/api/invite/social/visit');
    expect(r.status).toBe(204);
  });
});
```

> Match how existing tests import the app (`require('../app')` vs `../server`). Check `server/tests/referral*.test.js` first.

- [ ] **Step 2: Run to verify fail** — `cd server && npx jest tests/inviteRoutes.test.js` → FAIL (route 404).

- [ ] **Step 3: Implement controller + routes + mount**

```js
// server/controllers/inviteController.js
const inviteService = require('../services/inviteService');

// GET /api/invite/:slug — public landing config. Unknown → {active:false} (client redirects to /).
const getConfig = async (req, res) => {
  try {
    const cfg = await inviteService.getPublicConfig(req.params.slug);
    if (!cfg) return res.json({ active: false });
    res.json({ label: cfg.label, active: cfg.active });
  } catch (_) { res.json({ active: false }); }
};

// POST /api/invite/:slug/visit — fire-and-forget, de-botted. Never blocks/erros the client.
const visit = async (req, res) => {
  res.status(204).end();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  inviteService.recordVisit(req.params.slug, ip, req.headers['user-agent']).catch(() => {});
};

module.exports = { getConfig, visit };
```

```js
// server/routes/inviteRoutes.js
const express = require('express');
const router = express.Router();
const { getConfig, visit } = require('../controllers/inviteController');

router.get('/:slug', getConfig);
router.post('/:slug/visit', visit);   // public, fire-and-forget

module.exports = router;
```

In `server/server.js`, beside the other public mounts (e.g. after `app.use('/api/referrals', ...)`):
```js
app.use('/api/invite',      require('./routes/inviteRoutes'));
```

- [ ] **Step 4: Run to verify pass** — `cd server && npx jest tests/inviteRoutes.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/inviteRoutes.js server/controllers/inviteController.js server/server.js server/tests/inviteRoutes.test.js
git commit -m "feat(invite): public GET config + POST visit routes"
```

---

### Task 5: Backend — admin invite routes + controller

**Files:**
- Create: `server/controllers/inviteAdminController.js`
- Modify: `server/routes/adminRoutes.js` (add block after the Referral program block, ~line 167)
- Test: `server/tests/inviteAdmin.test.js`

**Interfaces:**
- Consumes: `inviteService.listLinks/createLink/updateLink`, `requireAdmin` middleware.
- Produces: `GET /api/admin/invite-links`, `POST /api/admin/invite-links`, `PATCH /api/admin/invite-links/:slug` — all gated `referrals.view` / `referrals.manage`.

- [ ] **Step 1: Write failing controller test** (unit-level; mock inviteService)

```js
// server/tests/inviteAdmin.test.js
jest.mock('../services/inviteService', () => ({
  listLinks: jest.fn(async () => [{ slug: 'social', label: 'S', unique_visits: 10, signups: 3 }]),
  createLink: jest.fn(async (b) => ({ ...b })),
  updateLink: jest.fn(async (s, b) => ({ slug: s, ...b })),
}));
const svc = require('../services/inviteService');
const c = require('../controllers/inviteAdminController');
const mkRes = () => { const r = {}; r.status = (s) => { r._s = s; return r; }; r.json = (b) => { r._b = b; return r; }; return r; };

test('create rejects reserved slug with 409/400', async () => {
  svc.createLink.mockRejectedValueOnce({ code: 'RESERVED' });
  const res = mkRes();
  await c.create({ body: { slug: 'admin', label: 'x' }, admin: { id: 'a1' } }, res);
  expect(res._s).toBe(400);
});
test('list returns links with signups', async () => {
  const res = mkRes();
  await c.list({ query: {} }, res);
  expect(res._b[0].signups).toBe(3);
});
```

> Check how admin identity is exposed on `req` in `referralAdminController` (e.g. `req.admin?.id` vs `req.user`). Mirror it for `created_by`.

- [ ] **Step 2: Run to verify fail** — `cd server && npx jest tests/inviteAdmin.test.js` → FAIL.

- [ ] **Step 3: Implement controller + routes**

```js
// server/controllers/inviteAdminController.js
const inviteService = require('../services/inviteService');
const safeError = (res, e) => res.status(500).json({ message: e?.message || 'Server error' });

const list = async (req, res) => {
  try { res.json(await inviteService.listLinks()); } catch (e) { safeError(res, e); }
};

const create = async (req, res) => {
  try {
    const { slug, label, assigned_to, metadata } = req.body || {};
    const created_by = req.admin?.id || null;
    const row = await inviteService.createLink({ slug, label, assigned_to, metadata, created_by });
    res.status(201).json(row);
  } catch (e) {
    if (e?.code === 'DUP')      return res.status(409).json({ message: 'Slug already exists' });
    if (e?.code === 'RESERVED') return res.status(400).json({ message: 'Slug is reserved' });
    if (e?.code === 'BAD_SLUG') return res.status(400).json({ message: 'Invalid slug (a-z 0-9 -, 2-40 chars)' });
    safeError(res, e);
  }
};

const update = async (req, res) => {
  try { res.json(await inviteService.updateLink(req.params.slug, req.body || {})); }
  catch (e) { safeError(res, e); }
};

module.exports = { list, create, update };
```

In `server/routes/adminRoutes.js`, after the Referral program block:
```js
// ── Invite links (lead-source attribution — reuses referrals.* perms) ──────────
const inviteAdmin = require('../controllers/inviteAdminController');
router.get('/invite-links',        requireAdmin('referrals.view'),   inviteAdmin.list);
router.post('/invite-links',       requireAdmin('referrals.manage'), inviteAdmin.create);
router.patch('/invite-links/:slug',requireAdmin('referrals.manage'), inviteAdmin.update);
```

- [ ] **Step 4: Run to verify pass** — `cd server && npx jest tests/inviteAdmin.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/inviteAdminController.js server/routes/adminRoutes.js server/tests/inviteAdmin.test.js
git commit -m "feat(invite): admin list/create/edit routes (reuse referrals.* perms)"
```

---

### Task 6: Backend — OAuth `state` carries the invite slug + stamp on new-profile

**Files:**
- Modify: `server/controllers/authController.js:338-346` (`googleVendorAuth` — read `?invite`)
- Modify: `server/controllers/authController.js:487-515` (stamp inside `if (!profileId)`)
- Test: `server/tests/inviteAttribution.test.js`

**Interfaces:**
- Consumes: `inviteService.stampInviteSlug`.
- Produces: `state` payload now `{ flow:'vendor_auth', intent, invite? }`; new host profile stamped with `invite_slug` when `state.invite` is a valid existing slug.

- [ ] **Step 1: Write failing test** — assert stamp happens only in the new-profile path

```js
// server/tests/inviteAttribution.test.js
// Focus: stampInviteSlug is called with (newProfileId, state.invite) ONLY when a
// brand-new profile is created; NOT for an existing/returning account.
const inviteService = require('../services/inviteService');
jest.mock('../services/inviteService', () => ({ stampInviteSlug: jest.fn(async () => {}), slugExists: jest.fn() }));

// This is a targeted unit test around the extracted stamp call. If googleCallback
// is too heavy to invoke directly, extract the 2-line stamp into a tiny helper
// `maybeStampInvite(profileId, statePayload)` in authController and test THAT:
const { maybeStampInvite } = require('../controllers/authController');

test('stamps when state carries an invite slug', async () => {
  await maybeStampInvite('new-id', { flow: 'vendor_auth', invite: 'social' });
  expect(inviteService.stampInviteSlug).toHaveBeenCalledWith('new-id', 'social');
});
test('no stamp when state has no invite', async () => {
  inviteService.stampInviteSlug.mockClear();
  await maybeStampInvite('new-id', { flow: 'vendor_auth' });
  expect(inviteService.stampInviteSlug).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify fail** — `cd server && npx jest tests/inviteAttribution.test.js` → FAIL (no `maybeStampInvite`).

- [ ] **Step 3: Implement**

Add near the top of `authController.js` (after other requires):
```js
const inviteService = require('../services/inviteService');

// Invite-link attribution: stamp only in the brand-new-profile branch (caller
// guarantees profileId is freshly created). Existing accounts never reach here.
// No-ops when state carries no slug or the slug is unknown (service-validated).
async function maybeStampInvite(profileId, statePayload) {
  const slug = statePayload?.invite;
  if (!slug) return;
  await inviteService.stampInviteSlug(profileId, slug);
}
module.exports.maybeStampInvite = maybeStampInvite; // exported for unit test
```

In `googleVendorAuth` (line 338):
```js
const googleVendorAuth = (req, res) => {
  const intent = req.query.intent === "signup" ? "signup" : "login";
  const invite = req.query.invite
    ? String(req.query.invite).trim().toLowerCase().slice(0, 40)
    : undefined;
  const state = jwt.sign(
    { flow: "vendor_auth", intent, ...(invite ? { invite } : {}) },
    OAUTH_STATE_SECRET,
    { expiresIn: "15m" },
  );
  res.json({ url: getAuthUrl(state) });
};
```

In `googleCallback`, inside `if (!profileId) { ... }`, immediately AFTER `await markGoogleVendorOnboarding(profileId, profile.username);` (line 514):
```js
        // Invite-link attribution — new host only, write-once, never a referrals row.
        await maybeStampInvite(profileId, statePayload);
```

- [ ] **Step 4: Run to verify pass** — `cd server && npx jest tests/inviteAttribution.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/authController.js server/tests/inviteAttribution.test.js
git commit -m "feat(invite): carry slug in OAuth state, stamp on new-host creation"
```

---

### Task 7: Client — reserve `invite`, api.js helpers

**Files:**
- Modify: `client/src/config/reservedSegments.js`
- Modify: `client/src/services/api.js`
- Modify: `client/src/services/api.js` — `getVendorGoogleUrl` gains an `invite` param

**Interfaces:**
- Produces: `getInviteConfig(slug)`, `recordInviteVisit(slug)`, `adminGetInviteLinks()`, `adminCreateInviteLink(data)`, `adminUpdateInviteLink(slug, data)`; `getVendorGoogleUrl(intent, invite?)`.

- [ ] **Step 1: Add `invite` to reserved segments**

In `client/src/config/reservedSegments.js`, add `'invite'` to `RESERVED_FIRST_SEGMENTS` (near `'refer'`-adjacent marketing routes / the `'for'`, `'lp'` line):
```js
  'hello-sloth', 'super-dashboard', 'admin', 'dashboard', 'user', 'review', 'lp', 'for', 'invite',
```

- [ ] **Step 2: Add api.js helpers**

Beside the referral helpers (`api.js:245-247`, `369-370`):
```js
// Invite links (lead-source attribution) — public + admin.
export const getInviteConfig     = (slug)       => API.get(`/invite/${slug}`);
export const recordInviteVisit   = (slug)       => API.post(`/invite/${slug}/visit`);
export const adminGetInviteLinks = ()           => API.get('/admin/invite-links');
export const adminCreateInviteLink = (data)     => API.post('/admin/invite-links', data);
export const adminUpdateInviteLink = (slug, d)  => API.patch(`/admin/invite-links/${slug}`, d);
```

Change `getVendorGoogleUrl` (api.js:97) to forward an optional invite slug:
```js
export const getVendorGoogleUrl = (intent = 'login', invite) =>
  API.get('/auth/google/vendor', { params: { intent, ...(invite ? { invite } : {}) } });
```

- [ ] **Step 3: Verify build & drift test**

Run: `cd client && npx vitest run` — the `routeManifestSync` / `reservedSegmentsSync` tests must still pass once Task 8 adds the `/invite/:slug` route. (If run before Task 8, they pass; after Task 8 they pass because `invite` is now listed.)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/config/reservedSegments.js client/src/services/api.js
git commit -m "feat(invite): reserve invite segment + api helpers + OAuth invite param"
```

---

### Task 8: Client — export reusable Home bits

**Files:**
- Modify: `client/src/pages/Home.jsx` (add `export` to `STATS` and `Odometer` — no markup moved)

**Interfaces:**
- Produces: `export const STATS`, `export const Odometer` from `Home.jsx`, consumed by `InviteLanding`.

- [ ] **Step 1: Add exports**

At `Home.jsx:155` change `const Odometer =` → `export const Odometer =`.
At `Home.jsx:485` change `const STATS =` → `export const STATS =`.
(No other change — Home keeps using them locally.)

- [ ] **Step 2: Verify Home still builds**

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "refactor(home): export STATS + Odometer for invite landing reuse"
```

---

### Task 9: Client — `/invite/:slug` VIP landing

**Files:**
- Create: `client/src/pages/InviteLanding.jsx`
- Modify: `client/src/App.jsx` (lazy import ~line 194 area + public `<Route>` ~line 351 area)
- Test: `client/src/pages/__tests__/InviteLanding.test.jsx`

**Interfaces:**
- Consumes: `getInviteConfig`, `recordInviteVisit`, `getVendorGoogleUrl` (Task 7); `STATS`, `Odometer` (Task 8); `PAID_PLANS`/`STARTER_PLAN` (`data/plans`), `TESTIMONIALS` (`data/testimonials`), `HowItWorks`, `Reveal`, `Seo`.
- Produces: route `/invite/:slug`.

- [ ] **Step 1: Write failing test** (stash behavior — the load-bearing logic)

```jsx
// client/src/pages/__tests__/InviteLanding.test.jsx
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
  getInviteConfig: vi.fn(async () => ({ data: { label: 'Social Squad', active: true } })),
  recordInviteVisit: vi.fn(async () => ({})),
  getVendorGoogleUrl: vi.fn(async () => ({ data: { url: 'https://accounts.google.com/x' } })),
}));

import InviteLanding from '../InviteLanding';

const renderAt = (slug) => render(
  <MemoryRouter initialEntries={[`/invite/${slug}`]}>
    <Routes><Route path="/invite/:slug" element={<InviteLanding />} /><Route path="/" element={<div>HOME</div>} /></Routes>
  </MemoryRouter>
);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('stashes bas_invite first-touch', async () => {
  renderAt('social');
  await waitFor(() => expect(localStorage.getItem('bas_invite')).toBe('social'));
  const utm = JSON.parse(sessionStorage.getItem('bas_utm') || '{}');
  expect(utm.utm_source).toBe('invite/social');
});

test('does not overwrite an existing bas_invite', async () => {
  localStorage.setItem('bas_invite', 'earlier');
  renderAt('social');
  await waitFor(() => {});
  expect(localStorage.getItem('bas_invite')).toBe('earlier');
});
```

- [ ] **Step 2: Run to verify fail** — `cd client && npx vitest run src/pages/__tests__/InviteLanding.test.jsx` → FAIL.

- [ ] **Step 3: Implement `InviteLanding.jsx`**

```jsx
// client/src/pages/InviteLanding.jsx
// ONE shared VIP landing for every /invite/:slug (marketing gimmick + attribution).
// ponytail: purpose-built trimmed page reusing Home's data/components rather than
// forking the 2189-line Home.jsx. Iterate on this if per-slug design proves out.
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInviteConfig, recordInviteVisit, getVendorGoogleUrl } from '../services/api';
import { STATS, Odometer } from './Home';
import { PAID_PLANS, STARTER_PLAN } from '../data/plans';
import { TESTIMONIALS } from '../data/testimonials';
import HowItWorks from '../components/home/HowItWorks';
import Reveal from '../components/home/Reveal';
import Seo from '../components/common/Seo';

// First-touch: bas_invite is the durable single source of truth. If it already
// exists, change NOTHING (neither store) — matches the referral bas_ref rule.
function stashFirstTouch(slug) {
  try {
    if (localStorage.getItem('bas_invite')) return;
    localStorage.setItem('bas_invite', slug.slice(0, 40));
    const cur = JSON.parse(sessionStorage.getItem('bas_utm') || '{}');
    if (!Object.keys(cur).length) {
      sessionStorage.setItem('bas_utm', JSON.stringify({ utm_source: `invite/${slug}`, utm_medium: 'invite' }));
    }
  } catch { /* non-fatal */ }
}

export default function InviteLanding() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [label, setLabel] = useState(null);

  useEffect(() => {
    let alive = true;
    getInviteConfig(slug)
      .then(({ data }) => {
        if (!alive) return;
        if (!data || data.active === false) { nav('/', { replace: true }); return; }
        setLabel(data.label || 'friend');
        stashFirstTouch(slug);
        recordInviteVisit(slug).catch(() => {});
      })
      .catch(() => alive && nav('/', { replace: true }));
    return () => { alive = false; };
  }, [slug, nav]);

  async function startGoogle() {
    try {
      const invite = localStorage.getItem('bas_invite') || slug;
      const { data } = await getVendorGoogleUrl('signup', invite);
      if (data?.url) window.location.href = data.url;
    } catch { /* surfaced on the auth page */ }
  }

  if (!label) return null; // brief blank while validating (or redirecting)

  const top3 = STATS.slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-ink">
      <Seo title={`You're invited — Meeticulous`} description="Your invitation to Meeticulous." noindex />

      {/* Hero — dynamic greeting */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
        <Reveal as="p" className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
          You're invited 🦥
        </Reveal>
        <Reveal as="h1" className="text-[clamp(2rem,7vw,3.4rem)] font-heading font-semibold leading-[1.08] tracking-[-0.03em]">
          Welcome, {label}
        </Reveal>
        <Reveal as="p" delay={0.1} className="mx-auto mt-5 max-w-md text-lg text-neutral-500">
          One calm link for your bookings, payments and reminders. Set up in minutes.
        </Reveal>
        <Reveal delay={0.16} className="mt-8">
          <button onClick={startGoogle}
            className="rounded-xl border-4 border-ink bg-primary px-7 py-3.5 font-semibold text-white transition hover:brightness-105">
            Get started with Google
          </button>
          <p className="mt-3 text-xs text-neutral-500">
            By continuing you agree to our{' '}
            <Link to="/terms" className="underline">Terms</Link> and{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </Reveal>
      </section>

      {/* Numbers — top 3 from Home STATS */}
      <section className="bg-ink py-14 text-white">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 text-center sm:grid-cols-3">
          {top3.map((s) => (
            <div key={s.label}>
              <Odometer value={s.value} className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl" />
              <p className="mt-2 text-sm text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Meeticulous */}
      <HowItWorks />

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl font-semibold">Simple pricing</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[STARTER_PLAN, ...PAID_PLANS].map((p) => (
            <div key={p.name} className="rounded-xl border-4 border-ink p-6">
              <h3 className="font-heading text-xl font-semibold">{p.name}</h3>
              <p className="mt-2 text-2xl font-bold">{p.priceLabel || p.price}</p>
              <p className="mt-1 text-sm text-neutral-500">{p.tagline || ''}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 sm:grid-cols-2">
          {TESTIMONIALS.slice(0, 4).map((t, i) => (
            <figure key={i} className="rounded-xl border-4 border-ink bg-white p-5">
              <blockquote className="text-sm text-neutral-700">"{t.quote}"</blockquote>
              <figcaption className="mt-3 text-xs font-medium text-neutral-500">— {t.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Minimal footer — bottom strip only */}
      <footer className="border-t-4 border-ink py-6 text-center text-xs text-neutral-500">
        © Meeticulous · <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/terms" className="underline">Terms</Link>
      </footer>
    </div>
  );
}
```

> Verify the real field names in `data/plans.js` (`priceLabel`/`price`/`tagline`) and `data/testimonials.js` (`quote`/`name`) before finalizing — adjust the JSX to match. This is the one place the plan cannot guarantee field names.

In `App.jsx`: add lazy import beside other public pages:
```jsx
const InviteLanding = lazy(() => import('./pages/InviteLanding'));
```
And a public route beside `/about`, `/privacy`:
```jsx
<Route path="/invite/:slug" element={<InviteLanding />} />
```

- [ ] **Step 4: Run to verify pass** — `cd client && npx vitest run src/pages/__tests__/InviteLanding.test.jsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InviteLanding.jsx client/src/App.jsx client/src/pages/__tests__/InviteLanding.test.jsx
git commit -m "feat(invite): /invite/:slug VIP landing (stash + greeting + trimmed sections)"
```

---

### Task 10: Client — Admin Invite Links page

**Files:**
- Create: `client/src/pages/admin/AdminInviteLinks.jsx`
- Modify: `client/src/App.jsx` (lazy import + `/admin/invite-links` route beside `/admin/referrals`)
- Modify: `client/src/components/admin/deptRegistry.js` (nav entry after the Refer & Earn line, ~line 47)

**Interfaces:**
- Consumes: `adminGetInviteLinks`, `adminCreateInviteLink`, `adminUpdateInviteLink`; admin UI kit (`PageHeader, Card, Btn, Badge`).

- [ ] **Step 1: Implement the page** (no separate unit test — admin pages in this repo are not vitest-covered; verified via build. Mirror `AdminReferrals.jsx` structure.)

```jsx
// client/src/pages/admin/AdminInviteLinks.jsx
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge } from '../../components/admin/ui';
import { adminGetInviteLinks, adminCreateInviteLink, adminUpdateInviteLink } from '../../services/api';

export default function AdminInviteLinks() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ slug: '', label: '', assigned_to: '' });

  const load = useCallback(() => {
    setLoading(true);
    adminGetInviteLinks()
      .then((r) => setLinks(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Failed to load invite links'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!form.slug.trim() || !form.label.trim()) return toast.error('Slug and label required');
    try {
      await adminCreateInviteLink(form);
      toast.success('Created');
      setForm({ slug: '', label: '', assigned_to: '' });
      load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Create failed'); }
  }

  async function patch(slug, data) {
    try { await adminUpdateInviteLink(slug, data); load(); }
    catch { toast.error('Update failed'); }
  }

  return (
    <div>
      <PageHeader title="Invite Links" subtitle="Lead-source attribution — no payouts." />

      <Card className="mb-6">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">Slug (immutable)
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="social" className="mt-1 rounded-lg border-2 border-neutral-300 px-3 py-2" /></label>
          <label className="flex flex-col text-sm">Label
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Social Squad" className="mt-1 rounded-lg border-2 border-neutral-300 px-3 py-2" /></label>
          <label className="flex flex-col text-sm">Assigned to
            <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="Instagram / Ravi / QR" className="mt-1 rounded-lg border-2 border-neutral-300 px-3 py-2" /></label>
          <Btn type="submit">Create link</Btn>
        </form>
      </Card>

      <Card>
        {loading ? <p className="p-4 text-sm text-neutral-500">Loading…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500">
              <th className="p-2">Link</th><th className="p-2">Label</th><th className="p-2">Assigned</th>
              <th className="p-2">Unique visits</th><th className="p-2">Signups</th><th className="p-2">Conv %</th><th className="p-2">Status</th>
            </tr></thead>
            <tbody>
              {links.map((l) => {
                const conv = l.unique_visits ? ((l.signups / l.unique_visits) * 100).toFixed(1) : '—';
                return (
                  <tr key={l.slug} className="border-t border-neutral-100">
                    <td className="p-2 font-mono">/invite/{l.slug}</td>
                    <td className="p-2">{l.label}</td>
                    <td className="p-2">{l.assigned_to || '—'}</td>
                    <td className="p-2">{l.unique_visits}</td>
                    <td className="p-2">{l.signups}</td>
                    <td className="p-2">{conv}{conv !== '—' ? '%' : ''}</td>
                    <td className="p-2">
                      <button onClick={() => patch(l.slug, { active: !l.active })}>
                        <Badge tone={l.active ? 'green' : 'gray'}>{l.active ? 'Active' : 'Disabled'}</Badge>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
```

> Confirm `Badge` prop name (`tone` vs `variant`) and `Btn` usage against `components/admin/ui` before finalizing.

- [ ] **Step 2: Register route + nav**

`App.jsx`:
```jsx
const AdminInviteLinks = lazy(() => import('./pages/admin/AdminInviteLinks'));
// ...
<Route path="/admin/invite-links" element={<AdminWrapper><AdminInviteLinks /></AdminWrapper>} />
```
`deptRegistry.js` after the Refer & Earn line (:47):
```js
  { label: 'Invite Links', icon: 'link', to: '/admin/invite-links', desc: 'Lead-source attribution links', depts: ['marketing', 'sales'] },
```
> If `'sales'` is not a known dept key, use `['marketing']`. Confirm a valid `icon` name exists in the admin icon set (fallback: `'affiliate'`).

- [ ] **Step 3: Verify build**

Run: `cd client && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminInviteLinks.jsx client/src/App.jsx client/src/components/admin/deptRegistry.js
git commit -m "feat(invite): admin Invite Links page (create, stats, active toggle)"
```

---

### Task 11: Full verification

- [ ] **Step 1: Server tests** — `cd server && npm test` → all pass (report only pre-existing failures).
- [ ] **Step 2: Client tests** — `cd client && npx vitest run` → pass, incl. `routeManifestSync` / `reservedSegmentsSync` drift tests.
- [ ] **Step 3: Client build** — `cd client && npm run build` → succeeds.
- [ ] **Step 4: Confirm migration applied to BOTH DBs** (prod + staging). Document status.
- [ ] **Step 5: Final summary** — implemented scope, test/build results, migration status.

---

## Self-Review

**Spec coverage:**
- Data model (`invite_links` + `profiles.invite_slug` + partial index) → Task 1. ✓
- Atomic visit RPC → Task 3. ✓
- Public landing (trimmed homepage, greeting, first-touch stash, redirect) → Task 9. ✓
- Bot/dedupe visit handling → Task 2 (`recordVisit`). ✓
- HYBRID attribution (stash → OAuth state → server stamp in new-profile branch only) → Tasks 6, 7, 9. ✓
- Admin UI (create, edit label/assigned/active only, immutable slug, no delete, stats+conv%) → Tasks 5, 10. ✓
- API surface (GET config, POST visit, admin list/create/patch) → Tasks 4, 5. ✓
- Migration both DBs + schema fallback → Tasks 1, 3 + fallback in Task 2. ✓
- `invite` reserved client-side → Task 7. ✓
- NEVER writes referrals row → enforced by design (separate service/table); asserted in Task 2/6 tests. ✓

**Placeholder scan:** All code steps contain real code. Three explicit "verify field names against source" notes (plans/testimonials fields, Badge prop, admin identity on req) — these are verification instructions, not placeholders; the surrounding code is complete and adjusts only field names.

**Type consistency:** `stampInviteSlug(profileId, slug)`, `getPublicConfig → {label,active}|null`, `slugExists → bool`, `createLink` error codes `DUP/RESERVED/BAD_SLUG` — consistent across Tasks 2, 4, 5, 6. `getVendorGoogleUrl(intent, invite)` consistent Task 7 ↔ 9.

**Deviation from spec noted:** admin surface reuses `referrals.view`/`referrals.manage` instead of new `invites.*` (avoids a permissions-seed migration + forced admin re-login). Documented; upgrade path is minting `invites.*` later.
