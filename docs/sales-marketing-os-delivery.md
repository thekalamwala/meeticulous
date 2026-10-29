# Sales + Marketing OS — Delivery & Go-Live

Built from the 2026-08-23 audit. Turns the dormant CRM (203 leads frozen in `new`,
1 message ever sent) into a working one-person growth engine. **14 PRs**, each
isolated, tested, migrations verified on staging.

> **All PRs are open and NOT merged.** Merging auto-deploys to prod; the switch that
> starts real WhatsApp/email is a deliberate final step. Follow the order below.

---

## What was built (14 PRs)

| PR | Title | Base | Migration | Notes |
|----|-------|------|-----------|-------|
| [#711](https://github.com/bookasloth/book-a-sloth/pull/711) | P0 spec (5 stacked PRs) | main | — | doc only |
| [#712](https://github.com/bookasloth/book-a-sloth/pull/712) | P0-1 real-time lead creation | main | — | signup / booking / enterprise → `upsertLead` |
| [#713](https://github.com/bookasloth/book-a-sloth/pull/713) | P0-2 frequency cap + quiet hours | main | — | automated sends only; the missing safeguard |
| [#714](https://github.com/bookasloth/book-a-sloth/pull/714) | P0-3 persist score/intent | main | **v3.112** | `leads.score/intent/next_action` |
| [#715](https://github.com/bookasloth/book-a-sloth/pull/715) | P0-4 lifecycle engine | #714 | — | 15-min cron: score→stage→next action→enrol/task |
| [#717](https://github.com/bookasloth/book-a-sloth/pull/717) | seed nurture sequences | main | — | 3 email sequences active, New-Lead inactive |
| [#718](https://github.com/bookasloth/book-a-sloth/pull/718) | P1a Sales Desk backend | #714 | **v3.113** | `GET /admin/crm/desk`, `leads.last_reply_at` |
| [#720](https://github.com/bookasloth/book-a-sloth/pull/720) | P1b Sales Desk UI | #718 | — | `/admin/sales` → 5-queue desk |
| [#721](https://github.com/bookasloth/book-a-sloth/pull/721) | P1c desk card actions | #720 | — | snooze / nurture / won / lost |
| [#722](https://github.com/bookasloth/book-a-sloth/pull/722) | leads → contacts sync | main | — | marketing can reach CRM leads |
| [#723](https://github.com/bookasloth/book-a-sloth/pull/723) | sequence builder UI + enrol | main | — | wires the dead sequence APIs |
| [#724](https://github.com/bookasloth/book-a-sloth/pull/724) | intent-event sink | main | **v3.114** | identified intent → `lead_events` → score |
| [#725](https://github.com/bookasloth/book-a-sloth/pull/725) | bulk WhatsApp/email/enrol | main | — | multi-select send, gated + capped |
| — | PR-5 flip `crm_admin_sends` | — | — | config, not a PR — see runbook |

Migrations applied on **staging (Tokyo)**; **prod (Mumbai) pending** (steps below).

## Dependency graph
```
main ── 712 · 713 · 717 · 722 · 723 · 724 · 725   (independent, any order)
714 ─┬─ 715
     └─ 718 ── 720 ── 721
```
Only the `714 → {715, 718→720→721}` chain is ordered. Everything else is independent off `main`.

---

## Go-live sequence

Each merge auto-deploys. Run the prod migration **before** merging the code that reads its columns (code has schema fallbacks, so a small gap is safe, but this is the clean order).

**1. Independent PRs** (any order): #712, #713, #717, #722, #723, #725.

**2. Score/intent columns**
- Merge **#714**.
- Run **`v3.112`** on prod (Mumbai `ayjhlwyzszykqtnaktpb`): `server/migrations/v3.112_lead_scoring.sql`.

**3. Lifecycle engine** — merge **#715**.
- First deploy: set `LIFECYCLE_ENGINE_DRYRUN=true` on Render, watch one cycle's logs, then remove the env so it writes.

**4. Sales Desk**
- Merge **#718**; run **`v3.113`** on prod (`v3.113_lead_last_reply.sql`).
- Merge **#720**, then **#721**.

**5. Intent sink** — merge **#724**; run **`v3.114`** on prod (`v3.114_lead_events.sql`).

**6. Seed sequences** — run on **both** DBs: `node server/scripts/seedLifecycleSequences.js`.

**7. Turn sends ON** — flip `crm_admin_sends` per the PR-5 runbook. **Do this last, deliberately** — it starts real WhatsApp/email to real leads. Preconditions: #713 live (cap), engine dry-run looked sane, migrations applied, AiSensy key active. Instant rollback = flip OFF.

### Prod migrations to run (all additive, verified on staging)
```
v3.112_lead_scoring.sql      # leads.score / intent / next_action / next_action_at
v3.113_lead_last_reply.sql   # leads.last_reply_at
v3.114_lead_events.sql       # lead_events table
```

---

## The engine, end to end
```
signup / booking / enterprise / newsletter → auto lead (+ intent events feed the score)
   → lifecycle engine: score → advance stage → set next action → enrol nurture / open sales task
   → Sales Desk (Needs Attention · Replies · Follow-ups · High Intent · Activation)
   → human works replies + high-intent, one-click disposition
   → sends (single / sequence / bulk) gated by kill-switch + DNC + opt-out + 1-per-48h cap + quiet hours
   → marketing broadcasts reach the same leads (contacts sync)
```

## Verification limits (honest)
- Admin screens aren't previewable headlessly → UI PRs verified by vitest + production build, not live screenshots.
- Signup/booking hooks verified by unit tests + fail-soft design; first real signup after merge is the live proof.
- Migrations verified on staging; prod runs pending per the sequence above.
- All PRs authored in isolated git worktrees (a concurrent local session held the shared branch throughout).

## Deferred (not built — future)
- Anonymous top-of-funnel intent resolution (stays with PostHog).
- Per-step WhatsApp variable mapping for sequences (email carries personalisation today).
- WhatsApp version of "New Lead nurture" (needs approved AiSensy templates).
