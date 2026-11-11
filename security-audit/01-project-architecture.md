# 01 — Project Architecture & Attack Surface

**Project:** Meeticulous — multi-tenant appointment-booking SaaS (hosts publish services; guests book via OTP or account; Razorpay payments).
**Audit date:** 2026-11-11 · **Branch:** `docs/security-audit` · **Scope:** full codebase (client + server + Supabase) + live read-only DB introspection.
**DB audited (read-only):** Supabase project `spquowzrefozmrzoszkf` ("Meeticulous Dot Com"), Postgres 17.11, region eu-west-2.

> This document maps the system and its trust boundaries so the findings in `02`/`05` can be read against the real architecture. It makes **no** claim that a control is correctly configured — that is the job of the audit reports.

---

## 1. System overview

```
Browser (React 18 SPA, Vite)                 Vercel edge (static host + headers + rewrites)
  ├─ api.js (axios, Bearer JWT, 401-refresh)        │  serves spa-shell.html, /assets, security headers
  ├─ Supabase JS SDK (anon key — auth listener)     │  rewrites /sitemap* + /prerender → Render API
  └─ Razorpay checkout widget                        ▼
                         │ HTTPS, Authorization: Bearer <supabase JWT | admin JWT>
                         ▼
Express API (Node, Render — meeticulous-api.onrender.com)
  middleware chain: cors → ipGuard → (raw webhook bodies) → express.json(100kb)
    → compression → metrics → helmet → permissionsPolicy → hpp → sanitizeBody
    → blockSuspiciousRequests → speedLimiter → apiLimiter(/api) → maintenance → routes
  ~54 route modules, ~ controllers; ALL DB access via supabaseAdmin (service_role)
  ~45 cron/worker jobs (leader-elected via job_locks; persisted due-runner for long jobs)
                         │ service_role key (BYPASSES RLS)
                         ▼
Supabase: Postgres 17 (150+ tables) · Auth (GoTrue) · Storage (5 buckets)

External: Razorpay (orders/subscriptions/webhooks) · Google Calendar/OAuth · LinkedIn OIDC
          SMTP/Resend/Brevo (email) · AiSensy (WhatsApp) · Anthropic (support bot) · PostHog/GA4/Meta CAPI · Sentry
```

### Key architectural fact that shapes the whole threat model
**The backend talks to Postgres exclusively as `service_role`, which bypasses Row-Level Security.** Row-Level Security is therefore **not** an authorization backstop for the application API. Every authorization decision (who may read/modify which row) is enforced **only** in Node controller code. Consequence: the dominant risk class is **broken object/function-level authorization in controllers (IDOR/BOLA/BFLA)** and **mass-assignment**, not SQL-level access. RLS-with-no-policy on the tables is the correct *fail-closed* posture for this design (anon/authenticated clients get zero direct table access; see `04`).

---

## 2. Technology stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite, Tailwind, react-router-dom v6 | SPA, served static from Vercel |
| Backend | Node + Express 4 | single service on Render |
| DB/Auth | Supabase (Postgres 17, GoTrue) | service_role server-side; anon key client-side (auth listener only) |
| Payments | Razorpay (orders + subscriptions + Route transfers) | HMAC-verified webhooks, server-authoritative pricing |
| Email | Nodemailer/SMTP, Resend (Svix webhooks), Brevo (lifecycle/CRM + inbound) | provider split by domain |
| WhatsApp | AiSensy (DB-configured per event) | secret-gated webhook |
| Storage | Supabase Storage — buckets: `images` (public), `kyc`/`customer-files`/`products`/`gst-exports` (private) | |
| OAuth | Google (calendar + identity), LinkedIn OIDC (flagged) | signed `state`, server-verified identities |
| Error/analytics | Sentry, PostHog, GA4, Meta CAPI | |
| Host | Render (API), Vercel (SPA) | behind reverse proxy, `trust proxy: 1` |

---

## 3. Trust boundaries

| # | Boundary | Who crosses it | Auth mechanism |
|---|---|---|---|
| B1 | Browser → Express API | Public, guests, hosts | None / Supabase JWT (`protect`) |
| B2 | Admin console → Express API | Staff/superadmin | Separate admin JWT (`SUPER_ADMIN_JWT_SECRET`), `requireAdmin(perm)` / `requireSuperAdmin` |
| B3 | Razorpay/Resend/Meta/GitHub/AiSensy/Brevo → API webhooks | External services | HMAC/Svix signature or shared secret over raw body |
| B4 | Express API → Supabase | Server only | `service_role` key (bypasses RLS) |
| B5 | Express API → Razorpay/Google/LinkedIn/SMTP/Anthropic | Server only | Provider API keys / OAuth tokens (AES-256-GCM at rest in `profile_private`) |
| B6 | Token-gated machine endpoints (`/api/ingest`, `/api/agents/reports`, `/metrics`, unsubscribe) | External/internal automation | Shared token / signed token |
| B7 | Guest self-service (manage-booking, reschedule-ack) | Unauthenticated guest holding a link token | Opaque per-resource token |

---

## 4. Authentication model (observed)

- **Guest:** phone-first OTP (WhatsApp + email), 6-digit CSPRNG, bcrypt-hashed in `otp_codes`, 10-min TTL, 3 verify attempts → 15-min lockout, 3 sends/hr; purpose-scoped (`booking` vs `password_reset`). Phone or email/password login also supported; per-account lockout (5 → 15 min) with timing-equalized responses (enumeration-resistant).
- **Host:** Google OR LinkedIn OIDC (LinkedIn flag-gated, fails closed). Email/password host registration exists but is effectively unused in prod. Identity is always re-read from Supabase/Google server-side, never trusted from the request body.
- **Session:** Supabase access+refresh JWT (ES256), verified per request by `supabaseAdmin.auth.getUser(token)` in `protect`; a `accountGate` read enforces admin ban (`is_banned`) and global-logout watermark (`sessions_valid_after`, Google RISC). Client stores session in `localStorage['user']`; admin in `localStorage['bas_admin']`.
- **Admin:** fully isolated JWT system (`adminMiddleware.js` + `adminAuthService.js`), permission array embedded at login, bcrypt passwords, 5-fail lockout. Superadmin unreachable by phone OTP.

## 5. Core data flows

- **Booking (guest):** load host/service → check slots → OTP verify (issues a contact-bound `bookingGrant`) → `POST /bookings` (double-booking + plan-limit checks, pricing snapshot) → for paid: `create-order` (identity-checked) → Razorpay checkout → `verify` (order-id match + HMAC + amount re-check vs Razorpay order) → confirm + calendar + emails. Webhook + reconcilers are the durable source of truth.
- **Pricing:** server-authoritative. Inputs from the DB service row + platform config; immutable snapshot written to the booking; never recomputed from client input.
- **Payments:** Razorpay is source of truth. Signatures HMAC-SHA256 verified server-side (`timingSafeEqual`); subscription/product verification additionally re-checks the Razorpay order `notes` (vendor/plan/product + amount) so a cheap order can't activate an expensive entitlement; idempotent on payment/order id; webhook events logged append-only for replay detection.

## 6. Attack surface inventory (by exposure)

| Class | Examples | Guard |
|---|---|---|
| **Public, unauth** | host profile, explore/search, blogs, sitemap, prerender, `GET /plans`, `GET /config/public`, contact/enterprise/demo-lead forms, newsletter, bot (`/bot/ask`), community reads, OTP send/verify, booking create, payment create/verify | Global 100/min limiter + per-route limiters (OTP/booking/payment/search/bot/newsletter…), ipGuard auto-ban, `optionalProtect` where mixed |
| **Authenticated (host/guest)** | `/host/*`, `/bookings/*`, `/services/*`, `/products/*`, `/payment/subscribe*`, `/upload/*`, `/kyc/*`, `/referrals`, `/invoices`, `/notifications`, `/community` writes | `protect` (+ `requireHost` for host-only); **ownership enforced per-controller** |
| **Admin** | `/api/admin/*`, `/api/admin-auth/*`, host360/guest360/CRM, security (IP block), feature flags | `requireAdmin(permission)` / `requireSuperAdmin`, adminLimiter |
| **Webhooks** | `/payment/webhook`, `/webhooks/resend|meta-leadgen|github`, `/webhooks/brevo/inbound`, `/notifications/aisensy` | Raw-body signature/secret verification |
| **Token-gated machine** | `/ingest`, `/agents/reports`, `/metrics`, `/ready`, email unsubscribe, product download token, manage-booking token | Shared/signed token |
| **Background jobs** | ~45 crons (reminders, reconcilers, CRM sends, nudges, SEO crawl, Tithi bot) | Leader election (`job_locks`), feature-flag + per-event gates, quiet-hours |

## 7. Security controls present (observed — correctness verified in `02`)

helmet (CSP/HSTS/frameguard/noSniff) on API · Vercel security headers on SPA (CSP currently **Report-Only**) · layered express-rate-limit (per-IP **and** per-contact) + express-slow-down · ipGuard auto-ban on attack signatures · hpp · body sanitizer + suspicious-request blocker (defense-in-depth only) · 100kb JSON cap · CORS allowlist · service_role isolated server-side · OAuth `state` HMAC (CSRF) + anchored open-redirect allowlist · OTP/login/reset lockouts · admin ban + RISC global-logout gate · AES-256-GCM encryption of Google tokens in `profile_private` · idempotent, signature-verified payment webhooks · leader-elected crons · `validateEnv` fail-fast on boot · Sentry.

## 8. What this means for the reader
The platform is **security-mature**: the common framework-level holes (unsigned webhooks, client-trusted pricing, plaintext OTP, shared admin/user auth, secrets in code, public RLS tables) are closed. Residual risk concentrates in (a) **per-endpoint authorization consistency** across ~54 route modules and the large admin surface, (b) **dependency CVEs** (notably `proxy-addr` IP-spoofing, which undercuts the IP-keyed defenses), (c) **enforced vs report-only CSP**, and (d) operational items (leaked-password protection, OAuth state secret in prod). See `05-risk-register.md`.
