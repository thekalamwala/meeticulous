# Guide: Sending a WhatsApp Campaign (AiSensy)

WhatsApp is stricter than email: you can only send **pre-approved templates** to **opted-in** numbers, and each message **costs money**. The platform enforces consent for you.

## One-time setup
1. **Connect AiSensy.** Admin → Notification Settings → AiSensy Configuration: paste the API key + connected number, enable, and **Test Connection**. (See [AiSensy onboarding](aisensy-onboarding.md).)
2. **Set the opt-out webhook** (recommended): point your AiSensy inbound webhook at `POST /api/notifications/aisensy/webhook?secret=…` so a customer texting **STOP** is automatically suppressed.
3. **Register your approved templates.** Admin → Campaigns → **WhatsApp templates** → Add:
   - **Label** (internal name)
   - **AiSensy campaign name** — must match the approved template's campaign name in AiSensy **exactly**
   - **Fields** — comma-separated contact fields that fill `{{1}}, {{2}}, …` in order, e.g. `first_name, service_name, vendor_name`.

## Sending a campaign
1. **Sync contacts** (pulls phones from vendors, guests, buyers).
2. **New campaign** → Channel = **WhatsApp**.
3. Name it, pick a **segment** (the count shows consented WhatsApp recipients — phone present, opted-in, not suppressed).
4. Pick an **approved WhatsApp template**.
5. **Save draft** → **Launch.** Messages send throttled (to protect your WABA quality rating) and are logged.

## Compliance — non-negotiable
- Only opted-in, non-suppressed numbers are messaged.
- A customer who replies **STOP** is permanently suppressed (via the webhook).
- Keep blasts reasonable; the per-minute throttle protects your number's quality rating.
- Cost scales with recipients — check the recipient count before launching.

See also: [AiSensy onboarding](aisensy-onboarding.md), [architecture](../communication-campaigns-architecture.md).
