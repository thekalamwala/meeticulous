# Guide: Segments & Consent

## What a segment is
A **segment** is a saved filter over your contacts — the audience a campaign targets. It's resolved fresh at launch time, so it always reflects current data.

Definition shape: `{ contact_type?: 'vendor'|'guest'|'buyer', filters?: [{ field, op, value }] }`
- `field` is a contact column or an `attributes.*` key (e.g. `plan`, `last_booking_at`).
- `op` ∈ `eq` | `neq` | `exists` | `gt` | `lt`.

**Seeded system segments:** All vendors · Free-plan vendors · All guests · All contacts.

## Where contacts come from
A **Sync contacts** run rebuilds the `contacts` table from:
- `profiles` → vendors (with `phone`) and registered guests
- `bookings` → guest name/email/phone (incl. unregistered)
- `product_purchases` → buyers
Deduped by email; vendor outranks buyer outranks guest when someone appears in several sources.

## Consent & suppression (how people are protected)
Every contact carries per-channel flags:
- `email_opt_in` / `whatsapp_opt_in` — default true (your signup T&C covers receiving email + WhatsApp).
- `email_suppressed` / `whatsapp_suppressed` — a hard kill switch (bounces, unsubscribes, STOP replies).

A campaign **only** reaches contacts who, for that channel, have an address/number, are opted-in, and are not suppressed. This is enforced when the segment resolves **and** again per-recipient at send time. A WhatsApp **STOP** reply auto-suppresses via the AiSensy webhook.

## Suppressing someone manually
Admin → Campaigns → contacts → toggle `email_suppressed` / `whatsapp_suppressed`. Suppression is global — it applies to every future campaign.

See also: [email campaigns](email-campaigns.md), [whatsapp campaigns](whatsapp-campaigns.md).
