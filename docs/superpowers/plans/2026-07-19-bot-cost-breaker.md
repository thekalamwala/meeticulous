# Bot Cost Breaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound the bot's Claude-Haiku spend regardless of how many IPs attack, by capping actual model calls (per-minute + per-day) and total request volume (global/min).

**Architecture:** A `botBudget` module counts real model calls in rolling minute/day windows and is checked at the model-call step in `askBot`/`askBotStream` — after every free short-circuit (guard, smalltalk, FAQ, semantic cache), so only novel questions spend budget; over budget serves a graceful "busy" reply that never escalates. A separate constant-key `botGlobalLimiter` caps total `/ask(/stream)` requests across all IPs as a cheap volumetric backstop.

**Tech Stack:** Node/Express 4, `express-rate-limit` v7, existing `makeRateLimitStore` (Postgres when `RATE_LIMIT_STORE_URL` set, else in-memory), Jest.

## Global Constraints

- Server runtime only (`Date.now()` is allowed here; this is not a workflow script).
- Reuse `server/middleware/rateLimitStore.js` `makeRateLimitStore(prefix)`; when it returns `undefined` (store unset), fall back to an in-memory counter.
- **Fail-open:** any budget/store error must allow the request (log it) — a cost guard must not take the bot down on a store blip.
- **Over-budget replies NEVER escalate** (`escalate:false`, no support email) — an attack must not flood support.
- Free paths (non-Latin guard, smalltalk, FAQ, semantic cache) must NOT spend budget.
- Limits are env-tunable at runtime without redeploy — read `process.env` at call time (function form), never cache at module load.
- Defaults, verbatim: `BOT_MODEL_CALLS_PER_MIN=60`, `BOT_MODEL_CALLS_PER_DAY=5000`, `BOT_GLOBAL_MAX_PER_MIN=300`.
- New answer `source` value: `'over_budget'`. New message constant: `OVER_BUDGET_MSG`.

---

### Task 1: `botBudget` model-call budget module

**Files:**
- Create: `server/lib/botBudget.js`
- Test: `server/tests/unit/botBudget.test.js`

**Interfaces:**
- Consumes: `makeRateLimitStore` from `server/middleware/rateLimitStore.js`.
- Produces: `tryConsume() -> Promise<{ allowed: boolean, reason: 'minute' | 'day' | null }>` and test-only `_reset()`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/botBudget.test.js`:

```javascript
// botBudget: caps model calls per rolling minute + day. RATE_LIMIT_STORE_URL is
// unset in tests, so the in-memory counter path is exercised.
const budget = require('../../lib/botBudget');

beforeEach(() => {
  delete process.env.BOT_MODEL_CALLS_PER_MIN;
  delete process.env.BOT_MODEL_CALLS_PER_DAY;
  budget._reset();
});

test('allows up to the per-minute limit, then denies with reason "minute"', async () => {
  process.env.BOT_MODEL_CALLS_PER_MIN = '2';
  budget._reset();
  expect((await budget.tryConsume()).allowed).toBe(true);
  expect((await budget.tryConsume()).allowed).toBe(true);
  const third = await budget.tryConsume();
  expect(third.allowed).toBe(false);
  expect(third.reason).toBe('minute');
});

test('denies with reason "day" when the daily ceiling is hit under a high minute limit', async () => {
  process.env.BOT_MODEL_CALLS_PER_MIN = '1000';
  process.env.BOT_MODEL_CALLS_PER_DAY = '2';
  budget._reset();
  expect((await budget.tryConsume()).allowed).toBe(true);
  expect((await budget.tryConsume()).allowed).toBe(true);
  const third = await budget.tryConsume();
  expect(third.allowed).toBe(false);
  expect(third.reason).toBe('day');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/botBudget.test.js`
Expected: FAIL — `Cannot find module '../../lib/botBudget'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/lib/botBudget.js`:

```javascript
'use strict';
// botBudget.js — a GLOBAL budget on the bot's expensive model calls. The per-IP
// botLimiter is defeated by rotating IPs; this caps the actual Claude-Haiku calls
// across all IPs so spend is bounded no matter the attack. Checked at the
// model-call step in botService, AFTER the free short-circuits (guard/smalltalk/
// FAQ/cache), so only novel questions spend budget.
//
// Counters live in the shared rate-limit store when RATE_LIMIT_STORE_URL is set
// (cross-instance); otherwise in-memory per-instance fixed windows — fine on a
// single Render instance. Limits are read from env at call time so they retune
// without a redeploy. Any store error fails OPEN (a cost guard must not break the
// bot); the global request cap still bounds volume.

const { makeRateLimitStore } = require('../middleware/rateLimitStore');

const MIN_WINDOW_MS = 60 * 1000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const minMax = () => num(process.env.BOT_MODEL_CALLS_PER_MIN, 60);
const dayMax = () => num(process.env.BOT_MODEL_CALLS_PER_DAY, 5000);

// Returns an async increment(key) -> { totalHits }. Uses the Postgres store when
// configured, else an in-memory fixed-window counter.
function makeCounter(prefix, windowMs) {
  const store = makeRateLimitStore(prefix); // undefined when RATE_LIMIT_STORE_URL unset
  if (store) {
    store.init({ windowMs });
    return (key) => store.increment(key);
  }
  let hits = 0;
  let resetAt = 0;
  return async () => {
    const now = Date.now();
    if (now >= resetAt) { hits = 0; resetAt = now + windowMs; }
    hits += 1;
    return { totalHits: hits };
  };
}

let _min = makeCounter('bot-budget-min', MIN_WINDOW_MS);
let _day = makeCounter('bot-budget-day', DAY_WINDOW_MS);

// Consume one model call from the budget. Increments minute first (so a sustained
// flood keeps the minute window pegged and stays closed); the day counter only
// advances for calls that pass the minute gate.
async function tryConsume() {
  try {
    const min = await _min('global');
    if (min.totalHits > minMax()) return { allowed: false, reason: 'minute' };
    const day = await _day('global');
    if (day.totalHits > dayMax()) return { allowed: false, reason: 'day' };
    return { allowed: true, reason: null };
  } catch (e) {
    console.error('[bot] budget store error — failing open:', e.message);
    return { allowed: true, reason: null };
  }
}

// test-only: rebuild the in-memory counters between tests.
function _reset() {
  _min = makeCounter('bot-budget-min', MIN_WINDOW_MS);
  _day = makeCounter('bot-budget-day', DAY_WINDOW_MS);
}

module.exports = { tryConsume, _reset };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/botBudget.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/botBudget.js server/tests/unit/botBudget.test.js
git commit -m "feat(bot): model-call budget module (per-min + per-day, fail-open)"
```

---

### Task 2: Global request cap (`botGlobalLimiter`)

**Files:**
- Modify: `server/middleware/security.js` (add limiter near the existing `botLimiter` ~line 275; add to `module.exports`)
- Modify: `server/routes/botRoutes.js` (mount on `/ask` and `/ask/stream`)
- Test: `server/tests/unit/botGlobalLimiter.test.js`

**Interfaces:**
- Consumes: `rateLimit` (express-rate-limit), `makeRateLimitStore`, `skipWhenLoadTest` — all already imported/defined in `security.js`.
- Produces: `botGlobalLimiter` (Express middleware) exported from `security.js`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/botGlobalLimiter.test.js`:

```javascript
// botGlobalLimiter uses a CONSTANT key, so all requests share one bucket
// regardless of IP — this is what bounds volume under IP rotation.
const request = require('supertest');
const express = require('express');
const { botGlobalLimiter } = require('../../middleware/security');

function appWith() {
  const app = express();
  app.post('/t', botGlobalLimiter, (req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => { process.env.BOT_GLOBAL_MAX_PER_MIN = '2'; });
afterEach(() => { delete process.env.BOT_GLOBAL_MAX_PER_MIN; });

test('caps total requests across differing IPs (constant key)', async () => {
  const app = appWith();
  // Different X-Forwarded-For each time — a per-IP limiter would let all through;
  // the global limiter must 429 the 3rd because the key is constant.
  const r1 = await request(app).post('/t').set('X-Forwarded-For', '1.1.1.1');
  const r2 = await request(app).post('/t').set('X-Forwarded-For', '2.2.2.2');
  const r3 = await request(app).post('/t').set('X-Forwarded-For', '3.3.3.3');
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  expect(r3.status).toBe(429);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/botGlobalLimiter.test.js`
Expected: FAIL — `botGlobalLimiter` is `undefined` (not yet exported), so `app.post` throws "Router.use() requires a middleware function".

Note: `supertest` (^6.3.4) is already a devDependency (used by `tests/integration/bot.test.js`) — no install needed.

- [ ] **Step 3: Write minimal implementation**

In `server/middleware/security.js`, immediately after the `botLimiter` definition (the block ending `});` around line 283), add:

```javascript
// Global request cap for the bot — a SINGLE bucket across ALL IPs (constant key),
// so rotating IPs can't bypass it the way they bypass the per-IP botLimiter. This
// bounds total request volume (DB/CPU/embedding load); the model-call budget
// (lib/botBudget.js) is the tighter control on the expensive path. `max` is a
// function so BOT_GLOBAL_MAX_PER_MIN retunes at runtime without a redeploy.
const botGlobalLimiter = rateLimit({
  store: makeRateLimitStore('bot-global'),
  windowMs: 60 * 1000,
  max: () => Number(process.env.BOT_GLOBAL_MAX_PER_MIN) || 300,
  keyGenerator: () => 'bot-global',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bolt is very busy right now. Please try again in a moment.' },
  skip: skipWhenLoadTest,
});
```

Then add `botGlobalLimiter` to the `module.exports` object in that file (alongside `botLimiter`).

In `server/routes/botRoutes.js`, change the import and the two routes:

```javascript
const { ask, askStream, feedback } = require('../controllers/botController');
const { botLimiter, botGlobalLimiter } = require('../middleware/security');

router.post('/ask', botGlobalLimiter, botLimiter, ask);
router.post('/ask/stream', botGlobalLimiter, botLimiter, askStream);
router.post('/feedback', botLimiter, feedback);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/botGlobalLimiter.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/middleware/security.js server/routes/botRoutes.js server/tests/unit/botGlobalLimiter.test.js
git commit -m "feat(bot): global request cap across all IPs (constant-key limiter)"
```

---

### Task 3: Budget gate in `botService` (both paths)

**Files:**
- Modify: `server/services/botService.js` (add `OVER_BUDGET_MSG` + `require botBudget` near the other constants ~line 90-115; gate inside the `canAnswer` block in `askBot` ~line 508 and `askBotStream` ~line 610; add `OVER_BUDGET_MSG` to `module.exports` ~line 693)
- Test: `server/tests/unit/botService.test.js` (append)

**Interfaces:**
- Consumes: `botBudget.tryConsume()` from Task 1.
- Produces: answers with `source: 'over_budget'`; exported `OVER_BUDGET_MSG` string.

- [ ] **Step 1: Write the failing test**

Append to `server/tests/unit/botService.test.js`. First add the mock near the other `jest.mock` calls at the top of the file:

```javascript
jest.mock('../../lib/botBudget', () => ({ tryConsume: jest.fn().mockResolvedValue({ allowed: true, reason: null }) }));
```

Add `botBudget` to the requires and `OVER_BUDGET_MSG` to the botService import:

```javascript
const botBudget = require('../../lib/botBudget');
// ...extend the existing destructure:
// const { askBot, ..., OVER_BUDGET_MSG } = require('../../services/botService');
```

Then add the test:

```javascript
test('over-budget serves the busy message, does not escalate or call the model', async () => {
  sb.__rpc.mockResolvedValue({ data: [chunk()], error: null }); // retrieval finds chunks
  botBudget.tryConsume.mockResolvedValueOnce({ allowed: false, reason: 'minute' });
  const out = await askBot({ question: 'How do I add a service?' });
  expect(out.escalate).toBe(false);
  expect(out.source).toBe('over_budget');
  expect(out.answer).toBe(OVER_BUDGET_MSG);
  expect(out.cited_sources).toEqual([]);
  expect(client.__create).not.toHaveBeenCalled(); // model was NOT called
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/botService.test.js -t "over-budget"`
Expected: FAIL — `OVER_BUDGET_MSG` is `undefined` and the model still gets called (budget not yet wired).

- [ ] **Step 3: Write minimal implementation**

In `server/services/botService.js`, near the `UNSUPPORTED_INPUT_MSG` constant (~line 105), add the require at the top of the file with the other service requires and the message constant:

```javascript
const botBudget = require('../lib/botBudget');

const OVER_BUDGET_MSG =
  "Bolt's getting a lot of questions right now — please try again in a little " +
  'while, or browse the help center at /help/docs.';
```

In `askBot`, replace the `if (canAnswer) {` block (currently starting ~line 508, the one calling `callModel`) so the budget is checked first:

```javascript
  if (canAnswer) {
    const budget = await botBudget.tryConsume();
    if (!budget.allowed) {
      console.warn('[bot] model budget exceeded', { reason: budget.reason });
      escalate = false;
      source = 'over_budget';
      answer = OVER_BUDGET_MSG;
      cited_sources = [];
    } else {
      try {
        const out = await callModel(q, chunks, history);
        if (out && !out.escalate && String(out.answer || '').trim()) {
          escalate = false;
          source = 'model';
          answer = String(out.answer).trim();
          const nums = Array.isArray(out.source_numbers) ? out.source_numbers : [];
          cited_sources = dedupeSources(
            nums.map((n) => chunks[n - 1]).filter(Boolean)
              .map((c) => ({ source_file: c.source_file, heading: c.heading || null }))
          );
          if (!cited_sources.length) cited_sources = sourcesFromChunks(chunks);
          semanticCacheStore(q, queryEmbedding, answer, cited_sources);
        }
      } catch (e) {
        console.error('[bot] model call failed:', e.message);
      }
    }
  }
```

In `askBotStream`, replace the `if (canAnswer) {` block (currently starting ~line 610, calling `streamGrounded`) — note the over-budget branch also streams the message via `onDelta`, and because it sets `escalate = false` the later `if (escalate) { answer = HANDOFF; onDelta(HANDOFF); }` block is correctly skipped:

```javascript
  if (canAnswer) {
    const budget = await botBudget.tryConsume();
    if (!budget.allowed) {
      console.warn('[bot] model budget exceeded', { reason: budget.reason });
      escalate = false;
      source = 'over_budget';
      answer = OVER_BUDGET_MSG;
      cited_sources = [];
      onDelta(OVER_BUDGET_MSG);
    } else {
      try {
        const out = await streamGrounded(q, chunks, history, onDelta);
        if (!out.escalate && out.text) {
          escalate = false;
          source = 'model';
          answer = out.text;
          cited_sources = sourcesFromChunks(chunks);
          semanticCacheStore(q, queryEmbedding, answer, cited_sources);
        }
      } catch (e) {
        console.error('[bot] stream model call failed:', e.message);
      }
    }
  }
```

Add `OVER_BUDGET_MSG` to the `module.exports` object (alongside `UNSUPPORTED_INPUT_MSG`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/unit/botService.test.js tests/integration/bot.test.js`
Expected: PASS (all existing bot tests + the new over-budget test). The default `tryConsume` mock returns `allowed:true`, so existing model-path tests are unaffected.

- [ ] **Step 5: Commit**

```bash
git add server/services/botService.js server/tests/unit/botService.test.js
git commit -m "feat(bot): gate model calls on the budget breaker in both paths"
```

---

## Self-Review

**Spec coverage:**
- Model-call budget breaker (per-min + per-day, free paths bypass, over-budget non-escalating, fail-open) → Task 1 + Task 3. ✅
- Graceful over-budget message pointing to /help/docs, `source:'over_budget'` → Task 3 (`OVER_BUDGET_MSG`). ✅
- Global request cap (constant key, all IPs) → Task 2. ✅
- Reuse `rateLimitStore`; per-instance ceiling documented → Task 1 (in-memory fallback) + spec. ✅
- Env-tunable at runtime (function form) → Task 1 (`minMax`/`dayMax` read env per call), Task 2 (`max: () =>`). ✅
- Testing (budget limit + reason; over-budget skips model) → Task 1 + Task 3 tests. ✅
- Observability (`console.warn` on trip) → Task 3. ✅
- Edge/Cloudflare → intentionally out of scope (separate plan doc). ✅

**Placeholder scan:** none — every step has complete code and exact commands.

**Type consistency:** `tryConsume()` returns `{ allowed, reason }` in Task 1 and is consumed with `.allowed`/`.reason` in Task 3. `botGlobalLimiter` exported in Task 2, imported in `botRoutes.js` same task. `OVER_BUDGET_MSG` defined and exported in Task 3, imported in its test. `source:'over_budget'` consistent across both paths and the test. ✅

**Dependencies confirmed:** `supertest ^6.3.4` is present (used by `tests/integration/bot.test.js`); `express-rate-limit` v7 `max`-as-function is supported. No new dependencies.
