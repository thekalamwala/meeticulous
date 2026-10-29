# Legal ↔ Product Reconciliation Audit

**Date:** 12 August 2026
**Method:** read-only code audit of production `main` (`origin/main`, HEAD `94f85bb`). Product is the source of truth; no product code was changed. Findings carry file:line evidence and a confidence label.
**Audit hazard corrected:** the shared working tree had drifted to `marketing-integrations` (@ #589), which **predates the Route Epic**. An initial pass concluded "Route not built / unlicensed aggregation" — that was the stale branch and is **WRONG for production**. All findings below are re-anchored on `main`.

---

## 1. Current product reality (production `main`)

**Model:** marketplace. The host is the seller; Meeticulous lists, books, collects, and pays the host via **Razorpay Route**. `fee_only_mode` is **FALSE** in prod (verified live: `GET /api/config/public` → `{"feeOnlyMode":false}`), so real service prices and host payouts are active.

**Payment + payout flow (as built):**
1. Guest pays the full amount; a Razorpay **order is created in Meeticulous's own account** (`paymentController.js:191`, no split at order time).
2. **At capture**, a **held Route transfer** of the host's `vendor_amount` is created to the host's **Razorpay linked account**: `razorpay.payments.transfer(paymentId, { transfers:[{ account, on_hold:true, on_hold_until: serviceEnd+24h }]})` (`routeAutoPayoutService.js:99`, `HOLD_BUFFER_MS = 24h` `:30`).
3. **Release**: customer marks complete → instant, or Razorpay auto-releases at `on_hold_until` (`releaseHeldTransfer`, `transfers.edit …on_hold:false` `:153`).
4. **Reverse** (full only, empty body) on cancel / report-problem / dispute-webhook / admin action (`transfers.reverse` `:177`; callers `bookingController.js:731`, `:1074`, `paymentController.js:1306`, `disputeAdminController.js`).
5. **Gates:** dormant if `fee_only_mode`; **only fires if the host has an ACTIVATED Razorpay linked account** — otherwise the money "stays owed" (tracked on `bookings.vendor_amount`) and the host is nudged to finish KYC (`routeAutoPayoutService.js:11-17`). Linked accounts are created from KYC (`kycAdminController.js:190` → `routeAccountService.createLinkedAccount`).
6. **Also** a pull path: host requests a payout, admin releases via Route (`payoutAdminController.js:115` `POST /admin/payouts/:id/pay-route` → `routeTransferService.releasePayout` → `transfers.create`).

**Money math (`pricingEngine.js`, executed — identical on main):** guest pays `price + ₹10 fee + 18% GST on fee` = **₹1,011.80** for ₹1000. Host `vendor_amount = price − commission − realGatewayFee − TDS(1%) − TCS(1%)` = **₹959.76** paid plan / **₹909.76** free plan at capture. Commission 5% free / 0% paid, GST-inclusive, host-borne. TDS/TCS on **service-price base**, deducted at capture (baked into `vendor_amount`), remitted to government.

**Gates that exist:** PAN-on-file to accept paid bookings (`bookingController.js:356`, 409 if absent — no 5% no-PAN fallback, it's a hard block); KYC-approved to withdraw (`vendorController.js:118`); dual-admin on manual payout release; ₹100 payout-request floor / ₹1 auto-transfer floor.

**Documents generated:** guest **tax invoice for the booking fee only** under BAS GSTIN, SAC **998314** (`invoiceHtml.js`, `sellerIdentity.js`); **commission tax invoice** to host on free plan, SAC **998311**; aggregate **26Q / GSTR-8** admin CSVs. **NOT generated:** any "Payment Advice" doc, per-host **Form 16A**, credit notes, the host's own service invoice.

**Refunds:** **there is no guest-refund API anywhere** (`git grep payments.refund|refunds.create` on main → 0). Guest refunds are 100% **manual admin work in the Razorpay dashboard** (`AdminRefunds.jsx` is a dead stub). Cancellation has **no time tiers / percentages** — it flips status and (when Route is active) **reverses the host's held transfer in full**. "Reversal ≠ refund."

**Checkout disclosures (`ServiceBooking.jsx`, identical on main):** price broken down (service price + platform fee + GST on fee + total) on the pay step; host shown by name/photo. **NOT shown:** any "non-refundable" notice — the checkout says **"🔒 Free to cancel"** (`:1289`); the host is **never labeled "seller/supplier/sold by."**

**Data + processors (`main`):** collects guest name/email/phone/notes/billing + host PAN (encrypted), bank (encrypted), registered address, **Aadhaar (optional)**, KYC docs, `razorpay_account_id`, Google OAuth tokens (encrypted). Processors actually wired: Supabase, Razorpay (Route), Google (OAuth/Calendar), Nodemailer SMTP, AiSensy (WhatsApp), **PostHog (always-on, not consent-gated), GA4, Meta Pixel + Conversions API (server sends SHA-256 email+phone), Microsoft Clarity (session replay), GTM, Sentry, Anthropic/Claude, Voyage AI.** Studio hosts can **export guest name/phone/email to CSV** (`crmController.js:33`). **No self-service data-deletion / anonymization** is implemented despite the stated DPDP erasure right.

---

## 2. Mismatch report (product vs the *deployed* v4 legal pages)

Legend: **KEEP** = legal already matches product · **REWRITE** = reword to match product · **DECISION** = needs founder/legal call (can't be reworded unilaterally) · **PRODUCT-GAP** = the honest fix is a product change (out of scope here — flagged only).

| # | Topic | Product (main) | Deployed legal says | Action |
|---|---|---|---|---|
| 1 | Model / seller | Marketplace; host is seller; Route pays host | Same | **KEEP** |
| 2 | Payment aggregator | Razorpay Route (licensed PA) splits to host linked account | "Razorpay, an RBI-authorised payment aggregator, collects and remits" | **KEEP** (now accurate) |
| 3 | Guest price / GST | ₹1,011.80; GST on fee only | Same | **KEEP** |
| 4 | Guest invoice | Fee-only, BAS GSTIN | "invoice for our booking fee" | **KEEP** |
| 5 | Commission | 5% free / 0% paid, GST-incl, host-borne | Same | **KEEP** |
| 6 | TDS/TCS | 1% + 1% on service price, at capture | Same | **KEEP** |
| 7 | PAN gate | Hard 409 block, no 5% path | HostAgreement §8.3 "no-PAN → higher 206AA rate" | **REWRITE** (code blocks, never applies 5%) |
| 8 | **Refund tiers** | **No tier logic; no guest-refund API; manual admin only** | Refund §1 table 24h/6h 100/50/0%; §6 "cancel on Platform applies §1 automatically"; §3 automated full-refund triggers; §7 timelines | **DECISION** — the policy is entirely manual/discretionary; "automatically" is false |
| 9 | **Non-refundable fee** | Checkout shows **"Free to cancel"**; nothing marked non-refundable | Refund §2 / GuestTerms §5.2: "displayed as non-refundable before you pay" | **DECISION / PRODUCT-GAP** — direct contradiction + consumer-protection risk |
| 10 | Payout timing | Route held transfer, released at service-end+24h or on customer-complete | HostFees §7 / HostAgreement §7.1 "twice-monthly cycle, 7-day clearing" | **REWRITE** |
| 11 | Payout minimum | ₹100 (₹1 auto floor), no carry-forward | "₹500 minimum, carried forward" | **REWRITE** |
| 12 | Security holdback | **Not implemented** | HostAgreement §7.3 / HostFees "10% for 90 days/20 bookings" | **DECISION** (drop, or keep as an unexercised reserved right?) |
| 13 | Payout destination | Razorpay **linked account** (Route), requires activated account | HostAgreement §7.5 "electronic transfer to your verified bank account" | **REWRITE** + add linked-account requirement |
| 14 | Payment Advice | **Not generated** | HostFees §6 / HostAgreement §6.4 "we issue you a Payment Advice per booking" | **REWRITE** (remove/replace with dashboard statement) |
| 15 | Form 16A | **Not generated** (aggregate 26Q/GSTR-8 only) | HostAgreement §8.1 "issue you Form 16A" | **DECISION** (legal deductor duty vs non-issuance) |
| 16 | Dispute/chargeback hold + ₹500 charge | Dispute reverses host transfer; **no ₹500 charge, no settlement dispute-window** logic | HostFees §7 "dispute window closed"; HostAgreement §9.1 "₹500 chargeback charge" | **DECISION** (drop, or reserved right?) |
| 17 | Seller identity at checkout | Host shown, **not labeled "seller"** | GuestTerms §1.5 "seller identity … in accordance with CP E-Commerce Rules" | **PRODUCT-GAP** (Rule 5 wants it labeled) / soften wording |
| 18 | **Privacy — processors** | PostHog/GA4/Meta Pixel+CAPI/Clarity/GTM/Sentry/Anthropic/Voyage/AiSensy | Names only Razorpay/Supabase/Google/"email"/"messaging"; "basic analytics" | **REWRITE** (name them; disclose session replay + server-side hashed PII to Meta/Google) |
| 19 | **Privacy — host KYC data** | Collects PAN, bank, address, Aadhaar(opt), ID docs | Privacy §2 never mentions any of it | **REWRITE** (largest privacy gap) |
| 20 | **Privacy — deletion** | No self-service erasure; no anonymization job | §5/§7 imply erasure right honored | **DECISION / PRODUCT-GAP** (DPDP erasure) |
| 21 | Host guest-data export | Studio CSV export of guest name/phone/email | §4 "hosts receive booking data to fulfil the booking" | **REWRITE** (disclose export) |

---

## 3. Page-by-page change plan

- **`/terms`** — mostly KEEP (payment-aggregator + marketplace wording now accurate). Minor: §6 already fine.
- **`/guest-terms`** — §1.5 seller-identity claim vs checkout not labeling the seller (#17): soften to what's shown, or flag product gap. Otherwise KEEP.
- **`/refund`** — **largest guest-facing rework.** The tier table + "automatic" + timelines describe a system that doesn't exist (#8, #9). Needs a DECISION on whether the policy is (a) a manually-applied policy (reword to "we review and apply the following"), or (b) rewritten to the discretionary reality. The "non-refundable, shown before payment" claim contradicts the live "Free to cancel" checkout — product gap.
- **`/host-agreement`** — REWRITE payout mechanics (#10–14, #16): Route held-transfer released after completion, reversed on cancel/dispute, requires activated linked account, ₹100 floor; §8.3 PAN (#7); §8.1 Form 16A (#15, decision); §6.4 Payment Advice (#14).
- **`/host-fees`** — REWRITE payout section (cycle/₹500/holdback → Route reality), Payment Advice (#14), keep the accurate money math.
- **`/privacy`** — **substantial REWRITE** (#18–21): add host KYC dataset; name all analytics/AI processors; disclose session replay, server-side hashed PII to Meta/Google, and host CSV export; align the erasure section to what's actually offered (decision on building a deletion path).

---

## 4. Items requiring CA / legal confirmation (flag, don't guess)

1. **Refund policy vs reality (#8, #9)** — a published tier policy that the product applies only manually/discretionarily, plus a "non-refundable fee" the checkout contradicts with "Free to cancel." Consumer-protection exposure. Lawyer to decide the correct policy text and whether the checkout must change.
2. **Form 16A (#15)** — as TDS deductor BAS owes hosts a certificate; the product doesn't issue one. Build it, or the promise must go — CA/legal.
3. **Privacy / DPDP (#18–21)** — undisclosed processors incl. **session replay (Clarity)** and **server-side hashed email/phone to Meta & Google**; host **CSV export** of guest contacts; **no erasure mechanism** despite the stated right. Materiality + required disclosures — legal.
4. **SAC codes** — live values **998314** (booking fee) and **998311** (commission). Confirm both are correct (998311 previously suspected wrong) — CA.
5. **Reserved-but-unbuilt terms (#12, #16)** — 10% holdback, ₹500 chargeback charge, twice-monthly cycle: keep as drafted contractual rights (enforceable later) or delete as misdescription? Lawyer.
6. **Seller-identity display (#17)** — CP E-Commerce Rules Rule 5 marketplace duty; is name/photo enough, or must the host be labeled the seller at checkout?
7. **Payout dependency on a Razorpay linked account** — hosts without one have funds "owed" indefinitely until KYC completes; confirm this is disclosed adequately and the "nothing is lost" position holds.

---

## 5. Rewrite gate

Clear-cut REWRITE items (payout mechanics → Route reality, Privacy processors/KYC/export, Payment Advice removal, PAN wording) can be executed now against this `main`-based worktree. The **DECISION** items (#8, #9, #12, #15, #16, #20) change consumer/host rights or admit a product gap and should not be reworded without your call. Recommend: decide those, then one rewrite pass for the whole set.
