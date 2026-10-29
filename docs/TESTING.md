# Testing — Book A Sloth

## Test Stack

| Layer | Framework | Runner |
|---|---|---|
| Server — unit | Jest | `npm test` in `server/` |
| Server — integration | Jest + Supertest | `npm run test:integration` |
| Client — component | Vitest + Testing Library | `npm test` in `client/` |

Current coverage: **205 server tests passing / 112 client tests passing** (2026-06-11).

---

## Running Tests

```bash
# All server tests
cd server && npm test

# Server unit tests only
cd server && npm run test:unit

# Server integration tests only
cd server && npm run test:integration

# Server with coverage report
cd server && npm run test:coverage

# Server watch mode
cd server && npm run test:watch

# All client tests
cd client && npm test

# Client with coverage
cd client && npm run test:coverage

# Client watch mode
cd client && npm run test:watch
```

---

## Server Test Structure

```
server/
  tests/
    unit/
      authController.test.js         ← auth logic, OTP, password reset
      bookingController.test.js      ← booking creation, double-booking check
      serviceController.test.js      ← service CRUD, slug validation
      hostController.test.js         ← profile, availability
      adminController.test.js        ← user management, stats
      adminAuthController.test.js    ← admin login, lockout
      adminAuthService.test.js       ← bcrypt verify, JWT mint
      adminMiddleware.test.js        ← JWT verify, permission check
      adminPermissions.test.js       ← role → permission mapping
      pricingEngine.test.js          ← 23 test cases, incl. worked examples from spec
      otpStore.test.js               ← set, verify, cleanup, rate limits
      notificationEngine.test.js     ← event dispatch, channel routing
      communicationEngine.test.js    ← template render, queue, send
      placeholderResolver.test.js    ← {{variable}} substitution
      badgeEngine.test.js            ← rule evaluation, award, revoke
      auditService.test.js           ← audit log writes

    integration/
      auth.test.js        ← full login/register/OTP flow via HTTP
      admin.test.js       ← admin endpoints end-to-end
      adminAuth.test.js   ← admin login + protected route access
      vendor.test.js      ← vendor registration + profile update
      helpers.js          ← shared test setup utilities

  __tests__/
    vendorOnboarding.test.js  ← onboarding state machine
```

### Server Test Config

`server/jest.config.js`:
```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['controllers/**', 'middleware/**', 'routes/**', 'utils/**'],
};
```

`server/jest.resolver.js` — custom resolver for ES module compatibility.

---

## Client Test Structure

```
client/src/tests/
  setup.js                  ← Testing Library setup, jsdom config
  minimal.test.jsx           ← smoke test
  AuthContext.test.jsx       ← login/logout state, localStorage sync
  AdminLogin.test.jsx        ← admin login form, error states
  Dashboard.test.jsx         ← dashboard renders with mocked auth
  HostProfile.test.jsx       ← public profile rendering
  ProfileSetup.test.jsx      ← profile form
  ServiceBooking.test.jsx    ← booking flow steps
  themeUtils.test.js         ← getContrastColor, getPlanBorderColor, isValidHex
```

### Client Test Config

`client/vitest.config.js`:
```js
export default {
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    globals: true,
  },
};
```

---

## What to Test

### Always Test

- **Pricing calculations** — `pricingEngine.test.js` has 23 cases matching the spec's worked examples. Any change to `pricingEngine.js` must not break these.
- **Auth flows** — OTP set/verify, login/logout, token refresh
- **Admin lockout** — 5-fail scenario
- **Permission enforcement** — each role gets what it should, denied what it shouldn't

### Mocking Pattern (Server)

Supabase is mocked in all unit tests:

```js
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    // ...
  }
}));
```

Email sending is also mocked:
```js
jest.mock('../../utils/sendEmail', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));
```

### Mocking Pattern (Client)

API calls mocked via `vi.mock`:

```js
vi.mock('../services/api', () => ({
  getHostBookings: vi.fn().mockResolvedValue({ data: [] }),
}));
```

AuthContext mocked where needed:
```js
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, login: vi.fn(), logout: vi.fn() })
}));
```

---

## Integration Tests

Integration tests in `server/tests/integration/` use Supertest to make real HTTP requests against the Express app. They mock the Supabase client so no actual DB calls are made.

Pattern:
```js
const request = require('supertest');
const app = require('../../server');

describe('POST /api/auth/login', () => {
  it('returns 200 with token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});
```

---

## Coverage Report

After running `npm run test:coverage` in `server/`:
- HTML report: `server/coverage/lcov-report/index.html`
- Per-file breakdown for controllers, middleware, routes, utils

---

## What's Not Tested

- **End-to-end booking flow** — no E2E test suite (no Playwright/Cypress)
- **Razorpay payment verification** — mocked; no integration with test mode API
- **Google Calendar event creation** — mocked
- **Email delivery** — communicationEngine is unit-tested but actual SMTP delivery is not integration-tested
- **Badge engine with real DB data** — mocked vendor_metrics view
- **Client service pages** — AddService, EditService, ServiceBooking, Availability — no test coverage

---

## Writing New Tests

### Server unit test template

```js
const { myFunction } = require('../../controllers/myController');
const { supabaseAdmin } = require('../../config/supabase');

jest.mock('../../config/supabase');

describe('myFunction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns data on success', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
    });
    const req = { user: { id: 'uid' }, params: {}, body: {} };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await myFunction(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([{ id: '1' }]));
  });
});
```

### Pricing engine test template

```js
const { computeBreakdown } = require('../../lib/pricingEngine');

test('free plan: 5% commission on ₹100 service', () => {
  const result = computeBreakdown(100, 5, 10, 0.18);
  expect(result.commission).toBe(5);
  expect(result.customerTotal).toBe(111.80);
});
```

---

## Related Documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) — when and how to add tests with PRs
- [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) — module overview for finding what to test
