# Bolt 958 — cost breaker (rotating-IP abuse) — design

**Date:** 2026-07-19
**Branch:** `feat/bolt-abuse-hardening`
**Status:** approved design, ready for implementation plan

## Problem

The bot's `/api/bot/ask` and `/api/bot/ask/stream` are public and unauthenticated.
The only rate controls today are **per-IP**: `botLimiter` (20/min/IP) plus the
existing IP auto-ban after repeated 429s. An attacker rotating IPs (proxy pool /
botnet) bypasses both entirely. Every request that reaches the model path costs a
Claude Haiku call plus a Voyage embedding plus DB work, so rotating-IP volume
translates directly into token spend and DB/CPU load.

There is **no user-controllable edge** on the API today: `meeticulous-api.onrender.com`
sits behind *Render's managed* Cloudflare (`x-render-origin-server: Render`), which
we cannot configure (no WAF/Turnstile/rate rules). Edge protection is a separate
follow-up (see `2026-07-19-bot-edge-hardening-plan.md`); this spec is the
app-level defense that ships now.

## Goal

Make bot spend **unconditionally bounded** regardless of how many IPs attack — a
guaranteed floor under cost that holds even if/when an edge layer is misconfigured
or bypassed. Keep the bot fully responsive for real (low-volume) support traffic.

**Non-goals:** stopping the attacker at the door (that's the edge layer); per-question
cost accounting; an admin budget dashboard; dynamic auto-tuning. YAGNI until real
traffic proves the flat budget too blunt.

## Design (approach C: model-call budget + global request cap)

Two independent layers. The budget is the precise wallet control; the global cap is
a cheap volumetric backstop.

### 1. Model-call budget breaker — the wallet floor

New module `server/lib/botBudget.js`:

```
tryConsume() -> { allowed: boolean, reason: 'minute' | 'day' | null }
```

- Maintains two fixed-window counters in the shared rate-limit store: **per-minute**
  (burst control) and **per-day** (hard ceiling). `tryConsume()` increments both and
  returns `allowed:false` with the tripped `reason` if either is over its limit.
  (Fixed windows reset at the boundary — up to ~2× a limit can pass across a
  boundary, negligible for a generous cost ceiling; a true sliding window isn't
  worth the complexity here.)
- Limits from env, tunable defaults:
  - `BOT_MODEL_CALLS_PER_MIN` = 60
  - `BOT_MODEL_CALLS_PER_DAY` = 5000
  - Support-widget traffic is low; these cap a runaway without touching legitimate
    use. They are guesses to calibrate against real traffic — see Rollout.
- Called **only at the model-call step**, after every free short-circuit
  (non-Latin guard → smalltalk → FAQ → semantic cache). Cache hits, greetings, and
  rejected input never spend budget; only a novel question that needs a fresh model
  call does.
- **Over budget:** do not call the model. Return a graceful reply:
  > "Bolt's getting a lot of questions right now — please try again in a little
  > while, or browse the help center at /help/docs."
  with `escalate:false`, `source:'over_budget'`, `cited_sources:[]`. In the streaming
  path the same text is emitted as a single `delta` then `done`.
- **Never escalates.** Escalation emails support; under attack that would flood the
  support inbox. Over-budget degrades silently and points the (possibly real) user
  to the help center.
- **Store error → fail-open** (log + allow). The global cap and per-IP limiter still
  bound volume; a wallet guard must not take the bot down over a transient store
  blip. (Logged so a persistent store outage is visible.)

### 2. Global request cap — the volumetric backstop

`botGlobalLimiter` in `server/middleware/security.js`: an `express-rate-limit`
instance with a **constant key** (single global bucket, not per-IP):

- `keyGenerator: () => 'bot-global'`
- `BOT_GLOBAL_MAX_PER_MIN` = 300, `windowMs` = 60s
- `store: makeRateLimitStore('bot-global')`
- 429 with the same "high demand, try again shortly" message.

Mounted on `/ask` and `/ask/stream` **alongside** the existing per-IP `botLimiter`.
Caps total request volume across all IPs → bounds DB/CPU and Voyage-embed load even
from rotating IPs, before any handler logic runs. Global max (300/min) is set above
the model-call budget (60/min) because most requests are free (cache/smalltalk/guard);
the model budget is the tighter control on the expensive path.

### 3. Wiring & reuse

- Reuses `server/middleware/rateLimitStore.js` (`makeRateLimitStore`) — Redis when
  `RATE_LIMIT_STORE_URL` is set, else in-memory.
- **Ceiling:** `RATE_LIMIT_STORE_URL` is unset today → in-memory, so the global
  budget is **per-instance**. Fine on single-instance free Render. If the service
  scales to multiple instances, set `RATE_LIMIT_STORE_URL` (Redis is already
  provisioned via `REDIS_URL`) so the budget is genuinely global. `botBudget` uses
  the same store abstraction so it inherits this behaviour.
- Touch points:
  - **new** `server/lib/botBudget.js`
  - `server/middleware/security.js` — add `botGlobalLimiter`, export it
  - `server/routes/botRoutes.js` — add `botGlobalLimiter` before `ask`/`askStream`
  - `server/services/botService.js` — budget gate immediately before the model call
    in both `askBot` and `askBotStream`; new `source: 'over_budget'` and an
    `OVER_BUDGET_MSG` constant (mirrors `UNSUPPORTED_INPUT_MSG`).

## Data flow

```
POST /ask(/stream)
  → botGlobalLimiter (global/min)        [429 if over]
  → botLimiter (per-IP/min)              [429 if over]
  → askBot / askBotStream
      → non-Latin guard        (free)    [→ rephrase msg]
      → smalltalk              (free)     [→ greeting]
      → FAQ                    (free)     [→ faq answer]
      → embed query + semantic cache      [cache hit → free answer]
      → retrieval (DB)                    [no chunks / sensitive → escalate]
      → botBudget.tryConsume()  ← GATE    [over → over_budget msg, NO model call]
      → model call (Haiku)      (costs)   [→ grounded answer]
```

## Configuration

| Env | Default | Meaning |
|---|---|---|
| `BOT_MODEL_CALLS_PER_MIN` | 60 | Max fresh model calls per rolling minute |
| `BOT_MODEL_CALLS_PER_DAY` | 5000 | Max fresh model calls per rolling day (wallet ceiling) |
| `BOT_GLOBAL_MAX_PER_MIN` | 300 | Max total `/ask(/stream)` requests/min across all IPs |
| `RATE_LIMIT_STORE_URL` | unset | If set (Redis), counters are cross-instance; else per-instance |

## Failure modes

- **Store unreachable** → `tryConsume` fails open (allow + log); global cap still
  bounds volume.
- **Over budget during a real traffic spike** → real users get the graceful message
  + help-center link, not an error and not a support email. Tune the limits up if
  this happens in normal operation.
- **Multi-instance without Redis** → each instance enforces its own budget; effective
  ceiling = limit × instance count. Documented; fix by setting `RATE_LIMIT_STORE_URL`.

## Observability

- `console.warn('[bot] model budget exceeded', { reason })` when the gate trips.
- (Future, not in this spec) surface an over-budget counter in the existing SIE
  admin console.

## Testing

- `botBudget` unit test (injectable limits, no real-clock dependency): consume up to
  the limit → `allowed:true`; the next → `allowed:false` with the right `reason`;
  window rollover resets the counter.
- `botService` unit test: with `botBudget.tryConsume` mocked to deny, a groundable
  question returns the `over_budget` reply with `source:'over_budget'` and the model
  is **not** called; free paths (smalltalk/guard/cache) still bypass the gate.

## Rollout & tuning

- Defaults are deliberately generous. After deploy, watch normal traffic for a few
  days; if legitimate use never approaches the limits, tighten them. If a real spike
  trips them, raise them. All knobs are env vars — no redeploy needed to retune on
  Render.
- Ships as a normal server change (Render deploy). No migration, no reseed.

## Out of scope → separate doc

Edge/Cloudflare bot protection (the actual rotating-IP wall) is
`2026-07-19-bot-edge-hardening-plan.md`. This app-level breaker is the floor that
holds regardless of whether/when the edge lands.
