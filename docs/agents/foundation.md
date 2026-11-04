# Agent network — shared foundation

Built with SUTRA, before any agent does real work. Everything here is the common machinery:
the runtime, how agents read production data safely, the shared tables, the approval
executor, and cost control. Read [`README.md`](README.md) §2 first.

## Runtime: Claude Code agents

Founder decision (2026-11-04): all eight agents run as **Claude Code agents**, not a server
service and not a hosted Claude product.

- Each agent is `.claude/agents/<name>.md` — a system prompt assembled from its spec section
  plus README §2 in full, with a `tools:` allowlist that grants only what its doc permits.
- Each recurring job is a skill `.claude/skills/agent-<name>/SKILL.md` (daily, weekly, …),
  invoked headless.
- Schedules run through one runner, `scripts/agents/run-agent.ps1 <name> <job>`, a clone of
  the proven `scripts/blog-autopost.ps1` pattern (`claude -p "/agent-<name>-<job>" --output-format json`),
  registered in Windows Task Scheduler.

**Known limit of this runtime:** agents run only when the founder's PC is on. The runner
reads each job's last-run timestamp from the agent API and **catches up missed jobs** on the
next start, so a day with the PC off is not lost, only delayed. Documented upgrade path when
this hurts: move the schedules to cloud routines — no code change to the agents themselves,
only to how the runner is triggered.

## Production data access: the agent API (the safe wall)

Agents are given **no** database credentials, **no** Supabase MCP, and **no** Razorpay keys.
Those are removed from each agent's `tools:` allowlist and denied in `.claude/settings.json`
for agent runs. Prompt instructions are not the wall; the absence of the tool is.

Instead, every agent reads and writes through **one server API, `/api/agents/*`**, with a
**per-agent token**:

- Tokens are random, stored only as a hash in `agent_tokens`, revocable, and every call is
  audited like an admin action (`services/auditService.js`).
- Each token maps to an **allow-list of endpoints**. The wall between departments is this
  map, enforced server-side and covered by tests — not the agent's prompt. Examples:
  - ARTHA → finance summary, reconciler outputs, payout-due list. **No** CRM endpoints.
  - SEVA → one customer's bookings/payments **by explicit ID**, tickets, escalations. **No** finance ledger.
  - SATYA → KYC queue and Razorpay activation **status**. **Never** the KYC document files in the private `kyc` bucket.
  - VANI → GSC, analytics, SEO tables. **No** customer PII, **no** finance.
- Read endpoints wrap **existing** services (`financeAdminController`, `deskService`,
  `kycRoutes`, `gscClient`, …). No new raw-SQL surface.

**Writes** an agent may do through the API are only: the task log, approvals (creating one =
proposing), its own memory, digests, and the action log. Everything with a real-world effect
is level P and goes through the executor below.

The whole surface is behind one fail-closed feature flag, **`agents_api`** (OFF by default):
when off, `/api/agents/*` returns 403. That is the global kill switch.

## The approval executor (the only path to real-world effects)

Claude Code agents **never** move money, send customer messages, toggle flags, reject KYC, or
deploy. They only create an `agent_approvals` row (a Propose). The **executor lives in the
server** and runs only when the founder clicks **Approve** in `/admin/agents` under a 2FA
admin session (`agents.approve`, super only).

- The executor runs **only the exact payload that was approved**, keyed by an idempotency key.
  If the payload changed after approval, it refuses and demands re-approval.
- It calls the **existing gates**, never a new path around them:
  - CRM send → `services/crm/sendGate.js` (respects `crm_admin_sends`, do-not-contact, unsubscribes, quiet hours, the 48-hour `touchGovernor`).
  - Refund → the existing `refund/execute` finance endpoint.
  - Payout → the existing payout approve/release flow.
  - Flag toggle → the existing feature-flag admin path.
- Tests prove every P action throws without a valid approval ID.

## Shared tables (one additive migration)

RLS on, no policy, service-role only; code keeps a schema-fallback (SELECT/INSERT destructure)
until the migration is confirmed on every database, per `CLAUDE.md`.

| Table | Purpose |
|---|---|
| `agent_tokens` | agent, token_hash, scopes (endpoint allow-list), revoked_at, last_used_at. |
| `agent_tasks` | §2.5 hand-off: id, from_agent, to_agent, priority (P0/P1/P2), due_at, context, ask, done_when, status (open/in_progress/blocked/done/cancelled), links jsonb, parent_id. |
| `agent_approvals` | the approval queue: id (= the approval ID), agent, action_type, payload jsonb (the exact thing to do), recommendation, status (pending/approved/rejected/executed), decided_by, decided_at, executed_at, idempotency_key. |
| `agent_actions` | §2.6 log and cost ledger: ts, agent, action, target, result, approval_id, model, tokens_in, tokens_out, cost_inr. |
| `agent_memory` | agent, kind (decision/issue/contact/open_task), body, refs jsonb (IDs only, no PII), expires_at. |
| `agent_digests` | §2.7 daily digests, one row per agent per day. |

## Cost control (budget ₹5,000/month, all agents)

- The runner checks **month-to-date spend** (summed from `agent_actions.cost_inr`) before each
  run and **stops** if the agent's share of ₹5,000 is spent.
- After each run it posts the Claude Code result's `total_cost_usd` and token counts to
  `agent_actions` (converted to INR).
- `/admin/agents` shows spend per agent against the cap.
- Model choice per agent is set in each agent doc (Haiku for routine classification/triage,
  Sonnet for briefs and analysis). This also gives the existing Tithi bot cost visibility once
  usage logging is added to `services/ai/anthropicClient.js`.

## Permissions and audit
- New admin permission keys: `agents.view` (operations+), `agents.approve` (super only).
- Approver list is a small table/config so a CA (ARTHA) or CS (compliance) can be added later
  without code changes — pending the §12 founder answer.
- Every agent API call and every executor action writes to `admin_audit_logs` via the existing
  `audit()` helper.

## The founder console: `/admin/agents`
- Approval queue (each item: the proposing agent, the action, the exact payload, SUTRA's
  recommendation, Approve / Reject).
- Task log (the live hand-offs).
- Daily digests and the morning brief.
- Spend per agent vs the ₹5,000 cap.
- Built with the design system (`.mt-card`, tokens from `client/src/styles/brand.css`).
- Email: when SUTRA posts the brief, the server sends it plus an "n approvals waiting" line to
  `SUPER_ADMIN_EMAIL` via the existing `sendEmail`.

## What already exists and is reused (not rebuilt)
- Scheduling: `SCHEDULED_JOBS` in `server/server.js`, `utils/jobRunner.js` (`job_runs`), `utils/jobLock.js`.
- Headless Claude Code pattern: `scripts/blog-autopost.ps1`, `server/scripts/replyRadar.js`.
- Admin door + RBAC: `/backstage`, `middleware/adminMiddleware.js` `requireAdmin(perm)`, `lib/adminPermissions.js`, 2FA (`admin2faService.js`).
- Flags: `services/featureFlags.js` (60s cache, fail-closed keys), `config/featureRegistry.js`.
- Audit: `services/auditService.js` → `admin_audit_logs`.
- AI wrapper: `services/ai/anthropicClient.js`; call-count cap `lib/botBudget.js` (extended here with token/cost logging).
- Notify: `utils/sendEmail.js`, `services/notificationEngine.js`, AiSensy.

## What is net-new (justified)
- The six `agent_*` tables + `agent_tokens` — nothing today is a generic task/approval/run log.
- `/api/agents/*` + per-agent tokens — the scoped read/write wall.
- The approval executor — the single audited path to P actions.
- `/admin/agents` console.
- Token/cost logging inside `anthropicClient`.
- The runner `scripts/agents/run-agent.ps1`.
