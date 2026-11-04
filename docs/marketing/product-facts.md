---
status: DRAFT — founder must verify before any agent uses it
owner: DISHA
last_verified: 2026-11-04
verified_against: subscription_plans (live DB spquowzrefozmrzoszkf), server/lib/pricingEngine.js
---

# Product facts — the single source of truth

> **DRAFT.** Seeded for the SUTRA agent network. No agent may state a price, feature, limit,
> policy or timeline that contradicts this file (README §2.1). **The founder must confirm every
> number below before any customer-facing agent goes live.** DISHA keeps this file true after
> every release; plan limits always come from `subscription_plans.limits`, never hardcoded.

## ⚠️ Price conflict to resolve first
On 2026-11-04 the three written sources disagreed with the live database:

| Source | Pro monthly | Pro yearly |
|---|---|---|
| **Live DB** (`subscription_plans`, slug `premium`, active) | **₹199** | **₹999** |
| SUTRA spec v1.0 | ₹235 | ₹1,179 |
| `docs/help/*` (verified 2026-08-31) | ₹399 | ₹3,599 |
| Root `CLAUDE.md` | — | ₹999 founding / ₹1,179 regular |

This file uses the **live DB** value because §2.1 makes the database authoritative. If the DB is
wrong (e.g. the founding ₹999 price was left as the standard `premium` price by mistake), the
founder fixes the DB and this file together. **Until the founder confirms, agents quote no price
and link to `/pricing`.**

## Plans (active, from the live DB)

### Starter (slug `free`)
- **Price:** ₹0, free forever. No card.
- **Commission:** 5% per paid booking.
- **Limits:** CRM 10 contacts · 2 free (₹0) services · 10 AI generations / 6 months · 3 digital products · 1 reminder flow · 0 follow-up flows · 1 calendar integration. Unlimited paid services, categories, bookings.

### Pro (slug `premium`)
- **Price:** ₹199/month or ₹999/year (live DB; **verify** — see conflict above). All prices GST-inclusive.
- **Commission:** 0%.
- **Support:** priority.
- **Limits:** everything unlimited except 2 calendar integrations.

Inactive/legacy plans in the DB (do not quote): Starter (Legacy), Starter (retired), Meeticulous Active (Partner / Legacy Studio), Pro (Founding), Supreme.

## Fees on every paid booking (both plans)
- Flat **₹10 booking fee + 18% GST**, charged by Meeticulous (from `pricingEngine.js`).
- Razorpay's payment-gateway fee, charged by the gateway.
- Host earnings are computed from the service price the host sets, not the guest total.
- Minimum paid service price: **₹100**.

## Statutory (from `pricingEngine.js`)
- GST 18%. TDS Sec 194-O: 1% (5% if no PAN). TCS Sec 52: 1%.

## Founding-100
First 100 Pro hosts; **spots-left count comes from the live `foundingSpots.js` counter, never hardcoded.** Founding-member badge applies.

## What Meeticulous is / is not
- One-to-one appointment booking for Indian professionals, with online payment collection.
- **Not supported** (never promise): group sessions, team calendars, native Zoom. See `docs/help/whats-not-supported-yet.md`.

## Legal pages (agents never reinterpret — route questions to the founder)
`/terms`, `/privacy`, `/refund`, `/guest-terms`, `/host-agreement`.

## Refund policy (from `docs/help/refunds-and-failed-payments.md`)
100% if cancelled 24h+ before · 50% at 6–24h · none under 6h · full if the host cancels.

## Entity
Brand **Meeticulous**, legal entity **Rajmudra Media LLP**. Invoices currently still issue as
**Timewheel Internet Pvt Ltd** (`server/config/sellerIdentity.js`) — migration pending (ARTHA tracks).
