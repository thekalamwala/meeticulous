# System-Level Gap Audit — Book A Sloth

_Conducted 2026-09-02 against `main` @ `6043363` and the LIVE production database (`ayjhlwyzszykqtnaktpb`, Mumbai) via read-only introspection._

**Scope:** full platform sweep. Every finding carries evidence. Findings verified against production data are marked **CONFIRMED**; findings derived from code reading alone are marked **INFERRED**.

**Method:** read the product docs to reconstruct intent, read the code to reconstruct behaviour, then queried the live database to find out which of the two is actually true. The database was the most informative of the three.

---

## 0. Executive summary

Book A Sloth is a genuinely well-built system. The booking core has a GiST exclusion constraint, exactly-once payment capture, immutable pricing snapshots, per-host quota mutexes, signature-verified webhooks, four reconcilers, a double-entry ledger, RBAC with 2FA, IP blocking, and 449 test files. Most of what a competent audit would flag has already been found and fixed by previous audits — the code is dense with `P0-2:`, `M-8:`, `H-3:` comments citing them.

So the interesting question is not "what is broken." It is **"what did every prior audit share a blind spot about."** The answer:

> **The system is built to take money in and to keep itself running. It was never designed for money going back out, for work that doesn't happen, or for telling a human that something is stuck.**

Six structural absences follow from that:

1. **There is no refund path a customer can reach.** A guest can cancel a paid booking; the money simply stays. Four such bookings exist in production. The refund logic exists — but only behind an admin button nobody has ever pressed (`bookings.payment_status='refunded'` count: **0**).
2. **Every failure self-heals silently, and when self-healing fails there is no second line.** Three paid bookings have been failing to post to the ledger every hour since 2026-08-07 because of a poison-pill row. Nobody knows. There is no alert, no dead-letter queue, no metric.
3. **Scheduling is an implementation detail, not infrastructure.** 22 crons are `setInterval` in the web process; `autoDeploy: true` resets all timers on every merge; `job_locks` — the table the leader election depends on — **does not exist in production**, so `runLocked` fails open on every single tick.
4. **Nothing knows what schema is deployed.** 180 migration files, `migrate.js` records nothing, no ledger table. "All migrations applied" in `CLAUDE.md` is unverifiable, and demonstrably false.
5. **The audit trail covers identity, not configuration.** Changing a booking is audited. Changing the platform fee, the GST rate, `fee_only_mode`, `payout_reconciler_mode`, or any of 33 kill-switches is not.
6. **Features ship complete and land unintegrated.** The abandoned-payment recovery email sends guests a `resume_url` to a page whose only button is "Cancel this booking."

Nothing here is currently costing large amounts of money — the platform is at 48 bookings, 86 profiles, 78 hosts. **That is exactly why this is the right moment.** Every one of these is a fixed-cost fix now and a proportional-cost incident later.

---

## 1. Reconstructed product intent vs. actual behaviour

| The product says | The system does | The gap |
|---|---|---|
| "You never chase payment" (brand position, `brand-position-resolved`) | Hosts are paid via Route auto-transfer, held and released. Works. | **Nobody chases refunds either** — the guest side of "never chase" is unbuilt. |
| "Calm booking" — `docs/ai-context.md` | Booking flow is 4–5 client-side steps with zero persistence | A refresh mid-checkout loses everything **and** locks the guest out of their own slot for 45 minutes. |
| `docs/current-state.md`: "Financial Ledger SHIPPED on branch `sd/adoring-elgamal-625af7` (not merged)" | Ledger is live in production: 44 `journal_entries`, `/admin/finance` served | Doc is ~2 months stale on a money system. |
| `docs/current-state.md`: "Guest booking history dashboard — not built" | `/user/*` guest console shipped and live (PRs #774–781) | Same. |
| `docs/current-state.md`: "Email: SMTP via Nodemailer" | Production email is Resend (`email_senders`, `resendWebhookController`) | Same. |
| `CLAUDE.md`: "No migration is currently outstanding" | `job_locks` (v3.25) is absent from production | Directly false; a real capability depends on it. |
| `render.yaml`: "integration tests hit live Supabase/SMTP with real credentials" | Every `tests/integration/*` calls `jest.mock('../../config/supabase', … makeSbMock())` | Stale warning; makes the deploy config look scarier than it is, and `CLAUDE.md` still tells you to run `npm test`. |

---

## 2. Findings

Ordered by severity. Every finding has file/line or SQL evidence.

---

### F1 — Negative host payout poisons the ledger; the self-healing reconciler has been failing hourly for four weeks

**Severity: CRITICAL** · **CONFIRMED** · Backend / Payments / Data / Monitoring

**Finding.** In fee-only mode (host price forced to ₹0, platform collects only its own booking fee), the Razorpay gateway fee is still subtracted from the host, producing a **negative `vendor_amount`**. That puts a **negative journal line** into the `ORDER_PAYMENT` entry, which `post_journal_entry` rejects on its line-amount guard (`RAISE EXCEPTION 'line amounts cannot be negative'`) — the entry's debits and credits actually sum equal, so it is the negative line, not an imbalance, that kills it. `postSafe` swallows the error, and the hourly `ledgerReconciler` re-attempts and re-fails forever.

**Expected behaviour.** A host who sold nothing cannot owe the platform money; `vendor_amount` should floor at 0 and the gateway fee should be borne by whoever collected the revenue (BAS, in fee-only mode). A ledger entry that can never post should be quarantined and alerted after N failures, not retried silently forever.

**Current behaviour.**
- `server/lib/pricingEngine.js:157` — `calculateVendorPayout` asserts inputs are non-negative but never clamps the **result**: `servicePrice(0) − commission(0) − razorpayFee(0.28) − tds(0) − tcs(0) = −0.28`.
- `server/services/ledger/journalTemplates.js:70` — credits `VENDOR_PAYABLES` with `snapshot.vendor_amount`, i.e. a **negative credit line** (`credit: −0.28`). The entry as a whole does balance — debits `11.80 + 0.28 = 12.08`, credits `−0.28 + 10.00 + 1.80 + 0.28 + 0.28 = 12.08` — but `post_journal_entry` rejects any line with a negative amount before it ever checks the balance, so the entry never posts.
- `server/services/ledger/postingService.js:44` — `postSafe` catches, `console.error`s, returns `null`.
- `server/services/ledger/ledgerReconciler.js` — rescans and re-fails every hour. No failure counter, no alert, no dead-letter.

**Evidence (live prod).**
```
id                                    | customer_total | vendor_amount | paid_at              | has_journal
292e8f1f-e13f-4c15-baa7-a638cd3d7ac8  |     11.80      |    -0.28      | 2026-08-07 12:24:09  | false
ef435404-c8b7-49c1-b608-b540ea26b8c6  |     11.80      |    -0.28      | 2026-08-07 12:23:17  | false
66c2deb4-f900-499e-a935-74a71659421d  |     11.80      |    -0.28      | 2026-08-07 12:23:12  | false
```
₹35.40 of real captured revenue has never reached the books. ~700 failed reconciler attempts, zero alerts.

**Impact.** Money · Data integrity · Reliability. Today the affected host is the founder's own account, so customer impact is nil. The **mechanism** is live: any fee-only booking produces this. The books are wrong by construction, and the "self-healing" property everyone relies on is demonstrably not self-healing.

**Why we probably missed it.** Architecture gap + business-rule gap. Fee-only mode was designed as a temporary interim (`v3.94_fee_only_mode.sql`) and the payout formula was never re-derived for the case where the host's revenue is zero. `postSafe`'s design ("never fail a payment for a ledger error") is correct — but it was built with no counterpart for "this will never succeed."

**Recommendation.** (a) Clamp `calculateVendorPayout` at 0, and in `orderPaymentEntry` book the gateway fee as a BAS-borne expense when the host is owed nothing (mirroring the subscription path) and omit the zero-value vendor-payables line — a zero line is rejected too. (b) Give `postSafe` a failure counter — after N consecutive failures for the same `source_id`, `adminAlert` instead of retrying silently. (c) Backfill the three rows to `vendor_amount = 0` so the fixed reconciler posts the real `ORDER_PAYMENT` entry (no manual `ADJUSTMENT` needed). (d) Add a `journalTemplates` unit test asserting the fee-only shape balances with no negative or zero line.

**Update (2026-09-02):** shipped in [#922](https://github.com/bookasloth/book-a-sloth/pull/922) — clamp + BAS-borne fee + `postSafe` dead-letter alert + backfill migration `v3.139`. Full unit suite green (2222).

---

### F2 — A guest can cancel a paid booking and no refund is ever issued or offered

**Severity: CRITICAL** · **CONFIRMED** · Product / Money / Trust

**Finding.** The guest-facing cancel paths flip `status → 'cancelled'` and stop. No refund is issued, no refund is offered, no refund policy is shown, and the guest is told nothing about their money. A refund tier policy **exists in code** — `refundTierPct(hoursToStart)` in `financeAdminController.js` — but is reachable only from an admin console button.

**Expected behaviour.** At the moment of cancellation the guest should see what they will get back and why; the system should either issue the refund automatically per policy or open a tracked refund request with an SLA. A cancellation is the single highest-anxiety moment in a booking product.

**Current behaviour.**
- `server/controllers/bookingController.js:796` — `cancelBookingRecord` writes `{ status: 'cancelled', settlement_status: 'cancelled', cancelled_at }`. `payment_status` untouched.
- `client/src/pages/ManageBooking.jsx:111-119` — the only action is "Cancel this booking".
- `server/controllers/financeAdminController.js:304` — `executeRefund` is admin-only, requires `finance.manage`, and is invoked by a human.

**Evidence (live prod).**
```sql
-- bookings cancelled with money captured, never refunded
8d1eb724…  paid  ₹2.18   razorpay_payment_id set, transfer created
9672e1b5…  paid  ₹21.80  razorpay_payment_id set
78e4956e…  paid  ₹21.80  razorpay_payment_id set
6b728bed…  paid  ₹10.00  razorpay_payment_id set

select count(*) from bookings where payment_status='refunded';  -- 0
select count(*) from admin_audit_logs where action='FINANCE_REFUND_EXECUTED';  -- 0
```
Four paid, cancelled bookings. Zero refunds in the platform's history.

**Impact.** Money · Trust · Legal. At scale this is a chargeback pipeline and a consumer-protection exposure. It also contradicts the brand position ("you never chase payment") from the guest's side.

**Why we probably missed it.** Scope gap. Refunds were scoped as **Ledger Phase 3**, and P3 was never built (`docs/current-state.md` says so explicitly). But cancellation shipped in P1. The two were never reconciled — cancellation became reachable long before the money-return path existed.

**Recommendation.** This is a **product decision before it is an engineering task** — see Question Q1. Minimum: surface the refund policy in the cancel confirmation dialog, write a `refund_requests` row on every paid cancellation, and put that queue in the admin ops badge.

---

### F3 — `job_locks` does not exist in production; cron leader election is a no-op

**Severity: HIGH** · **CONFIRMED** · Backend / Ops / Data

**Finding.** `server/utils/jobLock.js` provides Postgres-lease leader election for all 22 crons, and is **documented as the prerequisite for horizontal scaling**. The table it needs was never created in production.

**Expected behaviour.** `runLocked` grants a lease; only the holder runs the job. On >1 instance, exactly one instance sends each reminder / drains each queue.

**Current behaviour.** `try_acquire_job_lock` RPC errors → `acquire()` catches → **returns `true`** (fail-open, by design) → every instance runs every job. A single `console.warn` fires once per process lifetime and is never surfaced.

**Evidence (live prod).**
```
select * from job_locks;
ERROR: 42P01: relation "job_locks" does not exist
```
`server/migrations/v3.25_job_locks.sql` exists in the repo and was never applied. `server/tests/unit/jobLock.test.js` passes — it tests the module, not the deployment.

**Impact.** Reliability · Money. Harmless today (one instance). The moment a second instance is added — which is the stated plan, and the prerequisite for the shared rate-limit store — every host gets duplicate reminders, every campaign double-sends, and the four reconcilers race each other on money rows. The safety net you think you have is not there.

**Why we probably missed it.** Operational gap + documentation gap. The migration was written, the code was written, the test was written, the tests are green — and the one step that isn't code (running it) has no tracking. See F9.

**Recommendation.** Apply `v3.25_job_locks.sql` to both DBs. Then make `acquire()`'s failure path `adminAlert` once per hour instead of `console.warn` once per process — a fail-open safety mechanism that fails silently isn't a safety mechanism.

---

### F4 — Long-interval crons almost certainly never run

**Severity: HIGH** · **INFERRED (strong)** · Backend / Product / Ops

**Finding.** All scheduled work is `setInterval` inside the web process. `setInterval` fires **first after a full interval**, and `render.yaml` sets `autoDeploy: true` on `main`. Every merge restarts the process and resets all 22 timers to zero.

**Expected behaviour.** A daily job runs daily regardless of deploy cadence.

**Current behaviour.** A 24-hour cron requires 24 hours of uninterrupted uptime to fire even once.

**Evidence.**
- `server/server.js:284-616` — 22 `setInterval` registrations, no immediate first tick.
- `render.yaml:16` — `autoDeploy: true`, `branch: main`.
- `git log` — 40+ merges to `main` between 2026-08-25 and 2026-09-01, frequently several per day.

**Affected jobs:** `guest-host-invite` (24h), `weekly-recap` (24h), `support-insights-digest` (24h), `payout-holiday-notice` (24h), `profile-completion` (12h), `birthday` (12h), `subscription-expiry` (6h).

That is the **entire retention and lifecycle-email surface** — the exact work of PRs #761–764 and the weekly recap of the PMF sprint.

**Impact.** Product · Revenue. Features are built, deployed, tested, marked shipped, and never execute. `subscription-expiry` not firing means paid hosts lapse with no T-7/T-1 warning.

**Why we probably missed it.** Architecture gap. `setInterval` is correct for a 5-minute job and quietly wrong for a 24-hour one, and nothing distinguishes the two. There is no job-run history table, so "did the weekly recap send?" is unanswerable without reading `email_logs` by hand.

**Recommendation.** (a) Add a `job_runs` table (`name, started_at, finished_at, outcome, error`) and write to it from `runLocked` — this makes every other cron finding observable. (b) For jobs with interval ≥ 6h, drive from a persisted `last_run_at` on a 15-minute tick rather than an in-memory timer. (c) Alert when a job's `last_run_at` exceeds 2× its interval.

---

### F5 — `merge_lead_rows` is a destructive `SECURITY DEFINER` function executable by `anon`

**Severity: HIGH** · **CONFIRMED** · Security

**Finding.** `merge_lead_rows(uuid, uuid)` reparents seven child tables and `DELETE`s a `leads` row, running as the definer (bypassing RLS). It is the **only** `SECURITY DEFINER` function in the database with `EXECUTE` granted to `PUBLIC`, `anon`, and `authenticated`. Every other one is `service_role`-only.

**Expected behaviour.** Match the pattern `v3.100_definer_execute_and_search_path_hardening.sql` established: `REVOKE ALL … FROM PUBLIC, anon, authenticated`.

**Evidence (live prod).**
```
proname          | security_definer | acl
merge_lead_rows  | true             | =X/postgres | postgres=X/postgres | anon=X/postgres
                 |                  | | authenticated=X/postgres | service_role=X/postgres
change_username  | true             | postgres=X/postgres | service_role=X/postgres
post_journal_entry | true           | postgres=X/postgres | service_role=X/postgres
   … (all 11 others: service_role only)
```
`server/migrations/v3.130_merge_lead_rows_fn.sql` creates the function with no `REVOKE`. The Supabase anon key is public (`client/.env` → `VITE_SUPABASE_ANON_KEY`), so `supabase.rpc('merge_lead_rows', {…})` is callable from any browser.

**Impact.** Security · Data. Exploitation requires two lead UUIDs, which are unguessable — so this is a latent hole rather than an open door. But "the ID is hard to guess" is not an authorization boundary, the function is destructive and irreversible, and it leaks lead-existence through its return value. It also violates the security invariant the codebase otherwise maintains perfectly.

**Why we probably missed it.** Integration gap. v3.100 hardened every function that existed at the time; v3.130 was written 30 migrations later by a different piece of work (CRM dedupe) and the hardening pattern was not part of the migration template.

**Recommendation.** `REVOKE ALL ON FUNCTION public.merge_lead_rows(uuid, uuid) FROM PUBLIC, anon, authenticated;` on both DBs. Add the REVOKE to a migration template/checklist so the next `SECURITY DEFINER` function cannot repeat it.

---

### F6 — Admin sessions cannot be revoked; the more privileged identity has the weaker controls

**Severity: HIGH** · **CONFIRMED** · Security

**Finding.** The admin JWT is stateless, 8-hour, with permissions baked in at login. There is no per-request check against `admin_users`. Deactivating an admin, changing their role, or removing a permission has **no effect for up to 8 hours**.

**Expected behaviour.** Revoking a privileged session should be immediate. The host side already does this correctly.

**Current behaviour — the asymmetry is the finding.**

| | Host / guest (`authMiddleware.js`) | Admin (`adminMiddleware.js`) |
|---|---|---|
| Ban enforcement | `accountGate` → `is_banned` checked **every request** | none |
| Global logout | `sessions_valid_after` watermark checked every request | none |
| Permission source | live DB read | JWT claim frozen at login |
| Revocation latency | immediate | up to 8 hours |

- `server/services/adminAuthService.js:19` — `SESSION_TTL_SEC = 8 * 60 * 60`.
- `server/middleware/adminMiddleware.js:24-46` — `authenticate()` verifies the signature and reads `payload.permissions`. No DB access at all.

**Impact.** Security. A departing or compromised staff account retains full access — including `finance.manage` (issues refunds), `kyc.pii_reveal` (7 uses logged in prod), and staff management — for up to 8 hours after you revoke it. There is no "sign out all admins" lever.

**Why we probably missed it.** Architecture gap, made worse by a good decision: statelessness was chosen deliberately ("so middleware checks are stateless") and the host-side revocation work (RISC, v3.79) landed separately and was never mirrored across.

**Recommendation.** Add `admin_users.sessions_valid_after` + `is_active`, and one cached (30–60s) read in `authenticate()`. Cost is one indexed lookup per admin request on a low-traffic surface. Consider dropping the TTL to 2h in the same change.

---

### F7 — The abandoned-payment recovery email links to a page whose only button is "Cancel"

**Severity: HIGH** · **CONFIRMED** · Product / UX / Revenue

**Finding.** `abandonedRecovery` emails guests who started a paid booking and didn't finish, with a `resume_url`. That URL points at `/manage-booking/<token>`, which offers **view** and **cancel**. There is no way to pay.

**Expected behaviour.** A recovery email's CTA resumes the checkout.

**Current behaviour.**
- `server/services/abandonedRecovery.js:76` — `resume_url: \`${base}/manage-booking/${manageBookingToken.sign(b.id)}\``
- `server/controllers/manageBookingController.js:77` — exports exactly `{ getByToken, cancelByToken }`.
- `client/src/pages/ManageBooking.jsx:111-119` — renders status "Pending payment" and one button: "Cancel this booking".

**Impact.** Revenue · UX. The recovery mechanism is anti-converting: we email a hesitating buyer and hand them a cancel button. Every recipient who acts on it is a lost sale we caused.

**Why we probably missed it.** Integration gap — the archetype. `manage-booking` shipped for anonymous cancellation (#516). `abandonedRecovery` shipped later (#761–764) and reached for the nearest token-authorized booking page without checking what it could do. Neither PR's tests cross the boundary. Nobody clicked the link.

**Recommendation.** Add `POST /api/manage-booking/:token/pay-order` reusing `createOrder`'s authorization (token possession = auth for this one booking), and a "Complete payment" button on `ManageBooking.jsx`. Small change; likely the highest-ROI item in this document.

---

### F8 — Checkout has no durable state, and an abandoned hold locks the guest out of their own slot

**Severity: HIGH** · **CONFIRMED** · UX / Product / Revenue

**Finding.** `ServiceBooking.jsx` keeps the entire checkout in `useState`. A refresh, a back-button, a tab crash, or an app-switch on mobile during a UPI redirect loses the booking id and the manage token. The guest cannot resume — and because their own `pending` row still holds the slot under the exclusion constraint, re-booking the same time **fails**.

**Expected behaviour.** Resume where you left off; at minimum, never be told your own slot is unavailable.

**Current behaviour.**
- `client/src/pages/ServiceBooking.jsx:294` — `const [step, setStep] = useState("time")`. No `localStorage`, no URL state, no `beforeunload`. Grep for storage APIs in this 1,798-line file returns nothing.
- `bookings_no_overlap` excludes on `status <> 'cancelled'`, so the guest's own `pending` row blocks them.
- `server/controllers/bookingController.js:601` — the retry returns *"This time slot is no longer available. Please choose another."*
- `PENDING_BOOKING_HOLD_MIN` default 45 → the lockout lasts 45 minutes.

**Impact.** Revenue · UX · Support load. The guest sees a false scarcity message caused by their own abandoned attempt, at the exact moment they were trying to pay. This is the single worst message the system can produce, and it is produced by the most common interruption.

**Why we probably missed it.** UX gap. The happy path and the "slot genuinely taken" path were both designed. The path where *you* are the conflict was not — it requires thinking about a user across two sessions.

**Recommendation.** (a) Special-case the constraint violation: if the blocking row is this same guest's own `pending` booking, return it plus its manage token instead of a 409 ("You already have this slot held — finish paying"). (b) Persist `{bookingId, manageToken, step}` in `sessionStorage` and rehydrate on mount. Both are small; (a) alone removes the false message.

---

### F9 — There is no migration ledger; "which migrations are applied" is unanswerable

**Severity: HIGH** · **CONFIRMED** · Ops / Data / Documentation

**Finding.** 180 SQL files in `server/migrations/`. `scripts/migrate.js` reads a file, `client.query(sql)`, prints "Done." It records nothing — no ledger table, no ordering, no idempotency check, no checksum, no rollback.

**Expected behaviour.** Applying a migration records it; the deployed schema version is queryable.

**Evidence.**
- `server/scripts/migrate.js:60-70` — the whole apply step is `await client.query(sql)`.
- No `schema_migrations` / `migrations` table in `public` (see the full table list in §Appendix).
- `supabase_migrations.schema_migrations` has **103** rows against 180 files — those are Supabase-dashboard/MCP applications only.
- **19 duplicate version numbers** in the folder: `v1.9`×2, `v2.6`×2, `v2.8`×3, `v3.2`×2, `v3.16`×2, `v3.17`×2, `v3.31`×2, `v3.63`×2, `v3.69`×2, `v3.100`×**3**, `v3.101`×2, `v3.116`×2, `v3.117`×2, `v3.118`×2, `v3.128`×2, `v3.130`×2, `v3.133`×2, `v3.137`×2, `v3.138`×2. Version numbers are not identifiers.
- Consequence, already realised: `job_locks` missing (F3) while `CLAUDE.md` states "No migration is currently outstanding."

**Impact.** Data · Ops · Reliability. Every "is this applied?" question is answered by ad-hoc introspection or by trusting a hand-maintained note in `CLAUDE.md`. That note is currently wrong. The `schema-fallback` pattern (§Systemic S8) exists precisely to paper over this, and it works — which is why the drift stayed invisible.

**Why we probably missed it.** Operational gap. Migrations were applied through several channels over time (script, Supabase dashboard, MCP), and no single one was made authoritative.

**Recommendation.** Create `applied_migrations (filename PK, checksum, applied_at, applied_by)`. Make `migrate.js` insert on success and refuse to re-run a filename with a changed checksum. Backfill it once from a reconciliation pass. Then delete the hand-maintained migration log from `CLAUDE.md` — a doc that duplicates queryable state will always drift.

---

### F10 — The Razorpay webhook has zero test coverage

**Severity: HIGH** · **CONFIRMED** · Testing / Money

**Finding.** `handleWebhook` (`paymentController.js:1156-1512`, ~356 lines) is the highest-money-risk entry point in the system. There is **no test for it.**

**What it handles untested:** HMAC signature verification (incl. the `timingSafeEqual` length guard), `subscription.*` (activate/halt/cancel), `transfer.*` (host payout finalisation), `settlement.*`, `payment.dispute.*` (payout reversal), `refund.processed` (ledger + transfer reversal), `payment.captured` for bookings and products, `payment.failed`.

**Evidence.** `grep -rl "handleWebhook" server/tests` returns only `unit/whatsappWebhook.test.js` — a different webhook. There are 306 server test files, including `resendWebhookVerify.test.js` for the *email* webhook. The payments webhook has none.

Also untested: `expireStalePendingBookings` (zero tests — and it has the confirmed bug in F11), `createBooking` (only indirectly, via `bookingCalendarDeferral` and `bookingGrant`), `verifyPayment` (only via `verifyPaymentLoadStub`).

**Impact.** Money · Reliability. Test *count* is excellent and creates a false sense of coverage; the distribution is inverted — deep coverage of pure helpers, none on the money boundary.

**Why we probably missed it.** Testing gap driven by difficulty, not by judgment. Testing `handleWebhook` needs raw-body plumbing and a signature fixture. It was easier to test everything else.

**Recommendation.** One `unit/paymentWebhook.test.js` with a signed-body helper. Priority order: bad signature rejected · duplicate `payment.captured` transitions once · `refund.processed` posts once and reverses once · `payment.failed` writes nothing · unknown event returns 200.

---

### F11 — Two cancel paths write different fields, producing impossible states in production

**Severity: MEDIUM-HIGH** · **CONFIRMED** · Backend / Data

**Finding.** `cancelBookingRecord` sets `status`, `settlement_status='cancelled'`, `cancelled_at`, reverses any held Route transfer, deletes the calendar event, and notifies both parties. `expireStalePendingBookings` — the reaper — sets `status` and `cancelled_at` only, via a bulk `UPDATE`. It bypasses everything else.

**Evidence (live prod).** Four cancelled bookings carry `settlement_status='pending_completion'`, which is unreachable through the shared path:
```
927485d9…  cancelled | unpaid | settlement_status = pending_completion
2dd27713…  cancelled | unpaid | settlement_status = pending_completion
ebb3c824…  cancelled | unpaid | settlement_status = pending_completion
2a4d6e9e…  cancelled | unpaid | settlement_status = pending_completion
```
`server/controllers/bookingController.js:1942` — `.update({ status: "cancelled", updated_at, ...extra })`.

**Impact.** Data · Ops. `settlementService` and `payoutReconciler` both branch on `settlement_status` (`SKIP_SETTLE`). These rows are `unpaid` so no money is at risk today — but the invariant "cancelled ⇒ `settlement_status='cancelled'`" is already false in production, and any future logic that trusts it inherits the bug. The reaper also sends the guest **nothing**: their held slot is silently released.

**Why we probably missed it.** Architecture gap — no centralized lifecycle authority (§Systemic S1). The reaper was written as a sweeper (security audit H-2), not as a cancellation, so it never routed through the cancellation function.

**Recommendation.** Have the reaper set `settlement_status: 'cancelled'` too, and emit a `BOOKING_HOLD_EXPIRED` notification. Longer term, make `cancelBookingRecord` the only writer of `status='cancelled'` and give it a `reason` column (`guest`, `host`, `reaper`, `admin`).

---

### F12 — The highest-leverage admin endpoint has no audit trail

**Severity: MEDIUM-HIGH** · **CONFIRMED** · Security / Ops

**Finding.** `adminController.updateSettings` upserts arbitrary `platform_settings` keys — `platform_fee`, `gst_rate`, `clearing_days`, `fee_only_mode`, `payout_reconciler_mode`, `maintenance_mode` — with **no `audit()` call**. `featureFlagController` (33 kill-switches) has **no `audit()` call anywhere in the file**.

**Evidence.**
- `server/controllers/adminController.js:567-583` — loop, upsert, `clearCache()`, respond. No audit.
- `grep -n "audit" server/controllers/featureFlagController.js` → no matches.
- Contrast: `booking.update`, `user.delete`, `staff.create`, `kyc.pii_revealed` are all audited (26 audited action types, 289 rows in prod).

**Impact.** Security · Ops. If the platform fee changes, or `confirmation_emails` is switched off, or `payout_reconciler_mode` flips to `live`, there is no record of who did it or when. These are the levers that move money and silence customer communication — and they are the only admin actions with no trail.

**Why we probably missed it.** Integration gap. `auditService` was introduced with RBAC (v2.4) and retrofitted to the controllers that existed then. Settings and feature flags predate it and were never revisited.

**Recommendation.** Add `audit(req, { action: 'settings.update', before, after })` to `updateSettings` (capture `before` — a settings change without the old value is half a record) and `audit(req, { action: 'feature_flag.toggle', … })` to the flag controller.

---

### F13 — Admin can force any booking state transition, and hard-delete a paid booking

**Severity: MEDIUM-HIGH** · **CONFIRMED** · Backend / Data

**Finding.** Two problems in `adminController`:

1. `updateBooking` writes `status` **raw**, with no transition validation. The host-facing `completeBooking` enforces careful guards — "only a CONFIRMED booking may be completed" (P0-2), "only after the session has ended" (M-1) — and stamps `completed_at`, `revenue_recognized_at`, `settlement_status`. The admin path enforces none of them and stamps none of them. An admin can move `cancelled → completed`, producing a "completed" booking that never became settlement-eligible, or `completed → confirmed`, un-closing a revenue-recognised row.
2. `deleteBooking` is a hard `DELETE` with no guard on `payment_status`. A **paid** booking can be permanently destroyed. `journal_entries.source_id` has no FK to `bookings`, so its ledger entry survives as an orphan pointing at a nonexistent row; the guest's invoice and confirmation email reference an id that no longer resolves.

**Evidence.** `server/controllers/adminController.js:344-376` (`updateBooking`), `:378-387` (`deleteBooking`). Live prod: `booking.delete` appears once in `admin_audit_logs`, `booking.update` three times — so both are in real use.

The `payment_status='paid'` guard **is** present in `updateBooking` ("can only be set by a verified payment"), which shows the author was thinking about fabricated money — but only in that one direction.

**Impact.** Data · Money · Compliance. Irreversible, and destroys the audit chain for a financial record (GST invoices are issued against booking ids).

**Why we probably missed it.** Business-rule gap. The state machine was formalised in the host/guest controllers and never written down as a shared rule, so the admin controller — written earlier, as a generic CRUD surface — was never held to it.

**Recommendation.** Extract an `assertBookingTransition(from, to)` helper and call it from all three writers. Block `deleteBooking` when `payment_status <> 'unpaid'`; offer soft-delete/void instead.

---

### F14 — A dashboard refund leaves the booking row saying "paid"

**Severity: MEDIUM** · **CONFIRMED** · Data / Support / Product

**Finding.** `recordBookingRefund` — the handler for `refund.processed`, and the documented "only refund path" — posts the ledger entry and reverses the held transfer, but **never updates `bookings.payment_status`**. Only `financeAdminController.executeRefund` does that, and only for a full refund.

**Evidence.** `server/services/bookingCapture.js:191-243` — the function returns `{ posted, transferReversed, bookingId }` and touches no booking column. `grep "payment_status.*refunded"` finds exactly one writer: `financeAdminController.js:369`.

**Impact.** Support · Product · Data. Consumers of `payment_status` are all misled:
- `services/bot/contextAnswer.js:85` — Bolt answers "where is my refund?" by checking `payment_status === 'refunded'`. It will tell a refunded guest they were not refunded.
- The guest console and host dashboard both show "Paid".
- CRM revenue attribution (`crm/attribution.js:33`) treats a refunded booking as live revenue.

**Why we probably missed it.** Integration gap. The refund webhook was added as a **ledger** loophole fix ("the outflow never hit the ledger") and correctly solved the accounting problem. The *product state* was out of frame.

**Recommendation.** In `recordBookingRefund`, set `payment_status='refunded'` when the refund total ≥ `customer_total`; otherwise stamp a `refunded_amount` column. Also see Q4 — `payment_status` currently cannot express a partial refund at all.

---

### F15 — Failed payments leave no persisted record

**Severity: MEDIUM** · **CONFIRMED** · Data / Support / Analytics

**Finding.** The `bookings_payment_status_check` constraint permits only `unpaid | paid | refunded`. There is no `failed`. `payment.failed` therefore writes nothing — the code says so explicitly and correctly. But nothing else records the attempt either. `razorpay_orders` exists as a table and holds **0 rows**.

**Evidence.**
- `pg_constraint`: `CHECK (payment_status = ANY (ARRAY['unpaid','paid','refunded']))`.
- `server/controllers/paymentController.js:1467-1476` — the comment documents that the `'failed'` write was silently rejected for an unknown period and the drop-off analytics never fired.
- `server/controllers/bookingController.js:716` — a comment still refers to `'failed'` as a live value ("'unpaid' and 'failed' stay hidden"), i.e. code documentation describing a state the schema forbids.
- `select count(*) from razorpay_orders;` → **0**.

**Impact.** Support · Analytics. A guest emailing "my card was declined three times" leaves no trace a support agent can find. Payment-failure rate by reason — a first-order conversion metric — is not measurable from the database, only from PostHog.

**Why we probably missed it.** Data-model gap. `payment_status` conflates "attempt outcome" with "settlement state." A booking has one settlement state and N attempts; the schema models only the former.

**Recommendation.** Either populate `razorpay_orders` (it already exists) as a payment-attempt log, or add `booking_payment_attempts (booking_id, order_id, payment_id, status, error_code, error_description, created_at)`. Then surface the last 3 attempts in the admin booking drawer and in the support context rail. Also delete the stale `'failed'` reference in `bookingController.js:716`.

---

### F16 — Support threads have no SLA, no staleness detection, no escalation

**Severity: MEDIUM** · **CONFIRMED** · Product / Ops

**Finding.** `support_threads.status ∈ (bot, waiting, assigned, resolved)`. Nothing ages a thread, nothing alerts on a stale one, nothing re-queues an assigned thread whose agent went quiet.

**Evidence (live prod).**
```
status    | count | oldest since last message
assigned  |   7   | 5 days 19:44
bot       |   3   | 5 days 18:35
resolved  |  11   |
bot_escalations status='replied' | 1 | 4 days 01:58
```
Seven customers are sitting in `assigned` — meaning a human claimed the thread — with one waiting nearly six days. Three are stuck in `bot` (never escalated, never resolved). One escalation has been `replied` for four days with no closure.

`server/services/supportChatService.js` has `supportHours` (Mon–Fri 10–18 IST) for setting expectations, but no timer that acts on a breach.

**Impact.** Trust · Ops. The admin ops badge (`/api/admin/ops/summary`) is explicitly a work-queue for payouts, failed emails, abandoned bookings, flagged reviews and unverified hosts — **support threads are not in it.** Nothing surfaces "a customer has waited six days."

**Why we probably missed it.** Product gap. The chat was built as a real-time channel; a real-time channel makes latency feel impossible, so the aging case was never designed.

**Recommendation.** Add `first_response_at` and `last_agent_reply_at`. Add `assigned`/`waiting` threads older than N business hours to `totalAttention` in the ops badge. Auto-unassign a claimed thread with no agent reply in 24h so it returns to the queue.

---

### F17 — The lead lifecycle has no exit; 190 leads, zero ever closed

**Severity: MEDIUM** · **CONFIRMED** · CRM / Product

**Finding.** `leads_status_check` (v3.126) permits `lost` and `do_not_contact`. Neither is ever used. Leads accumulate in `contacted` indefinitely.

**Evidence (live prod).**
```
contacted: 121 | qualified: 61 | replied: 4 | paid: 3 | new: 1     (total 190)
lost: 0 | do_not_contact: 0
```
64% of the entire pipeline is parked in a single non-terminal state. `crm/lifecycleEngine.js` runs every 15 minutes and advances leads forward; nothing decays or closes them.

**Impact.** Ops · Data quality. Every pipeline metric is inflated. The sales team cannot distinguish "contacted yesterday" from "contacted in June and never replied." `touch_recommendations` and the nurture sequences will keep re-touching leads that will never convert — which, once `crm_admin_sends` is switched on, becomes outbound spam to dead contacts.

**Why we probably missed it.** Business-rule gap. `lifecycleRules.js` was designed as a promotion ladder. Demotion, decay, and closure are the half nobody specifies because they aren't the exciting half.

**Recommendation.** Define a decay rule (e.g. `contacted` + no meaningful interaction in 45 days → `lost`, reversible on any reply) and implement it in `lifecycleEngine`. Backfill once. Suppress sequence enrolment for terminal leads.

---

### F18 — "Delete user" leaves the guest's name, email and phone in `bookings` forever

**Severity: MEDIUM** · **CONFIRMED** · Security / Legal / Data

**Finding.** `deleteUser` deletes the `profiles` row and purges Storage objects (good — that was fixed in #911). But `bookings_guest_id_fkey` is `ON DELETE SET NULL`, and `bookings.guest_name`, `guest_email`, `guest_phone` are denormalised columns on the booking. They survive.

**Evidence.**
- `pg_constraint`: `bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES profiles(id) ON DELETE SET NULL`.
- `server/controllers/adminController.js` `deleteUser` — deletes `profiles`, calls `purgeUserStorage`, audits. No booking-column redaction.
- The same denormalised PII also sits in `contacts`, `leads`, `support_threads`, `in_app_notifications` and `notification_logs.destination`, none of which are touched.

**Impact.** Legal (DPDP Act 2023 / GDPR-equivalent erasure) · Trust. A deletion request is honoured in the identity table and quietly ignored everywhere the data actually accumulated. There is also **no self-service deletion** — only an admin endpoint.

**Why we probably missed it.** Scope gap. "Delete the user" was implemented as "delete the user row." Erasure across denormalised copies is a different, larger problem that was never scoped.

**Recommendation.** Write an erasure routine that redacts (not deletes — the booking is a financial record) `guest_name/email/phone` to `'[deleted]'` across `bookings`, and purges the row in `contacts` / `leads` / `support_threads`. Record what was erased in the audit entry. Decide the retention position for financial records explicitly — see Q5.

---

### F19 — The bank-holiday calendar expires on 2027-01-01 with no alarm

**Severity: MEDIUM** · **CONFIRMED** · Ops / Product

**Finding.** `bankHolidays.js` hardcodes a date→name map. 2026 is complete (22 dates). 2027 has **four** entries — Republic Day, Independence Day, Gandhi Jayanti, Christmas. Every movable festival (Holi, both Eids, Diwali, Dussehra, Janmashtami, Ganesh Chaturthi, Muharram, Ram Navami…) is missing.

**Evidence.** `server/utils/bankHolidays.js:14` — `// 2026 is the full list; TODO(yearly): refresh movable festival dates for 2027+`.

**Impact.** Product · Trust. `payoutHolidayNotice` runs weekly and tells hosts when a holiday will delay their payout. From January 2027 it will be wrong about roughly 15 days a year, silently — under-warning hosts on exactly the days their money is late. Nothing detects that the data has gone stale.

**Why we probably missed it.** Operational gap. The TODO is honest and correct; it just has no owner, no date, and no alarm. A `TODO(yearly)` in a source file is not a schedule.

**Recommendation.** Cheapest fix: on boot, if the current year has fewer than 10 entries, `adminAlert`. Better: move to a `bank_holidays` table with an admin editor (the comment already suggests this).

---

### F20 — `autoCompleteBookings` can starve permanently at scale

**Severity: MEDIUM** · **INFERRED** · Backend / Reliability

**Finding.** The auto-complete cron selects up to 200 `status='confirmed'` bookings ordered by `scheduled_at ASC`, then skips any whose session ended before `AUTO_COMPLETE_CUTOFF` (default: 3 days before **process boot**). Skipped rows are never marked, so they are re-selected forever.

**Evidence.** `server/controllers/bookingController.js:1874-1915` — `.limit(AUTO_COMPLETE_BATCH)` where `AUTO_COMPLETE_BATCH = 200`, `.order("scheduled_at", { ascending: true })`, then `if (sessionEnd < AUTO_COMPLETE_CUTOFF.getTime()) continue;`.

**Impact.** Reliability · Money. If 200+ old `confirmed` bookings ever accumulate (a host who never completes, an outage, a long deploy gap), the batch fills entirely with pre-cutoff rows and **no booking is ever auto-completed again** — silently. Completion is what makes revenue settle-able, so this stalls host payouts.

Not reachable today (48 bookings). Reachable at a few hundred active hosts.

**Why we probably missed it.** Architecture gap. The cutoff was added to bound a first-run backfill; it interacts badly with a fixed-size ascending batch. The unit test (`autoCompleteBookings.test.js`) covers the per-row decision, not the batch.

**Recommendation.** Add `.gte('scheduled_at', cutoff)` to the query so pre-cutoff rows are excluded in SQL and cannot occupy the batch. One line.

---

### F21 — Webhooks are handled but never recorded

**Severity: MEDIUM** · **CONFIRMED** · Ops / Observability

**Finding.** There is no `webhook_events` table. Razorpay events are verified, dispatched, and discarded. Idempotency is achieved per-handler through conditional updates (which is genuinely well done) — but there is no record of what arrived, when, or whether it was a redelivery.

**Evidence.** No such table in `public`. `handleWebhook` audits *outcomes* (`WEBHOOK_BOOKING_PAID`, `WEBHOOK_REFUND`) via `auditLog` → `logger`, not to a queryable store keyed on Razorpay's event id.

**Impact.** Ops. When a payment goes wrong, "did the webhook arrive, and what did it say?" is unanswerable without the Razorpay dashboard. A 500 triggers Razorpay retries; if retries exhaust, the `adminAlert` fires — but there is no record to replay from. There is no way to distinguish "we never got it" from "we got it and mishandled it."

**Why we probably missed it.** Operational gap. Each handler was made correct in isolation; the transport was never treated as a system with its own state.

**Recommendation.** `webhook_events (id, provider, event_id UNIQUE, event_type, received_at, processed_at, outcome, payload jsonb)`. Insert before dispatch; a duplicate `event_id` short-circuits. This is also the cheapest possible payments-forensics tool and directly supports F10's tests.

---

### F22 — Documentation contradicts the system in load-bearing places

**Severity: MEDIUM** · **CONFIRMED** · Documentation

**Finding.** The four files `CLAUDE.md` mandates reading every session are stale in ways that would actively mislead.

**Evidence.**
- `docs/current-state.md` (header: "rest last reviewed 2026-06-13") claims the Financial Ledger is on an unmerged branch (it is live — 44 journal entries in prod), the guest booking dashboard is unbuilt (shipped, #774–781), email is SMTP/Nodemailer (production is Resend), and admin auth is "OTP-based" (it is password + mandatory TOTP, v3.13).
- `CLAUDE.md`: "No migration is currently outstanding" — see F3.
- `docs/CHANGELOG.md` last entry is Sprint 11, 2026-08-25; ~40 merges have landed since, through PR #920.
- 23 markdown files at the repo root, most from early June: `BUG_REPORT.md`, `FINAL_VERDICT.md`, `SYNTAX_FIX_REPORT.md`, `LOAD_TEST_BLOCKERS.md`, `PERFORMANCE_READINESS.md`, `FIRST_5_STEPS_STATUS.md`, `OPTIMIZATION_REPORT.md`, `BOTTLENECK_ANALYSIS.md`, `CAPACITY_ESTIMATE.md`, `BENCHMARK_REPORT.md`. None dated, none marked superseded. Two overlapping security audits (`SECURITY_AUDIT.md`, `SECURITY_AUDIT_2026-07-02.md`) and two `DEPLOYMENT.md` (root and `docs/`) with different content.
- `render.yaml` warns that integration tests hit live Supabase; they are fully mocked (`makeSbMock()`), while `CLAUDE.md` instructs "Before Finishing: run `npm test`". A reader has to choose which document to disbelieve.

**"If a new engineer joined tomorrow, what would they misunderstand?"**
1. That the ledger isn't live and refunds aren't a concern.
2. That `npm test` is dangerous (it isn't) — so they'd skip it.
3. That the migration state in `CLAUDE.md` is authoritative.
4. That WhatsApp templates are a code concern (they're DB-configured).
5. That `role`/`vendor` in the code means something different from `is_host`/`host` in the UI — this one **is** documented, and is the model to follow.

**Recommendation.** Regenerate `current-state.md` from reality. Move superseded root MDs to `docs/archive/` with a dated header. Delete the migration log from `CLAUDE.md` once F9's ledger table exists.

---

### F23 — Fifteen hosts are stuck mid-onboarding with no follow-up that fires

**Severity: MEDIUM** · **CONFIRMED** · Product / Growth

**Finding.** 15 of 78 hosts (19%) have `is_host = true` and `onboarding_completed = false`. `profileCompletion` exists to chase exactly these — and runs on a 12-hour `setInterval` (see F4), so it likely never fires.

**Evidence (live prod).** `onboarded: 63, not_onboarded: 15`. `server/server.js:346` — `processProfileCompletion` at 12h. `server/services/profileCompletion.js` is deduped and capped per host.

**Impact.** Growth. A fifth of signups are parked. The recovery mechanism was built (#761–764) and does not execute.

**Why we probably missed it.** This is F4 with a face on it — the class of bug where the feature is real, the tests pass, and the schedule never comes.

**Recommendation.** Fix F4; then instrument onboarding-stage drop-off so this is visible without a SQL query.

---

### F24 — Small confirmed items

| # | Finding | Evidence | Severity |
|---|---|---|---|
| a | `razorpay_orders` is a dead table (0 rows, no writer) — either wire it up as the attempt log (F15) or drop it. | live prod | LOW |
| b | `bookingController.js:716` comment references `payment_status='failed'`, which the CHECK constraint forbids. | code | LOW |
| c | `exploreController.js:225,258,272` — three `TODO` stubs for featured slots / collections / sponsored keywords. Explore ranking silently has no monetisation surface despite the UI implying one. | code | LOW |
| d | `AdminBookings.jsx:25,843,929,961` — four `TODO(backend)` markers: no booking search endpoint, host phone not returned, settlement/payout column empty, audit log not joined. The admin booking screen is a shell over a list endpoint. | code | MEDIUM |
| e | `ManageBooking` cannot reschedule ("deliberate follow-up, #516") — guests are pointed at support, adding support load by design. | code | LOW-MED |
| f | 1 booking with `transfer_status='failed'` in prod. `payoutReconciler` is in `observe` mode, so it alerted and moved nothing. Correct behaviour — but nothing tracks whether the alert was acted on. | live prod | MEDIUM |
| g | 12 rows in `email_logs` with `status <> 'sent'`, 1 failed `notification_log`. Windowed into the ops badge at 14 days, so older failures silently age out of view rather than being resolved. | live prod | LOW-MED |

---

## 3. State machines

### 3.1 Booking

**States (DB-enforced):** `pending`, `confirmed`, `cancelled`, `completed`, `no_show`.
**Payment states:** `unpaid`, `paid`, `refunded`.
**Settlement states (no constraint):** `pending_completion`, `eligible_for_settlement`, `not_eligible`, `cancelled`.

```
                    ┌───────────────────────────────┐
  create (free) ───▶│  confirmed / paid             │
  create (paid) ───▶│  pending / unpaid  ──capture──┴──▶ confirmed / paid
                          │                                    │
              45m reaper  │                        auto-complete (+2h) or host
              (silent)    ▼                                    ▼
                      cancelled ◀── guest/host cancel ──   completed
                                     (no refund)                │
                                                          revenue recognised
                                                          settlement eligible
```

| Aspect | State |
|---|---|
| Missing state | **`refund_pending`** — the gap behind F2. Also `payment_failed` (F15), and `disputed` (tracked in a side table only). |
| Missing transition | `paid + cancelled → refunded`. Exists in the CHECK constraint, has never occurred (0 rows). |
| Invalid transitions allowed | Admin `updateBooking` permits **any** `status` value with no guard (F13). Host/guest paths are correctly guarded. |
| Repeated transition | Well handled — `completeBooking` and `cancelBooking` are both explicitly idempotent, and `finalizeBookingCapture` uses conditional `.neq()` predicates. **Best-in-class here.** |
| Timeout | `pending` → 45 min → reaper. **Silent** — no guest notification (F11). |
| Abandonment | Guest loses all state and is locked out of their own slot (F8). Recovery email links to a cancel button (F7). |
| Staleness | `confirmed` past its session auto-completes after 2h. Batch can starve (F20). |
| Permissions on transition | Correct on host/guest paths; absent on admin. |

### 3.2 Payment
`created → attempted → captured → (refunded)`. Only `captured` and `refunded` are modelled; `attempted` and `failed` are not persisted at all (F15). Capture is exactly-once across three independent paths (client verify, webhook, reconciler) sharing `finalizeBookingCapture` — **this is the strongest part of the system.**

### 3.3 Subscription
`pending → active → halted → cancelled/expired`, driven by Razorpay webhooks with a `syncVendorSubscription` fallback and a 15-minute reconciler. Idempotency on re-click is handled thoughtfully (fetch existing mandate, compare `notes`). **Gap:** `subscription-expiry` warnings run on a 6h `setInterval` (F4) — the T-7/T-1 nudge likely never fires. **Gap:** cancellation is immediate in the DB (`subscription_status='cancelled'`) while access is supposed to last to `current_period_end` — the status field says one thing and `resolveVendorPlan` says another.

### 3.4 Support thread
`bot → waiting → assigned → resolved`. No timeouts, no SLA, no auto-unassign, no re-queue, not in the ops badge (F16). `resolved` can be reopened (`supportReopen.test.js`), which is good.

### 3.5 Lead
13 states from `new` to `champion`, promotion-only. `lost` and `do_not_contact` exist and are never reached (F17). No decay, no dormancy, no closure.

### 3.6 KYC / payout
`pending → approved | rejected`, then Route: `none → pending → created | error`, then activation `activated`. Well modelled, correctly gated by `payoutEligibility.js` (a genuinely good single-source-of-truth refactor). All 8 prod submissions are `approved` — the `rejected` branch and its `KYC_REJECTED` → resolution flow have never been exercised in production.

### 3.7 Notification
`queued → sent → (delivered | bounced)`. Delivery truth arrives via the Resend webhook. **Gap:** an in-app notification has `read_at` and `resolved_at` but no expiry — 35 unread notifications, oldest unbounded. Nothing ages them out.

---

## 4. The middle 20%

| Scenario | Handled? | Evidence |
|---|---|---|
| Duplicate click on "Pay" | ✅ Excellent | `createOrder` reuses an open order, 409s if already captured (P2-11). |
| Duplicate click on "Subscribe" | ✅ Excellent | Fetches the pending mandate, compares `notes`, returns the existing id. |
| Webhook arrives twice | ✅ | Conditional `.neq()` predicates + ledger `UNIQUE(source_type, source_id)`. |
| Webhook arrives late (post-reap) | ✅ | `finalizeBookingCapture` has `.neq('status','cancelled')` so a reaped hold can't be resurrected. |
| Webhook never arrives | ✅ | Three reconcilers. |
| Payment succeeds, confirmation fails | ✅ | `confirmationReconciler` (P1-02). |
| Payment succeeds, ledger fails | ⚠️ **Partially** | Reconciler exists but can be permanently poisoned with no alert (F1). |
| Browser closes mid-checkout | ❌ | Total state loss + self-lockout (F8). |
| Guest returns later | ❌ | Recovery email is a cancel button (F7). |
| Two guests, same slot | ✅ Excellent | GiST exclusion constraint + per-host mutex. |
| Two tabs, same guest | ⚠️ | Second tab's booking attempt is blocked by the first tab's own hold with a misleading message. |
| Host cancels while guest is paying | ⚠️ | `createOrder` checks `status === 'cancelled'`; `verifyPayment` does not re-check. A capture in flight against a just-cancelled booking is stopped by `finalizeBookingCapture`'s `.neq('status','cancelled')` — so the money is captured at Razorpay and **no refund is triggered**. Same root cause as F2. |
| Admin changes settings mid-flow | ⚠️ | Pricing is snapshotted at creation (correct), but no audit of who changed what (F12). |
| External service down (Razorpay) | ✅ | Retries on fee fetch, `adminAlert` on exhaustion, fail-open on non-critical reads. |
| External service down (Google Calendar) | ✅ | try/catch, non-fatal, orphan event cleanup on insert failure (P2-04). |
| User loses permission midway | ❌ **Admin only** | 8-hour window (F6). Host/guest side is correct. |
| Automated process runs after manual change | ⚠️ | Reaper doesn't check `settlement_status`; auto-complete doesn't check for an admin's manual status edit. |
| Deploy during in-flight work | ⚠️ | `runInBackground` tasks are lost on SIGTERM; `confirmationReconciler` covers the confirmation case, nothing covers the others (analytics, product emails). |

**Summary:** concurrency and idempotency in the payment path are excellent — genuinely better than most production systems this size. **Every single unhandled case is on the human side of the flow**: a person who leaves, comes back, changes their mind, or wants money returned.

---

## 5. Systemic patterns

These matter more than the individual findings.

### S1 — There is no centralized lifecycle authority
Booking `status` is written from **five** places: `cancelBookingRecord`, `expireStalePendingBookings`, `markBookingCompleted`, `finalizeBookingCapture`, `adminController.updateBooking`. Three of them enforce guards; two don't. The rules live in comments (`P0-2:`, `P1-5:`, `M-1:`) rather than in a function. Result: F11's impossible states and F13's unguarded admin writes. *The fix is one `assertBookingTransition()` and a rule that all five call it.*

### S2 — Everything self-heals; nothing reports
Four reconcilers, `postSafe`, `runInBackground`, fail-open `jobLock`, fail-open `ipGuard`, `try {} catch {}` around every notification. Each is individually correct. **Collectively they form a system that cannot fail loudly.** F1 is the proof: a money bug retried ~700 times over four weeks in total silence. There is no retry-exhaustion concept anywhere — `postSafe` has no counter, `runInBackground` has no dead-letter, `jobLock` warns once per process. *The rule to adopt: every fail-soft path needs a failure budget, and crossing it must page a human.*

### S3 — Scheduling is an implementation detail, not infrastructure
22 `setInterval` calls in `server.js`, no job history, no heartbeat, no external scheduler, leader election dependent on a table that doesn't exist. Consequences: F3, F4, F19, F23. *Adding a `job_runs` table is the single change that makes the largest number of other problems visible.*

### S4 — Money in is designed; money out is not
Payment capture: three redundant paths, exactly-once, ledger-posted, invoice-generated, reconciled hourly. Refund: one manual admin button, never used, doesn't update the booking row, has no guest-facing entry point, and no policy shown to anyone. This asymmetry produces F2, F14, and the cancel-while-paying race. *A marketplace's refund path deserves the same rigour as its capture path.*

### S5 — The audit trail covers identity, not configuration
Who changed a user, a booking, a staff member, a KYC document — all recorded. Who changed the platform fee, the GST rate, `fee_only_mode`, `payout_reconciler_mode`, or any of 33 kill-switches — not recorded (F12). *The audit model followed the resources, not the risk.*

### S6 — Front-end money flows have no durable state
`ServiceBooking.jsx` (1,798 lines) holds a five-step payment flow in `useState`. `ProductPurchase.jsx` (704 lines) is the same shape. The server is meticulous about not losing a booking; the client loses it on a refresh (F8). *Server-side durability was solved; client-side durability was never posed as a question.*

### S7 — Features ship complete and land unintegrated
The recurring shape: a PR builds a capability correctly, tests it thoroughly in isolation, and never checks its seams.
- `abandonedRecovery` → `ManageBooking` (F7): sends a `resume_url` to a page that cannot resume.
- `refund.processed` → `bookings` (F14): fixes the ledger, leaves the product state lying.
- `v3.130 merge_lead_rows` → `v3.100` hardening (F5): new function, established pattern not applied.
- `expireStalePendingBookings` → `cancelBookingRecord` (F11): new cancel path, existing one not reused.
- notification resolution (`resolveInApp`) → payout-failed: two of three cases wired, third listed as "not yet built."

*A "what does this touch?" checklist in the PR template would have caught four of these five.*

### S8 — The schema-fallback pattern became a permanent crutch
Every SELECT and INSERT that touches a post-v1.7 column carries a fallback for a database that lacks it. This was correct as a migration-lag bridge. It is now ~40 code sites of permanent dead weight that also **hides drift**: when `job_locks` went missing, the fallback swallowed it. Combined with the absent migration ledger (F9), the system's response to "my schema doesn't match" is to keep going quietly. *Once F9's ledger exists, retire the fallbacks for anything confirmed applied on both DBs.*

---

## 6. Gap matrix

| Area | What exists | What is missing | Risk | Priority |
|---|---|---|---|---|
| **Product** | Booking, payment, subscription, products, referrals, invoicing, KYC, payouts | Refund path a guest can reach; cancellation policy; checkout resume; lead closure; reschedule via manage link | Revenue, trust, legal | **P0** |
| **UX** | Polished flows, design system, error pages, empty states | Checkout persistence; self-lockout message; refund expectations at cancel; onboarding drop-off recovery | Conversion, support load | **P0/P1** |
| **Backend** | Idempotent capture, mutexes, GiST constraint, 4 reconcilers, graceful shutdown | Centralized transition guard; retry budgets; batch-starvation fix; webhook event log | Data integrity | **P0/P1** |
| **Database** | 180 migrations, GST/TDS/TCS model, double-entry ledger, RLS-off/service-role design | Migration ledger; `settlement_status` CHECK; payment-attempt table; PII erasure; `job_locks` (absent) | Data integrity, compliance | **P0** |
| **Payments** | Razorpay orders + subs + Route + disputes, signature verification, amount binding, ledger | Refund UX; negative-payout clamp; partial-refund state; `payment_status='failed'` | **Money** | **P0** |
| **Notifications** | NotificationEngine, 3 channels, DB-configured, dedupe, resolution, realtime bell | Reaper/cancel notices; long-interval crons that fire; notification expiry; host preferences UI | Trust | P1 |
| **Chat** | Realtime threads, Bolt handoff, admin inbox, escalations, ratings, context rail | SLA, staleness detection, auto-unassign, ops-badge inclusion | Trust | P1 |
| **CRM** | 4 boards, lifecycle engine, sequences, attribution, scoring, Meta CAPI | Terminal states; decay; suppression of dead leads before sends go live | Ops, spam risk | P1 |
| **Admin** | RBAC + TOTP, Host360, finance, payouts, campaigns, ops badge | Settings/flag audit; transition validation; booking search; paid-booking delete guard; support in ops badge | Ops, data | **P0/P1** |
| **Security** | 2FA, IP blocking, RISC, encrypted PII, signature verification, ban gate, rate limits | `merge_lead_rows` grant; admin session revocation; PII erasure completeness | Security | **P0** |
| **Testing** | 449 test files, strong unit coverage | Payments webhook (0 tests); reaper (0); `createBooking` (indirect); race/concurrency; state transitions | **Money** | **P0** |
| **Analytics** | PostHog + GA4 + Meta CAPI, server-side, EMQ, dedupe | Payment-failure reasons; checkout step drop-off; onboarding funnel; support SLA | Growth blindness | P1 |
| **Monitoring** | Sentry, `/metrics`, `/ready`, `/status`, adminAlert, ops badge | Job-run history; retry-exhaustion alerts; ledger-imbalance alert; stale-data detection | **Silent failure** | **P0** |
| **Documentation** | 60+ docs, feature map, architecture, decisions, runbook | Truth: `current-state.md` stale, CHANGELOG 40 PRs behind, 23 orphan root MDs, false migration claim | Onboarding, decisions | P1 |

---

## 7. What we should have done earlier

### Should have designed earlier
- **The refund.** Not "Ledger Phase 3" — the *product answer* to "the guest wants their money back." Cancellation shipped without it and has been live for months.
- **A single booking-state authority.** Five writers, rules in comments.
- **Checkout as a resumable server-side object**, not client component state.
- **Admin session revocation**, mirroring the host-side work that was done properly.

### Should have documented earlier
- **A schema source of truth.** 180 files, 19 duplicate versions, a hand-typed log in `CLAUDE.md` that is wrong.
- **The booking state machine**, as a diagram plus a guard function — not as `P0-2:` comments.
- **Which docs are superseded.** 23 root MDs, no dates, no archive.
- **The refund/cancellation policy**, for guests, hosts, and support — `refundTierPct` is a business rule that exists only inside one admin controller.

### Should have automated earlier
- **Migration application + recording.** The one step in the deploy pipeline still done by hand.
- **Scheduling.** `setInterval` + `autoDeploy` is a scheduler that silently doesn't schedule.
- **Refund on cancel** — or at minimum an auto-created refund request.
- **Lead decay and support-thread aging.** Both currently rely on a human noticing.

### Should have tested earlier
- **The payments webhook.** 356 lines, every money event, zero tests, among 449 test files.
- **The reaper.** Zero tests, and it has a confirmed data bug.
- **State transitions as a table.** Every (from, to, actor) pair, allowed or rejected.
- **Ledger balance for every pricing shape** — including fee-only, which is what F1 is.

### Should have monitored earlier
- **Job runs.** Cannot currently answer "did the weekly recap send?"
- **Retry exhaustion.** F1 retried ~700 times in silence.
- **Ledger imbalance.** A daily "unposted paid bookings" check would have caught F1 on day one.
- **Support SLA.** Six days is currently invisible.
- **Data staleness.** Bank holidays, KB freshness, reserved slugs — all hardcoded, none alarmed.

### Should have asked earlier
See §8 — these are the open business questions.

### Hidden debt we are currently carrying
1. `job_locks` missing → horizontal scaling is blocked and the block is invisible.
2. ~40 schema-fallback sites that will never be removed without a migration ledger.
3. 19 duplicate migration version numbers → version numbers are not identifiers.
4. Ledger books ₹35.40 short and diverging on every fee-only booking.
5. Four paid, cancelled, unrefunded bookings — a small but real liability.
6. Four impossible-state rows (`cancelled` + `pending_completion`).
7. `docs/current-state.md` actively misleading on the ledger, guest console, and email provider.
8. `bankHolidays` expires 2027-01-01.
9. `razorpay_orders`: a table that exists and does nothing.
10. Ledger P2–P5 unbuilt while P1 is live in production, with no roadmap entry.

---

## 8. Questions only you can answer

These are business decisions, not engineering ones. **I have deliberately not guessed at them.**

**Q1 — What is the cancellation and refund policy?** `refundTierPct` implies a tiered model with a no-refund window under 6 hours, but it is admin-only and nothing states it publicly. Specifically: (a) Does a guest cancelling get money back automatically, or on request? (b) Who eats the ~₹2 gateway fee on a refund — BAS, or the host? (c) Is the ₹10 platform fee refundable? (d) Does a host cancelling owe the guest more than a guest cancelling? Everything in F2 follows from this answer.

**Q2 — Is fee-only mode permanent or interim?** F1's negative payout only exists in fee-only mode. If it is interim (as `v3.94` implies), the fix is a clamp. If it is a real product mode, the payout formula needs re-deriving.

**Q3 — When does the second API instance arrive?** `job_locks` is harmless today and dangerous the day you scale. If scaling is >6 months out this is P2; if it's next month it's P0.

**Q4 — Should `payment_status` express a partial refund?** Today it cannot — the constraint is `unpaid|paid|refunded`, and `executeRefund` deliberately leaves a tiered refund as `'paid'` with the truth only in the ledger. Is a partial refund a state, or an amount?

**Q5 — What is the retention position on a deleted user's booking records?** GST invoices are issued against booking ids and legally must be retained. Guest name/email/phone on those bookings arguably must be erased on request. The two are reconcilable (redact, don't delete) but it's your call to make explicitly.

**Q6 — Who owns the support SLA?** F16's fix depends on the target: 4 business hours? 24? Nothing is currently promised anywhere.

**Q7 — When is a lead dead?** F17's decay rule needs a number. 30 days? 60? Never (and just filter the views)?

---

## 9. Recovery plan

### P0 — Fix immediately

**P0-1 · Clamp negative host payout + alert on ledger poison**
Problem → F1: fee-only bookings produce `vendor_amount < 0`, ledger entry can't balance, reconciler fails hourly in silence.
Why it matters → The books are wrong by construction and the self-healing guarantee everything else assumes is broken.
Area → `lib/pricingEngine.js`, `services/ledger/postingService.js`, `services/ledger/ledgerReconciler.js`.
Fix → Clamp `calculateVendorPayout` at 0; route the gateway fee to BAS when `servicePrice === 0`; add a failure counter to `postSafe` that `adminAlert`s and quarantines after 3 attempts on the same `source_id`.
Depends on → Q2.
Test → `journalTemplates.test.js`: balance assertion for the fee-only shape. `pricingEngine.test.js`: payout never negative.
Migration/backfill → Three `ADJUSTMENT` journal entries for the affected bookings (₹35.40).
Owner → Backend + finance.

**P0-2 · Revoke `merge_lead_rows` from `anon`/`authenticated`**
Problem → F5: destructive `SECURITY DEFINER` function callable with the public anon key.
Why it matters → Unauthenticated, irreversible data destruction; breaks an invariant the rest of the DB holds.
Area → `migrations/`, both DBs.
Fix → `REVOKE ALL ON FUNCTION public.merge_lead_rows(uuid, uuid) FROM PUBLIC, anon, authenticated;`
Depends on → none.
Test → Re-run `get_advisors(security)`; the WARN must clear.
Migration → `v3.139_merge_lead_rows_revoke.sql`, apply to **both** DBs.
Owner → Backend/DBA.

**P0-3 · Apply `v3.25_job_locks.sql` and make its absence loud**
Problem → F3: leader election silently disabled in production.
Why it matters → Blocks scaling; the day a second instance appears, money-touching reconcilers race and every host gets duplicate messages.
Area → `migrations/v3.25`, `utils/jobLock.js`.
Fix → Apply to both DBs; change `acquire()`'s catch to `adminAlert` (throttled hourly) instead of a one-time `console.warn`.
Depends on → Q3 for urgency (fix is cheap either way).
Test → `select count(*) from job_locks` returns rows after one cron cycle.
Owner → Backend/DBA.

**P0-4 · Booking-state transition guard**
Problem → F13 + F11: admin can force any transition and hard-delete a paid booking; the reaper writes a partial cancel.
Why it matters → Irreversible corruption of financial records; already producing impossible states in prod.
Area → `controllers/bookingController.js`, `controllers/adminController.js`.
Fix → `assertBookingTransition(from, to, actor)`; call from all five writers. Block `deleteBooking` when `payment_status <> 'unpaid'`. Make the reaper write `settlement_status: 'cancelled'`.
Depends on → none.
Test → A transition matrix test: every (from, to, actor) triple, allowed or 409.
Backfill → Repair the four `cancelled` + `pending_completion` rows.
Owner → Backend.

**P0-5 · Payments-webhook test suite**
Problem → F10: 356 lines handling every money event, zero tests.
Why it matters → The one place where a regression silently loses or duplicates money.
Area → `server/tests/unit/paymentWebhook.test.js` (new).
Fix → Signed-body helper + cases listed in F10.
Depends on → ideally P0-6 (`webhook_events`) for replay fixtures, but not blocking.
Owner → Backend.

**P0-6 · Migration ledger**
Problem → F9: no record of what schema is deployed; `CLAUDE.md`'s claim is false.
Why it matters → Root cause of F3, and of every future silent drift.
Area → `scripts/migrate.js`, new table.
Fix → `applied_migrations (filename PK, checksum, applied_at, applied_by)`; `migrate.js` inserts on success and refuses a changed checksum.
Backfill → One reconciliation pass across all 180 files on both DBs. **This will surface other missing migrations — expect it.**
Owner → Backend/DBA.

**P0-7 · Admin session revocation**
Problem → F6: 8-hour window on deactivation and permission changes; no "sign out all admins."
Why it matters → `finance.manage` can issue refunds; `kyc.pii_reveal` exposes PII; both survive revocation for 8 hours.
Area → `middleware/adminMiddleware.js`, `admin_users`.
Fix → `admin_users.sessions_valid_after` + `is_active`; one cached (30–60s) read in `authenticate()`. Drop TTL to 2h.
Test → Extend `adminMiddleware.test.js`: deactivated admin rejected within the cache window.
Migration → `v3.140_admin_session_revocation.sql`, both DBs.
Owner → Backend/security.

### P1 — Fix next

**P1-1 · Resume payment from the manage-booking link** (F7 + F8) — `POST /api/manage-booking/:token/pay-order` + a "Complete payment" button. Also return the guest's own held booking (with its manage token) instead of a 409 when the exclusion constraint blocks them. *Highest ROI item in this document.* Test: reuse-own-hold path, and pay-by-token authorization.

**P1-2 · Refund path** (F2 + F14) — blocked on **Q1**. Minimum viable: surface the policy at cancel time, create a `refund_requests` row on every paid cancellation, put the queue in the ops badge, and make `recordBookingRefund` set `payment_status='refunded'` on a full refund.

**P1-3 · Job-run history + staleness alerts** (F4, F19, F23) — `job_runs` table written from `runLocked`; alert when `last_run_at > 2 × interval`; drive ≥6h jobs from persisted `last_run_at` on a 15-minute tick. *Makes S2 and S3 visible in one change.*

**P1-4 · `webhook_events` table** (F21) — insert before dispatch, unique on provider event id, short-circuit duplicates. Also the fixture source for P0-5.

**P1-5 · Audit settings + feature flags** (F12) — `audit()` in `updateSettings` (with `before`) and `featureFlagController`.

**P1-6 · Support SLA** (F16) — blocked on **Q6**. `first_response_at`, `last_agent_reply_at`, ops-badge inclusion, auto-unassign at 24h.

**P1-7 · Payment-attempt log** (F15) — populate `razorpay_orders` or add `booking_payment_attempts`; surface in the admin drawer and support rail. Remove the stale `'failed'` comment.

**P1-8 · `autoCompleteBookings` starvation** (F20) — add `.gte('scheduled_at', cutoff)`. One line, do it with P1-3.

**P1-9 · Documentation truth pass** (F22) — regenerate `current-state.md`; archive the 23 root MDs; bring `CHANGELOG.md` current; delete the migration log from `CLAUDE.md` once P0-6 lands.

**P1-10 · PII erasure routine** (F18) — blocked on **Q5**. Redact denormalised guest PII across `bookings`, purge `contacts`/`leads`/`support_threads`, record what was erased.

### P2 — Improve
Checkout state persistence (`sessionStorage`); lead decay (Q7); notification expiry; `settlement_status` CHECK constraint; retire schema fallbacks for confirmed-applied migrations; admin booking search (F24d); reschedule via manage link (F24e); onboarding funnel analytics; drop or wire `razorpay_orders`; move bank holidays to a table; `explore` monetisation stubs (F24c); a "what does this touch?" section in the PR template.

---

## Appendix — verification queries

Every **CONFIRMED** finding above is reproducible. Run against prod (`ayjhlwyzszykqtnaktpb`), read-only:

```sql
-- F1: paid bookings with no ledger entry / negative payout
select id, customer_total, vendor_amount, paid_at from bookings
where payment_status='paid' and coalesce(customer_total,0)>0
  and not exists (select 1 from journal_entries j
                  where j.source_id=bookings.id and j.source_type='ORDER_PAYMENT');

-- F2: paid + cancelled, never refunded
select id, customer_total, razorpay_payment_id, cancelled_at from bookings
where status='cancelled' and payment_status='paid' and razorpay_payment_id is not null;
select count(*) from bookings where payment_status='refunded';   -- 0

-- F3: leader election table
select * from job_locks;                                          -- 42P01

-- F5: definer functions granted to anon
select proname, proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef and array_to_string(proacl::text[],' ') like '%anon=%';

-- F9: migration ledger
select count(*) from supabase_migrations.schema_migrations;       -- 103 vs 180 files

-- F11: impossible states
select id, status, settlement_status from bookings
where status='cancelled' and settlement_status <> 'cancelled';

-- F16: stale support threads
select status, count(*), max(now()-last_message_at) from support_threads group by status;

-- F17: lead terminal states
select status, count(*) from leads group by status order by 2 desc;
```

---

_Audit performed by Claude Opus 5 against `main` @ `6043363`, 2026-09-02. No writes were made to any database during this audit._
