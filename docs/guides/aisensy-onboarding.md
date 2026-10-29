# Guide: AiSensy Onboarding

What you need before you can send WhatsApp (campaigns or triggered notifications).

## 1. Get your AiSensy credentials
- In the AiSensy dashboard, copy your **API key** and note your **connected (WABA) number**.

## 2. Create + get a template approved
- In AiSensy, create a campaign/template with the message body and `{{1}}, {{2}}…` variables.
- Submit it for **Meta approval**. You can only send approved templates.
- Note the **exact campaign name** — you'll paste it into Book A Sloth verbatim.

## 3. Connect it in Book A Sloth
- Admin → **Notification Settings → AiSensy Configuration**: paste API key + connected number, toggle **Enable WhatsApp**, click **Test Connection** (validates the key without messaging anyone).

## 4. Register the template for campaigns
- Admin → **Campaigns → WhatsApp templates → Add**: Label, the exact **AiSensy campaign name**, and the **Fields** that fill `{{1}}, {{2}}…` (comma-separated contact fields, in order).

## 5. Set the opt-out / delivery webhook (recommended)
- Point AiSensy's inbound webhook at `POST /api/notifications/aisensy/webhook?secret=<your-secret>`.
- Store the secret in `notification_providers.settings_json.webhook_secret` (or `AISENSY_WEBHOOK_SECRET`).
- This captures **STOP** opt-outs (auto-suppress). NOTE: confirm AiSensy's exact webhook payload shape — field names vary by account; the handler reads them defensively.

## 6. Send a test
- Notification Settings → Events → "Test WhatsApp" to your own opted-in number, or launch a tiny WhatsApp campaign to a one-person test segment.

Then you're ready — see [whatsapp-campaigns](whatsapp-campaigns.md).
