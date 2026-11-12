# Tithi — Community First-Responder: Design & Plan

> **Goal (final):** Tithi is the **first responder to every genuine problem/question
> asked in the community** — how-to, feature, troubleshooting, onboarding, pricing,
> and competitor-comparison questions — answering fast, grounded, and honest, while
> **staying silent on everything that isn't a question for us** so she never burns
> tokens (or trust) on noise.
>
> **Approach:** improve the infrastructure that already exists (the 3-minute reply
> sweep + `botService.askBot`), add a **cheapest-first relevance gate** and a
> **pitch path**. No rebuild. Not yet approved for build — this is the design.

---

## 1. What already exists (and we reuse)

| Piece | File | Reused as |
|---|---|---|
| Reply sweep (cron, every 3 min, 20 recent posts, 12h age cap, dedup) | `server/services/community/tithiWorker.js:130` (`runReplySweep`) | The driver — unchanged shape |
| One-reply-per-post, grounds via `askBot`, escalates + tags human | `server/services/community/tithi.js:387` (`replyToPost`) | The reply unit — we add a gate in front |
| Full support ladder (sensitive routing, pricing, FAQ, hybrid RAG, grounded Haiku, escalate) | `server/services/botService.js` (`askBot`) | The answer engine — unchanged |
| Global model budget (60/min, 5000/day, fails open) | `server/lib/botBudget.js` | Cost ceiling — reused by the gate's classifier |
| Escalation (bot_escalations + team email + in-thread @mention) | `server/services/bot/escalationService.js`, `tithi.js:362` (`escalateToTeam`) | Human handoff — unchanged |
| Semantic cache (≥0.93 cosine → no model call) | `botService.js` `match_semantic_cache` | Free repeat-answers across community + widget |

**Flag `community_tithi` is ON in prod.** The sweep already runs; today it replies
to **every** non-self, visible, un-replied post — which is the token problem we're
fixing.

---

## 2. The gap vs the goal

| # | Gap today | Needed |
|---|---|---|
| G1 | Sweep replies to **every** eligible post → a model call per post | A **relevance gate** so only genuine questions spend the expensive call |
| G2 | No **pitch** path — `askBot` is support-only, deliberately non-salesy | On **comparison/evaluation** intent, answer honestly **+ right CTA link** |
| G3 | Dedup only checks **Tithi's own** prior comment | Also **stay silent when a human/member already answered** (don't talk over them) |
| G4 | On "can't ground it," the reply uses the **support handoff** line | Use the agreed honest community line: *"not sure that's live yet — flagging to the team"* + escalate |
| G5 | Posts only | Phase 2: **comments-as-questions** (questions asked inside threads) |
| G6 | No visibility into gate decisions | Log answered / skipped / escalated + reason, for tuning |

---

## 3. Design — the relevance gate (cheapest-first)

The whole token strategy is **spend nothing until a post has earned the next tier.**
Run per post, in `replyToPost`, before any grounded call:

### Tier 0 — free pre-filters (no model, no network)
Skip (return `{skipped:<reason>}`) when any holds:
- flag off / no identity / not visible / **Tithi already replied** *(exists)*
- **a non-Tithi comment already exists** → a human/member is handling it *(G3, new)*
- post older than `SWEEP_MAX_AGE_MS` (12h) *(exists in worker)*
- **no question/problem shape** *(new)*: body has no `?` **and** no question word
  (`how|what|why|can|does|is|where|when|which|should|able to`) **and** no problem
  word (`not working|doesn't|isn't|can't|cannot|issue|error|stuck|help|fails?|
  broken|unable`). Kills announcements, "just shipped my page!", pure opinion,
  one-liners — the bulk of a build-in-public feed — for **zero tokens**.
- **per-author / day cap** and **per-sweep cap** exceeded *(new)*

### Tier 1 — tiny classifier (Haiku, budget-gated, ~1-token output)
Only for posts that pass Tier 0. One cheap call via a forced tool returning:
```
{ answerable: boolean, route: 'support' | 'comparison' | 'feature' | 'not_for_us' }
```
- System prompt is tight; input is the (truncated) post body; output is a few
  tokens. `botBudget.tryConsume()` gates it; on budget-exhausted or error it
  **fails safe to skip** (no reply) rather than spend the big call.
- `not_for_us` (member-to-member chatter, showcase, off-topic, opinion) → **silent**.
- The classifier's one job the support ladder can't do: **decide silence**, and
  tag **comparison** intent for the pitch path.

### Tier 2 — grounded answer (the only expensive step)
Route the survivors:
- **support** → `askBot({question, audience})` *(exists)* → grounded answer.
- **comparison** → `askBot(...)` grounded answer **+ CTA** from an intent→link map
  (pitch mode, §4). Honesty preserved: the *answer* is still grounded (no invented
  features); the CTA is additive.
- **feature** (asks about a capability) → `askBot(...)`. If it grounds → answer. If
  it **escalates** (KB doesn't cover it) → post the honest line
  *"Not sure that's live yet — flagging it to the team so someone can confirm."*
  **+ escalate** *(G4)*.
- **sensitive / money / account** → `askBot` already escalates internally → honest
  community line + `escalateToTeam` + human @mention *(exists)*.

**Cost per sweep:** Tier 0 removes most posts for free; Tier 1 spends a tiny classify
on the handful that look like questions; Tier 2 spends the full grounded call only on
confirmed questions — and the **semantic cache** serves repeats with no call at all.

---

## 4. Pitch mode (comparison / evaluation)

When route = `comparison` (e.g. *"can Meeticulous do recurring bookings like
Calendly?"*):
1. Grounded answer from `askBot` — states only what Meeticulous **actually** does;
   "not yet" stays honest via `whats-not-supported-yet.md`.
2. Append **one** CTA from a small, curated map (starter — refine together):

| Intent / topic | CTA link |
|---|---|
| pricing / "is it cheaper" / plans | `/pricing` |
| switching / "should I move from X" | `/login-as-vendor` (start as host) |
| a specific supported feature | the relevant feature/help page |
| general "is it for me" | `/` or `/pricing` |

Pitch is **only** on comparison/evaluation intent — plain support answers stay
link-light (a single inline doc link at most, as today). *(This is my recommended
default; override if you want a soft CTA on every answer.)*

**Guardrail:** pitch never changes the grounded answer. No overclaiming; the CTA is a
link, not a promise. `sanitizeAnswer`'s external-link stripping still applies, so only
internal `/...` links survive.

---

## 5. Infrastructure changes (file by file — minimal surface)

| Change | Where | Type |
|---|---|---|
| `communityGate(post, {recentCountForAuthor})` → `{decision:'skip'|'support'|'comparison'|'feature', reason}` (Tier 0 heuristics + Tier 1 classify) | **new** `server/services/community/replyGate.js` | New module |
| Call the gate first; branch to answer / pitch / honest-escalate; skip on `skip` | `server/services/community/tithi.js` `replyToPost` | Edit (~20 lines) |
| "Human already answered" check (non-Tithi comment exists) | `server/services/community/store.js` (+ gate) | Small query |
| CTA map + `appendCta(answer, route, topic)` | `replyGate.js` or `tithi.js` | New, small |
| Honest community escalate line (replace support `HANDOFF` for community) | `tithi.js` | 1 constant |
| Per-sweep cap + per-author/day cap | `tithiWorker.js` `runReplySweep` | Small |
| Gate-decision logging (answered/skipped/escalated + reason) | reuse `knowledge_gaps` / a counter | Small |
| Env flags: `COMMUNITY_REPLY_GATE_ENABLED`, `COMMUNITY_REPLY_MAX_PER_SWEEP`, `COMMUNITY_REPLY_MAX_PER_AUTHOR_DAY` | `.env.example` + registry | Config |

**No DB migration required for MVP** (reuses existing tables). Phase 2 (comments) may
add a sweep over `community_comments`.

---

## 6. Phases

- **Phase 1 (MVP) — posts, gated.** Tier 0 + Tier 1 gate, support + comparison + feature
  routes, honest escalate, human-already-answered skip, caps, logging. Ships behind
  `COMMUNITY_REPLY_GATE_ENABLED` (OFF → current behavior; ON → gated first-responder).
- **Phase 2 — comments as questions.** Sweep top-level comments that are questions
  (same gate), so a question buried in a thread also gets Tithi.
- **Phase 3 — tune.** Read the gate logs; adjust heuristics/thresholds/CTA map;
  consider promoting good comparison answers into the help KB / FAQ.

---

## 7. Decisions needed from you

1. **MVP scope** = posts only, comments in Phase 2? *(recommended)*
2. **Pitch** = only on comparison/evaluation intent, or a soft CTA on **every**
   answer? *(recommended: comparison only)*
3. **Human already answered** → Tithi stays **silent**? *(recommended: yes)*
4. **Caps** — defaults: ≤5 replies per sweep, ≤1 per author per 12h, plus the global
   `botBudget`. OK, or different numbers?
5. **Classifier model** = Haiku, tiny output, budget-gated, fail-safe-to-silent? *(recommended)*

---

## 8. Test plan (when we build)

- Unit: `replyGate` Tier 0 heuristic (question vs announcement vs showcase), route
  mapping, CTA append, caps, human-already-answered skip — assert-based, no live model.
- Unit: `replyToPost` branches (support / comparison / feature-escalate / silent) with
  `askBot` mocked.
- Reuse the audit's 36-query battery as gate fixtures (answerable vs not).
- Manual: a dry-run mode that logs decisions without posting, run over the 201 existing
  posts, to see what she *would* answer before going live.

---

## 9. Risks & mitigations

- **Over-answering / spam** → caps + human-already-answered skip + OFF-by-default flag
  + dry-run first.
- **Wrong silence (misses a real question)** → log skips with reason; dry-run tuning.
- **Pitch feels shill-y** → comparison-only, one CTA, grounded answer unchanged.
- **Feature overclaim** → grounding + honest "flagging to team" on uncovered features.
- **Cost spike** → Tier 0 free filter + budget-gated classify + cache + caps.

---

*Builds on the audit at `docs/tithi-audit.md`. No product code changes until this is
approved.*
