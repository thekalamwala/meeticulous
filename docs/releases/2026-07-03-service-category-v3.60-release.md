# Release Runbook — Service Category Integrity (v3.60 pipeline)

**Feature:** composite-FK category integrity + `/services` SEO pages (PR #260, branch `feat/service-categories`).
**Strategy:** zero-downtime Expand → Deploy → Backfill → Validate → Enforce → (later) Contract.
**DBs:** staging Tokyo `STAGING_PROJECT_REF` first, then prod Mumbai `PROD_PROJECT_REF`.
**Migration files (all in `server/migrations/`):**
`v3.60_service_category_expand.sql` · `v3.61_service_category_backfill.sql` · `v3.62_service_category_validate.sql` · `v3.63_service_category_enforce.sql` · `v3.63_service_category_rollback.sql`.

Migrations are applied by a human in the Supabase SQL Editor. This runbook does not run DDL against any database.

---

## Why the original single-file v3.60 was not zero-downtime

The first cut bundled expand + backfill + three constraints in one transaction. Two consequences:

1. **Compatibility window.** The currently-deployed server writes `services.category` with no `primary_category`. The new `chk_category_pair` CHECK and `fk_services_category` composite FK reject exactly that shape (SQLSTATE 23514 / 23503). Applying the bundle before the new server is live means every categorised service create/edit 500s until deploy — an outage proportional to the deploy gap. The legacy-retry regexes in the writers only match *missing-column* errors (42703), not constraint violations, so they do not save it.
2. **Lock duration.** A plain `ADD CONSTRAINT FOREIGN KEY/CHECK` scans the whole table to validate while holding `ACCESS EXCLUSIVE` — blocking reads and writes for the scan.

The split fixes both: expand is pure-additive (invisible to old code); enforcement is separated so it runs only after the new server is live and all rows already conform; and each constraint uses `ADD ... NOT VALID` + `VALIDATE CONSTRAINT` so the heavy validation runs under `SHARE UPDATE EXCLUSIVE` (concurrent reads and writes continue).

> **Honest note on `NOT VALID`:** it still enforces the constraint on *new/updated* rows immediately; it only defers checking *existing* rows until `VALIDATE`. It is a lock optimisation, **not** a backward-compat shim. The compatibility guarantee comes entirely from ordering (server before enforce), not from `NOT VALID`.

---

## Migration classification

| Statement | Phase | File |
|---|---|---|
| `ADD COLUMN services.primary_category` (nullable) | Expand | v3.60 |
| `ADD COLUMN service_categories.description / icon` | Expand | v3.60 |
| `CREATE INDEX CONCURRENTLY idx_services_prof_cat` | Expand | v3.60 |
| delete orphan `service_categories` | Backfill | v3.61 |
| stamp `services.primary_category` | Backfill | v3.61 |
| clear stale unpaired rows | Backfill | v3.61 |
| integrity preconditions | Validate (gate) | v3.62 |
| `fk_sc_primary`, `fk_services_category`, `chk_category_pair` | Enforce | v3.63 |
| drop `services.primary_category` etc. | Contract (later release) | not in this release |

---

## Deployment sequence (run top to bottom, per DB, staging first)

Each step lists its **health check** and its **rollback**. Do not advance to the next step until the current step's health check is green.

### Step 1 — Apply `v3.60` expand
- **Action:** run `v3.60_service_category_expand.sql`. (The `CREATE INDEX CONCURRENTLY` sits after `COMMIT`; if your client wraps everything in one implicit transaction, run that final statement on its own.)
- **Why safe now:** only nullable columns + a concurrent index. The old server neither reads nor writes them; nothing rejects any existing write. Applying before deploy is fine (and lets the new server find the columns already present).
- **Health check:** `SELECT column_name FROM information_schema.columns WHERE table_name='services' AND column_name='primary_category';` returns one row; `SELECT indexname FROM pg_indexes WHERE indexname='idx_services_prof_cat';` returns one row (`indisvalid=true`).
- **Rollback:** `ALTER TABLE services DROP COLUMN IF EXISTS primary_category; ALTER TABLE service_categories DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS icon; DROP INDEX IF EXISTS idx_services_prof_cat;` — instant, no data. (Only needed if aborting the whole release before deploy.)

### Step 2 — Merge PR #260 and deploy the server
- **Action:** merge to `main`; deploy the Express server (Render). Client can also deploy here or wait until Step 7 — SEO pages/Explore degrade gracefully pre-enforce.
- **Why safe:** new code writes complete `(primary_category, category)` pairs and validates them against `service_categories` at write time, so from now on no new violating row can be created. It still carries 42703 fallbacks, so it also runs fine against a DB where only expand (not enforce) has landed.
- **Health check:** `GET /api/health` 200; create/edit a service in staging and confirm the row has both `category` and `primary_category` set (or both NULL).
- **Rollback:** redeploy the previous server build. Old code ignores the new columns; no DB change required.

### Step 3 — Apply `v3.61` backfill
- **Action:** run `v3.61_service_category_backfill.sql`. Three plain statements, each its own transaction; idempotent — safe to re-run and safe under live traffic. (The file carries a commented `PROCEDURE` variant with per-batch `COMMIT` for a very large table, since a `DO` block cannot commit mid-run.)
- **Watch:** the `RAISE NOTICE` lines report orphan deletes, rows stamped, and stale rows cleared. Record these counts in the release log.
- **Health check:** re-running the file a second time reports `0` on every step.
- **Rollback:** none required (data-forward). The stale-clear step is destructive of stale slug values only; those were already unmappable. If you must, restore from the Step-0 backup.

### Step 4 — Re-run the seeder
- **Action:** `node server/scripts/seedServiceCategories.js` against the DB. Idempotent: inserts missing catalog rows and gap-fills `description` only where NULL (never clobbers admin copy).
- **Health check:** script exits 0; final line reports the counts.
- **Rollback:** none (additive, gap-fill only).

### Step 5 — Apply `v3.62` validate (GATE)
- **Action:** run `v3.62_service_category_validate.sql`. Read-only.
- **Interpretation:** it prints A/B/C violation counts. **A raised exception is a hard STOP** — do NOT run v3.63. Investigate, re-run Step 3, re-validate.
  - Common cause of a late failure: an admin renamed a `service_categories` slug between Step 2 and here, orphaning a pair (CASCADE isn't active until enforce). Re-running Step 3's backfill re-clears it, or freeze category admin edits during the window.
- **Health check:** the run completes with `v3.62 VALIDATION PASSED`.
- **Rollback:** n/a (no changes).

### Step 6 — Apply `v3.63` enforce
- **Action:** run `v3.63_service_category_enforce.sql`. Each constraint is `ADD ... NOT VALID` (fast, brief strong lock) then `VALIDATE CONSTRAINT` (concurrent reads+writes continue). Idempotent.
- **Health check:** `SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('fk_sc_primary','fk_services_category','chk_category_pair');` returns 3 rows, all `convalidated=true`. Smoke: attempt an intentionally-bad write in staging (`UPDATE services SET category='x' WHERE primary_category IS NULL LIMIT 1`) → expect 23514.
- **Rollback:** `v3.63_service_category_rollback.sql` — drops the 3 constraints (instant, catalog-only, no data). Both new and old servers keep working afterward.

### Step 7 — Deploy client (if not already at Step 2)
- **Action:** deploy the Vite client (Vercel).
- **Health check:** `/services` renders profession cards; `/services/photographer` renders service cards; a card CTA reaches `/explore?category=photographer&service=...` with results; `/sitemap-professions.xml` returns 200 and lists only active professions.
- **Rollback:** redeploy previous client build.

### Step 8 — Promote staging → prod
- Repeat Steps 1–7 against prod Mumbai. Do not start prod until staging has been green for a soak period and the smoke tests below pass on staging.

---

## Rollback summary (expected downtime: zero at every stage)

| Stage | Rollback | Downtime | Manual step |
|---|---|---|---|
| Expand (S1) | drop columns/index | 0 | SQL editor |
| Server (S2) | redeploy prior build | 0 | Render redeploy |
| Backfill (S3) | none (data-forward) / restore backup | 0 | — |
| Seed (S4) | none | 0 | — |
| Validate (S5) | none (read-only) | 0 | — |
| **Enforce (S6)** | `v3.63_service_category_rollback.sql` | 0 | SQL editor |
| Client (S7) | redeploy prior build | 0 | Vercel redeploy |

The worst realistic failure (enforce misbehaves in prod) is undone by dropping three constraints in one instant statement, leaving a fully-working system on either server build. There is no stage whose failure forces an outage.

---

## Production checklist (tick per DB)

**Pre-flight**
- [ ] Fresh backup / PITR confirmed for the target DB (Supabase snapshot timestamp recorded).
- [ ] PR #260 merged; CI green (server 1166, client 433, build clean).
- [ ] Release log open to record backfill counts.
- [ ] Category-admin edits frozen for the release window (avoids the Step-5 rename race).

**Expand**
- [ ] v3.60 applied; column + index health checks green.

**Deploy**
- [ ] Server deployed; `/api/health` 200.
- [ ] Manual service create/edit writes a complete pair.

**Backfill + seed**
- [ ] v3.61 applied; counts recorded; second run reports all-zero.
- [ ] Seeder exit 0.

**Validate**
- [ ] v3.62 printed `VALIDATION PASSED` (no exception).

**Enforce**
- [ ] v3.63 applied; 3 constraints `convalidated=true`.
- [ ] Bad-write smoke returns 23514.

**API smoke (staging, against real DB)** — *resolves the pre-existing residuals*
- [ ] `GET /api/explore?category=photographer&service=<slug>` returns only hosts that actually offer that service (confirms `services!inner` + embedded `.eq` excludes zero-match hosts — the residual the mock tests could not prove).
- [ ] `GET /api/explore` category rail is populated (confirms `getExploreCategories` on `supabaseAdmin` is not blocked by the v3.27 anon-grant revocation).
- [ ] `GET /api/services-directory` and `/api/services-directory/photographer` return 200; unknown/empty profession returns 404.
- [ ] Profession change (host + admin path) returns `services_cleared` and the affected services show as uncategorised.

**Client**
- [ ] `/services`, `/services/:profession` render; card CTA reaches populated `/explore`.
- [ ] `/sitemap-professions.xml` 200, active professions only.

**Observability**
- [ ] Error rate flat on `/api/host/services`, `/api/explore`, `/api/services-directory` for 30 min post-enforce.
- [ ] No 23514/23503 spikes in logs (would signal a straggling old-code writer).
- [ ] Rollback SQL (`v3.63_service_category_rollback.sql`) open in a tab, ready.

---

## Contract phase (a LATER release, never now)

Once v3.63 has been stable on both DBs for a full release cycle and the 42703 fallbacks in the writers are confirmed dead code, a future `v3.6X_service_category_contract.sql` may remove the compatibility scaffolding (the fallback branches, not the columns). Do not contract in this release — the fallbacks are the safety net if a prior server build is ever rolled back onto the new schema.

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Enforce applied before server deploy (ordering slip) | Low | High (write outage) | Runbook ordering; v3.62 gate; enforce is a separate file that a human runs deliberately |
| Slug rename orphans a pair during the window (Step 2→5) | Low | Medium (validate STOP) | Freeze category admin edits; re-run backfill; validate catches it before enforce |
| Backfill clears a row an admin considered valid | Low | Low | Only clears genuinely unmappable rows; host re-picks on next edit; counts logged |
| `services!inner` semantics differ from mock assumption | Low | Medium | Staging API smoke test in checklist (the named residual) |
| Long validate scan on a huge table | Very low | Low | Table small today; `VALIDATE` uses SHARE UPDATE EXCLUSIVE, not blocking |
| Concurrent-session branch conflict (`15e357f` on `fix/admin-dashboard-ui`) | Known | Low | Merge #260 first, then drop the duplicate commit on that branch |

---

## Go / No-Go

**GO** for staging, conditional, in this order:
1. GO to apply expand (v3.60) and deploy server — fully backward-compatible, reversible.
2. GO to backfill + seed + validate — the validate gate is the safety interlock.
3. GO to enforce **only** on a green v3.62 run.

**NO-GO to prod** until: staging has completed all seven steps, the API smoke tests (including the `services!inner` and anon-category-rail residuals) pass against staging's real DB, and error rates are flat through the soak.

**Blocking nothing in code** — CI is green, the split migrations are additive/reversible, and no step forces downtime. The only hard gate is human: apply the phases in order, honor the v3.62 STOP.
