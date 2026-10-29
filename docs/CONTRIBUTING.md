# Contributing — Book A Sloth

## Getting Started

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) to set up your local environment
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand how the system works
3. Read the relevant section of [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) for the area you're changing
4. Check [PROJECT_STATUS.md](PROJECT_STATUS.md) for what's in progress

---

## Development Workflow

1. Create a branch: `git checkout -b feature/description` or `fix/description`
2. Make changes — see rules below
3. Run tests: `cd server && npm test` and `cd client && npm test`
4. Commit with a descriptive message
5. Open a PR with a summary of changes and any decisions made

---

## Code Style

### General
- No linter config exists yet — follow existing code style
- Use `const` by default, `let` when mutation is needed, never `var`
- Arrow functions for callbacks, regular functions for named exports
- Async/await over `.then()` chains

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| React pages | PascalCase.jsx | `ServiceBooking.jsx` |
| React components | PascalCase.jsx | `DashboardLayout.jsx` |
| Server controllers | camelCaseController.js | `bookingController.js` |
| Server routes | camelCaseRoutes.js | `bookingRoutes.js` |
| Utilities | camelCase.js | `otpStore.js` |
| Boolean DB columns | snake_case with is_ prefix | `is_active`, `is_verified` |
| Timestamp DB columns | snake_case with _at suffix | `created_at`, `plan_expires_at` |
| FK DB columns | snake_case with _id suffix | `host_id`, `service_id` |
| URL columns | snake_case with _url suffix | `thumbnail_url`, `profile_image` |
| CSS utilities | fb- prefix for custom classes | `fb-btn`, `fb-card` |

### API Response Shape

```js
// Success
res.json(data)               // 200
res.status(201).json(data)   // 201 Created

// Error
res.status(400).json({ message: 'Validation failed' })
res.status(401).json({ message: 'Unauthorized' })
res.status(403).json({ message: 'Plan limit reached', upgrade_required: true, current_plan: 'starter' })
res.status(404).json({ message: 'Not found' })
res.status(500).json({ message: err.message })
```

---

## Critical Rules

Follow these in every change. Breaking any of these can cause production incidents.

### 1. Schema Fallback Pattern
Any query touching a column added after v1.6 must include a catch-and-retry:

```js
// SELECT
let result = await supabaseAdmin.from('bookings').select('*, new_column');
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  result = await supabaseAdmin.from('bookings').select('id, status, vendor_amount');
}

// INSERT
const payload = { ...core, new_column: value };
let result = await supabaseAdmin.from('table').insert(payload).select().single();
if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
  const { new_column: _dropped, ...safePayload } = payload;
  result = await supabaseAdmin.from('table').insert(safePayload).select().single();
}
```

### 2. Pricing Snapshots Are Immutable
Never recalculate pricing from current settings after a booking is created.
Always read `booking.vendor_amount`, `booking.platform_fee_amount`, `booking.commission_applied`.

### 3. pricingEngine.js Stays Pure
No DB access, no side effects, no external calls in `pricingEngine.js`. It takes values and returns values only.

### 4. supabaseAdmin Is Server-Only
Never import or use the service role client in client-side code. Never set it as a `VITE_*` variable.

### 5. All Client API Calls via api.js
Never use `fetch()` directly. Never create a second Axios instance. All calls go through `import { ... } from '../services/api'`.

### 6. Email Failures Are Non-Fatal
Always wrap email/WhatsApp sends in try/catch. Never re-throw. The booking succeeded; the notification is best-effort.

```js
try {
  await communicationEngine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', ... });
} catch (emailError) {
  console.error('Email error:', emailError.message);
  // Don't re-throw
}
```

### 7. OTP Is DB-Backed
Never use in-memory storage for OTPs. `otpStore.js` uses the `otp_codes` table. Don't change this.

### 8. Admin Permissions Must Be Declared
Every new admin endpoint must use `requireAdmin('permission_name')`. Permission names must exist in `lib/adminPermissions.js`.

---

## Controller Structure

```js
const myAction = async (req, res) => {
  try {
    // 1. Validate inputs (use express-validator in route, or manual check here)
    if (!req.body.field) return res.status(400).json({ message: 'field is required' });

    // 2. DB queries (with schema fallbacks if touching new columns)
    const { data, error } = await supabaseAdmin.from('table').select('*');
    if (error) throw error;

    // 3. Business logic

    // 4. DB mutations

    // 5. Side effects (emails, notifications) — in try/catch, non-fatal
    try {
      await communicationEngine.send({ ... });
    } catch (e) { console.error('Email error:', e.message); }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { myAction };
```

---

## Adding a New Feature

### New API endpoint
1. Write handler in appropriate controller
2. Add route in the matching `routes/` file with correct middleware chain
3. Export a function from `client/src/services/api.js`
4. Call it from the page component
5. Write unit test for the controller function
6. Update [API_REFERENCE.md](API_REFERENCE.md)

### New DB table or column
1. Write migration SQL in `server/migrations/vX.Y_description.sql`
2. Apply it in Supabase SQL Editor (dev + production)
3. Add schema fallback to affected controllers
4. Update [DATABASE.md](DATABASE.md)

### New admin section
1. Add controller to `server/controllers/`
2. Add routes to `server/routes/adminRoutes.js`
3. Register new permissions in `lib/adminPermissions.js` and the `admin_roles` DB seed
4. Create page in `client/src/pages/admin/`
5. Add route to `client/src/App.jsx`
6. Add nav item to `AdminLayout.jsx` (conditionally rendered by permission)

### New email event
1. Add template definition to `server/config/emailTemplates.js`
2. Run `node scripts/seedEmailTemplates.js` to insert it
3. Register the event key in `notification_events` table (or via admin UI at `/admin/platform/communication`)
4. Call `communicationEngine.send({ event: 'EVENT_KEY', audience, data })` from the controller

### New badge metric
1. Add metric to the `vendor_metrics` SQL view in the relevant migration
2. Add it to the `badge_rules` operator options in `AdminBadges.jsx`
3. Update the metric documentation in [DATABASE.md](DATABASE.md)

---

## Anti-Patterns (Hard No)

- ❌ `fetch()` for API calls — use `api.js`
- ❌ Hardcoding `₹10` platform fee — read from `platformConfig`
- ❌ Recalculating commission from current plan — read snapshot
- ❌ In-memory OTP (Map, Set, etc.) — use `otpStore.js`
- ❌ Skipping schema fallback on new columns
- ❌ `/profile/service/:slug` URL — correct URL is `/:username/booking/:slug`
- ❌ `max-w-lg mx-auto` on step cards in `ServiceBooking` — use inner wrapper
- ❌ Adding `supabaseAdmin` to client code
- ❌ New admin route without `requireAdmin(permission)`
- ❌ Re-throwing email errors

---

## Testing Requirements

- New controller functions must have at least one unit test
- New pricing logic must have tests with concrete number examples
- Integration tests for new auth or payment flows
- Run full test suite before submitting — 0 failures required

See [TESTING.md](TESTING.md) for patterns and mocking examples.

---

## Documentation Requirements

When your change:
- Adds a new endpoint → update [API_REFERENCE.md](API_REFERENCE.md)
- Changes the DB schema → update [DATABASE.md](DATABASE.md)
- Changes a major architectural decision → add entry to [DECISIONS.md](DECISIONS.md)
- Completes or starts a significant feature → update [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Ships a release → add entry to [CHANGELOG.md](CHANGELOG.md)
- Changes the existing docs → keep CLAUDE.md in sync (`docs/ai-context.md`, `docs/current-state.md`, `docs/current-work.md`)

---

## Commit Message Format

```
type: short description

type = feat | fix | refactor | docs | test | chore
```

Examples:
```
feat: add badge revoke endpoint with required reason
fix: commission_applied schema fallback on booking insert
docs: update API_REFERENCE with new admin staff endpoints
test: add pricingEngine cases for GST calculation
```

---

## Related Documentation
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup
- [TESTING.md](TESTING.md) — test patterns and running tests
- [DECISIONS.md](DECISIONS.md) — historical architectural choices
