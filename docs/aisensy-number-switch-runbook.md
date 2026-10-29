# AiSensy Number Switch — Backup Runbook

_Last updated: 2026-06-16_

**Purpose:** how to change the WhatsApp sending number **entirely through AiSensy + our existing admin UI**, with **no webhook dependency**. Webhooks live on a higher AiSensy plan we do not own; nothing here needs them.

---

## Current state (verified live 2026-06-16)

| Item | Value |
|---|---|
| Provider row | `notification_providers` where `provider = 'aisensy'` |
| `api_key` | present (AiSensy JWT, account "Timewheel Internet Private Limited", plan `PRO_QUARTERLY`) |
| `connected_number` | `15559708785` (US sandbox-style number) |
| `webhook_url` | empty — **intentional, do not need it** |
| `is_active` | true |

**Why a switch may be needed:** the current number is a US-format number. Indian recipients sometimes don't receive sandbox/US-origin WhatsApp reliably. If delivery complaints rise, switch to an approved India sender registered on the same AiSensy account.

---

## How delivery works WITHOUT webhooks

- Outbound send = `aisensyService.sendCampaign()` → POST to AiSensy campaign API using `api_key` + `campaignName`. It does **not** read `connected_number` or `webhook_url`.
- The **actual sending number is decided by AiSensy**, based on which WhatsApp sender is attached to the campaign/account inside the AiSensy dashboard — **not** by our DB.
- Our `connected_number` field is **display/record only**. Changing it in our admin does NOT change which number AiSensy sends from.

> **Key takeaway:** the number switch happens **inside AiSensy**. Our admin only mirrors it for reference.

---

## Switch procedure (AiSensy-only)

### Step 1 — In the AiSensy dashboard
1. Log in to AiSensy (account: Timewheel Internet Private Limited).
2. Register / connect the new WhatsApp sender number (Meta WABA onboarding for that number — done on AiSensy's side, their support assists).
3. Wait for the number to show **Connected / Live** in AiSensy.
4. Ensure the **approved templates** (incl. `Registration OTP - Vendor`) are attached to / available under the new sender. Templates are per-WABA — they may need re-approval under the new number's WABA.
5. Confirm the campaigns we call by name (e.g. `Registration OTP - Vendor`, plus campaign-platform template names) point at the new sender.

### Step 2 — In our admin (record-keeping only)
1. Go to **Super Admin → Notification Settings** (`/admin/notifications`).
2. Update **Connected Number** to the new number.
3. If AiSensy issued a **new API key** for the new setup, paste it into **API Key** (masked field). If the API key is unchanged, leave it.
4. Save. (This calls `PUT /api/admin/notifications/provider` → updates `notification_providers.settings_json` + `api_key`; `notificationEngine.clearCache()` refreshes the 60s cache.)

### Step 3 — Verify
1. In admin, hit **Test Connection** (validates the API key against AiSensy — no message sent).
2. Trigger one real OTP to a known India number (e.g. WhatsApp verify in onboarding step 7, or notification test-send).
3. Confirm the message **arrives** and the sender shows the new number.

---

## Do NOT
- Do **not** set `webhook_url` expecting delivery receipts — that needs the higher AiSensy plan. The field can stay empty.
- Do **not** change code in `aisensyService.js` for a number switch — the number is an AiSensy-side setting, not a code value.
- Do **not** assume a "sent" status in our logs = delivered. Without webhooks we only know AiSensy **accepted** the send. Confirm delivery by checking the recipient phone.

## Rollback
- Revert **Connected Number** (and API key if changed) in admin to `15559708785` / current key.
- Re-point campaigns to the old sender inside AiSensy.

---

## Related
- Delivery-vs-sent gap: AiSensy "sent" ≠ delivered (no webhooks, sandbox number) — see project memory `delivery-vs-sent-gap`.
- WhatsApp verify OTP feature: `docs/superpowers/specs/2026-06-16-whatsapp-verification-design.md`.
- Outbound client: `server/services/aisensyService.js`. Admin UI: `client/src/pages/admin/AdminNotifications.jsx`.
