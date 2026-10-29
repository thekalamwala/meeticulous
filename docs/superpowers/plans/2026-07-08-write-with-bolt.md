# Write with Bolt — AI Service-Listing Autofill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "✨ Write with Bolt" button on the Create-Service form that, from a title alone, calls Claude server-side to fill every content field of the listing — plan-tier-quota-gated, review-before-publish.

**Architecture:** New Express endpoint `POST /api/services/ai/listing` on the existing `serviceRoutes.js` (the router the client already saves through). Controller `aiController.js` runs: quota gate → Anthropic forced-tool-use generation → validate/guardrail-strip → log usage row → return fields. Quota is a rolling-window count of `kind='generate'` rows in a new `ai_listing_generations` table, limits sourced from `subscription_plans.limits.ai_generations` (never hardcoded). Frontend adds the button + AI badges + regenerate to `ServiceForm.jsx`, calling through the existing axios `api.js`. Separately, wire the already-built `faqJsonLd` into `ServiceDetail.jsx`.

**Tech Stack:** Node/Express 4 · `@anthropic-ai/sdk` (new) · Supabase Postgres · React 18 + Vite · Jest (server) · Vitest (client).

## Global Constraints

- **Stack is Vite SPA + Express** — no Next.js. All generation in `aiController.js`.
- **Model IDs:** generate → `claude-haiku-4-5-20251001`; regenerate → `claude-sonnet-5`. Define these as named constants, never inline literals scattered around.
- **API key server-side only** — `ANTHROPIC_API_KEY` (server `.env` + Render). **Key is NOT yet provisioned** — every task must degrade gracefully when the key is absent: the endpoint returns `503 { message, ai_unavailable: true }`, never throws at import time, and the form stays fully manual-usable.
- **Plan limits come from config** — `subscription_plans.limits.ai_generations` in the DB + `FALLBACK_PLANS` in `planService.js`. Never hardcode a per-plan number in gate logic. Quota values: **Starter 1 / 6 months · Host+ 2 / 3 months · Studio 2 / 1 month**; unlimited = `-1` (Supreme).
- **No `services` schema change** — all target columns already exist. Only new DB object = `ai_listing_generations` (migration `v3.69`, applied to BOTH DBs: prod Mumbai `PROD_PROJECT_REF` + staging Tokyo `STAGING_PROJECT_REF`). Keep the code-side SELECT/INSERT destructure fallback until confirmed applied on both.
- **`faqs` shape** = array of `{ question, answer }` (jsonb). `included_items`/`excluded_items` = string[] (text[]). AI must match these exactly.
- **Anti-hallucination guardrails are mandatory** — the model must not invent prices, guarantees, certifications, licenses, medical/legal claims, results, reviews, ratings, addresses, or phone numbers. Server strips/blanks any such field before returning.
- **Fill-then-review, never fill-then-publish** — the button only populates form state; nothing goes live without the host clicking the existing Save/Publish.
- Server tests live in `server/tests/` (Jest). Client tests use Vitest; jest-dom matchers are NOT available — assert with `.getAttribute()`, `toBeInTheDocument`, `toBeDisabled`, `toBeEnabled` only.

**Source spec:** `docs/superpowers/specs/2026-07-01-write-with-bolt-design.md`.

---

### Task 1: Quota migration + plan limit config

Creates the usage-tracking table and registers the `ai_generations` limit key so the quota gate has data to read even before the DB migration is applied on both environments.

**Files:**
- Create: `server/migrations/v3.69_ai_listing_generations.sql`
- Modify: `server/services/planService.js` (add `ai_generations` to each `FALLBACK_PLANS` entry's `limits`)
- Test: `server/tests/unit/planService.aiQuota.test.js`

**Interfaces:**
- Consumes: `planService.getLimit(slug, key)` (existing) → number; `-1` = unlimited, missing key = 0.
- Produces: `getLimit(slug, 'ai_generations')` returns the per-plan allowance (Starter 1, Host+ 2, Studio 2, Supreme -1) from fallback when DB row absent.

- [ ] **Step 1: Write the migration file**

`server/migrations/v3.69_ai_listing_generations.sql`:
```sql
-- v3.69_ai_listing_generations.sql — usage log for "Write with Bolt" AI listing autofill.
-- Idempotent. Apply on BOTH DBs (prod Mumbai PROD_PROJECT_REF + staging Tokyo STAGING_PROJECT_REF).
-- No RLS: only the service_role (server) reads/writes this; it bypasses RLS.

CREATE TABLE IF NOT EXISTS ai_listing_generations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL,                       -- groups a generate + its regenerations
  service_id  UUID REFERENCES services(id) ON DELETE SET NULL,
  plan_slug   TEXT NOT NULL,                        -- plan at time of use (audit)
  model       TEXT NOT NULL,                        -- 'haiku' | 'sonnet'
  kind        TEXT NOT NULL DEFAULT 'generate' CHECK (kind IN ('generate','regenerate')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast quota-window counts per host (only generate rows consume quota).
CREATE INDEX IF NOT EXISTS ai_gen_host_created_idx
  ON ai_listing_generations (host_id, created_at DESC);
```

- [ ] **Step 2: Write the failing test**

`server/tests/unit/planService.aiQuota.test.js`:
```js
const planService = require('../../services/planService');

describe('ai_generations fallback limits', () => {
  test('starter allows 1', async () => {
    expect(await planService.getLimit('starter', 'ai_generations')).toBe(1);
  });
  test('host+ (professional) allows 2', async () => {
    expect(await planService.getLimit('professional', 'ai_generations')).toBe(2);
  });
  test('studio allows 2', async () => {
    expect(await planService.getLimit('studio', 'ai_generations')).toBe(2);
  });
  test('supreme is unlimited (-1)', async () => {
    expect(await planService.getLimit('supreme', 'ai_generations')).toBe(-1);
  });
});
```
> Before writing Step 3, open `server/services/planService.js` and read the `FALLBACK_PLANS` object (≈lines 20-33) to confirm the exact slug keys (`starter`, `professional`/`host_plus`, `studio`, `supreme`). Use the real slugs found there in both the test and the edit — adjust the test's slug strings if the codebase uses different ones.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/planService.aiQuota.test.js`
Expected: FAIL — `getLimit` returns 0 for `ai_generations` (key missing from fallback).

- [ ] **Step 4: Add `ai_generations` to each fallback plan's `limits`**

In `server/services/planService.js`, inside `FALLBACK_PLANS`, add an `ai_generations` key to each plan's `limits` object: starter `1`, the Host+ slug `2`, studio `2`, supreme `-1`. Example shape (match the file's existing formatting):
```js
// within FALLBACK_PLANS
starter:      { /* ...existing... */ limits: { /* ...existing keys... */ ai_generations: 1 } },
professional: { /* ...existing... */ limits: { /* ...existing keys... */ ai_generations: 2 } },
studio:       { /* ...existing... */ limits: { /* ...existing keys... */ ai_generations: 2 } },
supreme:      { /* ...existing... */ limits: { /* ...existing keys... */ ai_generations: -1 } },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/planService.aiQuota.test.js`
Expected: PASS (all 4).

- [ ] **Step 6: Commit**

```bash
git add server/migrations/v3.69_ai_listing_generations.sql server/services/planService.js server/tests/unit/planService.aiQuota.test.js
git commit -m "feat(ai): quota migration + ai_generations plan limits"
```

> **Manual deploy step (record, do not automate):** after merge, run `v3.69_ai_listing_generations.sql` in the Supabase SQL Editor on BOTH DBs (Mumbai prod + Tokyo staging).

---

### Task 2: Anthropic client wrapper (key-optional, lazy)

A thin module owning the SDK + model constants. Isolated so the controller never imports the SDK directly and so a missing key is a graceful `null`, not a crash.

**Files:**
- Modify: `server/package.json` (add `@anthropic-ai/sdk` dependency), regen lockfile with npm@10
- Modify: `server/.env.example` (document `ANTHROPIC_API_KEY`)
- Create: `server/services/ai/anthropicClient.js`
- Test: `server/tests/unit/anthropicClient.test.js`

**Interfaces:**
- Produces:
  - `MODELS = { generate: 'claude-haiku-4-5-20251001', regenerate: 'claude-sonnet-5' }`
  - `isConfigured() → boolean` (true iff `ANTHROPIC_API_KEY` set)
  - `getClient() → Anthropic | null` (lazy singleton; `null` when unconfigured)

- [ ] **Step 1: Add the dependency**

Run: `cd server && npx npm@10 install @anthropic-ai/sdk --save`
Then confirm `server/package.json` `dependencies` has `@anthropic-ai/sdk` and `server/package-lock.json` updated.

- [ ] **Step 2: Document the env var**

Append to `server/.env.example`:
```
# Anthropic (Write with Bolt AI listing autofill). Server-side only.
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Write the failing test**

`server/tests/unit/anthropicClient.test.js`:
```js
describe('anthropicClient', () => {
  const OLD = process.env.ANTHROPIC_API_KEY;
  afterEach(() => { process.env.ANTHROPIC_API_KEY = OLD; jest.resetModules(); });

  test('isConfigured false + getClient null when key absent', () => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.resetModules();
    const c = require('../../services/ai/anthropicClient');
    expect(c.isConfigured()).toBe(false);
    expect(c.getClient()).toBeNull();
  });

  test('exposes model ids', () => {
    const c = require('../../services/ai/anthropicClient');
    expect(c.MODELS.generate).toBe('claude-haiku-4-5-20251001');
    expect(c.MODELS.regenerate).toBe('claude-sonnet-5');
  });

  test('isConfigured true when key present', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    jest.resetModules();
    const c = require('../../services/ai/anthropicClient');
    expect(c.isConfigured()).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/anthropicClient.test.js`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the wrapper**

`server/services/ai/anthropicClient.js`:
```js
'use strict';
// Owns the Anthropic SDK instance + model ids. Key-optional: returns null when
// ANTHROPIC_API_KEY is unset so the feature degrades gracefully (no import crash).

const MODELS = {
  generate: 'claude-haiku-4-5-20251001',
  regenerate: 'claude-sonnet-5',
};

let _client;

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const getClient = () => {
  if (!isConfigured()) return null;
  if (!_client) {
    const Anthropic = require('@anthropic-ai/sdk');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
};

module.exports = { MODELS, isConfigured, getClient };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/anthropicClient.test.js`
Expected: PASS (3).

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/.env.example server/services/ai/anthropicClient.js server/tests/unit/anthropicClient.test.js
git commit -m "feat(ai): add Anthropic SDK client wrapper (key-optional)"
```

---

### Task 3: Field contract — tool schema, validation & guardrail strip

Pure, dependency-free module: the Anthropic tool schema for the field contract, plus a `sanitizeListing(fields)` that enforces limits/array counts and strips fabricated facts. Testable with zero network.

**Files:**
- Create: `server/services/ai/listingContract.js`
- Test: `server/tests/unit/listingContract.test.js`

**Interfaces:**
- Produces:
  - `LISTING_TOOL` — Anthropic tool object `{ name:'emit_listing', description, input_schema }` covering `title, short_description, long_description, included_items, excluded_items, faqs, important_note, category`.
  - `sanitizeListing(raw, { allowedCategorySlugs = [] }) → { fields, dropped: string[] }` — clamps `title`≤60, `short_description`≤160, `important_note`≤200; caps `included_items`/`excluded_items` to 6 and `faqs` to 5; coerces `faqs` items to `{question,answer}`; drops `category` not in `allowedCategorySlugs`; blanks any field containing a fabricated-fact pattern (₹/Rs/price, %, "guarantee", "certified", "licensed", "FDA", star ratings, phone/email). Never throws.

- [ ] **Step 1: Write the failing test**

`server/tests/unit/listingContract.test.js`:
```js
const { LISTING_TOOL, sanitizeListing } = require('../../services/ai/listingContract');

describe('LISTING_TOOL', () => {
  test('names the emit tool with required fields', () => {
    expect(LISTING_TOOL.name).toBe('emit_listing');
    expect(LISTING_TOOL.input_schema.properties.faqs).toBeDefined();
    expect(LISTING_TOOL.input_schema.properties.short_description).toBeDefined();
  });
});

describe('sanitizeListing', () => {
  test('clamps lengths and array counts', () => {
    const { fields } = sanitizeListing({
      title: 'x'.repeat(80),
      short_description: 'y'.repeat(200),
      important_note: 'z'.repeat(300),
      included_items: ['a','b','c','d','e','f','g'],
      faqs: Array.from({ length: 9 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
    }, {});
    expect(fields.title.length).toBeLessThanOrEqual(60);
    expect(fields.short_description.length).toBeLessThanOrEqual(160);
    expect(fields.important_note.length).toBeLessThanOrEqual(200);
    expect(fields.included_items).toHaveLength(6);
    expect(fields.faqs).toHaveLength(5);
  });

  test('keeps category only if allowed', () => {
    expect(sanitizeListing({ category: 'made-up' }, { allowedCategorySlugs: ['seo'] }).fields.category).toBeUndefined();
    expect(sanitizeListing({ category: 'seo' }, { allowedCategorySlugs: ['seo'] }).fields.category).toBe('seo');
  });

  test('strips fabricated-fact fields', () => {
    const { fields, dropped } = sanitizeListing({
      short_description: 'Only ₹499 with a money-back guarantee!',
      long_description: 'We are FDA certified and rated 5 stars.',
    }, {});
    expect(fields.short_description).toBe('');
    expect(fields.long_description).toBe('');
    expect(dropped).toEqual(expect.arrayContaining(['short_description', 'long_description']));
  });

  test('never throws on garbage input', () => {
    expect(() => sanitizeListing(null, {})).not.toThrow();
    expect(() => sanitizeListing({ faqs: 'not-an-array' }, {})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/listingContract.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the contract module**

`server/services/ai/listingContract.js`:
```js
'use strict';
// Field contract for AI listing autofill: the Anthropic tool schema + a pure
// server-side sanitizer that enforces limits and strips fabricated facts.

const LISTING_TOOL = {
  name: 'emit_listing',
  description: 'Return the fully-written service listing fields.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Refined title, <=60 chars, primary keyword near front.' },
      short_description: { type: 'string', description: 'Answer-first hook, <=160 chars. Doubles as meta description.' },
      long_description: { type: 'string', description: 'HTML body, definitional opening ("<Service> is a ..."), ~300-600 chars of text.' },
      included_items: { type: 'array', items: { type: 'string' }, description: '4-6 concrete bullets.' },
      excluded_items: { type: 'array', items: { type: 'string' }, description: '4-6 expectation-setting bullets.' },
      faqs: {
        type: 'array',
        items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
        description: '4-5 FAQs, question phrased as users search, answer-first ~20 words.',
      },
      important_note: { type: 'string', description: 'Caveats/prerequisites, <=200 chars.' },
      category: { type: 'string', description: 'A slug from the allowed list only; omit if none fit.' },
    },
    required: ['title', 'short_description', 'long_description', 'included_items', 'excluded_items', 'faqs'],
  },
};

// Fabricated-fact signals the model must never assert. If present, blank the field.
const FABRICATION = /(₹|\bRs\.?\b|\$\d|\b\d+\s*%|money[- ]?back|guarantee|certified|licen[cs]ed|\bFDA\b|\bISO\b|\b\d(?:\.\d)?\s*stars?\b|\b\d{10}\b|@[\w.-]+\.\w+)/i;

const clamp = (s, n) => String(s || '').trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);

function sanitizeListing(raw, { allowedCategorySlugs = [] } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const dropped = [];
  const guard = (key, val) => {
    if (val && FABRICATION.test(String(val))) { dropped.push(key); return ''; }
    return val;
  };

  const fields = {};
  fields.title = clamp(guard('title', r.title), 60);
  fields.short_description = clamp(guard('short_description', r.short_description), 160);
  fields.long_description = guard('long_description', String(r.long_description || '').trim());
  fields.important_note = clamp(guard('important_note', r.important_note), 200);
  fields.included_items = arr(r.included_items).map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
  fields.excluded_items = arr(r.excluded_items).map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
  fields.faqs = arr(r.faqs)
    .filter((f) => f && (f.question || f.answer))
    .map((f) => ({ question: clamp(f.question, 200), answer: clamp(guard('faq_answer', f.answer), 400) }))
    .filter((f) => f.question && f.answer)
    .slice(0, 5);

  if (r.category && allowedCategorySlugs.includes(r.category)) fields.category = r.category;

  return { fields, dropped };
}

module.exports = { LISTING_TOOL, sanitizeListing };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/listingContract.test.js`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```bash
git add server/services/ai/listingContract.js server/tests/unit/listingContract.test.js
git commit -m "feat(ai): listing tool schema + sanitizer with guardrails"
```

---

### Task 4: Generation service (prompt + forced tool-use call)

Wraps the Anthropic call: builds the system+user prompt, forces `tool_choice` to `emit_listing`, extracts the tool input, and runs it through `sanitizeListing`. One retry on empty/invalid output. Network is injected so it's unit-testable with a mock client.

**Files:**
- Create: `server/services/ai/generateListing.js`
- Test: `server/tests/unit/generateListing.test.js`

**Interfaces:**
- Consumes: `anthropicClient.getClient()`, `anthropicClient.MODELS`, `listingContract.LISTING_TOOL`, `listingContract.sanitizeListing`.
- Produces: `generateListing({ title, category, price, duration, city, audience, tweak, regenerate=false, allowedCategorySlugs=[] }) → Promise<{ fields, model }>`. Throws `Error('AI_UNAVAILABLE')` if no client, `Error('AI_INVALID')` if the model returns no usable tool output after one retry.

- [ ] **Step 1: Write the failing test**

`server/tests/unit/generateListing.test.js`:
```js
jest.mock('../../services/ai/anthropicClient', () => {
  const create = jest.fn();
  return { __create: create, MODELS: { generate: 'gen-id', regenerate: 'regen-id' }, getClient: () => ({ messages: { create } }) };
});
const client = require('../../services/ai/anthropicClient');
const { generateListing } = require('../../services/ai/generateListing');

const toolReply = (input) => ({ content: [{ type: 'tool_use', name: 'emit_listing', input }] });

beforeEach(() => client.__create.mockReset());

test('returns sanitized fields from tool output (generate → haiku)', async () => {
  client.__create.mockResolvedValueOnce(toolReply({
    title: 'SEO Consultancy', short_description: 'Grow organic traffic fast.',
    long_description: 'SEO consultancy is a service...', included_items: ['Audit'],
    excluded_items: ['Ads'], faqs: [{ question: 'How long?', answer: 'Weeks.' }],
  }));
  const out = await generateListing({ title: 'SEO', allowedCategorySlugs: [] });
  expect(out.model).toBe('gen-id');
  expect(out.fields.title).toBe('SEO Consultancy');
  expect(client.__create).toHaveBeenCalledWith(expect.objectContaining({
    model: 'gen-id', tool_choice: { type: 'tool', name: 'emit_listing' },
  }));
});

test('regenerate uses sonnet model', async () => {
  client.__create.mockResolvedValueOnce(toolReply({
    title: 'T', short_description: 'S', long_description: 'L',
    included_items: ['a'], excluded_items: ['b'], faqs: [{ question: 'q', answer: 'a' }],
  }));
  const out = await generateListing({ title: 'X', regenerate: true });
  expect(out.model).toBe('regen-id');
});

test('retries once then throws AI_INVALID on no tool output', async () => {
  client.__create.mockResolvedValue({ content: [{ type: 'text', text: 'sorry' }] });
  await expect(generateListing({ title: 'X' })).rejects.toThrow('AI_INVALID');
  expect(client.__create).toHaveBeenCalledTimes(2);
});

test('throws AI_UNAVAILABLE when client null', async () => {
  const spy = jest.spyOn(client, 'getClient').mockReturnValueOnce(null);
  await expect(generateListing({ title: 'X' })).rejects.toThrow('AI_UNAVAILABLE');
  spy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/generateListing.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generation service**

`server/services/ai/generateListing.js`:
```js
'use strict';
const { getClient, MODELS } = require('./anthropicClient');
const { LISTING_TOOL, sanitizeListing } = require('./listingContract');

const SYSTEM = [
  'You are an expert SEO/AEO/GEO copywriter for a services marketplace (Meeticulous).',
  'Write a complete, publish-ready service listing by calling the emit_listing tool.',
  'Rules: English only. Primary keyword (from the title) appears in the title, the first',
  'sentence of long_description, and at least one FAQ — natural density, no stuffing.',
  'short_description and every FAQ answer lead with the direct answer and stand alone.',
  'long_description opens definitionally ("<Service> is a ..."), factual, entity-rich.',
  'NEVER invent prices, guarantees, certifications, licenses, medical/legal claims,',
  'specific results, reviews, ratings, addresses, or phone numbers. Leave unknowable',
  'facts out. Only choose a category from the allowed list; omit category if none fit.',
].join(' ');

function buildUserMessage({ title, category, price, duration, city, audience, tweak, allowedCategorySlugs }) {
  const ctx = [`Service title: ${title}`];
  if (category) ctx.push(`Host-selected category slug: ${category}`);
  if (price) ctx.push(`Price (context only, do not state in copy): ${price}`);
  if (duration) ctx.push(`Duration minutes (context only): ${duration}`);
  if (city) ctx.push(`City: ${city}`);
  if (audience) ctx.push(`Audience: ${audience}`);
  if (allowedCategorySlugs?.length) ctx.push(`Allowed category slugs: ${allowedCategorySlugs.join(', ')}`);
  if (tweak) ctx.push(`Adjustment requested: ${tweak}`);
  return ctx.join('\n');
}

async function callOnce(client, { model, system, user, temperature }) {
  const resp = await client.messages.create({
    model, max_tokens: 1500, temperature, system,
    tools: [LISTING_TOOL], tool_choice: { type: 'tool', name: 'emit_listing' },
    messages: [{ role: 'user', content: user }],
  });
  const block = (resp.content || []).find((b) => b.type === 'tool_use' && b.name === 'emit_listing');
  return block ? block.input : null;
}

async function generateListing(opts = {}) {
  const client = getClient();
  if (!client) throw new Error('AI_UNAVAILABLE');
  const { regenerate = false, allowedCategorySlugs = [] } = opts;
  const model = regenerate ? MODELS.regenerate : MODELS.generate;
  const temperature = regenerate ? 0.9 : 0.7;
  const user = buildUserMessage(opts);

  let raw = await callOnce(client, { model, system: SYSTEM, user, temperature });
  if (!raw) {
    raw = await callOnce(client, {
      model, temperature,
      system: SYSTEM + ' You MUST call emit_listing with every required field filled.',
      user,
    });
  }
  if (!raw) throw new Error('AI_INVALID');

  const { fields } = sanitizeListing(raw, { allowedCategorySlugs });
  return { fields, model };
}

module.exports = { generateListing, buildUserMessage, SYSTEM };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/generateListing.test.js`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add server/services/ai/generateListing.js server/tests/unit/generateListing.test.js
git commit -m "feat(ai): forced-tool-use listing generation service"
```

---

### Task 5: Quota gate + controller + route

The rolling-window quota check (mirrors `checkServiceLimit`), the controller that ties quota → generation → usage logging, and the route wired onto `serviceRoutes.js`.

**Files:**
- Create: `server/controllers/aiController.js`
- Modify: `server/routes/serviceRoutes.js` (add the AI route)
- Test: `server/tests/unit/aiController.test.js`

**Interfaces:**
- Consumes: `generateListing` (Task 4), `planService.getLimit`, `supabaseAdmin` (from `server/config/supabase`), `req.user.id`, `req.vendorPlan`/`req.vendorPlanData` (set by `attachPlan`).
- Produces: `POST /api/services/ai/listing` →
  - `200 { fields, session_id, ai_generated: true }`
  - `503 { message, ai_unavailable: true }` when key unset
  - `429 { message, current_plan, limit, unlock_at }` when quota exhausted
  - `422 { message }` on `AI_INVALID`.
  - Body: `{ title (required), category?, price?, duration?, city?, audience?, session_id? }`. `session_id` present ⇒ regenerate (Sonnet, no quota consume); absent ⇒ generate (Haiku, consumes one unit, returns a new `session_id`).

**Window map (config, not inline magic):** define at top of controller:
```js
const WINDOW_DAYS = { starter: 182, professional: 91, studio: 30, supreme: 0 }; // days; default 182
```

- [ ] **Step 1: Write the failing test**

`server/tests/unit/aiController.test.js`:
```js
jest.mock('../../services/ai/generateListing', () => ({ generateListing: jest.fn() }));
jest.mock('../../services/planService', () => ({ getLimit: jest.fn() }));

// Chainable supabase mock: from().select().eq().gte() → { count }, and from().insert() ok.
const state = { count: 0, insertErr: null };
jest.mock('../../config/supabase', () => {
  const q = () => {
    const o = {};
    ['select', 'eq', 'gte'].forEach((m) => { o[m] = jest.fn(() => o); });
    o.then = (res) => res({ count: state.count, error: null });
    o.insert = jest.fn(() => Promise.resolve({ error: state.insertErr }));
    return o;
  };
  return { supabaseAdmin: { from: jest.fn(q) } };
});

const { generateListing } = require('../../services/ai/generateListing');
const planService = require('../../services/planService');
const { generateAiListing } = require('../../controllers/aiController');

const mkRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const okFields = { title: 'T', short_description: 'S', long_description: 'L', included_items: [], excluded_items: [], faqs: [] };

beforeEach(() => { state.count = 0; state.insertErr = null; generateListing.mockReset(); planService.getLimit.mockReset(); });

test('503 when generation unavailable (no key)', async () => {
  planService.getLimit.mockResolvedValue(1);
  generateListing.mockRejectedValue(new Error('AI_UNAVAILABLE'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
});

test('429 when generate quota exhausted', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.count = 1; // already used the 1 allowed
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(429);
});

test('200 generate returns fields + new session_id, consumes quota', async () => {
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockResolvedValue({ fields: okFields, model: 'gen-id' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'studio', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  const payload = res.json.mock.calls[0][0];
  expect(payload.ai_generated).toBe(true);
  expect(payload.session_id).toBeTruthy();
  expect(payload.fields.title).toBe('T');
});

test('regenerate (session_id present) does not check quota', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.count = 5; // over limit, but regenerate must ignore it
  generateListing.mockResolvedValue({ fields: okFields, model: 'regen-id' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X', session_id: 'sess-1' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: true }));
});

test('unlimited plan (-1) skips quota', async () => {
  planService.getLimit.mockResolvedValue(-1);
  state.count = 99;
  generateListing.mockResolvedValue({ fields: okFields, model: 'gen-id' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'supreme', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
});

test('422 on AI_INVALID', async () => {
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockRejectedValue(new Error('AI_INVALID'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'studio', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(422);
});
```
> Before Step 3, open `server/config/supabase.js` to confirm the export name (`supabaseAdmin`) and `server/controllers/serviceController.js` for how it fetches the host's allowed category slugs (`hostGetCategories` equivalent server-side / `resolveAndValidateCategory`). Reuse that same helper to build `allowedCategorySlugs`; if it's not trivially importable, pass `[]` for v1 (AI simply won't set category — acceptable, host picks it). Keep the SELECT/INSERT destructure fallback so a missing `ai_listing_generations` table degrades to "no quota row" rather than a 500.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/aiController.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller**

`server/controllers/aiController.js`:
```js
'use strict';
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const planService = require('../services/planService');
const { generateListing } = require('../services/ai/generateListing');

const WINDOW_DAYS = { starter: 182, professional: 91, studio: 30, supreme: 0 };
const TABLE = 'ai_listing_generations';

async function countGeneratesInWindow(hostId, windowDays) {
  const since = new Date(Date.now() - windowDays * 864e5).toISOString();
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('host_id', hostId)
      .eq('kind', 'generate')
      .gte('created_at', since);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    if (String(e.message || '').includes('does not exist')) return 0; // table not yet applied
    throw e;
  }
}

async function logUsage(row) {
  try { await supabaseAdmin.from(TABLE).insert(row); } catch (_) { /* audit only; non-fatal */ }
}

async function generateAiListing(req, res) {
  const hostId = req.user.id;
  const plan = req.vendorPlan || 'starter';
  const { title, category, price, duration, city, audience, session_id } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ message: 'A service title is required.' });

  const isRegenerate = Boolean(session_id);

  // Quota gate — generate only. Regenerate is free within an existing session.
  if (!isRegenerate) {
    const limit = await planService.getLimit(plan, 'ai_generations');
    if (limit !== -1) {
      const windowDays = WINDOW_DAYS[plan] ?? 182;
      const used = await countGeneratesInWindow(hostId, windowDays);
      if (used >= limit) {
        const unlockAt = new Date(Date.now() + windowDays * 864e5).toISOString();
        return res.status(429).json({
          message: `You've used your ${limit} AI generation${limit === 1 ? '' : 's'} for the ${plan} plan.`,
          current_plan: plan, limit, unlock_at: unlockAt,
        });
      }
    }
  }

  let result;
  try {
    result = await generateListing({ title, category, price, duration, city, audience, regenerate: isRegenerate, allowedCategorySlugs: [] });
  } catch (e) {
    if (e.message === 'AI_UNAVAILABLE') return res.status(503).json({ message: 'AI writing is temporarily unavailable. Please fill the form manually.', ai_unavailable: true });
    return res.status(422).json({ message: 'Could not generate a listing from that title. Try a more descriptive title.' });
  }

  const sid = session_id || crypto.randomUUID();
  await logUsage({
    host_id: hostId, session_id: sid, plan_slug: plan,
    model: result.model.includes('sonnet') ? 'sonnet' : 'haiku',
    kind: isRegenerate ? 'regenerate' : 'generate',
  });

  return res.status(200).json({ fields: result.fields, session_id: sid, ai_generated: true });
}

module.exports = { generateAiListing, countGeneratesInWindow, WINDOW_DAYS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/aiController.test.js`
Expected: PASS (6).

- [ ] **Step 5: Wire the route**

In `server/routes/serviceRoutes.js`, add near the other routes (imports `protect, requireHost` already present; `attachPlan` from `planMiddleware` already imported):
```js
const { generateAiListing } = require('../controllers/aiController');
// ...
router.post('/ai/listing', protect, requireHost, attachPlan, generateAiListing);
```
> Confirm `attachPlan` is imported at the top of `serviceRoutes.js` (Task-6 reference says it is, line 16). If not, add it: `const { attachPlan } = require('../middleware/planMiddleware');`. Place this route BEFORE any `router.get('/:id'...)` / param routes so `/ai/listing` isn't swallowed by a param match.

- [ ] **Step 6: Run the full server suite (nothing regressed)**

Run: `cd server && npm test`
Expected: PASS (new tests green; pre-existing suite unchanged).

- [ ] **Step 7: Commit**

```bash
git add server/controllers/aiController.js server/routes/serviceRoutes.js server/tests/unit/aiController.test.js
git commit -m "feat(ai): quota-gated generate-listing endpoint"
```

---

### Task 6: API client method

One-line axios method so the form can call the endpoint with auth injected automatically.

**Files:**
- Modify: `client/src/services/api.js` (add `aiGenerateListing`)

**Interfaces:**
- Produces: `aiGenerateListing(data) → Promise<AxiosResponse>` POSTing to `/services/ai/listing`.

- [ ] **Step 1: Add the method**

In `client/src/services/api.js`, near `svcCreate`/`svcUpdate` (≈line 436):
```js
export const aiGenerateListing = (data) => API.post('/services/ai/listing', data);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(ai): api client method for generate-listing"
```
> No standalone test — trivial one-liner covered by the ServiceForm test in Task 7.

---

### Task 7: "Write with Bolt" button in ServiceForm

The UI: button by the title field, loading state, populate-all-fields on success, per-field AI badges, regenerate + tweak box, rate-limited/unavailable/error states. All keep the host's input intact and the form manually usable.

**Files:**
- Modify: `client/src/pages/services/ServiceForm.jsx`
- Test: `client/src/tests/ServiceForm.bolt.test.jsx`

**Interfaces:**
- Consumes: `aiGenerateListing` (Task 6); existing `setForm`, `form`, `svcCats` (category list).
- Produces: on success calls `setForm(f => ({ ...f, ...fields }))`, stores `session_id` in state, marks returned keys in an `aiFields` Set for badge rendering.

- [ ] **Step 1: Write the failing test**

`client/src/tests/ServiceForm.bolt.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as api from '../services/api';
import ServiceForm from '../pages/services/ServiceForm';

vi.mock('../services/api', async (orig) => ({
  ...(await orig()),
  hostGetCategories: () => Promise.resolve({ data: { primary_category: 'seo' } }),
  listServiceCategories: () => Promise.resolve({ data: { categories: [], allow_suggestions: false } }),
  aiGenerateListing: vi.fn(),
}));

const renderForm = () => render(<MemoryRouter><ServiceForm /></MemoryRouter>);

test('Write with Bolt button is present', async () => {
  renderForm();
  expect(await screen.findByRole('button', { name: /write with bolt/i })).toBeInTheDocument();
});

test('requires a title before generating', async () => {
  renderForm();
  const btn = await screen.findByRole('button', { name: /write with bolt/i });
  expect(btn).toBeDisabled(); // disabled while title empty
});

test('fills fields from AI response', async () => {
  api.aiGenerateListing.mockResolvedValue({ data: {
    ai_generated: true, session_id: 's1',
    fields: { title: 'SEO Consultancy', short_description: 'Grow traffic.', long_description: '<p>SEO is…</p>', included_items: ['Audit'], excluded_items: ['Ads'], faqs: [{ question: 'How long?', answer: 'Weeks.' }], important_note: 'Bring analytics access.' },
  }});
  renderForm();
  const titleInput = await screen.findByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  fireEvent.click(screen.getByRole('button', { name: /write with bolt/i }));
  await waitFor(() => expect(screen.getByDisplayValue('Grow traffic.')).toBeInTheDocument());
});

test('shows cooldown message on 429', async () => {
  api.aiGenerateListing.mockRejectedValue({ response: { status: 429, data: { message: 'You have used your 1 AI generation for the starter plan.' } } });
  renderForm();
  const titleInput = await screen.findByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  fireEvent.click(screen.getByRole('button', { name: /write with bolt/i }));
  await waitFor(() => expect(screen.getByText(/used your 1 AI generation/i)).toBeInTheDocument());
});
```
> Before Step 3, read `ServiceForm.jsx` lines 404-535 to confirm the exact `set`/`setForm` helpers, the title `Input` at 528-535, and how existing buttons are styled (reuse the project `Button` component + design tokens; do NOT invent colors — sparkle button uses an existing accent token). Match the imports style at line 8.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/ServiceForm.bolt.test.jsx`
Expected: FAIL — no "Write with Bolt" button.

- [ ] **Step 3: Add state + handler**

In `ServiceForm.jsx`, near the other `useState` calls (≈line 404-458), add:
```jsx
const [aiLoading, setAiLoading] = useState(false);
const [aiFields, setAiFields] = useState(() => new Set());
const [aiSession, setAiSession] = useState(null);
const [aiError, setAiError] = useState('');
const [aiTweak, setAiTweak] = useState('');

const runBolt = async (regenerate = false) => {
  if (!form.title.trim() || aiLoading) return;
  setAiLoading(true); setAiError('');
  try {
    const body = { title: form.title, category: form.category || undefined, price: form.price || undefined, duration: form.duration || undefined };
    if (regenerate && aiSession) { body.session_id = aiSession; if (aiTweak.trim()) body.tweak = aiTweak.trim(); }
    const { data } = await aiGenerateListing(body);
    setForm(f => ({ ...f, ...data.fields }));
    setAiFields(new Set(Object.keys(data.fields)));
    setAiSession(data.session_id);
  } catch (e) {
    setAiError(e?.response?.data?.message || 'AI writing failed. You can fill the form manually.');
  } finally { setAiLoading(false); }
};
```
Add `aiGenerateListing` to the api import at line 8.

- [ ] **Step 4: Add the button + states to the title block**

Replace the title block (528-535) label row to include the button, and render error/regenerate below:
```jsx
<div>
  <div className="mb-1 flex justify-between items-center">
    <label className="...existing label classes...">Service Title <span className="text-red-500">*</span></label>
    <button type="button" onClick={() => runBolt(false)} disabled={!form.title.trim() || aiLoading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)] disabled:opacity-40">
      {aiLoading ? 'Bolt is writing…' : '✨ Write with Bolt'}
    </button>
  </div>
  <Input type="text" value={form.title} maxLength={60} required onChange={e => set('title', e.target.value)} placeholder="e.g. SEO Consultancy by Shubham Datarkar" />
  {aiError && <p className="mt-1 text-xs text-red-500">{aiError}</p>}
  {aiSession && !aiLoading && (
    <div className="mt-2 flex gap-2 items-center">
      <input value={aiTweak} onChange={e => setAiTweak(e.target.value)} placeholder="make it more… (optional)"
        className="flex-1 text-xs rounded-lg border-2 px-2 py-1" />
      <button type="button" onClick={() => runBolt(true)} className="text-xs font-semibold text-[color:var(--accent)]">Regenerate</button>
    </div>
  )}
</div>
```
> Use the real accent token found in the file, not `--accent` if that's not what the codebase uses. Reuse the existing `Input`/`Button` components already imported. A tiny "AI" badge next to a filled field is optional polish — a field being in `aiFields` can render a `<span className="text-[10px] ...">AI</span>` beside its label; keep it minimal and only where labels already exist.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/tests/ServiceForm.bolt.test.jsx`
Expected: PASS (4).

- [ ] **Step 6: Verify build**

Run: `cd client && npm run build`
Expected: build succeeds, no new errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/services/ServiceForm.jsx client/src/tests/ServiceForm.bolt.test.jsx
git commit -m "feat(ai): Write with Bolt button + regenerate in ServiceForm"
```

---

### Task 8: Wire FAQPage JSON-LD on the public service page

The only SEO gap: `faqJsonLd` exists but isn't emitted. Map `service.faqs` `{question,answer}` → `{q,a}` and add it to the existing jsonLd array, so AI-written FAQs produce FAQPage rich results with visible-parity.

**Files:**
- Modify: `client/src/pages/ServiceDetail.jsx` (import `faqJsonLd`; extend the `jsonLd` array at ≈937)
- Test: `client/src/tests/serviceDetailFaqLd.test.jsx` (pure function test — no full page render)

**Interfaces:**
- Consumes: `faqJsonLd({ faqs: [{q,a}] })` from `utils/seo`.

- [ ] **Step 1: Write the failing test (pure builder mapping)**

`client/src/tests/serviceDetailFaqLd.test.jsx`:
```jsx
import { faqJsonLd } from '../utils/seo';

test('maps service.faqs {question,answer} → FAQPage entities', () => {
  const faqs = [{ question: 'How long?', answer: 'About two weeks.' }, { question: 'Refunds?', answer: 'Case by case.' }];
  const ld = faqJsonLd({ faqs: faqs.map(f => ({ q: f.question, a: f.answer })) });
  expect(ld['@type']).toBe('FAQPage');
  expect(ld.mainEntity).toHaveLength(2);
  expect(ld.mainEntity[0].name).toBe('How long?');
  expect(ld.mainEntity[0].acceptedAnswer.text).toBe('About two weeks.');
});

test('empty faqs → empty mainEntity', () => {
  expect(faqJsonLd({ faqs: [] }).mainEntity).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it passes for the mapping, then confirm ServiceDetail lacks it**

Run: `cd client && npx vitest run src/tests/serviceDetailFaqLd.test.jsx`
Expected: PASS (the builder already works). This test locks the mapping contract Step 3 must use.

- [ ] **Step 3: Wire it into ServiceDetail**

In `client/src/pages/ServiceDetail.jsx`:
- Line 13 — add `faqJsonLd` to the import: `import { resolveServiceSeo, serviceJsonLd, breadcrumbJsonLd, faqJsonLd, SITE_URL } from '../utils/seo';`
- In the `jsonLd` array (≈937), append, guarded so an empty FAQ list emits nothing:
```jsx
const jsonLd = [
  serviceJsonLd({ service, vendor, siteUrl: SEO_SITE, avgRating: rating, reviewCount }),
  breadcrumbJsonLd({ items: [ /* ...existing... */ ] }),
  ...(Array.isArray(service.faqs) && service.faqs.length
    ? [faqJsonLd({ faqs: service.faqs.map(f => ({ q: f.question, a: f.answer })) })]
    : []),
];
```

- [ ] **Step 4: Verify build**

Run: `cd client && npm run build`
Expected: build succeeds. Optionally check one prerendered service page HTML contains `"@type":"FAQPage"` when the service has FAQs.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ServiceDetail.jsx client/src/tests/serviceDetailFaqLd.test.jsx
git commit -m "feat(seo): emit FAQPage JSON-LD on service pages"
```

---

## Post-implementation checklist

- [ ] Apply `v3.69_ai_listing_generations.sql` in Supabase SQL Editor on BOTH DBs (Mumbai prod + Tokyo staging).
- [ ] Add `ANTHROPIC_API_KEY` to `server/.env` locally and to Render env, then smoke-test one real generate.
- [ ] Add `ai_generations` to `subscription_plans.limits` JSONB per plan in BOTH DBs (so live limits match the fallback: starter 1, host+ 2, studio 2, supreme -1).
- [ ] Update `CLAUDE.md` migration status line to include v3.69 once applied.
- [ ] Update `docs/current-work.md` / memory with the shipped feature.

## Notes on decisions locked from the spec

- Endpoint lives on `/api/services` (the router the client actually saves through), not `/api/host` as the spec's diagram sketched — this matches the real save path (`serviceController`), keeps `attachPlan` reuse trivial, and avoids the dual-write landmine (feature only reads form + returns fields; existing save path unchanged).
- Quota window is enforced from the `ai_listing_generations` log, counting `kind='generate'` only; regenerations pass the `session_id` and never consume. Supreme (`-1`) bypasses.
- `category` autofill ships as `[]` allowed-list for v1 unless the server-side category helper is trivially importable — host picks the category, which is the safe default. Upgrade path: pass real `allowedCategorySlugs` from the same `resolveAndValidateCategory` source.
