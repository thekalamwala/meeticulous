# TIPL compliance: what a new product inherits from Meeticulous

**Audience:** Claude sessions (and humans) building any new TIPL product on the same company + Razorpay.
**Written:** 2026-10-10, from Meeticulous code (`origin/main` lineage) + project memory. Not legal advice;
tax positions need the CA's written opinion.

**Entity:** Timewheel Internet Pvt. Ltd. (TIPL), GSTIN 21AAMCT8270C1ZF, PAN AAMCT8270C, Odisha.

## Rule of thumb

- **Entity-level things carry over:** GSTIN, TAN, CA relationship, filing pipeline, combined turnover.
- **Model-level things do NOT carry over:** CA rulings (given for a *services marketplace*), Razorpay
  approval (per website/business model), the written RBI PA-waiver (given for BAS's flow).
  A new money flow (tips, memberships, digital products) needs its own confirmation.

## ⚠️ Known defect in BAS itself (fix before copying)

`server/lib/pricingEngine.js:40-41` withholds **TDS 194-O = 1%** and **GST TCS §52 = 1%**.
Current law (verify with CA): **TDS 0.1%** (since 1 Oct 2024) and **TCS 0.5%** (since 10 Jul 2024).
The **₹5L individual-with-PAN TDS exemption** is not implemented. The CA's 2026-08-07 verbal "1% + 1%"
ruling appears to use pre-2024 rates. Do **not** copy these rates into a new product. Pending CA written
confirmation, then fix BAS (host payouts + 26Q/GSTR-8 exports affected).

## Covered in BAS (reusable)

| Area | What exists | Where |
|---|---|---|
| GST registration | TIPL registered; tax invoices for BAS's own fee/commission/subscription only (never host service value) | `server/services/invoiceService.js`, `server/config/sellerIdentity.js`, `invoices` table + `create_invoice` RPC (gap-free serials) |
| TCS §52 process | Collected per booking, snapshotted, GSTR-8 CSV export | `bookings.tcs_amount`, `withholdingReportService`, `GET /api/admin/reports/withholding?kind=tcs` |
| TDS 194-O process | PAN mandatory for paid bookings (409 without), withheld, 26Q CSV export, host can see own data | `createBooking` PAN gate, `kyc_submissions.pan_number` (AES via `utils/kycCrypto.js`), `?kind=tds`, `GET /api/vendor/withholding` |
| RBI PA scope | Razorpay Route live; host share settles to host's linked account; CA written PA-waiver received 2026-08-06 | `routeAutoPayoutService`, `routeAccountService`, `payoutReconciler` |
| GST §9(5) | Catalogue checked: no notified categories (transport, lodging, housekeeping, food). Guard comment on category create | `serviceCategoryController.create`, `serviceCategorySeed.js` |
| Chargeback / refund exposure | Route transfers held until service end + 24h; reversed on cancel/dispute; clawback flag + alert; refunds posted to ledger | `createHeldTransferForBooking`, `reverseHeldTransfer`, `recordBookingRefund` |
| Own ledger (not gateway-only) | Double-entry journal; GST/TDS/TCS payable accounts 2100/2300/2400 | `journalTemplates.js`, `docs/ledger.md` |
| KYC | PAN/bank/address/selfie, encrypted, auto-onboards to Route | `kyc_submissions`, `services/kycOnboarding.js` |
| GST reporting | Admin GST module (overview, recon, returns grid, exports) | `/admin/gst/*`, `server/services/gst/*` |

## Partially covered

| Area | Gap |
|---|---|
| DPDP Act 2023 / Rules 2025 | Privacy policy lists all processors (PR #606). **Missing:** self-service data export + deletion, breach (72h) runbook, per-purpose consent notices, grievance officer flow, log-retention policy. |
| PA scope hygiene | A legacy **manual payout rail** (`payout_requests` → `markPayoutPaid` / admin pull) still coexists with Route. Engineering rule "never collect-then-pay-manually" is not enforced in code. |
| Chargebacks | Hold rule is tied to service end time. No `creator_debts`-style carry-forward against future payouts; no "block payouts while dispute open" rule. |
| Gateway dependence | Ledger is in own DB ✅. No second gateway; Route ties BAS to Razorpay. |

## NOT covered (new product must solve)

1. **Tips as "supply"** — no ruling anywhere. Decides whether TCS/TDS/GST apply to tips. Tag every payment
   tip / product / membership in the ledger from day one.
2. **TCS registration (GST REG-07)** — BAS has the normal GSTIN; no record found of the separate
   e-commerce-operator TCS registration. Verify before relying on BAS's GSTR-8 pipeline.
3. **Razorpay approval for the new website/business model** — using BAS's merchant account for an
   undeclared product breaches merchant terms. Creator/donation category may need separate underwriting.
4. **PA-waiver coverage** — get the CA to confirm the written opinion covers the new product's flow.
5. **Hold rule for tips** — no "service end" exists; needs its own (e.g. T+2 for first-time creators).
6. **Dark patterns (CCPA 2023)** — BAS has no tips. Platform tip must be opt-in, unselected, separate line.
7. **Gateway cost negotiation / second gateway** — never done for BAS.
8. **Unit economics, free competitors (UPI QR, Super Thanks), founder bus factor** — strategy/ops, nothing to inherit.

## Questions for the CA (one consolidated ask)

1. Confirm current TDS 194-O (0.1%?) and TCS §52 (0.5%?) rates; ₹5L individual exemption handling.
2. Is a pure tip a "supply" for GST / TCS? For TDS 194-O?
3. Does TIPL hold a TCS registration (REG-07)? If not, register.
4. Does the 2026-08-06 PA-waiver opinion extend to the new product's flow?
5. Memberships / digital products: SAC + any §9(5) / OIDAR exposure.
