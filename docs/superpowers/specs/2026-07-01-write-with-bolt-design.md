# Design Spec — "Write with Bolt" (AI Service-Listing Autofill)

**Product:** Book A Sloth
**Feature:** One-click AI generation that fills every field on the Create-Service form
**Owner:** Shubham (Timewheel Internet Pvt Ltd)
**Stack (actual):** React 18 + Vite SPA · Node/Express 4 · Supabase (Postgres) · Claude (Haiku 4.5 / Sonnet 5)
**Status:** Approved design v1 — ready for implementation plan
**Last updated:** 1 July 2026

> **Stack correction vs. original PRD:** the original PRD assumed Next.js App Router + server actions. This repo is a **Vite SPA + Express API**. All server-side generation lives in a new **Express controller**, not a Next.js route handler. There is no Next.js in this project.

---

## 1. Summary

Creating a service on Book A Sloth means filling a long form (title, short + long description, inclusions/exclusions, FAQs, notes). Hosts drop off before publishing.

**"Write with Bolt"** is a single button on the Create-Service form. The host types **only the service title**, clicks the button, and the AI fills **every content field on the form** with publish-ready, SEO/AEO/GEO-optimized content. The host reviews, optionally tweaks or regenerates, and publishes.

**Core promise:** type a title → click → boom, the whole listing is written and ready to publish.

This is **fill-then-review**, not fill-then-publish. Nothing goes live without the host clicking Publish.

---

## 2. Ground Truth (verified against the codebase, 2026-07-01)

These facts shaped the design and remove work the original PRD assumed was needed:

1. **All target fields already exist as persisted columns** on the `services` table and in the form — no `services` migration required. Confirmed in `server/controllers/serviceController.js` (insert/update handles `short_description`, `long_description`, `faqs`, `included_items`, `excluded_items`, `important_note`) and `client/src/pages/services/ServiceForm.jsx` (form state already has all of these, incl. a `FAQBuilder`).
2. The form fields the AI will fill (existing `form.*` keys in `ServiceForm.jsx`):
   - `title` — Input, maxLength 60 *(host provides this; AI may refine)*
   - `short_description` — Textarea, maxLength 160 (also used as meta description)
   - `long_description` — RichEditor (HTML body)
   - `faqs` — array of `{ question, answer }` (FAQBuilder)
   - `included_items` — string[] (TagInput)
   - `excluded_items` — string[] (TagInput)
   - `important_note` — Textarea (caveats / prerequisites)
   - `category` — slug picked from the host's profession categories (AI may suggest from allowed list only; never invents a category)
   - `duration`, `price`, `meeting_mode`, `grace_period` — logistics; **AI leaves these to the host** (facts it cannot know). Price/duration are optional context inputs only.
3. **No Anthropic SDK in the repo yet** — new dependency `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` env var (server `.env` and Render).
4. **Two backends write services** (`serviceController.js` and `hostController.js`) — a known dual-write landmine. This feature only *reads* the form and returns generated values to the client; the client uses the existing save path, so no change to either write path is required.
5. Public listing page already has SEO/JSON-LD infrastructure (`Seo.jsx`, per the sitemap/SEO build). New schema builders extend it rather than starting from scratch.

**Net effect:** the only new database object is the quota-tracking table (§4). No `services` schema change.

---

## 3. Goals & Non-Goals

### Goals
1. Reduce time-to-publish for a new listing to: type title → click → review → publish.
2. Fill **every** content field on the form in one action.
3. Produce SEO- (Google), AEO- (answer engines), and GEO- (LLM citation) friendly content.
4. Emit valid **JSON-LD** (Service, Offer, FAQPage) on the published page, computed at render time from live fields.
5. Output always validates against the form contract and field limits — never a broken/partial listing.
6. Enforce a strict, plan-tiered usage quota (§6) to bound cost and position the feature as a premium perk.

### Non-Goals (v1)
- No image generation.
- No multi-language (English only; hooks left for later).
- No autonomous publishing — human review step is mandatory.
- No `services` schema migration (not needed — fields exist).
- No editing of *existing live* listings via the button in v1 (works on new/draft listings; regenerate allowed on a draft).

---

## 4. Data Model

**One new table** (migration `v3.6x_ai_listing_generations.sql`, applied to BOTH DBs — Mumbai prod + Tokyo staging — per the project migration workflow).

```sql
CREATE TABLE IF NOT EXISTS ai_listing_generations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL,                 -- groups generate + regenerations of one draft
  service_id  UUID REFERENCES services(id) ON DELETE SET NULL, -- null while draft
  plan_slug   TEXT NOT NULL,                 -- plan at time of use (audit)
  model       TEXT NOT NULL,                 -- 'haiku' | 'sonnet'
  kind        TEXT NOT NULL DEFAULT 'generate', -- 'generate' | 'regenerate'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fast quota-window counts per host
CREATE INDEX IF NOT EXISTS ai_gen_host_created_idx
  ON ai_listing_generations (host_id, created_at DESC);
```

**Quota is counted on `kind = 'generate'` rows only** — regenerations do not count (see §6). Keep the code-side schema fallback pattern (destructure SELECT/INSERT) until the migration is confirmed on both DBs.

---

## 5. User Flow

1. Host opens **Create Service** (`ServiceForm.jsx`).
2. Types the **service title** (the only required input). May optionally set category/price/duration first for better relevance.
3. Clicks **✨ Write with Bolt**.
4. Button → loading ("Bolt is writing…"). Server generates.
5. Every content field populates (`setForm()`). AI-filled fields show a subtle **"AI"** badge prompting a quick review.
6. Host edits anything, or clicks **Regenerate** (with an optional "make it more ___" tweak box). Regenerations are free within the same draft session.
7. Host clicks **Publish/Save** (existing save path). Public page renders content + JSON-LD.

**States to design:** idle · loading · success (filled + badges) · rate-limited (shows when the button unlocks) · error (keeps host input intact, form still usable manually).

---

## 6. Usage Quota (plan-tiered, rolling window)

Not a per-minute rate limit — a **lifetime rolling-window allowance per plan**. Limits come from a config map (never hardcoded inline), consistent with the "limits always come from config/plan" rule.

| Plan | Allowance | Window |
|---|---|---|
| Starter (free) | 1 generation | per 6 months |
| Host+ | 2 generations | per 3 months |
| Studio | 2 generations | per month |

**Session model — what counts as ONE use:**
- The **first successful generate** for a draft writes one `kind='generate'` row (consumes one unit) and returns a `session_id`.
- **Regenerate** (and tweak-box regenerate) passes that `session_id` → logged as `kind='regenerate'`, which **does not consume quota**. Free within the draft session.
- A session is open until the listing is **published/saved** or **24h** elapse, whichever first. After that, a new generate starts a new session and consumes the next unit.

**Enforcement:** on every generate request, count `kind='generate'` rows for the host within the plan window. If `count >= allowance` and no open session is being continued → `429` with a payload stating the plan, the limit, and the unlock timestamp (`oldest_generate_at + window`). Frontend shows a friendly cooldown state; the button is disabled with that message.

Supreme (hidden god-tier plan) bypasses the quota via the existing bypass mechanism, consistent with other gated features.

---

## 7. Generated Content — Field Contract & SEO/AEO/GEO Rules

The AI returns a JSON object matching this contract (enforced via forced tool-use schema, §9). Limits mirror the form.

| Field | Type / Limit | Rules |
|---|---|---|
| `title` | string ≤ 60 | Primary keyword near the front; matches search intent. Refine host's title; keep their intent. |
| `short_description` | string ≤ 160 | Answer-first hook; doubles as meta description. Leads with the direct value. |
| `long_description` | HTML, ~300–600 chars of text | **Definitional opening** ("[Service] is a …"); entity-rich, factual, natural keywords; renders as `<h2>` sections. |
| `included_items` | string[] (4–6) | Concrete, extractable bullets. |
| `excluded_items` | string[] (4–6) | Sets expectations; extractable. |
| `faqs` | array of `{question, answer}` (4–5) | Q ≈ 10 words phrased as users search ("How long does X take?"); A ≈ 20 words, self-contained, answer-first. Powers FAQPage schema. |
| `important_note` | string ≤ 200 | Caveats / prerequisites; trust signal. |
| `category` | slug (optional) | Only from the host's allowed category list; omit if unsure. Never invented. |

**SEO:** primary keyword (from title) appears in `title`, first sentence of `long_description`, and ≥1 FAQ. Natural density, no stuffing. Unique per listing (no boilerplate duplication).

**AEO:** `short_description` and each FAQ answer lead with the direct answer; each FAQ answer stands alone.

**GEO:** explicit, consistent entity naming (service + category + city when provided); definitional opening; factual density over adjectives; list/Q&A format a model can quote; visible content consistent with JSON-LD.

**Hard guardrails (anti-hallucination):** the model must NOT invent prices, guarantees, certifications, licenses, medical/legal claims, specific results/outcomes, reviews, ratings, addresses, or phone numbers. Anything factual it cannot know is left blank/generic for the host. Server strips/blanks any such fabricated field before returning.

---

## 8. Architecture

```
ServiceForm.jsx  ── title (+ optional category/price/duration) ──►  POST /api/host/ai/generate-listing
   ▲                                                                  (auth-gated, host-only)
   │ setForm(fields) + AI badges                                            │
   │                                                                        ▼
   │                                                  aiController.js  ──►  quota gate (ai_listing_generations)
   │                                                        │                  │ over limit → 429 + unlock time
   │                                                        │                  ▼
   │                                                        │           Anthropic API (forced tool-use schema)
   │                                                        │           generate → Haiku 4.5 · regenerate → Sonnet 5
   │                                                        ▼                  │
   └──────────────────────── validated JSON ◄──── validate + guardrail strip ◄┘
                                                     (retry ≤2 on failure)

On Publish → existing service save path → public page renders content + <script type="application/ld+json">
             (Service + Offer + FAQPage, computed at render time from live columns)
```

**Backend (`server/controllers/aiController.js` + route in an existing host router):**
- `POST /api/host/ai/generate-listing` — auth + host-only middleware.
- Body: `{ title (required), category?, price?, duration?, city?, audience?, session_id? }`.
- Steps: quota gate → build prompt → call Anthropic with forced tool schema → parse (tool output is already structured) → limits/guardrail check → on invalid retry (≤2) → log row → return `{ fields, session_id, ai_generated: true }`.
- `session_id` present in body ⇒ regenerate path (Sonnet, no quota consume); absent ⇒ new generate (Haiku, consumes a unit).
- API key server-side only (`ANTHROPIC_API_KEY`).

**Frontend (`ServiceForm.jsx`):**
- "✨ Write with Bolt" button near the title field; disabled with cooldown text when rate-limited.
- Loading state; on success `setForm()` all returned fields, mark each with an `ai` badge (local `aiFields` set) so the host reviews.
- Regenerate button + optional tweak textarea (appended to prompt), reuses `session_id`.
- On any error, keep the host's typed input and allow full manual completion.

**Public page JSON-LD (render-time) — infra already exists, minimal work:**
- `client/src/utils/seo.js` already exports `serviceJsonLd` (**Service + nested Offer + aggregateRating**, real-only), `breadcrumbJsonLd` (**BreadcrumbList**), and `faqJsonLd` (**FAQPage** from `[{q,a}]`). `ServiceDetail.jsx` already renders `serviceJsonLd` + `breadcrumbJsonLd` via `<Seo jsonLd>`.
- **Only gap:** `faqJsonLd` is built but **not wired** on `ServiceDetail.jsx` (import at line 12 omits it). Task = wire it in, mapping `service.faqs` `{question,answer}` → `{q,a}`, 1:1 with the visible FAQ tab (Google visible-parity). No new builders. `<Seo>` accepts a single `jsonLd` object, so combine as an array or `@graph`.
- Only emit real fields (existing builders already guard ratings). Provider/LocalBusiness = Phase 2.

---

## 9. Model & Structured Output

- **Model IDs:** generate → `claude-haiku-4-5`; regenerate → `claude-sonnet-5`.
- **Forced tool-use schema:** define the field contract (§7) as an Anthropic tool and force `tool_choice` to it. The model returns schema-shaped JSON natively — near-zero parse failures, no markdown fences.
- **System prompt encodes:** role (expert SEO copywriter for a services marketplace), the exact field contract + limits, SEO/AEO/GEO rules (§7), hard guardrails, English-only.
- **User message:** the title + any optional context, clearly labelled.
- **Server-side validation:** even with forced schema, re-check limits + array counts, run the guardrail strip, and a light profanity/safety filter. On failure, one tightening retry, then hard-truncate as last resort; ≤2 total retries before a graceful error.
- **Regenerate** varies output (higher temperature) and appends the host's tweak instruction if provided.

---

## 10. Edge Cases & Failure Modes

- **Vague title** ("Consulting"): generate reasonable generic content, leave more fields generic, and hint the host to add category/price for a sharper result.
- **Gibberish / non-English title:** ask the host to clarify rather than emit nonsense (does not consume quota).
- **Model returns invalid/over-limit output:** retry with tightening instruction → hard-truncate → graceful fallback to manual entry.
- **Prohibited/unsafe service:** refuse, surface a policy message (does not consume quota).
- **Timeout / API error:** friendly error, keep host input, form stays manual-usable (does not consume quota — only successful generates are logged).
- **Quota exhausted:** disabled button + cooldown message with unlock date.

---

## 11. Non-Functional Requirements

- **Latency:** < 4s p95 for a generate.
- **Reliability:** graceful degradation — form always usable manually if AI fails.
- **Security:** server-side key, auth + host-only, quota-gated, input/output sanitized.
- **Cost:** negligible given the strict quota (single-digit generations per host per window); Haiku ≈ ₹1/generate, Sonnet regens bounded per draft.
- **Privacy:** log only what the quota + quality tuning need (host_id, model, timestamps, token counts) — not full generated bodies beyond what's needed.

---

## 12. Rollout

- **Phase 1 (MVP — this spec):** button → fill all existing form fields → validate → review → publish. `ai_listing_generations` table + plan-tiered quota. Service + Offer + FAQPage JSON-LD at render time. Regenerate + tweak box (Sonnet). Guardrails.
- **Phase 2:** dedicated `meta_title`/`meta_description` columns, BreadcrumbList + Provider/LocalBusiness schema, prompt caching (cut input cost ~90%), quality/analytics dashboard, per-field regenerate.
- **Phase 3:** multi-language, A/B test AI vs. manual listings on ranking/conversion.

---

## 13. Analytics & Instrumentation

Track: button clicks, generates, regenerates, edits-before-publish, publish rate, latency, token cost, validation failures, quota-block hits. Tie published AI listings to Search Console (indexation, rich results, impressions) to prove SEO impact. Emit via the existing PostHog stack.

---

## 14. Open Items

**Resolved (verified 2026-07-01):**
- ✅ **JSON-LD — reuse, don't rebuild.** `client/src/utils/seo.js` already has `serviceJsonLd` (Service+Offer+aggregateRating), `breadcrumbJsonLd`, and `faqJsonLd` (FAQPage). `ServiceDetail.jsx` already renders Service + Breadcrumb. **Only task:** wire the existing `faqJsonLd` into `ServiceDetail.jsx` (map `service.faqs` `{question,answer}`→`{q,a}`, combine with the Service node via array/`@graph`). No new schema builders.
- ✅ **Category source — reuse existing.** `hostGetCategories()` → `primary_category`, then `listServiceCategories(primary)` → `[{id,name,slug}]` (see `ServiceForm.jsx:398-409`). The generate endpoint fetches this same list server-side and constrains the AI's `category` output to those slugs only; omit if none fit. Never invent a category.

**Still to confirm during planning:**
1. Exact `long_description` HTML shape the RichEditor expects (so generated HTML renders cleanly).
2. Config location + values for the quota map (`Starter 1/6mo, Host+ 2/3mo, Studio 2/mo`) and Supreme bypass hook.
3. Success-metric baselines from current analytics (completion rate, time-to-publish).

---

## 15. Decisions Locked (from brainstorming, 2026-07-01)

| Decision | Choice |
|---|---|
| AI endpoint | New Express route/controller (`aiController.js`) — repo is Vite+Express, not Next.js |
| Model | Haiku 4.5 default; Sonnet 5 on regenerate |
| Structured output | Anthropic forced tool-use schema |
| Field scope | Existing form columns only (no `services` migration) |
| JSON-LD | Computed at render time from live fields |
| Who gets the button | All hosts (Starter included) |
| Quota | Plan-tiered rolling window: Starter 1/6mo · Host+ 2/3mo · Studio 2/mo |
| Quota unit | One session = 1 use (generate + unlimited regens on that draft) |
| Regenerate | Yes + optional tweak box |
| FAQs | `faqs` column already exists → FAQPage schema in MVP (no migration) |
| Required input | **Title only** — click fills every field |
