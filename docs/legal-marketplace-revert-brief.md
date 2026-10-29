# Legal Revert Brief — Merchant-of-Record → Marketplace (v4)

**For:** counsel (final copy is the lawyer's; this brief supplies the engineering facts).
**Date:** 6 August 2026
**Context:** `docs/payment-model.md` v4. The MoR legal set (PR #564) is being reverted to a
marketplace/intermediary model. The **running product is already marketplace** — these docs
describe an abandoned seller-of-record model and must not go live as-is.

> Two kinds of change live below. **Factual** items (numbers, who-invoices-whom, TDS/TCS, PAN)
> are settled by the built system and stated precisely. **Legal-stance** items (consumer
> liability, CPA positioning, jurisdiction) are flagged ⚖️ — the lawyer decides these; do not
> treat the engineering suggestion as final.

---

## The model, in one paragraph (factual)

Meeticulous is an **intermediary/marketplace**. The host is the supplier and seller of the
service; the guest is the buyer; the contract for the service is **between host and guest**.
BAS's own supply is a platform service (a booking fee to the guest, and a commission to the
host). BAS invoices **only its own fee + commission** under its GSTIN — never the host's service
price. Guest money for the host's price is **collected and paid onward to the host**, net of
the payment-gateway charge and statutory TDS (194-O) and TCS (GST §52). Host gets a **payment
advice** (non-tax) for the service price and a **commission tax invoice** from BAS.

This restores the exact line PR #564 removed: *"We are an intermediary; the contract is directly
between the host and the guest."*

---

## Per-document changes

### `/terms` — `client/src/pages/Terms.jsx`
- **Header comment + §2 "What Meeticulous is"** — the load-bearing revert. Currently: "buys
  services from hosts and sells them to guests in its own name… seller and supplier of record…
  guest's contract is with Meeticulous… money received from a guest is our own revenue."
  → Marketplace: BAS is an intermediary; the host is the seller/supplier; the service contract
  is host↔guest; BAS invoices only its fee + commission; guest money for the service is
  collected on the host's behalf and paid onward net of PG/TDS/TCS.
- **§1 Definitions** — "Host = supplies services **to Meeticulous** for onward sale" → "Host =
  seller who supplies services **to guests** via the Platform." "Guest = buys **from Book A
  Sloth**" → "buys **from the host** via the Platform."
- **§4/§5** — remove "you supply to Meeticulous / you buy from Meeticulous"; restate as
  host-sells-to-guest, BAS facilitates.
- **§6 Bookings/payments/taxes** — "we issue the guest a tax invoice for the full amount" →
  BAS invoices only its fee (guest) + commission (host); host's price documented by payment
  advice; TDS **1%** (194-O) + TCS **1%** (§52) deducted from host, not "TDS at 10%."
- ⚖️ **§11.2 / §12.1 (liability)** — currently "we sell them as the supplier of record and we
  stand behind them." Marketplace flips this to intermediary-not-liable-for-the-service. **This
  is the consumer-liability judgment — lawyer decides**, mindful of CP E-Commerce Rules 2020 and
  that the deliberately-weak CPA clauses must not be strengthened.

### `/guest-terms` — `GuestTerms.jsx`
- ⚖️ Currently names BAS as **supplier/liable** ("Terms of Sale"). Marketplace → BAS is
  facilitator; the sale is host→guest. Retitle concept ("Guest Terms of Service/Booking"?) and
  restate liability. **Lawyer-led** (CPA).

### `/host-agreement` — `HostAgreement.jsx`
- Header comment + body currently: "seller and not an intermediary, nothing is 'settled' to a
  third party… different from a marketplace arrangement." → **it IS a marketplace listing +
  collection-and-payout agreement.** Host authorises BAS to collect guest payment and remit the
  net (price − PG − commission − TDS − TCS). Add: commission is a taxable service BAS supplies to
  the host (tax invoice); **PAN mandatory before accepting paid bookings** (194-O).

### `/host-fees` — `HostFees.jsx` (mostly FACTUAL — numbers)
- The whole `V = E + ₹10` / `guest pays same regardless` model is gone. Replace with v4:
  - Guest pays = **listed price + ₹10 fee + 18% GST on the fee** (₹1000 → **₹1,011.80**), NOT ₹1,191.80.
  - Host earns = **listed − commission − PG − TDS(1%) − TCS(1%)**.
  - Worked example ₹1,000: **paid plan (Host+/Studio) → ₹959.76**; **free plan (5% commission,
    GST-inclusive) → ₹909.76** (with PG ≈ ₹20.24 illustrative; real = actual Razorpay).
  - Commission is **GST-inclusive** (5% contains its 18% GST); BAS issues a **commission tax
    invoice** to the host.
  - **TDS = 1% (194-O), TCS = 1% (§52)** — NOT 10%. Both deposited against host PAN, credit
    claimable.
  - §5 "Meeticulous is the seller of record, so GST is chargeable on the whole sale at our
    GSTIN" → **delete**. BAS does not charge GST on the host's price at all; the host handles
    their own GST on their own sale.
  - **PAN mandatory before any paid booking** (already enforced in code) — state it in §6.
- ⚖️ Payment-cycle / holdback / deduction clauses: keep, but the lawyer confirms wording fits an
  intermediary that collects-and-remits vs a buyer paying a supplier.

### `/refund` — `Refund.jsx`
- ⚖️ Currently seller-makes-refunds. Marketplace → refund responsibility/flow between host and
  BAS-as-facilitator. **Lawyer-led** (CPA refund rights unaffected).

### `LegalLayout.jsx`
- `MOR_EFFECTIVE` (1 Sep 2026, future) — keep the future-effective pattern (v4 not deployed
  yet), but the concept is now "marketplace model effective date." Rename to
  `MARKETPLACE_EFFECTIVE` when the copy is rewritten (ripples to GuestTerms/Refund imports).

---

## Landmines (from memory + #564)
- Do **not** strengthen the deliberately-weak CPA/consumer clauses (no consumer arbitration, no
  consumer jurisdiction clause) — they are weak on purpose.
- **CP E-Commerce Rules 2020, Rule 7** inventory/marketplace duties — still OPEN; the lawyer must
  place BAS correctly (marketplace vs inventory e-commerce entity).
- Payment Advice is **never** a tax invoice — separate series, no GST line.
- Effective date stays FUTURE until v4 actually deploys; a legal page contradicting the live
  product is worse than none.
