# Clone Launch Checklist — Getting Meeticulous to Product Grade

> Purpose: stand up a **fresh clone** of the already-launched, tried-and-tested
> platform (all features ON — bookings, payments, AI bot, CRM/marketing,
> analytics) to the same production grade as the original. A clone cannot reuse
> the old project's keys, so every external account and secret must be
> re-provisioned.
>
> Source of truth for what blocks boot: [`server/config/validateEnv.js`](../server/config/validateEnv.js).
> Env template: [`server/env.staging.example`](../server/env.staging.example).

---

## Current Render status — `meeticulous-api` (snapshot 2026-10-29)

Service: `srv-dbhj4n8n74is73e5tahg` · repo `thekalamwala/meeticulous` · branch
`main` · free plan · Singapore.

**✅ All 7 CRITICAL vars are set — the service will boot.**
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
`SUPER_ADMIN_JWT_SECRET`, `OAUTH_STATE_SECRET`, `GOOGLE_TOKEN_KEY`, `CLIENT_URL`.

Also set: `API_URL`, `CLIENT_URLS`, `NODE_ENV`, `NODE_VERSION`,
`GOOGLE_REDIRECT_URI`, `SMTP_PORT`, `RESEND_API_KEY`, `RESEND_FROM`,
`POSTHOG_HOST`, `PERF_LOG`, `SUPPORT_REPLY_TO`.

### ⬜ Still missing — blocks a working, marketed product

Ordered by impact:

1. **Host login broken** — redirect + token key set, but credentials missing:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. (Google-only host login is dead
   without these.)
2. **No email / OTP** — only `SMTP_PORT` is set. Add `SMTP_HOST`, `SMTP_USER`,
   `SMTP_PASS`. (Guest OTP + all transactional mail fail.)
3. **No payments** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`. (Razorpay KYC is the long pole — start now.)
4. **AI features off** — `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
   `BOLT_LISTING_MODEL`, `BOT_PILLS_ENABLED`, `BOT_ROAST_ENABLED`.
5. **Admin login incomplete** — only `SUPER_ADMIN_JWT_SECRET` set. Add
   `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_EMAIL`,
   `SUPER_ADMIN_OTP_EMAIL`.
6. **Supabase JWT verify** — `SUPABASE_JWT_SECRET`.
7. **KYC** — `KYC_ENCRYPTION_KEY` (if host KYC gates onboarding).
8. **Resend webhooks** — `RESEND_WEBHOOK_SECRET` (delivery/bounce tracking).
9. **Marketing stack** — `POSTHOG_PROJECT_TOKEN` (host set, token missing),
   `BREVO_API_KEY`/`BREVO_FROM`, all `FB_*`, `GA4_*`, `GSC_*`,
   `PRERENDER_BUILD_TOKEN`.
10. **Infra hardening** — `REDIS_URL`, `SENTRY_DSN`, `METRICS_TOKEN`,
    `INGEST_TOKEN`, `ADMIN_ALERT_EMAIL`.

Scheduler knobs (section I) run on defaults — skip unless tuning.

> Note: `SUPPORT_REPLY_TO` is set in Render but not yet in
> `env.staging.example` — add it there when syncing.

---

## 0. Critical path — start these FIRST (external wait time)

Everything else is same-day. These two have lead time measured in days:

1. **Razorpay business KYC** — payments are dead until approved. Submit business
   docs immediately. → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
2. **Domain purchase + DNS** — needed for CORS lock, OAuth redirect, and email
   SPF/DKIM authentication. Buy it, point DNS, verify the sending domain in your
   email provider before you need to send OTPs.

---

## 1. Provisioning groups

### A. Secrets you generate yourself — free, minutes
No external account. Generate strong random values (`openssl rand -hex 32`),
store in Render env, never commit.

| Var | Purpose |
|---|---|
| `SUPER_ADMIN_JWT_SECRET` | signs admin-panel JWTs |
| `OAUTH_STATE_SECRET` | signs Google OAuth state param (login CSRF guard) |
| `GOOGLE_TOKEN_KEY` | 32-byte key encrypting stored Google refresh tokens |
| `KYC_ENCRYPTION_KEY` | encrypts host KYC documents at rest |
| `METRICS_TOKEN`, `INGEST_TOKEN` | protect internal metrics/ingest endpoints |
| `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_OTP_EMAIL` | superadmin login (separate door, never phone OTP) |
| `PITCH_DECK_PASSCODE` | investor deck gate (optional; unset = gate closed) |

### B. Supabase — new project (free tier, or ~$25/mo prod)
Create a fresh project, then **run every migration v1.1 → v3.139 plus the seed
scripts** (`seedServiceCategories.js`, `seedEmailTemplates.js`, etc.) or the app
breaks. This is the biggest setup task after accounts.

| Var | Where |
|---|---|
| `SUPABASE_URL` | Project settings → API |
| `SUPABASE_ANON_KEY` | public-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET — full DB access |
| `SUPABASE_JWT_SECRET` | Project settings → API → JWT |

Also create Storage buckets: `images` (public), `kyc` (private).

### C. Google Cloud — new OAuth app (free)
Host login is **Google-only**, so this is effectively required. Create OAuth
client, enable Google Calendar API, set authorized redirect URI.

| Var | Note |
|---|---|
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | SECRET |
| `GOOGLE_REDIRECT_URI` | `https://api.<domain>/api/auth/google/callback` |

### D. Payments — Razorpay (see critical path)
| Var | Note |
|---|---|
| `RAZORPAY_KEY_ID` | env is fallback; admin DB config preferred |
| `RAZORPAY_KEY_SECRET` | SECRET |
| `RAZORPAY_WEBHOOK_SECRET` | SECRET — verifies `payment.captured`; **no fallback** |

### E. Email
Transactional (OTP, booking confirmations) + bulk (CRM/marketing). PaaS hosts
block outbound SMTP ports, so marketing goes over HTTPS APIs (Brevo/Resend).

| Var | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | primary transactional email |
| `BREVO_API_KEY`, `BREVO_FROM` | bulk/marketing + CRM outbound (keeps off transactional quota) |
| `RESEND_API_KEY`, `RESEND_FROM` | outreach provider (free tier 100/day) |
| `RESEND_WEBHOOK_SECRET` | verifies Resend delivery/bounce webhooks |
| `ADMIN_ALERT_EMAIL`, `SUPPORT_DIGEST_EMAIL` | internal notifications |

Domain must pass **SPF/DKIM** in the sending provider or mail lands in spam.

### F. AI features — pay-per-use, instant keys
| Var | Purpose | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI bot (Bolt), listing generation | usage-based; budget ~$20–50 to start |
| `VOYAGE_API_KEY` | embeddings / semantic search | free tier, then usage |
| `BOLT_LISTING_MODEL` | model-name string, no account | — |
| `BOT_PILLS_ENABLED`, `BOT_ROAST_ENABLED` | feature flags (`true`/`false`) | — |

### G. Marketing / analytics — free tiers, for "market the project"
| Var | Platform |
|---|---|
| `FB_APP_SECRET`, `FB_CAPI_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`, `FB_PIXEL_ID`, `FB_WEBHOOK_VERIFY_TOKEN` | Meta (ads pixel + Conversions API) |
| `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` | Google Analytics 4 |
| `GSC_PROPERTY`, `GSC_SA_KEY` | Google Search Console (SEO) |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_TOKEN` | product analytics |
| `PRERENDER_BUILD_TOKEN` | prerender/SEO build |

### H. Infra
| Var | Note |
|---|---|
| `NODE_ENV` | `production` on Render |
| `NODE_VERSION` | match original (check `package.json` engines) |
| `CLIENT_URL` | canonical frontend origin — **locks CORS**, missing = open CORS |
| `CLIENT_URLS` | extra origins (e.g. Vercel alias), comma-separated |
| `API_URL` | `https://api.<domain>` |
| `REDIS_URL` | caching / rate-limit store (Render or Upstash free tier) |
| `SENTRY_DSN` | error monitoring (free tier) |
| `CLIENT_IP_HEADER`, `IP_BLOCK_ENABLED`, `IP_BLOCK_CACHE_REFRESH_MS` | abuse controls |

### I. Scheduler / tuning knobs — have code defaults, set only to override
`SCHEDULER_TICK_MIN`, `AUTO_COMPLETE_INTERVAL_MIN`, `BADGE_EVAL_INTERVAL_MIN`,
`BOOKING_RECONCILE_INTERVAL_MIN`, `CONFIRMATION_RECONCILE_INTERVAL_MIN`,
`PAYOUT_RECONCILE_INTERVAL_MIN`, `LEDGER_RECONCILE_INTERVAL_MIN`,
`SUBSCRIPTION_RECONCILE_INTERVAL_MIN`, `PENDING_BOOKING_HOLD_MIN`,
`PENDING_REAP_INTERVAL_MIN`, `FOLLOWUP_INTERVAL_MIN`, `SEO_CRAWL_INTERVAL_MIN`,
`GSC_SYNC_INTERVAL_MIN`, `CRM_*_INTERVAL_MIN`, `CRM_SECOND_TOUCH_DRY_RUN`,
`COLD_*` (send window + bounce breaker), `RESEND_DAILY_CAP`, `PERF_LOG`,
`OPEN_ACCESS_UNTIL`.

> Leave at defaults for launch. `CRM_SECOND_TOUCH_DRY_RUN=true` and a low
> `COLD_DAILY_MAX` (~20, ramp up over week 1) are safe starting points so
> outreach doesn't torch sender reputation on a cold list.

---

## 2. Boot-blocking vs degrading (from validateEnv.js)

**CRITICAL — prod refuses to boot if missing (7):**
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`,
`SUPER_ADMIN_JWT_SECRET`, `OAUTH_STATE_SECRET`, `GOOGLE_TOKEN_KEY`, `CLIENT_URL`.

**RECOMMENDED — boots, but feature dead if missing:**
`SUPABASE_JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`,
`SMTP_HOST/USER/PASS`, `ADMIN_ALERT_EMAIL`, `RAZORPAY_KEY_ID/SECRET`,
`PITCH_DECK_PASSCODE/EXPIRES_AT`.

Everything else degrades gracefully (code/schema fallbacks) — the clone runs
without it, but a marketed, full-feature product needs the lot.

---

## 3. Rough cost to run

| Item | Cost |
|---|---|
| Domain | ~₹1,000/yr |
| Supabase (prod) | ~$25/mo |
| Render (web service) | ~$7–25/mo |
| Redis / Sentry / Brevo / PostHog / analytics | free tiers |
| Anthropic + Voyage (AI) | usage-based; budget $20–50/mo to start |

**≈ $60–100/mo + AI usage** at launch scale.

---

## 4. Launch order (condensed)

1. **Day 0:** start Razorpay KYC, buy domain, point DNS.
2. Create Supabase project → run all migrations + seeds → create buckets.
3. Generate group-A secrets.
4. Set up Google OAuth, SMTP + domain SPF/DKIM, AI keys.
5. Fill Render env from this doc; `NODE_ENV=production`.
6. Deploy. `validateEnv` aborts loudly if any CRITICAL var is blank — fix and redeploy.
7. Smoke-test: guest OTP login, host Google login, book + pay (Razorpay test mode first), AI bot reply.
8. When Razorpay KYC clears, flip to live keys.
9. Marketing stack (Meta/GA4/GSC/PostHog) + CRM — turn on after core flows verified.

---

*Keep this in sync with `server/env.staging.example` and `validateEnv.js` when
vars are added or retired.*
