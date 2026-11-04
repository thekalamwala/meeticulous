# Gifted Pro — plan (not built)

**Goal:** the Meeticulous team (super admin only) gifts a Starter host a complimentary Pro plan for
1 month, 2 months, 6 months, 1 year, 2 years or 5 years. The host pays nothing. When the gift
ends, the host drops back to Starter on their own, with their data untouched. Gifts also double as a
marketing moment, like a surprise "we reset your limits" from a product you use.

**Status:** plan only. Founder decisions recorded 2026-11-04 (below). Nothing is built.

---

## 1. Founder decisions (2026-11-04)

| Question | Decision |
|---|---|
| Storage | **Reuse `premium`** + a new `plan_gifts` table. No new plan slug. |
| Gifted host subscribes mid-gift | **Charge now, gift ends** (remaining gift days are forfeited). |
| Paying hosts | **Never gift a paying customer.** Hard block on the server, not only in the UI. |
| Admin actions | Grant (single + bulk), **extend**, **revoke**. |
| Who may act | **Super admin only** (`requireSuperAdmin`). No new permission and no perms migration. |
| Host view | **Distinct "Pro (Gifted)" badge** in the dashboard and billing. The public profile still says "Pro". |
| Notices | Gift received · ending soon T-7 and T-1 · gift ended. Email + in-app + **WhatsApp**. |
| Marketing | Bulk/cohort gifting · personal note · convert offer at gift end · shareable "I got Pro" moment · **share-to-extend** · **pay-it-forward** (all six approved, §8). |
| Revoke | **Tells the host** with the same notice as a natural end: "Your gifted Pro has expired. To keep the benefits, go Pro." |
| Senders | **Gift email from Shubham** (the founder gifted it). **Every other gift notice from Tithi.** |
| Pay-it-forward grant | Approved as the one **system** grant path. The original super-admin gift counts as its approval. |

---

## 2. What already exists (and why this is mostly small)

- **`planAdminController.assignPlan`** (`POST /api/admin/plans/assign`, `plans.manage`) already sets
  `profiles.plan` + `plan_expires_at` and writes an `admin_audit_logs` row (`plan.assign`). It is
  generic (any slug, any date, no notices). Gifts get their own service rather than overloading it.
- **`planService.resolveVendorPlan`** already treats an expired `plan_expires_at` as `free`. That
  read path is used by `planMiddleware`, `authController` (the session's `plan`), CRM, referrals and
  nudges. **So a gift that ends drops to Starter on its own the moment `plan_expires_at` passes.**
  The cron only tidies the row and sends notices. It is not what grants or removes access.
- **"Comped" today** = `COMPED_SLUGS = {'supreme'}`: the internal god tier, kept out of the paid CRM
  pipeline and exempt from the minimum service price. A gift is **not** comped in that sense. It is
  plain `premium` with a time limit and no money behind it. `isCompedSlug` stays unchanged.
- **Money-evidence guards already keep gifts out of paid metrics:**
  - CRM `computeAccountFacts.isPaid` needs `razorpay_subscription_id` or a real charge → a gifted host is not a "customer".
  - `foundingSpots.countPayingPro` needs `subscription_status='active'` + a mandate → gifts never use up a founding spot.
  - Referral rewards qualify on **paid charges** (`min_qualifying_charges`) → a gift never releases a referral reward.
- **Profile palette (PR #134, not yet on main):** the palette is keyed on `premium`/`premium_founding`.
  Because a gift *is* `premium`, it gets the 16-colour palette with **no new slug and no
  `themeUtils.js` change**. A new slug would have needed `PLAN_ALIASES`, `CANONICAL_PLANS`, the
  `hostController.updateProfile` check, `contactVisibility.FREE_SLUGS`, the AI window table and more.
  ⚠ One thing to fix in #134 or here: `hostController.updateProfile` reads **raw** `profiles.plan`
  rather than `resolveVendorPlan`. An expired gift (or an expired paid plan) keeps palette rights
  until something rewrites `plan`. The gift cron does rewrite it (§5), but the check should use the
  resolved plan anyway.
- **Live DB (2026-11-04):** 3 hosts, all `free`. `profiles` has `plan`, `plan_expires_at`,
  `plan_activated_at`, `plan_updated_at`, `current_period_end`, `subscription_status`,
  `razorpay_subscription_id`. Events present: `SUBSCRIPTION_EXPIRING/PURCHASED/RENEWED/HALTED`.

---

## 3. Data model — `v3.190_plan_gifts.sql`

Additive. RLS on, no policies (service-role only), like `bot_escalations` / `platform_reviews`.
Apply on the Meeticulous DB (`spquowzrefozmrzoszkf`). The code keeps a schema fallback until it is
confirmed applied.

```sql
CREATE TABLE IF NOT EXISTS plan_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  months        int  NOT NULL CHECK (months IN (1, 2, 6, 12, 24, 60)),   -- original tenure
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz NOT NULL,                                     -- mirrors profiles.plan_expires_at
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'ended', 'revoked', 'converted')),
  extended_months int NOT NULL DEFAULT 0,                                 -- sum of extensions
  campaign      text,            -- bulk label, e.g. 'nov-first-booking'; null for one-offs
  reason        text NOT NULL,   -- internal; never shown to the host
  note          text CHECK (char_length(note) <= 280),                    -- personal note shown to the host
  granted_by    uuid,            -- admin id (admin_users); null = system (pay-it-forward, §8)
  closed_at     timestamptz,     -- ended / revoked / converted time
  closed_by     uuid,
  close_reason  text,
  ending_notified_days int[] NOT NULL DEFAULT '{}',                       -- {7,1} dedupe for ending-soon
  -- Share-to-extend (§8.5): one public post per gift, verified by a super admin.
  share_url     text,
  share_status  text CHECK (share_status IN ('pending', 'approved', 'rejected')),
  share_reviewed_at timestamptz,
  -- Pay-it-forward (§8.6): one forward link per gift; redeemed once.
  forward_code  text UNIQUE,                                              -- random 10 chars, minted on grant
  forward_redeemed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  forward_redeemed_at timestamptz,
  forwarded_from uuid REFERENCES plan_gifts(id) ON DELETE SET NULL,       -- set on the friend's gift row
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- One live gift per host. Extend updates this row; it never inserts a second one.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_gifts_active ON plan_gifts (host_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_plan_gifts_active_ends ON plan_gifts (ends_at) WHERE status = 'active';
ALTER TABLE plan_gifts ENABLE ROW LEVEL SECURITY;

-- Notice events (email + in-app on; WhatsApp OFF until the AiSensy templates are approved).
INSERT INTO notification_events (event_key, ...) VALUES
  ('PLAN_GIFT_RECEIVED', ...), ('PLAN_GIFT_ENDING', ...), ('PLAN_GIFT_ENDED', ...)
ON CONFLICT (event_key) DO NOTHING;
```

(Copy the exact `notification_events` column list from `v3.130_notification_in_app_channel.sql`. Seed
the 3 `email_templates` rows, audience `vendor`, in the `scripts/seedEmailTemplates.js` shape.
**Do not run the seed script itself**, because it overwrites every template.)

**Senders**, set by `email_templates.sender_key` and resolved by `senderRegistry.senderFor`:

| Template | `sender_key` | From (live `email_senders`, verified 2026-11-04) |
|---|---|---|
| `PLAN_GIFT_RECEIVED` | `shubham` | "Shubham \| Founder, Meeticulous" <shubham@team.meeticulous.com>, Resend, replies → shubham@meeticulous.com |
| `PLAN_GIFT_ENDING` | `tithi` | "Tithi \| Meeticulous" <tithi@team.meeticulous.com>, Resend |
| `PLAN_GIFT_ENDED` (also sent on revoke) | `tithi` | same |

⚠ Use the plain `shubham` / `tithi` keys, **never `crm_shubham` / `crm_tithi`**. The `crm_*` rows
are the cold-outreach senders, only used while `crm_admin_sends` is ON (currently **OFF**), and on the
`.in` cold root. Gift mail is transactional and must always send. WhatsApp sends as `senderKey: 'tithi'`
(same as `markHalted`). The in-app notices carry no sender.

**No `profiles` column.** "Is gifted" = an active `plan_gifts` row. `profiles.plan_expires_at = ends_at`
keeps every existing read path correct with no change.

**Extend vs history:** an extension moves `ends_at` and bumps `extended_months` on the same row. Each
grant, extend and revoke also writes `admin_audit_logs` (immutable, already exists), so the full
history lives there. `ponytail:` no separate gift-events table; add one if marketing wants
per-extension analytics.

---

## 4. Server

### 4.1 `server/services/planGiftService.js` (new, the only place gift logic lives)

```
TENURES = [1, 2, 6, 12, 24, 60]          // months
addMonths(date, n)                        // calendar months, clamp day (31 Jan + 1 → 28/29 Feb)

eligibility(profile, activeGift) -> { ok, reason }
  - role must be 'host'
  - BLOCK if a mandate exists: razorpay_subscription_id IS NOT NULL
      AND subscription_status IN ('active','authenticated','pending','halted')
  - BLOCK if resolveVendorPlan(profile) is non-free AND there is no active gift
      (covers paid-but-cancelled-in-period, supreme, creator/professional legacy,
       and manual assignPlan comps)
  - grant: BLOCK if an active gift exists (use extend)
  - extend: REQUIRE an active gift

grantGift({ hostIds[], months, reason, note, campaign }, adminReq)
  per host: read profile + active gift → eligibility → insert plan_gifts →
            update profiles { plan:'premium', plan_expires_at: ends_at, plan_activated_at, plan_updated_at }
            → audit('plan.gift.grant') → notify PLAN_GIFT_RECEIVED → CRM timeline 'gift_granted'
  returns { granted:[...], skipped:[{host_id, reason}] }       // bulk never fails the whole batch
  cap: 200 hosts per call

extendGift(giftId, months, adminReq)
  ends_at = addMonths(ends_at, months); extended_months += months; reset ending_notified_days = '{}'
  profiles.plan_expires_at = ends_at; audit('plan.gift.extend'); notify PLAN_GIFT_RECEIVED (extended copy)
  resolveInApp(PLAN_GIFT_ENDING)

revokeGift(giftId, closeReason, adminReq)
  status='revoked', closed_*; downgradeIfStillGifted(host)  → host is on Starter now
  audit('plan.gift.revoke'); notify PLAN_GIFT_ENDED (Tithi: "gift has expired, go Pro to keep the benefits")
  close_reason stays internal and is never shown to the host

submitShare(hostId, url)              // host route, §8.5
  active gift, share_status null, https URL on linkedin.com / instagram.com / x.com / twitter.com / facebook.com
  → share_url, share_status='pending'
reviewShare(giftId, approve, adminReq) // super admin
  approve → share_status='approved' → extendGift(giftId, 1) ; reject → 'rejected' (host may not resubmit)

redeemForward(code, newHostId)         // §8.6, called on the friend's onboarding completion
  gift with forward_code=code, forward_redeemed_by IS NULL, giver ≠ friend
  → eligibility(friend) → grantGift({ hostIds:[friend], months:1, campaign:'pay-it-forward',
       reason:'pay-it-forward from <giver gift id>', forwarded_from }, system)
  → forward_redeemed_by/at set (single conditional UPDATE … WHERE forward_redeemed_by IS NULL → race-safe)

endOnPaid(hostId)          // called from BOTH paid-activation paths (§4.3)
  active gift → status='converted', closed_at=now; returns the gift so the caller ignores its ends_at

processGiftExpiry()        // cron (§5)

downgradeIfStillGifted(hostId, gift)
  UPDATE profiles SET plan='free', plan_expires_at=NULL, plan_updated_at=now
  WHERE id=host AND plan='premium' AND razorpay_subscription_id IS NULL
        AND plan_expires_at = gift.ends_at                 -- guarded: never touches a host who started paying
```

Every write goes through the guarded update, so a race with a checkout cannot downgrade a payer.
Schema fallback: if `plan_gifts` is missing, the admin routes return 503 "Gifts not set up yet" and
the cron is a no-op.

### 4.2 Routes (`server/routes/adminRoutes.js`, all `requireSuperAdmin`)

| Method | Path | Body |
|---|---|---|
| GET  | `/api/admin/gifts?status=active` | list + host name/email, paged |
| POST | `/api/admin/gifts` | `{ host_ids[], months, reason, note?, campaign? }` |
| POST | `/api/admin/gifts/:id/extend` | `{ months }` |
| POST | `/api/admin/gifts/:id/revoke` | `{ reason }` |
| POST | `/api/admin/gifts/eligibility` | `{ host_ids[] }` → dry run for the bulk preview |

| POST | `/api/admin/gifts/:id/share-review` | `{ approve }` |

Host route (host auth): `POST /api/host/gift/share` `{ url }`.

`months` is validated against `TENURES` on the server (never trust the client).

**`assignPlan` guard (existing endpoint, a one-line change):** refuse with 409 "Host has an active gift
— revoke it first" when an active gift exists. Otherwise `assignPlan` would silently overwrite
`plan_expires_at` and leave an orphaned "active" gift behind.

### 4.3 Paid checkout while gifted → "charge now, gift ends"

Today a gifted host (`plan='premium'`, no mandate, `subscription_status` null) is **not** treated as
a switch (`isSwitch` needs `subscription_status='active'`), so `createVendorSubscription` already
charges right away. Two places must then **drop the gift**:

1. `subscriptionService.activateFromSubscription`: its "never shrink access" guard keeps the
   later of `plan_expires_at` and the paid period end. **A 5-year gift would survive the purchase.**
   Fix: call `planGiftService.endOnPaid(vendorId)` first. If it returns a gift whose `ends_at` equals
   the stored `plan_expires_at`, skip the never-shrink extension, so the paid period end wins.
2. `paymentController.verifySubscription` (one-time order path) writes `plan_expires_at` directly.
   Call `endOnPaid` there too (idempotent).

Abandoned checkout: `createVendorSubscription` only writes `razorpay_subscription_id` +
`status='pending'`. It does not change the plan. `subscriptionReconciler.releaseOrphan` nulls them
back, so **the gift stays intact**. The gift converts only on a real activation.

Webhooks (`markHalted` / `markCancelled`) are keyed on `razorpay_subscription_id`. Gifts have none,
so they are never touched.

### 4.4 Existing notices that must skip gifted hosts

- `subscriptionExpiry.processSubscriptionExpiry` (T-7/T-1 "renew" email): skip `host_id`s that have
  an active gift. They get the gift copy instead, and "renew" would be wrong because they never paid.
- `upgradeNudge`, `proTasteNudges`, `hostNudgeController`: these already resolve the plan, so a
  gifted host reads as Pro and gets no "go Pro" nudges. **No change. Covered by a test.**

### 4.5 Session payload

`authController` / `serializeProfile` adds `gift: { ends_at, months, note } | null` (one indexed read
on `plan_gifts`, fail-soft to `null`). `plan` stays `premium`, so every client gate works unchanged.

---

## 5. Expiry cron

Add to the `server.js` cron table next to `subscription-expiry`:
`{ name: 'plan-gift-expiry', min: 60, run: () => require('./services/planGiftService').processGiftExpiry() }`

```
processGiftExpiry():
  A) ending soon: active gifts with ends_at within 8 days
       daysLeft = ceil((ends_at - now)/day); if daysLeft ∈ {7,1} and not in ending_notified_days
       → notify PLAN_GIFT_ENDING (convert-offer copy, §8) → append daysLeft
  B) ended: active gifts with ends_at <= now (limit 200)
       → status='ended', closed_at=now → downgradeIfStillGifted → notify PLAN_GIFT_ENDED
       → resolveInApp(PLAN_GIFT_ENDING) → CRM timeline 'gift_ended'
  never throws; logs counts
```

Access does not depend on this cron. `resolveVendorPlan` drops the host at `ends_at` even if the
cron is late or down. The cron only tidies `profiles.plan` and sends the notices.

The cron runs only on Render. **Do not boot the server locally against the live DB** (its crons
are customer-facing). Test the cron with unit tests and mocks.

---

## 6. Admin UI (`client/src/pages/admin/AdminPlans.jsx`, super only)

New **"Gift Pro"** card, rendered only when the admin is super:

- **Hosts:** the existing host search, extended to multi-select chips. Optional "paste emails"
  textarea for cohorts.
- **Tenure:** segmented pills `1 mo · 2 mo · 6 mo · 1 yr · 2 yr · 5 yr`, with a live "Ends on 4 Dec 2026" preview.
- **Reason** (required, internal) · **Personal note** (optional, ≤280, "shown to the host") ·
  **Campaign** (optional label).
- **Preview step:** call `/gifts/eligibility` → "12 will receive, 3 skipped (paying: 2, already gifted: 1)" → Confirm.
- **Gifts table** (tabs Active / Ended / Revoked / Converted): host, tenure, ends, campaign, granted by.
  Row actions: **Extend** (same tenure pills) and **Revoke** (reason required, confirm dialog).

Use design-system components (`.mt-card`, `.mt-btn`, pill radius). Run the `BRAND_RULES.md`
checklist before calling it done.

---

## 7. Host-facing

| Surface | Gifted host sees |
|---|---|
| Public profile / badges | **Pro** (unchanged: `getPlanBorderLabel` → 'Pro'). |
| Dashboard plan chip | **Pro (Gifted)**, from `user.gift`. Display only; the slug stays `premium`. |
| Billing (`UpgradePlan.jsx`) | Card: "Complimentary Pro from the Meeticulous team · until 4 Dec 2026 · 23 days left", plus the personal note. CTA **"Keep Pro — subscribe"** with a confirm step: "Your gift ends today and you'll be charged ₹234.82 now." **No cancel button** (`hasActiveSub` is already false with no mandate). |
| Profile colours | 16-colour Pro palette (PR #134), with no change. |
| After the gift ends | Plain Starter. Every service, booking and client is kept (`resolveVendorPlan` contract). |

Notices (NotificationEngine: email + in-app + WhatsApp; WhatsApp flips on only once the AiSensy
templates are approved):

| Event | From | When | Copy angle |
|---|---|---|---|
| `PLAN_GIFT_RECEIVED` | **Shubham** | grant / extend | Founder voice: "I'm gifting you Pro 🎁": tenure, end date, personal note, **share card**, share-to-extend + pay-it-forward link (§8) |
| `PLAN_GIFT_ENDING` | Tithi | T-7, T-1 | "Your gifted Pro ends on X": what you keep vs lose, **Keep Pro** CTA |
| `PLAN_GIFT_ENDED` | Tithi | end day **and on revoke** | "Your gifted Pro has expired. To keep using the benefits, go Pro." Starter keeps all your data. **Go Pro** CTA |

---

## 8. Marketing hooks

v1 (founder approved):
1. **Bulk / cohort gifting:** §6. Label every batch with a `campaign` so it is measurable (conversion per campaign = converted / ended).
2. **Personal note:** §3 `note` → shown in the gift email and the in-app card.
3. **Convert offer at gift end:** the T-7/T-1/ended copy leads with "Keep Pro". ⚠ There is **no
   subscription coupon support** today (coupons are not wired into `createVendorSubscription`).
   A discounted convert price needs Razorpay offers or a separate plan row → **v2**. v1 = a strong
   CTA at the normal price.
4. **Shareable "I got Pro" moment:** the in-app gift card + email include share buttons
   (WhatsApp, LinkedIn, X, copy link) with prefilled text, e.g. *"Meeticulous just gifted me Pro 🎁
   Book me here →"* plus **the host's own booking link** with `utm_source=gift_share`. The host shares
   because it promotes *their* page. Meeticulous gets the brand mention for free.

Share hooks (approved 2026-11-04, aimed at people posting on other platforms):

5. **Share-to-extend (+1 month):** the gift card says *"Post about it, get another month free."* The
   host posts on LinkedIn / Instagram / X tagging Meeticulous and pastes the post URL into the
   dashboard (`submitShare`). It lands in the admin Gifts tab as "Share pending", and the super admin
   opens the post and approves it → `extendGift(+1)`. Once per gift. A human verifies each post, so it
   can't be gamed. Pay-it-forward gifts qualify too (so the friend posts as well).
6. **Pay-it-forward gift link:** each gift mints **one** `forward_code`. The host gets
   `meeticulous.com/for-hosts?gift=CODE` to give a fellow creator 1 month of Pro. The code is stashed at
   signup the same way referral codes are today (reuse `referralService` attribution, no cash
   reward). On the friend's **onboarding completion**, `redeemForward` runs a system grant
   (`granted_by=null`, `campaign='pay-it-forward'`) through the same eligibility checks. Hosts share it
   in their own communities (WhatsApp groups, IG stories), so each gift can recruit a new host.
   Guardrails: one redemption per code, new Starter hosts only, can't redeem your own code. The friend's
   gift mints **no** forward code of its own, so the chain is one level deep and can't spiral
   (`ponytail:` lift this when the founder wants a viral chain). A dead or used code silently signs the
   friend up on plain Starter.

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Host has an active mandate / is paying (incl. cancelled but still in period, halted, pending) | Grant **blocked** on the server, listed as skipped in bulk. |
| Supreme / legacy creator / professional / manual `assignPlan` comp | Blocked (resolved plan non-free and no gift). |
| Second gift while one is active | Grant blocked → use **Extend** (adds months to the current `ends_at`). |
| Gifted host subscribes | Charged now; gift → `converted`; paid period end replaces the gift end (§4.3). |
| Abandoned checkout while gifted | Gift untouched (no activation). |
| Revoke | Immediate drop to Starter via the guarded update; audit-logged; host gets the Tithi "gift has expired, go Pro" notice. |
| Share submitted after the gift ended / revoked | 409. Only an active gift can be extended. |
| Forward code redeemed by an existing paying host | Eligibility blocks it; the code stays unused. |
| Forward code used after the giver's gift ended | Still valid (the code was earned when it was minted). |
| `assignPlan` on a gifted host | 409 until the gift is revoked. |
| Cron down / late | Access still ends on time (`resolveVendorPlan`). Notices catch up on the next tick; T-7/T-1 can be skipped if the cron is down for those days (acceptable). |
| Gift ends on 31 Jan + 1 month | Clamped to the last day of Feb. |
| Host deleted | `ON DELETE CASCADE`. |
| Founding spots | Gifts never take a spot. A gifted host who converts while spots are open lands on `premium_founding` like any other buyer. |
| Referral of a gifted host | No reward (rewards need paid charges). |
| CRM | Timeline events only. Never promoted to paid/customer (`isPaid` needs money evidence). |
| Theme colour picked during the gift | Same as a lapsed paid host today (existing behaviour, out of scope). |
| Session JWT carries `plan` | Until the next refresh the client may show Pro. The server resolves fresh on every gated call, so gating stays correct. |

---

## 10. Tests (Jest, server; Vitest, client)

Server (`server/tests/unit/planGift*.test.js`):
- eligibility: free ok; each paying state blocked; supreme/creator/assignPlan comp blocked; active gift → grant blocked / extend ok.
- `addMonths` for every tenure + month-end clamp.
- grant writes gift + profile + audit + notice; bulk returns granted/skipped and never throws on one bad host.
- extend moves `ends_at`, resets the ending dedupe, resolves the in-app notice.
- revoke + `downgradeIfStillGifted` guard: no-op when the host now has a mandate or a different `plan_expires_at`.
- `activateFromSubscription` with an active 5-year gift → paid period end wins, gift `converted` (regression test for the never-shrink guard).
- `verifySubscription` calls `endOnPaid`.
- `processGiftExpiry`: T-7/T-1 sent once each; ended → status + downgrade + notice; missing table → no-op.
- `subscriptionExpiry` skips gifted hosts.
- `assignPlan` 409 on an active gift.
- routes reject non-super admins; `months` outside `TENURES` → 400.
- revoke sends `PLAN_GIFT_ENDED`; received uses template `sender_key='shubham'`, the others `'tithi'` (never `crm_*`).
- `submitShare`: URL allow-list, once per gift, active gift only; `reviewShare` approve → +1 month.
- `redeemForward`: single redemption under a race (two concurrent calls → one grant), self-redeem blocked, ineligible friend → no grant + code unused, the friend's gift has no `forward_code`.
- `resolveVendorPlan` on an expired gift → `free`; CRM `isPaid` false; `countPayingPro` excludes it.

Client:
- `UpgradePlan` gifted state: badge, days left, note, no cancel button, confirm copy on subscribe.
- AdminPlans gift card renders for super only; tenure preview date.

Before the PR: `cd server && npm test`, `cd client && npm run build`.

---

## 11. Build order

1. **PR A (core):** migration v3.190 + `planGiftService` + routes + `assignPlan` guard +
   checkout conversion hooks + `subscriptionExpiry` skip + cron + session `gift` + the 3 events/
   email templates (WhatsApp off) + tests.
2. **PR B (UI):** admin Gift Pro card + gifts table + billing gifted state + dashboard chip + share card.
3. **PR C (growth):** share-to-extend (host share box + admin review queue) and pay-it-forward
   (signup stash + redeem on onboarding completion). The columns already ship in v3.190 with PR A.
4. **Later:** WhatsApp templates once AiSensy approves them (submit the 3 templates during PR A), and a
   convert discount once subscription coupons exist.

Each PR branches from `origin/main` → base `release/YYYY-MM` → stop at the PR.

## 12. Open questions

None blocking. Resolved 2026-11-04: revoke tells the host (Tithi, "gift has expired, go Pro"); both
pitches are approved; the gift email comes from Shubham and every other notice from Tithi
(transactional keys, not `crm_*`).
