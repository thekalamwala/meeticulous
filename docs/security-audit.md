# Security Audit — 6-Point Hardening Pass

**Date:** 2026-11-12
**Branch:** `chore/security-hardening`
**Scope:** The 6 requested properties, across server (`server/`), client (`client/`), and the live Supabase DB (`spquowzrefozmrzoszkf`).
**Method:** Read-only audit (5 parallel code investigators + direct DB introspection), then fixes for the findings.

---

## TL;DR

**5 of 6 were already solid** — prior hardening passes did their job (BUG-xx / audit-Px / SECURITY FIX / IDOR comments throughout; `v3.186` already locked down SECURITY DEFINER functions/views). Pricing, authz, ownership, email rate-limiting, and frontend-secrets are all in good shape.

**One real hole:** the `profiles` table leaked every user's PII to the **public anon key**. Fixed in this branch.

| # | Item | Verdict | Finding | Fix in this PR |
|---|------|---------|---------|----------------|
| 1 | Prices computed on server | ✅ Clean | LOW — product invoice `buyer_state`/`buyer_gstin` unnormalized | ✅ P2 |
| 2 | Never trust role/isPro from browser | ✅ Clean | none | — |
| 3 | RLS on every table | ⚠️ On everywhere, **1 HIGH policy** | **HIGH — `profiles` PII readable by anon** | ✅ P0 |
| 4 | Rate-limit every email form | ✅ Strong | LOW-MED — `/api/contact` IP-only | ✅ P1 |
| 5 | Ownership check before update/delete | ✅ Clean (no IDOR) | none | — |
| 6 | Secret keys out of frontend | ✅ Clean (no leaks) | none | — |

---

## Fixes in this branch

### P0 — HIGH: `profiles` exposed all-user PII to the anon key → FIXED

`server/migrations/v3.205_profiles_column_grants.sql` (+ guard test `server/tests/unit/profilesColumnGrantsMigration.test.js`).

**The hole (confirmed live):** the `profiles` SELECT RLS policy is `USING (true)` for `{anon, authenticated}`, and the `anon` role held a table-wide `SELECT` grant. The anon key ships in the client bundle (correct — it's publishable), so **anyone** could run `supabase.from('profiles').select('email, phone, date_of_birth, admin_notes, billing_details, ...')` and dump that for **every** user. Verified as role `anon`: 6/6 rows, 6/6 emails, 6/6 phones, 6/6 admin_notes readable with no auth.

**Why the fix is safe:** the client uses supabase-js for OAuth + realtime *broadcast* only — it never reads `profiles` (or any table) via supabase-js/PostgREST. All profile data is served by the Express API using the service-role key (bypasses RLS + column grants). So restricting anon/authenticated column SELECT cannot break the app.

**The fix:** `REVOKE SELECT ON public.profiles FROM anon, authenticated`, then `GRANT SELECT (<31 public display columns>)`. A column-list grant does not auto-cover future columns, so any new column defaults to hidden (fail-safe). Verified in a rolled-back transaction against the live DB: after the migration, anon keeps `name`/`profile_image` but `email`/`phone`/`admin_notes`/`billing_details`/`date_of_birth` all return `false`.

> ⚠️ **This is a LIVE leak until the migration is applied.** The migration is in the branch but NOT yet applied to the DB (prod still returns `anon → email = true`). Apply it ASAP, independent of the merge: run `server/migrations/v3.205_profiles_column_grants.sql` on the DB (REVOKE/GRANT, instant, reversible).

### P1 — LOW-MED: `/api/contact` support-inbox spam → FIXED

`server/routes/contactRoutes.js`. The route sends an email to the internal support inbox but carried only `newsletterIpLimiter` (20/hr/IP) — an attacker rotating IPs could spam it. Its sibling `/api/enterprise-lead` already stacks both limiters, and the IP-limiter's own comment says "Stack BOTH on the route." Added `newsletterEmailLimiter` for parity.

### P2 — LOW: product-order tax metadata unvalidated → FIXED

`server/controllers/paymentController.js` (`createProductOrder`). `buyer_state`/`buyer_gstin` were read raw from `req.body` into the invoice — unlike bookings/subscriptions, which run them through `stateService.normalizeBilling` (validates GSTIN, canonicalizes state, GSTIN-state wins). A buyer could spoof a malformed GSTIN / place-of-supply on their own invoice (does **not** affect the amount charged — GST-on-fee is server-computed from `cfg.gstRate`). Wired the same validator into the product flow and carried the canonical state code into the Razorpay notes + invoice.

---

## Config-level follow-ups (not code — founder action)

From Supabase security advisors; not fixed here:
- **WARN — leaked-password protection OFF** (HaveIBeenPwned check). Low relevance (hosts use Google/LinkedIn OAuth, guests use OTP), free toggle in the Supabase Auth dashboard.
- **WARN — extensions in `public`** (`btree_gist`, `pg_trgm`, `vector`). Best-practice nit; move to a dedicated schema when convenient.
- **INFO — `rls_forced = false`** on all tables. Only matters for the table-owner role; clients use anon/authenticated and the server uses service-role. No external vector, no action needed.

---

## What was verified clean (no action)

- **#1 Pricing** — all 6 money entry points compute every charged amount server-side via `lib/pricingEngine.js`, verify Razorpay signatures server-side, and re-check the captured order amount against the stored snapshot before finalizing. Client sends only identifiers + Razorpay's signed IDs.
- **#2 Authz** — identity from the Supabase-verified JWT, plan/limits from live DB reads, admin permissions from a separately-signed admin JWT. No endpoint trusts a browser-supplied role/plan/isPro flag; the one body `role` write is allow-listed to guest/host behind `requireAdmin('users.edit')`.
- **#3 RLS coverage** — enabled on all 136 public tables; 122 are RLS-on + zero-policy (deny-all/fail-closed, server-only). Policied tables are correctly `auth.uid()`-scoped, except the `profiles` SELECT (now fixed).
- **#5 Ownership** — every authenticated mutation constrains the target by `req.user.id`; no IDOR across 85 controllers.
- **#6 Frontend secrets** — no leaks; only publishable values reach the bundle, all true secrets server-side, `.env` properly gitignored.
