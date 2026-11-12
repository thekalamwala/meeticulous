# TDS / TCS Withholding on Host Payouts — Rules & Design

**Status:** CA FINAL authorisation received 2026-11-12 (@Aastha) — cleared for go-live (§7).
§9(5) confirmed not applicable. Key rule folded into code: **TCS is collected only from
GST-registered hosts** (§8). **Flag stays OFF until the authorisation line (with entity / CA
name / M. No. filled) is added to the PR to clear the tax-signoff gate.**
**Date:** 2026-11-12
**Owner:** Shubham (founder) · drafted with Claude Code

> **Key fact (verified on the live DB 2026-11-12):** there are **0 paid bookings** — we are
> pre-launch. So there is **no historical over-deduction to reconcile** (this voids the old §6
> "~1.4%" concern). We simply set the correct rates before the first paid booking.

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

**CA note on changeover dates (matters only for historical bookings — we have none):** the two
cuts take effect on *different* dates — **TCS 10-Jul-2024, TDS 01-Oct-2024**. 1% was correct
before each date. Immaterial here (0 paid bookings), but the config carries effective dates.

**Base — NOT one shared number (CA correction).** Neither tax deducts the commission or the
gateway fee (confirmed), but **TDS and TCS sit on different bases:**
- **TDS (194-O):** per-booking **gross service price, excluding separately-shown GST.** Confirmed.
- **TCS (§52):** the **monthly net value of taxable supplies** — the month's aggregate taxable
  value, **net of supplies returned/cancelled in that month**, ex-GST. For a clean completed
  booking this equals the TDS base; it **diverges when there are cancellations/returns** in the
  period. So TCS must be computed as a monthly net-of-returns figure, not assumed equal to the
  per-booking TDS amount. (The "deduct 2% after the gateway fee" idea is dropped — base is gross,
  and short deduction makes the operator liable.)

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

**CA refinements to the TDS rules (fold into the FY-tally follow-up):**
- **₹5L is cumulative, with catch-up.** The moment a host's FY gross crosses ₹5L, TDS
  applies to their **entire year's gross**, not just the slice above ₹5L — including a
  catch-up deduction on the bookings that sat below the threshold earlier in the year. The
  per-booking "≤ threshold → 0%" shortcut is only an approximation; the real tally must
  back-deduct on crossing. (Current code deducts 0.1% whenever FY gross is unknown, so it
  never under-deducts — safe until the tally lands.)
- **PAN must be valid AND operative.** An inoperative PAN (not Aadhaar-linked) is treated as
  no PAN → **5%**. And the ₹5L exemption needs a **PAN** specifically (Aadhaar alone does
  not unlock it). `hasPan` must become a PAN-valid-and-operative check, not PAN-present.

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

## 6. Past over-deduction — N/A (0 paid bookings)
**Resolved.** The live DB has **0 paid bookings** (verified 2026-11-12), so nothing has ever
been withheld and there is **no history to reconcile**. We set 0.1% / 0.5% before the first
paid booking and every deduction is correct from the start. The old "~1.4% of gross" worry
was moot.

**For the record, the CA's rule if excess ever arises (e.g. a future rate change):** do **not**
refund or set off deposited excess against the host — once deposited, excess TDS sits to the
host's credit in Form 26AS/AIS and excess TCS in their GST cash ledger (via GSTR-8), and the
host reclaims it through their own returns. Refunding on top would pay the host twice and break
reconciliation. Only **still-held, undeposited** excess is refundable; otherwise **correct the
rate going forward only**, and never under-report 16A/GSTR-8 to "fix" it. Any future
reconciliation is **transaction-date-wise against each effective date** (TDS 01-Oct-2024,
TCS 10-Jul-2024), not a blanket percentage.

## 7. CA FINAL authorisation (2026-11-12) — cleared for go-live

> *Confirmed 12-Nov-2026 for FY 2026-27, Meeticulous ([legal entity]). TDS u/s 194-O: 0.1% of
> gross service value (ex separately-shown GST); individual/HUF host with valid operative PAN —
> nil up to ₹5L gross in the FY, 0.1% once ₹5L is crossed (on full gross); company/firm/LLP —
> 0.1% from first rupee; no/inoperative PAN — 5%. Applies to all hosts, registered or not.
> TCS u/s 52: 0.5% of net value of taxable supplies (ex-GST, net of returns) — **collected only
> from GST-registered hosts; not collected from unregistered hosts below the ₹20L/₹10L threshold
> (Notification 65/2017)**. No §9(5) applicability — host services are professional/consultancy,
> outside the notified categories. Past bookings: none (pre-launch); correct rates set before
> first payout, nothing to reconcile. TCS registration to be held state-wise where registered
> hosts are located. — [CA name], M. No. [___]*

This is the fileable sign-off. Two data points remain open but **neither blocks go-live**:
(a) the precise host-service wording (§8 point 2); (b) the host-by-state map with registration
flags (§8 point 3). Fill `[legal entity]`, `[CA name]`, `M. No.` to use as the PR sign-off line.

## 8. The rule that mattered most — TCS follows host GST registration

**TCS is collected ONLY from GST-registered hosts.** An unregistered service host below the
**₹20L (₹10L special-category states)** turnover limit is not required to register (Notif.
65/2017-CT) and has **no GSTIN** — so there is nothing to report in GSTR-8 and the host cannot
reclaim it. Deducting TCS from such a host is simply wrongly withheld money. So:
- **Host with a valid GSTIN** → collect TCS 0.5% on net value; report in GSTR-8 against the GSTIN.
- **Host unregistered / below threshold** → **no TCS — do not deduct.**
- When a host later crosses ₹20L and obtains a GSTIN, TCS switches on from that point.
- **TDS (194-O) is unaffected** — income tax, applies to registered and unregistered hosts alike
  (individual ≤₹5L still nil). The GSTIN gate must NOT touch the TDS logic.

**BUILT (this PR):** `resolveWithholding` now gates TCS on `hasGstin` — no GSTIN → TCS 0;
`bookingController` derives it from `host.billing_details.gstin`. Covered by tests.

**§9(5) — confirmed NOT applicable.** Professional/consultancy sessions are none of the notified
categories (transport, accommodation, restaurant, housekeeping). Normal TCS regime, subject to
the registration gate above. *Caveat to watch:* if the catalogue ever adds a notified category
(short-stay accommodation, restaurant/cloud-kitchen, ride/transport), that slice flips to §9(5)
(operator pays GST, collects no TCS) — flag to the CA then.

**State-wise TCS registration.** Required only in each State/UT where a **GST-registered** host
supplies (only those supplies generate TCS); where there is no place of business, the head-office
address may be declared for that state's TCS registration. Given most hosts are small/unregistered,
few states will generate an obligation — do **not** blanket-register 30 states (creates nil-return
filing burden). If there are no registered hosts today, the existing registration is enough to
start; add state registrations as registered hosts come on board. Needs: host-by-state map with
registration flags + current GSTIN(s)/states.

## 9. Follow-up build (separate PRs, before volume)
Done in this PR: config-driven rates, entity/₹5L/no-PAN selection, **TCS GSTIN gate**, OFF flag.
Still to build:
1. **Per-host FY-gross tally** with the §3 **cumulative + catch-up** on crossing ₹5L (until then
   the engine deducts 0.1% whenever FY gross is unknown — safe over-deduction, not exemption).
2. **PAN valid-and-operative** check (not PAN-present); inoperative PAN → 5%; and **GSTIN format
   validation** (today the gate is GSTIN-present).
3. **TCS monthly net-of-returns** base (diverges from the per-booking TDS base on cancellations).
4. **Capture host GSTIN + entity type at onboarding** so the gate and entity rules have real data.

---

*The CA's final written confirmation (§7) is the authority and is cleared for go-live; it becomes
the PR sign-off line once `[legal entity]` / `[CA name]` / `M. No.` are filled. The TCS GSTIN
gate (§8) is now built; §9 items are refinements for before volume builds.*
