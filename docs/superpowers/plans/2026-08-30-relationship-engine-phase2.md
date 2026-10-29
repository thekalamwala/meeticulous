# Relationship Engine — Phase 2 (Governor → Sends Live → Guests) — Implementation Plan

> **For agentic workers:** implement this plan PR-by-PR, task-by-task, TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Do NOT start until the human says go — this doc is the plan, written ahead of build.

**Status:** PLANNED, not started. Ordered per the founder's "start from the top" decision.

**Goal:** Finish the relationship engine the MVP (PR-0→6 + birthday) stood up. Five deliverables, in dependency order:

| # | Deliverable | Shape | Why this order |
|---|---|---|---|
| **PR-7** | Global touch governor | 1 master cap across **all** automated touches | Safety rail must exist before any send goes live |
| **PR-7.5** | Health signals wiring | feed `supportOpen` / `negativeFeedback` into health | Cheap; makes recs honest about unhappy customers *before* we send |
| **PR-8** | Flip `crm_admin_sends` ON | verified end-to-end, then the operational flip | Only after the cap (7) + honest targeting (7.5) exist |
| **Two-clock** | Lead-panel header | show human-clock + machine-clock side by side | UI polish; no ordering constraint |
| **PR-9** | Guests via `contacts` | extend the Desk to guests, **not** a new pipeline | Biggest surface; widens *who* we contact — last |

**Tech Stack:** Node.js/Express, Supabase (`supabaseAdmin`, service-role, bypasses RLS), Jest (server), Vitest (client), React 18 + Vite. Reuses the existing `sendGate` / `NotificationEngine` / `featureFlags` / `relationshipHealth` / `relationshipTouch` / `lifecycleEngine` / `deskService`.

## What already exists (do NOT rebuild)

Read these before Task 1 — the reuse points are the whole design:

- **`server/services/crm/sendGate.js`** — `canSend(lead, channel, {automated})`. Already enforces: the `crm_admin_sends` fail-closed kill-switch, do-not-contact, per-channel opt-out (`email_unsubscribes` / `contacts.email_suppressed` / `contacts.whatsapp_suppressed`), and — for `automated:true` only — quiet hours (09–20 IST) + a **48h / 1-message frequency cap counting `crm_messages`**. **Gap:** the cap counts only `crm_messages`. It does not see automated touches sent by other paths.
- **`server/services/birthdayGreetings.js`** — sends via `NotificationEngine.send` **directly, bypassing `sendGate`**. So a birthday email today is not counted by, and not subject to, the cap. This is the concrete gap PR-7 closes.
- **`server/services/crm/relationshipHealth.js`** — `compute(lead, ctx, now)` **already reads `ctx.supportOpen` and `ctx.negativeFeedback`** (weight `W.softNegative`, corroboration rules). The pure function needs **no change** for PR-7.5 — only `lifecycleEngine.loadAccountCtx` must populate the two facts.
- **`server/services/crm/touchRecommendationService.js`** — `upsertOpen` has a 14-day per-reason cooldown + once-ever set. It caps *re-nagging the same reason*, not *total volume across reasons* — that's the governor's job.
- **`touch_recommendations`** table (`v3.136`) — already carries `subject_type TEXT DEFAULT 'lead'` (comment: `'guest' post-MVP`) and a **nullable** `lead_id`. PR-9's guest path was scaffolded here.
- **`server/services/crm/relationshipTouch.js`** — `recommendationsFor(lead, health, ctx, now)` and `milestoneRecommendationsFor(lead, ctx, now)` are **pure** and already stamp `subject_type: 'lead'`. They read only `lead.id`, `lead.status`, `lead.last_meaningful_interaction_at`, `lead.created_at` + `ctx`. A guest-shaped object feeds them unchanged (PR-9).
- **`server/services/crm/deskService.js`** — `getRelationships` reads open `touch_recommendations` joined to `leads`, returns `last_meaningful_interaction_at` but **not** `last_automated_touch_at` (needed for the two-clock).
- **Source tables:** open support = `support_threads` (+ `bot_escalations`); negative feedback = `reviews` / `feedback`. Confirm exact status/rating columns during PR-7.5 Task 1.

## Global Constraints

- **Never hardcode plan limits** or send caps in a way that can't be tuned — the governor cap is config (env + feature-flag-visible), not a literal buried in a hot path.
- **Fail-open on governor read errors** (matches `sendGate.throttle`): a DB outage must not silently freeze every automated send. A real cap breach always wins; an *error* does not block.
- **Schema-fallback discipline:** every new column/table degrades on the missing-column/table error until confirmed on BOTH DBs (staging Tokyo `xwvciqkayammbvsidqig` first, then prod Mumbai `ayjhlwyzszykqtnaktpb`). Keep the fallback until confirmed applied everywhere.
- **Migrations applied via Supabase MCP** (the founder's choice), staging first. The plan produces the `.sql` files; apply them out-of-band, then remove the fallback in a follow-up once verified.
- **Sends stay OFF until PR-8.** PR-7 and PR-7.5 must be safe to merge and run with `crm_admin_sends` still OFF — they add gating and signals, they do not enable delivery.
- Do NOT create a new pipeline for guests (PR-9). Extend `contacts`/`touch_recommendations`; reuse the pure health/touch functions.
- CLAUDE.md workflow: fresh branch from `main` per PR, commit, `gh pr create`, **stop at the PR** (the founder merges). Each PR here is a separate branch/PR.

---

# PR-7 — Global Touch Governor

**Branch:** `feat/crm-touch-governor`

**Goal:** One master cap that every automated touch — CRM sends, birthday, milestone/anniversary touches, any future automated path — is counted by and checked against, per subject, across a rolling window. `sendGate`'s existing 48h/`crm_messages` cap becomes one *input* to the governor, not the whole story.

**Architecture:** A new pure-ish `touchGovernor.js` owns (a) the rolling-window count of automated touches to a subject, read from the durable record we already stamp (`leads.last_automated_touch_at` + `lead_activities` automated rows), and (b) the configurable cap. `sendGate.throttle` delegates its cap decision to the governor; `birthdayGreetings` and any other `NotificationEngine`-direct automated path call `governor.canTouch` before sending and `governor.recordTouch` after. Config: `CRM_TOUCH_CAP` (max automated touches / window) + `CRM_TOUCH_WINDOW_H`, surfaced read-only in admin Feature Status.

### Task 1: `touchGovernor.js` — pure window + cap decision

**Files:**
- Create: `server/services/crm/touchGovernor.js`
- Test: `server/tests/unit/touchGovernor.test.js`

**Interfaces:**
- Produces:
  - `withinCap(touchTimestamps: string[], now) -> { ok:boolean, count:number, reason?:'frequency_capped' }` — **pure**, testable without I/O. `ok=false` when `count >= CAP` inside the window.
  - `CAP` / `WINDOW_MS` read from `process.env.CRM_TOUCH_CAP` (default 1) / `process.env.CRM_TOUCH_WINDOW_H` (default 48), exported for the admin surface.

- [ ] **Step 1:** Write `touchGovernor.test.js` — assert: empty history → ok; one touch 10h ago with CAP=1 → capped; one touch 60h ago with WINDOW=48h → ok (aged out); count only touches inside the window; CAP=2 allows the second, blocks the third.
- [ ] **Step 2:** Run → fails (module missing).
- [ ] **Step 3:** Implement the pure `withinCap` + config consts. No DB here — this is the unit-testable core.
- [ ] **Step 4:** Run → passes.
- [ ] **Step 5:** Commit `feat(crm): pure touch-governor window + cap core`.

### Task 2: Governor DB adapter — `canTouch` / `recordTouch`

**Files:**
- Modify: `server/services/crm/touchGovernor.js` (add the I/O wrappers)
- Test: `server/tests/unit/touchGovernorDb.test.js`

**Interfaces:**
- Consumes: `supabaseAdmin`, `leads.last_automated_touch_at` (v3.133), `lead_activities` (automated rows, `is_meaningful=false`).
- Produces:
  - `canTouch(subject) -> Promise<{ok, reason?}>` — subject = `{ type:'lead'|'guest', id }`. Reads the subject's automated-touch timestamps in the window, delegates to `withinCap`. **Fail-open** on query error.
  - `recordTouch(subject, {channel, event}) -> Promise<void>` — stamps `last_automated_touch_at` and (for leads) writes an automated `lead_activities` row via the existing `activity.logActivity` with `actorAdminId:null`. Best-effort; never throws.

- [ ] **Step 1:** Write `touchGovernorDb.test.js` (mock `supabaseAdmin`): capped subject → `{ok:false, reason:'frequency_capped'}`; clear subject → `{ok:true}`; query error → `{ok:true}` (fail-open); `recordTouch` issues the update + activity write.
- [ ] **Step 2:** Run → fails.
- [ ] **Step 3:** Implement `canTouch` / `recordTouch`. Reuse `activity.logActivity` (do not hand-write the activity insert). Guests: count from `contacts.last_automated_touch_at` (added in PR-9) — until then a guest subject fails-open (no rows) which is acceptable pre-PR-9.
- [ ] **Step 4:** Run → passes.
- [ ] **Step 5:** Commit `feat(crm): touch-governor DB adapter (canTouch/recordTouch, fail-open)`.

### Task 3: Route `sendGate` + `birthdayGreetings` through the governor

**Files:**
- Modify: `server/services/crm/sendGate.js` (`throttle` delegates its cap to the governor; keep quiet-hours local)
- Modify: `server/services/birthdayGreetings.js` (call `canTouch` before send, `recordTouch` after)
- Test: `server/tests/unit/sendGateGovernor.test.js`, extend `server/tests/unit/birthdayGreetings.test.js`

**Interfaces:**
- `sendGate.throttle` keeps quiet-hours; replaces its inline `crm_messages` count with `governor.canTouch`. (The governor's window counts the durable automated-touch record, which `crm_messages` sends must also stamp via `recordTouch` — wire that where `crm_messages` transitions to sent, in `messageService`.)
- `birthdayGreetings.processBirthdays`: skip a recipient when `canTouch` says capped (record the skip reason, do not mark `birthday_greeted_at`), send + `recordTouch` otherwise.

- [ ] **Step 1:** Write the failing tests — sendGate returns `frequency_capped` when governor caps; birthday send is skipped (and un-greeted) when capped, sent + recorded when clear.
- [ ] **Step 2:** Run → fails.
- [ ] **Step 3:** Wire the delegations. In `messageService`, call `governor.recordTouch` on a successful automated send so CRM sends count toward the same cap. Keep birthday's once-per-year guard AND the governor check (both must pass).
- [ ] **Step 4:** Run → passes. Then `cd server && npm test` (no regressions).
- [ ] **Step 5:** Commit `feat(crm): unify automated-touch cap — sendGate + birthday via governor`.

### Task 4: Admin visibility + full verification

**Files:**
- Modify: `server/config/featureRegistry.js` (optional read-only surfacing of the cap config; the flag `crm_admin_sends` already exists)
- Modify: the admin Feature Status controller/view if it shows env-config (else skip)

- [ ] **Step 1:** Surface `CRM_TOUCH_CAP` / `CRM_TOUCH_WINDOW_H` current values in the admin ops view (read-only) so an admin can see the ceiling. If there's no natural home, document them in `docs/current-state.md` instead and skip the code change.
- [ ] **Step 2:** `cd server && npm test`; `cd client && npm run build` (no client change, sanity only).
- [ ] **Step 3:** Commit `chore(crm): surface touch-governor cap in ops view + docs`.

**Deploy note:** No migration (reuses `last_automated_touch_at` from v3.133). Set `CRM_TOUCH_CAP` / `CRM_TOUCH_WINDOW_H` in `server/.env` on Render (defaults 1 / 48 are safe).

---

# PR-7.5 — Wire supportOpen / negativeFeedback into health

**Branch:** `feat/crm-health-negative-signals`

**Goal:** Make relationship health honest about unhappy customers. `relationshipHealth.compute` **already** consumes `ctx.supportOpen` and `ctx.negativeFeedback`; they're just never set. Populate them in `lifecycleEngine.loadAccountCtx`. No change to the pure function.

**Architecture:** Add two batched reads to `loadAccountCtx` (one per fact, over the same `ids` set it already builds), set `supportOpen`/`negativeFeedback` booleans per profile in the ctx map. Pure `compute` does the rest (it caps a single soft signal at `cooling`, needs 2+ to reach `at_risk`).

### Task 1: Confirm source columns + write the ctx facts (TDD on loadAccountCtx)

**Files:**
- Modify: `server/services/crm/lifecycleEngine.js` (`loadAccountCtx` — two reads + ctx keys)
- Test: `server/tests/unit/lifecycleAccountCtx.test.js` (create if absent)

**Interfaces:**
- Consumes: `support_threads` (open thread for the profile's user) and `bot_escalations` (open handoff); `reviews`/`feedback` (a low rating / negative row for the host). **Confirm the exact open-status value and rating threshold** by reading the two controllers that own these tables before writing the query — do not guess column names.
- Produces: `ctx.get(profileId).supportOpen: boolean`, `.negativeFeedback: boolean`.

- [ ] **Step 1:** Read the support + feedback controllers to nail the status enum + rating column. Write `lifecycleAccountCtx.test.js`: a profile with an open support thread → `supportOpen:true`; a profile with a ≤2★ review → `negativeFeedback:true`; neither → both false. Mock `supabaseAdmin` batched reads.
- [ ] **Step 2:** Run → fails.
- [ ] **Step 3:** Add the two `Promise.all` reads in `loadAccountCtx`, build `Set`s of profile ids with open support / negative feedback, merge the two booleans into the ctx object (same place `bookingsTotal` is set). Keep it one batched query each (not per-lead).
- [ ] **Step 4:** Run → passes. Add/extend a `relationshipHealth.test.js` case proving that with `supportOpen:true` a would-be `steady` lead lands `cooling`, and `supportOpen + negativeFeedback` reaches `at_risk` (guards already exist — this asserts the wiring end-to-end).
- [ ] **Step 5:** `cd server && npm test`; commit `feat(crm): feed open-support + negative-feedback into relationship health`.

**Deploy note:** No migration. Health recomputes on the next 15-min lifecycle tick.

---

# PR-8 — Turn CRM sends ON (verified)

**Branch:** `feat/crm-sends-live`

**Goal:** Flip `crm_admin_sends` from OFF to ON — but only behind an end-to-end proof that **every** automated send path passes `sendGate`/governor first, so "on" cannot mean "uncapped." The code work is the proof + closing any bypass; the flip itself is an operational step.

**Architecture:** Audit every outbound automated path (`messageService`, `sequenceService`, `birthdayGreetings`, any `NotificationEngine`-direct CRM send). Ensure each consults `sendGate.canSend(..., {automated:true})` and `governor` before delivery. Add one integration-style test that, with the flag ON, a capped/opted-out/DNC subject is skipped and a clean subject sends exactly once. Then flip the flag (DB feature-flag row / seed), staged.

### Task 1: Bypass audit + closing test

**Files:**
- Modify: whichever send path is found bypassing the gate (expected: none for `crm_messages`; confirm `sequenceService` drains through `sendGate`).
- Test: `server/tests/integration/crmSendGate.test.js`

- [ ] **Step 1:** Grep every `NotificationEngine.send` / provider send in `server/services` and list which pass through `sendGate`. Write the failing integration test: flag ON + governor-capped subject → skipped with reason; flag ON + DNC → skipped; flag ON + clean → sent once + `recordTouch` called.
- [ ] **Step 2:** Run → fails on any path that skips the gate.
- [ ] **Step 3:** Route the offending path(s) through `sendGate.canSend`. (Birthday already gated in PR-7; sequences should already be — verify, don't assume.)
- [ ] **Step 4:** Run → passes; `cd server && npm test`.
- [ ] **Step 5:** Commit `test(crm): prove all automated sends pass the gate before enabling`.

### Task 2: The flip (staged operational step)

- [ ] **Step 1:** On **staging** only, enable `crm_admin_sends` (feature-flag row → enabled). Watch the CRM message log + governor skips for one full lifecycle cycle; confirm caps hold and no unexpected volume.
- [ ] **Step 2:** Document the staging result in `docs/current-work.md`.
- [ ] **Step 3:** After the founder signs off on staging, enable on **prod**. This is a founder-gated deploy step, NOT part of the merged PR — the PR ships the proof + any bypass fix; the prod flip is a separate switch the founder throws.

**Deploy note:** No schema change. The flip is a feature-flag toggle. Keep `crm_admin_sends` FAIL_CLOSED in code (never remove it from `FAIL_CLOSED_KEYS`) — "on" lives in the DB row, so it can be pulled instantly.

---

# Two-Clock Lead-Panel Header

**Branch:** `feat/crm-two-clock-header`

**Goal:** In the relationship/lead panel header, show two ages side by side — **human clock** (time since `last_meaningful_interaction_at`) and **machine clock** (time since `last_automated_touch_at`) — so an admin instantly sees "no human has spoken to them in 41d; a bot pinged them yesterday." Colour the human clock by staleness; leave the machine clock neutral.

**Architecture:** Backend already stamps both timestamps. `deskService.getRelationships` returns the human clock but not the machine clock — add `last_automated_touch_at` to the embedded `leads(...)` select + `flattenRec`. Client renders a small `<TwoClock>` in the panel header using a relative-time helper. No migration, no new logic.

### Task 1: Expose `last_automated_touch_at`

**Files:**
- Modify: `server/services/crm/deskService.js` (`getRelationships` select + `flattenRec`)
- Test: extend `server/tests/unit/deskService*.test.js`

- [ ] **Step 1:** Failing test: `flattenRec` includes `last_automated_touch_at`.
- [ ] **Step 2/3:** Add `last_automated_touch_at` to the `leads(...)` select string and to `flattenRec`'s output.
- [ ] **Step 4/5:** Run → passes; commit `feat(crm): expose last_automated_touch_at on relationship rows`.

### Task 2: `<TwoClock>` in the panel header

**Files:**
- Create: `client/src/components/crm/TwoClock.jsx` (+ a `relativeAgo` util if none exists)
- Modify: `client/src/pages/admin/sales/RelationshipDesk.jsx` (render it in the row/panel header)
- Test: `client/src/tests/TwoClock.test.jsx`

- [ ] **Step 1:** Vitest: given the two ISO fields, renders "Human 41d" + "Auto 1d"; human chip gets the `at-risk` colour past a threshold (e.g. >21d amber, >45d red); handles null (never contacted → "—" / "never").
- [ ] **Step 2/3:** Build `TwoClock` with existing design tokens (4px borders, rounded-xl, Poppins body — per UI Rules; reuse the Desk's existing chip styles, do not invent colours). Wire into the Desk.
- [ ] **Step 4/5:** `cd client && npx vitest run`; esbuild sanity; commit `feat(crm): two-clock header on the Relationship Desk`.

**Deploy note:** No migration. Pure read/render of fields that already exist.

---

# PR-9 — Guests via `contacts` (extend, don't fork)

**Branch:** `feat/crm-guests-relationships`

**Goal:** Bring guests (bookers, living in `contacts`/`profiles`) into the Relationship Desk and the touch engine **without** a parallel pipeline — feeding the existing pure `relationshipHealth` / `relationshipTouch` functions a guest-shaped subject, writing recs with `subject_type='guest'`.

**Architecture:** `touch_recommendations` already has `subject_type` + a nullable `lead_id`; add a `contact_id` (nullable, FK `contacts`) so a guest rec references its contact. A new `guestRelationshipEngine` (mirrors the lead path in `lifecycleEngine` but over `contacts`) builds a guest ctx (bookings total/last-30d, anniversary from first booking, `supportOpen`/`negativeFeedback`, opt-out state), calls the **unchanged** pure functions, and upserts recs. `deskService.getRelationships` unions lead-backed and contact-backed open recs, presenting them uniformly. `governor.canTouch`/`sendGate` already accept a subject type — guests plug into the same cap.

### Task 1: Migration — guest subject on recs + guest touch clocks

**Files:**
- Create: `server/migrations/v3.139_touch_rec_guest_subject.sql`

- [ ] Add `touch_recommendations.contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE` (nullable) + index; add `contacts.last_meaningful_interaction_at` / `last_automated_touch_at` / `last_activity_at` if absent (mirror the leads columns from v3.133) so the governor + health read a guest's clocks. Keep the dedupe_key convention `contact:<id>:<reason>`. Additive; RLS unchanged.
- [ ] Commit `feat(crm): v3.139 guest subject on touch_recommendations + contact touch clocks`. Apply via Supabase MCP (staging → prod); keep schema-fallback in the service until confirmed.

### Task 2: Guest ctx builder + engine (pure funcs unchanged)

**Files:**
- Create: `server/services/crm/guestRelationshipEngine.js`
- Test: `server/tests/unit/guestRelationshipEngine.test.js`

**Interfaces:**
- Produces: `run()` (leader-elected tick, or folded into the existing lifecycle cron) that: loads a batch of `contacts` with booking history, builds a guest ctx (`hasBooking`, `bookingsLast30d`, `bookingsTotal`, `supportOpen`, `negativeFeedback`, first-booking date → anniversary), maps the contact to a subject shape (`{id, status, last_meaningful_interaction_at, created_at:firstBookingAt}`), calls `relationshipHealth.compute` + `relationshipTouch.recommendationsFor`/`milestoneRecommendationsFor` **unchanged**, and `upsertOpen`s the recs with `subject_type:'guest', contact_id`.

- [ ] **Step 1:** Failing unit tests: a guest cooling since last booking → a `cooling` check-in rec keyed `contact:<id>:cooling`; a 50-booking guest → a milestone rec; a guest with an open support thread → health `cooling`+. Assert the pure functions are called with the guest shape and the rec carries `subject_type:'guest'`.
- [ ] **Step 2/3:** Build the ctx loader (batched reads over `contacts` + `bookings` by guest identity + support/feedback) and the engine loop. Reuse `touchRecommendationService.upsertOpen` (extend it to accept `contact_id` if it currently assumes `lead_id`). Do NOT duplicate the pure logic.
- [ ] **Step 4/5:** `cd server && npm test`; commit `feat(crm): guest relationship engine over contacts (reuses pure health/touch)`.

### Task 3: Desk union + consent + wire-in

**Files:**
- Modify: `server/services/crm/deskService.js` (`getRelationships` unions guest recs; `flattenRec` handles a `contacts(...)` embed)
- Modify: `server/services/crm/touchRecommendationService.js` (`complete`/activity path handles a guest subject — stamp the contact's meaningful clock, not a lead)
- Modify: `server/server.js` (register the guest engine tick, or fold into the lifecycle cron)
- Test: extend desk + touchRec service tests

- [ ] **Step 1:** Failing tests: `getRelationships` returns both lead- and guest-backed recs, ranked together; completing a guest rec stamps `contacts.last_meaningful_interaction_at`; `governor.canTouch({type:'guest',id})` counts the guest's automated touches.
- [ ] **Step 2/3:** Implement the union select (guest recs join `contacts` for name/health), guest-aware `complete`, and the cron registration. Ensure guest sends honor guest consent (`email_unsubscribes` + `contacts.*_suppressed`) via `sendGate` — the gate already checks contacts, confirm it resolves a guest subject.
- [ ] **Step 4/5:** `cd server && npm test`; `cd client && npm run build` (Desk now shows guests — confirm the client tolerates a rec with a contact instead of a lead). Commit `feat(crm): Relationship Desk unifies leads + guests`.

### Task 4: Client — guests in the Desk

**Files:**
- Modify: `client/src/pages/admin/sales/RelationshipDesk.jsx` (+ a subtle lead/guest badge)
- Test: extend `client/src/tests/RelationshipDesk.test.jsx`

- [ ] Render a guest-sourced row identically to a lead row, with a small "Guest" vs "Lead" tag; the two-clock + actions work the same. Vitest + esbuild; commit `feat(crm): show guests alongside leads on the Relationship Desk`.

**Deploy note:** Apply `v3.139` via Supabase MCP (staging → prod) before merge-enabling the guest engine. Guest sends still gated by `crm_admin_sends` + governor.

---

## Notes for the implementer

- The whole point of PR-2/3 being **pure** is realised in PR-7.5 and PR-9: you should change ctx *inputs*, not the scoring/recommendation logic. If you find yourself editing `relationshipHealth.compute` or `relationshipTouch.recommendationsFor`, stop and reconsider — the change almost certainly belongs in the ctx builder.
- `sendGate` fails **open** on lookups and **closed** on the kill-switch. Preserve both. The governor also fails open on its count read. An outage must never freeze legitimate sends nor silently unleash them.
- Keep `crm_admin_sends` in `FAIL_CLOSED_KEYS` forever. "On" is a DB row, revocable instantly.
- Each PR is independently mergeable and safe with sends OFF, except PR-8's prod flip (founder-gated, out-of-band).
- Run `cd server && npm test` and `cd client && npm run build` before each PR. Only report failures caused by existing code.

## Suggested build order (founder: "start from the top")

1. PR-7 (governor) → 2. PR-7.5 (health signals) → 3. PR-8 (flip, staged) → 4. Two-clock (any time) → 5. PR-9 (guests).
