# Multi-Agent Support Cockpit + Context Rail

**Date:** 2026-08-26
**Branch base:** `main`
**Status:** PLAN — review before code
**Origin:** Support system teardown (score 39/100). This plan implements the **P0 context rail** plus the requested **multi-agent human-handoff** mechanics.

---

## Decisions locked

| Question | Decision | Why |
|---|---|---|
| 4-digit agent code | **DROPPED** | Agents log in with own admin accounts + 2FA. The JWT already identifies who is replying. A shared PIN 9 people know is not security and duplicates auth. |
| Agent identity on chat | **Persona map** (admin → one of 9 display names) | Customer sees a warm human name; system attributes to the real admin account. |
| Auto-intro on assign | **YES** | Fills the gap while the agent reads context. Reuses the existing `Tithi` brand persona. |
| Multiple threads per user | **Cheap version now** ("Start new topic"), full switcher later | Human chat used 3× ever — full thread-list UI is premature (YAGNI). |
| Context rail | **YES — this is the P0** | Neither bot nor agent can currently see the customer's own data. This is the highest-ROI change. |

> **Sequencing rule:** ship the context rail *with* the cockpit, not after. A prettier cockpit that's still blind = agents still page-hop.

---

## What already exists (don't rebuild)

- `support_threads` / `support_messages` — v3.115. Statuses `bot → waiting → assigned → resolved`. Soft `user_id` + `guest_phone`, `assigned_admin` (free-text), `ai_summary` (**stored, never rendered**), `rating` (**column exists, no UI**).
- `server/services/supportChatService.js` — `assign()` sets `assigned_admin` + status `assigned`; `escalate()` is the single root-cause handoff site; `resolve()`.
- `server/controllers/supportAdminController.js` — reply auto-claims a `bot`/`waiting` thread to the replying admin.
- `client/src/pages/admin/AdminSupportChat.jsx` — inbox + detail. `adminAssignSupport` exists in `api.js` but is **not wired** into the UI.
- `client/src/pages/admin/bolt/EscalationsPage.jsx` — the *other* inbox (`bot_escalations`), separate status vocab, has internal notes.
- Data available to join (by `user_id` / `phone`): `profiles` (plan, plan_expires_at, onboarding_completed, razorpay_account_id, is_host), `bookings` (status, payment_status, reschedule_status, guest_phone), `kyc_submissions` (status only — PII is encrypted, do **not** surface), `services` (is_active), `subscription_payments` / `plan_purchases`, settlement/payout.

---

## Phase 1 — Agent identity + auto-intro (small, ship first)

**Goal:** assigning a chat to self stamps the agent's persona name and posts a warm intro.

1. **Persona map** — `server/config/supportAgents.js`: a fixed map of admin identity (`email` or admin `id`) → `{ displayName }` for the 9 people (8 About-page names + Tithi). *ponytail: config file, not a migration — the roster is fixed and small; promote to a table only if it needs an editing UI.*
   - Fallback: unmapped admin → generic `"Support Team"` (never leak a raw email/admin id to the customer).
2. **`assign()` extension** (`supportChatService.js`): after setting `assigned`, resolve persona from the assigning admin and:
   - Set/stamp the persona on the thread (add nullable `agent_name` to `support_threads`, or reuse `assigned_admin` + resolve at render — prefer a stored `agent_name` snapshot so historic transcripts stay correct if the roster changes). **→ small migration v3.116: `support_threads.agent_name TEXT`.**
   - Insert one auto-intro `support_messages` row: `sender='admin'`, `sender_name=<persona>`, body from a template:
     > "Hi{{ , name}} — I'm {{persona}} from the Meeticulous support team. Give me a moment to read your messages and I'll help you right away."
   - **Guard:** only post if the thread has no prior `admin` message (idempotent — re-assign doesn't re-greet). Name-personalization (`{{name}}`) filled from context service (Phase 2) when known; omit gracefully when not.
3. **Wire "Assign to me"** in `AdminSupportChat.jsx` — call the existing `adminAssignSupport`, optimistic status flip (mirror existing reply-claim at line ~107). No code prompt.
4. **Tests:** `assign()` posts exactly one intro; re-assign posts none; unmapped admin → "Support Team"; intro persona matches assigning admin.

**PR boundary:** self-contained. Ships warmth immediately even before the rail.

---

## Phase 2 — Context service + rail (the P0)

**Goal:** the agent sees the customer's live record on the ticket; `ai_summary` finally rendered.

1. **`server/services/supportContextService.js`** — `getSupportContext({ userId, phone, isHost })` returns read-only:
   ```
   { profile: {name, plan, planExpiresAt, isHost, onboardingCompleted},
     bookings: [{ref, status, payment_status, when, service}],  // latest N
     activation: {listingActive, blocker?},                     // host: subscription/kyc/services.is_active
     kyc: {status},                                             // status ONLY, never PII
     payout: {state, nextSettlement?} }                         // host
   ```
   - Guest keyed by `phone` → `bookings.guest_phone`; host by `user_id` → `profiles.id`.
   - `supabase-js never throws` — check `error` on every query; degrade field-by-field (missing table/col → null section, never 500). Matches existing schema-fallback pattern.
2. **Endpoint** `GET /admin/support/thread/:id/context` (perm `support.view`) → resolves thread's `user_id`/`guest_phone`, calls the service.
3. **Context rail UI** in `AdminSupportChat.jsx` detail — side panel:
   - Profile + plan + host/guest badge.
   - Latest bookings (status + payment_status chips), activation blocker (host), KYC status pill, payout state.
   - **Deep links** to Host360 / bookings / payments (open the existing admin pages filtered to this user) — kills page-hopping.
   - **Render `ai_summary`** at the top (it's already stored on the thread).
4. **Tests:** guest-by-phone and host-by-id resolution; PII (PAN/Aadhaar/account) never present in payload; partial-data degradation; endpoint perm-gated.

**PR boundary:** service + endpoint + rail. The service is deliberately **reusable by the bot later** (Phase 4).

---

## Phase 3 — Unify the inbox + multi-thread (cheap slices)

1. **One inbox view** — surface `bot_escalations` alongside `support_threads` in `AdminSupportChat.jsx` (or a shared queue endpoint). Single status language mapping. *This is the heaviest slice — can be its own PR; flag if we defer.*
2. **Filters worth adding now:** `unassigned`, `mine`, `waiting-us` vs `waiting-customer`. (SLA/priority = later P2.)
3. **"Start new topic"** (host + guest, `SupportChat.jsx`): archives the current thread, opens a fresh one. Full thread switcher deferred until human volume justifies. *ponytail: one archive flag + a button, not a thread-list UI.*

---

## Phase 4 — Bot reuse (out of scope here, noted)

Once `supportContextService` exists, the bot's data-aware auto-resolution ("where's my refund", "why isn't my listing live") calls the same service. Separate plan — this is where the audit's automation gains land.

---

## Migrations

- **v3.116** — `support_threads.agent_name TEXT` (persona snapshot). Additive, schema-fallback safe. Apply BOTH DBs (prod Mumbai + staging Tokyo) per repo workflow.

## Risks / guards

- **Persona honesty:** the 9 names are real About-page people. Keep the map 1:1 admin→person; do not let one admin appear as multiple personas (that's deception, not support).
- **KYC PII:** context service returns `status` only. The encrypted PAN/Aadhaar/account fields must never enter the payload.
- **Idempotent intro:** re-assign / reopen must not re-greet.
- **`supabase-js` silent errors:** inspect `error` on every read.

## Definition of done

- Agent clicks "Assign to me" → thread flips to `assigned`, customer sees a named human intro, agent sees the full context rail + `ai_summary` + deep links.
- No 4-digit code anywhere.
- `npm test` (server) + `npx vitest run` (client) green before any PR.

## Open questions for review

1. Defer inbox-unification (Phase 3.1) to its own PR, or bundle? (Recommend defer — it's the heaviest.)
2. Persona map by admin **email** or admin **id**? (Recommend email — stable, human-readable.)
3. Auto-intro: always post, or suppress if the agent starts typing within ~10s? (Recommend always — simpler, and the "give me a moment" copy covers it.)
