# One-time: initialize the clean production database (Option B launch)

You decided (June 2026): launch on the **fresh Mumbai** Supabase project, leaving
the current dev data behind as staging. This is the one-time setup to make that
real. After this, the everyday flow is [release-pipeline.md](release-pipeline.md).

> **✅ STATUS (2026-06-19): the prod config seed is already DONE** (applied
> directly via the Supabase tool — schema was already in parity, so config rows
> were copied: categories, subscription_plans, chart_of_accounts, admin_roles,
> badges, platform_settings, notification_events, email_templates; feature_flags
> kept prod's own 33). Prod holds **zero** customer data. **Do NOT run
> `scripts/init-prod-db.sh` for the initial seed — it would double-insert.** The
> script remains for the reverse *refresh-staging* direction / a future re-seed.
> Still TODO in prod (env-specific, set in Admin after deploy, NOT cloned):
> `email_settings` (live SMTP), `notification_providers` (AiSensy),
> `subscription_plans.razorpay_plan_id_*` (live Razorpay plan ids), and a prod
> **admin user** (admin_users is empty by design). Steps 1–2 below (env remap)
> still apply.

> **The roles (memorise this — the Supabase project *names* are currently misleading):**
>
> | Role going forward | Project ref | Region | Today |
> |---|---|---|---|
> | **PRODUCTION** (real, live) | `PROD_PROJECT_REF` | Mumbai (ap-south-1) | empty shell — gets schema + config here |
> | **STAGING** (rehearsal) | `STAGING_PROJECT_REF` | Tokyo (ap-northeast-1) | your current dev DB (all test data) |
>
> **Rename them in Supabase** (Settings → General → project name) so the labels
> match the roles. Renaming changes nothing technical — refs/keys stay the same.

---

## Step 1 — Remap your local `.env` files to the new roles

Today `.env.production` points at `STAGING_PROJECT_REF` — that project is now
**staging**, so the mapping must flip:

| File | Should point at | How |
|---|---|---|
| `server/.env.staging`, `client/.env.staging` | `STAGING_PROJECT_REF` | Copy your current `*.env.production` values into them (same project). Then swap Razorpay to **TEST** keys so staging never charges real cards. |
| `server/.env.production`, `client/.env.production` | `PROD_PROJECT_REF` | Replace only the Supabase values (URL + anon + service-role) with the **Mumbai** project's, from Supabase → Production project → Settings → API. Keep every other secret. |

Then `node scripts/use-env.js staging` puts your laptop on staging (the safe
default). The `REPLACE_ME` guard stops the switch until the files are filled.

---

## Step 2 — Get the two Postgres connection strings

Supabase → **each** project → **Settings → Database → Connection string**. Copy
the URI (it includes the db password). If your network has no IPv6, use the
**Session pooler** (IPv4) string. URL-encode special chars in the password
(`@`→`%40`, `#`→`%23`).

```bash
export STAGING_DB_URL='postgresql://postgres:[PW]@db.STAGING_PROJECT_REF.supabase.co:5432/postgres'
export PROD_DB_URL='postgresql://postgres:[PW]@db.PROD_PROJECT_REF.supabase.co:5432/postgres'
```
These live only in your shell — never commit them.

---

## Step 3 — Run the clone (`scripts/init-prod-db.sh`)

Needs **PostgreSQL 17 client tools** (`pg_dump` + `psql`) — install the
"PostgreSQL 17" command-line tools on Windows; check with `pg_dump --version`.

```bash
bash scripts/init-prod-db.sh --dry-run     # writes .db-clone/01-schema.sql + 02-seed.sql, applies nothing
#   ...open those two files, sanity-check them...
bash scripts/init-prod-db.sh               # rebuilds prod schema + seeds config (type CLONE to confirm)
```

What it does, and its guard rails:
- **Copies:** full schema (tables, types, functions/RPCs, triggers, RLS policies,
  indexes, grants) **+ config rows only** — categories, subscription_plans,
  feature_flags, chart_of_accounts, email/notification templates, badges,
  admin_roles, and the settings tables (platform/email/notification/appearance).
- **Never copies:** profiles, bookings, payments, ledger, logs, OTPs, reviews,
  contacts, campaigns — prod launches with **zero** test data.
- **Refuses** unless `STAGING_DB_URL`/`PROD_DB_URL` point at the exact projects
  above, and makes you type `CLONE`. It rebuilds the *target* (prod) schema, which
  is safe because prod is empty today.

### Admins
By default `admin_users` is **not** copied (so prod admin credentials are
independent). Two ways to get into `/admin` on prod:
- **Easiest** — re-run with `--with-admins` to copy your existing admin login +
  2FA. Works only if prod's env has the **same** `SUPER_ADMIN_JWT_SECRET` /
  `GOOGLE_TOKEN_KEY` as staging (else the 2FA secret won't decrypt).
- **Cleanest** — leave it off and bootstrap a fresh prod admin after launch.

---

## Step 4 — Security note (already handled)

RLS was **enabled** on `feature_flags` and `reschedule_payments` in the source DB
on 2026-06-19 (migration `enable_rls_internal_tables`), so the clone carries
RLS-on into prod automatically — nothing to do here. Both tables are server-only
(read/written via the service-role key, which bypasses RLS), so deny-all with no
policy is the correct end state. If you add new tables that the **browser** reads
via the anon key, those need RLS + explicit policies before launch.

---

## Step 5 — Point production at the Mumbai DB

When you deploy (DEPLOYMENT.md Phases 2–4), the **prod** Render + Vercel envs use
the **Mumbai** (`PROD_PROJECT_REF`) Supabase URL + keys; the **staging**
Render + Vercel envs use `STAGING_PROJECT_REF`. After deploy, verify a test
booking on `meeticulous.com` lands in the Mumbai project, and prod still shows
**0** profiles/bookings until the first real customer.

---

## Later: refreshing staging from prod

This script runs **staging → prod** once, for launch. The *ongoing* direction is
the reverse — periodically refresh staging's schema **from** prod so staging
keeps mirroring live. Same idea, swapped URLs; ask Claude to add a
`refresh-staging.sh` when you need it.
