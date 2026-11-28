# IMPLEMENTATION SPEC — Pricing & Plan Gating v2

**For:** Claude Code, working in `thekalamwala/meeticulous`. Build from this without asking questions.
**Date:** 27 Nov 2026 · Repo at PR #464 · migrations run to `v3.228` → **new migration = `v3.229_pricing_v2.sql`**
**Rule that governs everything:** limits and rates live in `subscription_plans`, read via `planService`. Never hardcode a rate or limit in a controller. (CLAUDE.md, spec v1.1 `database_driven`.)

---

## 0. Context you need

Two public plans: `free` ("Starter"), `premium` ("Pro"). Plus archived-but-resolving: `premium_founding`, `creator`, `professional`, `supreme`. Free aliases: `free`, `starter`, `explorer`, `starter_legacy` (`planService.FREE_SLUGS`). **Slugs are frozen** — Razorpay stores `notes.plan` and writes it back to `profiles.plan` on renewal; renaming a slug downgrades a paying host.

`subscription_plans.limits` keys in use: `services`, `free_services`, `bookings_per_year`, `digital_products`, `calendar_integrations`, `profile_theme_colors`, `reminder_flows`, `followup_flows`, `categories`, `crm`, `ai_generations`, `insights`. `-1` = unlimited, `0`/absent = blocked (most restrictive).

### Three GST regimes — do not mix them up

| What | Regime | Where |
|---|---|---|
| **Subscription prices** | Stored **EX-GST**; engine adds 18% | `computeSubscriptionBreakdown()`, `cadenceAmountPaise()`. Back-solve and never round up (v3.165 convention: charge a paisa under the advertised price) |
| **Commission** | **Already GST-INCLUSIVE — leave it alone** | `server/lib/pricingEngine.js:116-134`. `calculateCommissionGst = commission − commission/(1+rate)`, `calculateCommissionTaxable = commission/(1+rate)`. So 9% on ₹500 = ₹45 gross, of which ₹6.86 is GST and ₹38.14 is taxable revenue |
| **Guest platform fee** | Currently **EX-GST** → **flipping to INCLUSIVE** | §2.1 |

The platform fee is the odd one out today. §2.1 makes it consistent with commission. **Do not "fix" the commission maths — it is already correct.**

---

## 1. Prices (India)

| Item | Host pays (GST in) | Store ex-GST |
|---|---|---|
| Starter | ₹0 | 0 |
| Pro monthly | **₹199** | **168.64** |
| Pro yearly | **₹1,199** | **1016.10** |
| Pro yearly, campaign (`premium_founding`) | **₹899** | **761.86** |

Derived display values: ₹1,199/365 = **₹3.28/day** ("₹3 a day"), ₹1,199/12 = **₹99.92/month**, 12×₹199 = ₹2,388 so yearly **saves ₹1,189 = 50%** ("pay for six months, get twelve"). Campaign = ₹2.46/day.

USD stays **display-only** (Razorpay International not enabled, no USD column): set `PREMIUM_PLAN_USD = { monthly: 19, yearly: 99 }` in `client/src/data/plans.js`. Current `{7, 59}` is wrong. No USD checkout.

---

## 2. Commission — the main build

`subscription_plans.commission_percentage` is a single scalar read by `bookingController.js:~500` and `services/membershipCharges.js:~79`. Replace with a per-surface rate map; **keep the scalar as fallback** so an unmigrated row can't break checkout.

Add `subscription_plans.commission_rates jsonb`:

```json
// free
{ "appointments": 9, "products": 12, "courses": 12, "memberships": 12,
  "appointment_band_inr": null, "appointment_rate_above_band": null }

// premium  AND  premium_founding
{ "appointments": 0, "products": 4, "courses": 4, "memberships": 4,
  "appointment_band_inr": 25000, "appointment_rate_above_band": 3 }
```

Add to `planService`:
- `getRate(slug, surface)` → `commission_rates[surface] ?? commission_percentage ?? 0`
- `appointmentRateFor(slug, hostMonthToDateAppointmentGmv)` → if `appointment_band_inr` is null, return `appointments`; if MTD GMV **before this booking** ≥ band, return `appointment_rate_above_band`; else return `appointments`.

**Deliberately do NOT split a single booking across the band.** Charge the whole booking at one rate based on MTD-before. The rupee difference is trivial and splitting adds a failure mode. Document this in the function comment.

MTD GMV = `sum(service_price)` of the host's non-cancelled bookings created since the 1st of the current month, IST. Read it **inside the existing booking-quota lock in `createBooking`** (same lock `lib/bookingCaps.js` runs in) so two concurrent bookings can't both read "below band".

**Snapshot the applied rate on the booking row** (`commission_rate_applied numeric`), exactly as `v3.206` snapshots the cancellation policy. Refunds and payouts read the snapshot, never the live plan.

Membership and course/product checkout read their own surface rate the same way.

---

## 2.1 Platform fee — becomes a BOOKING fee, and GST-INCLUSIVE

Two changes here. Read both.

### Verified current state

| Surface | Fee today | Where |
|---|---|---|
| Appointments | ₹10 + 18% added | `bookingController` via `calculatePlatformFee` + `calculateGst` |
| Digital products | ₹10 + 18% added | `productController.js:326` |
| Video courses | ₹10 + 18% added | `courseController.js:154, 254` |
| Memberships | **None** | `membershipCharges.js:96` passes `platformFee: 0` |

Not plan-dependent anywhere — it comes from `platform_settings.platformFee` globally, same for Starter and Pro. `calculatePlatformFee` (`pricingEngine.js:74-80`) returns 0 when `servicePrice === 0` unless `chargeFeeOnFree` is passed, and that only comes from fee-only mode (off in prod). So ₹0 services carry no fee today. **Keep that.**

### Change A — the fee applies to appointments only

> **The guest fee is a *booking* fee.** It applies to appointments, where we hold a slot, send reminders, handle reschedules and prevent no-shows. Nothing else.

- **Remove the platform fee entirely from `courseController.js` (lines ~154, ~254) and `productController.js` (line ~326).** Those surfaces are commission-only (12% / 4%), which already prices them 3 points above appointments.
- **Memberships stay at 0** — now the rule rather than an exception. Leave `membershipCharges.js:96` as it is.
- The ₹300 fee floor (§4 item 3) therefore applies to **appointments only**.

Rationale: a ₹10 fee on a ₹199 download is a 5% surcharge on a surface that costs us storage and one gateway call, and no comparable Indian platform adds a buyer fee to digital goods. It is also ~8% of that surface's revenue, so dropping it is cheap and buys one clean sentence: *"Your guest pays ₹10 to book. Nothing else, ever."*

### Change B — the fee is GST-inclusive

`platform_settings.platform_fee` is currently treated as ex-GST, so a stored `10` makes the guest pay ₹11.80. **New rule: the stored value IS the gross the guest pays.** GST is backed out, never added.

```
gross   = platform_settings.platform_fee        // what the guest pays, flat
taxable = round2(gross * 100 / 118)
gst     = gross - taxable                       // derive as the REMAINDER
```

**Derive `gst` as the remainder, never as `taxable * 0.18`.** The remainder guarantees `taxable + gst === gross` at two decimals for every input. Computing GST independently lets the booking total drift by a paisa and stop reconciling.

| Admin sets | Guest pays | Taxable | GST |
|---|---|---|---|
| ₹10 | **₹10.00** | ₹8.47 | ₹1.53 |
| ₹20 | ₹20.00 | ₹16.95 | ₹3.05 |
| ₹1 | ₹1.00 | ₹0.85 | ₹0.15 |
| ₹0 | ₹0.00 | 0 | 0 — emit no fee line at all |

To change:

1. **The booking fee block** in `bookingController` + `calculateGst` usage for the fee. Invert to the formula above. (`calculateCommissionGst` already works this way — mirror it.)
2. **Store all three components** on the booking snapshot — gross, taxable, GST. Every booking already snapshots price, fees and GST; keep that contract.
3. **Admin UI label** → `Platform fee (₹, inclusive of GST)` with helper text "the guest pays exactly this". Without this, whoever sets it expects to receive the full amount.
4. **Guest receipt and GST tax invoice must still show taxable and GST as separate lines**, even though the total is flat — GST law requires the tax component be visible. Render as `Platform fee ₹8.47 + GST ₹1.53 = ₹10.00`.
5. **Same inversion for the reschedule fee** (`reschedule_fee`, 0 or 10, `hostController:~499`). Both flat guest-paid fees must behave identically.
6. `platform_settings.fee_only_mode` unaffected.

### What NOT to change

- **Commission GST** — already inclusive and correct (§0). Do not touch.
- **Subscription prices** — stay stored ex-GST with 18% added (§1).
- **TDS/TCS** — untouched.

### Consequences

- We net **₹8.47 per appointment instead of ₹10** (−15.25%, ~₹1.53/booking, ~₹44/host/year at median volume). Accepted.
- **Starter-vs-Pro ARR crossover unaffected** — the fee is identical on both plans and cancels out of that comparison.
- The pricing page's "₹10, nothing under ₹300" becomes **literally true** instead of quietly meaning ₹11.80. Leave the page as written.

---

## 2.2 Decision record — why the host/guest split stays where it is

Keep **9% host-side + ₹10 guest-side.** Do not shift cost onto the guest to soften how the deduction feels to the host. Recorded because it will be asked again.

Both charges are GST-inclusive, so the trade is ₹1-for-₹1. On a ₹500 booking we collect ₹45 + ₹10 = ₹55 gross; `8% + ₹15` and `6% + ₹25` are also ₹55. Neutral **only at ₹500**, and it leaks both ways:

- **34% of real bookings are under ₹300**, where the floor means no guest fee at all — so cutting commission there is pure loss on a third of volume.
- **A fixed fee doesn't scale and commission does.** At ₹2,000: 9% + ₹10 = ₹190 vs 6% + ₹25 = ₹145. We lose ₹45 on every higher-ticket booking.

It also **breaks Pro**, whose entire pitch is 0% commission. At 9% Pro pays for itself at ₹13,322 annual GMV (~2 bookings/month); at 6% it needs ₹19,983 (~3.3/month). Host-side commission is what makes Pro sellable — the resentment it creates *is* the upgrade funnel, so channel it rather than remove it.

**Build these instead** (all free, all address the same feeling):

1. **Show the host the guest paid too.** On the booking view and payout statement: *"Guest paid ₹510 — your ₹500, plus a ₹10 platform fee paid by them."* The host currently has no idea we charge the guest at all.
2. **Lead with what they kept.** *"₹455 paid to you"*, *"you keep 91%"* — never "we charged 9%".
3. **Attribute cost to work done.** Monthly statement: *"₹1,350 — 30 bookings collected, 96 WhatsApp reminders sent, 4 reschedules handled, 30 GST invoices raised."*
4. **Put the escape hatch beside the number.** *"Paid ₹1,350 this month. Pro is ₹99 and takes nothing."*

On digital goods the host bears 100% (no guest fee), so items 2–4 matter **more** there. Memberships are the strongest case: a host with 50 members at ₹299 pays ₹1,794/month on Starter and ₹598 on Pro — **₹14,352 saved a year against a ₹1,199 price.** Surface that comparison on the membership dashboard.

Revisit only if exit interviews show hosts churning over commission *while having declined Pro*. Never raise the guest fee above ₹10–15 at these ticket sizes.

---

## 3. Config changes — `subscription_plans` only, no code

| Field | `free` | `premium` + `premium_founding` |
|---|---|---|
| `limits.crm` | `10` → **`50`** | `-1` |
| `limits.reminder_flows` | `1` → **`2`** | `-1` |
| `limits.followup_flows` | `0` → **`1`** | `-1` |
| `limits.categories` | `-1` → **`1`** *(founder ruling 2026-11-27; was 2)* | `-1` |
| `limits.insights` | absent (stays locked) | **add `-1`** |
| `limits.free_services` | `2` | `-1` |
| `limits.digital_products` | `3` → **`-1`** | `-1` |
| `monthly_price` / `annual_price` | 0 | **168.64 / 1016.10** (founding row: 168.64 / 761.86) |

Call `planService.clearCache()` after admin edits (60s in-process cache).

Effects, free of charge: `reminder_flows: 2` gives Starter the 1-hour reminder via `reminderWindowsForPlan` (`REMINDER_WINDOWS = [24, 1]`). `followup_flows: 1` gives Starter the day-3 rebook via `followups/flowRegistry.entitledSteps` (steps are day 3, day 21). `limits.insights: -1` unlocks the six Intelligence blocks via `services/intel/gate.js`.

---

## 4. Code changes

| # | Change | File |
|---|---|---|
| 1 | **Open video courses on Starter.** Delete the `callerIsFreePlan` 403 in `createCourse`. Courses bill at the `courses` surface rate | `server/controllers/courseController.js:~44,~68` |
| 2 | **Guest phone on Starter, in-window.** `isPaid()` currently gates the whole window. Change: host sees guest phone when `windowOpen(booking, now)` on **any** plan. Keep the full number in the CRM list/export **paid-only** | `server/lib/contactVisibility.js` |
| 3 | **Appointment fee floor.** No platform fee when `service_price < 300`. Appointments only — courses and products no longer carry a fee at all (§2.1 Change A) | fee logic in `server/controllers/bookingController.js` |
| 4 | **Remove platform fee from digital goods.** Strip `calculatePlatformFee`/`calculateGst` from the course and product purchase paths; `platform_fee`/`platform_fee_gst` persist as 0 | `server/controllers/courseController.js:~154,~254`, `server/controllers/productController.js:~326` |
| 5 | **AI window monthly.** `WINDOW_DAYS.free: 182 → 30` (and `starter`, `starter_legacy`) | `server/controllers/aiController.js:15` |
| 6 | **Testimonials uncapped on Starter.** Remove the `FREE_CAP = 3` block | `server/controllers/testimonialController.js:20,~70` |
| 7 | **Self-serve reschedule = Pro only.** Gate the guest-facing reschedule route with `!isFreeSlug(resolveVendorPlan(host))`. Host-initiated reschedule from the dashboard stays on both plans. **Guest reschedule email always sends, both plans** | reschedule paths `server/controllers/bookingController.js:~1633,~1767` |
| 8 | **Taste = WhatsApp reminders only.** `rescheduleNotifyForPlan` no longer ORs with `proTaste.tasteActive`. Host WhatsApp reschedule alert becomes strictly paid. `TASTE_DAYS = 60` unchanged for reminders | `server/controllers/bookingController.js:~1947-1953`, `server/services/proTaste.js` |
| 9 | **Palettes.** `FREE_PALETTE` = `#960D32`, `#E0506F`, `#7A0A28`, `#475569`. **`PRO_PALETTE` must become a superset** — add `#E0506F` and `#7A0A28` (16 → 18) | `server/controllers/hostController.js:~473-493` + `client/src/utils/themeUtils.js` `FREE_COLORS` / `STUDIO_COLORS` |
| 10 | **Explore priority (Pro).** Add a plan weight to explore scoring as a **tiebreaker only**, applied after the existing quality signals (verified, has bio, has reviews). Never an override | explore score automation (`v3.73`) + explore ranking query |
| 11 | **Earnings calculator.** Rates 5% → 9%; add a third input "monthly product/course/membership sales (₹)"; apply the ₹25,000 band to Pro; add a third bar at 12% labelled "a platform charging 10% + transaction fee"; show ₹1,199 / ₹99 GST-inclusive, never the ex-GST base; delete the dead `result.bookingCap` branch (~line 228) | `client/src/pages/EarningsCalculator.jsx` (432 lines, 5% hardcoded in ~4 places) |
| 12 | **`PLAN_MATRIX` rewrite** to match §6. Update `PREMIUM_PLAN`/`FREE_PLAN` prices, `PREMIUM_PER_DAY`, `PREMIUM_YEARLY_PER_MONTH`, `PREMIUM_ANNUAL_SAVING`, `PREMIUM_ANNUAL_SAVE_PCT`, `PREMIUM_PLAN_USD`, `FOUNDING` | `client/src/data/plans.js` + `client/src/data/__tests__/plans.pricing.test.js` |
| 13 | **Social links.** Starter keeps `instagram, facebook, linkedin, email`. Everything else `pro: true` — including `website` and `whatsapp` (already so) | `client/src/pages/ProfileSetup.jsx:65-82`, consumed by `client/src/pages/grow/YourPage.jsx` |
| 14 | **Admin fee label** → `Platform fee (₹, inclusive of GST)` per §2.1 | admin platform-settings UI |

### Two bugs, same release

- `client/src/components/community/CommunityAd.jsx:19` — `PAID = new Set(['premium','professional','supreme'])` omits `premium_founding`, so **founding Pro hosts see "upgrade to Pro" ads**.
- `server/controllers/hostController.js:~478` — theme gate reads raw `profiles.plan`, not `planService.resolveVendorPlan(profile)`, so **expired Pro keeps the full palette**. Also select `plan_expires_at`.

---

## 5. Razorpay

You have **test keys** — exercise the full subscription flow end to end.

- **Razorpay Plan objects are immutable.** Editing `annual_price`/`monthly_price` in admin clears `razorpay_plan_id_annual`/`_monthly` (`planAdminController.js`, the immutability block). Next checkout mints a new Razorpay plan at the new price. Expected, not a bug.
- **Existing subscriptions stay bound to their old plan object**, so hosts on `premium_founding` keep renewing at ₹899 after `premium` is repriced. This is how the campaign price is honoured — do not "fix" it.
- `paymentController.createVendorSubscription` already routes Pro checkouts to `premium_founding` while founding spots are open. **Verify this routing with the new prices** before any real signup.
- `planService.isSelfServable(plan)` = `plan.active !== false`. Keep `premium_founding`, `creator`, `professional`, `supreme` with `active: false` so they can't be bought by guessing a slug.
- `services/foundingSpots.js`: `FOUNDING_PRICE_ANNUAL 999 → 899`, `POST_FOUNDING_PRICE_ANNUAL 1499 → 1199`. The founding offer is becoming a standing campaign SKU rather than a one-time first-100 — keep the counter, treat `FOUNDING_LIMIT` as a campaign cap.
- Cost context (never surfaced to hosts): Razorpay domestic 2% + 18% GST = 2.36%; Subscriptions add-on 0.9%. **We absorb the gateway on both plans** — this is why commission is "all-inclusive" and why nothing extra may be deducted from a host.

---

## 6. The plan matrix (`PLAN_MATRIX` source of truth)

Honesty rule from the file's own header: **never list what the server doesn't enforce.**

| Row | Starter | Pro |
|---|---|---|
| Monthly price | ₹0 | ₹199 |
| Yearly price | ₹0 | ₹1,199 |
| Appointments commission | 9% | 0% (3% above ₹25,000/month) |
| Products, courses, memberships | 12% | 4% |
| Guest booking fee | ₹10 flat on appointments, GST included · none under ₹300 · none on products, courses or memberships | same |
| Booking page + custom URL · online & in-person · UPI/cards | ✓ | ✓ |
| Paid services · bookings · digital products | Unlimited | Unlimited |
| Free (₹0) services | 2 | Unlimited |
| Service categories | 1 *(founder ruling 2026-11-27; was 2)* | Unlimited |
| Video courses · memberships · coupons | ✓ | ✓ |
| GST invoices · payouts · earnings history · commission tracker · TDS/TCS | ✓ | ✓ |
| Confirmations (email + WhatsApp) · 24h reminder · 1h reminder · cancellation notices | ✓ | ✓ |
| WhatsApp reminders | First 60 days from first booking | Always |
| Booking can be rescheduled | ✓ (host moves it) | ✓ |
| Guest reschedules themselves | — | ✓ |
| Guest reschedule email | Always | Always |
| Host WhatsApp alert on guest reschedule | — | ✓ |
| Client list | 50 most recent (show true total) | Everyone, forever |
| Notes + full history · CSV export · day-21 rebook | — | ✓ |
| Day-3 rebook | ✓ | ✓ |
| Guest phone | From 15 min before session | + in the client book |
| Testimonials · guest reviews | Unlimited | Unlimited |
| Page colours | 4 | 18 |
| Social links | 4 (Instagram, Facebook, LinkedIn, email) | All 15 |
| Listed in Explore | Standard ranking | Priority placement |
| Booking caps per day/week/guest | — | ✓ |
| AI service writing | 10/month | Unlimited |
| Creator Intelligence (forecast, win-back, benchmarks, audience, cohorts, moves) | — | ✓ |
| Community forum + Tithi | ✓ | ✓ |
| Email support | ✓ | Priority queue |

**Do NOT add rows for:** iCal / second calendar integration (`limits.calendar_integrations` is read by no server code and there is no iCal implementation), support response times, or custom cancellation presets (Pro-gated in `serviceController.hostIsPro` but behind `pro_cancellation_policy`, which is **OFF**). Non-code perks — 1:1 support, 90-minute setup session, social feature, quarterly directory listing — are policy; put them in marketing copy, not `PLAN_MATRIX`.

---

## 7. Acceptance tests

1. Free host, ₹500 appointment → commission ₹45, host nets ₹455, **guest pays exactly ₹510.00** (not ₹511.80). Pro host, same → commission ₹0, host nets ₹500.
2. That ₹510 breakdown shows platform fee **taxable ₹8.47 + GST ₹1.53 = ₹10.00**, reconciling exactly.
3. `platform_fee` set to `1` → guest pays exactly ₹1.00 (₹0.85 + ₹0.15). Set to `0` → no fee line emitted anywhere.
4. Free host, ₹250 appointment → **no platform fee**. ₹0 service → no fee, either plan.
5. **₹999 course → guest pays exactly ₹999. ₹499 product → guest pays exactly ₹499. No fee line on either.** Host nets ₹879 / ₹439 on Starter (12%), ₹959 / ₹479 on Pro (4%).
6. Membership renewal at ₹299 → guest charged exactly ₹299, `platform_fee_amount` 0.
7. Reschedule fee of ₹10 → guest pays exactly ₹10.00, split the same way.
8. Host GST invoice and guest receipt both show the appointment fee's taxable value and GST as separate lines.
9. Pro host with ₹24,000 MTD appointment GMV takes a ₹2,000 booking → 0%. Next booking that month → 3%.
10. Free host: 51st client is not returned by `crmService.listClients` (list **and** CSV export), but the total count is in the payload.
11. Free host gets 24h **and** 1h reminders. WhatsApp reminders stop 60 days after their first confirmed booking; email continues.
12. Free host: guest reschedule link → 403/hidden. Host-initiated reschedule → works. Guest receives the new-time email in both cases.
13. Free host: 2nd category → 403 `upgrade_required` *(cap is 1 — founder ruling 2026-11-27; it caps the profile's categories, primary included, via `PUT /api/host/categories`)*.
14. Free host saves `#E0506F` → allowed. Saves `#2563EB` → 403. Upgrades to Pro → `#E0506F` still allowed (**superset check**).
15. Pro host: `GET /api/intelligence/...` returns forecast/win-back/benchmarks/audience/cohorts/moves, not `{locked:true}`. Free host still gets the teaser with the numbers **absent from the payload**.
16. Pro host on `premium_founding` sees **no** upgrade ad in the community sidebar.
17. Host whose `plan_expires_at` has passed: resolves to Starter, keeps all services/bookings/clients/products, loses the 18-colour palette.
18. Razorpay test keys: ₹1,199 yearly and ₹199 monthly checkouts both complete; `profiles.plan` and `subscription_status` set correctly; a repriced plan mints a new Razorpay plan object on next checkout.
19. Existing `creator` / `professional` / `supreme` hosts keep Pro-equivalent entitlements and are not purchasable via self-serve.

---

## 8. Order of work

1. `v3.229_pricing_v2.sql` — `commission_rates` column + all §3 values + `bookings.commission_rate_applied` + platform-fee component columns. Additive, idempotent, non-destructive.
2. `planService`: `getRate`, `appointmentRateFor`, fallback to the scalar. Update `FALLBACK_PLANS` to match the new values.
3. **§2.1 fee work** — remove the fee from courses and products, then invert the appointment fee and the reschedule fee to GST-inclusive, plus snapshot columns, invoice/receipt lines and the admin label. Do this **before** the commission work: every total depends on it, so you verify totals once instead of twice.
4. `bookingController` + `membershipCharges` + course/product checkout read the rate map; snapshot on the row.
5. §4 items 1–2, 5–9, 13–14 (small, independent).
6. `plans.js` + `PLAN_MATRIX` + pricing tests.
7. Earnings calculator (§4 item 11).
8. Explore priority (§4 item 10) — last, the only genuinely new algorithm.
9. The four host-perception changes in §2.2 — cheap, and they protect retention.

Do **not** touch: `tds_tcs_v2` withholding logic, payout logic, the cancellation-policy snapshot, or the commission GST maths. If a change seems to require any of them, stop and report instead.
