# Throwaway Staging — Write-Path Load Test Setup

**Why:** measure how many bookings/sec the single Render instance accepts over
real HTTP before it breaks (the "traffic spike" number). `sameSlotBurst.js` proves
*correctness* in-process; this proves *throughput* against a deployed server. Prod
is off-limits for writes → we need a throwaway box on an **isolated test DB**.

Driver: [`server/scripts/httpBookingLoad.js`](../server/scripts/httpBookingLoad.js)
(fires concurrent `POST /api/bookings` at the staging URL, ramps conc levels).

---

## 1 — Isolated test DB (NOT prod)

Pick ONE, must have the schema (run migrations):
- The old Tokyo staging Supabase project (`xwvciqkayammbvsidqig`), **if it still has
  current schema**, or
- A fresh Supabase project (apply `server/migrations/*` + `config/schema`).

> The driver **hard-refuses** a prod ref (`spquowzrefozmrzoszkf`) for both `BASE`
> and `SUPABASE_URL`. Do not point it at the live DB.

## 2 — Create the Render service (you click)

Render → New → Web Service → same repo/branch → **Free** plan (we're testing the
free-tier ceiling). Build/start = same as prod (`npm ci` / `node server.js` in
`server/`). Name it e.g. `meeticulous-api-loadtest`.

## 3 — Env vars on the staging box

| Var | Value | Why |
|---|---|---|
| `NODE_ENV` | `test` | `loadTestMode.js` is **fail-closed** — honored only in dev/test. |
| `LOAD_TEST_MODE` | `true` | Bypasses ipGuard + gcal writes (see `config/loadTestMode.js`). |
| `SUPABASE_URL` | **test DB** url | NOT prod. |
| `SUPABASE_SERVICE_ROLE_KEY` | test DB key | |
| `SUPABASE_ANON_KEY` | test DB key | |
| `OAUTH_STATE_SECRET` | **same value as your local `server/.env`** | ⚠️ grants are JWTs signed with this; the driver mints them locally, the server verifies them. Mismatch → every booking 403s "please verify". |
| `SMTP_*` / `BREVO_*` / `RESEND_*` | **blank or test keys** | Defense-in-depth so no mail reaches real inboxes. |
| `AISENSY_*` | blank | No real WhatsApp. |
| `RAZORPAY_*` | test keys (or blank) | Free service skips payment anyway. |

Everything else: copy prod's non-secret config as needed to boot.

## 4 — Seed + run (local, against the staging DB)

Local `server/.env` must have `SUPABASE_URL` = the **test DB** and the **same
`OAUTH_STATE_SECRET`** as the box.

```bash
cd server
node scripts/seedLoadTest.js                         # seeds loadtest vendor + free service
BASE=https://meeticulous-api-loadtest.onrender.com node scripts/httpBookingLoad.js
node scripts/cleanupLoadTest.js                      # removes @loadtest.meeticulous.local rows
```

Output: a per-concurrency table (ok/4xx/5xx/conn-err, rps, p50/p95/p99/max) +
`httpBookingLoad.summary.json` for the paper's graphs.

## 5 — Reading the result

- **429s in the 4xx column** = the per-IP `bookingLimiter` (middleware/security.js),
  NOT the infra, is the ceiling. That's itself a finding (single-IP spikes are
  shaped by the limiter). To measure raw infra past it, we'd add a
  `LOAD_TEST_MODE` bypass on that limiter (code change — only if the run shows the
  limiter capping us first).
- **5xx / conn-err climbing + p95 exploding** = the free instance (0.1 CPU shared,
  512MB) is saturating → that conc level is the ceiling.

## 6 — Teardown

Delete the Render service when done (Render → service → Settings → Delete). The
test DB rows are cleaned by `cleanupLoadTest.js`; drop/reset the test project if
you want it gone.
