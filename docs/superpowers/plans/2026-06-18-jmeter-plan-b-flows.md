# JMeter Plan B — Setup + Flow Automation Implementation Plan

> **For agentic workers:** Continuation of Plan A (`feat/jmeter-performance-testing`). Validation here is **run-based** (boot the local server with `LOAD_TEST_MODE`, run each `.jmx` headless, confirm 2xx + assertions), not unit-TDD — except the one server seam (Razorpay verify bypass), which is TDD. Steps use checkbox syntax.

**Goal:** Install Apache JMeter + Java, build the reusable JMeter framework (property-driven base, JWT/CSV/assertions/timers), and author the real-world flow `.jmx` files, all validated against the local server.

**Architecture:** Portable JDK + JMeter under `C:\Users\shubh\perf-tools` (no admin). A Node wrapper (`performance/scripts/run.js`) invokes `jmeter -n` with environment + scenario properties. Every plan reads host/port + thread counts from JMeter `__P` properties so one `.jmx` serves every scenario/environment. Flows consume the CSV datasets produced by Plan A's `exportLoadTestData.js`.

**Tech Stack:** Apache JMeter 5.6.3, Temurin JDK 21, Node wrapper, Express server under test (booted with `LOAD_TEST_MODE=true`).

**Builds on Plan A:** the `LOAD_TEST_MODE` flag, seam stubs, seeded vendors (`loadtest-vendor-rules` / `-gcal`), and `performance/jmeter/data/*.csv`.

---

## Auth reality (drives flow design)
- **Guest** auth is fully headless: `POST /auth/send-otp` → `POST /auth/verify-otp` (OTP is `000000` under `LOAD_TEST_MODE`) → response carries the Supabase JWT. Extract + reuse.
- **Vendor** auth is Google-only at the app layer (no password login route). BUT the seeded vendors have a Supabase password (`LoadTest!2026`, set by `auth.admin.createUser`). So a small script mints a vendor token via Supabase `signInWithPassword` on a **disposable client** (never the shared admin — see the signin-poisoning rule), fed to `vendor-flow` as a JMeter property.
- **Booking** primary path = FREE service (no Razorpay). PAID path (`create-order` → `verify`) is secondary, gated on Razorpay test keys + the new verify bypass.

---

### Task 1: Verify the JMeter + Java install
**Files:** none (tooling under `C:\Users\shubh\perf-tools`)

- [ ] Confirm the background install finished: `perf-tools\jdk\<dir>\bin\java.exe -version` prints 21, and `perf-tools\jmeter\apache-jmeter-5.6.3\bin\jmeter.bat -v` prints the version. Record `JAVA_HOME` + `JMETER_HOME` paths.
- [ ] If JMeter can't find Java, the run wrapper (Task 6) sets `JAVA_HOME` explicitly.

### Task 2: Directory, base config, gitignore
**Files:**
- Create: `performance/jmeter/config/base.properties`, `local.properties`, `staging.properties`
- Create: `performance/.gitignore`

- [ ] `base.properties` — defaults read by every plan:
```properties
base.protocol=http
base.host=localhost
base.port=5000
# scenario knobs (overridden per run)
threads=10
rampup=30
duration=60
# vendor token (minted by Task 5 script; empty → vendor-flow skipped)
vendor.token=
```
- [ ] `local.properties` (host/port localhost), `staging.properties` (`base.host=${__P(STAGING_API_URL)}` placeholder).
- [ ] `performance/.gitignore`:
```
jmeter/results/
jmeter/reports/
```

### Task 3: Reusable JWT login fragment + HTTP defaults
**Files:**
- Create: `performance/jmeter/fragments/login-jwt.jmx` (Test Fragment + Module/Include target)

- [ ] Fragment = HTTP Request Defaults (protocol/host/port from `${__P}`) + Header Manager (`Content-Type: application/json`) + a guest-login sampler chain: `POST /api/auth/send-otp` then `POST /api/auth/verify-otp` with a JSON Extractor saving `JWT_TOKEN` (and `guest_id`). Reused via Include Controller.
- [ ] Validate the fragment XML loads in JMeter GUI-less (`jmeter -n -t fragment-smoke.jmx` wrapper) — fix until it parses.

### Task 4: `slots-readonly.jmx` (simplest, validate the harness)
**Files:** Create `performance/jmeter/test-plans/slots-readonly.jmx`
- [ ] Thread Group (`${__P(threads)}` / `${__P(rampup)}` / `${__P(duration)}`), CSV Data Set on `services.csv` + `vendors.csv`. Samplers: `GET /api/bookings/service/${service_id}`, `GET /api/bookings/available-slots?serviceId=${service_id}&date=<tomorrow>`, `GET /api/host/${username}` (profile), `GET /api/services`. Response Assertion (2xx) + Duration Assertion (300 ms) per sampler. Gaussian timer.
- [ ] **Validate:** boot server (Task 10), run `jmeter -n -t slots-readonly.jmx -Jthreads=5 -l results.jtl`; confirm 0 errors. This proves the whole harness end-to-end.

### Task 5: Vendor token minting script + `vendor-flow.jmx`
**Files:**
- Create: `server/scripts/mintVendorToken.js`
- Create: `performance/jmeter/test-plans/vendor-flow.jmx`

- [ ] `mintVendorToken.js` — `assertNotProd()`; sign in `loadtest-vendor-rules@loadtest.meeticulous.local` / `LOADTEST_VENDOR_PASSWORD` via the config disposable-client `signInWithPassword` helper; print the `access_token`. (run.js captures it into `-Jvendor.token=`.)
- [ ] `vendor-flow.jmx` — Header Manager `Authorization: Bearer ${__P(vendor.token)}`; samplers `GET /api/bookings/host`, `GET /api/host/profile` (or dashboard stats). If `vendor.token` empty → thread group disabled (logged).
- [ ] **Validate:** mint token, run headless, confirm 2xx.

### Task 6: Run wrapper + CLI scripts
**Files:**
- Create: `performance/scripts/run.js`, `performance/package.json`

- [ ] `run.js` — resolves `JAVA_HOME`/`JMETER_HOME` (env or `C:\Users\shubh\perf-tools` default), maps scenario name → `-Jthreads/-Jrampup/-Jduration`, env name → `-q config/<env>.properties`, runs `jmeter -n -t <plan> -l results/<ts>.jtl -e -o reports/<ts>`. Cross-platform (spawns `jmeter.bat` on win).
- [ ] `package.json` scripts: `perf:local`, `perf:staging`, `perf:smoke`, `perf:normal`, `perf:launch`, `perf:spike`, `perf:report`.
- [ ] **Validate:** `npm run perf:smoke` drives `slots-readonly` end-to-end and emits an HTML report.

### Task 7: `auth-flow.jmx`
**Files:** Create `performance/jmeter/test-plans/auth-flow.jmx`
- [ ] Include the `login-jwt` fragment (send-otp → verify-otp → extract `JWT_TOKEN`) then `GET /api/auth/me` with the bearer header. CSV `guests.csv` for unique emails (avoids OTP rate-limit reuse — though limiters are bypassed in load mode, unique emails keep data clean). Assertions 2xx + JWT non-empty.
- [ ] **Validate** headless.

### Task 8: Server Razorpay verify bypass (TDD) + `booking-flow.jmx`
**Files:**
- Modify: `server/controllers/paymentController.js` (`verifyPayment` signature/fetch bypass under load mode)
- Test: `server/tests/unit/verifyPaymentLoadStub.test.js`
- Create: `performance/jmeter/test-plans/booking-flow.jmx`

- [ ] **TDD:** test that `verifyPayment` skips the signature rejection + payment fetch when `isLoadTestMode()` (extract a small `signatureGateOpen()`-style predicate or test via the controller with mocked supabase, following existing `verifySubscription.test.js` mock pattern). Red → implement guard (`if (!isLoadTestMode() && !verifySignature(...)) return 400` + skip `payments.fetch`) → green.
- [ ] `booking-flow.jmx` — primary: FREE service path (`POST /api/bookings` with `service_id` = `loadtest-rules-free`, guest from CSV) → assert booking created. Secondary thread (gated `-Jpaid=true`): `POST /api/payment/create-order` → `POST /api/payment/verify` (synthetic ids; bypass accepts).
- [ ] **Validate** the free path headless (0 errors); run the full suite to confirm the seam change is green + zero-regression.

### Task 9: `freebusy-cache.jmx` + `full-journey.jmx`
**Files:** Create both under `performance/jmeter/test-plans/`
- [ ] `freebusy-cache.jmx` — repeated `available-slots` against `loadtest-vendor-gcal`; **disabled with a logged skip when `TEST_VENDOR_GOOGLE_REFRESH_TOKEN` unset** (vendor has no Google → FreeBusy not exercised). Captures cold-vs-warm latency when enabled.
- [ ] `full-journey.jmx` — composes login fragment + slots + free booking with Gaussian think-time (realistic guest journey).
- [ ] **Validate** both (freebusy logs skip; journey 0 errors).

### Task 10: Local server boot helper + README
**Files:**
- Create: `performance/README.md`
- (Server boot: `cd server && cross-env LOAD_TEST_MODE=true NODE_ENV=development node server.js` — document; no new file unless a helper is handy.)

- [ ] `README.md` — install (portable zips), seed (`node server/scripts/seedLoadTest.js` + `exportLoadTestData.js`), boot server with `LOAD_TEST_MODE=true`, run via `npm run perf:*`, where reports land, the staging/`STAGING_API_URL` path, and the FreeBusy-token caveat.
- [ ] **Final validation:** with the server booted under `LOAD_TEST_MODE`, run every plan headless via the CLI; confirm 0 assertion failures across the framework. Commit.

---

## Notes
- This branch already carries Plan A (PR #47 was closed/deferred, not merged) → a future PR from `feat/jmeter-performance-testing` lands A + B together.
- Heavy scenarios (C 500u / D 1000u) are authored as property overrides but **not run on localhost** (Plan C decides where).
- Tooling binaries live OUTSIDE the repo (`C:\Users\shubh\perf-tools`) — never committed.
