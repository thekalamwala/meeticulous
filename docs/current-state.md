# Current State — Meeticulous
_Last updated: 2026-08-29 (host notification system + admin ops badge + AiSensy fix; KYC section 2026-07-16; rest last reviewed 2026-06-13)_

## ✅ Working Features

### Booking Flow
- Date/time selection with booked-slot exclusion (grace period aware)
- Guest OTP verification (DB-backed — survives server restarts)
- Logged-in user booking (skips OTP — BUG-16 fix)
- Booking creation with pricing snapshot (vendor_amount, platform_fee_amount)
- commission_applied insert with schema fallback for pre-v1.7 DBs
- Razorpay payment integration
- Google Calendar event creation for online bookings
- Confirmation emails (host + guest)
- Booking confirmation UI step

### Dashboard
- Services list with filter, search, toggle, duplicate, delete
- View Public Page icon links to correct URL (`/:username/booking/:slug`)
- Add/Edit service with slug, rich fields
- Availability editor (weekly schedule + blocked dates)
- Bookings list with cancel/complete/reschedule
- Earnings overview
- Payout requests
- Transaction history

### Authentication
- Vendor + guest registration
- Login with JWT + refresh token auto-refresh on 401
- Google OAuth for calendar
- Password reset via OTP
- Admin auth (OTP-based, separate JWT)

### Public Profiles
- Host profile with theme color
- Service listing
- Plan-gated avatar border color
- Service detail page
- Review display

### Pricing
- Platform fee tiers: ₹0/₹2/₹5/₹10
- Commission: 5% of amount above ₹200 (free plan, after 30-day grace)
- Paid plans: 0% commission
- Plan limits enforced (services, bookings/month, products)

### Host KYC (v3.68)
- 4-step flow at `/dashboard/kyc/flow` (personal → bank → live selfie → PAN/Aadhaar docs), gates payouts
- PAN/Aadhaar/account number encrypted at rest (`kycCrypto`, AES-256-GCM); `GET /api/kyc/me` returns masked values only
- Docs go to the private `kyc` bucket; uploads are magic-byte sniffed (`fileSniff.js`), client mimetype never trusted
- **Flow state fix (#374, 2026-07-16):** `KycProvider` is mounted in `App.jsx` ABOVE `DashboardWrapper` on purpose. Below `PageTransition` (keyed on pathname) it remounted every step and bounced hosts back to step one. See `docs/current-work.md` for the full landmine.

### Blog (v3.74, index redesign 2026-07-16)
- `/blog` index + `/blog/:slug` posts; content in the `blogs` table, served by `GET /api/blogs`
- Index is paged at 13/page (1 featured + 12 grid), URL-driven via `?page=N` — paging is client-side, since the API returns every post in one payload
- Cards carry the same generated category-themed art as the post heroes (`BlogHeroThumbnail`); hover tints heading + CTA to the post's category colour
- `/blogs` and `/blogs/:slug` 301 to the canonical `/blog*` at the edge (`client/vercel.json`), with the router redirect as the dev/in-app fallback. **Both layers are load-bearing** — see `docs/current-work.md`
- Post body links wipe an underline in on hover; drawn as a background-image so wrapped links underline in full

### Reminders
- 24h and 1h booking reminder emails
- Cron runs every 5 minutes

### Host Notification System (overhauled 2026-08-29, v3.130–v3.132)
- **In-app is a channel of `NotificationEngine`.** One `NotificationEngine.send({event, data:{inApp:{title,body,link}}})` fans out to email + WhatsApp + in-app, gated per event by `notification_events.in_app_enabled` (mirrors `whatsapp_enabled`). New events use this path; the ~10 legacy `inAppNotify` call-sites still work and migrate opportunistically.
- **Real-time bell** — `inAppNotify` broadcasts to an HMAC-derived per-user topic (`utils/notifChannel.js`); both bells subscribe via `useLiveNotifications` (client fetches its topic from `GET /api/notifications/channel`). No more poll-only.
- **De-duplication** — `in_app_notifications.dedupe_key` + partial unique index; repeated emits (reconciler / cron) don't stack rows.
- **Resolution** — `in_app_notifications.resolved_at`; `resolveInApp()` clears a notice once fixed (KYC approved → `KYC_REJECTED`; subscription charge → `SUBSCRIPTION_HALTED`).
- **Previously-silent host events now fire** — `SUBSCRIPTION_HALTED`, `REFERRAL_REWARD_RELEASED` (email + in-app), plus `ONBOARDING_COMPLETE` / `KYC_SUBMITTED` acks.
- Deep-links fixed (bell navigates; review → `/dashboard/clients`; calendar → `/dashboard/profile`); host now gets a `BOOKING_NEW` bell entry.
- **Not yet built:** notification grouping/filter, a standalone `/dashboard/notifications` page, a banner system, host notification-preferences UI, payout-failed resolution.

### Admin Operations badge (`/api/admin/ops/summary`)
- The admin bell's red dot is a **work-queue** (`totalAttention`), not read/unread: pending payouts, failed emails/notifs (windowed to 14 days), abandoned bookings, flagged reviews, and onboarding-complete unverified hosts. There is deliberately no "dismiss" — it clears when items are resolved or age out.

### Financial Ledger (P1)
- Double-entry accounting: `chart_of_accounts` (12 accounts) + `journal_entries`/`journal_lines`/`ledger_entries`/`account_balances`, written atomically via `post_journal_entry(jsonb)` RPC (balanced + idempotent on source_type+source_id)
- Posts on triggers: ORDER_PAYMENT (verifyPayment), SUBSCRIPTION_PAYMENT (verifySubscription), with completeBooking stamping revenue recognition + settlement status
- **Money model now v3**: commission GST (18% of commission, vendor-borne) + subscription GST (18% on plan price); Razorpay fee stored split (fee + tax)
- Hourly self-heal reconciler reposts paid bookings/subscription_payments missing a journal entry
- Admin finance UI at `/admin/finance` (dashboard, journal browser, per-account ledger); perms `finance.view` / `finance.manage`
- SHIPPED on branch `sd/adoring-elgamal-625af7` (not merged); migrations v2.8/v2.8.1/v2.8.2 applied live

## ⚠️ Pending / Known Limitations

### DB Migrations — all applied (verified 2026-07-01)
- All migrations through **v3.57** are applied on both prod (Mumbai) and staging (Tokyo),
  confirmed by live schema introspection.
- `v1.7` (`bookings.commission_applied`) is applied — snapshot is now stored. The
  `bookingController.js` schema-fallback remains as defence-in-depth (harmless).
- No DB migration is currently outstanding.

### WhatsApp via AiSensy
- `notify.js` routes WhatsApp sends through `notificationEngine.js` to AiSensy (`aisensyService.js`), not Twilio — no Twilio code exists in this repo
- Enabled per event/provider from DB (`notification_events.whatsapp_enabled` + `notification_providers.is_active`), admin-configurable
- OTP and appointment notifications send over both email and WhatsApp where the channel is enabled
- **"Booking Confirmed" WhatsApp = FIXED + verified 2026-08-29.** The approved AiSensy template takes exactly **4** body vars; a stale deploy still appended the Meet link as a 5th for online bookings (`"Template params does not match the campaign"`). Fixed on `main` + redeployed; proven with a live 4-param send (HTTP 200). Regression test (`bookingConfirmedParams.test.js`) locks it. `notification_providers.api_key` is a plaintext JWT.

### Features Not Yet Built
- Guest booking history dashboard (guests redirected to `/my-bookings` but shows host dashboard)
- Booking reschedule UI in guest-facing flow (API exists, UI limited)
- Review submission UI (API exists, no dedicated page)
- Admin payout approval workflow (requests stored, approval UI may be partial)
- **Email & WhatsApp campaigns (SHIPPED 2026-06-12)** — broadcast to consented segments at `/admin/campaigns`. Audience (`contacts` + consent/suppression), `segments`, `email_campaigns`/`campaign_recipients`, throttled `campaignWorker`. Email via Resend (set provider in Communication → Settings); WhatsApp via approved AiSensy templates. Reference: `docs/communication-campaigns-architecture.md`; guides: `docs/guides/`. **Pending:** real-creds e2e (Resend + AiSensy test number), delivery/read funnel (v2), scheduled-send trigger.

### Financial Ledger — phases not built / pending
- **P1 only is built.** P2 (settlement engine: eligibility/batches/holds/vendor ledger), P3 (refunds), P4 (reconciliation + accounting periods + reports/exports), P5 (Razorpay recurring-mandate subscriptions) are NOT built.
- **Backfill not yet run on live** — `server/scripts/backfillLedger.js` (idempotent, `--dry-run`) must be run from an env with `server/.env` at deploy to replay historical paid bookings/plan_purchases/payouts.
- Branch `sd/adoring-elgamal-625af7` is NOT merged to main.

## Environment Status
- Server port: 5000
- Client port: 5173 (dev) / built to `client/dist/`
- DB: Supabase (PostgreSQL)
- Auth: Supabase Auth with service role on server
- Payments: Razorpay (test/live keys in env)
- Email: SMTP via Nodemailer
- Upload: Supabase Storage (bucket `images`)
