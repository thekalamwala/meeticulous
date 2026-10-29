# Bolt Escalation Flow (v3.89)

Improves how Bolt hands a conversation to a human. **Not** a ticketing system — it
reuses the existing bot, OTP, AiSensy, email, auth, and admin infrastructure.

## Before → after

| Before | After |
|---|---|
| AI apologises, whole transcript emailed | Neutral handoff, then a clear next step |
| Support has no idea who the visitor is | Identity auto-attached (logged-in) or verified contact (anon) |
| No reliable reply channel | Verified WhatsApp/email + admin reply thread |
| UI implied a "ticket" that didn't exist | "Support Request Sent" + `CHAT-XXXXXX` reference; no fake ticket |

## Flow

**Logged-in (host/guest)** — never asked for contact. On escalate, identity (user id,
host/guest, name, email, phone, page, browser) + a one-line summary are auto-attached and
support is emailed immediately. Widget shows the confirmation card with the reference.

**Anonymous** — on escalate we do **not** email yet. The widget asks *"Before I send this
to our support team, how would you like us to contact you?"* → **WhatsApp / Email / I'm just
browsing**. Chosen channel → OTP (reused verify infra, no account created) → on verify the
escalation is recorded + emailed, and the confirmation card shows the reference. "Just
browsing" → nothing, keep chatting.

**Reference** `CHAT-8F92AB` is derived from the conversation UUID (`buildReference`) — no
column, deterministic. **Anonymous visitor UUID** lives in `localStorage` (`bas_bot_visitor`);
conversation id persists in `bas_bot_convo` so a reload keeps the thread.

## Files changed & why

### Database
- **`server/migrations/v3.89_bot_escalations.sql`** *(new)* — `bot_escalations` (one row per
  handoff: reference, visitor/identity, verified contact, reason, summary, status) +
  `bot_escalation_replies` (admin replies). Additive, RLS-on/no-policy/service_role-only,
  schema-fallback safe. **Applied to both DBs** (prod + staging).

### Server
- **`services/bot/escalationService.js`** *(new)* — the core. `buildReference`, `summarize`
  (budget-gated Haiku, first-message fallback), anon `sendContactOtp`/`verifyContactOtp`
  (reuse `otpStore` + `notify.sendWhatsAppVerifyOtp` + `sendEmail`, account-agnostic,
  `bot:` namespaced keys), and `recordAndNotify` (persist + enriched support email).
- **`services/botService.js`** — neutral `HANDOFF` copy (works for both paths); return
  `escalateReason` (`sensitive`/`no_match`/`retrieval_error`/`ai_unavailable`/`model_unsure`).
- **`controllers/botController.js`** — escalation branched by auth: logged-in escalates now
  with auto-attached identity; anon returns `needsContact` and defers. New handlers
  `escalateSendOtp` / `escalateVerifyOtp`. `supabaseAdmin` lazy-required.
- **`controllers/botAdminController.js`** — `listEscalations`, `getEscalation`
  (metadata + transcript + replies), `replyEscalation` (email via `sendEmail`, or internal
  note; WhatsApp is a wa.me link, since AiSensy's campaign API can't send free-form text),
  `updateEscalation` (status).
- **`routes/botRoutes.js`** — `optionalProtect` on ask/stream (populates identity); new
  `POST /escalate/send-otp` + `/escalate/verify-otp` behind the OTP limiters.
- **`routes/adminRoutes.js`** — 4 escalation routes, gated `support.view` / `support.assign`.

### Client
- **`components/common/BotWidget.jsx`** — contact-choice + OTP mini-form + confirmation card;
  visitor UUID + persisted conversation id; forwards `visitorId`/`pageUrl`.
- **`services/api.js`** — `botEscalate{Send,Verify}Otp` + `admin{List,Get,Reply,Update}Escalation`.
- **`pages/admin/AdminBotSupport.jsx`** — new **Escalations** tab: list → thread → reply.

### Tests
- `server/tests/integration/bot.test.js` (rewired for the new flow), `server/tests/escalationService.test.js` *(new)*,
  `client/src/components/common/__tests__/BotWidget.test.jsx` (updated).

## Reuse (no new deps/services)
`otpStore` (verify), `notify`/`aisensyService` (WhatsApp OTP via the configured verify
campaign), `sendEmail` (email OTP + support + admin reply), `optionalProtect` (identity),
`otpLimiter`/`otpContactLimiter` (rate limit), existing admin permissions + `AdminBotSupport`.

## Known ceilings
- **WhatsApp reply is a wa.me link**, not an in-panel send — AiSensy's campaign API only
  sends pre-approved templates. In-panel free-form send would need AiSensy session-messaging
  (a new integration).
- **Backwards compatible**: the bot runs before v3.89 is applied (records degrade to the
  email-only path on "table/column missing"). Existing answer/feedback paths unchanged.
