# Product Overview — Meeticulous

## What It Is

Meeticulous is a multi-tenant SaaS platform where **creators (hosts)** publish services and **guests** book them. It targets the Indian creator economy — coaches, consultants, tutors, therapists, and other knowledge-based service providers who want a professional booking page without technical setup.

Think Topmate.io or Cal.com, but with an opinionated Indian payment stack (Razorpay), WhatsApp notifications, and a commission/subscription revenue model.

---

## User Types

### Host (Vendor / Creator)
- Registers via a 10-step onboarding flow (slug → OTP → password → profile → first service → plan)
- Gets a public profile at `meeticulous.com/:username`
- Creates services (1-on-1, group, paid DM) with pricing, duration, availability, and booking slots
- Receives bookings from guests, manages them from a dashboard
- Pays a platform subscription to unlock higher service/product limits and zero commission

### Guest (User / Customer)
- Discovers hosts via public profile pages or direct links
- Books a service by picking a time, entering details, verifying via OTP (or logging in)
- Pays via Razorpay for paid services
- Receives confirmation + reminder emails
- May or may not have a full account

### Admin (Platform Staff)
- Manages the platform via `/super-dashboard` and `/admin/*`
- Has role-based access: superadmin, operations, finance, support, content, technical
- Can manage users, bookings, plans, emails, badges, notifications, and platform settings

---

## Business Model

### Revenue Streams

**1. Subscription Plans**
| Plan | Price | Key Limits |
|---|---|---|
| Starter (free) | ₹0/yr | 3 services, 0 products, 20 bookings/month |
| Creator | ₹999/yr | 15 services, 5 products, unlimited bookings |
| Professional | ₹3,650/yr | Unlimited everything |

**2. Platform Fee**
- Every booking has a flat platform fee (currently ₹10, admin-editable)
- Platform fee is charged to the guest on top of the service price
- 18% GST applied on the platform fee (passed through, not platform revenue)

**3. Commission**
- Starter plan hosts pay 5% commission on each booking
- Creator and Professional hosts pay 0% commission
- Commission is calculated on the service price and stored as a snapshot on the booking row

**Money flow example (free host, ₹100 service):**
```
Guest pays:   ₹111.80  (₹100 service + ₹10 platform fee + ₹1.80 GST)
Vendor gets:  ₹92.66   (₹100 − 5% commission − actual Razorpay fee)
Platform gets: ₹15.14  (₹10 fee + ₹5 commission − GST liability)
Razorpay fee: ~₹2.34   (borne by vendor, recorded from actual API response)
```

---

## Core Feature Set

### For Hosts
- **Public profile** with bio, theme color, avatar, social links, and service cards
- **Service management** — rich fields, slugs, toggle active/inactive, duplicate, search
- **Availability editor** — weekly schedule (JSON), blocked dates, timezone, buffer minutes
- **Bookings dashboard** — list, filter, cancel, complete, reschedule with guest acknowledgement
- **Earnings & payouts** — balance view, payout requests
- **Digital products** — sell downloadable files (plan-gated)
- **Google Calendar integration** — auto-creates Meet events for online bookings
- **Badge showcase** — platform-awarded and manually-assigned achievement badges

### For Guests
- **Service discovery** via host public profile
- **Time slot selection** with real-time availability checking
- **OTP verification** (no account needed for booking)
- **Razorpay checkout** for paid services
- **Confirmation + reminder emails** (24h and 1h before booking)
- **Reschedule acknowledgement** flow

### For Admins
- **Operations center** with real-time attention queue
- **User management** — CRUD, role changes, verification, banning
- **Booking oversight** — status changes, filters
- **Plan management** — DB-driven plan config with live limits/pricing
- **Badge engine** — rule-based automated badge awards + manual awards
- **Email communication engine** — DB templates, live preview, multi-provider (SMTP/Resend/SES)
- **Notification system** — WhatsApp (AiSensy) + email, per-event toggles
- **RBAC staff management** — invite staff, assign roles, audit log
- **Platform settings** — fee amounts, maintenance mode, branding

---

## Product Goals

1. **Zero-friction booking for guests** — OTP verification without needing an account
2. **Instant professional presence for hosts** — full booking page from onboarding in under 10 minutes
3. **Fair monetisation** — free tier with commission, paid tier with zero commission and higher limits
4. **Reliable notifications** — email (always) + WhatsApp (when configured)
5. **Admin control** — full platform visibility without code changes

---

## Product Constraints

- **India-first** — INR currency, Razorpay payments, AiSensy WhatsApp, IST timezone default
- **No native mobile app** — responsive web only
- **No real-time chat** — async booking + email/WhatsApp notifications
- **Single-location services** — no multi-location support yet

---

## Related Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the system is built
- [DATABASE.md](DATABASE.md) — data model details
- [ROADMAP.md](ROADMAP.md) — what's planned next
