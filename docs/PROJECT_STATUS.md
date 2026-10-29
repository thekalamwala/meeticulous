# Project Status — Book A Sloth

_Last updated: 2026-06-11_

---

## Current State: Production-Ready Core

The booking platform is functionally complete. All critical flows work end-to-end:
- Guest booking with OTP → payment → confirmation
- Host dashboard with full service/booking/availability management
- Subscription plan upgrades via Razorpay
- Admin panel with RBAC, email engine, badge system, notification system

**Test coverage:** 205 server tests / 112 client tests — all passing.

---

## ✅ What's Complete

### Booking & Payments
- ✅ Guest OTP-based booking (unauthenticated)
- ✅ Logged-in user booking (skips OTP — BUG-16 fix)
- ✅ Double-booking prevention (with grace period)
- ✅ Razorpay payment integration (service + plan + product)
- ✅ Full money model: platform fee (₹10) + 18% GST + commission snapshot
- ✅ Actual Razorpay fee recording from API (not estimated)
- ✅ Google Calendar Meet event auto-creation for online bookings
- ✅ Booking confirmation emails (host + guest)
- ✅ 24h and 1h booking reminder emails (cron, every 5 min)
- ✅ Booking reschedule with guest acknowledgement flow

### Authentication
- ✅ Vendor + guest signup/login
- ✅ Password reset via OTP
- ✅ Google OAuth (calendar link)
- ✅ JWT auto-refresh on 401
- ✅ Admin RBAC auth (bcrypt, lockout, separate JWT)

### Host Dashboard
- ✅ Services CRUD (v2: slugs, rich fields, FAQs, toggle, duplicate)
- ✅ Availability editor (weekly schedule + blocked dates + timezone + buffer)
- ✅ Bookings list (cancel, complete, reschedule)
- ✅ Earnings overview
- ✅ Payout request submission
- ✅ Transaction history
- ✅ Profile + theme color + social links
- ✅ Digital products CRUD

### Public Pages
- ✅ Host profile with plan-gated avatar border + theme color
- ✅ Service listing
- ✅ Service detail page
- ✅ Badge showcase (`/:username/badges`)
- ✅ Product purchase flow

### Vendor Onboarding
- ✅ 10-step guided flow (slug → OTP → password → type → category → booking-type → calendar → profile → first-service → plans → explore)

### Plan System
- ✅ DB-driven plan config (limits, commission, features)
- ✅ Plan enforcement (services, products, booking quota)
- ✅ Admin plan management UI (CRUD, clone, archive, reorder, assign)
- ✅ Public pricing page endpoint

### Badge System
- ✅ DB-driven rule engine (zero hardcoded badge logic)
- ✅ Hourly automated evaluation + event hooks (booking complete, review)
- ✅ Manual admin assign/revoke with required reason
- ✅ Public badge showcase with accessible modal

### Email Engine
- ✅ 29 event templates (seeded)
- ✅ Multi-provider (SMTP working; Resend + SES plugged in behind factory)
- ✅ Queue with retry backoff (5min → 30min → 2h → permanent fail)
- ✅ Placeholder resolver (`{{snake_case}}` variables)
- ✅ Shared 600px email layout (no per-template HTML shells)
- ✅ Admin UI: template CRUD, live iframe preview, test send, delivery logs

### Notification System
- ✅ AiSensy WhatsApp (DB-configured, no hardcoded keys)
- ✅ Per-event channel toggles
- ✅ Admin UI: provider config, test connection, event toggles, delivery logs

### Admin RBAC (M0 + M1)
- ✅ 6 roles, 45 permissions (DB-seeded)
- ✅ Separate `admin_users` credential store (bcrypt, not auth.users)
- ✅ Append-only audit log (`admin_audit_logs`)
- ✅ 5-fail lockout enforcement
- ✅ Staff management UI (invite, deactivate, role change)
- ✅ Audit log viewer UI
- ✅ Operations center with real attention queue
- ✅ Maintenance mode (admin-toggleable, 30s cache, 503 to public)

---

## 🔄 Partial / Incomplete

| Feature | State | Gap |
|---|---|---|
| Guest booking history | BUG-18: `/my-bookings` routes to vendor dashboard | Need dedicated guest page + endpoint |
| Review submission UI | API exists (`POST /api/reviews`) | No guest-facing form |
| Admin payout approval | Requests stored; vendor UI works | No admin approve/reject endpoints or UI |
| Refund processing | `payment_status='refunded'` enum only | No Razorpay refund API integration |
| Admin finance pages | `AdminTransactions`, `AdminEarnings`, `AdminRefunds` | UI shells or partial |
| Admin provider pages | `AdminProviders`, `AdminKYC` | Lists work; no state machine |
| SuperDashboard trends | Attention queue is real | Trend % hardcoded (12/8/3/5); chart is fake |
| Badge metrics | 12 of 14 metrics real | `avg_response_time_minutes` + `login_streak` = 0 |
| CMS pages | Admin UI shells exist | No DB tables (pages, blogs, FAQ, newsletter, testimonials) |
| Support pages | Admin UI shells exist | No DB tables (tickets, disputes) |
| Email trigger wiring | Templates ready | Birthday, anniversary, milestones, login alert not triggered |
| Admin appearance | UI shell | No general platform branding config |

---

## ⚠️ Known Bugs / Issues

| ID | Description | Severity | Status |
|---|---|---|---|
| BUG-16 | Logged-in users had to verify OTP again | High | **Fixed** |
| BUG-18 | `/my-bookings` routes guest to vendor dashboard | Medium | Open |
| — | `commission_applied` column: v1.7 migration needed | Medium | **Workaround in place** (schema fallback) |
| — | Admin dashboard trend % hardcoded | Low | Open |
| — | Badge metrics: 2 of 14 always return 0 | Low | Open |

---

## 🚫 Blockers

None currently. The only "blocker" for full production readiness:

1. **Admin passwords** — initial credentials delivered in chat, must be changed before public launch. No force-change mechanism exists yet.
2. **v1.7 migration** — if not applied, `commission_applied` is not stored (fallback prevents crash but data is incomplete). All other migrations have been applied to the production Supabase project.

---

## 📋 Next Priorities

1. Guest booking history page (`/my-bookings`)
2. Review submission UI (guest flow post-booking)
3. Admin payout approval workflow
4. Admin refund processing (Razorpay API integration)
5. Wire deferred email triggers (subscription expiry, milestones)

---

## 🔑 Credentials & Access

- Admin login: `/hello-sloth` — 4 accounts created (superadmin, ops, finance, support). Credentials delivered in chat session on 2026-06-11.
- Supabase: production project URL in `server/.env`
- Razorpay: keys in `server/.env`

---

## Test Coverage

```
Server:  205 / 205 passing (Jest)
Client:  112 / 112 passing (Vitest)
```

---

## Related Documentation
- [CHANGELOG.md](CHANGELOG.md) — sprint-by-sprint history
- [ROADMAP.md](ROADMAP.md) — what's planned next
- [DECISIONS.md](DECISIONS.md) — why key choices were made
