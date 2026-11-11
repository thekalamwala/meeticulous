# 03 — API Security Inventory

Endpoint inventory with **authentication**, **authorization (role/permission/ownership)**, and **rate-limit** coverage. Global on all `/api`: `apiLimiter` 100/min/IP (skips only GET SEO reads) + `speedLimiter` (ramp past 300/15min) + helmet + hpp + body sanitizer + suspicious-request blocker + ipGuard auto-ban. `trust proxy: 1`. Mounts: `server/server.js:142-216`.

> Legend — Auth: **public** / **optional** (`optionalProtect`) / **protect** (Supabase JWT) / **host** (`protect`+`requireHost`) / **admin** (`requireAdmin(perm)`) / **super** (`requireSuperAdmin`) / **token** (signed/shared secret) / **sig** (webhook signature). Ownership = per-row check in controller.

## Auth & account — `/api/auth` (authController)
| Route | Auth | AuthZ | Limiter |
|---|---|---|---|
| POST /register/vendor, /register/user | public | email-unique (409) | authLimiter |
| POST /login, /login-unified, /login-phone | public | per-account lockout, timing-equalized | authLimiter |
| POST /send-otp, /verify-otp, /verify-otp-login | public | otpStore caps; superadmin barred from phone OTP | otpLimiter + otpContactLimiter |
| POST /forgot-password, /reset-password | public | generic response (no enum); reset lockout | otpLimiter / authLimiter |
| GET /google, /google/vendor, /google/callback | public | signed `state` (CSRF); identity from Google only | authLimiter |
| POST /linkedin/host, /linkedin/verify | protect | identity from Supabase only; superadmin barred | — |
| GET /me, PUT /me | protect | own row; `updateMe` allowlist (no role/plan) | — |
| POST /become-host, /cancel-hosting, /set-password | protect | own row; cancel only if onboarding incomplete | — |

## Bookings — `/api/bookings` (bookingController)
| Route | Auth | AuthZ | Limiter |
|---|---|---|---|
| POST / (create) | optional | host_id from service; guest_id from auth; anon needs OTP grant | bookingLimiter + bookingContactLimiter |
| GET /host, /guest | protect | `.eq(host_id/guest_id, req.user.id)`; paid-only for host | — · **F-01: wildcard profile join** |
| GET /service/:id, /slots | public | active services only | slotsLimiter (slots) |
| POST /:id/cancel, /complete, /no-show, /guest-confirm, /guest-problem | protect | 403 unless host/guest of booking + state machine | — |
| PUT /:id/reschedule, GET /:id/confirm-reschedule | protect / token | host/guest check; 192-bit ack token | — |

## Payments — `/api/payment` (paymentController)
| Route | Auth | AuthZ | Limiter |
|---|---|---|---|
| POST /create-order | public* | email==booking.guest_email (F-13: add optionalProtect) | paymentLimiter |
| POST /verify | public | HMAC sig + order-id match + amount re-bind (unforgeable) | paymentLimiter |
| POST /subscribe, /verify-subscription | protect | order notes.vendor_id+plan re-check; idempotent | paymentLimiter |
| POST /subscription/create, /sync, /cancel | protect | own `req.user.id`; mandate idempotency | paymentLimiter |
| POST /create-product-order, /verify-product | public | OTP-gated; order notes product+amount re-check | paymentLimiter |
| POST /webhook | **sig** | Razorpay HMAC-SHA256 (timingSafeEqual) before any write | raw-body 1mb |

## Host / services / products
| Route group | Auth | AuthZ | Limiter |
|---|---|---|---|
| `/api/host/*` (profile, availability, categories, services, documents) | host | `.eq(id/host_id, req.user.id)`; allowlisted writes | — |
| `/api/services/*` (CRUD/toggle/duplicate) | host | every query `.eq(host_id, req.user.id)` | — |
| `GET /api/host/:username`, `/:username/:slug` | public | explicit column allowlist (no PII) | SEO-exempt from apiLimiter |
| `/api/products/*` (CRUD) | host | `.eq(host_id, req.user.id)` (F-17 price unclamped) | — |
| GET /products/download/:token | public | token + paid + expiry + ≤3 count | downloadTokenLimiter |
| POST /products/free-download, /resend-link | public | OTP-gated (F-16 recipient) | freeDownloadLimiter + freeDownloadIpLimiter |

## Uploads / KYC — `/api/upload`, `/api/kyc`
| Route | Auth | AuthZ | Controls |
|---|---|---|---|
| POST /upload/image | protect (host/admin/community) | per-account key | magic-byte JPG/PNG/WEBP, 5MB, public `images` |
| POST /upload/product-file | protect (host/admin) | per-account | ext+magic-byte, 5MB, **private** `products` |
| POST /kyc/upload, /kyc/submit | host | key must be `${req.user.id}/…` | magic-byte img+PDF, private `kyc` |

## Admin — `/api/admin*` + `/api/admin-auth` (adminLimiter 300/min per-admin)
Full route→guard map in the admin-RBAC section of this audit. Representative:
| Route | Guard |
|---|---|
| POST /admin-auth/login, /2fa-* | public (bcrypt + lockout + **mandatory TOTP**) |
| GET/PUT/DELETE /admin/users* | `users.view/edit/delete` |
| GET/PUT /admin/bookings*, /services* | `bookings.*` / `services.*` |
| PATCH /admin/kyc/:id, /host360/:id/documents/reveal | `kyc.decide` (+ audit row before response) |
| **PATCH /admin/features/:key, POST /features** | `settings.manage` ← **F-03 (should be super)** |
| **GET/PUT /admin/settings/payment/razorpay** | `settings.manage` ← **F-03 (gateway secret)** |
| POST /admin/upload/image | `requireAdmin()` any-admin ← **F-14** |
| /admin/staff*, /admin/gifts*, /admin/security/* | **requireSuperAdmin** (correct) |
| /admin/payouts/:id/(approve/reject/pay) | `payouts.approve` / `payouts.release` |
| /admin/finance/* writes | `finance.manage` |

## Public / machine endpoints
| Route | Auth | Limiter / gate |
|---|---|---|
| POST /contact, /enterprise-lead, /demo-lead*, /events/intent | public | newsletter/otp limiters ✔ |
| POST /explore/click | public | **NONE — F-04** |
| POST /invite/:slug/visit | public | global only (dedupe-mitigated) |
| GET /explore (search) | public | searchLimiter |
| POST /bot/ask* | public | botLimiter + botGlobalLimiter |
| GET /prerender/* | public | **no limiter — F-19** (not SSRF) |
| GET /api/username/resolve/:slug | public | none (enum, public-by-design F-20) |
| POST /webhooks/resend, /meta-leadgen, /github | **sig** | HMAC verified before write ✔ |
| POST /webhooks/brevo/inbound, /notifications/aisensy | **token** | secret (header ✔ / `?secret=` fallback F-22) |
| POST /ingest/:provider | **token** | `x-ingest-token` constant-time, fail-closed ✔ |
| GET /agents/reports/* | **token** | `x-agent-token` sha256+timingSafeEqual, fail-closed ✔ (best-in-class) |
| GET /metrics | **token** | `METRICS_TOKEN` (F-11 `!==`); fail-closed 404 when unset |
| GET /health, /ready, /status | public | bypass rate limiter (probes) |

## Coverage verdict
- **AuthN present** on every protected route; mixed endpoints use `optionalProtect` deliberately. Only gap: `create-order` (F-13).
- **AuthZ present** on every admin route; ownership enforced on every user-facing mutate/read (no IDOR). One over-broad *read* join (F-01). One over-permissive admin-upload (F-14) + two sensitive controls under a grantable permission (F-03).
- **Rate-limit coverage** strong (per-IP **and** per-contact pairs close the IP-rotation / email-rotation bypasses). Gaps: `explore_clicks` (F-04), `prerender` (F-19). **All of this keys on client IP → see F-07 (proxy-addr) which can forge it.**
- **Webhooks:** all 6 signature/secret-verified before write, fail-closed.
