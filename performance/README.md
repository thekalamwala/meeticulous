# Performance Testing — Meeticulous

JMeter load-testing harness. Test plans in `jmeter/test-plans/`, driven by a Node wrapper (`scripts/run.js`) + `perf:*` npm scripts. Design: `../docs/superpowers/specs/2026-06-18-jmeter-performance-testing-design.md`.

## 1. Install JMeter + Java (one-time, no admin)
Portable JDK 21 + JMeter 5.6.3 under `~/perf-tools` (PowerShell):
```powershell
$ProgressPreference='SilentlyContinue'; $t="$HOME\perf-tools"; New-Item -ItemType Directory -Force $t | Out-Null
Invoke-WebRequest "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse" -OutFile "$t\jdk.zip"
Invoke-WebRequest "https://dlcdn.apache.org/jmeter/binaries/apache-jmeter-5.6.3.zip" -OutFile "$t\jmeter.zip"
Expand-Archive "$t\jdk.zip" "$t\jdk" -Force; Expand-Archive "$t\jmeter.zip" "$t\jmeter" -Force
```
`run.js` auto-discovers them under `~/perf-tools`, or set `$JAVA_HOME` / `$JMETER_HOME`.

## 2. Boot the server in LOAD_TEST_MODE
`LOAD_TEST_MODE=true` stubs notifications/SMTP/calendar-writes, bypasses rate limiters, fixes OTP to `000000`, and bypasses the Razorpay signature check. **It is fail-safe OFF when `NODE_ENV=production` — never enable in prod.** Port 5599 avoids colliding with a normal dev server on 5000:
```bash
cd server && PORT=5599 LOAD_TEST_MODE=true NODE_ENV=development node server.js
```
`config/local.properties` already points JMeter at `localhost:5599`.

## 3. Seed test data
```bash
node server/scripts/seedLoadTest.js        # 2 tagged vendors + 4 services
node server/scripts/exportLoadTestData.js  # writes jmeter/data/{vendors,services,guests}.csv
node server/scripts/cleanupLoadTest.js     # remove all tagged test data
```
**Run `cleanup → seed → export` before a fresh booking run** — booking slots are unique per run, so leftover bookings cause `409` slot collisions. All three scripts refuse to run with `NODE_ENV=production`.

## 4. Run load tests
```bash
cd performance
npm run perf:smoke                      # slots-readonly, 10 users / 60s
npm run perf:smoke -- booking-flow      # run any plan
npm run perf:normal                     # 100 users
npm run perf:report                     # regenerate HTML from the latest .jtl
```
Scenarios: `smoke`(10u) `normal`(100u) `launch`(500u) `spike`(1000u). HTML dashboards land in `jmeter/reports/`, raw results in `jmeter/results/` (both gitignored).

Vendor flow needs a minted token:
```bash
VENDOR_TOKEN=$(node ../server/scripts/mintVendorToken.js) npm run perf:smoke -- vendor-flow
```

## Plans
| Plan | What it exercises | Auth |
|---|---|---|
| `slots-readonly` | service detail + available-slots + host profile (high-RPS public reads) | none |
| `auth-flow` | send-otp → verify-otp (OTP hot path) | none |
| `vendor-flow` | bookings/host + auth/me (authed dashboard) | vendor token |
| `booking-flow` | POST /bookings (unique future slot per iteration) | optional |
| `full-journey` | service → slots → otp → verify → book (with think-time) | optional |
| `freebusy-cache` | repeated available-slots — cache cold/warm (needs Google-connected vendor; see the plan's header comment) | none |

## Staging
Set `config/staging.properties` `base.host` to your staging API host, then `npm run perf:staging`. The staging server must also run with `LOAD_TEST_MODE=true` (never prod).

## Gotchas (learned the hard way)
- **Always run via `-q` property files** (run.js does). Do NOT pass `-Jbase.port=...` on the PowerShell command line — PowerShell mangles dotted `-J` property names, silently sending traffic to the default port (5000).
- `${__P(...)}` does **not** resolve in the HTTP-Request-Defaults `port` field — host/port are funnelled through Test-Plan **User Defined Variables** instead.
- The token property is `vendortoken` (no dot) for the same `-J` reason.
- Latency SLAs are checked **post-run from the `.jtl` stats** (Plan C), not via in-plan Duration Assertions (which would flap on localhost→Supabase round-trips).

## Caveat
Localhost ≠ prod — one machine generating *and* serving load measures the machine, and every request still hits the real (Tokyo-region) Supabase. Numbers are a relative baseline + regression guard. The 500u/1000u scenarios are authored but not meant for localhost. See the design spec + Plan C.
