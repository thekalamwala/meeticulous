# Letter to CA — Confirm TDS/TCS withholding on host payouts

*Draft — review, put on letterhead / email, send. Replace [bracketed] bits.*

---

To: [CA name]
From: Shubham Datarkar, Meeticulous ([entity name])
Date: [date]
Re: Confirming TDS (§194-O) and TCS (§52 CGST) rules for our marketplace payouts

Dear [CA name],

Meeticulous is an e-commerce operator — guests book and pay for services from hosts
(professionals) on our platform, and we route the money to the host after deducting tax at
source. Before we finalise the automated deduction logic, please confirm the following for
**FY 2026-27** so we apply exactly the right rule. We have set our system up so that each of
these is a configurable value we can change the moment you confirm — we just need your sign-off
on the numbers.

**Our understanding (please confirm or correct each):**

1. **TDS, Section 194-O** — **0.1%** of the host's **gross** sale value, reduced from 1%
   effective 01-Oct-2024. Correct?

2. **TCS, Section 52 CGST** — **0.5%** (0.25% CGST + 0.25% SGST intra-state, or 0.5% IGST
   inter-state), reduced from 1% effective 10-Jul-2024 (Notification 15/2024-CT). Correct?

3. **Thresholds / entity rules for TDS:**
   - Resident **individual/HUF host with PAN** and gross sales **≤ ₹5,00,000 in the FY** →
     **no TDS**. Above ₹5L → 0.1%.
   - **Company / firm / LLP host** → **0.1% from the first rupee**, no threshold.
   - **Any host without PAN/Aadhaar** → **5%**.
   - Does TCS have any threshold or entity carve-out, or is it a flat 0.5% on every host from
     the first rupee?

4. **Base for both** — we compute TDS and TCS on the **gross service price (what the guest
   pays the host for the service, excluding any separately-shown GST)**, **without** first
   deducting our platform commission or the payment-gateway fee. Correct? (We want to be sure
   we are not under-deducting.)

5. **Past bookings** — until now our system deducted **1% TDS + 1% TCS (2% total)** on the
   old rates. With the reductions above the correct figure is **0.1% + 0.5% (0.6%)**, so we
   have **over-deducted ~1.4% of gross** from hosts since launch. How should we treat this —
   adjust going forward only, refund the excess to hosts, or set it off against future
   payouts? We can give you a transaction-level report of the exact amounts.

Also, please confirm our **deposit and filing cadence**: TDS deposited by the 7th of the
following month and filed in Form 26Q quarterly (we have TAN [TAN no.]); TCS deposited and
filed in GSTR-8 by the 10th, under our ECO GST registration [GSTIN]. Issue Form 16A to hosts
for TDS.

Once you confirm points 1–5, we will switch the system to these rates. Please reply with a
short line we can record as your authorisation, e.g.:
*"Confirmed [date] — TDS 0.1% / TCS 0.5% on gross ex-GST, ₹5L individual threshold, 5% no-PAN,
[past bookings: forward-only / reconcile]. — [CA name], [membership no.]"*

Thank you,
Shubham Datarkar
Meeticulous
