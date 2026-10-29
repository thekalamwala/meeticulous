# Unified Identity + Capabilities + Mode Switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-identity split (guest=phone / host=email) and binary `role` with one account that has an `is_host` capability and a Hosting/Traveling mode switch — rolled out in safe, shippable phases.

**Architecture:** Add `profiles.is_host` as the new source of truth; keep `role` as an auto-mirrored compatibility shim (DB trigger) so every existing consumer keeps working while we migrate them one at a time. Relax the identity-based role wall into capability + mode. Drop `role` only in the final cleanup.

**Tech Stack:** Supabase Postgres (SQL migrations, plpgsql trigger), Express + Jest (server), React + Vite + Vitest (client). Spec: [`docs/superpowers/specs/2026-06-24-unified-identity-capabilities-design.md`](../specs/2026-06-24-unified-identity-capabilities-design.md).

**Scope of THIS plan:** Phase 0 (data foundation) and Phase 1 (read the capability + visible mode switch). These are fully executable now and behavior-preserving. **Phases 2–4 are roadmapped at the end and each gets its own detailed plan** when reached (Phase 2 needs the Google-first onboarding internals read; Phases 3–4 need the spec's Open Questions resolved). Phase 2 is where the doctor flow lights up.

---

## File Structure

**Phase 0**
- Create `server/migrations/v3.34_host_capability.sql` — add `is_host`, backfill, bidirectional `role`↔`is_host` sync trigger.
- Modify `server/controllers/authController.js` — `serializeProfile` returns `is_host`; export it for unit testing.
- Test `server/tests/unit/serializeProfile.test.js` (new).

**Phase 1**
- Modify `server/middleware/authMiddleware.js` — `requireHost` reads `is_host` (role fallback).
- Modify `client/src/utils/roleRoutes.js` — `isHost()` reads `is_host` (role fallback).
- Modify `client/src/context/AuthContext.jsx` — add `mode` state (`'traveling'|'hosting'`) + `setMode`, persisted in localStorage.
- Create `client/src/components/common/ModeSwitch.jsx` — the Hosting/Traveling toggle (renders only when `is_host`).
- Modify `client/src/components/common/Navbar.jsx` — mount `ModeSwitch`.
- Tests: extend `server/tests/integration/hostGuard.test.js`, `client/src/tests/roleRoutes.test.js`; new `client/src/tests/ModeSwitch.test.jsx`.

---

## PHASE 0 — Data foundation (no behavior change)

### Task 0.1: Migration — `is_host` column + backfill + mirror trigger

**Files:**
- Create: `server/migrations/v3.34_host_capability.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.34 Host capability (unified identity — Phase 0)
-- Adds profiles.is_host as the new source of truth for hosting capability.
-- `role` is kept as an auto-mirrored compatibility shim until the Phase 4 cleanup,
-- so all existing role-based guards/queries keep working unchanged.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false;

-- Backfill from the existing binary role. superadmin is NOT a hosting capability.
UPDATE profiles SET is_host = true WHERE role = 'host' AND is_host = false;

-- Bidirectional sync so BOTH legacy writers (which set role) and new writers
-- (which set is_host) stay consistent during the transition. superadmin preserved.
CREATE OR REPLACE FUNCTION sync_host_role() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'superadmin' THEN
      NEW.is_host := false;
    ELSIF NEW.is_host THEN
      NEW.role := 'host';
    ELSIF NEW.role = 'host' THEN
      NEW.is_host := true;
    ELSE
      NEW.role := 'guest';
      NEW.is_host := false;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: whichever column changed drives the other; is_host wins ties.
  IF NEW.role = 'superadmin' THEN
    NEW.is_host := false;
  ELSIF NEW.is_host IS DISTINCT FROM OLD.is_host THEN
    NEW.role := CASE WHEN NEW.is_host THEN 'host' ELSE 'guest' END;
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.is_host := (NEW.role = 'host');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_host_role ON profiles;
CREATE TRIGGER trg_sync_host_role
  BEFORE INSERT OR UPDATE OF is_host, role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_host_role();
```

- [ ] **Step 2: Apply to staging DB (Tokyo) via Supabase MCP / SQL editor**

Run the file's contents against the staging project. Expected: `ALTER TABLE`, `UPDATE n`, `CREATE FUNCTION`, `CREATE TRIGGER` all succeed.

- [ ] **Step 3: Verify backfill + trigger on staging**

```sql
-- counts match the old role distribution
SELECT role, is_host, count(*) FROM profiles GROUP BY 1,2 ORDER BY 1,2;
-- trigger: flipping is_host updates role
UPDATE profiles SET is_host = true WHERE id = '<a known guest id>';
SELECT role, is_host FROM profiles WHERE id = '<that id>'; -- expect host/true
-- revert
UPDATE profiles SET is_host = false WHERE id = '<that id>';
```
Expected: every `role='host'` row has `is_host=true`; `role='guest'` → `is_host=false`; `superadmin` rows have `is_host=false` and role unchanged.

- [ ] **Step 4: Apply to prod DB (Mumbai)** after staging verification. Same expected output.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/v3.34_host_capability.sql
git commit -m "feat(db): add profiles.is_host capability + role mirror trigger (v3.34, Phase 0)"
```

---

### Task 0.2: `serializeProfile` returns `is_host` (and is exported for tests)

**Files:**
- Modify: `server/controllers/authController.js` (`serializeProfile` ~line 63; `module.exports` ~line 1106)
- Test: `server/tests/unit/serializeProfile.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/serializeProfile.test.js
const { serializeProfile } = require('../../controllers/authController');

describe('serializeProfile', () => {
  test('projects is_host from the profile row', () => {
    const out = serializeProfile({ id: 'u1', role: 'host', is_host: true }, null);
    expect(out.is_host).toBe(true);
    expect(out.role).toBe('host'); // role still returned during the shim phases
  });

  test('is_host defaults to false when absent', () => {
    const out = serializeProfile({ id: 'u2', role: 'guest' }, null);
    expect(out.is_host).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm --prefix server test -- serializeProfile`
Expected: FAIL — `serializeProfile is not a function` (not yet exported).

- [ ] **Step 3: Add the field + export**

In `serializeProfile`'s returned object (after the `role:` line) add:
```js
  is_host:                  !!profile.is_host,
```
In `module.exports = { ... }` add `serializeProfile,`.

- [ ] **Step 4: Run it — expect PASS**

Run: `npm --prefix server test -- serializeProfile`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full server suite (no regression)**

Run: `npm --prefix server test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/authController.js server/tests/unit/serializeProfile.test.js
git commit -m "feat(auth): serializeProfile returns is_host (Phase 0)"
```

---

## PHASE 1 — Read the capability + visible mode switch (behavior identical)

### Task 1.1: `requireHost` reads `is_host` (role fallback)

**Files:**
- Modify: `server/middleware/authMiddleware.js` (`requireHost`, lines 57-77)
- Test: `server/tests/integration/hostGuard.test.js`

- [ ] **Step 1: Add failing tests for the is_host path**

Append to `hostGuard.test.js` a case where the profile has `is_host:true` but `role` is absent/stale, and assert `requireHost` calls `next()`; and a case `is_host:false, role:'guest'` → 403. (Mirror the file's existing mock style for `supabaseAdmin.from('profiles').select('is_host, role')`.)

- [ ] **Step 2: Run — expect FAIL** (`requireHost` still selects only `role`).

Run: `npm --prefix server test -- hostGuard`

- [ ] **Step 3: Update `requireHost`**

Replace the body's role-resolution block with:
```js
  try {
    let { is_host: isHost, role } = req.user;
    if (isHost === undefined && !role) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('is_host, role').eq('id', req.user.id).single();
      isHost = profile?.is_host;
      role = profile?.role;
      req.user.is_host = isHost;
      req.user.role = role;
    }
    if (isHost === true || role === 'host' || role === 'superadmin') return next();
    return res.status(403).json({
      message: 'Host account required. Turn on hosting to access this.',
      host_required: true,
    });
  } catch (_) {
    return res.status(403).json({ message: 'Host account required.', host_required: true });
  }
```

- [ ] **Step 4: Run — expect PASS** (`npm --prefix server test -- hostGuard`).

- [ ] **Step 5: Commit**

```bash
git add server/middleware/authMiddleware.js server/tests/integration/hostGuard.test.js
git commit -m "feat(auth): requireHost reads is_host with role fallback (Phase 1)"
```

---

### Task 1.2: client `isHost()` reads `is_host` (role fallback)

**Files:**
- Modify: `client/src/utils/roleRoutes.js` (`isHost`, lines 13-15)
- Test: `client/src/tests/roleRoutes.test.js`

- [ ] **Step 1: Add failing tests**

Add cases: `isHost({ is_host: true })` → true; `isHost({ is_host: false, role: 'guest' })` → false; existing `role:'host'`/`'superadmin'` still true.

- [ ] **Step 2: Run — expect FAIL** (`npm --prefix client test -- src/tests/roleRoutes.test.js`).

- [ ] **Step 3: Update `isHost`**

```js
export function isHost(user) {
  return user?.is_host === true || user?.role === 'host' || user?.role === 'superadmin';
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/roleRoutes.js client/src/tests/roleRoutes.test.js
git commit -m "feat(client): isHost reads is_host with role fallback (Phase 1)"
```

---

### Task 1.3: AuthContext `mode` state (persisted)

**Files:**
- Modify: `client/src/context/AuthContext.jsx`
- Test: `client/src/tests/AuthContextMode.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/tests/AuthContextMode.test.jsx
import { render, screen, act } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../services/api', () => ({ getMe: vi.fn(() => Promise.resolve({ data: {} })) }));

function Probe() {
  const { mode, setMode } = useAuth();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('hosting')}>go</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

test('mode defaults to traveling and persists when changed', () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByTestId('mode').textContent).toBe('traveling');
  act(() => screen.getByText('go').click());
  expect(screen.getByTestId('mode').textContent).toBe('hosting');
  expect(localStorage.getItem('bas_active_mode')).toBe('hosting');
});
```

- [ ] **Step 2: Run — expect FAIL** (`mode`/`setMode` undefined).

Run: `npm --prefix client test -- src/tests/AuthContextMode.test.jsx`

- [ ] **Step 3: Add `mode` to AuthContext**

In `AuthProvider`, add:
```jsx
const [mode, setModeState] = useState(() => localStorage.getItem('bas_active_mode') || 'traveling');
const setMode = (m) => { setModeState(m); localStorage.setItem('bas_active_mode', m); };
```
Add `mode, setMode` to the context `value={{ ... }}`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add client/src/context/AuthContext.jsx client/src/tests/AuthContextMode.test.jsx
git commit -m "feat(client): AuthContext active mode state (Phase 1)"
```

---

### Task 1.4: `ModeSwitch` component + mount in Navbar (cosmetic this phase)

**Files:**
- Create: `client/src/components/common/ModeSwitch.jsx`
- Modify: `client/src/components/common/Navbar.jsx` (mount it)
- Test: `client/src/tests/ModeSwitch.test.jsx` (create)

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/tests/ModeSwitch.test.jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect } from 'vitest';

let mockUser, mockMode = 'traveling';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, mode: mockMode, setMode: vi.fn() }),
}));
import ModeSwitch from '../components/common/ModeSwitch';

const at = () => render(<MemoryRouter><ModeSwitch /></MemoryRouter>);

test('renders the toggle for a host', () => {
  mockUser = { is_host: true };
  at();
  expect(screen.getByRole('button', { name: /hosting/i })).toBeTruthy();
});

test('renders nothing for a non-host', () => {
  mockUser = { is_host: false };
  const { container } = at();
  expect(container.firstChild).toBeNull();
});
```

- [ ] **Step 2: Run — expect FAIL** (no component).

- [ ] **Step 3: Implement `ModeSwitch`**

```jsx
// client/src/components/common/ModeSwitch.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isHost } from '../../utils/roleRoutes';

// Hosting/Traveling toggle for dual-capability accounts. Phase 1: switches mode
// and navigates to the matching space. Only rendered when the user can host.
export default function ModeSwitch() {
  const { user, mode, setMode } = useAuth();
  const navigate = useNavigate();
  if (!isHost(user)) return null;

  const go = (m) => { setMode(m); navigate(m === 'hosting' ? '/dashboard' : '/user/my-bookings'); };

  return (
    <div className="inline-flex rounded-full border border-gray-200 p-0.5 text-xs font-medium">
      <button type="button" onClick={() => go('traveling')}
        className={`px-3 py-1 rounded-full ${mode === 'traveling' ? 'bg-primary text-white' : 'text-gray-500'}`}>
        Traveling
      </button>
      <button type="button" onClick={() => go('hosting')}
        className={`px-3 py-1 rounded-full ${mode === 'hosting' ? 'bg-primary text-white' : 'text-gray-500'}`}>
        Hosting
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Mount in Navbar**

Import `ModeSwitch` in `client/src/components/common/Navbar.jsx` and render `<ModeSwitch />` in the authenticated area of the bar (next to the account menu). Keep it out of the dashboard/admin-hidden navbar contexts already handled by `App.jsx`'s `hideNavbar`.

- [ ] **Step 6: Run full client suite + build**

Run: `npm --prefix client test` then `npm --prefix client run build`
Expected: all green; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/common/ModeSwitch.jsx client/src/components/common/Navbar.jsx client/src/tests/ModeSwitch.test.jsx
git commit -m "feat(client): Hosting/Traveling mode switch in navbar (Phase 1)"
```

---

## PHASE 1 deploy + verify

- [ ] Open PR, merge to `main`, confirm Vercel deploy status = success on the merge commit and Render redeploys.
- [ ] Smoke: log in as an existing host → `is_host:true` in `/api/auth/me`; mode switch visible; routing unchanged (wall still identity-based until Phase 2). Log in as a guest → no switch, behavior unchanged.

---

## PHASE 2a — Relax the wall (the DOCTOR flow goes live)

Spike result (read `vendorOnboardingController.js` + routes): every `/api/onboarding/*` step is `protect`-guarded and mutates `req.user.id`'s own profile row. So nothing structurally blocks a host from also being a guest; the doctor (already a host) just needs the guest space unblocked. "Become a host" (the reverse) is split to 2b.

### Task 2a.1: `GuestRoute` opens to hosts

**Files:**
- Modify: `client/src/components/common/GuestRoute.jsx` (`GuestGate`)
- Test: `client/src/tests/RouteGuards.test.jsx`

- [ ] **Step 1: Update the guard tests (TDD).** Change the two host-bounce expectations to host-allowed:
  - `'redirects a host off a guest route to the dashboard'` → `'lets a host load a guest route (traveling space)'`, expecting `GUEST bookings`.
  - `'treats superadmin as host (off guest routes)'` → `'lets superadmin load a guest route'`, expecting `GUEST profile`.
- [ ] **Step 2: Run — expect FAIL** (`npm --prefix client test -- src/tests/RouteGuards.test.jsx`); current GuestRoute still bounces hosts.
- [ ] **Step 3: Make `GuestGate` a pass-through.**

```jsx
// Guest-space routes (/user/*) are open to ANY logged-in user. Unified identity:
// a host browsing/booking as a customer lives here in Traveling mode; the wall is
// now mode (a UI preference), not identity. Auth is still owned by ProtectedRoute.
const GuestGate = ({ children }) => children;
```
(Remove the now-unused `useAuth`/`isHost` imports.)

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(client): open /user/* guest space to hosts (Phase 2a)`.

### Task 2a.2: Confirm the host Trips view works end-to-end

`/user/my-bookings` (`CustomerBookings`) already calls `getGuestBookings` (any logged-in user) and renders cancel/reschedule/receipt/rebook by `guest_id` ownership — which is the host's own id for bookings they made. No code change expected.

- [ ] **Step 1:** Full client suite + `vite build` green.
- [ ] **Step 2:** Deploy-verify after merge: a host in Traveling mode reaches `/user/my-bookings`; a booking made while logged in as a host appears.

Deferred polish (needs Open Q2 "default mode"): make the Navbar nav-set mode-aware (host in Traveling mode shows customer nav). Out of 2a to avoid surprising existing hosts with a default-mode flip.

## PHASE 2b — "Become a host" (guest → host) — *own detailed plan*

Now unblocked by the spike. Sketch: `POST /api/auth/become-host` sets `is_host=true` on `req.user.id` (trigger mirrors role) + seeds onboarding state (`onboarding_slug` from current username, `onboarding_step_completed=1`, `onboarding_completed=false`); client routes the logged-in user into the EXISTING `/vendor-register/:slug/*` steps (which already operate on `req.user.id`), including Google Calendar connect via the legacy `GET /api/auth/google` (calendar_connect) flow. Resolve Open Q3 (plan-up-front vs free host shell) before writing the task-by-task plan.

## PHASE 3 — Unify login/identity — *own detailed plan, after Open Questions*

Resolve spec Open Questions (#1 password model, #2 default mode) first. One account holds email+phone; login-by-either resolves to one row; new signups never create duplicate guest/host rows; retire synthetic phone-emails for new accounts. Feature-flag the new resolution; full auth regression + staging pass before prod.

## PHASE 4 — Cleanup + legacy — *FUTURE / OPTIONAL, deferred indefinitely*

Drop the `role` shim + the `sync_host_role` trigger, and an optional opt-in "link accounts" flow for legacy duplicate humans. **Optional cleanup, not capability** — the shipped model (0–3) works without it; the `role` mirror can live on harmlessly forever. Full executable-cold write-up (audit checklist, drop migration, rollback, link-flow): [`2026-06-24-unified-identity-phase4-drop-role.md`](2026-06-24-unified-identity-phase4-drop-role.md).

---

## Self-Review notes

- **Spec coverage:** Phase 0 = spec §3.2 shim + §6 migration. Phase 1 = §3.2 capability reads + §3.3 mode switch (UI). Phases 2–4 map to spec §5 phases 2–4 and are explicitly deferred to their own plans (justified: onboarding-internals read + Open Questions). The `role` dependency inventory (spec §4) is consumed incrementally and finalized in Phase 4.
- **No silent caps:** Phases 2–4 are roadmap, not detailed tasks — by design, called out explicitly so it isn't mistaken for full coverage.
- **Type consistency:** `is_host` (snake_case) on DB + API payload + `req.user`; `mode` values `'traveling'|'hosting'`; localStorage key `bas_active_mode`; `isHost(user)` helper used by both `HostRoute` and `ModeSwitch`.
