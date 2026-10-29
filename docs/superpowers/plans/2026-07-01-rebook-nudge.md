# Rebook Nudge — Generic Follow-up Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a vertical-agnostic follow-up engine that sends Studio hosts' guests a plan-gated rebook nudge (Day 3 + Day 21) after a completed booking.

**Architecture:** A `scheduled_followups` ledger + a pure flow-registry + a `followupService` with two entry points — `scheduleFollowups` (called from the shared `markBookingCompleted`) and `processFollowups` (a leader-elected cron). Entitlement comes from the existing `subscription_plans.limits.followup_flows`; email suppression from the existing `communicationEngine`. Booking→rebook is the only registered flow; new verticals register a flow with no cron change.

**Tech Stack:** Node.js/Express, Supabase (`supabaseAdmin`), Jest, existing `NotificationEngine` / `planService` / `featureFlags` / `communicationEngine` / `runLocked`.

**Spec:** `docs/superpowers/specs/2026-07-01-rebook-nudge-design.md` (canonical definitions, entitlement rule, eligibility gate E1–E5, edge-case table). Read it before Task 1.

## Global Constraints

- Studio-only now: `followup_flows` — Starter 0, **Host+/`creator` 0** (change from 1), Studio/`professional` 2, Supreme −1. DB slug map: Host+ = `creator`, Studio = `professional`.
- Cadence: rebook flow steps = `[{step:1, offsetDays:3}, {step:2, offsetDays:21}]`.
- Entitlement: `N = getLimit(planSlug,'followup_flows')`; entitled steps = all if `N===-1` else first `N` steps (by ascending `step`).
- Plan gate on the **host**; **guest** is sole recipient; no host copy.
- Only `payment_status='paid'` + `status='completed'` bookings nudge; `refunded`/`cancelled`/`no_show`/`unpaid` never do.
- Kill-switch feature flag `rebook_nudge` (default on): when OFF the fire cron leaves rows `pending` (pause, not skip).
- Email now; `REBOOK_NUDGE_CUSTOMER` `whatsapp_enabled=FALSE` until AiSensy template approved. Register the event in `communicationEngine` `MARKETING_EVENTS` so email unsubscribe is honored.
- `scheduled_followups` writes/reads must fail-open on missing table (schema-fallback) until v3.58 is applied on both DBs.
- Never hardcode plan limits (read from `planService`); never block booking completion on a follow-up error (best-effort).
- Migrations are applied MANUALLY in the Supabase SQL editor on BOTH DBs (prod Mumbai + staging Tokyo) — the plan produces the files; it does not run them.

---

### Task 1: Migrations + plan-limit change

**Files:**
- Create: `server/migrations/v3.58_scheduled_followups.sql`
- Create: `server/migrations/v3.59_rebook_nudge_config.sql`
- Modify: `server/services/planService.js` (FALLBACK_PLANS `creator.limits.followup_flows` 1→0)
- Test: `server/tests/unit/planService.test.js` (create if absent; else append)

**Interfaces:**
- Consumes: nothing.
- Produces: after this task, `planService.getLimit('creator','followup_flows')===0`, `getLimit('professional','followup_flows')===2`. The two migration files (applied manually later).

- [ ] **Step 1: Write the failing test**

Append to (or create) `server/tests/unit/planService.test.js`:

```javascript
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(() => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'relation "subscription_plans" does not exist' } }) }) })) } }));
const planService = require('../../services/planService');

test('followup_flows fallback: creator 0, professional 2, starter 0', async () => {
  expect(await planService.getLimit('creator', 'followup_flows')).toBe(0);
  expect(await planService.getLimit('professional', 'followup_flows')).toBe(2);
  expect(await planService.getLimit('starter', 'followup_flows')).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/planService.test.js -t "followup_flows fallback" --verbose`
Expected: FAIL — `creator` returns `1`, not `0`.

- [ ] **Step 3: Change the fallback + write the migrations**

In `server/services/planService.js`, in `FALLBACK_PLANS.creator.limits`, change `followup_flows: 1` to `followup_flows: 0` (leave `professional` at `2`, `starter` at `0`).

Create `server/migrations/v3.58_scheduled_followups.sql`:

```sql
-- v3.58 — Generic follow-up engine ledger (Rebook Nudge #3).
-- One row = one scheduled nudge (a single step of a flow for one source entity).
-- Vertical-agnostic: source_type/source_id keep it decoupled from bookings.
create table if not exists public.scheduled_followups (
  id                 uuid primary key default gen_random_uuid(),
  source_type        text        not null,
  source_id          uuid        not null,
  host_id            uuid        not null,
  recipient_user_id  uuid,
  flow_key           text        not null,
  step               integer     not null,
  audience           text        not null default 'customer',
  event_key          text        not null,
  due_at             timestamptz not null,
  status             text        not null default 'pending'
                       check (status in ('pending','sent','skipped','cancelled','failed')),
  skip_reason        text,
  sent_at            timestamptz,
  attempts           integer     not null default 0,
  payload            jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists scheduled_followups_dedup_idx
  on public.scheduled_followups (source_type, source_id, flow_key, step);

create index if not exists scheduled_followups_due_pending_idx
  on public.scheduled_followups (due_at)
  where status = 'pending';

alter table public.scheduled_followups enable row level security;
-- Deny-all: service-role (supabaseAdmin) bypasses RLS; no anon/auth policy added.
```

Create `server/migrations/v3.59_rebook_nudge_config.sql`:

```sql
-- v3.59 — Rebook Nudge config: Studio-only entitlement + notification event.
-- Host+ (creator) followup_flows 1 -> 0 so only Studio (professional, =2) is
-- entitled for now. Enabling other plans later = bump this number (no code).
update public.subscription_plans
   set limits = jsonb_set(limits, '{followup_flows}', '0'::jsonb)
 where slug = 'creator';

-- New notification event (email on, whatsapp off until AiSensy template approved).
insert into public.notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
values
  ('REBOOK_NUDGE_CUSTOMER', 'Rebook Nudge — Customer', false, true, '',
   'Ready for another session with {{vendor_name}}?')
on conflict (event_key) do nothing;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/planService.test.js -t "followup_flows fallback" --verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/planService.js server/migrations/v3.58_scheduled_followups.sql server/migrations/v3.59_rebook_nudge_config.sql server/tests/unit/planService.test.js
git commit -m "feat(followups): scheduled_followups migration + Studio-only followup_flows"
```

---

### Task 2: Flow registry

**Files:**
- Create: `server/services/followups/flowRegistry.js`
- Test: `server/tests/unit/followupFlowRegistry.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `FLOWS` — object keyed by `flow_key`; each: `{ flow_key, source_type, audience, event, steps:[{step,offsetDays}], buildPayload(entity)->object }`.
  - `getFlow(flowKey) -> flow | null`
  - `entitledSteps(flow, limitN) -> step objects` — all if `limitN<0`, else first `limitN` by ascending `step`, `[]` if `limitN<=0`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/followupFlowRegistry.test.js`:

```javascript
const { FLOWS, getFlow, entitledSteps } = require('../../services/followups/flowRegistry');

test('rebook flow shape', () => {
  const f = getFlow('rebook');
  expect(f.source_type).toBe('booking');
  expect(f.event).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(f.audience).toBe('customer');
  expect(f.steps).toEqual([{ step: 1, offsetDays: 3 }, { step: 2, offsetDays: 21 }]);
});

test('getFlow unknown -> null', () => expect(getFlow('nope')).toBeNull());

test('entitledSteps: -1 all, 2 both, 1 first, 0 none', () => {
  const f = getFlow('rebook');
  expect(entitledSteps(f, -1)).toHaveLength(2);
  expect(entitledSteps(f, 2)).toHaveLength(2);
  expect(entitledSteps(f, 1)).toEqual([{ step: 1, offsetDays: 3 }]);
  expect(entitledSteps(f, 0)).toEqual([]);
});

test('buildPayload snapshots guest/service/host from a booking entity', () => {
  const b = {
    guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91999', guest_id: 'g1',
    host_id: 'h1', services: { title: 'Tarot' }, profiles: { name: 'Mystic', username: 'mystic' },
  };
  expect(getFlow('rebook').buildPayload(b)).toEqual({
    guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91999', guest_id: 'g1',
    service_title: 'Tarot', host_name: 'Mystic', host_username: 'mystic', host_id: 'h1',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/followupFlowRegistry.test.js --verbose`
Expected: FAIL — `Cannot find module '.../flowRegistry'`.

- [ ] **Step 3: Write the registry**

Create `server/services/followups/flowRegistry.js`:

```javascript
/**
 * flowRegistry.js — declarative follow-up flow definitions.
 *
 * Vertical-agnostic: a flow names its source_type, notification event, audience,
 * the ordered steps (offset in days from the source "completed" moment), and a
 * pure payload snapshot builder. followupService reads this registry to schedule
 * and fire. A new vertical adds a flow here — no scheduler/cron changes.
 */
const FLOWS = {
  rebook: {
    flow_key: 'rebook',
    source_type: 'booking',
    audience: 'customer',
    event: 'REBOOK_NUDGE_CUSTOMER',
    steps: [{ step: 1, offsetDays: 3 }, { step: 2, offsetDays: 21 }],
    // Snapshot only what the email/WhatsApp render needs — survives later edits
    // to the source booking/host/service.
    buildPayload: (b) => ({
      guest_name: b.guest_name,
      guest_email: b.guest_email,
      guest_phone: b.guest_phone,
      guest_id: b.guest_id,
      service_title: b.services?.title,
      host_name: b.profiles?.name,
      host_username: b.profiles?.username,
      host_id: b.host_id,
    }),
  },
};

const getFlow = (flowKey) => FLOWS[flowKey] || null;

// Entitled steps for a plan limit N. -1 = unlimited (all). Otherwise the first N
// steps by ascending step number. N<=0 = none.
const entitledSteps = (flow, limitN) => {
  const ordered = [...flow.steps].sort((a, b) => a.step - b.step);
  if (limitN < 0) return ordered;
  return ordered.slice(0, Math.max(0, limitN));
};

module.exports = { FLOWS, getFlow, entitledSteps };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/followupFlowRegistry.test.js --verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/followups/flowRegistry.js server/tests/unit/followupFlowRegistry.test.js
git commit -m "feat(followups): pure flow registry (rebook flow + entitledSteps)"
```

---

### Task 3: `scheduleFollowups`

**Files:**
- Create: `server/services/followups/followupService.js` (this task adds `scheduleFollowups`; Task 4 adds `processFollowups` to the same file)
- Test: `server/tests/unit/followupSchedule.test.js`

**Interfaces:**
- Consumes: `flowRegistry` (Task 2); `planService.resolveVendorPlan`, `planService.getLimit`; `featureFlags.isFeatureEnabled`; `supabaseAdmin`.
- Produces: `scheduleFollowups({ sourceType, sourceId, hostId, entity, completedAt, flowKey='rebook' }) -> Promise<{scheduled:number, reason?:string}>`. Best-effort; never throws.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/followupSchedule.test.js`:

```javascript
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/planService', () => ({
  resolveVendorPlan: jest.fn(() => 'professional'),
  getLimit: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const planService = require('../../services/planService');
const { scheduleFollowups } = require('../../services/followups/followupService');

// profiles fetch → { plan, plan_expires_at }; then upsert capture.
const profilesQuery = (row) => ({
  select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
});
const captureUpsert = (sink) => ({
  upsert: (rows, opts) => { sink.rows = rows; sink.opts = opts; return Promise.resolve({ error: null }); },
});

const booking = {
  id: 'b1', host_id: 'h1', guest_id: 'g1', guest_name: 'Ada',
  guest_email: 'ada@x.com', guest_phone: '+91', services: { title: 'Tarot' },
  profiles: { name: 'Mystic', username: 'mystic' },
};
const completedAt = '2026-07-01T00:00:00.000Z';

beforeEach(() => jest.clearAllMocks());

test('Studio host (followup_flows 2) schedules both steps with correct due dates', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(2);
  const sink = {};
  supabaseAdmin.from
    .mockReturnValueOnce(profilesQuery({ plan: 'professional', plan_expires_at: null }))
    .mockReturnValueOnce(captureUpsert(sink));

  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(2);
  expect(sink.rows.map((x) => x.step)).toEqual([1, 2]);
  expect(sink.rows[0].due_at).toBe('2026-07-04T00:00:00.000Z');  // +3d
  expect(sink.rows[1].due_at).toBe('2026-07-22T00:00:00.000Z');  // +21d
  expect(sink.rows[0].event_key).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(sink.rows[0].payload.host_username).toBe('mystic');
  expect(sink.opts).toEqual({ onConflict: 'source_type,source_id,flow_key,step', ignoreDuplicates: true });
});

test('Host+ (followup_flows 0) schedules nothing', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(0);
  supabaseAdmin.from.mockReturnValueOnce(profilesQuery({ plan: 'creator', plan_expires_at: null }));
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
});

test('kill-switch off schedules nothing', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('never throws on DB error (best-effort)', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  planService.getLimit.mockResolvedValue(2);
  supabaseAdmin.from
    .mockReturnValueOnce(profilesQuery({ plan: 'professional', plan_expires_at: null }))
    .mockReturnValueOnce({ upsert: () => Promise.resolve({ error: { message: 'relation "scheduled_followups" does not exist' } }) });
  const r = await scheduleFollowups({ sourceType: 'booking', sourceId: 'b1', hostId: 'h1', entity: booking, completedAt });
  expect(r.scheduled).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/followupSchedule.test.js --verbose`
Expected: FAIL — `Cannot find module '.../followupService'`.

- [ ] **Step 3: Write `scheduleFollowups`**

Create `server/services/followups/followupService.js`:

```javascript
/**
 * followupService.js — schedule + fire generic post-event follow-ups.
 *
 * scheduleFollowups: called from the shared markBookingCompleted (both the manual
 * and the auto-complete paths). Best-effort — never throws, never blocks completion.
 * processFollowups (Task 4): the leader-elected cron that fires due rows.
 */
const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../featureFlags');
const planService = require('../planService');
const { getFlow, entitledSteps } = require('./flowRegistry');

const DAY = 24 * 60 * 60 * 1000;

const scheduleFollowups = async ({ sourceType, sourceId, hostId, entity, completedAt, flowKey = 'rebook' }) => {
  try {
    if (!(await featureFlags.isFeatureEnabled('rebook_nudge'))) return { scheduled: 0, reason: 'flag_off' };
    const flow = getFlow(flowKey);
    if (!flow) return { scheduled: 0, reason: 'no_flow' };

    // Host plan → entitlement. The completion join doesn't carry plan columns,
    // so fetch them here (keeps this service self-contained / vertical-agnostic).
    const { data: hostRow } = await supabaseAdmin
      .from('profiles').select('plan, plan_expires_at').eq('id', hostId).maybeSingle();
    const slug = planService.resolveVendorPlan(hostRow || {});
    const n = await planService.getLimit(slug, 'followup_flows');
    const steps = entitledSteps(flow, n);
    if (!steps.length) return { scheduled: 0, reason: 'not_entitled' };

    const base = new Date(completedAt).getTime();
    const payload = flow.buildPayload(entity);
    const rows = steps.map((s) => ({
      source_type: sourceType,
      source_id: sourceId,
      host_id: hostId,
      recipient_user_id: entity.guest_id || null,
      flow_key: flow.flow_key,
      step: s.step,
      audience: flow.audience,
      event_key: flow.event,
      due_at: new Date(base + s.offsetDays * DAY).toISOString(),
      status: 'pending',
      payload,
    }));

    const { error } = await supabaseAdmin
      .from('scheduled_followups')
      .upsert(rows, { onConflict: 'source_type,source_id,flow_key,step', ignoreDuplicates: true });
    if (error) { console.error('scheduleFollowups upsert error:', error.message); return { scheduled: 0, reason: 'db_error' }; }
    return { scheduled: rows.length };
  } catch (e) {
    console.error('scheduleFollowups error:', e.message);
    return { scheduled: 0, reason: 'error' };
  }
};

module.exports = { scheduleFollowups };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/followupSchedule.test.js --verbose`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add server/services/followups/followupService.js server/tests/unit/followupSchedule.test.js
git commit -m "feat(followups): scheduleFollowups (plan-gated, idempotent, best-effort)"
```

---

### Task 4: `processFollowups` + eligibility gate

**Files:**
- Modify: `server/services/followups/followupService.js` (add `processFollowups` + helpers; extend exports)
- Test: `server/tests/unit/followupProcess.test.js`

**Interfaces:**
- Consumes: `supabaseAdmin`; `featureFlags.isFeatureEnabled`; `planService`; `NotificationEngine.send` (`../notificationEngine`); `communicationEngine.isUnsubscribed` (`../email/communicationEngine`); `flowRegistry`.
- Produces: `processFollowups() -> Promise<{ sent, skipped, failed }>`. Exports extended to `{ scheduleFollowups, processFollowups }`.

**Eligibility order (spec E1–E5):** E1 flag-off → return early, rows stay pending. Per row: E2 entitlement re-check → `skipped:not_entitled`; E3 booking `completed`+`paid` → else `skipped:source_invalid`; E4 already-rebooked → `skipped:already_rebooked` + cancel sibling; E5 no email&phone → `skipped:no_contact`, else email opted-out (and no other channel) → `skipped:opted_out`. Then send.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/followupProcess.test.js`:

```javascript
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: jest.fn(() => 'professional'), getLimit: jest.fn(async () => 2) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(async () => ({ whatsapp: {}, email: { success: true } })) }));
jest.mock('../../services/email/communicationEngine', () => ({ isUnsubscribed: jest.fn(async () => false) }));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const planService = require('../../services/planService');
const NotificationEngine = require('../../services/notificationEngine');
const commEngine = require('../../services/email/communicationEngine');
const { processFollowups } = require('../../services/followups/followupService');

// Chainable query builder recording the last update() payload into `sink`.
const q = (result, sink) => {
  const b = {
    select: () => b, eq: () => b, lte: () => b, neq: () => b, limit: () => b, order: () => b,
    maybeSingle: () => Promise.resolve(result), single: () => Promise.resolve(result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    update: (vals) => { if (sink) sink.push(vals); return b; },
  };
  return b;
};

const pendingRow = (over = {}) => ({
  id: 'sf1', source_type: 'booking', source_id: 'b1', host_id: 'h1', step: 1,
  flow_key: 'rebook', event_key: 'REBOOK_NUDGE_CUSTOMER', attempts: 0,
  payload: { guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91', guest_id: 'g1', service_title: 'Tarot', host_name: 'Mystic', host_username: 'mystic', host_id: 'h1' },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

test('flag off: does not fire, leaves rows pending', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await processFollowups();
  expect(r).toEqual({ sent: 0, skipped: 0, failed: 0 });
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('happy path: eligible row sends and is marked sent', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))                                   // select pending
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))  // host plan (E2)
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null })) // booking (E3)
    .mockReturnValueOnce(q({ data: [], error: null }))                                                // rebooked? (E4) none
    .mockReturnValueOnce(q({ data: null, error: null }, updates));                                    // update -> sent
  const r = await processFollowups();
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  expect(NotificationEngine.send.mock.calls[0][0].event).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(NotificationEngine.send.mock.calls[0][0].data.emailData.profile_url).toContain('/mystic');
  expect(r.sent).toBe(1);
  expect(updates[0].status).toBe('sent');
});

test('already rebooked: skips and cancels the sibling step', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))                                   // pending
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))  // plan
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null })) // booking
    .mockReturnValueOnce(q({ data: [{ id: 'b2' }], error: null }))                                    // rebooked? YES
    .mockReturnValueOnce(q({ data: null, error: null }, updates))                                     // update -> skipped
    .mockReturnValueOnce(q({ data: null, error: null }, updates));                                    // cancel siblings
  const r = await processFollowups();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(r.skipped).toBe(1);
  expect(updates.some((u) => u.status === 'skipped' && u.skip_reason === 'already_rebooked')).toBe(true);
  expect(updates.some((u) => u.status === 'cancelled')).toBe(true);
});

test('source invalid (cancelled/refunded): skips', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: { status: 'cancelled', payment_status: 'refunded', completed_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: null, error: null }, updates));
  const r = await processFollowups();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(updates[0].skip_reason).toBe('source_invalid');
});

test('send failure: increments attempts, stays pending', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  NotificationEngine.send.mockRejectedValueOnce(new Error('smtp down'));
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow({ attempts: 0 })], error: null }))
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null }))
    .mockReturnValueOnce(q({ data: [], error: null }))
    .mockReturnValueOnce(q({ data: null, error: null }, updates));
  const r = await processFollowups();
  expect(r.failed).toBe(1);
  expect(updates[0]).toMatchObject({ attempts: 1, status: 'pending' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/followupProcess.test.js --verbose`
Expected: FAIL — `processFollowups is not a function`.

- [ ] **Step 3: Add `processFollowups` + helpers**

In `server/services/followups/followupService.js`, add these requires at the top (after the existing ones):

```javascript
const NotificationEngine = require('../notificationEngine');
const commEngine = require('../email/communicationEngine');
```

Add before `module.exports`:

```javascript
const PROCESS_BATCH = 200;
const MAX_ATTEMPTS = 3;
const CLIENT_URL = process.env.CLIENT_URL || 'https://meeticulous.in';

const setStatus = (id, vals) =>
  supabaseAdmin.from('scheduled_followups')
    .update({ ...vals, updated_at: new Date().toISOString() }).eq('id', id);

const cancelSiblings = (row) =>
  supabaseAdmin.from('scheduled_followups')
    .update({ status: 'cancelled', skip_reason: 'sibling_rebooked', updated_at: new Date().toISOString() })
    .eq('source_type', row.source_type).eq('source_id', row.source_id)
    .eq('flow_key', row.flow_key).eq('status', 'pending').neq('id', row.id);

// Live eligibility for a booking-sourced row. Returns { ok } or { skip: reason }.
const bookingEligibility = async (row) => {
  // E2 — entitlement re-check (host may have downgraded since scheduling)
  const { data: hostRow } = await supabaseAdmin
    .from('profiles').select('plan, plan_expires_at').eq('id', row.host_id).maybeSingle();
  const n = await planService.getLimit(planService.resolveVendorPlan(hostRow || {}), 'followup_flows');
  if (!(n < 0 || n >= row.step)) return { skip: 'not_entitled' };

  // E3 — source still completed + paid
  const { data: bk } = await supabaseAdmin
    .from('bookings').select('status, payment_status, completed_at').eq('id', row.source_id).maybeSingle();
  if (!bk || bk.status !== 'completed' || bk.payment_status !== 'paid') return { skip: 'source_invalid' };

  // E4 — already rebooked with this host after the source completed
  const p = row.payload || {};
  let rq = supabaseAdmin.from('bookings')
    .select('id').eq('host_id', row.host_id).eq('payment_status', 'paid')
    .neq('id', row.source_id).gt('created_at', bk.completed_at || '1970-01-01');
  if (p.guest_id) rq = rq.eq('guest_id', p.guest_id);
  else if (p.guest_email) rq = rq.eq('guest_email', p.guest_email);
  else if (p.guest_phone) rq = rq.eq('guest_phone', p.guest_phone);
  const { data: rebooked } = await rq.limit(1);
  if (rebooked && rebooked.length) return { skip: 'already_rebooked', cancelSiblings: true };

  // E5 — contactability + email opt-out (WhatsApp channel is off for this event now)
  if (!p.guest_email && !p.guest_phone) return { skip: 'no_contact' };
  const emailOptedOut = p.guest_email ? await commEngine.isUnsubscribed(p.guest_email) : true;
  if (emailOptedOut && !p.guest_phone) return { skip: 'opted_out' };

  return { ok: true };
};

const sendRow = async (row) => {
  const p = row.payload || {};
  const deepLink = p.host_username ? `${CLIENT_URL}/${p.host_username}` : `${CLIENT_URL}`;
  await NotificationEngine.send({
    event: row.event_key,
    data: {
      email: p.guest_email, phone: p.guest_phone, name: p.guest_name,
      templateParams: [p.guest_name || 'there', p.host_name || 'your host'],
      emailData: {
        first_name: (p.guest_name || '').split(' ')[0],
        vendor_name: p.host_name, service_name: p.service_title, profile_url: deepLink,
      },
      emailUser: { name: p.guest_name, email: p.guest_email },
      recipientUserId: p.guest_id || row.recipient_user_id || null,
    },
  });
};

const processFollowups = async () => {
  const out = { sent: 0, skipped: 0, failed: 0 };
  // E1 — kill switch: leave pending (pause, not skip)
  if (!(await featureFlags.isFeatureEnabled('rebook_nudge'))) return out;

  const { data: rows, error } = await supabaseAdmin
    .from('scheduled_followups').select('*')
    .eq('status', 'pending').lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true }).limit(PROCESS_BATCH);
  if (error) { console.error('processFollowups query error:', error.message); return out; }

  for (const row of rows || []) {
    try {
      const elig = await bookingEligibility(row);
      if (elig.skip) {
        await setStatus(row.id, { status: 'skipped', skip_reason: elig.skip });
        if (elig.cancelSiblings) await cancelSiblings(row);
        out.skipped += 1;
        continue;
      }
      await sendRow(row);
      await setStatus(row.id, { status: 'sent', sent_at: new Date().toISOString() });
      out.sent += 1;
    } catch (e) {
      const attempts = (row.attempts || 0) + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await setStatus(row.id, { attempts, status, skip_reason: status === 'failed' ? `error: ${e.message}` : null });
      out.failed += 1;
      console.error(`processFollowups row ${row.id} failed (attempt ${attempts}):`, e.message);
    }
  }
  return out;
};
```

Change the export line to:

```javascript
module.exports = { scheduleFollowups, processFollowups };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/followupProcess.test.js --verbose`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add server/services/followups/followupService.js server/tests/unit/followupProcess.test.js
git commit -m "feat(followups): processFollowups cron body + E1-E5 eligibility gate"
```

---

### Task 5: Wire-in (completion hook, cron, event, template, flag) + full verification

**Files:**
- Modify: `server/controllers/bookingController.js` (`markBookingCompleted` — schedule call)
- Modify: `server/server.js` (register the `processFollowups` cron)
- Modify: `server/config/emailTemplates.js` (add `REBOOK_NUDGE_CUSTOMER` template)
- Modify: `server/services/email/communicationEngine.js` (add event to `MARKETING_EVENTS`)
- Modify: `server/config/featureRegistry.js` (add `rebook_nudge` flag)
- Test: `server/tests/unit/followupWireIn.test.js`

**Interfaces:**
- Consumes: `followupService.scheduleFollowups` / `processFollowups` (Tasks 3–4).
- Produces: completion now schedules follow-ups; the cron fires them; the email template + event + flag exist.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/followupWireIn.test.js`:

```javascript
const templates = require('../../config/emailTemplates');
const { REGISTRY } = require('../../config/featureRegistry');
const commEngine = require('../../services/email/communicationEngine');

test('REBOOK_NUDGE_CUSTOMER email template exists with a rebook CTA', () => {
  const list = Array.isArray(templates) ? templates : (templates.EMAIL_TEMPLATES || templates.templates);
  const t = list.find((x) => x.event_key === 'REBOOK_NUDGE_CUSTOMER');
  expect(t).toBeTruthy();
  expect(t.cta_url).toBe('{{profile_url}}');
});

test('rebook_nudge feature flag is registered', () => {
  expect(REGISTRY.some((f) => f.key === 'rebook_nudge')).toBe(true);
});

test('REBOOK_NUDGE_CUSTOMER is a marketing event (honors unsubscribe)', () => {
  expect(commEngine.isMarketing('REBOOK_NUDGE_CUSTOMER')).toBe(true);
});
```

> Note on the first assertion: inspect how `server/config/emailTemplates.js` exports its list (array vs `{ EMAIL_TEMPLATES }`) and match it; the test above tolerates both shapes. `isMarketing` is already exported from communicationEngine.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/followupWireIn.test.js --verbose`
Expected: FAIL — template not found / flag missing / event not marketing.

- [ ] **Step 3: Wire everything in**

**(a)** `server/config/featureRegistry.js` — add to the `REGISTRY` array, after the BOOKINGS `reschedule_fee` entry:

```javascript
  { key: 'rebook_nudge',         label: 'Rebook Nudge',         category: 'Bookings', scope: 'both',     description: 'Automated post-session rebook nudge to guests (Studio hosts). Off = no rebook follow-ups fire (pending ones pause).' },
```

**(b)** `server/config/emailTemplates.js` — add after the `BOOKING_COMPLETED_VENDOR` template object (mirror the existing IIFE shape; reuse the `Session Complete` theme category so no new theme key is introduced):

```javascript
  (() => { const t = themeForCategory('Session Complete'); return {
    event_key: 'REBOOK_NUDGE_CUSTOMER', audience: 'all', category: 'Marketing',
    name: 'Rebook Nudge — Customer', subject: 'Ready for another session with {{vendor_name}}?',
    preview_text: 'Book {{vendor_name}} again in a tap.',
    email_category: 'Session Complete',
    email_reason: 'You are receiving this because you recently booked a session on Meeticulous.',
    html_content:
      eyebrow(t.text, 'Come back soon') + h('Hi {{first_name}},') +
      lead('Hope your session with {{vendor_name}} went well. Ready for another?') +
      C.infoCard(t, [['Last service', '{{service_name}}']]) +
      lead('Booking your next session takes just a tap.'),
    cta_label: 'Book again', cta_url: '{{profile_url}}',
  }; })(),
```

**(c)** `server/services/email/communicationEngine.js` — add `'REBOOK_NUDGE_CUSTOMER'` to the `MARKETING_EVENTS` set/array (near line 21, where marketing/lifecycle events are listed).

**(d)** `server/controllers/bookingController.js` — in `markBookingCompleted`, immediately after the `if (notify) { ... }` block and before the badge-evaluation call, add:

```javascript
  // Post-session follow-ups (rebook nudge). Best-effort — never block completion.
  try {
    const { scheduleFollowups } = require("../services/followups/followupService");
    await scheduleFollowups({
      sourceType: "booking",
      sourceId: booking.id,
      hostId: booking.host_id,
      entity: booking,
      completedAt: data?.completed_at || new Date().toISOString(),
    });
  } catch (e) {
    console.error("scheduleFollowups error:", e.message);
  }
```

**(e)** `server/server.js` — near the other cron registrations (after the auto-complete cron), add:

```javascript
// ── Follow-up nudges cron (rebook). Leader-elected; fires due scheduled_followups. ──
const { processFollowups } = require('./services/followups/followupService');
const FOLLOWUP_INTERVAL_MIN = Number(process.env.FOLLOWUP_INTERVAL_MIN || 10);
setInterval(async () => {
  try { await runLocked('followups', () => processFollowups(), { leaseMs: 10 * 60 * 1000 }); }
  catch (err) { console.error('Follow-up cron error:', err.message); }
}, FOLLOWUP_INTERVAL_MIN * 60 * 1000);
```

- [ ] **Step 4: Run the wire-in test + reseed check**

Run: `cd server && npx jest tests/unit/followupWireIn.test.js --verbose`
Expected: PASS (3/3).

If the emailTemplates export shape made the first assertion fail, adjust the test's list extraction to the real export (do not change the template object). Note: the DB reseed (`node scripts/seedEmailTemplates.js`) is a deploy step run against both DBs after merge — not part of this test.

- [ ] **Step 5: Full verification**

Run: `cd server && npm test`
Expected: all server suites PASS (new: planService, flowRegistry, schedule, process, wire-in; no regressions).

Run: `cd client && npm run build`
Expected: build clean (no client code changed, but confirm nothing broke).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/bookingController.js server/server.js server/config/emailTemplates.js server/services/email/communicationEngine.js server/config/featureRegistry.js server/tests/unit/followupWireIn.test.js
git commit -m "feat(followups): wire rebook nudge — completion hook, cron, event, template, flag"
```

---

## Notes for the implementer

- Read the spec's E1–E5 and the entitlement rule before Task 3/4. Test values derive from the spec; if a value surprises you, re-derive from the spec rather than adjusting code to match a guess.
- `scheduleFollowups` is intentionally best-effort and self-contained: it fetches the host plan itself because the completion join does not carry plan columns.
- The `scheduled_followups` table won't exist until v3.58 is applied manually on both DBs — the schedule/query paths must degrade without throwing (covered by the "never throws on DB error" test and the empty cron result).
- WhatsApp stays off (`whatsapp_enabled=false` on the event); `templateParams` are populated so enabling the channel later needs no code.
- Do NOT change the existing `revenue`/reminder logic, routes, or permissions. This feature adds no route and no permission.

## Deploy steps (post-merge, manual)

1. Apply `v3.58_scheduled_followups.sql` and `v3.59_rebook_nudge_config.sql` in the Supabase SQL editor on BOTH prod (Mumbai) and staging (Tokyo).
2. Run `node server/scripts/seedEmailTemplates.js` against both DBs to seed the `REBOOK_NUDGE_CUSTOMER` template.
3. Verify the `rebook_nudge` flag shows in admin Feature Status (default on).
4. Leave `REBOOK_NUDGE_CUSTOMER.whatsapp_enabled=false` until the AiSensy template is approved.
