# 04 — Database & Storage Security Audit

**DB:** Supabase project `spquowzrefozmrzoszkf` ("Meeticulous Dot Com"), Postgres 17.11, eu-west-2.
**Method:** live **read-only** introspection via Supabase MCP (advisors, `pg_proc`/`pg_policies`/`storage.buckets` catalog queries) on 2026-11-11. No rows written, no user data read.

---

## 1. Access model — the single most important fact

The application connects as **`service_role`**, which **bypasses Row-Level Security**. The anon/publishable key is used client-side only for the Supabase auth listener (no direct table reads). Therefore:

- **RLS is not the application's authorization layer.** Authorization is enforced in Express controllers (see `02`/`03`).
- The correct posture for this design is **RLS enabled + no policy** on every exposed table → anon/authenticated clients get **zero** direct access; only the server (service_role) can read/write. The DB confirms this is exactly what is deployed.

## 2. Supabase security advisors (live)

| Advisor | Level | Count | Assessment |
|---|---|---|---|
| `rls_enabled_no_policy` | INFO | **123 tables** | **By design / SAFE.** RLS on + no policy = deny-all to anon/authenticated; service_role bypasses. This is the intended fail-closed posture, not a vulnerability. (It would be a problem only if the browser read these tables with the anon key — it does not.) |
| `extension_in_public` | WARN | 3 (`btree_gist`, `pg_trgm`, `vector`) | LOW. Extensions in `public` schema. Hardening nicety; move to a dedicated schema. No direct exploit. |
| `auth_leaked_password_protection` | WARN | 1 | **MEDIUM.** Supabase Auth's HaveIBeenPwned compromised-password check is **disabled**. Email/password accounts (host email-register, phone-login passwords) can use known-breached passwords. Enable in Supabase → Auth → Password protection. |

> No `security_definer_view`, no `function_search_path_mutable` exposure, and no RLS-disabled public table were reported.

## 3. SECURITY DEFINER functions & RPC exposure

Catalog query for `prosecdef = true` functions in `public` granted EXECUTE to `anon`/`authenticated`/`public`:

```
→ 0 rows
```

**SAFE.** No SECURITY DEFINER function is callable by the anon or authenticated role. The 13 definer functions are locked to `service_role` (migration `v3.186_lockdown_anon_rpc_and_views.sql`, verified live). A guard test (`tests/unit/lockdownAnonRpcMigration.test.js`) enforces that new browser-callable functions need an explicit GRANT. **Any new `SECURITY DEFINER` function or view must keep this posture** — see the acceptance criteria in `07`.

## 4. Views

| View | `security_invoker` | anon/authenticated SELECT grant |
|---|---|---|
| `host_activation` | **true** | none |
| `host_activation_funnel` | **true** | none |
| `vendor_metrics` | **true** | none |

**SAFE.** All three run with the *invoker's* privileges and are not granted to anon/authenticated. (Before v3.186 these were `security_definer` and anon could read every host's name/email/phone via `host_activation` — that hole is closed.)

## 5. Storage buckets (live) + object policies

| Bucket | Public? | Size limit | MIME allowlist |
|---|---|---|---|
| `images` | **PUBLIC** | 5 MB | `image/jpeg,jpg,png,webp` only |
| `kyc` | private | — | — |
| `customer-files` | private | 2 MB | — |
| `products` | **private** | 2 MB | — |
| `gst-exports` | private | — | — |

`pg_policies` on `storage.objects`: **0 policies.**

**Assessment — SAFE and well-designed:**
- Private buckets + **no** storage policy = only `service_role` (the server) can read/write them. The browser/anon cannot list or fetch private objects. KYC documents, product files, customer files and GST exports are reachable **only** through server-minted, short-lived (60s) signed URLs behind controller RBAC/ownership checks (verified in the upload/storage audit).
- The public `images` bucket is MIME-locked to raster formats (**no `image/svg+xml`, no HTML**) at the bucket level — this blocks the classic *stored-XSS-via-SVG-upload* vector even before the app's magic-byte sniffing.
- **Resolves the upload audit's one MEDIUM** (product-download-gate bypass if `products` were public): the bucket is confirmed **private**, so the paid-download token + purchase + 3-download + 24h-expiry gate is the only path. ✅ Keep `products`, `kyc`, `customer-files`, `gst-exports` private.

## 6. SQL/NoSQL injection posture

- All DB access is through supabase-js / PostgREST with **parameterized** filters (`.eq()`, `.in()`, `.match()`), not string-concatenated SQL. The authorization sweep found no raw SQL assembled from user input; admin lookups use parameterized `.eq()` (no PostgREST filter-injection via user-controlled `select`/`filter` strings observed).
- A defense-in-depth regex blocklist (`blockSuspiciousRequests`) auto-bans on SQLi/XSS/traversal signatures — explicitly documented as a coarse net, **not** the primary control.
- **Residual check for the deep review:** confirm no endpoint forwards a client-supplied PostgREST `select=`/embedded-resource string into `.select()` (would allow column/relationship disclosure). The mass-assignment/exposure agent covers this; see `02`.

## 7. Secrets, credentials & key handling (DB-adjacent)

- `service_role` key is validated at boot (`config/supabase.js`) and never shipped to the client; password sign-in runs on a disposable anon client so the long-lived admin client is never "poisoned" into the authenticated role.
- Google OAuth tokens are **AES-256-GCM encrypted at rest** in the server-only `profile_private` table (RLS deny-all), decrypted at point of use.
- No live secret is committed (only `*.env.example`); `.gitignore` covers all `.env*`.

## 8. Backups, retention & isolation (not verifiable from here)

| Item | Status | Action |
|---|---|---|
| Automated backups / PITR | Managed by Supabase plan — **not verifiable via MCP** | Confirm PITR is enabled for prod; document RPO/RTO. |
| Data retention / deletion policy | Not codified in repo | Define retention for `otp_codes` (cron-pruned ✔), `webhook_events`, `email_logs`, `lead_*`, analytics event tables; document a user-deletion (GDPR/DPDP) procedure. |
| Prod/staging isolation | Single project reachable now (`spquowzrefozmrzoszkf`) | Confirm no shared credentials between environments; the "no local server against live DB" rule is a known operational hazard (see `08`). |
| `services_price_backup_v394` table | Present (RLS-on/no-policy) | Leftover backup table — drop once no longer needed (clutter, not a leak). |

## 9. Database findings summary

| ID | Finding | Severity |
|---|---|---|
| DB-1 | Leaked-password protection (HIBP) disabled in Supabase Auth | MEDIUM |
| DB-2 | 3 extensions installed in `public` schema | LOW |
| DB-3 | PITR/backup status & data-retention policy not verified/codified | LOW (ops) |
| DB-4 | Leftover `services_price_backup_v394` table | INFO |
| — | RLS-no-policy on 123 tables | **By design — SAFE** |
| — | SECURITY DEFINER / views / storage buckets locked down | **SAFE** |

**Verdict:** the database and storage layer is **well-secured for a service_role architecture**. The only real action item is enabling leaked-password protection; the rest is hygiene. The platform's DB risk lives in the *application layer* (controller authorization), not in Postgres.
