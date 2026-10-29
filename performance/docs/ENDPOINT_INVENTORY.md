# Endpoint Inventory — Book A Sloth

Hot + auth-relevant endpoints for load testing. Source: Express route map (June 2026).

**Auth legend:** Public = no token · JWT = Supabase `protect` (verifies via `supabaseAdmin.auth.getUser`) · opt = `optionalProtect` · admin = admin JWT (`requireAdmin`).

| Endpoint | Method | Auth | Rate limit | External calls | Expected load | Priority |
|---|---|---|---|---|---|---|
| /api/bookings/available-slots | GET | Public | slots 40/5min | 3 Supabase + Google FreeBusy (cached 60s) | Very High | Critical |
| /api/bookings | POST | opt | booking 15/60min | 4-5 Supabase + Google createEvent (free+online) | High | Critical |
| /api/payment/create-order | POST | Public | payment 20/60min | 3-4 Supabase + Razorpay + FreeBusy re-validate | Medium | Critical |
| /api/payment/verify | POST | Public | payment 20/60min | 5-6 Supabase + Razorpay + Google createEvent | Medium | Critical |
| /api/auth/send-otp | POST | Public | otp 5/60min | 1-2 Supabase + (notify deferred) | Medium | High |
| /api/auth/verify-otp | POST | Public | otp 5/60min | Supabase auth + profile | Medium | High |
| /api/auth/login | POST | Public | auth 10/15min | Supabase Auth signInWithPassword | Medium | High |
| /api/auth/me | GET | JWT | apiLimiter | getUser (~175ms) + profile | High | High |
| /api/bookings/service/:id | GET | Public | apiLimiter | 1 Supabase | High | High |
| /api/host/:username (profile) | GET | Public | apiLimiter | 3-4 Supabase | High | High |
| /api/services | GET | Public | apiLimiter | 1-2 Supabase | High | Medium |
| /api/bookings/host | GET | JWT | apiLimiter | getUser + bookings list | Medium | High |
| /api/admin/bookings | GET | admin | admin 30/min | 1-2 Supabase (paginated) | Low | Medium |

**Global limiters:** apiLimiter 100/min/IP, speedLimiter ramps past 300 req/15min (max 2s delay). All keyed by IP.

See `PERFORMANCE_AUDIT.md` for the architecture analysis behind these numbers and `LOAD_TEST_STRATEGY.md` for how each is exercised.
