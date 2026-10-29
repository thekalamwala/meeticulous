# Book A Sloth — Master Product Brief (for Content)

> Single source of truth for anyone writing about the product: marketing copy, blog/SEO, help docs, and sales/investor material. Compiled from the codebase and `/docs` on 2026-06-18.
> When product facts change, update this file first.

---

## 1. One-liner & elevator pitch

**One-liner:** Book A Sloth is a booking platform that gives any creator a professional, payment-ready booking page in under 10 minutes — built for India.

**Elevator pitch:** Book A Sloth is a multi-tenant SaaS platform where creators (hosts) publish services — 1-on-1 sessions, group sessions, paid DMs, digital products — and guests book and pay for them through a clean public profile page. It's purpose-built for the Indian creator economy: payments run on Razorpay, notifications go out over WhatsApp (AiSensy) and email, and pricing is in INR with GST handled correctly. Guests can book with just an OTP — no account required.

**Internal shorthand (from the README):** *"Calendly, Gumroad, Razorpay and Google had a baby."* Useful for framing, not for public copy verbatim.

**Closest comparables:** Topmate.io, Cal.com, Calendly — but India-first with an opinionated payment/notification stack and a commission + subscription revenue model.

---

## 2. Who it's for (audience & personas)

**Primary market:** the **Indian creator economy** — knowledge and service providers who sell their time.

| Persona | Who they are | What they want |
|---|---|---|
| Coaches & consultants | Business, career, life coaches | A professional booking page, paid sessions, no-shows reduced |
| Tutors & educators | Subject tutors, test-prep, skill teachers | Group + 1-on-1 booking, recurring availability |
| Therapists & wellness | Counsellors, nutritionists, fitness | Private, reliable booking with reminders |
| Creators & experts | Anyone selling advice, audits, or DMs | A link-in-bio that takes money, sells digital products |

**Three user types in the product:**

- **Host (Vendor / Creator)** — publishes services, sets availability, receives paid bookings, manages everything from a dashboard. Gets a public page at `bookasloth.com/:username`.
- **Guest (Customer)** — discovers a host, picks a slot, verifies by OTP (or logs in), pays via Razorpay, gets confirmation + reminder emails. May never create an account.
- **Admin (Platform staff)** — runs the platform through a role-based admin panel.

---

## 3. The problem it solves

Independent creators in India piece together a booking page, a payments gateway, a calendar, a reminder system, and a way to sell digital files — usually across 4–5 disconnected tools, most of which aren't built for INR/GST/WhatsApp. Book A Sloth collapses that into one onboarding flow:

- **For hosts:** professional presence + payments + scheduling + notifications, live in minutes, no technical setup.
- **For guests:** zero-friction booking — verify with an OTP, pay, done. No forced account creation.
- **Reduces no-shows:** automated 24-hour and 1-hour reminder emails.

---

## 4. Business model & pricing

Three revenue streams: **subscriptions, a per-booking platform fee, and commission on the free tier.**

### Subscription plans

⚠️ **Pricing note for writers:** two versions exist in the docs. The **README (Jun 16, newest)** introduces monthly + annual billing — use this. The older PRODUCT_OVERVIEW lists annual-only. Plan prices are admin-editable in **Admin → Subscription Plans**, so always confirm live values before publishing exact numbers.

| Plan | Monthly | Annual | Commission | Services | Products | Bookings |
|---|---|---|---|---|---|---|
| **Starter** (free) | — | ₹0 | 5% | 3 | 0 | 20/month |
| **Creator** | ₹199/mo | ₹999/yr | 0% | 15 | 5 | Unlimited |
| **Professional** | ₹499/mo | ₹3,650/yr | 0% | Unlimited | Unlimited | Unlimited |

- Paid plans auto-renew via Razorpay Subscriptions; GST charged on top; annual is the better deal.
- Switching tier/cadence **prorates** remaining value into free days on the new plan.

### Platform fee & commission

- **Platform fee:** flat fee per booking (default **₹10**, admin-editable), charged to the **guest** on top of the service price.
- **GST:** 18% applied on the platform fee (passed through, not platform revenue).
- **Commission:** 5% on Starter (free) bookings; **0% on Creator & Professional**. Calculated on service price and stored as an immutable snapshot on the booking.

### Money-flow example (free host, ₹100 service)

```
Guest pays:    ₹111.80  (₹100 service + ₹10 platform fee + ₹1.80 GST)
Vendor gets:   ₹92.66   (₹100 − 5% commission − actual Razorpay fee)
Platform gets: ₹15.14   (₹10 fee + ₹5 commission − GST liability)
Razorpay fee:  ~₹2.34   (borne by vendor, recorded from actual API response)
```

**Positioning angle:** "Fair monetisation" — free tier funded by commission; paid tiers remove commission and raise limits. The free tier is genuinely usable, not a crippled trial.

---

## 5. Feature inventory

### For Hosts (creators)
- **Public profile** — bio, theme color, avatar (plan-gated border), social links, service cards
- **Service management** — 1-on-1, group, and paid-DM services; rich fields, slugs, FAQs, includes/excludes, active/inactive toggle, duplicate, search
- **Availability editor** — weekly schedule, blocked dates, timezone, buffer minutes
- **Bookings dashboard** — list, filter, cancel, complete, reschedule (with guest acknowledgement)
- **Earnings & payouts** — balance view, payout requests, transaction history
- **Digital products** — sell downloadable files (plan-gated)
- **Google Calendar integration** — auto-creates Google Meet events for online bookings
- **Badge showcase** — platform-awarded + manually assigned achievement badges
- **10-step guided onboarding** — slug → OTP → password → profile → first service → plan, live in under 10 minutes

### For Guests
- **Discovery** via host public profile / direct link
- **Real-time slot selection** with double-booking prevention
- **OTP verification** — book without an account
- **Razorpay checkout** for paid services and products
- **Confirmation + reminder emails** (24h and 1h before)
- **Reschedule acknowledgement** flow

### For Admins (platform operators)
- **Operations center** with a real-time attention queue
- **User & booking management** — CRUD, role changes, verification, banning, status changes
- **Plan management** — DB-driven config; edit limits/pricing/commission with no code changes
- **Badge engine** — rule-based automated awards + manual awards
- **Email engine** — 29 seeded templates, live preview, test send, multi-provider (SMTP / Resend / SES), retry queue, delivery logs
- **Notification system** — WhatsApp (AiSensy) + email, per-event toggles
- **RBAC staff management** — 6 roles, 45 permissions, invite/deactivate, append-only audit log, 5-attempt lockout
- **Platform settings** — fee amounts, maintenance mode, branding

---

## 6. Key differentiators (lead with these)

1. **India-first by design** — INR, Razorpay, GST handled correctly, AiSensy WhatsApp, IST default. Not a US tool with a currency switch.
2. **No-account booking for guests** — OTP verification removes the biggest drop-off point in booking funnels.
3. **All-in-one** — booking + payments + scheduling + digital products + notifications in one page, replacing 4–5 tools.
4. **Genuinely usable free tier** — 3 services, 20 bookings/month, funded by transparent commission rather than a time-limited trial.
5. **Fast time-to-value** — professional booking page live in under 10 minutes via guided onboarding.
6. **Operator-grade admin** — RBAC, audit logs, configurable pricing/templates without redeploys (a real B2B/ops story for sales/investor content).

---

## 7. What's live vs. what's coming

**Status (as of 2026-06-11 docs): production-ready core.** 205 server tests + 112 client tests passing.

**Live & working:** guest OTP booking, logged-in booking, double-booking prevention, Razorpay payments (services/plans/products), full money model with immutable pricing snapshots, Google Calendar/Meet, confirmation + reminder emails, host dashboard (services/availability/bookings/earnings/payout requests), subscription plans, badge system, email engine, WhatsApp notifications, admin RBAC, vendor onboarding.

**Partial / coming soon (don't promise these as shipped):**
- Guest booking-history page (`/my-bookings`) — currently misroutes (BUG-18)
- Review submission UI (the API exists, the form doesn't)
- Admin payout approval workflow, refund processing (Razorpay refund API), unified finance ledger
- CMS (blogs, FAQ, newsletter, testimonials), support/ticketing, KYC verification
- Analytics dashboard (GMV, MRR/ARR, churn) — some admin trend numbers are still placeholder
- Some email triggers (birthday, anniversary, milestones, subscription-expiry) are seeded but not yet wired

**Longer-term ideas:** coupons/discounts, Razorpay Route split payments (auto payouts), multi-currency, referral/affiliate, feature flags, admin SSO.

> **Content guardrail:** When writing public-facing copy, describe only the "Live & working" set as available today. Frame the rest as roadmap if mentioned at all.

---

## 8. Constraints & boundaries

- **India-first:** INR only (a `currency` column exists but isn't enforced), Razorpay payments, AiSensy WhatsApp, IST default.
- **Web only:** responsive web app, no native mobile app.
- **Async only:** no real-time chat; communication is booking + email/WhatsApp.
- **Single-location services:** no multi-location support yet.
- **WhatsApp = AiSensy**, not Twilio (no Twilio code exists in this repo).

---

## 9. Tech stack (for technical/credibility content)

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, react-router-dom v6 |
| Backend | Node.js + Express 4 |
| Database / Auth / Storage | Supabase (PostgreSQL + Auth + Storage), Row-Level Security |
| Payments | Razorpay (orders + subscriptions) |
| Email | Nodemailer / Resend / AWS SES (pluggable) |
| WhatsApp | AiSensy (DB-configured) |
| Uploads | Cloudinary |
| Calendar | Google Calendar API |

**Engineering credibility notes:** immutable pricing snapshots for clean accounting; DB-backed OTP store with bcrypt-hashed codes; separate admin auth system with its own JWT secret and audit logging; pure-function pricing engine.

---

## 10. Key URLs / IA

| URL | What it is |
|---|---|
| `/` | Landing page |
| `/:username` | Public host profile |
| `/:username/booking/:serviceSlug` | Guest booking flow |
| `/:username/badges` | Host badge showcase |
| `/dashboard` | Host dashboard (auth) |
| `/vendor-register` | 10-step onboarding |
| `/hello-sloth` | Admin login |
| `/super-dashboard`, `/admin/*` | Admin panel |

---

## 11. Content angles by type

**Marketing / website copy**
- Hero: "Your booking page, payments, and reminders — live in 10 minutes." Lead with India-first + no-account booking.
- Value props: get paid (Razorpay), get booked (real-time slots), get remembered (WhatsApp + email reminders), get found (public profile).
- Pricing page: free tier as the hook; "0% commission" as the upgrade trigger.

**Blog / SEO**
- Problem/solution and how-to angles: "How to take paid bookings in India without building a website," "Reduce no-shows with automated reminders," "Topmate vs Cal.com vs Book A Sloth for Indian creators."
- Keywords: appointment booking software India, Razorpay booking page, sell sessions online India, Calendly alternative India, creator booking page.

**Product / help docs**
- Map to real flows: onboarding (10 steps), creating a service, setting availability, connecting Google Calendar, getting paid & payouts, selling digital products, understanding the platform fee/GST.
- Use the Feature inventory (§5) and Key URLs (§10) as the backbone.

**Sales / investor material**
- Market: Indian creator economy. Model: subscription + platform fee + commission (show §4 money flow). Moat: India-specific payment/notification stack + operator-grade admin.
- Traction proxies: production-ready core, test coverage, breadth of admin tooling. Roadmap (§7) shows expansion into finance, CMS, analytics.

---

## 12. Quick FAQ (reusable answers)

- **Do guests need an account?** No — they verify with a one-time OTP and can pay directly.
- **How do creators get paid?** Via Razorpay; vendors see earnings and request payouts (automated split payouts are on the roadmap).
- **What does it cost?** Free Starter tier (5% commission); paid Creator and Professional tiers at 0% commission. Plus a small per-booking platform fee + GST.
- **Which countries?** India-first today — INR, Razorpay, GST, IST.
- **Is there an app?** Responsive web app; no native mobile app yet.
- **WhatsApp notifications?** Yes, via AiSensy, alongside email.

---

*Sources: `docs/PRODUCT_OVERVIEW.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `README.md`, and the codebase.*
