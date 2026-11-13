# Tithi — launch checklist

The sequence to take today's Tithi work from `release/2026-11` to live. Everything ships
**OFF behind flags**, so merging/deploying changes nothing until a flag is flipped. Do the
steps in order; each flag is independent, so you can flip them one at a time.

## What's shipping (3 PRs on the release train)

| PR | What | Flag(s) | Migration |
|----|------|---------|-----------|
| #303 | Community first-responder voice: plain-text replies, no volunteered limitations, feature CTA | `COMMUNITY_REPLY_GATE_ENABLED` (env) | — |
| #306 | KB grounding fixes: reminders tier contradiction + Pro price → ₹235/₹1,179 | — | — |
| #307 | Agent tool-loop (Slices 1-5): reads, confirm-gated email writes, safe cancel link, eval harness, proactive in-app nudges | `bot_tool_loop`, `tithi_proactive` | v3.207, v3.208 |

Nothing here is in prod yet. All three are unmerged on `release/2026-11`.

## Step 1 — Run the agent eval (before `bot_tool_loop`)

The unit tests mock the model; this is the only check of the **real** model's behaviour
(right tool, previews writes instead of self-confirming, routes cancels to the secure link).
Read-only — it inspects the model's first response and executes no tool (no email, no change).

```bash
cd server && node scripts/botToolLoopEval.js
```

Needs `ANTHROPIC_API_KEY` in `server/.env`. Expect all cases PASS. Pay attention to:
- every `send_cancel_link` / `resend_*` case shows `confirmed=false` (never self-confirmed),
- the cancel cases pick `send_cancel_link` (never a bot-side refund),
- the reschedule + dispute cases execute no write.

Spot-check a couple of real support threads by hand too.

## Step 2 — Ship the release train

```bash
/ship-release
```

Merges `release/2026-11` → `main` in one commit; Vercel + Render deploy. `reseed-bot-kb.yml`
auto-fires on the `docs/help/**` change, so #306's corrected KB lands in Tithi's knowledge base.

## Step 3 — Apply the pending migrations (both OFF-flag seeds)

Both are additive `feature_flags` inserts that seed the flag **OFF** (`ON CONFLICT DO NOTHING`).
Not required for safety — the flags read OFF without the row (FAIL_CLOSED_KEYS + registry) — but
apply them so the admin toggle rows exist.

- `server/migrations/v3.207_bot_tool_loop_flag.sql`
- `server/migrations/v3.208_tithi_proactive_flag.sql`

Apply on the Meeticulous DB (`spquowzrefozmrzoszkf`).

## Step 4 — Flip flags, one at a time, each after its own check

| Flag | Where | Flip after |
|------|-------|-----------|
| `COMMUNITY_REPLY_GATE_ENABLED=true` | Render env (`meeticulous-api`) | the dry-run `server/scripts/tithiReplyDryRun.js` looks right |
| `bot_tool_loop` | feature_flags (admin) | Step 1 eval passes + a manual spot-check |
| `tithi_proactive` | feature_flags (admin) | you've decided it won't double up with the email/WhatsApp `activation_nudges` (they cover KYC/service/payout too — keep one channel per blocker, or stagger) |

## Safety notes / what the agent will NOT do

- Authenticated **support thread only** — the public help widget never reaches the tools.
- Own-booking only (server-side lookup, never a client-supplied id).
- **No money movement by the bot:** cancel/refund and reschedule-with-fee are handed to the
  user's secure self-service page; the bot only emails the link + states the refund tier.
- Writes (`resend_*`) are email-only + idempotent, and confirm-gated (preview → the user says yes).
- Money disputes (fraud / double-charge) still escalate to a human.
- Proactive nudges are **in-app only**, deduped per host per blocker, quiet-hours 09-20 IST.

## Fast-follows (not blocking launch)

- Wire `resolveInApp` to the fix events (KYC approved, service added) so a proactive nudge
  self-clears the moment the host resolves it.
- Index community posts + resolved tickets into retrieval (she can't yet cite a prior answer).
- Decide the `activation_nudges` ↔ `tithi_proactive` channel split for KYC/service/payout.

## Off switches

- Agent: `UPDATE feature_flags SET enabled=false WHERE key='bot_tool_loop';`
- Proactive: `UPDATE feature_flags SET enabled=false WHERE key='tithi_proactive';`
- Community voice gate: `COMMUNITY_REPLY_GATE_ENABLED=false` on Render (reverts to legacy reply-to-all).

Flag reads are cached ~60s, so an off-switch is effective within a minute.
