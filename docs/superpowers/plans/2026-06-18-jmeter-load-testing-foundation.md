# JMeter Load-Testing Foundation (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase-1 audit docs and the production-safe server foundation (`LOAD_TEST_MODE` flag + guarded seams + seed/cleanup scripts) that every later JMeter phase depends on.

**Architecture:** One config module (`config/loadTestMode.js`) is the single source of truth, fail-safe to OFF in production. Six existing seams gain a top-of-function guard that is a pure no-op when the flag is off (zero regression), and stub external side-effects (notifications, SMTP, OTP code, calendar writes) or bypass single-IP rate limiters when on. Google FreeBusy reads stay real (so the cache stays measurable). Idempotent seed/cleanup scripts create tagged, purgeable test data and refuse to run in production.

**Tech Stack:** Node.js, Express, Jest + supertest (existing), Supabase JS admin client, express-rate-limit / express-slow-down.

**Scope note:** This is Plan A of three. Plan B = JMeter setup + flows. Plan C = real load runs + benchmarks + CI/CD. The Razorpay `verifyPayment` signature bypass is deliberately deferred to Plan B (it pairs with the payment `.jmx` and its controller-mock test). The full design is in `docs/superpowers/specs/2026-06-18-jmeter-performance-testing-design.md`.

**Conventions:** All tests live in `server/tests/unit/`. Run from `server/`. Each test sets `process.env.NODE_ENV` and `process.env.LOAD_TEST_MODE` explicitly and restores `process.env` in `afterAll`, because `isLoadTestMode()` reads them live at call time.

---

### Task 1: Phase-1 audit documents

**Files:**
- Create: `performance/docs/ENDPOINT_INVENTORY.md`
- Create: `performance/docs/PERFORMANCE_AUDIT.md`
- Create: `performance/docs/LOAD_TEST_STRATEGY.md`

No code, no tests — these are analysis deliverables. Content is sourced from the design spec and the inventory below.

- [ ] **Step 1: Write `performance/docs/ENDPOINT_INVENTORY.md`**

Include this table verbatim plus a one-line intro and a "Auth legend" (Public / JWT = Supabase `protect` / optionalProtect / admin JWT):

```markdown
# Endpoint Inventory — Book A Sloth

Hot + auth-relevant endpoints for load testing. Auth: Public = no token; JWT = Supabase `protect`; opt = `optionalProtect`; admin = admin JWT.

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
```

- [ ] **Step 2: Write `performance/docs/PERFORMANCE_AUDIT.md`**

Cover these concrete findings (one short section each):
- **Single-process Node** — no clustering in `server.js`; one CPU core serves all traffic. Render Starter ≈ 0.5 vCPU.
- **Auth cost** — `middleware/authMiddleware.js` `protect` calls `supabaseAdmin.auth.getUser(token)` (~175ms measured) on every authed request; `/auth/me` fires on every client mount.
- **FreeBusy cache** — `services/availabilityService.js`, `google_freebusy_cache` table, TTL `FREEBUSY_CACHE_TTL_MS` default 60s; stale-on-Google-failure fallback (`unverified:true`). Cache hit ≈150-200ms vs miss ≈1-2.5s.
- **Deferred I/O** — `utils/background.js` `runInBackground` (setImmediate after `res.json`). Used by `createBooking` (confirmation emails) and `verifyPayment` (ledger, analytics, emails). Response returns before this work.
- **Rate limiting** — `middleware/security.js`; table of limiters (copy from ENDPOINT_INVENTORY). All per-IP → a single load generator is throttled without the `LOAD_TEST_MODE` bypass.
- **No app-level cache besides FreeBusy** — feature flags synced at boot; razorpay/notification config have 60s in-memory TTL caches.
- **External dependency latency budget** — Google FreeBusy 1-2s (cache-mitigated), Razorpay fetch 200-500ms, Supabase query ~50ms each, Supabase Auth 200-500ms.

- [ ] **Step 3: Write `performance/docs/LOAD_TEST_STRATEGY.md`**

Summarize from the spec: targets (public reads P95<300ms, booking<500ms, error<1%), the four scenarios (A 10u / B 100u / C 500u / D 1000u; A+B run on localhost, C+D authored only), tiered stubbing table, test-data tagging (`@loadtest.bookasloth.local`), and the "localhost ≠ prod" caveat. Link back to the design spec.

- [ ] **Step 4: Commit**

```bash
git add performance/docs/
git commit -m "docs(perf): Phase-1 audit, endpoint inventory, load-test strategy"
```

---

### Task 2: `loadTestMode` config module

**Files:**
- Create: `server/config/loadTestMode.js`
- Test: `server/tests/unit/loadTestMode.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/loadTestMode.test.js
const { isLoadTestMode } = require('../../config/loadTestMode');

describe('isLoadTestMode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('off when unset (dev)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    expect(isLoadTestMode()).toBe(false);
  });

  test('on when "true" and non-prod', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    expect(isLoadTestMode()).toBe(true);
  });

  test('OFF in production even when "true" (fail-safe)', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOAD_TEST_MODE = 'true';
    expect(isLoadTestMode()).toBe(false);
  });

  test('off when value is not exactly "true"', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = '1';
    expect(isLoadTestMode()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- loadTestMode` (from `server/`)
Expected: FAIL — `Cannot find module '../../config/loadTestMode'`.

- [ ] **Step 3: Write the implementation**

```js
// server/config/loadTestMode.js
'use strict';

/**
 * Single source of truth for load-test mode.
 * Fail-safe: the flag is NEVER trusted when NODE_ENV=production.
 * Read live at call time so tests and runtime can toggle env freely.
 */
function isLoadTestMode() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.LOAD_TEST_MODE === 'true') {
      console.warn('[loadTestMode] LOAD_TEST_MODE ignored: NODE_ENV=production');
    }
    return false;
  }
  return process.env.LOAD_TEST_MODE === 'true';
}

module.exports = { isLoadTestMode };
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- loadTestMode`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/config/loadTestMode.js server/tests/unit/loadTestMode.test.js
git commit -m "feat(perf): LOAD_TEST_MODE flag, fail-safe in production"
```

---

### Task 3: Rate-limiter bypass in load mode

**Files:**
- Modify: `server/middleware/security.js`
- Test: `server/tests/unit/rateLimitBypass.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/rateLimitBypass.test.js
const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

describe('rate-limit load-test bypass (skipWhenLoadTest)', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  const makeApp = () => {
    const { skipWhenLoadTest } = require('../../middleware/security');
    const app = express();
    app.use('/x', rateLimit({ windowMs: 60000, max: 1, skip: skipWhenLoadTest }),
      (req, res) => res.json({ ok: true }));
    return app;
  };

  test('limiter ACTIVE when flag off (2nd request 429)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    const app = makeApp();
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(429);
  });

  test('limiter BYPASSED when flag on (no 429)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const app = makeApp();
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- rateLimitBypass`
Expected: FAIL — `skipWhenLoadTest` is undefined (not exported yet).

- [ ] **Step 3: Add the import + shared skip fn near the top of `security.js`**

After the existing requires (after line 8, `const hpp = require('hpp');`), add:

```js
const { isLoadTestMode } = require('../config/loadTestMode');

// Load-test bypass: a single JMeter IP would trip every per-IP limiter
// instantly. Off by default (isLoadTestMode() is false) → every limiter
// behaves exactly as before. Never true in production (fail-safe).
const skipWhenLoadTest = () => isLoadTestMode();
```

- [ ] **Step 4: Add `skip: skipWhenLoadTest,` to every limiter**

Add the `skip` option to each of these config objects: `authLimiter`, `otpLimiter`, `apiLimiter`, `adminLimiter`, `paymentLimiter`, `slugLimiter`, `slotsLimiter`, `bookingLimiter`, `freeDownloadLimiter`, `freeDownloadIpLimiter` (all `rateLimit({...})`) and `speedLimiter` (`slowDown({...})`). Example for `authLimiter`:

```js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: false,
  skip: skipWhenLoadTest,
});
```

- [ ] **Step 5: Export `skipWhenLoadTest`**

In the `module.exports = { ... }` block, add `skipWhenLoadTest,` to the exported keys.

- [ ] **Step 6: Run test, verify it passes**

Run: `npm test -- rateLimitBypass`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add server/middleware/security.js server/tests/unit/rateLimitBypass.test.js
git commit -m "feat(perf): bypass rate limiters in LOAD_TEST_MODE (off by default)"
```

---

### Task 4: Notification + SMTP stubs

**Files:**
- Modify: `server/services/notificationEngine.js`
- Modify: `server/utils/sendEmail.js`
- Test: `server/tests/unit/notifyStub.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/notifyStub.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/aisensyService', () => ({ sendCampaign: jest.fn() }));
jest.mock('../../services/email/communicationEngine', () => ({ send: jest.fn() }));

const aisensy = require('../../services/aisensyService');
const comm = require('../../services/email/communicationEngine');
const engine = require('../../services/notificationEngine');

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: mockSendMail }) }));
const sendEmail = require('../../utils/sendEmail');

describe('notification + smtp stubs in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; jest.clearAllMocks(); });
  afterAll(() => { process.env = OLD; });

  test('engine short-circuits, no provider calls when load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const r = await engine.send({ event: 'BOOKING_OTP', data: { email: 'a@b.c', phone: '+910000000000', name: 'X' } });
    expect(r.email.stub).toBe(true);
    expect(r.whatsapp.stub).toBe(true);
    expect(aisensy.sendCampaign).not.toHaveBeenCalled();
    expect(comm.send).not.toHaveBeenCalled();
  });

  test('engine runs provider path when flag off', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    comm.send.mockResolvedValue({ ok: true, status: 'sent' });
    const r = await engine.send({ event: 'BOOKING_OTP', data: { email: 'a@b.c', name: 'X' } });
    expect(r.email.attempted).toBe(true);
    expect(comm.send).toHaveBeenCalled();
  });

  test('sendEmail does NOT hit SMTP in load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('sendEmail hits SMTP when flag off', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
    expect(mockSendMail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- notifyStub`
Expected: FAIL — first test sees `r.email.stub` undefined (no guard yet).

- [ ] **Step 3: Guard `notificationEngine.send`**

In `server/services/notificationEngine.js`, add the require near the top (after line 31, the `communicationEngine` require):

```js
const { isLoadTestMode } = require('../config/loadTestMode');
```

Then at the very start of the `send` function body (immediately after `const send = async ({ event, data = {} }) => {`), add:

```js
  if (isLoadTestMode()) {
    // Load test: never touch real providers. Shape mirrors the real return
    // so callers (notify.js reads .email.success / .whatsapp.success) work.
    return {
      event,
      whatsapp: { attempted: false, success: true, stub: true },
      email: { attempted: false, success: true, stub: true },
    };
  }
```

- [ ] **Step 4: Guard `sendEmail`**

In `server/utils/sendEmail.js`, add at the top (after the `nodemailer` require / before `transporter`):

```js
const { isLoadTestMode } = require('../config/loadTestMode');
```

Change the `sendEmail` function to short-circuit:

```js
const sendEmail = async ({ to, subject, html }) => {
  if (isLoadTestMode()) return; // no SMTP egress in load mode
  await transporter.sendMail({
    from: `"Book A Sloth" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm test -- notifyStub`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/services/notificationEngine.js server/utils/sendEmail.js server/tests/unit/notifyStub.test.js
git commit -m "feat(perf): stub notifications + SMTP in LOAD_TEST_MODE"
```

---

### Task 5: Deterministic OTP code in load mode

**Files:**
- Modify: `server/utils/otpStore.js`
- Test: `server/tests/unit/otpGenerateStub.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/otpGenerateStub.test.js
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
const otp = require('../../utils/otpStore');

describe('otpStore.generate in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('returns fixed "000000" in load mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    expect(otp.generate()).toBe('000000');
  });

  test('returns a random 6-digit code when flag off', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    expect(otp.generate()).toMatch(/^\d{6}$/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- otpGenerateStub`
Expected: FAIL — `generate()` returns a random code, not `'000000'`.

- [ ] **Step 3: Guard `generate`**

In `server/utils/otpStore.js`, add the require after line 18 (`const { supabaseAdmin } = require('../config/supabase');`):

```js
const { isLoadTestMode } = require('../config/loadTestMode');
```

Replace the `generate` function (line 32) with:

```js
/** Generate a 6-digit OTP (CSPRNG). Fixed in load mode for deterministic tests. */
const generate = () => (isLoadTestMode() ? '000000' : crypto.randomInt(100000, 1000000).toString());
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- otpGenerateStub`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/otpStore.js server/tests/unit/otpGenerateStub.test.js
git commit -m "feat(perf): deterministic OTP (000000) in LOAD_TEST_MODE"
```

---

### Task 6: Stub Google calendar WRITE, keep FreeBusy READ real

**Files:**
- Modify: `server/config/google.js`
- Test: `server/tests/unit/googleCalendarStub.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/googleCalendarStub.test.js
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} generateAuthUrl() { return ''; } async getToken() { return { tokens: {} }; } } },
    calendar: () => ({}), // no freebusy/events → real paths throw against this mock
  },
}));
const googleCfg = require('../../config/google');

describe('google calendar stubs in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('createCalendarEvent is stubbed (no API) in load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const r = await googleCfg.createCalendarEvent('a', 'b', { title: 'T', startTime: 'x', endTime: 'y' });
    expect(r.eventId).toContain('loadtest');
    expect(r.meetLink).toContain('loadtest');
  });

  test('getFreeBusy is NOT stubbed — still attempts the real path', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    // mock calendar() returns {} → .freebusy is undefined → throws. Proves no short-circuit.
    await expect(googleCfg.getFreeBusy('a', 'b', 't1', 't2')).rejects.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- googleCalendarStub`
Expected: FAIL — `createCalendarEvent` calls the mock and throws (no stub yet).

- [ ] **Step 3: Guard `createCalendarEvent` only**

In `server/config/google.js`, add the require after line 1 (`const { google } = require('googleapis');`):

```js
const { isLoadTestMode } = require('./loadTestMode');
```

At the start of `createCalendarEvent` (immediately after the function signature line, before `const auth = buildOAuthClient(...)`), add:

```js
  if (isLoadTestMode()) {
    // Load test: do NOT write to a real calendar. Synthetic, deterministic result.
    return {
      eventId: `loadtest-${eventDetails.title || 'event'}`,
      meetLink: 'https://meet.google.com/loadtest-aaa-bbb-ccc',
      htmlLink: 'https://calendar.google.com/loadtest',
    };
  }
```

Leave `getFreeBusy`, `updateCalendarEvent`, `getCalendarTimezone` unchanged (FreeBusy must stay real so the cache is measurable).

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- googleCalendarStub`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/config/google.js server/tests/unit/googleCalendarStub.test.js
git commit -m "feat(perf): stub Google calendar writes, keep FreeBusy real in load mode"
```

---

### Task 7: Production-refusal guard for scripts

**Files:**
- Create: `server/scripts/lib/guard.js`
- Test: `server/tests/unit/scriptGuard.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/scriptGuard.test.js
const { assertNotProd } = require('../../scripts/lib/guard');

describe('assertNotProd', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('exits(1) in production', () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    expect(() => assertNotProd('seed')).toThrow('exit');
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  test('does nothing in development', () => {
    process.env.NODE_ENV = 'development';
    const spy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNotProd('seed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- scriptGuard`
Expected: FAIL — `Cannot find module '../../scripts/lib/guard'`.

- [ ] **Step 3: Write the implementation**

```js
// server/scripts/lib/guard.js
'use strict';

/** Hard-refuse destructive/seed scripts in production. */
function assertNotProd(label = 'operation') {
  if (process.env.NODE_ENV === 'production') {
    console.error(`Refusing ${label}: NODE_ENV=production`);
    process.exit(1);
  }
}

module.exports = { assertNotProd };
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- scriptGuard`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/lib/guard.js server/tests/unit/scriptGuard.test.js
git commit -m "feat(perf): assertNotProd guard for load-test scripts"
```

---

### Task 8: Seed / cleanup / export scripts + env docs

**Files:**
- Create: `server/scripts/seedLoadTest.js`
- Create: `server/scripts/cleanupLoadTest.js`
- Create: `server/scripts/exportLoadTestData.js`
- Modify: `server/.env.example`

- [ ] **Step 1: Write `seedLoadTest.js`**

```js
// server/scripts/seedLoadTest.js
'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.bookasloth.local';
const PASSWORD = process.env.LOADTEST_VENDOR_PASSWORD || 'LoadTest!2026';
const VENDORS = [
  { key: 'rules', username: 'loadtest-vendor-rules', gcal: false },
  { key: 'gcal', username: 'loadtest-vendor-gcal', gcal: true },
];
const WEEK = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const wideOpen = () => Object.fromEntries(WEEK.map((d) => [d, [{ start: '09:00', end: '21:00' }]]));

async function ensureVendor(v) {
  const email = `${v.username}${TAG_DOMAIN}`;
  let userId;
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const found = (list.users || []).find((u) => u.email === email);
    if (!found) throw error;
    userId = found.id;
  } else {
    userId = created.user.id;
  }

  const hasGoogle = v.gcal && !!process.env.TEST_VENDOR_GOOGLE_REFRESH_TOKEN;
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    name: `LoadTest ${v.key}`,
    email,
    role: 'host',
    username: v.username,
    plan: 'professional',
    google_calendar_connected: hasGoogle,
    google_access_token: hasGoogle ? (process.env.TEST_VENDOR_GOOGLE_ACCESS_TOKEN || null) : null,
    google_refresh_token: hasGoogle ? (process.env.TEST_VENDOR_GOOGLE_REFRESH_TOKEN || null) : null,
  }, { onConflict: 'id' });

  await supabaseAdmin.from('availability').upsert({
    host_id: userId,
    weekly_schedule: wideOpen(),
    blocked_dates: [],
    timezone: 'Asia/Kolkata',
    buffer_minutes: 0,
  }, { onConflict: 'host_id' });

  const services = [
    { slug: 'loadtest-free', title: 'LoadTest Free Session', duration: 30, price: 0 },
    { slug: 'loadtest-paid', title: 'LoadTest Paid Session', duration: 30, price: 500 },
  ];
  for (const s of services) {
    await supabaseAdmin.from('services').upsert({
      host_id: userId, title: s.title, slug: s.slug, duration: s.duration, price: s.price,
      currency: 'INR', meeting_mode: 'online', service_type: 'online',
      grace_period_minutes: 10, is_active: true,
    }, { onConflict: 'host_id,slug' });
  }
  return { key: v.key, userId, username: v.username, email, google: hasGoogle };
}

(async () => {
  assertNotProd('seedLoadTest');
  const out = [];
  for (const v of VENDORS) out.push(await ensureVendor(v));
  console.log(JSON.stringify({ vendors: out, password: PASSWORD, tagDomain: TAG_DOMAIN }, null, 2));
  if (!process.env.TEST_VENDOR_GOOGLE_REFRESH_TOKEN) {
    console.log('NOTE: TEST_VENDOR_GOOGLE_REFRESH_TOKEN not set → freebusy-cache plan will be skipped (not faked).');
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Write `cleanupLoadTest.js`**

```js
// server/scripts/cleanupLoadTest.js
'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.bookasloth.local';

(async () => {
  assertNotProd('cleanupLoadTest');
  const { data: vendors } = await supabaseAdmin.from('profiles').select('id').like('username', 'loadtest-%');
  const ids = (vendors || []).map((v) => v.id);

  // Tagged guest bookings (FK-safe order: reviews → bookings → services → availability)
  await supabaseAdmin.from('bookings').delete().like('guest_email', `%${TAG_DOMAIN}`);
  if (ids.length) {
    await supabaseAdmin.from('reviews').delete().in('host_id', ids);
    await supabaseAdmin.from('bookings').delete().in('host_id', ids);
    await supabaseAdmin.from('services').delete().in('host_id', ids);
    await supabaseAdmin.from('availability').delete().in('host_id', ids);
  }
  // Guest profiles created during load tests
  await supabaseAdmin.from('profiles').delete().like('email', `%${TAG_DOMAIN}`);
  // Vendor profiles + auth users
  for (const id of ids) {
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    try { await supabaseAdmin.auth.admin.deleteUser(id); } catch (_) { /* already gone */ }
  }
  console.log(`Cleaned ${ids.length} test vendor(s) + all rows tagged ${TAG_DOMAIN}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Write `exportLoadTestData.js`**

```js
// server/scripts/exportLoadTestData.js
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const TAG_DOMAIN = '@loadtest.bookasloth.local';
const DATA_DIR = path.resolve(__dirname, '../../performance/jmeter/data');

(async () => {
  assertNotProd('exportLoadTestData');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const { data: vendors } = await supabaseAdmin.from('profiles').select('id, username').like('username', 'loadtest-%');
  const ids = (vendors || []).map((v) => v.id);
  const { data: services } = ids.length
    ? await supabaseAdmin.from('services').select('id, host_id, slug, price').in('host_id', ids)
    : { data: [] };

  fs.writeFileSync(path.join(DATA_DIR, 'vendors.csv'),
    ['vendor_id,username', ...(vendors || []).map((v) => `${v.id},${v.username}`)].join('\n'));
  fs.writeFileSync(path.join(DATA_DIR, 'services.csv'),
    ['service_id,host_id,slug,price', ...(services || []).map((s) => `${s.id},${s.host_id},${s.slug},${s.price}`)].join('\n'));

  const guests = ['guest_email,guest_name,guest_phone'];
  for (let i = 1; i <= 200; i++) {
    guests.push(`loadtest+${i}${TAG_DOMAIN},LoadGuest ${i},+9190000${String(i).padStart(5, '0')}`);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'guests.csv'), guests.join('\n'));

  console.log('Wrote vendors.csv, services.csv, guests.csv to', DATA_DIR);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Document the new env vars in `server/.env.example`**

Append (only the keys that don't already exist):

```bash
# ── Load testing (LOCAL/STAGING ONLY — never set true in production) ──
LOAD_TEST_MODE=false
LOADTEST_VENDOR_PASSWORD=LoadTest!2026
# Optional: enable the real-FreeBusy cache-effectiveness plan
TEST_VENDOR_GOOGLE_ACCESS_TOKEN=
TEST_VENDOR_GOOGLE_REFRESH_TOKEN=
```

- [ ] **Step 5: Verify scripts run against the local DB (real run)**

This is the first real DB write — it creates tagged, purgeable vendors in the configured Supabase. Run from `server/`:

```bash
node scripts/seedLoadTest.js
node scripts/exportLoadTestData.js
```

Expected: seed prints a JSON block with two vendor IDs; export prints "Wrote vendors.csv, services.csv, guests.csv". Confirm `performance/jmeter/data/vendors.csv` has 2 rows + header, `services.csv` has 4 rows + header.

If a column error appears (schema drift vs `docs/database-schema.md`), fix the payload key to match the live column and re-run. Then verify cleanup works (it will be re-seeded later):

```bash
node scripts/cleanupLoadTest.js   # prints "Cleaned 2 test vendor(s)…"
node scripts/seedLoadTest.js      # re-seed for downstream phases
node scripts/exportLoadTestData.js
```

- [ ] **Step 6: Commit**

```bash
git add server/scripts/seedLoadTest.js server/scripts/cleanupLoadTest.js server/scripts/exportLoadTestData.js server/.env.example performance/jmeter/data/
git commit -m "feat(perf): seed/cleanup/export load-test data scripts (prod-guarded)"
```

---

### Task 9: Full-suite regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the entire server test suite**

Run: `npm test` (from `server/`)
Expected: all pre-existing tests still pass PLUS the 6 new test files. No regressions. If any pre-existing test fails, it must be a flake (e.g. bcrypt timing — testTimeout is 15s) or a real regression to fix before proceeding.

- [ ] **Step 2: Confirm zero-regression of the OFF path**

Manually confirm (grep): every new guard is gated by `isLoadTestMode()` and the default (`LOAD_TEST_MODE` unset) returns false. There is no behavior change when the flag is off.

Run: `git grep -n "isLoadTestMode()" -- server/`
Expected: matches only in `config/loadTestMode.js`, `middleware/security.js`, `services/notificationEngine.js`, `utils/sendEmail.js`, `utils/otpStore.js`, `config/google.js`.

- [ ] **Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "test(perf): full-suite regression check for LOAD_TEST_MODE foundation"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** P1 docs (Task 1), `LOAD_TEST_MODE` fail-safe (Task 2), rate-limiter bypass (Task 3), notification/SMTP stubs (Task 4), OTP determinism (Task 5), Google write stub + FreeBusy-real (Task 6), prod-guard (Task 7), seed/cleanup/export + tagging (Task 8), regression check (Task 9). Deferred to Plan B (noted): Razorpay `verifyPayment` signature bypass; all JMeter `.jmx`, CLI scripts, CI/CD.
- **Placeholders:** none — every code/edit step shows complete code and exact run commands.
- **Type/name consistency:** `isLoadTestMode` (named export) used identically across all seams; `skipWhenLoadTest`, `assertNotProd`, `TAG_DOMAIN` consistent across tasks; require paths verified relative to each file's directory (`../config/...` from `utils/`, `services/`, `middleware/`; `./loadTestMode` from `config/google.js`).
