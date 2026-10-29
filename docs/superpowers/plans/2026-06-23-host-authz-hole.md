# Host Authz Hole Fix + Become-a-Host Opt-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop a guest from acting as a host via role-blind vendor APIs; make guest→host a deliberate, server-enforced opt-in.

**Architecture:** Add a `requireHost` middleware (self-contained role read, fail-closed) to host-capability routes only; add a `POST /api/auth/become-host` endpoint that flips a guest to host + seeds onboarding (mirrors the proven `markGoogleVendorOnboarding` path); reconcile now-wrong cross-role registration copy; wire a client "Become a host" CTA. No DB migration (live data clean).

**Tech Stack:** Node/Express, Supabase (`supabaseAdmin` service-role), Jest (server `tests/unit` + `tests/integration`), React + Vitest (client).

### Refinements decided during planning (override spec where they differ)
- `requireHost` is **self-contained** (does its own `profiles.role` read) — it does NOT modify `protect`, so existing protected-route tests need no new mocks.
- Endpoint path is **`POST /api/auth/become-host`** (handler in `authController.js`, which already has `serializeProfile`/`safeError`) — avoids cross-controller imports.
- Opt-in reuses the account's existing **`username` as `onboarding_slug`** (already unique) and sets `onboarding_step_completed = 3` always (lands on `/vendor-register/:slug/type`), exactly like `markGoogleVendorOnboarding`. No slug generator needed.
- Cross-role registration branches collapse to one generic message (no role-specific copy).

---

## File structure

| File | Change |
|---|---|
| `server/middleware/authMiddleware.js` | Add + export `requireHost` |
| `server/tests/unit/requireHost.test.js` | Create — unit tests for `requireHost` |
| `server/controllers/authController.js` | Add + export `becomeHost`; simplify two registration 409 branches |
| `server/tests/unit/becomeHost.test.js` | Create — unit tests for `becomeHost` |
| `server/routes/authRoutes.js` | Mount `POST /become-host` |
| `server/routes/hostRoutes.js` | Add `requireHost` to mutating routes |
| `server/routes/serviceRoutes.js` | Add `requireHost` to mutating routes |
| `server/routes/productRoutes.js` | Add `requireHost` to mutating routes |
| `server/routes/feedbackRoutes.js` | Add `requireHost` to POST |
| `server/routes/categoryRoutes.js` | Add `requireHost` to POST /suggest |
| `server/routes/whatsappRoutes.js` | Add `requireHost` to OTP routes |
| `server/tests/integration/hostGuard.test.js` | Create — proves guard is wired (guest→403 on real serviceRoutes) |
| `server/tests/unit/authController.test.js` | Update 2 assertions (lines ~118, ~179) |
| `server/tests/integration/auth.test.js` | Update 2 assertions (lines ~90, ~137) |
| `client/src/services/api.js` | Add `activateHost` |
| `client/src/context/AuthContext.jsx` | Add `activateHost` helper |
| `client/src/pages/Dashboard.jsx` | Wire guest "Become a host" CTA |
| `client/src/pages/BeASloth.jsx` | If logged-in guest, CTA calls `activateHost` |
| `client/src/tests/AuthContext.test.jsx` | Add `activateHost` test |

---

## Task 1: `requireHost` middleware

**Files:**
- Modify: `server/middleware/authMiddleware.js`
- Test: `server/tests/unit/requireHost.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/requireHost.test.js`:

```js
/**
 * tests/unit/requireHost.test.js — role guard for host-capability routes.
 */
jest.mock('../../config/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { supabaseAdmin: { from: jest.fn(() => chain), __chain: chain } };
});

const { supabaseAdmin } = require('../../config/supabase');
const { requireHost } = require('../../middleware/authMiddleware');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};
const setRole = (role) =>
  supabaseAdmin.__chain.single.mockResolvedValue({ data: role ? { role } : null, error: null });

beforeEach(() => jest.clearAllMocks());

test('401 when no authenticated user', async () => {
  const r = res(); const next = jest.fn();
  await requireHost({ user: null }, r, next);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('host → next()', async () => {
  setRole('host');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'u1' } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(r.status).not.toHaveBeenCalled();
});

test('superadmin → next()', async () => {
  setRole('superadmin');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'a1' } }, r, next);
  expect(next).toHaveBeenCalled();
});

test('guest → 403, no next()', async () => {
  setRole('guest');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'g1' } }, r, next);
  expect(r.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test('missing profile → 403 (fail closed)', async () => {
  setRole(null);
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'x' } }, r, next);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('uses req.user.role if already attached (no DB read)', async () => {
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'u1', role: 'host' } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- tests/unit/requireHost.test.js`
Expected: FAIL — `requireHost is not a function`.

- [ ] **Step 3: Implement `requireHost`**

In `server/middleware/authMiddleware.js`, add before `module.exports`:

```js
// Authorization guard for host-capability routes. Runs after `protect`.
// Self-contained: reads the caller's role (or reuses req.user.role if an
// earlier middleware attached it). FAIL-CLOSED — a lookup error or missing
// profile yields 403, never an accidental pass. `superadmin` is allowed so
// staff tooling keeps working.
const requireHost = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    let role = req.user.role;
    if (!role) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('role').eq('id', req.user.id).single();
      role = profile?.role;
      req.user.role = role;
    }
    if (role === 'host' || role === 'superadmin') return next();
    return res.status(403).json({
      message: 'Host account required. Turn on hosting to access this.',
      host_required: true,
    });
  } catch (_) {
    return res.status(403).json({ message: 'Host account required.', host_required: true });
  }
};
```

Update the exports line:

```js
module.exports = { protect, optionalProtect, requireHost };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- tests/unit/requireHost.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/middleware/authMiddleware.js server/tests/unit/requireHost.test.js
git commit -m "feat(auth): add requireHost role guard middleware"
```

---

## Task 2: `becomeHost` endpoint (guest → host opt-in)

**Files:**
- Modify: `server/controllers/authController.js` (add `becomeHost`, add to exports)
- Modify: `server/routes/authRoutes.js`
- Test: `server/tests/unit/becomeHost.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/unit/becomeHost.test.js`:

```js
/**
 * tests/unit/becomeHost.test.js — guest→host opt-in.
 */
jest.mock('../../config/supabase', () => {
  const make = () => ({
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn(),
  });
  return { supabaseAdmin: { from: jest.fn(() => make()) } };
});
jest.mock('../../services/usernameService', () => ({
  createInitialUsername: jest.fn(), recordInitialUsername: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { becomeHost } = require('../../controllers/authController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};
beforeEach(() => jest.clearAllMocks());

test('guest is flipped to host with onboarding seeded', async () => {
  // 1st from(): read role+username (guest). 2nd from(): update → returns host row.
  supabaseAdmin.from
    .mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'g1', role: 'guest', username: 'cool-otter-7' }, error: null }),
    })
    .mockReturnValueOnce({
      update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'g1', role: 'host', username: 'cool-otter-7', plan: 'explorer', onboarding_slug: 'cool-otter-7', onboarding_step_completed: 3 }, error: null }),
    });
  const r = res();
  await becomeHost({ user: { id: 'g1' } }, r);
  expect(r.status).toHaveBeenCalledWith(200);
  expect(r.json.mock.calls[0][0].role).toBe('host');
});

test('already a host → idempotent 200', async () => {
  supabaseAdmin.from
    .mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'h1', role: 'host', username: 'h' }, error: null }),
    })
    .mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'h1', role: 'host', username: 'h', plan: 'creator' }, error: null }),
    });
  const r = res();
  await becomeHost({ user: { id: 'h1' } }, r);
  expect(r.json.mock.calls[0][0].role).toBe('host');
  // no update issued on the second from() call
});

test('profile not found → 404', async () => {
  supabaseAdmin.from.mockReturnValueOnce({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  });
  const r = res();
  await becomeHost({ user: { id: 'nope' } }, r);
  expect(r.status).toHaveBeenCalledWith(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- tests/unit/becomeHost.test.js`
Expected: FAIL — `becomeHost is not a function`.

- [ ] **Step 3: Implement `becomeHost`**

In `server/controllers/authController.js`, add the function (place it near `markGoogleVendorOnboarding`, before `module.exports`):

```js
// POST /api/auth/become-host — explicit, server-enforced guest→host opt-in.
// The ONLY legitimate way a role becomes 'host' for an existing account. Mirrors
// markGoogleVendorOnboarding: reuse the (unique) username as onboarding_slug and
// land the user on step 3 (/vendor-register/:slug/type). Idempotent for hosts.
const becomeHost = async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles").select("id, role, username").eq("id", req.user.id).single();
    if (error || !profile) return res.status(404).json({ message: "Profile not found" });

    if (profile.role === "host" || profile.role === "superadmin") {
      const { data: full } = await supabaseAdmin
        .from("profiles").select("*").eq("id", req.user.id).single();
      return res.status(200).json(serializeProfile(full || profile, null));
    }

    const updates = {
      role: "host",
      onboarding_slug: profile.username,
      onboarding_step_completed: 3, // next page = /vendor-register/:slug/type
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    };
    let result = await supabaseAdmin
      .from("profiles").update(updates).eq("id", req.user.id).select("*").single();

    // Graceful fallback if the onboarding_* columns don't exist on an older DB.
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      result = await supabaseAdmin
        .from("profiles")
        .update({ role: "host", updated_at: new Date().toISOString() })
        .eq("id", req.user.id).select("*").single();
    }
    if (result.error) return safeError(res, result.error);
    return res.status(200).json(serializeProfile(result.data, null));
  } catch (error) {
    safeError(res, error);
  }
};
```

Add `becomeHost` to the `module.exports` object in `authController.js`.

- [ ] **Step 4: Mount the route**

In `server/routes/authRoutes.js`: add `becomeHost` to the destructured import from `../controllers/authController`, then add (near `router.put('/me', protect, updateMe);`):

```js
router.post('/become-host', protect, becomeHost);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- tests/unit/becomeHost.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/authController.js server/routes/authRoutes.js server/tests/unit/becomeHost.test.js
git commit -m "feat(auth): add POST /api/auth/become-host opt-in endpoint"
```

---

## Task 3: Wire `requireHost` into host-capability routes + prove it

**Files (modify):** `hostRoutes.js`, `serviceRoutes.js`, `productRoutes.js`, `feedbackRoutes.js`, `categoryRoutes.js`, `whatsappRoutes.js`
**Test (create):** `server/tests/integration/hostGuard.test.js`

- [ ] **Step 1: Write the failing integration test**

Create `server/tests/integration/hostGuard.test.js`:

```js
/**
 * tests/integration/hostGuard.test.js
 * Proves requireHost is actually wired: a guest token is rejected (403) on a
 * real host route (POST /api/services) before any controller logic runs.
 */
jest.mock('../../middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../middleware/authMiddleware');
  return {
    ...actual,
    protect: (req, _res, next) => { req.user = { id: 'guest-uuid' }; next(); },
  };
});
jest.mock('../../config/supabase', () => {
  const make = () => ({
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role: 'guest' }, error: null }),
  });
  return { supabaseAdmin: { from: jest.fn(() => make()) } };
});
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const express = require('express');
const serviceRoutes = require('../../routes/serviceRoutes');

const app = express();
app.use(express.json());
app.use('/api/services', serviceRoutes);

test('guest token is 403 on POST /api/services', async () => {
  const res = await request(app).post('/api/services').send({ title: 'X', price: 0 });
  expect(res.status).toBe(403);
  expect(res.body.host_required).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- tests/integration/hostGuard.test.js`
Expected: FAIL — status is not 403 (route has no guard yet; likely 500/201).

- [ ] **Step 3: Add `requireHost` to each route file**

`server/routes/serviceRoutes.js` — change the import line 14 and the mutating routes:

```js
const { protect, requireHost } = require('../middleware/authMiddleware');
```
```js
router.post('/',              protect, requireHost, requireFeature('services'), attachPlan, checkServiceLimit, createService);
router.put('/:id',            protect, requireHost, requireFeature('services'), updateService);
router.delete('/:id',         protect, requireHost, deleteService);
router.post('/:id/duplicate', protect, requireHost, requireFeature('services'), duplicateService);
router.put('/:id/toggle',     protect, requireHost, toggleService);
```

`server/routes/hostRoutes.js` — change import line 9 and guard the mutating routes:

```js
const { protect, requireHost } = require('../middleware/authMiddleware');
```
```js
router.put('/profile', protect, requireHost, updateProfile);
router.put('/categories', protect, requireHost, attachPlan, updateCategories);
router.put('/username', protect, requireHost, changeUsername);
router.post('/services', protect, requireHost, requireFeature('services'), attachPlan, checkServiceLimit, createService);
router.put('/services/:id', protect, requireHost, requireFeature('services'), updateService);
router.delete('/services/:id', protect, requireHost, deleteService);
router.put('/availability', protect, requireHost, requireFeature('availability_editor'), setAvailability);
```
> Leave the GET routes (`/availability`, `/categories`, `/services`) untouched — reads, harmless for guests.

`server/routes/productRoutes.js` — add `requireHost` to the import and to the 3 mutating routes:

```js
router.post('/', protect, requireHost, requireFeature('digital_products'), attachPlan, checkProductLimit, createProduct);
router.put('/:id', protect, requireHost, requireFeature('digital_products'), updateProduct);
router.delete('/:id', protect, requireHost, deleteProduct);
```
> Leave `POST /free-download` (optionalProtect, guest-facing) untouched.

`server/routes/feedbackRoutes.js` — add `requireHost` to import and the POST:

```js
router.post('/', protect, requireHost, requireFeature('vendor_feedback'), createFeedback);
```

`server/routes/categoryRoutes.js`:

```js
router.post('/suggest', protect, requireHost, suggest);
```

`server/routes/whatsappRoutes.js` — host WhatsApp verify:

```js
router.post('/send-otp', protect, requireHost, otpLimiter, sendOtp);
router.post('/verify-otp', protect, requireHost, otpLimiter, verifyOtp);
```
> For each file, ensure the import is `const { protect, requireHost } = require('../middleware/authMiddleware');` (and keep any other imports already present).

- [ ] **Step 4: Run the guard test + the full server suite**

Run: `cd server && npm test -- tests/integration/hostGuard.test.js`
Expected: PASS.
Run: `cd server && npm test`
Expected: All green except possibly the 4 message assertions (fixed in Task 4). If those fail, that's expected — proceed to Task 4.

- [ ] **Step 5: Commit**

```bash
git add server/routes/serviceRoutes.js server/routes/hostRoutes.js server/routes/productRoutes.js server/routes/feedbackRoutes.js server/routes/categoryRoutes.js server/routes/whatsappRoutes.js server/tests/integration/hostGuard.test.js
git commit -m "fix(security): enforce requireHost on all host-capability routes"
```

---

## Task 4: Reconcile cross-role registration messaging

**Files:**
- Modify: `server/controllers/authController.js` (registerVendor ~190-194, registerUser ~466-470)
- Modify: `server/tests/unit/authController.test.js` (~line 118, ~179)
- Modify: `server/tests/integration/auth.test.js` (~line 90, ~137)

- [ ] **Step 1: Update the controller (registerVendor)**

Replace the existing-account block in `registerVendor`:

```js
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }
```

- [ ] **Step 2: Update the controller (registerUser)**

Replace the existing-account block in `registerUser`:

```js
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    }
```

- [ ] **Step 3: Update the 4 stale assertions**

`server/tests/unit/authController.test.js` line ~118:
```js
    expect(r.json.mock.calls[0][0].message).toMatch(/already exists|log in/i);
```
`server/tests/unit/authController.test.js` line ~179:
```js
    expect(r.json.mock.calls[0][0].message).toMatch(/already exists|log in/i);
```
`server/tests/integration/auth.test.js` line ~90:
```js
    expect(res.body.message).toMatch(/already exists|log in/i);
```
`server/tests/integration/auth.test.js` line ~137:
```js
    expect(res.body.message).toMatch(/already exists|log in/i);
```

- [ ] **Step 4: Run the affected suites**

Run: `cd server && npm test -- tests/unit/authController.test.js tests/integration/auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/authController.js server/tests/unit/authController.test.js server/tests/integration/auth.test.js
git commit -m "refactor(auth): generic existing-account message (unified role model)"
```

---

## Task 5: Client — "Become a host" opt-in wiring

**Files:**
- Modify: `client/src/services/api.js`
- Modify: `client/src/context/AuthContext.jsx`
- Modify: `client/src/pages/Dashboard.jsx`
- Modify: `client/src/pages/BeASloth.jsx`
- Test: `client/src/tests/AuthContext.test.jsx`

- [ ] **Step 1: Add the API function**

In `client/src/services/api.js`, near the other auth calls:

```js
export const activateHost    = ()             => API.post('/auth/become-host');
```

- [ ] **Step 2: Add the AuthContext helper**

In `client/src/context/AuthContext.jsx`:
- Add `activateHost` to the import from `../services/api` (the line that imports `getMe`, `registerVendor`, …): add `activateHost as apiActivateHost`.
- Add this helper (after `adoptSession`):

```js
  // Explicit guest→host opt-in. Server flips role + seeds onboarding; we then
  // re-fetch the profile (keeping the existing session tokens) so ProtectedRoute
  // drives the user into host onboarding.
  const activateHost = async () => {
    await apiActivateHost();
    const { data: fresh } = await getMe();
    const merged = { ...user, ...fresh };
    localStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
    return merged;
  };
```
- Add `activateHost` to the context provider `value={{ ... }}`.

- [ ] **Step 3: Add the AuthContext test**

In `client/src/tests/AuthContext.test.jsx`:
- Add `activateHost: vi.fn()` to the `../services/api` mock object.
- Add `activateHost` to the destructured import from `../services/api`.
- Add this test (mirror the existing register test structure; the harness exposes context via a probe component — copy the pattern already used in this file for `registerAsVendor`):

```js
  test('activateHost flips role to host via getMe refresh', async () => {
    activateHost.mockResolvedValueOnce({ data: { ok: true } });
    getMe.mockResolvedValueOnce({ data: { ...VENDOR, role: 'host' } });
    // trigger ctx.activateHost() through the test probe, then assert the
    // exposed user.role === 'host' (use the same act()/await pattern this file
    // already uses for login/register).
  });
```
> If the existing test file's probe pattern makes this awkward, keep the test minimal: assert `activateHost` calls the API then `getMe`. Do not weaken existing tests.

- [ ] **Step 4: Wire the Dashboard CTA**

In `client/src/pages/Dashboard.jsx`, in the `if (!isHost)` guest branch (around line 165), replace the static "Want to offer services? Become a Host" content's action with a button that calls `activateHost` from `useAuth()` then navigates:

```jsx
  const { user, activateHost } = useAuth();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const handleBecomeHost = async () => {
    setActivating(true);
    try {
      await activateHost();
      navigate('/dashboard'); // ProtectedRoute now routes into host onboarding
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not switch on hosting.');
    } finally {
      setActivating(false);
    }
  };
```
```jsx
  <button className="btn" onClick={handleBecomeHost} disabled={activating}>
    {activating ? 'Setting up…' : 'Become a host'}
  </button>
```
> Reuse the page's existing `toast`/`useNavigate`/`useState` imports if present; add any that are missing.

- [ ] **Step 5: Wire BeASloth for logged-in guests**

In `client/src/pages/BeASloth.jsx`: if `user` exists and `user.role !== 'host'`, the primary "Become a host" CTA should call `activateHost()` (then navigate to `/dashboard`) instead of routing to the signup form. If `user` is a host already, route to `/dashboard`. Logged-out visitors keep the existing signup flow.

- [ ] **Step 6: Run client tests + build**

Run: `cd client && npm test`
Expected: PASS (existing + new).
Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add client/src/services/api.js client/src/context/AuthContext.jsx client/src/pages/Dashboard.jsx client/src/pages/BeASloth.jsx client/src/tests/AuthContext.test.jsx
git commit -m "feat(client): Become-a-host opt-in CTA + activateHost"
```

---

## Task 6: Full verification + PR

- [ ] **Step 1: Run both full suites**

Run: `cd server && npm test` → all green.
Run: `cd client && npm test` → all green.
Run: `cd client && npm run build` → succeeds.

- [ ] **Step 2: Manual smoke (preview)**

Start dev servers; verify: (a) a guest account sees "Become a host" and clicking it lands in host onboarding; (b) a guest token gets 403 on `POST /api/services` (e.g. via devtools/network); (c) an existing host is unaffected; (d) a guest can still book, cancel own booking, edit `/me`.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin fix/host-authz-hole
gh pr create --title "fix(security): close host authz hole + add become-host opt-in" --body "<summary + test evidence>"
```

---

## Self-review

**Spec coverage:** A (guard) → Tasks 1,3. B (opt-in) → Task 2 + Task 5. C (messaging) → Task 4. D (client) → Task 5. E (no migration) → honored. F (tests) → Tasks 1,2,3,4,5. G (rollout/server-first) → Task 6 push; no flag on guard. ✓

**Placeholder scan:** Client Step 3/5 lean on existing file patterns (probe component, CTA markup) rather than full code because they depend on current JSX not fully quoted here — flagged explicitly, with the required behavior spelled out. All server steps have complete code. ✓

**Type/name consistency:** `requireHost`, `becomeHost`, `activateHost` (client), `host_required` flag, `/auth/become-host` used consistently across tasks. ✓

**Risk:** Mis-classifying a shared route as host-only. Mitigated: explicit route table, guard added only to listed mutations, GET/guest/booking/review/me/payment routes untouched, plus the guest-regression manual check in Task 6.
