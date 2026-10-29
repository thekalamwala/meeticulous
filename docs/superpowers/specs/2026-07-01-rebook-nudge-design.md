# Rebook Nudge — Generic Follow-up Engine — Canonical Specification

_Date: 2026-07-01 · Q1 "Prove value" item #3 (post-session automation — rebook)_

> **Status: canonical design.** Single source of truth for the follow-up engine and the
> booking→rebook flow. Any change to a rule, offset, plan gate, or eligibility check is a
> change to behavior and must be made here first. The implementation follows this document.

## Problem

Q1 #3 (post-session automation) is mostly built — thank-you/complete emails, review CTA,
`/review/:bookingId`, auto-complete cron, plan-gated reminders all ship. The remaining gap is
the **automated rebook nudge**: a message sent some days after a completed session inviting the
guest to book the host again. Repeat bookings are the retention/GMV engine hosts forget to
chase; nothing currently prompts a return visit.

The founder requires this be **scalable, plan-aware, and multi-vertical** — usable by future
verticals (digital products, memberships), not hard-wired to the booking flow.

## Decision summary (locked with founder 2026-07-01)

- **Architecture:** a vertical-agnostic **follow-up engine** (`scheduled_followups` ledger +
  a leader-elected cron + a code flow-registry). The booking→rebook flow is its first and,
  for now, only registered flow. Build the generic seam; wire only booking-rebook (YAGNI on
  other verticals).
- **Cadence & availability:** **Studio-only for now.** Free = 0 nudges, Host+ = 0, Studio =
  2 nudges at **Day 3 + Day 21** after completion. The engine stays plan-aware via the
  existing `subscription_plans.limits.followup_flows` limit, so enabling other plans later is
  a DB/admin change with **no code change**.
- **Plan gate & recipient:** gate on the **host's** plan (`followup_flows` limit). The
  **guest** is the sole recipient; no host copy.
- **Eligibility:** respect email/WhatsApp opt-out; skip if the guest already rebooked; fire
  only for genuinely completed+paid bookings; gate the whole flow behind an admin kill-switch
  feature flag.
- **Channel:** email now, WhatsApp-ready (event carries `templateParams`; `whatsapp_enabled`
  stays off until the AiSensy template is approved — same posture as the WhatsApp go-live).

## Existing infrastructure reused (no reinvention)

- **`subscription_plans.limits.followup_flows`** — already seeded (Starter 0 / Host+ 1 /
  Studio 2 / Supreme −1) and read via `planService.getLimit(slug, 'followup_flows')`. Wired
  nowhere yet → this feature is its first consumer.
- **NotificationEngine** (`server/services/notificationEngine.js`) — event-based email +
  WhatsApp with DB channel gating; a new event slots in cleanly.
- **communicationEngine** suppression — `email_unsubscribes` (v3.7) and contacts
  `whatsapp_suppressed` are already enforced on marketing sends.
- **Leader-elected crons** (`runLocked` in `server.js`) — the firing cron mirrors
  `processReminders` (10-min lease).
- **Feature-flag kill-switch** (`server/services/featureFlags.js` +
  `server/config/featureRegistry.js`) — a new `rebook_nudge` flag joins the registry.
- **Completion triggers** — `bookingController.completeBooking` (bookingController.js:793,
  where `BOOKING_COMPLETED_CUSTOMER` fires) and the `autoCompleteBookings` cron.

## Data model

### Table `scheduled_followups` (new; deny-all RLS, service-role only)

Vertical-agnostic ledger. One row = one scheduled nudge (a single step of a flow for a single
source entity).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `source_type` | text | vertical key, e.g. `'booking'` |
| `source_id` | uuid | the entity id (booking id today) |
| `host_id` | uuid | plan-owning host; snapshotted for fire-time plan gate |
| `recipient_user_id` | uuid null | guest id when known (for opt-out / dedup) |
| `flow_key` | text | program key, e.g. `'rebook'` |
| `step` | int | 1-based step within the flow |
| `audience` | text | recipient role, e.g. `'customer'` |
| `event_key` | text | notification event to fire, e.g. `'REBOOK_NUDGE_CUSTOMER'` |
| `due_at` | timestamptz | when to fire (`completed_at + offsetDays`) |
| `status` | text | `pending` \| `sent` \| `skipped` \| `cancelled` \| `failed` |
| `skip_reason` | text null | why skipped/cancelled (audit) |
| `sent_at` | timestamptz null | |
| `attempts` | int default 0 | fire attempts (retry cap) |
| `payload` | jsonb | render snapshot (guest name/email/phone, service title, host username/deep-link) |
| `created_at` / `updated_at` | timestamptz | |

- **Unique index** `(source_type, source_id, flow_key, step)` → idempotent scheduling
  (`ON CONFLICT DO NOTHING`); a completion re-fire never double-schedules.
- **Partial index** on `(due_at)` `WHERE status = 'pending'` → cheap cron scan.
- `payload` is a snapshot so a later edit/delete of the source entity cannot break rendering;
  live eligibility (rebooked?, opt-out?, still entitled?) is re-queried at fire, not snapshotted.

### Plan limit change

`subscription_plans.limits.followup_flows`: **Host+ `1 → 0`** (Studio stays `2`, Free `0`,
Supreme `−1`). Applied via migration on both DBs + mirrored in `planService.FALLBACK_PLANS`.
Safe: `followup_flows` has no current consumer, so the change is a no-op until this ships.

### Flow registry (code, not DB)

`server/services/followups/flowRegistry.js` — maps `flow_key` → flow definition:

```
rebook (source_type 'booking'):
  steps:    [ { step: 1, offsetDays: 3 }, { step: 2, offsetDays: 21 } ]
  event:    'REBOOK_NUDGE_CUSTOMER'
  audience: 'customer'
  buildPayload(entity, host)  -> snapshot object
  isEligibleAtFire(row, ctx)  -> { ok, skipReason? }   (source-specific live checks)
```

Offsets/steps live in code (changing cadence is a deploy — acceptable). **Plan enablement is
DB** (`followup_flows` limit) — that is the "configurable without code" axis the founder
requires. New verticals register a new `flow_key` with its own `source_type`, payload builder,
and eligibility resolver; the cron dispatches through the registry with no cron edits.

## Entitlement rule

At schedule time, resolve the host's effective plan (`planService.resolveVendorPlan(host)`) →
`N = getLimit(slug, 'followup_flows')`.

- `N === -1` (unlimited) → schedule **all** defined steps.
- else → schedule the **first `N` steps** (lowest `step` numbers = earliest offsets).
- `N === 0` → schedule nothing.

For the rebook flow (2 steps): Studio `N=2` → steps 1 & 2 (Day 3 + Day 21); Host+ `N=0` →
none; Supreme `N=-1` → both. Enabling Host+ later = admin sets Host+ `followup_flows=1` → they
get step 1 (Day 3) automatically. Entitlement is **re-checked at fire** (see eligibility E2) so
a downgrade between completion and send is honored.

## User flows

**Guest (happy path):** books → attends → host (or auto-cron) completes the booking → engine
schedules Day-3 + Day-21 nudges (Studio host) → Day 3: guest gets "Loved your session with
{host}? Book again" email with a deep-link to `${CLIENT_URL}/{host.username}` → guest clicks →
lands on host page → rebooks. On rebook, the Day-21 nudge is cancelled.

**Guest (opt-out):** guest previously unsubscribed → nudge is skipped (`skip_reason`), no send.

**Host (Starter/Host+):** completes a booking → no nudge scheduled (not entitled). Upsell lever:
"Rebook nudges" is a Studio feature.

**Admin:** can flip the `rebook_nudge` kill-switch off → cron stops firing (pending rows pause,
resume when re-enabled). Can raise a plan's `followup_flows` limit to widen availability.

## API & event requirements

- **No new public API route.** Scheduling is server-internal (invoked from completion);
  firing is a cron. Admin toggles reuse the existing feature-flag admin surface.
- **New notification event** `REBOOK_NUDGE_CUSTOMER` in `notification_events`
  (`email_enabled = true`, `whatsapp_enabled = false` until AiSensy template approved),
  category treated as marketing/lifecycle (so opt-out applies).
- **New email template** for `REBOOK_NUDGE_CUSTOMER` (audience `all`) in
  `server/config/emailTemplates.js` + reseed via `seedEmailTemplates.js`. WhatsApp-ready:
  `templateParams` populated so enabling the channel needs no code.
- **New feature flag** `rebook_nudge` in `featureRegistry.js` (default on; kill-switch).

## Queue / cron architecture

- **Schedule (`followupService.scheduleFollowups`)** — called from `completeBooking` and
  `autoCompleteBookings` after `BOOKING_COMPLETED_CUSTOMER`. Best-effort (try/catch; never
  blocks completion). Checks the `rebook_nudge` flag; resolves entitlement; inserts the first
  `N` pending rows with `due_at = completed_at + offsetDays` and a snapshot `payload`.
  Idempotent via the unique tuple.
- **Fire (`processFollowups` cron)** — new leader-elected job in `server.js`
  (`runLocked('followups', …)`, 10-min lease; interval env-tunable, default 10 min). Selects
  `status='pending' AND due_at <= now()` (bounded batch). For each row, runs the eligibility
  gate (below); on pass sends via `NotificationEngine.send({ event: row.event_key, data })`
  built from `payload` + deep-link. Success → `sent`/`sent_at`; transient failure →
  `attempts++`, stay `pending` (retry next tick), `failed` after 3 attempts.
- **Leader election / multi-instance:** one firing per row guaranteed by `runLocked` + the
  `status` transition (`pending → sent`), same guarantee model as `processReminders`.

## Eligibility gate (at fire time)

Evaluated in order; first failure sets `status` + `skip_reason` and stops:

- **E1 — kill-switch:** `rebook_nudge` flag off → **leave `pending`** (pause, do not skip), so
  disabling is a pause, not a permanent drop.
- **E2 — entitlement re-check:** host's current `followup_flows` ≥ `step`? Downgraded →
  `skipped: not_entitled`.
- **E3 — source validity (booking):** booking still `status='completed'` ∧
  `payment_status='paid'`? Cancelled/refunded/reverted → `skipped: source_invalid`.
- **E4 — already rebooked:** a paid booking exists for the same host and same guest
  (`guest_id` when present, else `guest_email`/`guest_phone`) with `created_at >` the source
  booking's `completed_at`? → `skipped: already_rebooked`, **and cancel the sibling pending
  step** (`status='cancelled'`) for the same `(source_type, source_id, flow_key)`.
- **E5 — contactability & opt-out:** if no email **and** no phone → `skipped: no_contact`.
  Per channel: `email_unsubscribes` suppresses email; contacts `whatsapp_suppressed` suppresses
  WhatsApp. Both suppressed → `skipped: opted_out`. (The engine also enforces suppression on
  send; E5 is the explicit gate so the skip is recorded with a reason.)

## Success metrics

- **Funnel counters:** scheduled / sent / skipped-by-reason / failed (queryable from
  `scheduled_followups.status` + `skip_reason`).
- **Rebook conversion:** share of `sent` nudges followed by a paid booking to the same host
  within an attribution window (28 days) — the inverse of the E4 check; measurable from
  `scheduled_followups` joined to `bookings`.
- **Business North Star:** incremental repeat-booking rate for Studio hosts; later surfaced
  alongside the #7 GMV/activation dashboard (a "repeat rate" tile is a future add).

## Edge cases & handling

| Case | Handling |
|---|---|
| Both completion paths (`completeBooking`, `autoCompleteBookings`) | Both call `scheduleFollowups`; unique tuple makes a double-call a no-op. |
| Re-complete / idempotent completion | Existing completion guard + `ON CONFLICT DO NOTHING` → no duplicate rows. |
| Guest rebooks before Day 3 | Both steps skip at fire (`already_rebooked`); step 1 firing also cancels step 2. |
| Guest rebooks between Day 3 and Day 21 | Step 2 skipped `already_rebooked`. |
| Host downgrades Studio→lower after completion | E2 re-check → remaining steps `skipped: not_entitled`. |
| Booking cancelled/refunded after completion | E3 → `skipped: source_invalid`. |
| Guest has no email and no phone | E5 → `skipped: no_contact`. |
| Guest opted out of one channel only | Send on the remaining channel; skip only if both suppressed. |
| Kill-switch off when a row is due | Row stays `pending`; fires when re-enabled (may be late by design). |
| Transient send failure | `attempts++`, retry next tick; `failed` after 3. |
| Multiple server instances | `runLocked` leader election + `pending→sent` transition = single send. |
| `due_at` timezone | Absolute UTC (`completed_at + N days`); no send-hour windowing (a "come back" email is not time-of-day sensitive — YAGNI). |
| Source entity edited/deleted after scheduling | Render from `payload` snapshot; E3 still validates booking existence/state. |

## Out of scope (YAGNI)

- Other verticals' flows (registry seam exists; only booking-rebook registered).
- WhatsApp live send (event + params ready; `whatsapp_enabled` off until template approved).
- Send-hour / timezone windowing of nudges.
- A DB-editable flow-definition UI (offsets live in the code registry; plan **enablement** is
  DB via `followup_flows`).
- A dedicated conversion dashboard tile (metric is queryable; tile ships later with #7).
- Retro-scheduling nudges for bookings completed before this feature launches (forward-only).

## Files touched (indicative; pinned in the plan)

- New: `server/migrations/vX_scheduled_followups.sql` (table + indexes + RLS).
- New: `server/migrations/vY_followup_flows_studio_only.sql` (Host+ `followup_flows` 1→0).
- New: `server/services/followups/flowRegistry.js`, `server/services/followups/followupService.js`
  (schedule + fire helpers).
- Modify: `server/controllers/bookingController.js` (`completeBooking`, `autoCompleteBookings`,
  `processFollowups` export or a dedicated module), `server/server.js` (cron registration),
  `server/services/planService.js` (`FALLBACK_PLANS` Host+ followup_flows 0).
- Modify: `server/config/emailTemplates.js` + `scripts/seedEmailTemplates.js`,
  `server/config/featureRegistry.js`, `notification_events` seed.
- Tests: unit tests for entitlement, scheduling idempotency, the eligibility gate (E1–E5),
  cron firing, retry/cancel behavior.

## Deploy notes

- Apply both migrations to prod (Mumbai) + staging (Tokyo); reseed email templates +
  notification events on both.
- Keep a code-side schema fallback (SELECT/INSERT destructure) for `scheduled_followups` until
  the migration is confirmed applied on both DBs (project migration workflow).
- `whatsapp_enabled` stays false until the AiSensy `REBOOK_NUDGE_CUSTOMER` template is approved.
