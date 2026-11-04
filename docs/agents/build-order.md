# Build order

Build one agent at a time, in this order (spec §12). SUTRA first because it is the founder
interface and carries the shared foundation; then the agents that protect customers and
uptime; then money and trust; then growth.

Before an agent is "built", for each one build: a system prompt (its doc + README §2), a
`tools:` allowlist matching its permissions, its agent-API token scope, its memory + the
shared task log, its daily digest + schedule, and tests (or a dry-run mode) that prove its
level-P actions can't execute without an approval ID.

| # | Agent | Why here | What "built" means |
|---|---|---|---|
| 1 | [SUTRA](sutra.md) | Founder interface; carries the shared foundation | Foundation tables + `/api/agents/*` + tokens; `/admin/agents` console (queue, task log, digests, cost); runner script; daily brief 08:30 IST + weekly review Mon 09:00 IST; founder chat. Seeds `product-facts.md` + `brand-voice.md` (DRAFT). |
| 2 | [SEVA](seva.md) | Protects customers | Ticket triage on support chat + `bot_escalations`; one-to-one reply drafts (A); tagging; weekly top-10; help-doc PRs. |
| 3 | [YANTRA](yantra.md) | Protects uptime | Daily runtime-error / failed-job check (Render, Vercel, Supabase, `job_runs`); bug triage → PRs. |
| 4 | [SATYA](satya.md) | Trust | KYC queue review; Route activation-status checks; stalled-host list (3+ days); nudges via approved templates. |
| 5 | [ARTHA](artha.md) | Money | Daily settlement reconciliation; payout due-vs-released; weekly snapshot; monthly close pack; compliance calendar; vendor spend. |
| 6 | [LABH](labh.md) | Revenue | Follow-up queue; inbound replies; pipeline report; sequence review. Sends only via `sendGate`. |
| 7 | [VANI](vani.md) | Growth | Weekly GSC report; content calendar into the blog pipeline; one page-improvement PR/week. |
| 8 | [DISHA](disha.md) | Direction | Roadmap doc; specs; changelog + facts-file update per release; monthly funnel review. |

Each agent is one branch from `origin/main` → one PR against the open `release/YYYY-MM`.
Stop at the PR. The founder merges.
