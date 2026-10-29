# Legal Rewrite Review — Seller-of-Record → Marketplace / Platform Facilitator

**Date:** 6 August 2026
**Scope:** every legal document, rewritten for internal consistency with the marketplace model.
**Rule applied:** structure, numbering, formatting, DPDP / Consumer-Protection / IT-Act / dispute /
liability / IP / acceptable-use provisions **preserved**. Tax/GST treatment **NOT determined** —
left generic; GST-specific clauses **flagged for CA review**, not rewritten.

> Companion to `docs/legal-marketplace-revert-brief.md` (the facts) and `docs/payment-model.md` v4.
> All changes are DRAFT pending lawyer sign-off; effective date stays future; nothing deploys until
> reviewed. This document is the "show your work": per clause → why inconsistent → revised wording.

## The model (one paragraph)
Book A Sloth is a **technology platform / marketplace facilitator**. Hosts are independent providers
who sell their services to guests through the Platform. Book A Sloth provides discovery, scheduling,
payments, reminders, communication, and support, and earns a **platform fee** (and, on some plans, a
commission). Book A Sloth does **not** buy, resell, or supply the underlying service; is **not** the
seller of record; does **not** own the booking revenue; and is **not** the host's employer. The
contract for the service is **between host and guest**.

## Files reviewed
| File | Route | Status |
|---|---|---|
| `client/src/pages/Terms.jsx` | /terms | ✅ rewritten (prev commit) — §1/§2/§4/§5/§6/§11/§12 |
| `client/src/pages/GuestTerms.jsx` | /guest-terms | ✅ rewritten (prev commit) — §1/§2.3/§7.3/§8 |
| `client/src/pages/HostFees.jsx` | /host-fees | ✅ rewritten (prev commit) — full, factual |
| `client/src/pages/HostAgreement.jsx` | /host-agreement | ✅ rewritten this pass — §1/§2/§3/§5/§6/§10/§16 |
| `client/src/pages/Refund.jsx` | /refund | ✅ rewritten this pass — §7(flag)/§8 |
| `client/src/pages/Privacy.jsx` | /privacy | ✔ reviewed — no legal inconsistency; 1 optional nit |

## GST / tax clauses left generic + flagged for CA (NOT rewritten on tax substance)
1. **HostAgreement §6** (invoicing & GST) — who issues which tax invoice, ITC recovery, GSTR-1/2B
   mechanics. Structural role rewritten (host invoices the guest for the service; BAS invoices the
   host for its fee/commission); **all GST rate/credit/return mechanics = CA review**.
2. **HostAgreement §5.4/§5.5** — GST-status effect on payout mechanics. **CA review.**
3. **HostAgreement §8** — TDS 194-O / TCS §52 rate, PAN, certificate mechanics. Marketplace-consistent
   (operator withholds from participant) but **rates/sections = CA confirm.**
4. **HostFees §3/§6** — TDS/TCS + commission-invoice + host-own-invoice mechanics. **CA confirm.**
5. **Refund §7** — credit-note-against-tax-invoice + GST adjustment bullet. **CA review** (kept generic).
6. **Commission SAC** — `SAC_COMMISSION` placeholder 998311 is likely wrong; **CA to supply correct SAC.**

## Regulatory (non-tax) flag — payment flow / RBI
**HostAgreement §16 and §2.4 / Terms §2.4** describe Book A Sloth collecting the guest's payment and
remitting the host's amount. The precise legal characterisation of that money flow (payment-facilitation
vs settlement, and its fit with the RBI Payment-Aggregator position) is **lawyer + CA territory** — the
marketplace wording below is drafted generically and must be confirmed against the CA/lawyer PA-waiver.

---

## Terms & Conditions (/terms) — applied previous commit

| # | Clause | Why inconsistent | Revised |
|---|---|---|---|
| 1 | §1 defs "Host supplies **to Book A Sloth**"; "Guest buys **from Book A Sloth**" | Assumes BAS buys + resells | "Host **sells to guests through the Platform**"; "Guest buys **from a host through the Platform**" |
| 2 | §2 "buys services from hosts and sells them… seller and supplier of record… money is our own revenue… no contract between host and guest" | Every marketplace-incompatible assumption in one clause | §2 rewritten: BAS is an **online marketplace**; **host is seller/supplier**; **contract is host↔guest**; BAS invoices **its fee/commission only**; collects + remits (⚖️ flag); provides grievance redressal; not employer |
| 3 | §4 "You supply **to Book A Sloth**, which sells onward" | buys/resells | "You **sell to guests through the Platform**; your contract is with the guest" |
| 4 | §5 "you are buying from Book A Sloth… host performs as our service partner" | seller-of-record | "you are buying **from the host**; BAS operates the Platform" |
| 5 | §6 "tax invoice… for the full amount"; "We **purchase** each service from the host… payment to a supplier"; "GST on **our sale to the guest**"; "As the seller, we make refunds" | buys/resells + invoices underlying service + owns revenue | "invoice for **our booking fee**; host invoices own service price"; "**Payments to hosts** — we collect and pay the host their price net of fee/gateway/TDS/TCS"; "GST on **our own fee & commission**; host responsible for GST on their service"; "we **facilitate** refunds" |
| 6 | §11.2 "we sell them as supplier of record and stand behind them" | seller liability assumption | "services **supplied by the host**; BAS operates the marketplace + grievance redressal; does not perform/warrant; CPA rights not excluded" |
| 7 | §12.1 "our liability as seller for a service we sold you" | seller liability | "responsibility for the service lies with the **host**; consumer rights unaffected" |

## Guest Terms (/guest-terms) — applied previous commit

| # | Clause | Why inconsistent | Revised |
|---|---|---|---|
| 1 | title + intro "buying **from Book A Sloth**… We are the seller" | seller-of-record | "buying **from the host**; **Book A Sloth is the marketplace**; you can still come to us — grievance + refund facilitation; consumer rights preserved" |
| 2 | §1 "Book A Sloth **buys** the service and **sells** it to you… seller and supplier of record" | buys/resells | §1 rewritten: **host is seller**; BAS lists/books/collects/supports; you have one place to raise a problem (grievance redressal) |
| 3 | §2.3 "tax invoice… for the **full amount**" | invoices underlying service | "invoice for **our booking fee**; host invoices own service price if registered" |
| 4 | §7.3 "**Because we are the seller**, you do not need to pursue the host" | seller-of-record | "raise any problem with us first; as the marketplace we provide grievance redressal + facilitate refunds" |
| 5 | §8 "we are responsible to you **as the seller**" | seller liability | §8 → host is seller/responsible for the service; BAS facilitates refunds + grievance (CP E-Comm Rules 2020); ⚖️ lawyer; CPA rights preserved |

## Host Fee & Payment Schedule (/host-fees) — applied previous commit
Full rewrite. Removed the `V = E + ₹10` seller-model computation and the "Book A Sloth is the seller of
record, so GST is chargeable on the whole sale" clause. Now: you set your price; guest pays price +
booking fee + GST on the fee; you receive price − commission − gateway − TDS − TCS. Numbers match
pricingEngine v4 (guest ₹1,011.80; host ₹959.76 paid / ₹909.76 free). Documents: payment advice (non-tax)
+ commission tax invoice + host's own invoice for their service. GST specifics flagged for CA.

## Host Services Agreement (/host-agreement) — applied THIS pass

| # | Clause | Why inconsistent | Revised (see diff below) |
|---|---|---|---|
| 1 | §1 defs "Guest purchases **from Book A Sloth**"; "Target Earning / Host Consideration / Guest Price" | buys/resells framing | Guest purchases **from the Host via the Platform**; recharacterise price terms to your-price / platform-fee |
| 2 | §2 "You supply **to Book A Sloth**… BAS sells onward **in its own name**… money received is **BAS's own revenue**… neither collects for the other" | The seller-of-record + no-settlement spine | §2 rewritten to marketplace: you sell to the guest; BAS is the facilitator; you **authorise BAS to collect and remit**; BAS's revenue is its **platform fee/commission only** (⚖️ payment-flow flag) |
| 3 | §3 "**purchase order from Book A Sloth to you**" | BAS buys | "a **booking placed by a Guest** with you, facilitated by the Platform" |
| 4 | §5 "V = E + Booking Charge… BAS supplier of record so GST on full Guest Price" | seller computation + GST determination | your-price + platform-fee model; GST mechanics → **CA review** |
| 5 | §6 invoicing/GST "**you invoice Book A Sloth**… draft invoice for adoption" | host invoices BAS (buys) | host invoices **the guest** for the service; BAS invoices **the host** for fee/commission; GST mechanics → **CA review** |
| 6 | §10 "**Because Book A Sloth is the supplier of record**, guest claims handled by us… our decision to refund is final" | seller liability | BAS provides grievance redressal + facilitates refunds as marketplace; **host responsible for the service**; recovery from host preserved |
| 7 | §16 "**No collection on either's behalf**… money is BAS's own revenue… not a settlement/escrow/pass-through" | The anti-settlement clause — directly false under marketplace | Rewritten: BAS **collects the guest payment through its payment partner and remits the host's amount** net of fee/gateway/TDS/TCS; BAS's revenue is its platform fee/commission (⚖️ RBI/PA flag) |

Clauses **4, 7, 8, 9, 11–15, 17–22 preserved** (warranties, set-off, TDS mechanics, data protection,
confidentiality/IP, off-platform, indemnity, our-liability, term, dispute resolution, general) — they are
marketplace-compatible as written (a marketplace can still impose host warranties, set-off, and off-platform
rules). §8 TDS retained; rates/sections flagged for CA.

## Refund & Cancellation Policy (/refund) — applied THIS pass

| # | Clause | Why inconsistent | Revised |
|---|---|---|---|
| 1 | §8 "Book A Sloth **buys the service from the host and sells it to you**" | buys/resells | §8 → BAS **facilitates** the refund as the marketplace and recovers from the host under its Host Agreement; host is the seller |
| 2 | §7 credit-note/GST bullet | GST mechanics | kept, **flagged for CA review** |

Cancellation windows, non-refundable-fee rationale, full-refund triggers (§3 already "host/we cancel"),
reschedule, chargebacks, fraud, CPA rights (§12) — all preserved (marketplace-compatible).

## Privacy Policy (/privacy) — reviewed, no rewrite needed
Data Fiduciary role unchanged. Host receiving guest data "to deliver the service" is already the
provider model. Payment processor = Razorpay (unchanged). **One optional nit** (not a legal
inconsistency): L9 "settle host payouts" could read "process host payments" to avoid settlement
connotations — left as-is per the "only if necessary" instruction; noted for the lawyer.

---

### Not copied from Topmate
Wording is authored for Book A Sloth's own structure (independent hosts, platform fee, grievance
redressal under CP E-Commerce Rules 2020, collect-and-remit flagged for CA). No third-party policy text.
