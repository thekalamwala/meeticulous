# Razorpay Webhook Setup (Go-Live Guide)

How to connect Razorpay webhooks once the platform is deployed to a public
domain. **Not needed for local dev** — locally, subscriptions activate via the
sync-on-return endpoint (see §6). The webhook matters in production for
**auto-renewals**, **failed charges**, and **cancellations**, plus a safety net
for one-off booking/product payments.

---

## 1. Prerequisites

- Backend deployed and reachable over **HTTPS** (Render). Razorpay cannot reach
  `localhost`.
- You know your **API host** — the server, NOT the client:
  - Client (Vercel): `https://bookasloth.com`
  - **API (Render): `https://book-a-sloth.onrender.com`** ← webhooks go here
  - (The API intentionally stays on the Render URL. `api.bookasloth.com` is **not**
    pointed at Render — it 404s — so do **not** use it for webhooks.)
- **Verify the host:** open `https://book-a-sloth.onrender.com/api/plans` in a browser.
  - Returns JSON (plan list) → correct host.
  - Returns HTML / 404 → wrong host; use the Render URL above.

---

## 2. The Webhook URL

```
https://book-a-sloth.onrender.com/api/payment/webhook
```

(The API stays on Render; `api.bookasloth.com` is not pointed at Render and 404s.)

This path is fixed in code (`server/routes/paymentRoutes.js` → `POST /webhook`).

---

## 3. Enter credentials in the admin panel FIRST

**Admin → Settings → Payment → Razorpay**

1. **Key ID** — from the Razorpay dashboard (`rzp_live_...` for real money).
2. **Key Secret** — from Razorpay (shown once when you generate keys).
3. **Mode** — Live or Test (label only; use matching keys).
4. **Test connection** — confirms the key/secret are valid.
5. **Enable** + **Save**.

> Credentials are stored encrypted in the database (`platform_settings`) and
> override any env vars. The webhook secret (next step) is saved here too.

---

## 4. Create the webhook in the Razorpay dashboard

Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://book-a-sloth.onrender.com/api/payment/webhook` |
| **Secret** | A strong random string you choose (e.g. `openssl rand -hex 24`). **Copy it.** |
| **Alert Email** | `bookasloth@gmail.com` (Razorpay emails you on failures) |
| **Active Events** | The 6 below — nothing else |

### Active events (must match what the code handles)
```
payment.captured
payment.failed
subscription.activated
subscription.charged
subscription.halted
subscription.cancelled
```
- `subscription.*` → auto-renew lifecycle (activation, renewal charge, failed
  charge → halted, cancellation).
- `payment.captured` / `payment.failed` → idempotent backup for one-off
  **booking** and **product** payments (primary confirm is the `/verify`
  endpoints; the webhook is the safety net).

Ticking other events is harmless but pointless — they're received and ignored.

---

## 5. Paste the SAME secret back into the admin panel

**Admin → Settings → Payment → Razorpay → Webhook Secret** = the exact string
from step 4. Save.

> The secret must match on both sides. The server verifies every webhook's HMAC
> signature with it (`server/controllers/paymentController.js` → `handleWebhook`).
> A mismatch → every webhook is rejected with `400 Invalid webhook signature`.

---

## 6. Local development (no public URL)

You do **not** need a webhook to test a new subscribe locally:
- After Razorpay checkout, the client calls `POST /api/payment/subscription/sync`,
  which pulls live status from Razorpay and activates the plan immediately.
- A `subscription-reconciler` cron (every 15 min) heals anything missed.

To exercise real webhooks locally, tunnel the server (port 5000):
```
ngrok http 5000                        # → https://xxxx.ngrok-free.app
# or
cloudflared tunnel --url http://localhost:5000
```
Use `https://<tunnel>/api/payment/webhook` as the URL (changes each restart).

---

## 7. Verify it works

1. Razorpay dashboard → your webhook → **Send test webhook** (or do a real test
   subscription).
2. Check the server logs (Render → Logs) for:
   - `WEBHOOK_SUBSCRIPTION_ACTIVE` / `WEBHOOK_BOOKING_PAID` → handled OK.
   - `WEBHOOK_SIGNATURE_INVALID` → secret mismatch (re-do step 5).
3. The vendor's `profiles.subscription_status` should flip to `active` and
   `current_period_end` should be set.

---

## 8. Where everything lives (reference map)

| What | Where |
|------|-------|
| Webhook route (`/api/payment/webhook`) | `server/routes/paymentRoutes.js` |
| Webhook handler + signature check + event routing | `server/controllers/paymentController.js` → `handleWebhook` |
| Subscription activation / renewal logic | `server/services/subscriptionService.js` |
| Missed-webhook healer (cron) | `server/services/subscriptionReconciler.js` (wired in `server/server.js`) |
| Credential storage + decryption + env fallback | `server/services/razorpayConfig.js` |
| Admin API for credentials | `server/controllers/paymentSettingsAdminController.js` |
| Admin UI page | `client/src/pages/admin/AdminPaymentSettings.jsx` (route `/admin/settings/payment`) |
| Credentials at rest | DB table `platform_settings` (keys `razorpay_*`; secrets encrypted) |
| The `key_id` sent to the browser | API responses only (`/api/payment/*`) — not in client env/bundle |

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `400 Invalid webhook signature` | Admin Webhook Secret ≠ Razorpay Secret. Re-paste, save (§5). |
| `500 Webhook secret not configured` | No webhook secret saved in admin. Add it (§3/§5). |
| Webhook URL returns HTML / 404 | Pointed at the client, not the API. Use `api.` host (§1). |
| Razorpay shows webhook failing | Server down, wrong URL, or not HTTPS. Check Render is Live + URL. |
| Subscription paid but not active | Webhook missed — the reconciler heals within 15 min, or hit
  `/api/payment/subscription/sync`. |
| Renewal didn't charge | Auto-debit > ₹15,000 needs per-charge approval (RBI). Keep plan gross under it. |
