# P0 Spec — Sales + Marketing OS: wire the dormant CRM

**Status:** spec for review. No feature code in this PR.
**Source:** audit 2026-08-23 (verified vs code on `main` + live prod DB).
**Goal:** make leads real-time, add one deterministic lifecycle engine, and turn on sends behind a frequency cap. Everything downstream (sequences, templates, webhooks, timeline, 20 crons) already exists.

## Why P0 (live prod facts)
- 203 leads, **197 (97%) frozen in `new`** — nothing advances them.
- **1** CRM message ever sent — send engine dark (`crm_admin_sends` OFF).
- Every lead came from the manual `backfillLeads.js` — signup/booking do **not** create leads live.
- `leadScore()` runs only in the browser for a badge — never persisted or queried.

## Stacked PRs (order = dependency order)

```
PR-1  Real-time lead creation        (independent)
PR-2  Frequency cap + quiet hours    (independent; MUST land before PR-5)
PR-3  leads.score/intent/next_action migration + persistence  (needs nothing; PR-4 needs it)
PR-4  crm-lifecycle-engine cron       (needs PR-3 columns; benefits from PR-1 data)
PR-5  Flip crm_admin_sends ON         (needs PR-2 live; config/flag only)
```

Each PR is small, isolated, independently revertable. PR-1..PR-4 are safe with sends OFF (they record, don't send). PR-5 is the single switch that activates the whole chain.

---

## PR-1 — Real-time lead creation

**Problem:** `authController.js:617` (signup), booking confirmation, and the enterprise form never write `leads`. Only `scripts/backfillLeads.js` (manual) does.

**Fix:** call the existing, idempotent `leadService.upsertLead(patch, { source, createdBy })` (`leadService.js:30`) from three live points. `upsertLead` matches on normalized phone→email, merges without clobbering, and never regresses `status/source/owner` on re-sync (`leadService.js:47`) — safe to call on every event.

**Hook points:**
| Event | File | Call |
|---|---|---|
| Host/guest signup | `server/controllers/authController.js` (after `user_registered` track, ~`:617`) | `upsertLead({ name, phone, email, profile_id: user.id }, { source: is_host ? 'host_signup' : 'guest_booking', createdBy: 'signup' })` |
| Booking paid | `server/services/bookingConfirmation.js` (in the exactly-once capture path, near `hostActivation` call ~`:133`) | `upsertLead({ name, phone, email }, { source: 'guest_booking', createdBy: 'booking' })` for the guest |
| Enterprise form | `server/controllers/enterpriseLeadController.js` (after `enterprise_leads` insert ~`:59`) | `upsertLead({ name, email, business_name, ... }, { source: 'enterprise_page', createdBy: 'enterprise_form' })` |

**Rules / guardrails:**
- **Non-blocking + fail-soft.** Wrap each call in try/catch that only logs — a CRM write must never break signup, payment, or a form submit. Pattern: `upsertLead(...).catch(err => logger.warn('lead upsert failed', err))`, fire-and-forget after the primary response path.
- **No new schema.** Reuses existing columns + `upsertLead`.
- `profile_id` set on signup enables the hourly `crm-attribution` cron to enrich revenue immediately.

**Acceptance criteria:**
- New host signup → a `leads` row exists within the request (source `host_signup`, `profile_id` set) — verify by signing up a throwaway host and querying `leads`.
- New paid booking by a first-time guest → a `leads` row (source `guest_booking`).
- Enterprise form submit → a `leads` row (source `enterprise_page`) in addition to the existing `enterprise_leads` row.
- Re-running any event does **not** duplicate or regress the lead (idempotent).
- Forcing `upsertLead` to throw does **not** fail signup/booking/form (fail-soft proven).
- `server/tests`: unit test asserting each hook calls `upsertLead` with the right source and swallows errors.

**Risk:** touches auth + payment controllers (SAFETY files per CLAUDE.md). Mitigated by fire-and-forget + try/catch — zero effect on the primary flow. No response-shape change.

---

## PR-2 — Frequency cap + quiet hours in the send gate

**Problem:** `sendGate.canSend` (`sendGate.js:31`) checks consent + validity only. **No recency, no frequency cap, no quiet hours.** Turning sends on today risks a lead getting sequence + campaign + ad-hoc messages back-to-back.

**Fix:** add two checks to `canSend`, gated to *automated* sends (sequences/campaigns), exempting human ad-hoc composer sends.

**Signature change:** `canSend(lead, channel, opts = {})` where `opts.automated = false` by default. Callers:
- `sequenceService` + `campaignWorker` paths → pass `automated: true`.
- Composer single-send (`adminCrmController.sendWhatsApp/sendEmail`) → default `false` (human judgment, exempt).

**New checks (only when `automated`):**
```js
// Quiet hours — Asia/Kolkata 09:00–20:00. Outside → defer, not skip.
const istHour = new Date(now).toLocaleString('en-US',{ timeZone:'Asia/Kolkata', hour:'2-digit', hour12:false });
if (Number(istHour) < 9 || Number(istHour) >= 20) return { ok:false, reason:'quiet_hours', defer:true };

// Frequency cap — max 1 automated marketing msg / lead / rolling 48h, any channel.
const since = new Date(Date.now() - 48*3600*1000).toISOString();
const { count } = await supabaseAdmin.from('crm_messages')
  .select('id', { count:'exact', head:true })
  .eq('lead_id', lead.id).eq('status','sent').gte('sent_at', since);
if (count > 0) return { ok:false, reason:'frequency_capped', defer:true };
```
- `defer:true` → the queue worker should **re-queue** (bump `next_attempt_at`), not mark `skipped`, so quiet-hours/cap messages send later, not never. `messageService.dispatch` handles `result.skipped` today (`messageService.js:123`); add a `result.defer` branch that sets status back to `queued` with `next_attempt_at = now + 1h` (quiet hours) / `+ 48h` (cap), without incrementing attempts.
- **Fail-open** on the count query (matches existing `isSuppressed`/`isEmailUnsubscribed` style) — an outage must not silently block all sends.

**Config:** cap window (48h) + quiet-hours bounds as constants at top of `sendGate.js` (`// ponytail: constants, move to feature_flags only if per-tenant tuning ever needed`).

**Acceptance criteria:**
- Two automated sends to the same lead within 48h → second returns `{ ok:false, reason:'frequency_capped', defer:true }` and the message re-queues (not skipped).
- Automated send at 21:00 IST → `quiet_hours`, deferred to next morning.
- Human composer send is **never** capped or quiet-houred (regression guard).
- Count-query failure → send proceeds (fail-open).
- Unit tests for cap, quiet hours, human-exempt, fail-open.

**Risk:** low; additive to an off system. Must land before PR-5.

---

## PR-3 — Persist score / intent / next action (migration + writeback)

**Problem:** score is client-only (`salesConstants.js:42`); can't sort, query, or trigger server-side.

**Migration `v3.112_lead_scoring.sql`** (additive, both DBs, RLS unchanged):
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'low'
  CHECK (intent IN ('low','medium','high','activated'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_leads_intent ON leads (intent) WHERE status NOT IN ('lost','do_not_contact','paid');
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads (score DESC);
```

**Port the score formula to the server** — move `leadScore()` logic into `server/services/crm/leadScore.js` (single source of truth). The client keeps rendering, but reads `leads.score` when present and falls back to local compute (schema-fallback pattern, per existing `og_status` precedent). Deterministic, no AI — exact weights from `salesConstants.js:44-55`.

**Acceptance criteria:**
- Migration applies clean on staging then prod (both DBs), verified by column introspection.
- `leadScore.compute(lead)` returns identical numbers to the client formula for a fixed fixture set (parity test).
- Existing lead reads still work with columns defaulted (0/'low').

**Risk:** additive migration only; no behaviour change until PR-4 writes the columns.

---

## PR-4 — `crm-lifecycle-engine` cron (the one engine)

**Approach (confirmed):** one new leader-elected `setInterval` in `server.js`, matching the existing 20-job pattern (`runLocked('crm-lifecycle-engine', ...)`), 15-min cadence. Reuses `sequenceService`, `messageService`, `followUpService` — no new send code.

**New file `server/services/crm/lifecycleEngine.js`**, `run()`:
1. Load active leads (status NOT in `lost/do_not_contact/paid`), left-joined to linked `profiles`/`bookings` via `profile_id`.
2. For each: `score = leadScore.compute(lead)`; write `leads.score`; derive `intent`.
3. **Deterministic status progression + next action** (from audit §16):
```
score>=70 → intent=high ; >=40 → medium ; else low
status in (activated,paid) OR converted_at → intent=activated

inbound reply activity newer than last_contacted_at   → status=replied
outbound sent AND status=new                          → status=contacted
intent=high AND status in (new,contacted,replied)     → status=qualified + create sales task (followUpService.create, owner default)
linked profile.onboarding_completed AND bookings=0    → status=activated (lifecycle handoff)

next_action:
  status=new & no send yet          → enroll "New Lead nurture" (sequenceService.enroll)
  status=contacted & no reply 3d     → (sequence advances itself; engine just ensures enrollment)
  status=replied OR intent=high      → next_action="Human contact"
  signup, profile incomplete N days  → enroll "Signed-up-not-activated"
  service created, 0 bookings        → enroll "Activated-no-booking"
  inactive >30d, not converted       → enroll "Win-back"
```
4. All enroll/task calls idempotent (sequenceService dedups per (sequence,lead); followUpService only creates if no open task of that kind).

**Guardrails:**
- Engine runs **regardless of send switch** — it only sets columns + enrolls. Actual sends stay gated by `crm_admin_sends` (PR-5). So this is safe to ship with sends OFF; it just populates state and queues.
- Batch + limit per tick (e.g. 500 leads) to bound runtime; order by `updated_at` asc so all leads cycle.
- Wrap per-lead in try/catch — one bad lead can't halt the batch.
- The named sequences ("New Lead nurture" etc.) must exist as `crm_sequences` rows first — seed them in this PR (`seedLifecycleSequences.js`, run both DBs) OR no-op enroll if the sequence is absent (fail-soft).

**Acceptance criteria:**
- After one tick over prod-like data: `leads.score`/`intent` populated for all active leads; a high-intent lead gets a `qualified` status + a sales task; a `new` lead with no sends gets enrolled in "New Lead nurture" (enrollment row exists, still unsent while switch OFF).
- Idempotent: second tick creates no duplicate tasks/enrollments/status thrash.
- A lead that replied shows `status=replied` and `next_action='Human contact'`.
- Engine cannot send anything while `crm_admin_sends` is OFF (verify 0 new `sent` `crm_messages`).
- Unit tests for each IF→THEN transition with fixtures.

**Risk:** medium (writes status across many leads). Mitigated: reversible column writes, idempotent, no sends, batch-bounded, behind the still-OFF switch. Recommend a dry-run mode (`LIFECYCLE_ENGINE_DRYRUN=true` → compute + log, no writes) for the first deploy.

---

## PR-5 — Flip `crm_admin_sends` ON

**What:** enable the master send flag (`featureRegistry.js:81`, fail-closed default OFF) via the admin feature-flag UI / DB — **config, not code** (may be zero-diff; if done via UI, this "PR" is a runbook step + doc note).

**Preconditions (all must be true):**
- PR-2 live (frequency cap + quiet hours active).
- PR-4 lifecycle engine has run ≥1 full cycle in dry-run and looks sane.
- Lifecycle sequences seeded on both DBs.
- AiSensy key active (verified: `notification_providers` provider `aisensy`, is_active true).

**Rollout:** enable, then watch the first 24h — `crm_messages` status distribution, `crm-send-worker` logs, any `frequency_capped`/`quiet_hours` defers behaving as expected. Kill-switch back OFF instantly reverts (fail-closed) if anything misbehaves.

**Acceptance criteria:**
- With switch ON, the enrolled "New Lead nurture" step-0 messages dispatch on the next `crm-send-worker` tick, capped to 1/48h/lead, within quiet hours.
- Toggling OFF immediately halts all automated sends (recorded, not sent).

---

## Cross-cutting notes
- **Migrations:** PR-3 (`v3.112`) is the only schema change. Run staging (Tokyo) → prod (Mumbai), keep code-side schema fallback until confirmed both DBs (project convention).
- **Transactional untouched:** none of this touches `notificationEngine` (booking confirmations, OTP, reminders). Marketing/CRM and transactional stay separate pipelines.
- **Testing:** `cd server && npm test` green; `cd client && npx vitest run` green before each client-touching PR (PR-3 touches client score fallback).
- **Not in P0 (deferred to P1/P2):** Sales Desk UI, sequence-builder UI, leads↔contacts sync, intent-event sink, campaign engagement writeback, enterprise_leads merge.

## Definition of done for P0
A host who signs up today becomes a scored, staged CRM lead automatically, gets enrolled in the right nurture sequence, and — once the switch is on — receives coordinated, frequency-capped messages, while any reply or high-intent signal auto-creates a sales task for the human. Zero manual scripts, zero manual status dragging for the common path.
