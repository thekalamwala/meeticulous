# Bolt v3 — Roast Layer + Context Pills (Implementation Plan)

Branch: `chatbot-v3`. Extends existing Bolt 958 RAG bot. No new tech (Haiku 4.5 + Voyage + Supabase only). No auth, no account data, no write actions, public pages only. Anything account-specific → "create a ticket".

---

## 1. Scope

**Build two things:**
1. **Abuse/roast gate** — new pre-ladder step. Two-tier: known-word list → instant canned roast (no model $); suspicious → Haiku judge + dynamic roast. 5 strikes → cool-off + ticket.
2. **Context pills** — bring back short, action-oriented quick-replies. Hybrid: deterministic rules first, Haiku fallback only when rules miss, constrained to a whitelist.

**Out of scope:** identity/auth, account context, personality tiers, write/action flows. All deferred; account asks route to ticket.

---

## 2. Abuse / Roast Gate

### 2.1 Pipeline placement
New first step in `botService.askBot` (:593) and `askBotStream` (:716), **before** smalltalk/FAQ/retrieval:

```
message → abuseGate(message, history, ip)
  ├─ 0. IP blocked? (threat lockout, 30-min TTL) → block reply (no model)
  ├─ 1. THREAT list hit → firm shutdown reply + strike+=2 + block IP 30min
  ├─ 2. HARD list hit  → canned roast (NO Haiku). strike++
  ├─ 3. MILD list hit OR hostility regex → Haiku judge
  │        ├─ verdict abusive → dynamic roast. strike++
  │        └─ verdict clean   → fall through to normal ladder
  └─ 4. no signal → normal ladder (unchanged)

after any strike: if strikes >= 5 → cool-off lock reply (no roast, no model)
```

### 2.2 Files
- **NEW `server/services/bot/abuseGuard.js`**
  - `ABUSE_LIST` — words/phrases (hi/mr/en), normalized. Sourced from founder (below). Server-only.
  - `HOSTILITY_RE` — loose multi-lang regex for Tier B (generic profanity shape, "you <insult>", excessive caps + hostile tokens). Only decides *whether to ask Haiku*, never the verdict.
  - `normalize(msg)` produces TWO views (one global de-space is unsafe — it breaks phrases and creates substring FPs like `dickinson`→`dick`, `grass`→`ass`):
    - **`spaced`** (for token + phrase match): lowercase → strip emojis → strip punctuation except intra-word apostrophe → strip diacritics → leet map (`0→o,1→i,3→e,4→a,5→s,7→t,8→b,@→a,$→s`) → collapse repeated letters ≥3 (`fuuuuck→fuck`, but keep legit doubles like `pass`) → collapse whitespace.
    - **`glued`** (for spaced-out evasion only): from `spaced`, glue runs of **single-letter tokens** into one word (`m a d a r c h o d`→`madarchod`, `m.a.d.a.r.c.h.o.d`→`madarchod`). Does NOT touch multi-letter tokens, so real words never merge.
  - `matchListed(msg)`:
    - HARD/MILD single words → **whole-token** match on `spaced` tokens; if miss, whole-token match on `glued` (catches spaced-out). Longest wins. Token equality (not substring) → `assess`/`class`/`cocktail` safe.
    - PHRASES_DIRECTED / THREATS → substring match on `spaced` (spaces intact).
    Returns `{tier, word, lang}`.
  - `CANNED_ROASTS` — pools per lang (en/hi/mr), ~10 each, medium sarcasm. Rotated by `history.length % pool.length` (deterministic; `Math.random` unavailable in some contexts, and determinism = testable).
  - `classifyAbuse(msg)` → Haiku call, forced tool `judge_abuse` returning `{abusive:bool, language, severity}`. Gated by `botBudget.tryConsume` (fails open = treat clean).
  - `dynamicRoast(msg, lang)` → Haiku call, medium-sarcasm system prompt (below). Budget-gated; on fail → canned fallback.
  - `countStrikes(history)` → assistant messages in convo with `source='roast'`.
  - `coolOffReply()` → static message + `locked:true`.
  - `threatReply()` → firm non-sarcastic shutdown + `/support` line.
- **NEW `server/lib/botIpBlock.js`** — `isBlocked(ip)` / `block(ip, ttl)` over Redis (`REDIS_URL`) with in-memory `Map` fallback.
- **EDIT `server/services/botService.js`** — call `abuseGate` at top of both entry fns; tag roast replies `source:'roast'`, lock replies `source:'abuse_lock'`; log to `knowledge_gaps` reason `roasted`/`abuse_lock`.
- **EDIT `server/controllers/botController.js`** — surface `locked` flag in response + SSE so widget disables input.

### 2.3 Abuse-handling philosophy (founder-defined) — governs roast tone + a VOICE clause

Core stance: **the bot is not a punching bag, and it never fights back to win.** It stays calm, confident, in control. It reacts to problems, not insults. Redirect immediately.

Rules (apply to both canned roasts and Haiku `dynamicRoast`):
- Never argue. Never apologise for being shouted at. Never lecture. Never try to prove the user wrong. Never get emotional.
- Do NOT use corporate de-escalation ("Please be respectful", "I understand your frustration", "Let's keep this civil") — those read weak/scripted.
- **Acknowledge in ≤3 words, then redirect to the problem, same line.** e.g. "Fair enough. What's broken?" / "Strong opinion. Weak bug report." / "That's a lot of emotion. Missing the actual issue." / "Got it. Which page?"
- Humour: dry, short, unexpected. One sentence, one smile, then back to solving. No meme humour, no emoji spam, no "trying to be funny".
- **Don't win.** Never chase the last word. When it's over, it's over — no comeback, no final joke, no passive-aggression, no lecture.
- **Lead the mood, don't chase it.** Bot behaves like it has all day; not rushed, not desperate to keep the user talking.

Intent read (angry ≠ dangerous):
- **Angry** ("this app is fucking useless") = frustrated. Still help. HARD-list hit → dry redirect roast; normal path → answer, no lecture.
- **Dangerous** ("I'll come to your office", "kill yourself") = THREAT. Ends the chat immediately. No humour, no roast → `threatReply` + strikes + IP lockout (§2.4).
- The Haiku judge returns `{abusive, angry_vs_dangerous, language}` so the gate can route angry→roast/answer, dangerous→threat path (catches novel threats not in the THREAT list).

Hard limits: no slurs, no attacks on intelligence/family/life, never joke about money or data. Money/fraud/hacked → existing `SENSITIVE_RE` escalation, never roasted.

**Also add a compact ~2-line abuse clause to `VOICE`** (botService.js:224) so a frustrated *normal* user (judged angry, not abusive) still gets redirect-not-argue behavior on the main answer path — not just inside the roast layer.

### 2.4 Strikes, cool-off & threat lockout
Two independent mechanisms:

**A. Roast-strike ladder (per-conversation, soft):**
- Strike = each roasted turn (HARD canned, or MILD/regex judged abusive). +2 for a THREAT.
- Counted from history `source='roast'` (roasts) + `source='threat'` (counts 2). Clean message never increments (answers normally even at 4).
- `strikes >= 5` → `coolOffReply` + `locked:true`, no model call.
- Per-conversation. Refresh = new convo = reset (accepted). No decay v1.

**B. Threat lockout (per-IP, hard):**
- On THREAT hit: reply once (firm shutdown + `/support`), add 2 strikes, **block IP for 30 min**.
- Block store: `server/lib/botIpBlock.js` — Redis (`REDIS_URL` already live) with `SETEX bolt:block:<ip> 1800 1`; in-memory `Map` w/ expiry as fail-open fallback when Redis unset. TTL = `BOT_THREAT_BLOCK_SECONDS` (default 1800).
- Any request from blocked IP short-circuits at step 0 → block reply, no model, no ladder.
- **LANDMINE — client IP trust:** behind Render's proxy, `req.ip` = proxy unless `CLIENT_IP_HEADER`/`trust proxy` is set (memory: `ip-blocking-system` notes `CLIENT_IP_HEADER` currently BLANK). If unresolved, blocking the proxy IP = blocking everyone. Must resolve real client IP (X-Forwarded-For first hop) before enabling; until then, threat → firm reply + strikes only, IP-block **flagged off**.

### 2.5 Cost guards
- HARD / THREAT / IP-blocked / cool-off: **zero** model calls (list + static replies).
- Haiku judge fires only on MILD hit OR `HOSTILITY_RE` match (not already HARD/THREAT). Budget-gated (`botBudget.tryConsume`), fails open = treat clean.
- Dynamic roast only on positive verdict. Budget-gated, canned fallback on miss.
- Net: normal users add 0 cost; HARD/THREAT abuse adds 0; only MILD/novel abuse costs 1-2 Haiku calls.

---

## 3. Context Pills

### 3.1 Approach
Hybrid. Replace current single static inline link (BotWidget.jsx:268-284) with up to 3 pills.

- **NEW `server/services/bot/pills.js`**
  - `PILL_VOCAB` — whitelist: `Book a service`(/services), `See pricing`(/#pricing or help), `How booking works`(help), `Payments & refunds`(help), `Create a support ticket`(/support), `Read: <top cited help page>`(dynamic from cited_sources). Each = `{label, action:{type:'route'|'send', value}}`.
  - `rulePills(intent, citedSources)` — deterministic map: refund/cancel/payment intent → ticket + relevant help; booking intent → book + how-it-works; pricing → pricing; else → top cited page + ticket.
  - `llmPills(answer, question)` — Haiku fallback ONLY when `rulePills` returns nothing useful. Forced tool returns pill *keys from PILL_VOCAB only* (not free text). Budget-gated.
  - `validate(pills)` — drop anything not in vocab; cap 3.
- **EDIT `botService.js`** — after answer built, attach `pills`. Roast/lock turns → no pills (or single "Create a ticket").
- **EDIT `botController.js` + SSE** — include `pills` in payload.
- **EDIT `client/src/components/common/BotWidget.jsx`** — render pill row (reuse old removed pill styling); `route` pills navigate, `send` pills post as next message. Escape route: always keep a ticket pill on sensitive/escalated answers.

### 3.2 Cost
LLM pills only on rule-miss. Most answers get deterministic pills, no model call.

---

## 3b. Answer brevity (existing bot — replies too long)

Current answers run too long for a chat. Tighten the length contract in `VOICE`/`SYSTEM_STREAM`:
- **Body = only what's needed.** Concise, clear, straight to the point. Answer the question, stop.
- **Filler (greeting / sign-off / personality) only at the very top OR bottom — never woven through the body.** One optional warm opener, one optional closer. Middle is pure answer.
- Default target: 1–2 short paragraphs or a tight bullet list. No restating the question, no padding, no "as mentioned", no double sign-off.
- Edit botService.js:230 length line → enforce "shortest correct answer wins; trim anything that doesn't add information."

Applies to the normal answer path (not the roast layer, which is already one line).

## 4. DB / Migrations
- **No schema change needed.** Reuse existing `bot_messages.source` (v3.87) to tag `roast`/`abuse_lock`; strikes counted from it. `knowledge_gaps.reason` is free text → add `roasted`, `abuse_lock` values.
- If we later want per-IP locks or analytics on abuse language, add a column then. Not now (YAGNI).

---

## 5. Tests
- `abuseGuard`: list match (hit + namesake non-hit), normalize/leet/repeat, strike count from history, lock at 5, clean-msg-no-strike, budget-exhausted fails open.
- `pills`: rule mapping per intent, LLM fallback validation drops off-vocab, cap 3, roast turn → ticket-only.
- Keep existing BotWidget tests green; add pill render + click.

---

## 6. Rollout
- Feature-flag the roast gate (reuse kill-switch registry) so it can be turned off fast if brand risk.
- Seed `ABUSE_LIST` from founder file (not committed to public docs; lives in server code — private repo).
- Ship behind flag → test on staging → enable.

---

## 7. Open items needing founder input
1. **ABUSE_LIST** — the actual words/phrases (hi/mr/en + common leetspeak). Founder to provide.
2. Canned roast copy — I'll draft ~10/lang, founder approves tone.
3. Cool-off message wording — draft, founder approves.
