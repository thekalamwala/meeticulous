# Monthly Subscription Plans — Design Spec

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation planning
**Author:** Product + Architecture (Book A Sloth)

## 1. Goal

Offer **monthly billing** for the existing paid plans (Creator, Professional) with
identical features and benefits — only the payment cadence differs. Move the platform
from one-time annual orders to **auto-renewing subscriptions** for both cadences, using
the Razorpay Subscriptions API.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Billing mechanism | Razorpay **Subscriptions** (auto-recurring), unified for monthly + annual |
| 2 | Annual renewal | Annual **also auto-renews** (migrates onto subscription rails) |
| 3 | Tier/cadence switch | **Immediate switch with proration** |
| 4 | Excess credit on downgrade | **Forfeit** — credit caps at new period price, no balance, no refund |
| 5 | Existing annual vendors | **Prompt to set up mandate now**, credit their remaining paid days |
| 6 | Build approach | **Phased** — one spec, 3 sequenced milestones (A/B/C) |

## 3. Core Model

**Cadence is a property of the vendor's subscription, not the plan.**
One tier = one `subscription_plans` row carrying both prices. Features stay identical by
construction (single source row) — no duplicate "Creator Monthly" rows, no drift. The
admin `max_active_plans = 3` rule is unaffected (still 3 tiers).

### 3.1 `subscription_plans` schema changes

```
monthly_price             NUMERIC(10,2) NOT NULL DEFAULT 0   -- NEW, admin-set, DB-driven
razorpay_plan_id_monthly  TEXT                                -- NEW, Razorpay Plan object id
razorpay_plan_id_annual   TEXT                                -- NEW, Razorpay Plan object id
billing_cycle             -- LEGACY: retained for back-compat, no longer drives logic
annual_price              -- unchanged
```

- Razorpay requires a **Plan object per (tier × cadence)** — up to 6 total. Created
  lazily by the server the first time an admin sets a non-zero price for that cadence.
  The returned Razorpay plan id is stored on the row.
- Razorpay Plan amount = `price × (1 + gstRate)` (GST baked in, because a recurring
  charge must be a fixed amount). `computeSubscriptionBreakdown({ planPrice, gstRate })`
  still derives the planPrice / gstAmount / totalCharged split for invoices + ledger.
- **Pricing strategy (recommendation, not enforced):** set annual ≈ 10× monthly so annual
  remains the better deal. Exact numbers are admin-entered data, out of scope for code.
- The free tier (Starter, ₹0) has no billing and is unaffected.

### 3.2 Vendor subscription state — `profiles` schema changes

Today's single `plan_expires_at` gate is insufficient for auto-renew. Add:

```
razorpay_subscription_id  TEXT          -- the live mandate / subscription
billing_cadence           TEXT          -- 'monthly' | 'annual'
subscription_status       TEXT          -- 'active' | 'pending' | 'halted' | 'cancelled'
current_period_end        TIMESTAMPTZ   -- end of the current paid period
```

- `plan_expires_at` remains the **access gate** consumed by `resolveVendorPlan` /
  `planMiddleware`; it is kept in sync with `current_period_end` on every renewal.
- `subscription_payments` (existing) records each charge — initial and every renewal.
  It already has `billing_period_start` / `billing_period_end`.

## 4. Payment Flows

### 4.1 New subscribe (Razorpay Subscriptions)

1. Pricing page: vendor picks **tier + cadence** (monthly/annual toggle).
2. `POST /api/payment/subscribe { plan, cadence }`:
   - Ensure a Razorpay Plan exists for `(tier, cadence)` (lazy-create + persist id).
   - Create a Razorpay **Subscription** against that plan.
   - Return `subscription_id` (+ checkout config).
3. Razorpay Checkout opens in **subscription mode** → vendor authorizes the UPI-AutoPay /
   card e-mandate.
4. **Activation is webhook-driven.** Frontend success alone NEVER activates the plan —
   this closes the trust gap previously noted in the onboarding audit (payment trusted
   from frontend redirect). The `subscription.activated` webhook is the source of truth.

### 4.2 Recurring webhooks (extend existing `handleWebhook` in `paymentController.js`)

| Event | Action |
|-------|--------|
| `subscription.activated` | status=active; set `current_period_end` + `plan_expires_at`; insert `subscription_payments` row; post `SUBSCRIPTION_PAYMENT` ledger entry |
| `subscription.charged` | renewal: extend `current_period_end` + `plan_expires_at`; insert `subscription_payments` row; post ledger entry |
| `subscription.halted` | repeated charge failure → status=halted; trigger grace window + dunning email |
| `subscription.cancelled` | retain access until `current_period_end`, then revert vendor to `starter` |

All handlers are **idempotent** (keyed on `razorpay_payment_id` / subscription event id),
consistent with the existing `subscription_payments` idempotency guard (v2.8.2).

### 4.3 Switch + proration (immediate, forfeit excess)

When `POST /api/payment/subscribe` is called by an already-subscribed vendor (tier change,
cadence change, or both):

1. `credit = (remaining_days ÷ cycle_days) × amount_paid_this_period`.
2. `credit = min(credit, newPeriodPrice)` — excess is **forfeited** (no balance, no refund).
3. Cancel the old Razorpay subscription **immediately**.
4. Create the new Razorpay subscription with `start_at` = next cycle boundary.
5. Charge a **one-time adjustment order now** = `max(0, newPeriodPrice − credit)`.
6. On adjustment payment success → activate new tier/cadence; post a **proration ledger
   entry** recording the credit applied (forfeited excess creates no liability).

> **Razorpay constraint (architecture note):** Razorpay has no native "update subscription
> plan with proration" call. Proration is orchestrated by the server via the
> cancel → create-new → one-time-adjustment sequence above. This is the largest single
> piece of the project.

### 4.4 Cancel

`POST /api/payment/cancel-subscription` → Razorpay cancel-at-cycle-end → vendor keeps
access until `current_period_end` → `subscription.cancelled` webhook reverts to `starter`
at expiry.

### 4.5 Legacy annual vendors (existing paid subscribers)

Existing paid vendors have **no mandate on file** and cannot be silently auto-migrated.
On their next login (and via a banner near plan expiry), prompt them to set up auto-renew.
On acceptance, **credit their remaining paid days** against the first subscription charge
using the same proration math as §4.3.

> **Ordering dependency:** because legacy migration reuses §4.3 proration, this work lands
> in or after Phase C (proration must exist first).

## 5. Client Surfaces (3)

1. **`UpgradePlan.jsx` — rebuild as DB-driven.** Remove the hardcoded `PLAN_FEATURES`
   object and the stale copy ("/ month", "All plans are billed monthly") which currently
   contradicts the annual backend. Render plans from `/api/plans`. Add a **monthly/annual
   toggle** and an annual-savings badge.
2. **`PlansStep.jsx`** (onboarding) — add the same monthly/annual toggle.
3. **New "Manage Subscription" view** — current tier + cadence, next charge date, and a
   cancel control. Public `GET /api/plans` returns `monthly_price` after the migration.

## 6. Admin

`AdminPlans.jsx` + `planAdminController.js` — add a `monthly_price` field to create/update.
On save with a non-zero price, lazy-create the matching Razorpay Plan and persist its id.
The `min/max active plans` rules are unchanged.

## 7. Ledger

Reuse the existing `SUBSCRIPTION_PAYMENT` journal entry for every charge (initial +
renewals). Add a proration adjustment posting for §4.3 (records credit applied; forfeited
excess posts nothing). Subscription gateway fee/tax remains **platform-borne** (PRD §5.3),
matching the current `verifySubscription` logic.

## 8. Migration

`server/migrations/v3.8_monthly_subscriptions.sql`:
- Add the `subscription_plans` columns (§3.1) and `profiles` columns (§3.2).
- Backfill existing paid vendors: `billing_cadence='annual'`, `subscription_status='active'`,
  `current_period_end = plan_expires_at`. They remain one-time until prompted to migrate (§4.5).
- Follows the repo's schema-fallback pattern: `planService` / controllers tolerate the
  columns being absent until the migration is applied in Supabase.

## 9. Phasing

| Phase | Scope | Shippable outcome |
|-------|-------|-------------------|
| **A** | Migration (§8), `subscription_plans` columns, admin `monthly_price` entry, lazy Razorpay Plan creation, `/api/plans` exposes monthly | Admin can configure monthly prices; nothing customer-facing yet |
| **B** | Subscribe flow (§4.1), webhooks (§4.2), client toggle on `UpgradePlan` + `PlansStep`, Manage Subscription view, profile state (§3.2) | **Monthly auto-renew works end-to-end** for new subscribers |
| **C** | Proration + switch (§4.3), cancel (§4.4), legacy annual migration (§4.5), proration ledger entry | Full switching, cancellation, and annual-onto-rails migration |

## 10. Out of Scope

- Multi-currency / non-INR billing.
- Coupons / promotional discounts (separate future work).
- Account credit-balance system (excess credit is forfeited per Decision #4).
- Reseller / team / seat-based billing.

## 11. Open Risks

- **Razorpay e-mandate friction (RBI):** UPI-AutoPay / card mandates require explicit
  authorization at signup and a 24h pre-debit notification for auto-charges; Razorpay
  Subscriptions handles the notification, but mandate setup adds a checkout step.
- **Webhook reliability:** activation depends on webhooks; needs the existing idempotency
  guards plus a reconciliation path for missed events (mirror the ledger reconciler pattern).
- **Proration edge cases:** same-day switches, switches during a halted subscription, and
  switches before the first charge has settled — must be enumerated in the Phase C plan.
