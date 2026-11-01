# Current Work — Meeticulous
_Last updated: 2026-09-10_

## SEO: Google WRS fetch-failure root cause (ipGuard/rate-limit) — 2026-09-10

> **Status: PR open (`fix/api-fetch-google-wrs-root-cause`), not merged.** Follow-on to #1004/#1006/#1008 (which stopped a transient public-API fetch failure from forcing `noindex` on the BlogPost/HostProfile/ServiceDetail prerendered pages). This PR addresses the *server-side* root cause of those fetch failures.

- **Confirmed root cause, code side:** every per-IP rate limiter in `middleware/security.js` except `adminLimiter`/`botLimiter` used express-rate-limit's default `keyGenerator` (plain `req.ip`) instead of `getClientIp()` — so setting `CLIENT_IP_HEADER` on Render (the documented fix in `docs/cloudflare-edge-setup.md`) would NOT have protected `apiLimiter` (global 100/min) or any of the other limiters from a shared-edge-IP bucket. Fixed: all of them now share one `ipKeyGenerator`.
- **Confirmed root cause, recurring incident:** `docs/cloudflare-edge-setup.md` already documents a live incident (2026-07-23) where `CLIENT_IP_HEADER` being unset resolves `getClientIp` to Render's shared internal `10.x` proxy address, and a single auto-ban on it 403s the entire platform — recovered only by a manual SQL delete each time. Fixed at the code layer: `lib/ipBlocklist.js` now refuses to ever ban (or honour a ban on) a private/reserved IP, from any source (auto or manual), so this can't recur regardless of whether the `CLIENT_IP_HEADER` ops step is done.
- **Also relaxed:** `GET /api/host/:username` and `GET /api/host/:username/:slug` (public host profile + service detail reads — no auth) are now exempt from `ipGuard`/`offenseTracker` and from `apiLimiter`'s cap, mirroring the existing `/api/blogs` exemption. Other `/api/host/*` routes (search, availability, categories, username, services) are unaffected.
- **Still an OPS action, not code:** set `CLIENT_IP_HEADER=cf-connecting-ip` on Render (Step 9 of `docs/cloudflare-edge-setup.md`) — see that doc for how to find the right header.
- **Part B (Cloudflare AI-bot block) verification could not be run from this session** — outbound network access to `meeticulous.com` / `meeticulous-api.onrender.com` is blocked by this sandbox's egress policy. See the PR description for what to check manually.

## Prod deploy + CRM sends state — 2026-09-03

> **Status: LIVE on prod, confirmed on both tiers.** Full relationship-engine Phase 2 + the placeholder-email bounce fix are deployed and running.

- **Deploy — both tiers confirmed live:**
  - **Client → Vercel:** `deploy-vercel.yml` run #491 (`workflow_dispatch` on main HEAD `4f2ef9e` = the #940 merge) — **success**. Vercel is the primary client deployer; Vercel's own git integration is disabled for main, so only this workflow ships prod (path-filtered to `client/**`, or manual dispatch).
  - **Server → Render:** auto-deploys on every push to main (no GitHub Action). Confirmed via the `job_locks` leader-election table (the sandbox can't reach the server directly — proxy blocks the app domains): a **new Render pod** (`…-84cd676b99-tnd5r`) holds the freshest leases (renewed within ~1–2 min), replacing the prior pod — i.e. a fresh deploy is live and actively running the full cron suite, including the CRM workers (`crm-send-worker`, `crm-sequence-worker`, `crm-lifecycle-engine`, `crm-guest-engine`).
- **CRM sends are LIVE (`crm_admin_sends` = ON).** Corrected in `CLAUDE.md` (#939) after discovering the flag was NOT off as assumed: enabled on **prod Mumbai since 2026-08-27** (founder-enabled) and **staging Tokyo since 2026-09-02**. The flag stays FAIL-CLOSED in code; "on" is a `feature_flags` row. Instant pause: `UPDATE feature_flags SET enabled=false WHERE key='crm_admin_sends'` (effective within the 60s flag cache). Live guardrails on every send: governor cap (1/48h per subject), quiet-hours (09–20 IST), do-not-contact, email/WhatsApp opt-out.
- **Prod send-log review (Aug 24 → Sep 3):** 189 messages / 127 recipients — 107 WhatsApp sent, 54 email delivered, **7 bounced**, 21 skipped by the gate (0 cap breaches). Biggest event: a one-time "Inaugurators to Hosts" WhatsApp blast (~106, mostly Aug 24). Two cleanups from the review, both done:
  - **`fix/never-email-placeholder-addresses` (#940, merged + deployed):** 6 of 7 bounces were synthetic `p<phone>@users.meeticulous.app` phone-only addresses (never real mailboxes). New `isPlaceholderEmail` guard skips them in the CRM gate (`sendGate`, reason `placeholder_email`) AND at the universal provider chokepoint (`email/providers.getProvider` → benign no-op), so no path emails them.
  - **1 real bounce** (`arjunrv42@gmail.com`, dead mailbox) suppressed on prod via `email_unsubscribes` + `contacts.email_suppressed` (the auto-suppression on bounce only fires when the message has a linked `contact_id`; this one didn't).

## Relationship engine Phase 2 — PR-9 guests via contacts — 2026-09-02

> **Status: IN PROGRESS on `feat/crm-guests-relationships`.** Plan: `docs/superpowers/plans/2026-08-30-relationship-engine-phase2.md`. **Needs migration v3.139** (apply via Supabase MCP, staging first) — code is schema-fallback safe until then. Sends stay OFF. Server 2555 green, client 715 green.

The last Phase 2 item: extend the Relationship Desk to **guests** (bookers, in `contacts`) — **not** a parallel pipeline. The same pure `relationshipHealth` / `relationshipTouch` functions run over a guest-shaped subject and emit `touch_recommendations` with `subject_type='guest'` + `contact_id`; the Desk unions lead- and guest-backed recs.

- **The key reuse:** `relationshipHealth`'s dominant signal is time-since-a-meaningful-*human* interaction — which a guest almost never has. So for a guest the meaningful interaction **is a booking** (a real relationship event): feeding last-booking as `last_meaningful_interaction_at` makes health read as "hasn't rebooked in ~90d → cooling/at_risk" — exactly the guest signal — with **zero change to the pure functions**. Only actual customers (a paid booking) are processed; recent bookers read healthy → no rec, so the Desk stays high-signal.
- **v3.139:** `touch_recommendations.contact_id` + `contacts` touch-clock & health columns (mirror leads v3.133/v3.135).
- **`guestRelationshipEngine.js`** (60-min cron): pure ctx/subject/remap + `run()`. `touchGovernor` gains a `contact` subject (guests use the single `contacts.last_automated_touch_at` clock). `touchRecommendationService.complete` stamps a guest's contact clocks instead of a null-lead activity. `deskService` unions guest recs via a **separate** query that fails soft on a pre-v3.139 DB (the lead Desk never breaks). Client: guest rows carry a **Guest** badge and aren't drawer-clickable (no guest conversation view); quick-actions work the same.
## Relationship engine Phase 2 — two-clock lead header — 2026-09-02

> **Status: MERGED to main (#931).** Plan: `docs/superpowers/plans/2026-08-30-relationship-engine-phase2.md`. No migration. Server 2500 green, client 721 green.

A single "last contacted" line lies by omission — an automated ping makes a cooling account look freshly tended. The Relationship Desk cards now show **two clocks**: the relationship clock (time since a human last had a *meaningful* conversation) and the machine clock (time since the last *automated* touch), so "no human has spoken to them in 41d, but a bot pinged them yesterday" is visible at a glance.

- **Server:** `deskService.getRelationships` now also selects + flattens `last_automated_touch_at` (the field already existed on `leads` from v3.133; it just wasn't exposed). No migration.
- **Client:** `TwoClock.jsx` (pure, unit-tested) — the **human** clock is coloured by staleness (`>21d` amber, `>45d` red; the relationship-risk signal); the **machine** clock stays neutral, because recency of automation is not a health signal and must never be dressed up as one. Replaces the old single "Last real talk" line on each `RecCard`.

## Relationship engine Phase 2 — PR-8 sends-live proof + runbook — 2026-09-02

> **Status: MERGED to main (#928).** Plan: `docs/superpowers/plans/2026-08-30-relationship-engine-phase2.md`. No migration, no code-behaviour change. The PR shipped the **proof + runbook**; the actual flip is a founder-gated, staged operational step (below), NOT in the merged diff — `crm_admin_sends` stays OFF.

Turning `crm_admin_sends` ON is the moment the CRM goes from advisory to actually contacting people. Before that flip, this locks the invariant that **"sends ON" can never mean "uncapped / ungated"**.

- **Bypass audit — clean.** Both CRM send primitives already pass `sendGate.canSend` first: `emailService.send` (line 50) and `whatsappService.send` (line 46), and they are the only leaves `messageService.dispatch` calls. `NotificationEngine` is not used for CRM sends (only `touchGovernor` records). Birthday is a separate platform feature (its own `birthday_greetings` flag + the governor), deliberately not under `crm_admin_sends`.
- **`crmSendGateEnforcement.test.js`** — end-to-end proof with the flag ON: a clean subject reaches the provider exactly once; kill-switch off / do-not-contact / opt-out / a governor cap each skip WITHOUT touching the provider. Leaf providers (`sendEmail` / `aisensy.sendCampaign`) mocked; the real gate + governor delegation runs.
- **The flag stays FAIL_CLOSED in code forever** (`featureFlags.FAIL_CLOSED_KEYS`). "On" is a DB `feature_flags` row, revocable instantly.

### Go-live runbook (founder-gated — throw the switch, don't merge it)
1. **Staging first.** Enable `crm_admin_sends` on staging (Tokyo) only. Watch the CRM message log + governor skips for one full lifecycle cycle; confirm caps hold and volume is sane.
2. **Document** the staging result here.
3. **Prod flip** only after founder sign-off. This is a separate switch, not part of the PR.
4. **Rollback** = disable the DB row; sends stop instantly (fail-closed).

## Relationship engine Phase 2 — governor + health signals — 2026-09-02

> **Status: MERGED to main. PRs #925 (PR-7) + #927 (PR-7.5). No migration. Sends stay OFF (`crm_admin_sends` fail-closed) — these only add gating + sharpen targeting, they do not enable delivery.** Next: PR-8 (the sends-live proof), then two-clock header, then PR-9 (guests). Plan: `docs/superpowers/plans/2026-08-30-relationship-engine-phase2.md`.

### PR-7 — global touch governor (#925)
The MVP left the automated-touch cap fragmented: `sendGate` throttled CRM sends (1/48h over `crm_messages`), `touchRecommendationService` cooled the *same reason* for 14 days, and `birthdayGreetings` sent straight through `NotificationEngine` with **no cap at all** — so one person could get a cooling nudge + a birthday email + a milestone touch in the same window. PR-7 unifies them.

- **`services/crm/touchGovernor.js`** — the ONE master cap. `withinCap()` is a pure, source-agnostic decision (timestamps + cap/window → allow?); `canTouch()`/`recordTouch()` are the DB adapter over the automated-touch ledger every send already writes (`lead_activities` `is_meaningful=false` CONTACT rows, which also bump `leads.last_automated_touch_at`). **Fail-open** on a missing ledger or a read error — an outage never freezes legitimate sends. Subject resolution: `lead` direct, `profile` → its linked lead, `contact` → PR-9 stub.
- **`sendGate.throttle`** now delegates its cap to the governor (quiet-hours stays local), so a CRM send is capped against birthday/milestone touches too. `messageService` already logs a no-actor `email_sent`/`whatsapp_sent` on every send → CRM sends were already in the ledger, no double-recording.
- **`birthdayGreetings`** consults `canTouch` before sending (capped → skip WITHOUT stamping `birthday_greeted_at`, so it retries when the window clears) and `recordTouch` after — closing the bypass. Hosts resolve to their lead ledger; a pure guest with no ledger fails open until PR-9.
- **Config:** `CRM_TOUCH_CAP` (default 1) / `CRM_TOUCH_WINDOW_H` (default 48) in `server/.env.example` — defaults match sendGate's prior ceiling, so this is not a behaviour change for CRM sends, only an extension to the rest.

### PR-7.5 — health negative-signal wiring (#927)
`relationshipHealth.compute` already read `ctx.supportOpen` / `ctx.negativeFeedback` (soft signals: one caps at `cooling`, two reach `at_risk`) but nothing populated them — the docstring literally said "wired in a follow-up". This is that follow-up: `lifecycleEngine.loadAccountCtx` now derives both, so an unhappy host stops reading as `steady`/`thriving`.

- **`sentimentSignals()`** (pure, exported, unit-tested) — `supportOpen` = an escalated, unresolved host support thread (`support_threads` `participant_type='host'`, status `waiting`/`assigned`; `bot` isn't a human issue yet and `resolved` is closed); `negativeFeedback` = a poor support rating (`support_threads.rating ≤ 2`) OR a recent (≤90d) vendor complaint / low rating (`feedback` v3.20 `type='complaint'` or `rating ≤ 3/10`).
- `loadAccountCtx` adds two batched, fail-soft reads (a missing table yields no signal, never a throw) and merges the two booleans into each profile's ctx. **`compute` is unchanged** — the whole point of its purity. `reviews` (guest↔host) are deliberately excluded: they're not the host's sentiment toward *us*.
- Health recomputes on the next 15-min lifecycle tick.


## Host notification system overhaul + AiSensy fix + admin badge — 2026-08-29

> **Status: ALL MERGED to main + LIVE. PRs #855–#861, #863, #864. Migrations `v3.130`/`v3.131`/`v3.132` applied via Supabase MCP on BOTH DBs (prod `PROD_PROJECT_REF` + staging `STAGING_PROJECT_REF`), verified identical. Full client vitest 704 green (Vercel gate). Prod redeployed & healthy.**

Full audit ("Host Signal") of the HOST notification experience, then a phased rebuild. Root problem: **three disconnected notification systems** — a mature email/WhatsApp `NotificationEngine`, a thin poll-only in-app bell (`in_app_notifications`, v3.39) with a `type` vocabulary disconnected from the engine's `event` keys, and founder-only `adminAlert`. The same event was wired twice and drifted — which is how the host new-booking bell entry got forgotten.

- **P0 bugs (#855).** Dashboard bell ignored `n.link` (dead-end clicks) and read `n.message` while the table stores `body` (blank bodies) → converted to the navbar's `<Link>` pattern + render `body`. New-booking in-app insert was **guest-only** → added the host `BOOKING_NEW` bell. Fixed two dead deep-links: review → `/dashboard/clients` (was `/user/reviews`, a guest 404) and calendar-disconnect → `/dashboard/profile` (was `/dashboard/settings`, no such route).
- **P1 unify (#856, migration `v3.130`).** Made in-app a **channel of `NotificationEngine`**: one `send()` fans out to email + WhatsApp + in-app, gated by a new `notification_events.in_app_enabled` flag (mirrors `whatsapp_enabled`); callers pass `data.inApp {title,body,link}`. Closed two silent host events — `SUBSCRIPTION_HALTED` (failed renewal; was only a CRM WhatsApp nudge behind the OFF `crm_admin_sends` kill-switch) and `REFERRAL_REWARD_RELEASED` — each email + in-app, with 2 new email templates.
- **P2 realtime + dedupe (#857, migration `v3.131`).** Bell updates live via a service-role Supabase broadcast (same mechanism as support chat); `useLiveNotifications` subscribes both bells. Added `in_app_notifications.dedupe_key` + partial unique index; `inAppNotify` skips duplicate `(user_id, dedupe_key)` (stops the confirmation reconciler / cron re-runs stacking bell rows). Bell loading + error/retry states (errors were silently swallowed).
- **P2.1 polish (#858).** Navbar bell loading/error parity; acks for `ONBOARDING_COMPLETE` ("You're live") and `KYC_SUBMITTED` ("Documents received"); dedicated `inAppNotify` unit test (dedupe / 23505 race / schema-fallback). **Hardened the realtime topic**: was a guessable `notif:user:<id>` (anyone knowing a user id could subscribe and observe pings) → now HMAC-derived (`utils/notifChannel.js`), fetched from an authed `GET /api/notifications/channel`.
- **Resolution (#859, migration `v3.132`).** `inAppNotify.resolveInApp({userId,type?,dedupeKey?})` marks matching unresolved rows read + stamps `resolved_at` + pings the bell, so a notice stops "shouting" once fixed. Wired: KYC approved → clears `KYC_REJECTED`; subscription charge → clears `SUBSCRIPTION_HALTED`.
- **Admin ops "needs attention" badge (#861, #864).** The red bell dot = `opsAdminController.getSummary` (`totalAttention`), NOT read/unread — it's a live work-queue. It counted failed emails/notifs **all-time** (stuck at 66 on prod, 60 stale) → windowed to **14 days** (#861); and counted **all** unverified hosts including abandoned signups → scoped to `onboarding_completed=true` (#864). Badge 66 → 2. One-time data op: flipped 46 + 13 stale failed-log rows to `status='acknowledged'`.
- **AiSensy "Booking Confirmed" WhatsApp mismatch — RESOLVED + PROVEN.** Online bookings appended the Meet link as a **5th** param → the 4-var AiSensy template rejected them (`"Template params does not match the campaign"`); offline bookings sent 4 and worked (why it looked intermittent). Current `main` sends 4 on every confirmed path (#649 already fixed it) — the failures were a **stale prod deploy**; today's redeploys pushed 4-param live. Proven with a direct AiSensy send of 4 params → `{"success":"true", submitted_message_id}` HTTP 200, delivered to a real phone. Regression test **#863** (`bookingConfirmedParams.test.js`) locks confirmed sends to exactly 4 `templateParams`.
- **Host verification.** `is_verified` gates Explore listing + sitemap indexing ("go live"). Approved one onboarding-complete host with a real service (Tatharth Ghate); held another with **0 services** (would list an empty profile) until they add one.

### LANDMINES (this sprint)
- **Realtime topic is public broadcast.** Supabase broadcast topics have no per-user RLS (no client has a Supabase-auth session here). The bell topic is HMAC-derived so a raw user id can't derive it; pings carry no content (`{role,type}`), the client refetches through the authed REST feed.
- **`v3.130` filename collision.** Two `v3.130_*.sql` on disk (CRM `merge_lead_rows_fn` + `notification_in_app_channel`), both applied — cosmetic only; Supabase MCP names migrations independently.
- **AiSensy `api_key` is a plaintext JWT** in `notification_providers`. The "Booking Confirmed" campaign accepts exactly **4** body params; a 5th fails. Keep code `templateParams` length in sync with the approved template (confirmed = 4, reminder = 5).
- **Concurrent peer session.** A second session was active on `redesign/booking-details-step` in the same working dir all day — all commits went through **isolated git worktrees off `origin/main`** (never switch the shared branch; it corrupts the peer's checkout).
- **Ops badge is a work-queue, not notifications.** It only clears when the underlying items are resolved or fall outside their window — there is deliberately no "dismiss."

## Bolt abuse-gate hardening (#490) — MERGED 2026-07-23 (kept after review)

> **Status: MERGED to main (`de0a70e`). server 1693/1693. Merged outside the authoring session (GitHub UI / another session). Reviewed post-merge — deliberately KEPT, not reverted.**

Implemented the four abuse-gate follow-ups that #488 deferred. The whole gate is **live in prod** (`BOT_ROAST_ENABLED` is set in the Render dashboard — NOT in any repo `.env`, so it's invisible to a repo grep; confirmed by a curl probe returning a roast, not a KB answer).

- **Per-IP strikes (`lib/botStrikes.js`).** Strike count now keys on the resolved client IP instead of the client-supplied `conversationId` (which an abuser rotated/omitted to reset strikes to 0 every message). Durable + cross-instance via the shared rate-limit store when `RATE_LIMIT_STORE_URL` is set; in-memory fallback otherwise. No-IP requests fall back to the legacy per-conversation count. **Live now** (roast flag on).
- **Durable → APP-WIDE IP ban.** Bot threats now ban via the DB-backed, admin-visible `ipBlocklist` (`recordAttack`) instead of an in-memory `Map` that died on restart and was invisible to the admin Blocked-IPs UI. **Deleted `lib/botIpBlock.js`.** ⚠️ **Behaviour change / reverses #488's bot-scoped block:** a threat (danger tier only — violence/self-harm, NOT rudeness) now bans the IP **site-wide**, TTL-bounded, allowlist-safe. **Only activates if `BOT_THREAT_IPBLOCK_ENABLED` AND the IP-block master switch are set in Render** — state there unverified, so this may be dormant.
- **Threat cool-off.** Threats now weigh 2 toward the strike lock, so a threat-only spammer trips cool-off, not just the ban (previously threats returned before the strike check).
- **Budget fail-closed.** The abuse Haiku judge now denies on a budget-store error (skips the roast) instead of failing open and letting a flood keep spending; user-facing summary/generate paths keep the default fail-open.
- **Config.** `.env.example`: `BOT_STRIKE_MAX` + `BOT_STRIKE_WINDOW_SECONDS`; dropped now-unused `BOT_THREAT_BLOCK_SECONDS` (block TTL comes from the IP-block config).
- **Review outcome:** the audit had parked these as low-severity/latent (the gate is largely cosmetic roasts; spend is already bounded by `botBudget`). The one real behaviour change is the app-wide ban. After weighing it, the decision was to **leave #490 merged as-is** rather than revert. If the app-wide ban later proves undesirable, revert just that piece (restore a bot-scoped block) while keeping the three safe fixes.

## Bolt support bot — 4-area gap audit + fixes (#488) — MERGED 2026-07-23

> **Status: MERGED to main (`ec17cc0`). server 1696/1696, client build green (114 routes). Both DBs reseeded (kb_chunks: prod 70 chunks/70 embeddings, staging 70 FTS-only — no VOYAGE key on staging).**

Ran four parallel audits of the Bolt support bot (KB/FAQ, escalation, intent layer, abuse gate). Fixed the live + actionable gaps across 17 files.

- **KB / FAQ (live — bot serves these).** Removed the nonexistent "phone + password" login claim; corrected Google Calendar from "one-way" to **two-way**; reconciled two conflicting onboarding step lists to the real Google-first flow; stated Starter's **5% commission** explicitly and consistently (was "small commission" in one doc, hard 5% in another); added an IST time-zone answer and a guest account/data-deletion answer; dropped "message the host directly" (no messaging feature exists). **Post-merge:** required a `kb_chunks` reseed on BOTH DBs — done.
- **Escalation (always-on).** `escalationService.recordAndNotify` destructured only `{ data }` — supabase-js resolves `{ data, error }` and **never throws** on a query error, so genuine insert failures went silent with `escalationId:null`; now checks `error`. Transcript fetched once (was twice). `listEscalations` is now schema-fallback safe for the v3.90 `rating` column (was a hard 500 risk). WhatsApp replies can now be **logged** (wa.me send is manual) so the thread has an audit trail and status advances — server accepts `channel:'whatsapp'`, `EscalationsPage` offers it.
- **Intent layer.** The payments clarify chip + cards sent "How do payments and **refunds** work?", which trips `SENSITIVE_RE` and **escalates to a human** instead of hitting the deterministic payments handler. Reworded to "payments and invoices" so the chips route as intended; refund *requests* still escalate by design. Added a regression test asserting no intent-layer `send` value contains a sensitive term.
- **Abuse gate.** Bot resolved IP via raw `req.ip` in `ask`/`askStream` (and `botLimiter`), unlike every other consumer — now uses `getClientIp` (honours `CLIENT_IP_HEADER`), so the IP-block/rate-limit path keys on the real client behind an edge proxy. Already-blocked IPs are now enforced **before** the `BOT_ROAST_ENABLED` gate, so a block survives the roast flag being toggled off. All bot flags + `CLIENT_IP_HEADER` documented in `.env.example` (were undiscoverable).
- **LANDMINE — supabase-js NEVER throws on a query error.** It resolves `{ data, error }`. Any `try { const { data } = await supabase…() }` that ignores `error` swallows real failures silently. Check `error` (or `if (error) throw error`) everywhere the failure matters.
- **DEFERRED (latent — whole abuse gate is flag-OFF by default, `BOT_ROAST_ENABLED` unset):** per-IP strike aggregation (strikes key on client-supplied, rotatable `conversationId`); durable IP-block store (`lib/botIpBlock.js` is an in-memory Map — lost on restart, single-instance, invisible to the admin "Blocked IPs" UI); threat cool-off; model-budget fail-open on store error. Intent layer also still dead in prod (`BOT_INTENT_ENABLED` unset).

## Bolt 958 support bot — Phase 1 (knowledge bot) — branch `feat/bolt-958-support-bot`

> **Status: BUILT on branch (not merged). Migration v3.83 APPLIED + verified on BOTH DBs. server 1489/1489 + client build green. Grounded answers need `ANTHROPIC_API_KEY` (present on Render, ABSENT in local `server/.env` — so the bot escalates on every question locally, by design).**

In-app support chatbot that answers Meeticulous questions grounded ONLY on our own `docs/`, cites sources, and escalates to a human on low confidence / no match / sensitive topics. No embeddings, no new vendor — Postgres full-text search.

- **Retrieval = Postgres FTS, not embeddings.** `kb_chunks(source_file, heading, content, tsv GENERATED, GIN)` + `search_kb_chunks(query_text, match_count)` RPC returning `ts_rank`. Seeded from `docs/` by `server/scripts/seedKnowledgeBase.js` (heading-aware, ~300–800-word chunks, clear+reinsert; `--check` self-tests the chunker). **809 chunks / 149 docs on staging.**
- **LANDMINE — `plainto_tsquery` ANDs every lexeme.** A long question ("how many services can a Creator vs Professional host have?") then requires ONE chunk containing every word → matched nothing → always escalated. The RPC flips `&`→`|` (OR match; `ts_rank` still floats the best hits). Verified via direct SQL. If you ever recreate this RPC, keep the OR flip.
- **LANDMINE — `docs/` is DEVELOPER docs, not a help centre.** Seeding all 149 files pulls in specs/plans/blog drafts that share keywords with real answers and out-rank them, so the bot honestly escalates a lot. `MATCH_COUNT=8` + an answer-by-default system prompt mitigate it. Real fix later = a curated user-facing help corpus (or exclude `superpowers/`, `*-plan.md`, blog drafts from the seed).
- **Grounding + escalation.** `server/services/botService.js` `askBot()`: RPC → filter `rank >= MIN_RANK (0.02)` → sensitive-topic regex (payments/refunds/KYC/account access → always escalate, per spec) → Claude **Haiku** forced through an `emit_answer` tool that answers ONLY from the numbered sources. Never a dead end: no match / sensitive / unconfigured key / model or DB error all escalate with a fixed human-handoff line. Persists to `bot_conversations`/`bot_messages` best-effort.
- **Escalation reuses the email engine** — `botController` emails `SUPPORT_EMAIL` (bolt@meeticulous.in) with the transcript via `sendEmail` (same as `contactController`), best-effort so a mail failure never breaks the reply.
- **Routes:** `POST /api/bot/ask`, `POST /api/bot/feedback` (both `botLimiter`, 20/min/IP — the ask path costs an Anthropic call). Public, no auth. Client: floating `BotWidget.jsx` mounted app-wide in `App.jsx` (hidden on admin/onboarding/auth/error), calls via `api.js` `askBot`/`sendBotFeedback`, renders answer + cited-source chips + 👍/👎 + a human-handoff card on escalate.
- **Tests:** `server/tests/unit/botService.test.js` (7, Anthropic+Supabase mocked — proves grounded answer + citation mapping + every escape path), `server/tests/integration/bot.test.js` (9, validation + escalation email + feedback), `client/src/components/common/__tests__/BotWidget.test.jsx` (4). Live browser smoke confirmed the widget renders/sends/escalates cleanly and feedback persists (👍 → `POST /bot/feedback 200`); the grounded path is proven by the mocked unit test + live SQL retrieval (local has no key).
- **TO SEED PROD:** run `node scripts/seedKnowledgeBase.js` from an env whose Supabase creds point at prod (`.env.production`) — the script targets whatever `server/.env*` is loaded (default `.env` = staging). Re-run whenever `docs/` changes.

## Deploy: prerender no longer flakes a merge's prod deploy (#405) — MERGED 2026-07-18

> **Status: MERGED to main (`f734362`). Every merge to main already auto-deploys prod (`deploy-vercel.yml`, `on: push:[main]`, token-authed) — this removes the one thing that ever forced a manual re-run.**

`client/scripts/prerender.mjs` retried a timed-out route **in place**, so a burst of adjacent `/lp/*` routes saturating the 4-wide pool (and/or hitting a cold backend) re-entered the same jam and failed the whole deploy — even though the same routes rendered fine seconds later. Now two passes: the pool **defers** stragglers instead of retrying in place, and a **serial** second pass re-renders them one at a time on a now-idle builder at 60s. Fail-on-any-miss guard unchanged, so a genuinely broken route still stops the release.

## Blog: index redesign + paging (#381) and a real 301 on `/blogs` (#382) — MERGED 2026-07-16

> **Status: MERGED to main (`2aed5f1`, `a1da54c`), deployed and verified live. No DB migration, no API change — the blog list endpoint was already returning everything this needed. CI green both.**

`/blog` was a wall of text cards, and `meeticulous.com/blogs` — the plural everyone types — 404'd.

- **Card art was already built, just unused.** Post pages generate category-themed SVG heroes (`BlogHeroThumbnail`); the index rendered none. `GET /api/blogs` already returned `image` + `icons`, so the index now renders the *same component* — index and post agree by construction, with no server change. `BlogHeroThumbnail` now takes its pattern canvas as `w`/`h` props (defaults = the old 600×500) because the tall hero box clipped the scatter pattern inside the index's short wide cards.
- **Hover: the underline came from CSS, not the cards.** Hovering a card underlined *every line of text in it* and forced brand orange regardless of category. Cause was `.blog-page a:hover { text-decoration: underline }` in `index.css`, outranking the cards' own `hover:no-underline`. Deleted at the source rather than patched per link. Heading + CTA now tint to the post's own category via a `--card-hov` var reusing `CATEGORY_THEME.chipFg` (already the darkened band, already contrast-checked on white).
- **Paging is client-side on purpose:** `GET /api/blogs` returns every post in one payload, so slicing costs nothing and needs no API change. 13/page = 1 featured + 12 in the 2-col grid. Pages are URLs (`/blog?page=N`) so they stay shareable/crawlable/middle-clickable, and the SEO canonical follows the page. Junk and out-of-range values clamp to a real page instead of rendering an empty list. **Revisit when the post count outgrows one response.**
- **LANDMINE — the index byline is `post.author`, the card is one big `<Link>`.** It renders as plain text, NOT an author link to `AUTHOR_URL`: `<a>` inside `<a>` is invalid markup and browsers silently unnest it. The post page's `AuthorLink` is fine — it isn't nested in a card link.
- **LANDMINE — post body links are drawn with a background-image, not the usual `::after`.** The hover underline-wipe (`.blog-link`, `index.css`) uses `background-size: 0% → 100%`. An absolutely-positioned `::after` only covers the *first line box*, so a link that wraps mid-sentence — which prose links do — would underline its first line and leave the rest bare. Do not "simplify" it back to a pseudo-element. Honours `prefers-reduced-motion` (underline appears, wipe doesn't).
- **LANDMINE — `/blogs` needs BOTH redirects, neither is dead code.** `client/vercel.json` 301s at the edge for crawlers; `BlogsRedirect` in `App.jsx` covers what that cannot — local dev (`vercel.json` doesn't apply off Vercel) and in-app `<Link>` navigation (never reaches the server). `blogs` is in `reservedSegments.js` so it can't be claimed as a username; the sync test enforces that.
- **Why `redirects` and not `rewrites` (#382):** a rewrite serves `/blog`'s content at `/blogs` — still a 200, still a duplicate URL, which was the actual problem. Only a redirect emits the 301. `statusCode: 301` rather than `permanent: true` (which emits 308) — both are permanent to Google, 301 is what SEO tooling expects. Vercel evaluates `redirects` before `rewrites`, so the catch-all `index.html` rewrite doesn't swallow them.
- **Verified live after deploy** (`curl -I`): `/blogs` → 301 → `/blog`; `/blogs/:slug` → 301 with the slug preserved, resolving in one hop; `/blog` still 200.
- **First test coverage this page has ever had:** `client/src/pages/__tests__/Blog.test.jsx` (9 tests — page sizes, the clamp, pager visibility, byline). **TESTING LANDMINE:** the footer CTA link renders during the loading skeleton, so a plain `findAllByRole('link')` resolves *before any post exists* and silently asserts on zero cards. The helper waits for post links specifically — that wait is load-bearing. Mutation-checked: set `PER_PAGE` to 10 and the suite fails.
- **Deliberately NOT done:** category filters on the index; server-side paging; renaming the `blogs.author` rows (still `"Bolt 958"`, which the post page and the SEO JSON-LD author read). `readMins` is now unused on the index but still drives the post page's "N min" stat — the field stays.

## Fix: KYC flow state reset — hosts stuck on step one (#374 / #376) — MERGED 2026-07-16

> **Status: MERGED to main (`3b6c7c8`, `7373f12`), deployed. No DB migration. CI green (client 4m12s, server 40s, smoke).**

Hosts could never get past the first KYC step: every **Continue** landed them back on *Personal details* with PAN/Aadhaar wiped. The KYC flow (v3.68) had been broken this way since it shipped.

- **Root cause — a routing/animation interaction, not a KYC bug.** `DashboardLayout` renders every page inside `PageTransition`, whose `motion.div` is keyed on the pathname. `KycProvider` sat *below* that, inside `KycFlow`. Each step navigation changed the key → framer-motion unmounted the subtree once the 180ms exit finished → the provider remounted with `EMPTY_PERSONAL`/`EMPTY_BANK` → `Guard` recomputed every step as not-done and redirected to `/flow/start` → which changed the pathname again. Name/email/phone appeared to survive only because `KycStart`'s prefill effect refills them from the account, which is why it read as "it forgets my PAN".
- **Fix (#374):** mount `KycProvider` in `App.jsx` **above** `DashboardWrapper`, so it sits above `PageTransition` and stays mounted across steps. `KycFlow` now only consumes the context. Pages still animate; the flow state no longer dies with them.
- **LANDMINE — any future multi-step flow under `/dashboard`:** its state provider MUST be mounted above the layout, in the route element in `App.jsx`. A provider below `PageTransition` remounts empty on every step. `/dashboard/kyc/flow` is currently the ONLY route nesting children under `DashboardLayout` (the `GuestLayout` group sits outside it), so there are no other instances today.
- **TESTING LANDMINE:** `AnimatePresence mode="wait"` keeps the outgoing subtree mounted through its exit animation, so **a test that asserts immediately after navigating passes even when the provider is doomed to remount**. `client/src/tests/KycFlow.test.jsx` waits for the exit to settle before asserting — that wait is load-bearing, not flake padding. Verified both ways: fails with the provider inside `KycFlow`, passes with it hoisted.
- **Deliberately NOT done:** keying `PageTransition` on the matched route pattern instead of the raw pathname. It would break the animation it exists for (`/dashboard/service/edit/1` → `/edit/2` is the same pattern), and RR 6.20 has no cheap pattern accessor here (`useMatches` is data-router-only; this app uses `<BrowserRouter>` + `<Routes>`), so it would mean `UNSAFE_RouteContext` on the component every dashboard page renders through. Wide blast radius, zero current instances. Recorded as a comment on `PageTransition` itself instead (#376).

## Sprint: Service Category Redesign (branch `feat/service-categories`) — built 2026-07-02

> **Status: BUILT.** Migration split into a zero-downtime pipeline `v3.60`→`v3.61`→`v3.62`→`v3.63`, NOT yet applied to either DB. Full release runbook: `docs/releases/2026-07-03-service-category-v3.60-release.md`.

**Spec / plan:** `docs/superpowers/specs/2026-07-02-service-category-redesign-design.md`; `docs/superpowers/plans/2026-07-02-service-category-redesign.md`.

Closes the gaps left by the 2026-06-21 service-categories build (below): categories are now a composite-FK-enforced pair instead of a loose slug, and the category catalog gets public SEO landing pages + a live Explore listing.

- **Migration set (PENDING both DBs) — zero-downtime 4-phase split:** `v3.60_service_category_expand.sql` (additive only: nullable `services.primary_category`, `service_categories.description`/`.icon`, `CREATE INDEX CONCURRENTLY idx_services_prof_cat`); `v3.61_service_category_backfill.sql` (data only, idempotent plain statements + optional batched `PROCEDURE` for scale: orphan `service_categories` cleanup, stamp the pair from the host's profession where valid, clear stale unpaired rows); `v3.62_service_category_validate.sql` (read-only gate, RAISEs if any constraint precondition is unmet); `v3.63_service_category_enforce.sql` (composite FK `fk_services_category` + `fk_sc_primary` + CHECK `chk_category_pair`, each `ADD ... NOT VALID` then `VALIDATE CONSTRAINT` to avoid scan-under-strong-lock). Rollback for the enforce phase: `v3.63_service_category_rollback.sql`.
- **Server:** `resolveAndValidateCategory` (`server/lib/serviceCategory.js`) now returns `{ok,value,primary}`; both service writers (`serviceController.js`, `hostController.js`) stamp the pair, with 42703 schema fallbacks for pre-migration DBs. `PUT /api/host/categories` de-categorises services on profession change and returns `services_cleared` in the response. `serviceCategoryController.js` gained description/icon fields, a friendly 400 on FK violation (23503), and a cached public list (`responseCache`, key `svccat:`, `Cache-Control: 300`); all 4 admin mutations bust `svccat:` + `svcdir:` + sitemap cache.
- **New public endpoints:** `GET /api/services-directory` + `GET /api/services-directory/:profession` (`servicesDirectoryController.js`/`servicesDirectoryRoutes.js`, cached `svcdir:`, template description fallback, 404 for unknown/empty professions). Real `GET /api/explore` `listVendors` (profession `category` + `service` params; `service` requires `category` else 400; verified hosts only; paginated). `/sitemap-professions.xml` added as a sitemap-index child.
- **Seed:** `serviceCategorySeed.js` entries are now `string | {name, description}`; 10 professions with curated descriptions (photographer added). `seedServiceCategories.js` gap-fills `description` where NULL — **re-run on both DBs after v3.60 applies**.
- **Client:** new public routes `/services` (`ServicesDirectory.jsx`) + `/services/:profession` (`ProfessionServices.jsx`), built on `ServiceCategoryCard` + `professionIcons.js`; `services` added to `reservedSegments`. **Explore page goes live** (`COMING_SOON` stub removed) — real API listing, `service` filter chip, stale-async-response guard (`e7c3672`, review finding). `AdminServiceCategories` modal gained description/icon fields; `CategoriesSection` toast now surfaces `services_cleared`.
- **Ops (zero-downtime Expand→Deploy→Backfill→Validate→Enforce):** the enforce-phase CHECK/FK reject the OLD server's `category`-without-`primary_category` writes (23514/23503), so enforcement must never precede the new server. Split so each phase is independently safe. Order, staging Tokyo first then prod Mumbai, once per DB: **(1)** apply `v3.60` expand (additive, invisible to old code — safe even before deploy); **(2)** merge + deploy SERVER (new code writes complete pairs; still forward-compatible via 42703 fallbacks); **(3)** apply `v3.61` backfill; **(4)** run `node server/scripts/seedServiceCategories.js` (idempotent gap-fill of descriptions); **(5)** apply `v3.62` validate — a raised exception here is a hard STOP; **(6)** on green, apply `v3.63` enforce; **(7)** deploy client. Rollback the enforce phase with `v3.63_service_category_rollback.sql` (drops the 3 constraints, instant, no data change). Full step-by-step with health checks + rollback per stage: `docs/releases/2026-07-03-service-category-v3.60-release.md`.

## Sprint: Guest/Host URL Separation (branch `feat/guest-host-url-separation`) — built 2026-06-24

> **Status: BUILT, tests green (client 254/254, server 758/758, client build clean). NOT merged. No DB migration.**

**Spec / plan:** `docs/superpowers/specs/2026-06-24-guest-host-url-separation-design.md`; `docs/superpowers/plans/2026-06-24-guest-host-url-separation.md`.

Separate-account model enforced at the routing layer (**supersedes** the unified-account decision in the 2026-06-23 account-role-separation spec). Guest = phone identity, host = email identity; one identity = one type.

- **Guest space → `/user/*`:** `/user/my-bookings`, `/user/profile`, `/user/reviews`, `/user/loyalty`. Old flat paths are bare `<Navigate replace>` redirects (in-flight email links / bookmarks keep working).
- **Two-way role wall:** new `HostRoute`/`GuestRoute` (`client/src/components/common/`) compose the existing `ProtectedRoute` (auth + onboarding-resume untouched) and add a role gate. Guest on `/dashboard/*` → guest equivalent (`hostPathToGuestPath`); host on `/user/*` → `/dashboard`. Shared `isHost(user)` + path map in `client/src/utils/roleRoutes.js`. No feature flag — the wall is un-toggleable.
- **Leave-review `/review/:bookingId` stays shared** (role-agnostic, ownership-checked, top-level — NOT under /user) so either party can use the booking-completed email CTA.
- **`become-host` in-place role flip removed** (client `activateHost` + CTAs in BecomeAHost/Dashboard; server `POST /auth/become-host` route + `becomeHost` handler + its test). "Become a host" now routes to host signup (separate email/Google account). Dashboard's dead guest branch → `<Navigate to="/user/my-bookings">`.
- **Server/static:** email footer link → `/user/my-bookings`; `robots.txt` → `Disallow: /user/`; removed the auth-gated `/reviews` entry from the sitemap.
- **Reserved usernames** extended (`review`, `refund`, `lp`) so a host slug can't shadow a top-level route (`user` was already reserved).
- **Verification note:** E2E preview of the wall is blocked headlessly — `supabase.auth.onAuthStateChange` emits `SIGNED_OUT` and wipes any injected `localStorage` session. Covered instead by `RouteGuards.test.jsx` (real guard components, both directions + superadmin) + `roleRoutes.test.js`.

## Sprint: Service Categories (branch `feat/service-categories`) — built 2026-06-21

> **Status: BUILT, tests green (server 626/626, client 177/177, client build clean). NOT merged. Migration `v3.22` NOT yet applied to either DB.**

**Spec / plan:** `docs/superpowers/specs/2026-06-20-service-categories-design.md`; `docs/superpowers/plans/2026-06-21-service-categories.md`.

Each **service** now carries one `category` slug, drawn from the host's own categories (`profiles.categories`, primary-first; from PR #107). Built on top of #107 — fills the gap it left (#107 reworked *host* categories only, never touched `services`).

- **Migration `v3.22_service_category.sql` (NOT applied):** adds nullable `services.category TEXT` + `services_category_idx`. Additive/safe; no backfill.
- **Validation:** shared pure validator `server/lib/serviceCategory.js` (`validateServiceCategory` + `resolveAndValidateCategory`). Enforced server-side in BOTH service backends — `serviceController` (`/services`, dashboard) and `hostController` (`/host/services`, onboarding), create + update. A category not in the host's `profiles.categories` → 400. `host_id` always `req.user.id`.
- **Pre-migration tolerant:** `category` added to `V2_SELECT_COLS`; `hostController` safe-fallback regex broadened to include `category`; writes drop `category` gracefully until the column exists (currently load-bearing since v3.22 unapplied).
- **Client:** `ServiceCategoryPicker` (auto-chip when host has 1 category, single-select chips when 2–3), wired into dashboard `ServiceForm` + onboarding `FirstServiceStep`, default = `primary_category`. Category **badge** on dashboard list (`Services.jsx`) + public page (`ServiceDetail.jsx`, server-resolved `category_label`). slug→label via `categoryUtils.categoryLabel`.
- **Deferred (follow-ups):** Explore filter by category; sharpen `admin_category_stats()` to count by the service's own category; guard against null-wiping a category on update for a 0-category host; client retry if the host-categories fetch fails.
- **Ops:** `v3.22` **applied** to both Supabase projects (prod Mumbai `PROD_PROJECT_REF` + staging Tokyo `STAGING_PROJECT_REF`), verified 2026-07-01.

## Sprint: Industry Categories (branch `feat/category-system`) — built 2026-06-20

> **Status: BUILT, tests green (server 616/616, client 171/171, client build clean). NOT merged. Migration `v3.21` NOT yet applied to live DB.**

**Spec / plan:** `docs/superpowers/specs/2026-06-20-industry-categories-design.md`; `docs/superpowers/plans/2026-06-20-industry-categories.md`.

- **Migration `v3.21_industry_categories.sql` (NOT applied — destructive):** `categories` gains `group_label` + `status` enum `+disabled`; replaces the 11-row seed with the curated **60** (20 `active` Day-1 / 40 `disabled` Day-30+60); adds `profiles.primary_category`; clears host arrays referencing the old slugs; adds per-plan `limits.categories` (starter `0` locked / creator `1` / professional `3`); adds `admin_category_stats()` RPC (registered hosts + active services per category).
- **Plan caps** mirrored in `planService.FALLBACK_PLANS` (starter 0 / creator 1 / professional 3) and client `categoryUtils.getCategoryRules`.
- **Primary Category** is a first-class concept: chosen at onboarding (single-select "Pick Your Primary Service Category"), drives profile/listings. Free locked (contact admin), Creator swaps 1, Pro adds up to 3 (one always primary).
- **Endpoints:** `GET`/`PUT /api/host/categories` (plan-capped, pure validator `server/lib/categoryRules.js`), `PATCH /api/admin/users/:id/categories` (admin override, uncapped).
- **Admin `/admin/services/categories` redesigned:** grouped table with status **dropdown** (🟢 Active / 🔴 Off), 5 columns (Category Name · Status · Registered Hosts · Active Services · Date Added), summary strip, delete-guard (blocks delete when hosts registered; server returns 409). Vendor "suggest category" pending flow retained.
- **Profile settings:** new plan-gated "Categories" tab (`components/dashboard/CategoriesSection.jsx`). **HostProfile** shows a primary-category chip; `getHostProfile` returns `primary_category_label`.
- **Ops:** `v3.21` **applied** to the live Supabase DBs (verified 2026-07-01). Remaining (optional): phased rollout = flip Day-30/Day-60 categories to Active when ready.

## Sprint: Financial Ledger P1 (Ledger Core) — Double-Entry Accounting (DONE 2026-06-13)

> **Status: SHIPPED on branch `sd/adoring-elgamal-625af7` (NOT merged).** Migrations APPLIED to live Supabase (`STAGING_PROJECT_REF`). Tests: server **281/281**, client **115/115**, build clean. Live ledger integrity verified: Σdebit = Σcredit, imbalance 0.

**Spec / plan:** `docs/superpowers/specs/2026-06-13-financial-ledger-p1-design.md`; `docs/superpowers/plans/2026-06-13-financial-ledger-p1.md` (full P1→P5 decomposition; only **P1** built).

**Migrations (applied live):**
- `v2.8_financial_ledger` — `chart_of_accounts` (+12 seeded accounts), `journal_entries`, `journal_lines`, `ledger_entries`, `account_balances`, `subscription_payments`; +10 `bookings` columns; RLS deny-all on all; `post_journal_entry(jsonb)` RPC (atomic, balanced, idempotent on `source_type+source_id`).
- `v2.8.1_ledger_hardening` — ordered account locks, idempotency-race handling, auto-seed balance rows, immutability triggers on journal/ledger tables, ledger amount CHECK, dropped redundant index, clock_timestamp ledger ordering.
- `v2.8.2_subscription_payment_idempotency` — partial unique index on `subscription_payments.razorpay_payment_id`.

**Money model v3 (was v2.2):**
- Added **commission GST** = 18% of commission, vendor-borne. New vendor payable = `service_price − commission − commission_gst − razorpay_fee − razorpay_tax`. Fixtures: Free ₹1000 → vendor ₹917.40; Paid ₹1000 → ₹976.40. Razorpay fee now stored **split** (`razorpay_fee_actual` excl-tax + `razorpay_tax_actual`). Old bookings keep original snapshots.
- **Subscription GST**: plans charge 18% on top (₹999 → ₹1,178.82 total, ₹179.82 GST). New `subscription_payments` records each charge. Subscription Razorpay fees are platform-borne (expense); order fees vendor-borne.
- `server/lib/pricingEngine.js` v3: `calculateCommissionGst`, new `calculateVendorPayout(price, commission, commissionGst, razorpayFee)`, `computeBreakdown` returns `commissionGst`, `computeSubscriptionBreakdown`.

**Posting pipeline:**
- Pure builders `server/services/ledger/journalTemplates.js` → `server/services/ledger/postingService.js` (`post` throws / `postSafe` never throws) → RPC. Order-payment template posts gross receivable + same-entry gateway relief (Razorpay Receivable = net remittance; account 5000 nets 0).
- Triggers wired: `paymentController.verifyPayment` posts ORDER_PAYMENT + stamps `paid_at` + fee/tax split + concurrent-verify guard (`.neq payment_status paid`); `bookingController.completeBooking` stamps `completed_at`/`revenue_recognized_at`/`revenue_recognition_status=recognized`/`settlement_status` (paid→`eligible_for_settlement` else `not_eligible`) + idempotent re-complete guard; `verifySubscription` inserts `subscription_payments` + posts SUBSCRIPTION_PAYMENT + replay guard.
- **Self-heal**: hourly `server/services/ledger/ledgerReconciler.js` cron (env `LEDGER_RECONCILE_INTERVAL_MIN`, default 60) reposts paid bookings + subscription_payments missing a journal entry; per-row try/catch.
- **Backfill**: `server/scripts/backfillLedger.js` (idempotent, `--dry-run`) replays historical paid bookings/plan_purchases/executed payouts. **NOT yet run on live** (dataset near-empty today; run at deploy from an env with `server/.env`).

**Admin (API + UI):**
- API `/api/admin/finance/*` (`server/controllers/financeAdminController.js`): summary, accounts, journals, journals/:id, ledger/:accountId (reads, `finance.view`); adjustment, reversal, bank-transfer (writes, `finance.manage`). New perm `finance.manage` added to `lib/adminPermissions.js` + live admin_roles finance row.
- UI (new FINANCE nav): `AdminFinanceDashboard.jsx` (`/admin/finance`, 12 metric cards), `AdminJournal.jsx` (`/admin/finance/journal`, browser + expandable lines + reverse + manual-entry modal with client-side balance gate), `AdminLedger.jsx` (`/admin/finance/ledger`, per-account running balance). `UpgradePlan.jsx` shows +18% GST line.

**NOT done (future phases):** P2 settlement engine (eligibility/batches/holds/vendor ledger), P3 refunds, P4 reconciliation+periods+reports/exports, P5 Razorpay recurring-mandate subscriptions. Followups noted in PR: `getSummary` in-memory aggregation → P4 SQL view; account_code 400-vs-500 on adjustment; fee-fetch-failure has no auto re-fetch (manual ADJUSTMENT).

## Sprint: Communication → Campaign Platform — Email + WhatsApp (SHIPPED 2026-06-12)

> **Status: SHIPPED.** Audience + segment + campaign layers built on the existing engines; migrations v2.6 + v2.7 applied live; email **and** WhatsApp broadcast campaigns work. Tests: server **253/253**, client **113/113**. Local-only git (branch `feat/email-campaigns`, no GitHub remote), committed task-by-task.

**What shipped (plan: `docs/superpowers/plans/2026-06-12-email-campaigns.md`; reference: `docs/communication-campaigns-architecture.md`; guides: `docs/guides/*-campaigns.md`):**
- **Audience:** `contacts` table synced from profiles/bookings/product_purchases (vendor phones included), per-channel `*_opt_in` / `*_suppressed`; `segments` (4 system seeds) resolved with consent enforced.
- **Campaign engine:** `email_campaigns` + `campaign_recipients` + a throttled `campaignWorker` (60s). Email reuses `communicationEngine` queue/retry (Resend for bulk); WhatsApp sends approved AiSensy templates via `aisensyService` with named variable mapping (`whatsappTemplateService`).
- **Consent enforced twice** (segment resolve + worker re-check); inbound **STOP** opt-out via public secret-gated `POST /api/notifications/aisensy/webhook` → `whatsapp_suppressed`.
- **Admin:** `/admin/campaigns` (`AdminCampaigns.jsx`) — builder with channel selector, segment recipient-count preview, email/WhatsApp template pick, launch + the WhatsApp template registry. API `/api/admin/campaigns/*`. New perms `campaigns.view`/`campaigns.manage` (marketing + super). Provider self-test `POST /api/admin/email/test-provider`.
- **Deferred:** stepped AiSensy onboarding wizard (Task 20, cosmetic); delivery/read funnel (open rates / read receipts) = v2; scheduled-campaign trigger (column exists, scheduler not wired).
- **Manual e2e still TODO (needs live creds):** real Resend send; real AiSensy send to an opted-in test number + STOP suppression. Code + all unit tests pass without creds.

### Audit findings that motivated the rebuild (kept for reference)

- **Full plan:** `docs/superpowers/plans/2026-06-12-email-campaigns.md` — 26 tasks across 3 phases, TDD with complete code + tests per step. Execute on command, all 3 phases together.
- **Trigger:** UX audit of "Communication Settings". The area is messy — email and WhatsApp (AiSensy) configuration are spread across **three overlapping admin pages** with **two divergent data models**.
- **Audit findings (recorded for the rebuild):**
  - Two admin pages overlap: `AdminNotifications.jsx` (`/admin/notifications`, AiSensy + per-event email toggles) and `AdminCommunication.jsx` (`/admin/platform/communication`, email templates/logs/settings). Plus an empty `AdminNewsletter.jsx` shell promising "campaigns".
  - **Two event registries:** `notification_events` (channel routing + AiSensy campaign names, 12 rows) vs `email_templates` (content, 29 rows) — divergent lists, no single "what fires on event X" view.
  - **Dead field:** `notification_events.email_subject` is editable in the UI but ignored by the engine (which uses `email_templates.subject`).
  - **Two log stores, double-logged:** `notification_logs` + `email_logs`, surfaced in two separate "Logs" tabs.
  - **No campaigns at all:** the only "campaign" today is the AiSensy `campaign_name` text field per event; no audience/segment concept; WhatsApp `{{n}}` param order is hardcoded in code.
  - **The real gap:** no contactable/consented audience layer. Contacts are scattered across `profiles` (email only, no phone), `bookings` (`guest_*`), `product_purchases` (`buyer_*`); no suppression/opt-out anywhere. "System in place, purpose unfulfilled" = there was no list to point the engines at.
- **Architecture decided (4 layers):** Delivery (exists: communicationEngine + aisensyService) → Routing (exists: notification_events) → **Audience (new: `contacts` + consent/suppression + `segments`)** → **Campaign (new: `email_campaigns` + `campaign_recipients` + a throttled worker)**. Campaigns reuse the existing `email_logs` queue + 60s worker; no new send infra.
- **Phase plan:** P1 Email campaigns (Tasks 1–12) → P2 WhatsApp campaigns (Tasks 13–21, additive, never edits P1 schema) → P3 Documentation (Tasks 22–26).
- **Key decisions made this session:**
  - Bulk email → **Resend** (provider abstraction already supports it); transactional OTP can stay SMTP. Gmail/Workspace SMTP can't do campaign volume.
  - Schema is **multi-channel from Phase 1** (contacts/segments/recipients all channel-aware), so WhatsApp slots in additively.
  - **Consent basis:** users agree via T&C at signup to email + WhatsApp; suppression/opt-out is still enforced in two places (segment resolve + worker re-check). WhatsApp STOP → suppress via a webhook (P2).
  - Naming debt accepted: the campaigns table stays named `email_campaigns` even when holding WhatsApp campaigns (avoids a risky live rename).
  - **Git: local only, never pushed.** Migrations (v2.6, v2.7) are additive and need explicit go before hitting live Supabase.
- **Open confirmations before/within execution:** vendor phone source (P2 pre-task — may scope WhatsApp to guests first), AiSensy Pro webhook payload shape (P2 Task 18), `RESEND_API_KEY` + verified sender for the email e2e.

## Sprint: Auth Split + Availability Engine + Theme/Media Fixes (DONE 2026-06-11)
- **Vendor Google-only auth**: `GET /api/auth/google/vendor?intent=signup|login` (public) → callback auto-creates/logs-in vendor with ONE consent screen (identity + full calendar scopes). Session minted password-less via `mintSessionForEmail()` (admin generateLink → disposable-client verifyOtp — same poisoning rule as signInWithPassword). Tokens delivered in URL fragment to `/auth/google/done`. New pages: `/become-a-host` (signup), `/login-as-vendor` (login), `GoogleAuthDone.jsx`. Legacy `/login` email/password kept for pre-migration vendors (back-compat).
- **OAuth state JWT**: both flows now carry signed state (`OAUTH_STATE_SECRET` env, falls back to service-role key) — fixes CSRF gap + email-collision token attach. Legacy calendar-connect identifies vendor by `state.uid`, not email match. Callback stores `google_id` (v2.5 column, schema fallback) and seeds `availability.timezone` from Google Calendar settings (only when no availability row exists).
- **CalendarStep fixed**: was `window.location='/api/auth/google?onboarding=true'` → 401 JSON (protected endpoint, no header). Now uses `connectGoogleCalendar()`; auto-skips when `google_calendar_connected`.
- **Customer identity = mobile**: booking phone now required; OTP keyed by normalised phone (email fallback for old clients) in `otp_codes` (email PK column stores the identifier — no migration needed); delivery via WhatsApp (AiSensy engine) + email backup. `verify-otp` accepts `{email, phone, otp}`. `/signup` route → redirect home (no customer registration); Navbar → "Become a Host"/"Vendor Login". Guest account still auto-created by email server-side (notifications/receipts stay email-driven).
- **Availability engine** (`server/services/availabilityService.js`): slots = working hours − blocked_dates − platform bookings (grace-padded) − **Google FreeBusy** − buffers. Google failures fail-OPEN (outage must not block bookings). New `GET /api/bookings/available-slots?host_id&service_id&date` — ServiceBooking renders the server list (legacy client computation kept as deploy-skew fallback). `createBooking` validates via `validateSlot` (replaces inline conflict loop); `createOrder` re-validates BEFORE charging (excludeBookingId=self); reschedule keeps `end_at` in sync.
- **Migration `v2.5_google_auth_availability.sql` (APPLIED via MCP)**: `profiles.google_id`, `bookings.end_at` (backfilled), `bookings_no_overlap` EXCLUDE USING gist (host_id =, tstzrange(scheduled_at,end_at) &&) partial: non-cancelled + end_at NOT NULL + scheduled_at > 2026-06-11. Insert/reschedule catch 23P01 → 409. Grace padding stays app-level by design.
- **Blocked dates**: column existed but was never written/read anywhere. Added editor in Availability.jsx (date list, save includes blocked_dates), enforced in engine + client calendar `isDateSelectable`.
- **Media**: cover photo cropper REMOVED — plain file input → `/upload/image?folder=covers` → object-cover render. Profile photo keeps ImageCropper (crop/zoom/drag).
- **Theme**: root causes = (1) server silently dropped invalid hex (now 400) + no plan enforcement (now 403, palettes mirrored from themeUtils), (2) CSS vars only applied on HostProfile. `applyProfileTheme` extended (--profile-accent-hover/light/dark via `shadeHex`); now applied in ServiceBooking + ServiceDetail; ServiceDetail Book CTAs consume vars; Razorpay modal colour was hardcoded indigo → host theme. `svcGetPublicByProfile` vendor select += theme_color, plan.
- **Deps**: server += `jsonwebtoken`. Tests: server 205/205, client 112/112, build clean.
- **NOT done / decisions**: vendor password login still functional server-side (back-compat; UI no longer offers it for new vendors).

### Open-item follow-ups (DONE 2026-06-11, same day)
- **Google tokens encrypted at rest**: `server/utils/cryptoTokens.js` AES-256-GCM (`enc:v1:iv:tag:ct`). Key = `GOOGLE_TOKEN_KEY` env (32B base64/hex) or scrypt-derived from service-role key (zero-config). `decrypt()` passes legacy plaintext through verbatim → no breakage, re-encryption optional. Encrypt on write in authController `attachGoogleToProfile`; decrypt on read in availabilityService `getGoogleBusy` + bookingController createCalendarEvent. Hygiene script `scripts/encryptGoogleTokens.js` (idempotent, run once).
- **FreeBusy cache + visible degrade**: migration `v2.6_freebusy_cache.sql` (APPLIED) `google_freebusy_cache(host_id, day, busy jsonb, fetched_at)` deny-all RLS. `getGoogleBusy` now returns `{intervals, unverified}`: success caches; failure reads last-good cache (unverified=true) else `[]`. computeSlots returns `calendarUnverified`; ServiceBooking shows amber "couldn't reach calendar, subject to confirmation" banner. Still fail-open.
- **Google-vendor slim onboarding**: new Google signups get `onboarding_slug=username` + `onboarding_step_completed=3` → ProtectedRoute routes them into type→category→booking-type→[calendar auto-skips]→profile→first-service→plans (verify+password done by Google). Schema-guarded; existing/legacy vendors untouched. `markGoogleVendorOnboarding()` in authController.
- **Customer bookings page**: `client/src/pages/CustomerBookings.jsx` at `/my-bookings` (was vendor Dashboard) — read-only upcoming/past list from existing `GET /bookings/guest`, join + cancel. NOTE: pure phone-OTP guests have no session yet, so this serves session-bearing guests; magic-link guest sessions = future work.
- Dep: server += `jsonwebtoken`. Tests: server 205/205, client 112/112, build clean.

### OAuth e2e coverage + bug fix (DONE 2026-06-11)
- **Bug fixed**: `googleCallback` catch block sent ALL failures to `/dashboard?google=error`. For a vendor-auth failure (e.g. `mintSessionForEmail` throws) the user isn't logged in → `/dashboard` bounces to `/login` = dead-end. Now tracks `isVendorAuthFlow` and routes vendor-auth failures to `/login-as-vendor?error=auth_failed` (VendorLogin already has copy for it).
- **New test** `server/tests/unit/authGoogleOAuth.test.js` (9 tests): real `jsonwebtoken` state sign/verify + real flow branching, Google (`googleapis` + config/google) and `mintSessionForEmail` mocked. Covers signup (new→createUser+mint+new=1), login (existing host→no create+new=0), customer-email rejection, forged state→invalid_state (CSRF, no Google call), missing code→400, mint-throws→/login-as-vendor, calendar-connect→/dashboard?google=connected. Closest CI can get to live consent (real Google round-trip still needs manual post-deploy smoke).
- Tests: server **214/214**, client 112/112.

## Sprint: Admin Platform M0 + M1 — RBAC Foundation (DONE 2026-06-11)
- Phase 1 architecture doc: `docs/admin-platform-architecture.md` (audit, IA, RBAC, DB plan, milestones, all decisions in Part L).
- **M0 hygiene**: removed dangerous `POST /admin/cleanup-users`; fixed `getStats` revenue bug (now sums `platform_fee_amount + commission_applied` from SELECTed columns — was always ₹0); added `maintenanceMiddleware` enforcing `platform_settings.maintenance_mode` (503 public, admin stays reachable, 30s cache, busted on settings save); admin JWT secret now fail-closed in production (`adminAuthService` throws if `SUPER_ADMIN_JWT_SECRET` unset).
- **Migration `v2.4_admin_rbac.sql` (APPLIED via MCP)**: `admin_roles`, `admin_users` (SEPARATE bcrypt credential store, NOT auth.users), `admin_audit_logs` (append-only). All `deny_all` RLS. Seeded 6 roles + 4 staff accounts.
- **Auth rewrite**: `adminAuthController` now authenticates against `admin_users` (username OR email + bcrypt), 5-fail/15-min lockout, mints JWT carrying role + resolved permissions. `lib/adminPermissions.js` = canonical catalog (45 perms) + 6 roles, kept in sync with DB seed. `requireAdmin(permission)` / `requireSuperAdmin` middleware replace blanket guard; applied per-route across ALL admin endpoints. `services/auditService.js` `audit()` on every destructive mutation (user/booking/service/staff). `GET /admin-auth/me`.
- **New modules**: staffAdminController (CRUD/invite/reset/activate, last-super + self-deactivate guards), opsAdminController (`/admin/ops/summary` real attention queue), auditAdminController (`/admin/audit` viewer).
- **Frontend**: AdminLogin → username field; AdminLayout guard → `type==='admin'`, permission-aware nav (hides items the role lacks), sidebar recolored to brand ink `#1E1E1E`; new AdminStaff + AdminAudit pages (routes `/admin/staff`, `/admin/system/audit`); SuperDashboard Operations Center now uses real `/ops/summary` (removed fake trends/chart/pending=0).
- **Verified live**: all 4 logins work; RBAC enforced (finance 403 on staff, 200 on ops); audit rows written; revenue now ₹2 (real). Tests: server 205/205, client 112/112.
- **Admin logins** (credentials delivered in chat, NOT committed): superadmin/ops/finance/support at `/backstage`. Change passwords after first login.


## Sprint: Email Communication Engine (DONE 2026-06-10)
- Migration `v2.3_email_communication_engine.sql` (APPLIED): email_settings (single-row provider+brand config), email_templates (DB templates keyed by event_key+audience, one active per pair), email_logs (backs BOTH queue status=queued AND delivery log; attempts/retry/provider_response/is_test).
- 29 templates seeded (`config/emailTemplates.js` + `scripts/seedEmailTemplates.js`) covering all §20: auth (OTP, email verify, password reset), security (password changed, login alert), booking confirm/reminder/cancel/complete/reschedule (customer+vendor), profile, badge, 4 milestones, subscription, celebrations. 17 new events registered in notification_events.
- Core under `server/services/email/`: placeholderResolver ({{snake_case}}, globals, unknown→'' tracked), emailLayout (ONE 600px header+footer shell — no template has its own), providers/ (smtp working + resend + ses behind getProvider factory — swap via email_settings.provider), communicationEngine (render→OTP immediate|queue→provider→log).
- Queue worker in server.js (60s): retry backoff 5m/30m/2h then permanent fail. OTP/password reset send immediately (immediate:true).
- NotificationEngine email path now delegates to communicationEngine by (event, audience, data) — NO inline HTML in business logic. All callers migrated: auth (OTP/reset/password-changed), booking (all lifecycle, both audiences, +new BOOKING_COMPLETED_VENDOR), payment (paid confirm + SUBSCRIPTION_PURCHASED), badge assign (BADGE_UNLOCKED), vendor onboarding OTP. notification_logs kept as cross-channel summary; email_logs is the email detail.
- Admin: `/api/admin/email/*` (templates CRUD/duplicate/archive/preview/test, logs search, settings, events) + rebuilt AdminCommunication.jsx (Templates+editor w/ live iframe preview & test send, Logs w/ retry, Settings provider picker, System Events) at /admin/platform/communication.
- Test mode: marked is_test, excluded from normal logs view (PRD §15). Tests: server 172/172 (added placeholderResolver 11 + communicationEngine 9), client 113/113.
- DEFERRED triggers (templates seeded + fire-ready, no live trigger yet): BIRTHDAY/ACCOUNT_ANNIVERSARY (need DOB+cron), PROFILE_COMPLETION_REMINDER & SUBSCRIPTION_EXPIRING (need cron), milestones 10/50/100 (need counter hook), LOGIN_ALERT (would wire on login). notificationAdminController retry tool still uses raw sendEmail (admin infra, not business template).

## Sprint: Final Commission/Fees/Payout Model (DONE 2026-06-10)
- Migration `v2.2_payout_model.sql` (APPLIED): bookings += platform_fee_gst, razorpay_fee_actual, customer_total, gst_rate. platform_settings seeded platform_fee=10, platform_fee_gst_rate=0.18.
- Money model: customer pays service + platform_fee(₹10 flat, admin-editable) + 18% GST. Razorpay fee ALWAYS vendor-borne, recorded ACTUAL from `razorpay.payments.fetch().fee` at capture. Vendor payout = price − commission − actualRazorpayFee. Commission = plan.commission_percentage % of price (DB-driven). GST is pass-through liability, not platform revenue.
- `server/lib/pricingEngine.js` fully rewritten: pure, config-injectable, commission% as param. Removed old tiered fee / ₹200 floor / 30-day grace logic. New `computeBreakdown()` helper. Tests rewritten (23 cases incl spec's worked ₹100 examples).
- `server/services/platformConfig.js` reads platform_fee + gst_rate from settings (60s cache, robust parse, clearCache on admin save).
- bookingController: snapshot uses computeBreakdown + plan commission% + settings; stores all new columns w/ schema fallback. paymentController.createOrder charges customer_total (incl GST); verifyPayment fetches actual Razorpay fee → finalises vendor_amount.
- COMMISSION CORRECTED: paid plans (creator/professional) now 0% (were 5%) per final spec — Free=5%, paid=0%. Live DB + v2.1 seed updated.
- Client ServiceBooking checkout now shows Platform fee + GST lines and charges customer_total (was omitting GST → would've under-shown the total).
- Live verified: Free ₹100 → vendor ₹92.66/platform ₹15; Paid → ₹97.66/₹10; GST ₹1.80. Tests: server 158/158, client 113/113.
- Future-ready (not built): Razorpay Route split, refunds, GST invoicing, TDS — schema/snapshots support them.

## Sprint: Subscription Plans Module v1.1 (DONE 2026-06-10)
- Migration `v2.1_subscription_plans.sql` (APPLIED to live DB): `subscription_plans` table — limits/features/integrations JSONB, commission_percentage, sort_order, active. Seeded Starter (₹0)/Creator (₹999)/Professional (₹3,650) verbatim from spec JSON. profiles plan CHECK relaxed to allow 'starter'.
- `server/services/planService.js` — cached DB reads, legacy alias explorer→starter, fallback defaults pre-migration. NO hardcoded plan logic anywhere.
- `planMiddleware.js` rewritten DB-driven; booking limit is now per subscription YEAR (anchor = plan_activated_at). paymentController PLAN_PRICES removed → reads annual_price from DB; subscription expiry fixed 30→365 days; plan_activated_at now set on purchase.
- Admin: `/api/admin/plans*` (create/edit/archive/restore/clone/reorder/assign; min 2 / max 3 active plans enforced) + rebuilt `AdminPlans.jsx`; public `GET /api/plans` for the pricing page.
- KNOWN DECISION: commission_percentage seeded at 5% for ALL plans per spec JSON, but payout math still uses pricingEngine (paid plans 0%) — the PRD v2.0 contradicts the JSON here; wire pricing to plan.commission_percentage once resolved.
- PRD DOCX generated at docs/Meeticulous_Subscription_PRD_v2.docx.
- Tests: server 166/166, client 113/113.

## Sprint: Badge System (DONE 2026-06-10)
- Migration `v2.0_badge_system.sql` (APPLIED to live DB via MCP): `badge_categories`, `badges`, `badge_rules`, `vendor_badges` (soft-revoke history, partial unique index on active awards), `vendor_metrics` SQL view (14 PRD metrics, one batched read — no N+1). Seeded 5 categories + 10 BAS Team manual badges.
- `server/services/badgeEngine.js` — zero badge-specific logic; rules from DB; groups ANDed internally, combined with badge.rule_logic; awards engine badges, auto-revokes ONLY engine-awarded ones. Hourly cron in server.js (`BADGE_EVAL_INTERVAL_MIN`) + event hooks on booking completion and review creation.
- APIs: `/api/admin/badges*` (CRUD, status, rule preview, evaluate, vendor assign/revoke with required reason) behind `requireSuperAdmin`; public `/api/vendors/:username/badges[/:badgeId]` — negative badges filtered at query layer, 404 for unknown usernames (no enumeration), 60s cache headers, rank by assigned_at order.
- Client: `AdminBadges.jsx` (`/admin/badges`, sidebar → OPERATIONS → Badges) — list w/ earned_count, 4-step wizard with visual rule builder + live vendor-count preview, vendor badge audit panel; `BadgeShowcase.jsx` public at `/:username/badges` (responsive 2/3/5 grid, accessible modal w/ focus trap + Escape, full-screen on mobile).
- Known gaps: `avg_response_time_minutes` and `login_streak` metrics have no data source yet (exposed as 0 in the view); badge image upload uses URL field (reuse Cloudinary upload pipeline later).
- Tests: server 166/166, client 113/113 passing.

## Sprint: Dynamic Notification System (DONE 2026-06-10)
- New tables (migration `v1.9_notification_system.sql`, ALREADY APPLIED to live DB via MCP): `notification_providers`, `notification_events`, `notification_logs`; hardened `otp_codes` (otp_hash, attempts, send_count, first_send_at, locked_until). v1.7 `commission_applied` also applied.
- `server/services/notificationEngine.js` — central dispatcher. Business code emits semantic events (`BOOKING_CONFIRMED_CUSTOMER` etc.); engine reads channel toggles + AiSensy campaign names + provider key from DB, sends WhatsApp (AiSensy) + email, logs to `notification_logs`. 60s config cache; `clearCache()` after admin edits.
- `server/services/aisensyService.js` — AiSensy campaign API client (no hardcoded keys/campaigns).
- `server/utils/otpStore.js` rewritten: bcrypt hash, 10-min TTL, 3 attempts, 3 sends/hour, 15-min lockout; legacy plaintext fallback for pre-v1.9 DBs.
- Controllers refactored to engine events: auth (OTP, password reset), booking (confirm/cancel/complete/reschedule/reminders — also fixed undefined `sendAppointmentWhatsApp` bug), payment (paid confirmations).
- Admin: `/api/admin/notifications/*` (provider masked-key CRUD, test connection, events CRUD, test send, logs, retry) + `client/src/pages/admin/AdminNotifications.jsx` at `/admin/notifications` (sidebar → PLATFORM → Notification Settings).
- AiSensy credentials live in the `notification_providers` DB row (entered via admin UI), never in code.
- Tests: server 155/155, client 113/113 passing.

## Sprint: Bug Fixes + Project Memory Setup

### Completed This Session

#### Fix 1 — commission_applied schema error (DONE)
- **File:** `server/controllers/bookingController.js`
- **Root cause:** `v1.7_pricing_snapshot.sql` not applied to live DB
- **Fix:** Booking INSERT now uses `bookingPayload` object; on schema-cache error, retries without `commission_applied` field using destructuring
- **Lines:** ~254–295

#### Fix 2 — OTP "No OTP found" bug (DONE)
- **File:** `server/utils/otpStore.js`
- **Root cause:** In-memory `Map` cleared on server restart / multi-instance deployments
- **Fix:** Full rewrite to use `otp_codes` Supabase table via `supabaseAdmin`. Uses `upsert` (email is PK). `verify()` does DB lookup + expiry check + single-use delete.
- **Benefit:** OTPs now survive server restarts and work across multiple instances

#### Fix 3 — Dashboard View Public Page icon (DONE)
- **File:** `client/src/pages/services/ServicesList.jsx`
- **Root cause:** Href was `/profile/service/${s.slug}` — a non-existent route
- **Fix:** Added `useAuth` import, `const { user } = useAuth()`, changed href to `/${user?.username}/booking/${s.slug}`

#### Fix 4 — Booking Flow UI card width consistency (DONE)
- **File:** `client/src/pages/ServiceBooking.jsx`
- **Root cause:** OTP/payment/confirmed steps used `max-w-lg mx-auto` making them narrower than time/details steps
- **Fix:** Removed `max-w-lg mx-auto` from all 3 cards, standardised to `p-5 sm:p-7`. Added `max-w-md mx-auto text-center` inner wrapper for icon/heading content

#### Fix 5 — bookingController.js truncated file (DONE)
- **File:** `server/controllers/bookingController.js`
- **Root cause:** File was truncated at line 706 (processReminders function incomplete)
- **Fix:** Appended missing tail of `processReminders` function + `module.exports` block using coverage report as reference

#### Docs — Project Memory (DONE — this session)
- Created `CLAUDE.md` at repo root
- Created all 11 `docs/*.md` files

---

## Pending Actions

### Must Do Before Production
1. ~~Run migration `v1.7_pricing_snapshot.sql`~~ — **DONE.** `commission_applied` is
   applied on both DBs (verified 2026-07-01). All migrations through v3.57 are applied.

2. **Test end-to-end booking flow** with a real service (routine regression check)

### Nice To Have
- Guest booking history: dedicated page for guests at `/my-bookings`
- Review submission: UI for guests to leave reviews after completed bookings
- Admin payout workflow: complete approval/reject UI in `AdminSettings` or new page

---

## Recent Architectural Decisions

### OTP Storage: Memory → Database
- Previous: `Map` (cleared on restart)
- Current: `otp_codes` Supabase table via `supabaseAdmin.upsert()`
- Reason: Production server restarts lost all pending OTPs
- Impact: `otpStore.set/verify/cleanup` are now async DB operations (were synchronous)
- Callsites unaffected — already `await`-ing them

### Booking Insert: Direct → Payload Object with Fallback
- Previous: Inline object literal with `commission_applied` field
- Current: `bookingPayload` object, try with `commission_applied`, fallback without
- Reason: Matches existing fallback pattern in SELECT queries; survives pre-v1.7 DBs
- Impact: Booking creation works on any DB state

### ServicesList URL Fix
- Previous: `/profile/service/${s.slug}` (404)
- Current: `/${user?.username}/booking/${s.slug}`
- Reason: Route is `/:username/booking/:serviceSlug` per App.jsx

---

## Email rebrand → Meeticulous (branch `feat/email-meeticulous-rebrand`)

The old brand → Meeticulous across the email system: brand copy, maroon palette
(#960D32, from the style guide), light structure (16px card / 12px boxes / 10px
buttons, blush #FBF4F5 page), category hues kept, no dark mode, Poppins kept.
Senders: durga + sujata consolidated into shubham; tithi sends from
tithi@meeticulous.com; noreply kept. Sending domain → meeticulous.com (verified).

### ⛔ PRE-DEPLOY BLOCKERS — do NOT ship prod without these
1. **GST / legal entity (Rajmudra Media LLP).** `config/sellerIdentity.js` still
   stamps Timewheel Internet Pvt Ltd (GSTIN 21AAMCT8270C1ZF, Odisha) on every GST
   tax invoice. Need Rajmudra's registered GSTIN, PAN, LLPIN/CIN, state, address,
   contact email/phone, and the BAS-* invoice series prefix decision. Flip via
   `SELLER_*` env vars or the config defaults. `brandSubline` also pending.
2. **Hosted logo URLs.** Header icon + footer wordmark are referenced at
   `company-assets.<old-brand-domain>/.../meeticulous-*.png` (placeholder host, won't
   resolve). Upload the two assets to a public CDN and swap the two constants in
   `services/email/emailLayout.js` (HEADER_LOGO/FOOTER_LOGO) + `sellerIdentity.logoUrl`.

### Deploy steps (both DBs, staging then prod)
1. Apply `migrations/v3.175_email_meeticulous_rebrand.sql` (email_settings + senders).
2. Run `node scripts/seedEmailTemplates.js` (re-pushes rebranded template copy + sender_key).
3. Confirm meeticulous.com SPF/DKIM/DMARC + verified senders (hello@, tithi@, shubham@, noreply@) at the ESP.
