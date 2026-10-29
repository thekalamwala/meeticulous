# Payment Model — Marketplace (v4)

**Version:** v4 — supersedes the Merchant-of-Record model (v1–v3).
**Status:** Live. This is the model the running product implements
(`server/lib/pricingEngine.js`) and the model every legal page describes.
**Supersedes:** Merchant of Record (v3) — never shipped; the product was always a
marketplace, and the MoR legal set (PR #564) was reverted to marketplace on 6 Aug 2026.

> Numbers below are the source of truth the legal pages quote back. They must stay
> identical to `pricingEngine.js` and to `/host-fees`. Change one, change all three.

---

## 1. The model in four lines

1. The **host is the seller** of the service. The contract for the service is **between the host and the guest**.
2. **Meeticulous is the marketplace.** It lists, books, collects payment, and supports — and charges a booking fee (to the guest) and, on some plans, a commission (to the host).
3. Meeticulous invoices **only its own fee + commission**, under its GSTIN. It never invoices the host's service price.
4. The guest's money for the host's price is **collected and remitted to the host**, net of the payment-gateway charge and statutory TDS/TCS. It is not Meeticulous's revenue.

**Payment runs through Razorpay, an RBI-authorised payment aggregator.** Meeticulous's own
revenue is the Platform Fee. The host's price is the host's money, passing through to the host.

---

## 2. Why the RBI Payment-Aggregator rule is handled

The RBI *Regulation of Payment Aggregators Directions, 2025* governs entities that collect
customer money on behalf of merchants and settle it to them. The collection and settlement
here are performed by **Razorpay, a licensed PA** — the regulated party is Razorpay, not us.
Meeticulous is a marketplace whose own revenue is its fee + commission; the host's price is
collected through the authorised PA and remitted to the host.

The characterisation holds only if the contracts, invoices, books, and product all say the
same thing:

1. **The host contract is a marketplace listing + collect-and-remit agreement.** Host sells to the guest; BAS facilitates and remits. (`/host-agreement`)
2. **Guest terms name the host as the seller.** BAS is the marketplace, liable for its platform obligations and grievance redressal, not for performing the service. (`/guest-terms`)
3. **The guest invoice is for the booking fee only**, under BAS's GSTIN. The host's service price is the host's own supply. No line item resells the host's service.
4. **BAS invoices the host for its commission** (a taxable platform service) and issues a **Payment Advice** (non-tax) for the host's price.
5. **The books show fee + commission as revenue** — not the host's price as "collections."
6. **The product uses marketplace language.** The host is paid their price; BAS earns its fee.

---

## 3. The three plans

| Plan | Booking fee (to guest) | Commission (to host) | Payment processing | Max service price |
|---|---|---|---|---|
| **Starter** (free) | ₹10 + GST | **5%, GST-inclusive** | actual gateway charge | **₹5,000** |
| **Host+** | ₹10 + GST | nil | actual gateway charge | none |
| **Studio** | ₹10 + GST | nil | actual gateway charge | none |
| **Enterprise** | as agreed | as agreed | as agreed | as agreed |

The booking fee is charged to the guest; the commission is charged to the host. Studio and
Host+ are economically identical — Studio differs on non-financial platform features only.

Subscriptions: Starter free, Host+ ₹229/month or ₹1,499/year, Studio ₹555/month, Enterprise
negotiated. Billed by BAS to the host as a normal B2B supply with GST.

---

## 4. The master formula

The host sets the price they want. The guest's total and the host's payout are computed.

```
Guest pays   =  price + bookingFee + gstOnBookingFee     (₹1000 → 1000 + 10 + 1.80 = 1,011.80)
Host payout  =  price − commission − gatewayCharge − TDS(1%) − TCS(1%)
```

- `bookingFee` is flat (default ₹10, admin-configurable), **0 for free services**.
- `gstOnBookingFee` = 18% of the booking fee, **added on top** (₹1.80 on ₹10).
- `commission` = plan % of price, **GST-inclusive** (the 5% already contains its 18% GST).
- `TDS` = 1% of the service price (194-O income-tax). **5% if the host has no PAN.**
- `TCS` = 1% of the service price (§52 CGST GST-collection).

**The guest pays the same total whatever plan the host is on** — the booking fee is constant
and the commission is taken from the host's side, never added to the guest price.

Reference constants (`E = ₹1,000`, gateway ≈ ₹20.24 at ~2%):

| | Host+ / Studio | Starter (5%) |
|---|---|---|
| Guest pays | ₹1,011.80 | ₹1,011.80 |
| − commission | — | ₹50.00 (incl. GST ₹7.63) |
| − gateway (~2%) | ₹20.24 | ₹20.24 |
| − TDS (1%) | ₹10.00 | ₹10.00 |
| − TCS (1%) | ₹10.00 | ₹10.00 |
| **Host receives** | **₹959.76** | **₹909.76** |

TDS and TCS are the government's, deposited against the host's PAN and claimable in the
host's returns — not Meeticulous's revenue.

---

## 5. Scenarios

### 5.1 — GST-registered host
The host issues their own tax invoice to the guest for their price and accounts for GST on it.
BAS issues the host a **commission tax invoice** (host claims input credit) and a **Payment
Advice** for the price. Host payout unchanged by GST status — ₹959.76 / ₹909.76.

### 5.2 — Unregistered host (the most common host — design for this person)
No GST arises on the host's price. BAS still issues the **Payment Advice** (non-tax) and, on
Starter, the commission tax invoice. **The Payment Advice must never be titled "Tax Invoice"**
and carries no GST line — it is the host's record of what they earned and what was deducted.

### 5.3 — Free booking (₹0)
Nothing happens: no fee, no commission, no gateway, no TDS, no TCS. **Hard-guard the formula
so it never returns a charge on ₹0.** (`pricingEngine` handles this.)

### 5.4 — Guest cancels
Refund per `/refund` tiers. **The booking fee and payment-processing charge are non-refundable
on a guest cancellation** — the gateway does not return its MDR on a refund, so that cost is
real and already spent. This is only defensible because it is **disclosed at checkout before
payment**. Keep the checkout disclosure in step with the Refund Policy.

### 5.5 — Host no-show / cancels
Guest is refunded in full, **including the booking fee and gateway charge**. No payout to the
host. BAS recovers the refund's processing cost + a ₹250 handling charge from the host under
the set-off clause (Host Agreement cl 9 / 12.3). **Never pay the host instantly** — a host
balance is the only thing a refund can be clawed from. Weekly-plus cycle, after the dispute
window closes.

### 5.6 — Chargeback
₹1,500–2,500 fee plus the full amount reversed. Biggest tail risk. Prevent, don't price in:
3DS on all cards; statement descriptor must read `meeticulous`; keep booking confirmation and
attendance mark as evidence. BAS recovers a ₹500 handling charge from the host where the
chargeback is attributable to them.

### 5.7 — Host has no PAN
TDS jumps 1% → 5% (194-O without PAN). **PAN is mandatory before the host can accept a paid
booking** — enforced in code; keep it enforced.

### 5.8 — TDS threshold
194-O withholding applies from the first rupee once the operator crosses the per-host
threshold; track cumulative payments **per host, per financial year**. Confirm the current
threshold with the CA.

### 5.9 — Guest in another state / international
Capture the guest's **state at checkout** — it determines IGST vs CGST+SGST on the booking
fee. International cards carry higher MDR; the actual gateway charge is passed through to the
host, so BAS's fee margin is unaffected.

### 5.10 — High-value booking on the free plan
**Starter cannot list a service above ₹5,000.** The cap lives in `subscription_plans.limits`.
Cap the price, never the commission in rupees — a flat rupee cap on a percentage cost goes
negative at scale.

---

## 6. Money-protection rules (never lose money on a booking)

These are the guards that keep every booking non-loss-making:

1. **Booking fee + processing charge are non-refundable on guest cancellation**, disclosed before pay.
2. **No instant host payment.** Twice-monthly cycle, 7-day clearing, dispute window closed first.
3. **10% security holdback** for the first 90 days / 20 bookings — the buffer a clawback draws from.
4. **Broad set-off** (Host Agreement cl 9): refunds, chargebacks, denied ITC, tax demands, handling charges, off-platform liquidated damages.
5. **PAN gate** before first payout; **GST name-match** before releasing the GST component.
6. **Chargeback prevention**: 3DS, `meeticulous` descriptor, evidence retention.
7. **Credit note on refund** issued against the reversed invoice before **30 November** following that FY, or the GST cannot be adjusted.

---

## 7. Documents per booking

| Recipient | Document | Notes |
|---|---|---|
| Guest | **Tax invoice for the booking fee** | BAS GSTIN; guest state; the fee only. Never the host's price. |
| Host (any) | **Payment Advice** | Non-tax. Records the host's price and every deduction. Never titled "Tax Invoice"; separate serial series. |
| Host (Starter) | **Commission tax invoice** | BAS → host, with GST. Host claims input credit if registered. |
| Host (registered) | **Host's own service invoice** | The host's supply to the guest; the host's responsibility. |
| Host | **TDS / TCS credit** | 194-O + §52, deposited against the host's PAN; Form 16A + GST TCS statement. |

---

## 8. What the CA still confirms (kept as live questions, not blockers)

The consumer-facing legal copy states the model firmly. These remain items to confirm with the
CA and keep the code aligned to — they do not change the model, only its edges:

1. Correct SAC for the platform fee and for commission (invoice-level; `SAC_COMMISSION` in code is a placeholder to confirm — do **not** guess it into the legal pages).
2. Place of supply for the booking fee to unregistered guests (state capture at checkout).
3. Current 194-O TDS threshold and mid-year crossing.
4. §9(5) e-commerce operator liability — confirmed **not** applicable to our categories (none are transport/accommodation/restaurant/housekeeping); guard comment in `serviceCategoryController`.
5. CP E-Commerce Rules 2020 marketplace duties (Rule 4/5) — disclosures added to `/guest-terms` and `/terms`; confirm completeness.

---

**One sentence.** The host sells to the guest, we run the marketplace and earn a fee, the
host's money is collected through an authorised aggregator and paid on to the host — and every
money-protection rule above is what keeps each booking non-loss-making.

---

## Changelog

- **v4** — Marketplace model. Host is the seller; contract host↔guest; BAS invoices fee + commission only; guest pays `price + ₹10 + GST-on-fee` (₹1,011.80); host receives `price − commission − PG − TDS 1% − TCS 1%` (₹959.76 paid / ₹909.76 free); commission GST-inclusive; TDS 194-O + TCS §52 at 1% each against host PAN; payment via Razorpay (RBI-authorised PA). Supersedes the Merchant-of-Record model, which never shipped.
- **v1–v3** — Merchant-of-Record (host sells to BAS, BAS resells to guest, guest total ₹1,191.80, TDS 10%). Abandoned 6 Aug 2026; retained only in git history.
