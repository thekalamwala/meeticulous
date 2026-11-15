---
status: DRAFT — founder must verify before any agent uses it
owner: DISHA
last_verified: 2026-11-14
verified_against: subscription_plans (live DB spquowzrefozmrzoszkf), server/lib/pricingEngine.js
---

# Product facts — the single source of truth

> **DRAFT.** Seeded for the SUTRA agent network. No agent may state a price, feature, limit,
> policy or timeline that contradicts this file (README §2.1). Pricing is founder-confirmed
> (below); the rest still needs a founder pass before customer-facing agents go live. DISHA keeps
> this file true after every release; plan limits always come from `subscription_plans.limits`.

## Pro price (confirmed by founder, 2026-11-04)
- **Final price the guest pays: ₹199/month or ₹999/year.** This is what agents quote. Matches the live DB (`subscription_plans`, slug `premium`).
- ₹235/month and ₹1,179/year are the same prices **with 18% GST shown on top** (199×1.18, 999×1.18) — a derivation, not a separate price. Don't quote these as "the price".
- ₹399/₹3,599 (old help docs) and the ₹1,179 "regular" in CLAUDE.md are **discarded** — stale.
- Those stale figures still live in `docs/help/*` and root `CLAUDE.md`; DISHA/YANTRA fix them in a follow-up.

## Plans (active, from the live DB)

### Starter (slug `free`)
- **Price:** ₹0, free forever. No card.
- **Commission:** 5% per paid booking.
- **Limits:** CRM 10 contacts · 2 free (₹0) services · 10 AI generations / 6 months · 3 digital products · 1 reminder flow · 0 follow-up flows · 1 calendar integration. Unlimited paid services, categories, bookings.

### Pro (slug `premium`)
- **Price:** ₹199/month or ₹999/year (final price the guest pays). ₹235 / ₹1,179 = the same with 18% GST shown on top.
- **Commission:** 0%.
- **Support:** priority.
- **Limits:** everything unlimited except 2 calendar integrations.

Inactive/legacy plans in the DB (do not quote): Starter (Legacy), Starter (retired), Meeticulous Active (Partner / Legacy Studio), Pro (Founding), Supreme.

## Fees on every paid booking (both plans)
- Flat **₹10 booking fee + 18% GST**, charged by Meeticulous (from `pricingEngine.js`).
- Razorpay's payment-gateway fee, charged by the gateway.
- Host earnings are computed from the service price the host sets, not the guest total.
- Minimum paid service price: **₹100**.

## Statutory (from `pricingEngine.js`, live `DEFAULTS` path)
- GST 18%. TDS Sec 194-O: **flat 1% for all** (the old "5% if no PAN / §206AA" rate was dropped 2026-11-11). TCS Sec 52: 1%.
- A config-driven withholding engine (`tds_tcs_v2`: 0.1% TDS / 0.5% TCS, PAN + GSTIN-aware, individual threshold) is **built but behind an OFF flag** — do NOT quote its rates. While the flag is OFF every paid booking uses the legacy flat 1% + 1%.

## Recently shipped / not yet live (DISHA, 2026-11-14 — from merged commits, founder to verify)
- **Live:** image uploads up to 5MB · 16-colour profile palette on Pro · gifted (complimentary) Pro granted by Meeticulous admin · cancellation policy disclosed at checkout (standard 24h/6h tiers for everyone) · free→Pro conversion nudges (commission-paid meter, plan comparison, profile views) · feature-page visual refresh · Diwali 2026 moment.
- **Built but OFF (do not announce or promise):** LinkedIn host login (`host_linkedin_login`) · community (`community*` flags) · Pro per-service cancellation-policy presets (`pro_cancellation_policy` — while OFF, the standard 24h/6h refund tiers apply to all) · config-driven TDS/TCS engine (`tds_tcs_v2`).
- Gifted Pro is not a purchasable product; never quote it as a plan or price.

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
