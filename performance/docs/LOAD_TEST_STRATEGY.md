# Load Test Strategy — Meeticulous

_2026-06-18. Companions: `ENDPOINT_INVENTORY.md`, `PERFORMANCE_AUDIT.md`. Full design: `docs/superpowers/specs/2026-06-18-jmeter-performance-testing-design.md`._

## Targets (prod-intent SLAs)
| Class | P95 | Error rate |
|---|---|---|
| Public reads (slots, listing, profile) | < 300 ms | < 1% |
| Auth (login, verify-otp) | < 400 ms | < 1% |
| Booking create | < 500 ms | < 1% |
| Payment verify | < 800 ms (Razorpay-bound) | < 1% |

Concurrency goal: demonstrate the path to 500+ concurrent. Actual prod capacity = a Render/Supabase sizing exercise, not a localhost number.

## Scenarios
| Scenario | Threads | Ramp | Hold | Run on localhost? |
|---|---|---|---|---|
| A — Smoke | 10 | 30 s | 60 s | Yes (real) |
| B — Normal | 100 | 5 min | 5 min | Yes (real) |
| C — Launch day | 500 | 20 min | 10 min | Authored, not run |
| D — Viral spike | 1000+ | step-to-failure | — | Authored, not run |

All four are the same `.jmx` files driven by JMeter `__P` property overrides.

## Tiered external stubbing (`LOAD_TEST_MODE`)
Stub only irreversible / costly / spammy side-effects; keep latency real where safe.

| External | Load-mode behavior |
|---|---|
| Email / WhatsApp / OTP send (notificationEngine) | stubbed (no provider, no spam) |
| SMTP (sendEmail) | stubbed |
| OTP code (otpStore.generate) | fixed `000000` |
| Google createEvent (write) | stubbed (synthetic id) |
| Google FreeBusy (read) | **REAL** — so the cache is measurable |
| Razorpay order create | real test-keys (real latency, no money) |
| Razorpay verify signature | bypassed — JMeter can't checkout (*deferred to Plan B*) |
| Supabase | never stubbed |
| Rate limiters | bypassed (single-IP would 429 instantly) |

Off by default; fail-safe to OFF when `NODE_ENV=production`.

## Safety
- Test data tagged by guest email domain `@loadtest.meeticulous.local` + vendor usernames `loadtest-*`. No schema change.
- Seed/cleanup scripts refuse to run when `NODE_ENV=production`.
- FreeBusy cache-effectiveness plan needs a Google-connected test vendor (`TEST_VENDOR_GOOGLE_REFRESH_TOKEN`); absent → that plan is skipped, never faked.

## Caveat
Localhost ≠ prod. A single machine generating + serving load measures the machine. Numbers are a relative baseline + regression guard. Render Starter (0.5 vCPU / 512 MB) and Supabase pooler limits cap far lower — see scaling recommendations (Plan C).
