# Legal & Tax Review Brief — Merchant-of-Record Documents

**For:** external counsel and chartered accountant
**From:** Timewheel Internet Private Limited (Meeticulous)
**Date:** 24 July 2026
**Documents to review:** `/terms`, `/guest-terms`, `/refund`, `/host-agreement`, `/host-fees`
**Commercial model:** `docs/payment-model.md`

> These documents are **drafts prepared in-house**, not by a lawyer. They have not been
> reviewed by counsel. No host should be onboarded and no guest should transact against
> them until they have been. They carry a future effective date for that reason.

---

## 1. What changed and why

Meeticulous previously operated, and its published terms described, a **marketplace**: guests paid into
one company account, the company deducted a fee, and hosts were paid by manual transfer.

Razorpay confirmed in writing that a standard merchant account does not permit collecting from customers
and redistributing to third parties, and that Razorpay Route is the compliant path for that model. Route
requires GST-3B turnover above ₹40 lakh, which the company does not have. An own payment-aggregator
licence requires ₹15 crore net worth.

The company has therefore restructured as a **merchant of record**:

> The host sells the service to Meeticulous and invoices us. Meeticulous sells it to the guest and
> invoices the guest. Money received from guests is the company's own revenue; payment to the host is a
> vendor bill. Nothing is collected on behalf of, or settled to, a third party.

The intended consequence is that the RBI *Regulation of Payment Aggregators Directions, 2025* do not
engage at all, because §4(i) applies to entities that collect from customers on behalf of merchants and
subsequently settle those funds to those merchants. This is the ordinary structure of an inventory-model
e-commerce business.

**The documents in this review exist to make that characterisation true in substance, not just in
label.** That is the specific thing we need confirmed.

---

## 2. Questions for the chartered accountant

1. Confirm that as merchant of record — receiving guest payments as our own revenue and paying hosts as
   suppliers — we fall **outside** the PA Directions entirely.
2. Confirm that **no input tax credit** arises on purchases from unregistered hosts, and that no reverse
   charge or self-invoicing route is available to recover it for our service categories.
3. Confirm **§9(5) e-commerce operator liability** does not apply to our categories (we are not
   passenger transport, accommodation, restaurant, or housekeeping).
4. **Confirm §24(ix) compulsory registration does not hit our hosts.** Our position is that a host
   supplies *to* us, not *through* us, so the section does not engage. If correct this is a material
   benefit to small hosts and we want to say so in the product.
5. Correct **TDS section and rate** per service category (we have assumed 194-J at 10%), the current
   threshold, and the treatment where a host crosses it mid-year.
6. Confirm **TCS under §194-O no longer applies**, since we are the supplier rather than a facilitator.
7. **SAC codes and GST rates per service category.** We currently use a single 998314, which we do not
   think survives at gross turnover.
8. **Place of supply** for online and in-person services supplied to unregistered guests — IGST vs
   CGST+SGST, and exactly what we must capture at checkout.
9. Should registered hosts issue their **own tax invoices**, or is a documented self-billing arrangement
   acceptable? We have drafted for host-issued with self-billing as an alternative.
10. Which **turnover thresholds** arrive earlier now that declared revenue is gross merchandise value
    rather than fee income — tax audit and any others.
11. Whether our own **GST registration needs amendment** for the change in the nature of supply.

### Specific document points for the CA

- **Host Agreement clause 5.2** treats all Platform prices as tax-inclusive. Is that formulation safe?
- **Clause 6.3** makes denied input tax credit recoverable from the host. Enforceable as drafted?
- **Clause 6.4** — the *Payment Advice* for unregistered hosts. We have been explicit that it is not a
  tax invoice and generates no credit. Confirm the format and the wording are correct.
- **Host Fee Schedule section 4** contains the worked examples hosts will rely on. Please check every
  number.

---

## 3. Questions for counsel

### 3.1 Points where we believe the drafting is deliberately weak, and want confirmation

We have **not** attempted to disclaim the following, because we believe the attempt would fail and
would also contradict our tax position. Please confirm or correct:

1. **Consumer Protection Act 2019 liability cannot be contracted away.** As seller of record we are the
   supplier and are liable to the guest for deficiency in service. Guest Terms clause 8 is drafted on
   that basis rather than attempting a broad exclusion.
2. **An arbitration clause does not bind a consumer** in India; consumer disputes are non-arbitrable.
   Arbitration therefore appears only in the Host Agreement (clause 20), not in the guest documents.
3. **An exclusive jurisdiction clause cannot override a consumer's statutory right** to file where they
   reside or work (CPA §34(2)(d)). The previous Terms claimed exclusive jurisdiction at Jajpur against
   all users; that has been removed for guests.
4. **"All sales final" cannot defeat a deficiency-of-service claim.** The Refund Policy therefore states
   cancellation windows but preserves the statutory remedy expressly.

### 3.2 Points where we have drafted in the company's favour and want an enforceability opinion

Please tell us which of these would survive challenge, and which read as **unfair contract terms** under
CPA §2(46) and are liable to be struck down under §49(2)/§59(2):

| Ref | Term |
|---|---|
| Host Agreement 7.1 | Twice-monthly payment cycle, 7-day clearing before a booking enters a cycle |
| Host Agreement 7.2 | ₹500 minimum payment threshold, balance carried forward |
| **Host Agreement 7.3** | **10% security holdback for the first 90 days / 20 bookings** — we consider this the most likely to be challenged |
| Host Agreement 7.4 | Broad right to defer payment during any open complaint or verification |
| Host Agreement 7.7 | Statement deemed accepted after 30 days |
| Host Agreement 9.1 | Broad set-off, including ₹500 chargeback handling charge |
| Host Agreement 12.3 | ₹250 handling charge on host cancellation or non-attendance |
| **Host Agreement 15.3** | **12-month disintermediation with liquidated damages at 3× charges, capped ₹10,000** — genuine pre-estimate, or a penalty? |
| Host Agreement 18.3 | Our liability to hosts capped at 3 months' charges or ₹10,000 |
| Host Agreement 19.4 | Final payment up to 120 days after the last booking |
| Guest Terms 5.2 / Refund 2 | Booking and processing charge non-refundable on guest cancellation |
| Refund 1 | 24h / 6h cancellation tiers with 100% / 50% / 0% refund of the service amount |

The hosts are businesses, so we expect more latitude there than in the guest documents — but several
hosts will be individuals, and we would like to know where that distinction stops helping us.

### 3.3 Structural questions

5. **Consumer Protection (E-Commerce) Rules 2020.** As an *inventory* e-commerce entity rather than a
   *marketplace* entity, Rule 7 duties appear to attach to us directly, and they are more onerous than
   the marketplace regime we were previously in. Please advise what we must publish, disclose, and
   operate as a result. **This is the compliance surface we understand least.**
6. **Substitution right** (Host Agreement 3.4 / Guest Terms 5.5) — we allow ourselves to substitute an
   equivalently qualified provider, with a full refund if the guest objects. Acceptable?
7. **Host classification.** The Host Agreement is drafted as independent contractor. Given we set the
   commercial terms, hold the customer relationship, and control the platform, is there any misclassification
   risk we should be drafting against?
8. **Professional liability.** We are now the supplier of services performed by third parties, some of
   which are regulated or physical. Should the company carry professional indemnity or public liability
   insurance, and at what level? Host Agreement clause 17 indemnifies us, but an indemnity from an
   individual with no assets is worth little.
9. **DPDP Act 2023.** Host Agreement clause 13 treats the host as processing guest data on our
   instructions, with a 24-hour breach notification. Is that the correct allocation, and is the clause
   sufficient?
10. **Data of hosts.** We collect PAN, bank details, and KYC documents. Please confirm our retention and
    security obligations are adequately reflected in the Privacy Policy.
11. **The transition.** Existing hosts accepted the old marketplace terms. What is required to move them
    onto the Host Services Agreement — fresh affirmative acceptance, notice period, both? We assume
    fresh acceptance and have not drafted a migration mechanism yet.

---

## 4. The one commercial fact both reviewers should know

An unregistered host is legitimately below the GST threshold, so selling privately his service carries
no GST. By inserting ourselves as seller of record, **an 18% tax arises that did not previously exist**.
It is borne from the listed price, so the host's guest pays roughly 19% more than if the host had been
booked directly.

We have not hidden this. The Fee Schedule states it in section 5, the Host Agreement states it at clause
5.5, and the product shows the host the exact figures before publishing a price.

Please tell us if there is any structuring that mitigates it which we have missed, and whether our
disclosure of it is adequate.

---

## 5. What we are asking for

1. Confirmation that the merchant-of-record characterisation holds, and a list of anything in these
   documents that undermines it.
2. A redraft or markup of the Host Services Agreement and Guest Terms of Sale.
3. A view on each term in the table at 3.2.
4. Answers to the CA questions at section 2 that we can rely on.
5. Advice on the Consumer Protection (E-Commerce) Rules 2020 obligations.
6. A view on insurance.

We are not onboarding new hosts until this is done.

**Contact:** Shubham Narendra Datarkar · team@timewheel.co.in · +91 8637758344
**Company:** Timewheel Internet Private Limited · CIN U62012OD2026PTC052654 · GSTIN 21AAMCT8270C1ZF
