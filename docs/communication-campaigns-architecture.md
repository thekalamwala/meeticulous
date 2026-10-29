# Communication & Campaigns — Architecture Reference

_Built 2026-06-12 (migrations v2.6 + v2.7, applied live). Status: shipped, email + WhatsApp broadcast campaigns._

## The four layers

```
┌──────────────────────────────────────────────────────────┐
│ 4. CAMPAIGN   email_campaigns · campaign_recipients · worker│
├──────────────────────────────────────────────────────────┤
│ 3. AUDIENCE   contacts (+consent/suppression) · segments    │
├──────────────────────────────────────────────────────────┤
│ 2. ROUTING    notification_events (triggered messages)      │
├──────────────────────────────────────────────────────────┤
│ 1. DELIVERY   communicationEngine (email) · aisensyService  │
└──────────────────────────────────────────────────────────┘
```

**Triggered messages** (OTP, booking confirmed) use layers 1–2 via `NotificationEngine.send({ event, data })`. **Campaigns** (broadcasts) use layers 1, 3, 4. They share the delivery layer but are otherwise separate — never conflate "an event fired" with "a campaign was sent".

## Data model (migrations v2.6 / v2.7)

| Table | Purpose |
|---|---|
| `contacts` | One row per contactable person, synced from `profiles` + `bookings` + `product_purchases`. Holds `email`, `phone`, `contact_type` (vendor/guest/buyer), `email_opt_in`/`whatsapp_opt_in`, `email_suppressed`/`whatsapp_suppressed`, `attributes` (plan, last_booking_at…). Deduped by `email` (unique). |
| `segments` | Saved filter over contacts: `definition = { contact_type?, filters:[{field,op,value}] }`. 4 system segments seeded. |
| `email_campaigns` | The campaign object (name is historical — holds **both** email and WhatsApp). `channel`, `segment_id`, `template_id` (email) or `whatsapp_template_id`, `status`, `throttle_per_min`, `stats`. |
| `campaign_recipients` | Per-recipient work queue: `channel`, `destination`, `status` (queued/sent/failed/skipped), `email_log_id`. |
| `whatsapp_templates` | Approved AiSensy templates + `variable_map` ({"1":"first_name",…}) + `param_count` + `approval_status`. |
| `email_logs.campaign_id` | Tags queued email rows belonging to a campaign. |

## Send pipelines (no new infra — reuses `setInterval` workers in `server.js`)

**Launch** (`campaignService.launch`): resolve segment → snapshot **consented** recipients into `campaign_recipients` (status `queued`) → campaign → `sending`.

**Campaign worker** (`campaignWorker.processDue`, every 60s): for each `sending` campaign, take up to `throttle_per_min` queued recipients:
- **Email** → `communicationEngine.enqueueCampaignEmail()` renders the chosen `email_templates` row and drops a `queued` row into `email_logs`; the existing email queue worker delivers it with retry/backoff (5m/30m/2h) via the configured provider (Resend for bulk).
- **WhatsApp** → `whatsappTemplateService.buildParams()` maps contact fields → ordered params; `aisensyService.sendCampaign()` sends the approved template now; logged to `notification_logs`.
When no `queued` recipients remain → campaign `sent`.

## Consent & suppression (enforced twice)
1. `segmentService.resolve(def, channel)` only returns contactable rows (`email`/`phone` present, opted-in, not suppressed) for the target channel.
2. The worker **re-checks** per recipient before sending (defence in depth).
3. Inbound **STOP/opt-out** → `POST /api/notifications/aisensy/webhook` (public, secret-gated) sets `contacts.whatsapp_suppressed = true`. (Confirm AiSensy's live payload shape before relying on delivery-status events; the funnel beyond sent/failed is a v2 item.)

## Channel differences (why the branches exist)
| | Email | WhatsApp |
|---|---|---|
| Content | DB HTML template, edit anytime | Pre-approved AiSensy template only |
| Consent | `email_opt_in` + suppression | `whatsapp_opt_in` + suppression + STOP webhook |
| Cost | ~free | per-message → `throttle_per_min` protects WABA rating |
| Delivery | email queue + retry | AiSensy API per recipient, throttled |

## Permissions
`campaigns.view` / `campaigns.manage` (RBAC catalog in `lib/adminPermissions.js`). Granted to `marketing` + `super`. WhatsApp sends cost money — gate `campaigns.manage` accordingly.

## Admin surface
- UI: `/admin/campaigns` (`AdminCampaigns.jsx`) — campaign list + builder (channel selector, segment + recipient-count preview, template, launch) + WhatsApp template registry.
- API: `/api/admin/campaigns/*` (contacts, segments, campaigns, wa-templates) — all behind `requireAdmin`.
- Provider test: `POST /api/admin/email/test-provider` verifies Resend/SES before a campaign.

## Adding a future channel (SMS / Push)
1. Add `<channel>_opt_in` / `<channel>_suppressed` to `contacts` + a channel arm in `segmentService.contactable`.
2. Add a delivery adapter (mirror `aisensyService` / email provider).
3. Add a worker branch in `campaignWorker` + a template ref column on `email_campaigns`.
The audience + campaign + recipient-queue layers are already channel-generic.

## Known follow-ups
- Campaigns table is still named `email_campaigns` (cosmetic; holds WhatsApp too — intentional, avoids a risky live rename).
- Single-instance worker: add a row-claim (`SELECT … FOR UPDATE SKIP LOCKED`) before scaling horizontally.
- Delivery/read funnel (open rates, read receipts) = v2 (needs provider/AiSensy webhooks wired into logs).
- Scheduled campaigns: `scheduled_at` column exists; the worker currently launches on `sending` — wire a scheduler to flip `scheduled`→`sending` at the due time.
