# Bolt 958 Support Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In-app support chatbot ("Bolt 958") that answers Meeticulous questions grounded ONLY on our `docs/` content via Postgres full-text search, cites sources, and escalates to a human on low confidence / no results / sensitive topics.

**Architecture:** Docs → `kb_chunks` (tsvector) seeded by a manual script. `botService.askBot()` runs a `ts_rank` RPC, gates on min rank + a sensitive-topic list, then calls Claude (Haiku via existing `@anthropic-ai/sdk`) forced to answer only from the retrieved chunks through a structured tool. Route persists the exchange and, on escalation, emails `SUPPORT_EMAIL` (reusing `sendEmail`). Client floating widget calls `/api/bot/ask` + `/api/bot/feedback` via `api.js`.

**Tech Stack:** Node/Express 4, Supabase (Postgres FTS + RPC), `@anthropic-ai/sdk@^0.110.0`, React 18 + Vite + Tailwind.

## Global Constraints
- One new secret only: `ANTHROPIC_API_KEY` (server-side; already installed dep + used by Write-with-Bolt). Add placeholder to `server/.env.example`.
- Retrieval = Postgres `tsvector` + `ts_rank`. NO pgvector, NO embeddings, NO new vendor.
- Grounded answers only — Claude answers strictly from retrieved chunks; never invents; cites source.
- Never a dead end — low rank / no chunk / sensitive topic → `escalate:true` + human-handoff message.
- Reuse: `anthropicClient.js` (key-optional client), `sendEmail` for escalation, existing security limiters, `api.js`.
- Mirror patterns: `server/services/ai/*`, `contactController.js`, integration `helpers.js` (`makeSbMock`).
- Design tokens: `font-heading` (Plus Jakarta) headings, default Poppins body, 4px borders, `rounded-xl`, existing color tokens only.
- Client tests: NO jest-dom import — use inline matchers already in `src/tests/setup.js` / `.getAttribute()`.
- Next migration version = **v3.83**. Run on BOTH DBs; keep schema-fallback until confirmed applied.

---

## File Structure
| File | Responsibility |
|---|---|
| `server/migrations/v3.83_bot_knowledge.sql` | `kb_chunks` + `bot_conversations` + `bot_messages` + GIN index + `search_kb_chunks` RPC + RLS lock |
| `server/scripts/seedKnowledgeBase.js` | Walk `docs/**.md`, chunk by heading, clear+reinsert `kb_chunks` |
| `server/services/botService.js` | `askBot({question, conversationId})` — retrieve, gate, call Claude, persist |
| `server/controllers/botController.js` | thin `ask` + `feedback` handlers; escalation email |
| `server/routes/botRoutes.js` | `POST /ask`, `POST /feedback` + limiter |
| `server/middleware/security.js` | +`botLimiter` (cost/abuse guard on the AI endpoint) |
| `server/server.js` | mount `/api/bot` |
| `server/.env.example` | `ANTHROPIC_API_KEY=` placeholder |
| `client/src/components/common/BotWidget.jsx` | floating bubble + panel, sources, 👍/👎, escalation state |
| `client/src/services/api.js` | +`askBot`, `sendBotFeedback` |
| `client/src/App.jsx` | mount `<BotWidget/>` app-wide (not on admin/auth) |
| `server/tests/unit/botService.test.js` | retrieval + grounding/escape + sensitive + unconfigured |
| `server/tests/integration/bot.test.js` | validation, feedback persistence, escalation email |
| `client/src/components/common/__tests__/BotWidget.test.jsx` | render, ask, citations, escalation |

---

## Task 1: Migration (schema + RPC)
`v3.83_bot_knowledge.sql`. Three tables; `tsv` GENERATED from `heading||content`; GIN index; `search_kb_chunks(query_text, match_count default 5)` SQL function returning rows with `ts_rank(...) as rank`, `where tsv @@ plainto_tsquery('english', query_text)`, `order by rank desc limit match_count`. Enable RLS on all three with NO anon/authenticated policies (service-role only — matches v3.69 RLS lock). Apply to staging + prod via Supabase MCP after file review.
- [ ] Write migration file
- [ ] Apply to staging (Tokyo) + prod (Mumbai)
- [ ] Verify tables + RPC exist (introspect)
- [ ] Commit

## Task 2: Seed script
`seedKnowledgeBase.js`. Recursive walk of `docs/` for `.md`; split each on `^#{1,6} ` headings; accumulate to 300–800-word chunks (split oversized bodies on paragraph). `delete from kb_chunks` then insert all (idempotent). Log inserted count per file. Mirror `seedEmailTemplates.js` bootstrap style (`require('dotenv').config()`, `supabaseAdmin`).
- [ ] Write script (self-check: chunker asserts on a sample doc)
- [ ] Run against staging, confirm counts
- [ ] Commit

## Task 3: botService (TDD)
`askBot({question, conversationId})`:
1. Guard empty question.
2. `supabaseAdmin.rpc('search_kb_chunks',{query_text:question, match_count:5})` (schema-fallback → treat missing as no results).
3. Filter `rank >= MIN_RANK` (0.02). No survivors → escalate.
4. `SENSITIVE_RE` (payment/refund/kyc/account access/login/password/payout) → escalate regardless.
5. If chunks: build system prompt (identity=Bolt 958; answer ONLY from chunks; cite; fixed handoff line + set escalate when uncovered/sensitive). Force tool `emit_answer{answer:string, escalate:boolean, source_ids:number[]}` via `anthropicClient.getClient()` (MODELS.generate=haiku). `!isConfigured()` → escalate (no throw).
6. Map `source_ids` → `cited_sources:[{source_file,heading}]`.
7. Persist: ensure conversation, insert user + assistant messages; return `{answer, cited_sources, escalate, conversationId, messageId}`.
Tests (mock `anthropicClient.getClient` + `supabaseAdmin` like `generateListing.test.js`): grounded answer w/ citation; no-chunk escalate; sensitive escalate; unconfigured escalate.
- [ ] Failing test → implement → pass → commit

## Task 4: Controller + routes + limiter + mount
Thin `ask` (validate `question` non-empty ≤2000 chars, optional `conversationId`) → `askBot`; on `escalate` send `sendEmail(SUPPORT_EMAIL, '[Bolt 958] Escalation', <question + conversation summary>)` best-effort (never blocks the reply). `feedback` (validate `messageId` uuid, `feedback∈{up,down}`) → update row. Add `botLimiter` (e.g. 20/min/IP) in security.js; mount `app.use('/api/bot', require('./routes/botRoutes'))`.
Integration tests (supertest + `makeSbMock`): missing question→400; bad feedback→400; feedback updates row; escalate path calls mocked `sendEmail`.
- [ ] Failing tests → implement → pass → commit

## Task 5: Client widget + api + mount
`api.js`: `askBot=(d)=>API.post('/bot/ask',d)`, `sendBotFeedback=(d)=>API.post('/bot/feedback',d)`. `BotWidget.jsx`: fixed bottom-right bubble; panel with message list, textarea, send; renders answer + `cited_sources` chips + 👍/👎 (calls feedback); `escalate` → human-handoff card (WhatsApp/email) instead of a fake answer; tracks `conversationId` across turns. Tokens: `font-heading`, `rounded-xl`, `border-4`, existing colors. Mount in `App.jsx` before `</ChromeContext.Provider>`, hidden on `/admin*`, `/hello-sloth`, auth pages.
Test (`vi.mock('../../../services/api')`): renders bubble; open+send renders answer+citation; escalate response renders handoff state. Inline matchers only.
- [ ] Failing test → implement → pass → commit

## Task 6: Verify + docs
- [ ] `cd server && npm test`
- [ ] `cd client && npm run build`
- [ ] Update `.env.example`; note seed command in docs/current-work.md
- [ ] Final commit

## Self-Review
Spec coverage: migration(T1)✓ seed(T2)✓ service(T3)✓ routes+escalation(T4)✓ widget(T5)✓ tests(T3-5)✓ env(T4/T6)✓. Retrieval=FTS/ts_rank✓ no embeddings✓. Grounded+cite+escalate in T3 system prompt+gates✓. Reuse sendEmail/anthropicClient/limiters✓. No new auth flow, no schema change without migration✓.
