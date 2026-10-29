# Roadmap — Meeticulous

## Status Key
- ✅ Complete
- 🔄 In Progress / Partial
- 📋 Planned
- 💡 Idea / Not Committed

---

## Core Platform (Done)

### Booking Engine ✅
- Guest booking flow with OTP verification
- Logged-in user booking (skips OTP)
- Double-booking prevention with grace period
- Date/time slot generation from availability
- Booking management (cancel, complete, reschedule + guest ack)
- 24h and 1h reminder emails

### Payments ✅
- Razorpay integration for service bookings
- Plan subscription payments
- Digital product purchases
- Payment snapshot on booking (immutable)
- Actual Razorpay fee recording

### Pricing Model ✅
- Platform fee (admin-configurable, default ₹10)
- 18% GST on platform fee
- Commission: 5% (free), 0% (paid plans)
- Full money model: customer total, vendor amount, GST, Razorpay fee

### Authentication ✅
- Host + guest signup/login
- OTP-based booking verification
- Password reset via OTP
- Google OAuth for calendar
- JWT auto-refresh

### Public Profiles ✅
- Host profile with theme color
- Service listing with rich fields
- Service detail page
- Plan-gated avatar border
- Badge showcase page

### Host Dashboard ✅
- Bookings list + management
- Service CRUD (v2 fields: slugs, FAQs, includes/excludes)
- Availability editor (weekly schedule + blocked dates)
- Earnings overview
- Payout requests
- Transaction history
- Profile setup

### Subscription Plans ✅
- DB-driven plan config (limits, commission, features)
- Plan enforcement in middleware
- Admin plan management (CRUD, clone, archive, reorder)

### Badge System ✅
- Rule engine (DB-driven, no hardcoded logic)
- Automated hourly evaluation + event hooks
- Manual admin assign/revoke with required reason
- Public badge showcase

### Email Communication Engine ✅
- DB-stored templates (29 events seeded)
- Multi-provider (SMTP, Resend, SES)
- Queue with retry backoff
- Admin template editor with live preview and test send
- Delivery logs

### Notification System ✅
- AiSensy WhatsApp (DB-configured, no hardcoded keys)
- Per-event channel toggles
- Admin notification management

### Admin RBAC ✅
- 6 roles, 45 permissions
- Separate credential store (admin_users)
- Audit log (append-only)
- Staff management (invite, deactivate, role change)
- 5-attempt lockout

### Vendor Onboarding ✅
- 10-step guided flow
- OTP verification
- First service creation
- Plan selection

---

## Near-Term Backlog

### Guest Booking History 📋
- **Status:** BUG-18 — `/my-bookings` redirects to vendor dashboard
- **Scope:** Dedicated page for guests to see their bookings by email
- **Effort:** Medium (new page + endpoint to look up bookings by guest_email)

### Review Submission UI 📋
- **Status:** API exists (`POST /api/reviews`), no UI
- **Scope:** Post-booking review form accessible from booking confirmation or email link
- **Effort:** Small

### Admin Payout Workflow 📋
- **Status:** Payout requests stored, no admin approve/reject UI
- **Scope:** `AdminEarnings.jsx` (currently empty shell) + new admin endpoints
- **Effort:** Medium

### Refund Processing 📋
- **Status:** `payment_status='refunded'` enum exists, no Razorpay refund API integration
- **Scope:** Admin-initiated refund via Razorpay API + `AdminRefunds.jsx` page
- **Effort:** Medium

### Admin Finance Completeness 📋
- `AdminTransactions.jsx` — unified ledger across bookings, plan purchases, product purchases
- `AdminEarnings.jsx` — platform P&L view (revenue, commission, Razorpay fees)
- `AdminRefunds.jsx` — refund management

---

## Medium-Term Backlog

### Badge Metrics Completion 📋
- `avg_response_time_minutes` — no data source yet (returns 0)
- `login_streak` — no data source yet (returns 0)
- Requires adding tracking hooks on login and booking response

### CMS (Content Management) 📋
- `AdminPages.jsx`, `AdminBlogs.jsx`, `AdminNewsletter.jsx`, `AdminFAQ.jsx`, `AdminTestimonials.jsx` — all UI shells
- Requires DB tables for each content type
- Effort: Large

### Support Center 📋
- `AdminTickets.jsx`, `AdminDisputes.jsx` — UI shells
- Requires DB tables + guest-facing ticket submission
- Effort: Medium-Large

### KYC / Provider Verification 📋
- `AdminKYC.jsx` — UI shell
- Need a defined KYC state machine (pending → submitted → verified → rejected)
- Effort: Medium

### Analytics Dashboard 📋
- GMV, MRR/ARR, churn rate, conversion funnel
- Trend lines in SuperDashboard (currently showing hardcoded percentages)
- Effort: Medium

### Platform Appearance 📋
- `AdminAppearance.jsx` — platform-wide branding (logo, favicon, colors)
- Currently only email branding exists in `email_settings`
- Effort: Small-Medium

---

## Long-Term Backlog

### Twilio as Alternative WhatsApp Provider 💡
- AiSensy is the active WhatsApp provider (no Twilio code exists today)
- Could add Twilio as an alternative provider in the notifications engine

### Google Ads / UTM Tracking 💡
- Booking source tracking (how did the guest find this service)

### Coupon / Discount System 💡
- Promo codes, percentage/flat discounts, trial periods
- Schema needs to be designed

### Razorpay Route (Split Payments) 💡
- Automatic vendor payouts via Razorpay Route
- Would replace manual payout request flow
- Schema + snapshots already support this

### Multi-Currency 💡
- Currently INR only
- `currency` column exists on `services` but not enforced

### Referral / Affiliate System 💡
- Not started, no DB design

### Feature Flags 💡
- `platform_settings` table can extend to support feature flags
- No dedicated system yet

### System Health Dashboard 💡
- Email queue depth, cron heartbeat, failed job counts, API error rates

### SSO for Admin 💡
- `admin_users` currently uses username+bcrypt
- Supabase Auth could back admin users for SSO support

---

## Deferred Email Triggers

Templates are seeded and ready to fire. Triggers need to be wired:

| Event | Needs |
|---|---|
| `BIRTHDAY` | DOB field on profiles + birthday cron |
| `ACCOUNT_ANNIVERSARY` | Cron checking `profiles.created_at` |
| `PROFILE_COMPLETION_REMINDER` | Completeness score + cron |
| `SUBSCRIPTION_EXPIRING` | Cron 7 days before `plan_expires_at` |
| `MILESTONE_10_BOOKINGS`, `50`, `100` | Counter hook on booking completion |
| `LOGIN_ALERT` | Suspicious login detection on auth login |

---

## Related Documentation
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — what's actively in progress
- [DECISIONS.md](DECISIONS.md) — why major choices were made
