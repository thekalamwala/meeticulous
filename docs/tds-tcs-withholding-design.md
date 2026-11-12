# TDS / TCS Withholding on Host Payouts — Rules & Design

**Status:** Draft for CA confirmation. Built on researched market practice + current
statute; **no code goes live until the CA sign-off line is added to the implementing PR.**
**Date:** 2026-11-12
**Owner:** Shubham (founder) · drafted with Claude Code

> We cannot hold product dev for the CA. Strategy: build the withholding **machinery**
> now, make every **rate/threshold a configurable value** (not hardcoded), ship it behind
> an OFF flag so prod behaviour does not change on deploy, and flip it on once the CA
> confirms the numbers below. CA's answers then become a settings change, not a redeploy.

---

## 1. What Meeticulous is, for tax purposes

Meeticulous is an **e-commerce operator (ECO)**: it facilitates payment between a guest
(buyer) and a host (seller/participant) and routes the money. That triggers **two
separate withholdings on the host's sale**, both deducted at source before payout:

| Tax | Law | Who | On what |
|---|---|---|---|
| **TDS** | Income-tax §194-O (now §393(1) of the 2025 Act) | ECO deducts from host | host's gross sale |
| **TCS** | CGST §52 | ECO collects from host | net value of taxable supplies |

Both are **pass-through**: the host claims them back as credit. They are **not a cost to
Meeticulous** and never a "loss" — the only true platform cost in the flow is the Razorpay
gateway fee (~2.36%). The real risk is **non-compliance** (wrong rate, late/no remittance,
no filing) and **refund leakage** (eating the gateway fee).

## 2. Current rates (FY 2026-27) — researched, CA to confirm

| Item | Current value | Changed | Source note |
|---|---|---|---|
| **TDS §194-O** | **0.1%** of gross | cut from 1% w.e.f. **01-Oct-2024** | was 1% |
| TDS — no PAN/Aadhaar | **5%** | — | penal rate |
| TDS — resident Individual/HUF **≤ ₹5L/yr gross** (PAN on file) | **0%** (exempt) | — | threshold |
| TDS — company/firm/LLP | **0.1% from ₹1** | — | no threshold |
| **TCS §52** | **0.5%** (0.25% CGST + 0.25% SGST, or 0.5% IGST) | cut from 1% w.e.f. **10-Jul-2024** (Notif. 15/2024-CT) | no threshold, no entity carve-out |

**Combined withholding on a normal paid booking ≈ 0.1% + 0.5% = 0.6% of gross** — **not
the 2% we originally assumed** (that was the old 1% + 1%, both since reduced).

**Base for both:** the **gross service price, excluding separately-shown GST, with NO
deduction for marketplace commission or payment-gateway fees.** (The "deduct 2% after the
gateway fee" idea is **not** how §194-O/§52 work — base is gross; short deduction makes the
operator liable. Dropped.)

## 3. Rules table (what the engine must apply)

Per paid booking, for the **host**:

| Host entity | PAN on file | FY gross so far | TDS rate | TCS rate |
|---|---|---|---|---|
| Resident Individual / HUF | Yes | ≤ ₹5,00,000 | **0%** | 0.5% |
| Resident Individual / HUF | Yes | > ₹5,00,000 | **0.1%** | 0.5% |
| Company / Firm / LLP | Yes | any | **0.1%** | 0.5% |
| Any | **No** | any | **5%** | 0.5% |

- TDS base = TCS base = gross service price (ex separately-shown GST). No gateway/commission
  deduction.
- **Worked example — ₹1,000 booking, individual host with PAN, already over ₹5L:**
  Razorpay fee ₹23.60 (2.36%) → TDS ₹1.00 (0.1%) → TCS ₹5.00 (0.5%) → **host gets
  ₹970.40**, platform withholds **₹6.00** for the government (₹1 TDS + ₹5 TCS). (Under the
  old wrong 1%+1% it was ₹20 withheld — this is the correction.)

## 4. Design — rates as data, logic as code, shipped dark

### 4a. Config (the numbers — a CA answer = a settings edit)
New config block (new rows in `platform_settings`, or a small `tax_settings` table):
`tds_rate` (0.001), `tds_rate_no_pan` (0.05), `tds_threshold_individual` (500000),
`tcs_rate` (0.005), and an effective-date stamp. Read at compute time; **no redeploy to
change a rate.** Seeded with the §2 values.

### 4b. Code (the rules — these are logic, not numbers)
- `pricingEngine.js` `calculateTds` / `calculateTcs` take rate + context (entity type, PAN
  present, FY-gross-to-date) and select the right rate from config. Base stays gross
  `servicePrice` (already correct).
- **Host entity type** — new field (`profiles.host_entity_type`: `individual_huf` |
  `company_firm_llp`), captured at onboarding/KYC. Default `individual_huf` until set.
- **FY-gross-to-date per host** — sum of the host's gross `servicePrice` for paid bookings
  in the current Indian FY (Apr–Mar), to apply the ₹5L threshold. (Running tally column on
  the host, incremented at capture, is cheaper than summing every time.)
- **No-PAN → 5%** — reuse the existing `paid_booking_without_pan` concept; if KYC has no
  PAN, TDS = 5% (and payout is already PAN-gated, so this is belt-and-suspenders).

### 4c. Ship dark
Everything behind a master flag (e.g. `tds_tcs_v2`, default **OFF**). While OFF the engine
keeps **current behaviour** (so deploying this changes nothing in prod). Founder flips it ON
after the CA confirms §2/§3. Fail-closed, like the project's other flags.

### 4d. Remittance & filing (operational, not code — but the real compliance risk)
- TDS: deposit by the **7th of next month**; file **Form 26Q quarterly** (return/challan
  **code 1035**); issue **Form 16A**. Needs a **TAN**.
- TCS: deposit + file **GSTR-8 by the 10th of next month**; reflects in host's GST credit.
  Needs **GST registration as an ECO**.
- Set a monthly calendar; give the CA access. Late deposit/filing is where real money is
  lost (interest + penalty).

## 5. Already built (do not rebuild — confirmed in code)
- 2-leg withholding threaded through `computeBreakdown` → `calculateVendorPayout`
  (`server/lib/pricingEngine.js`), stored per booking as `bookings.tds_amount` /
  `tcs_amount`.
- Host payout = Razorpay Route held transfer, held to service-end +24h, released on
  completion; **reversed on refund** keeping the gateway fee (no platform loss).
- Payout **PAN-gated** via encrypted `kyc_submissions.pan_number`.
- Only the **rate (1% → 0.1% / 0.5%)**, the **entity/₹5L/no-PAN rule selection**, and the
  **config-drive + flag** are new. The money plumbing already exists.

## 6. Past over-deduction — decide with CA
Every paid booking since go-live withheld **1% TDS + 1% TCS (2%)**; correct is **0.1% +
0.5% (0.6%)**. Hosts have had **~1.4% of gross over-withheld**. Options for the CA:
(a) forward-only (new rate from flip date), (b) reconcile/refund the excess to hosts,
(c) adjust against future payouts. A one-time query will quantify the exposure before this
is decided. **Not auto-fixing — CA call.**

## 7. Open items for the CA (become the §Sign-off)
1. TDS §194-O = **0.1%** gross, FY 2026-27 — confirm.
2. TCS §52 = **0.5%** — confirm (Notif. 15/2024-CT).
3. ₹5L exemption + entity carve-out applied **per §3 table** — confirm.
4. Base = **gross, ex-GST, no gateway/commission deduction** — confirm.
5. **Past bookings** over-deducted at 2% — forward-only, or reconcile? (§6)

---

*Rates/thresholds are from secondary tax research + current notifications, not a filing
opinion. The CA's written confirmation is the authority and becomes the `Sign-off:` line on
the implementing PR before anything ships.*
