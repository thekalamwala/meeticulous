# The Ledger — read this in five minutes

Book A Sloth ("BAS") keeps a **double-entry ledger**. Every rupee that moves is
recorded as a balanced journal entry (Σ debits = Σ credits), and the DB rejects
any entry that doesn't balance. This page tells you **whose money each account
holds** so any entry reads plainly. It is the human companion to the legend at
the top of [`server/services/ledger/journalTemplates.js`](../server/services/ledger/journalTemplates.js);
the money math lives in [`server/lib/pricingEngine.js`](../server/lib/pricingEngine.js)
(the single source of truth — never forked) and the model in
[`docs/payment-model.md`](./payment-model.md).

## The four owners

| Owner | What it means |
|---|---|
| **BAS revenue / asset / cost** | Book A Sloth's own money — what we keep, hold, or spend. |
| **Host pass-through** | The host's money. We only hold it and owe it on to the host. **Never BAS revenue.** |
| **Government payable** | GST / TDS (194-O) / TCS (§52). Collected on the government's behalf, remitted to it. **Never revenue.** |
| **Razorpay cost** | Gateway MDR. **Host-borne** on bookings, **BAS-borne** on subscriptions. |

The golden rule: **the host's service price is never booked as BAS revenue.** It
flows into Vendor Payables (2000) and out again at settlement. BAS revenue is
only the booking fee + commission + subscription, each net of GST.

## The chart of accounts

| Code | Account | Normal balance | Owner | Meaning |
|---|---|---|---|---|
| 1000 | Bank | Debit | BAS asset | Cash actually in the bank |
| 1100 | Razorpay Receivable | Debit | BAS asset | Collected by Razorpay, not yet settled to bank |
| 2000 | Vendor Payables | Credit | **Host pass-through** | Host's net payout we still owe the host |
| 2100 | GST Payable | Credit | **Government** | GST collected, owed to the government |
| 2200 | Refund Liability | Credit | BAS liability | Refund owed but not yet paid |
| 2300 | TDS Payable | Credit | **Government** | 194-O income-tax withheld from the host |
| 2400 | TCS Payable | Credit | **Government** | §52 GST-TCS collected from the host |
| 4000 | Platform Fee Revenue | Credit | **BAS revenue** | Booking fee (ex-GST) |
| 4100 | Commission Revenue | Credit | **BAS revenue** | Commission (ex-GST) |
| 4200 | Subscription Revenue | Credit | **BAS revenue** | Host plan fee (ex-GST) |
| 5000 | Razorpay Charges (Orders) | Debit | Razorpay cost | Booking MDR — **host-borne** (nets to 0) |
| 5100 | Razorpay Charges (Subs) | Debit | Razorpay cost | Subscription MDR — **BAS-borne** (real expense) |
| 5200 | Settlement Charges | Debit | Razorpay cost | Payout/settlement fees — BAS-borne |
| 5300 | Refund Losses | Debit | BAS cost | Refund money BAS eats (non-recoverable MDR) |
| 5400 | Referral Expense | Debit | BAS cost | Host referral reward — marketing spend |

## Worked example A — a booking (₹1,000 service)

Guest always pays **₹1,011.80** = price 1000 + fee 10 + GST-on-fee 1.80.
Gateway MDR ≈ ₹20.24. Paid-plan host (0% commission), payout **₹959.76**.

`ORDER_PAYMENT` journal entry:

| Account | Owner | Debit | Credit |
|---|---|--:|--:|
| 1100 Razorpay Receivable | BAS asset | 1,011.80 | |
| 2000 Vendor Payables | Host | | 959.76 |
| 4000 Platform Fee Revenue | BAS revenue | | 10.00 |
| 2100 GST Payable | Government | | 1.80 |
| 2300 TDS Payable | Government | | 10.00 |
| 2400 TCS Payable | Government | | 10.00 |
| 5000 Razorpay Charges (Orders) | Razorpay (host-borne) | 20.24 | 20.24 |
| 1100 Razorpay Receivable (MDR relief) | BAS asset | | 20.24 |
| **Total** | | **1,032.04** | **1,032.04** |

Read it as: guest paid ₹1,011.80; the host gets ₹959.76, BAS keeps ₹10, the
government gets ₹21.80, Razorpay took ₹20.24 (borne by the host — account 5000
nets to zero). Starter (5%) adds `4100 Commission Revenue 42.37` + its GST
`2100 7.63` and the payout drops to ₹909.76 — the guest total is unchanged.

## Worked example B — a Studio subscription (₹3,650/yr)

Here BAS is the seller; GST is **added on top** and BAS bears the MDR.

| Account | Owner | Debit | Credit |
|---|---|--:|--:|
| 1100 Razorpay Receivable | BAS asset | 4,307.00 | |
| 4200 Subscription Revenue | BAS revenue | | 3,650.00 |
| 2100 GST Payable | Government | | 657.00 |
| 5100 Razorpay Charges (Subs) | Razorpay (BAS-borne) | 90.00 | |
| 1100 Razorpay Receivable (MDR relief) | BAS asset | | 90.00 |
| **Total** | | **4,397.00** | **4,397.00** |

Unlike a booking, account 5100 keeps a real debit balance — BAS eats the MDR, so
net ≈ ₹3,560/yr.

## Refunds (`REFUND`)

Refunds are issued manually in the Razorpay dashboard; the `refund.processed`
webhook records them. The refund is reclaimed from BAS's credits in a
**host-price-first waterfall**: Vendor Payables → TDS → TCS → Commission (+GST) →
Platform Fee (+GST) → any remainder to **Refund Losses (5300)**. So a guest
cancellation (price refunded, fee + MDR retained per payment-model §5.4) reverses
the host-price legs and books the ~₹20 MDR to Refund Losses; a host no-show (full
refund, §5.5) reverses every leg. The webhook also reverses the held Route
transfer so a refunded booking never also pays the host.

## Where to see it

Admin → **Finance → Journal**: expand any entry to see each line tagged with
**who gets it** (Host / Book A Sloth / Government / Razorpay), footing to the
amount paid. Corrections are append-only (adjustment / reversal), never edits.
