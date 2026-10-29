# Guest / Host URL Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Namespace guest routes under `/user/*` and add a two-way role wall so guests can't sit on host (`/dashboard/*`) URLs and hosts can't sit on guest URLs, with backward-compat redirects for in-flight email links.

**Architecture:** Two thin guard wrappers (`HostRoute`, `GuestRoute`) compose the existing `ProtectedRoute` (which keeps owning auth + host-onboarding resume) and add the role check. A pure `hostPathToGuestPath` util maps a host URL a guest typed to the closest guest equivalent. `App.jsx` is rewired: guest pages move to `/user/*`, old flat paths become `<Navigate>` redirects, the leave-review page stays shared/top-level. The in-place `become-host` role flip (client + server) is removed — "Become a host" now routes to host signup, honoring phone=guest / email=host.

**Tech Stack:** React 18 + react-router-dom v6, Vitest + Testing Library (client), Jest (server), Express.

**Spec:** [docs/superpowers/specs/2026-06-24-guest-host-url-separation-design.md](../specs/2026-06-24-guest-host-url-separation-design.md)

---

## File Structure

**Create**
- `client/src/utils/roleRoutes.js` — pure host→guest path map.
- `client/src/components/common/HostRoute.jsx` — host-space guard.
- `client/src/components/common/GuestRoute.jsx` — guest-space guard.
- `client/src/tests/roleRoutes.test.js` — map unit tests.
- `client/src/tests/RouteGuards.test.jsx` — guard redirect tests.

**Modify (client)**
- `client/src/App.jsx` — `/user/*` routes, `HostRoute` on dashboard, old-path redirects.
- `client/src/components/common/Navbar.jsx` — customer link hrefs.
- `client/src/pages/Login.jsx` — default post-login redirect.
- `client/src/pages/CustomerProfile.jsx` — back link.
- `client/src/pages/ReviewPage.jsx` — two back links.
- `client/src/pages/BeASloth.jsx` — drop become-host flip; always Google signup.
- `client/src/pages/Dashboard.jsx` — drop become-host; redirect dead guest branch.
- `client/src/context/AuthContext.jsx` — remove `activateHost` helper.
- `client/src/services/api.js` — remove `activateHost`.
- `client/src/tests/AuthContext.test.jsx` — drop `activateHost` coverage.
- `client/public/robots.txt` — guest disallow paths.

**Modify (server)**
- `server/routes/authRoutes.js` — remove `/become-host`.
- `server/controllers/authController.js` — remove `becomeHost`.
- `server/services/email/emailLayout.js` — footer bookings link.
- `server/tests/unit/emailLayout.test.js` — assertion.
- `server/services/sitemapService.js` — drop `/reviews` entry.

**Delete**
- `server/tests/unit/becomeHost.test.js` — tests the removed handler.

---

## Task 1: Pure host→guest path map

**Files:**
- Create: `client/src/utils/roleRoutes.js`
- Test: `client/src/tests/roleRoutes.test.js`

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/roleRoutes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hostPathToGuestPath } from '../utils/roleRoutes';

describe('hostPathToGuestPath', () => {
  it('maps /dashboard/bookings → /user/my-bookings', () => {
    expect(hostPathToGuestPath('/dashboard/bookings')).toBe('/user/my-bookings');
  });
  it('maps /dashboard/profile → /user/profile', () => {
    expect(hostPathToGuestPath('/dashboard/profile')).toBe('/user/profile');
  });
  it('falls back to /user/my-bookings when there is no guest equivalent', () => {
    expect(hostPathToGuestPath('/dashboard')).toBe('/user/my-bookings');
    expect(hostPathToGuestPath('/dashboard/earnings')).toBe('/user/my-bookings');
    expect(hostPathToGuestPath('/dashboard/payments/payouts')).toBe('/user/my-bookings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/roleRoutes.test.js`
Expected: FAIL — cannot resolve `../utils/roleRoutes`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/utils/roleRoutes.js`:

```js
// Maps a host-space (/dashboard/*) path that a guest tried to open to the closest
// guest-space (/user/*) equivalent. Only bookings and profile have a true 1:1
// counterpart; everything else (earnings, services, availability, products,
// upgrade, payments, feedback) has no guest analogue → guest home.
export function hostPathToGuestPath(pathname) {
  if (pathname.startsWith('/dashboard/bookings')) return '/user/my-bookings';
  if (pathname.startsWith('/dashboard/profile')) return '/user/profile';
  return '/user/my-bookings';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/tests/roleRoutes.test.js`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/roleRoutes.js client/src/tests/roleRoutes.test.js
git commit -m "feat(client): host→guest path map for role redirects"
```

---

## Task 2: Role guard wrappers (HostRoute / GuestRoute)

**Files:**
- Create: `client/src/components/common/HostRoute.jsx`
- Create: `client/src/components/common/GuestRoute.jsx`
- Test: `client/src/tests/RouteGuards.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/RouteGuards.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ProtectedRoute's auth + onboarding-resume behavior is covered by its own tests.
// Here we isolate the ROLE wall by stubbing ProtectedRoute to a pass-through.
vi.mock('../components/common/ProtectedRoute', () => ({
  default: ({ children }) => children,
}));

const mockUser = { current: null };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

import HostRoute from '../components/common/HostRoute';
import GuestRoute from '../components/common/GuestRoute';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<div>DASHBOARD home</div>} />
        <Route path="/dashboard/bookings" element={<HostRoute><div>HOST bookings</div></HostRoute>} />
        <Route path="/dashboard/earnings" element={<HostRoute><div>HOST earnings</div></HostRoute>} />
        <Route path="/user/my-bookings" element={<GuestRoute><div>GUEST bookings</div></GuestRoute>} />
        <Route path="/user/profile" element={<GuestRoute><div>GUEST profile</div></GuestRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('role route guards', () => {
  beforeEach(() => { mockUser.current = null; });

  it('redirects a guest off a host route to the guest equivalent', () => {
    mockUser.current = { role: 'user' };
    renderAt('/dashboard/bookings');
    expect(screen.getByText('GUEST bookings')).toBeInTheDocument();
  });

  it('redirects a guest off a host route with no equivalent to guest home', () => {
    mockUser.current = { role: 'user' };
    renderAt('/dashboard/earnings');
    expect(screen.getByText('GUEST bookings')).toBeInTheDocument();
  });

  it('redirects a host off a guest route to the dashboard', () => {
    mockUser.current = { role: 'host' };
    renderAt('/user/my-bookings');
    expect(screen.getByText('DASHBOARD home')).toBeInTheDocument();
  });

  it('lets a host load a host route', () => {
    mockUser.current = { role: 'host' };
    renderAt('/dashboard/bookings');
    expect(screen.getByText('HOST bookings')).toBeInTheDocument();
  });

  it('lets a guest load a guest route', () => {
    mockUser.current = { role: 'user' };
    renderAt('/user/profile');
    expect(screen.getByText('GUEST profile')).toBeInTheDocument();
  });

  it('treats superadmin as host (off guest routes)', () => {
    mockUser.current = { role: 'superadmin' };
    renderAt('/user/profile');
    expect(screen.getByText('DASHBOARD home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/RouteGuards.test.jsx`
Expected: FAIL — cannot resolve `../components/common/HostRoute`.

- [ ] **Step 3: Implement HostRoute**

Create `client/src/components/common/HostRoute.jsx`:

```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import { hostPathToGuestPath } from '../../utils/roleRoutes';

// Role wall for host-space routes (/dashboard/*). Auth + host-onboarding resume
// are owned by ProtectedRoute; this only enforces role: a non-host who reaches a
// host URL is sent to the matching guest URL.
const HostGate = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isHost = user?.role === 'host' || user?.role === 'superadmin';
  if (!isHost) return <Navigate to={hostPathToGuestPath(location.pathname)} replace />;
  return children;
};

const HostRoute = ({ children }) => (
  <ProtectedRoute>
    <HostGate>{children}</HostGate>
  </ProtectedRoute>
);

export default HostRoute;
```

- [ ] **Step 4: Implement GuestRoute**

Create `client/src/components/common/GuestRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';

// Role wall for guest-space routes (/user/*). Auth is owned by ProtectedRoute;
// this only enforces role: a host/superadmin has no guest space, so send them to
// their dashboard.
const GuestGate = ({ children }) => {
  const { user } = useAuth();
  const isHost = user?.role === 'host' || user?.role === 'superadmin';
  if (isHost) return <Navigate to="/dashboard" replace />;
  return children;
};

const GuestRoute = ({ children }) => (
  <ProtectedRoute>
    <GuestGate>{children}</GuestGate>
  </ProtectedRoute>
);

export default GuestRoute;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/tests/RouteGuards.test.jsx`
Expected: PASS (6 assertions).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/common/HostRoute.jsx client/src/components/common/GuestRoute.jsx client/src/tests/RouteGuards.test.jsx
git commit -m "feat(client): HostRoute/GuestRoute two-way role guards"
```

---

## Task 3: Wire App.jsx — /user/* namespace, host guard, old-path redirects

**Files:**
- Modify: `client/src/App.jsx`

> **Note (no code change needed):** react-router v6 ranks routes by specificity, not source order, so the static `/user/*` and old flat redirects automatically outrank the `/:profileSlug` catch-all. Reserve `user` (and `dashboard`) as host usernames in a future cleanup so a host can't claim a colliding slug — out of scope here; no current route is bare `/user`.

- [ ] **Step 1: Add guard imports**

In `client/src/App.jsx`, immediately after the existing `import ProtectedRoute from './components/common/ProtectedRoute';` line, add:

```jsx
import HostRoute from './components/common/HostRoute';
import GuestRoute from './components/common/GuestRoute';
```

- [ ] **Step 2: Swap DashboardWrapper to HostRoute**

Replace the `DashboardWrapper` function:

```jsx
function DashboardWrapper({ children }) {
  return <ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>;
}
```

with:

```jsx
function DashboardWrapper({ children }) {
  return <HostRoute><DashboardLayout>{children}</DashboardLayout></HostRoute>;
}
```

- [ ] **Step 3: Move guest routes to /user/* and add redirects**

Replace this block (the guest routes + their comment):

```jsx
          {/* Guests land here after login — dedicated read-only bookings list
              (no longer the vendor Dashboard). */}
          <Route path="/my-bookings" element={<ProtectedRoute><CustomerBookings /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><CustomerReviews /></ProtectedRoute>} />
          {/* Leave a review for one completed booking (target of the booking-completed email CTA) */}
          <Route path="/review/:bookingId" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
          <Route path="/loyalty" element={<ProtectedRoute><Loyalty /></ProtectedRoute>} />
```

with:

```jsx
          {/* Guest (customer) space — /user/* . A host hitting these is bounced to
              /dashboard by GuestRoute; a guest hitting /dashboard/* is bounced here. */}
          <Route path="/user/my-bookings" element={<GuestRoute><CustomerBookings /></GuestRoute>} />
          <Route path="/user/profile" element={<GuestRoute><CustomerProfile /></GuestRoute>} />
          <Route path="/user/reviews" element={<GuestRoute><CustomerReviews /></GuestRoute>} />
          <Route path="/user/loyalty" element={<GuestRoute><Loyalty /></GuestRoute>} />

          {/* Leave a review for one completed booking (booking-completed email CTA).
              Shared + ownership-checked: either party to a booking may use it, so it
              stays role-agnostic and top-level — NOT under /user. */}
          <Route path="/review/:bookingId" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />

          {/* Backward-compat: old flat guest paths → /user/* (in-flight emails, bookmarks). */}
          <Route path="/my-bookings" element={<Navigate to="/user/my-bookings" replace />} />
          <Route path="/profile" element={<Navigate to="/user/profile" replace />} />
          <Route path="/reviews" element={<Navigate to="/user/reviews" replace />} />
          <Route path="/loyalty" element={<Navigate to="/user/loyalty" replace />} />
```

- [ ] **Step 4: Verify client build + existing suite still green**

Run: `cd client && npm run build`
Expected: build succeeds (no unresolved imports).

Run: `cd client && npm test`
Expected: PASS — all existing tests plus Task 1/2 tests. (No test references the old flat `/my-bookings` route element directly; `ReviewPage.test.jsx` mounts its own `MemoryRouter` so it is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat(client): namespace guest routes under /user/*, host-guard dashboard, redirect old paths"
```

---

## Task 4: Update in-app guest links

**Files:**
- Modify: `client/src/components/common/Navbar.jsx`
- Modify: `client/src/pages/Login.jsx`
- Modify: `client/src/pages/CustomerProfile.jsx`
- Modify: `client/src/pages/ReviewPage.jsx`

- [ ] **Step 1: Navbar customer links**

In `client/src/components/common/Navbar.jsx`:

In `CUSTOMER_NAV`, change:
```jsx
  { label: 'Bookings', href: '/my-bookings', icon: CalendarCheck },
```
to:
```jsx
  { label: 'Bookings', href: '/user/my-bookings', icon: CalendarCheck },
```

In `CUSTOMER_DROPDOWN`, change the four guest entries:
```jsx
  { label: 'My Bookings',     href: '/my-bookings', icon: CalendarCheck },
  { label: 'My Profile',      href: '/profile',     icon: User },
  { label: 'Help',            href: '/help',        icon: HelpCircle },
  { label: 'Loyalty Program', href: '/loyalty',     icon: Gift },
  { label: 'Reviews',         href: '/reviews',     icon: Star },
```
to:
```jsx
  { label: 'My Bookings',     href: '/user/my-bookings', icon: CalendarCheck },
  { label: 'My Profile',      href: '/user/profile',     icon: User },
  { label: 'Help',            href: '/help',             icon: HelpCircle },
  { label: 'Loyalty Program', href: '/user/loyalty',     icon: Gift },
  { label: 'Reviews',         href: '/user/reviews',     icon: Star },
```

- [ ] **Step 2: Login default redirect**

In `client/src/pages/Login.jsx`, change:
```jsx
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/my-bookings";
```
to:
```jsx
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/user/my-bookings";
```

- [ ] **Step 3: CustomerProfile back link**

In `client/src/pages/CustomerProfile.jsx`, change the `to="/my-bookings"` link:
```jsx
        <Link to="/my-bookings" className="text-sm text-[#FE5100] hover:underline mt-3 inline-block">← Back to bookings</Link>
```
to:
```jsx
        <Link to="/user/my-bookings" className="text-sm text-[#FE5100] hover:underline mt-3 inline-block">← Back to bookings</Link>
```

- [ ] **Step 4: ReviewPage back links (both)**

In `client/src/pages/ReviewPage.jsx`, change both occurrences of `to="/my-bookings"` to `to="/user/my-bookings"` (lines ~91 and ~107 — the two "back to bookings" links). Use replace-all on the exact string `to="/my-bookings"`.

- [ ] **Step 5: Verify**

Run: `cd client && npm test`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/common/Navbar.jsx client/src/pages/Login.jsx client/src/pages/CustomerProfile.jsx client/src/pages/ReviewPage.jsx
git commit -m "feat(client): point guest nav + back links at /user/*"
```

---

## Task 5: Remove the in-place become-host opt-in (client)

**Files:**
- Modify: `client/src/services/api.js`
- Modify: `client/src/context/AuthContext.jsx`
- Modify: `client/src/pages/BeASloth.jsx`
- Modify: `client/src/pages/Dashboard.jsx`
- Test: `client/src/tests/AuthContext.test.jsx`

- [ ] **Step 1: Update AuthContext test first (drop activateHost coverage)**

In `client/src/tests/AuthContext.test.jsx`:
- Remove `activateHost: vi.fn(),` from the `../services/api` mock object.
- Remove `activateHost` from the destructured import `import { loginUser, registerVendor, registerUser, getMe, activateHost } from '../services/api';` → leave `import { loginUser, registerVendor, registerUser, getMe } from '../services/api';`.
- Remove the `becomeHost` test button line: `<button onClick={() => auth.activateHost().catch(() => {})}>becomeHost</button>`.
- Remove the entire `describe('activateHost', ...)` block (the `// ── activateHost (guest → host opt-in) ──` section and its body).

- [ ] **Step 2: Remove activateHost from api.js**

In `client/src/services/api.js`, delete the line:
```js
export const activateHost     = ()             => API.post('/auth/become-host');
```

- [ ] **Step 3: Remove activateHost from AuthContext**

In `client/src/context/AuthContext.jsx`:

In the import from `../services/api`, remove `activateHost as apiActivateHost,` (keep the rest of the import intact).

Delete the helper:
```jsx
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

In the context provider `value={{ ... }}`, remove `activateHost,` from the list (it sits next to `adoptSession`).

- [ ] **Step 4: BeASloth — always Google signup (no flip)**

In `client/src/pages/BeASloth.jsx`:

Change the destructure:
```jsx
  const { startVendorGoogleAuth, user, activateHost } = useAuth();
```
to:
```jsx
  const { startVendorGoogleAuth, user } = useAuth();
```

Delete the logged-in-guest flip block:
```jsx
  // A logged-in guest already has an account — opt in via the server-enforced
  // switch rather than a fresh Google signup (which would reject their email).
  const isLoggedInGuest = user && user.role !== 'host' && user.role !== 'superadmin';
  const handleBecomeHost = async () => {
    setLoading(true);
    try {
      await activateHost();
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not switch on hosting. Please try again.');
      setLoading(false);
    }
  };
```

Replace the CTA ternary:
```jsx
          {isLoggedInGuest ? (
            <button
              onClick={handleBecomeHost}
              disabled={loading}
              className="btn mt-7 flex w-full items-center justify-center gap-3 bg-primary py-3 text-sm font-bold text-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Setting up…' : 'Become a host'}
            </button>
          ) : (
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="btn btn--outline mt-7 flex w-full items-center justify-center gap-3 bg-white py-3 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? 'Opening Google…' : 'Continue with Google'}
            </button>
          )}
```
with (one button — separate-account host signup for everyone who isn't already a host; logged-in hosts are already redirected away by the effect above):
```jsx
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="btn btn--outline mt-7 flex w-full items-center justify-center gap-3 bg-white py-3 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition disabled:opacity-50"
          >
            <GoogleIcon />
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </button>
```

- [ ] **Step 5: Dashboard — drop become-host, redirect the (now-dead) guest branch**

In `client/src/pages/Dashboard.jsx`:

Ensure `Navigate` is imported from `react-router-dom` (add it to the existing `react-router-dom` import if absent).

Change the `useAuth()` destructure on line ~82:
```jsx
  const { user, connectGoogleCalendar, updateUser, activateHost } = useAuth();
```
to:
```jsx
  const { user, connectGoogleCalendar, updateUser } = useAuth();
```

Delete the opt-in state + handler:
```jsx
  // Explicit guest→host opt-in. The server enforces the role flip; on success we
  // re-route so ProtectedRoute drives the user into host onboarding.
  const [activatingHost, setActivatingHost] = useState(false);
  const handleBecomeHost = async () => {
    setActivatingHost(true);
    try {
      await activateHost();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not switch on hosting. Please try again.');
    } finally {
      setActivatingHost(false);
    }
  };
```

Replace the entire guest branch (the `if (!isHost) { return ( ... <GuestBookings /> ... ); }` block, lines ~181–206) with a redirect — guests can no longer reach `/dashboard` (HostRoute bounces them), so this is defense-in-depth:
```jsx
  if (!isHost) return <Navigate to="/user/my-bookings" replace />;
```

Remove the now-unused `GuestBookings` import at the top of the file.

- [ ] **Step 6: Run client tests + build**

Run: `cd client && npm test`
Expected: PASS — including the edited `AuthContext.test.jsx` (no `activateHost` references remain).

Run: `cd client && npm run build`
Expected: build succeeds — no unused-import or unresolved-symbol errors (`GuestBookings`, `activateHost`, `activatingHost`, `handleBecomeHost`, `isLoggedInGuest` all gone).

- [ ] **Step 7: Commit**

```bash
git add client/src/services/api.js client/src/context/AuthContext.jsx client/src/pages/BeASloth.jsx client/src/pages/Dashboard.jsx client/src/tests/AuthContext.test.jsx
git commit -m "refactor(client): remove in-place become-host flip; host signup is a separate account"
```

---

## Task 6: Remove the become-host endpoint (server)

**Files:**
- Modify: `server/routes/authRoutes.js`
- Modify: `server/controllers/authController.js`
- Delete: `server/tests/unit/becomeHost.test.js`

- [ ] **Step 1: Delete the now-obsolete unit test**

```bash
git rm server/tests/unit/becomeHost.test.js
```

- [ ] **Step 2: Remove the route**

In `server/routes/authRoutes.js`:
- Remove `becomeHost,` from the destructured `require('../controllers/authController')` import.
- Delete the route + its comment:
```js
// Explicit, server-enforced guest→host opt-in (the only legit role flip).
router.post('/become-host', protect, becomeHost);
```

- [ ] **Step 3: Remove the handler**

In `server/controllers/authController.js`:
- Delete the whole `becomeHost` function (the `// POST /api/auth/become-host …` comment block through its closing `};`, lines ~1091–1130).
- Remove `becomeHost,` from the `module.exports = { ... }` object.

- [ ] **Step 4: Run server suite**

Run: `cd server && npm test`
Expected: PASS — no broken import of `becomeHost`; no test references the removed route.

- [ ] **Step 5: Commit**

```bash
git add server/routes/authRoutes.js server/controllers/authController.js
git commit -m "refactor(server): remove /auth/become-host role-flip endpoint"
```

---

## Task 7: Update server + static path references

**Files:**
- Modify: `server/services/email/emailLayout.js`
- Modify: `server/tests/unit/emailLayout.test.js`
- Modify: `client/public/robots.txt`
- Modify: `server/services/sitemapService.js`

- [ ] **Step 1: Update the email-layout test assertion first**

In `server/tests/unit/emailLayout.test.js`, change:
```js
    expect(html).toContain('https://x.test/my-bookings');
```
to:
```js
    expect(html).toContain('https://x.test/user/my-bookings');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && npx jest tests/unit/emailLayout.test.js`
Expected: FAIL — layout still emits `/my-bookings`.

- [ ] **Step 3: Update the email footer link**

In `server/services/email/emailLayout.js`, change:
```js
    lk(`${website}/my-bookings`, 'My Bookings'),
```
to:
```js
    lk(`${website}/user/my-bookings`, 'My Bookings'),
```

- [ ] **Step 4: Verify the email test passes**

Run: `cd server && npx jest tests/unit/emailLayout.test.js`
Expected: PASS.

- [ ] **Step 5: Update robots.txt**

In `client/public/robots.txt`, change:
```
Disallow: /my-bookings
```
to `Disallow: /user/my-bookings`, and:
```
Disallow: /loyalty
```
to `Disallow: /user/loyalty`. (Leave any other lines untouched.)

- [ ] **Step 6: Drop the auth-gated /reviews sitemap entry**

In `server/services/sitemapService.js`, delete the static entry:
```js
  { path: '/reviews',                  changefreq: 'weekly',  priority: '0.5' },
```
(Public review content stays indexed via per-host-profile pages; auth-gated `/user/*` pages are never sitemapped.)

- [ ] **Step 7: Run full server suite**

Run: `cd server && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/services/email/emailLayout.js server/tests/unit/emailLayout.test.js client/public/robots.txt server/services/sitemapService.js
git commit -m "feat: point email/robots at /user/*; drop auth-gated /reviews from sitemap"
```

---

## Task 8: Full verification + preview smoke

**Files:** none (verification only)

- [ ] **Step 1: Full suites green**

Run: `cd server && npm test` → Expected: PASS.
Run: `cd client && npm test` → Expected: PASS.
Run: `cd client && npm run build` → Expected: build succeeds.

- [ ] **Step 2: Preview smoke — guest wall**

Start the dev server (preview_start). With a **guest** session (role `user`):
- Navigate to `/dashboard/bookings` → URL should land on `/user/my-bookings` (CustomerBookings renders).
- Navigate to `/dashboard/earnings` → lands on `/user/my-bookings`.
- Navigate to `/my-bookings` (old path) → lands on `/user/my-bookings`.

- [ ] **Step 3: Preview smoke — host wall**

With a **host** session (role `host`):
- Navigate to `/user/my-bookings` → lands on `/dashboard`.
- Navigate to `/dashboard/bookings` → renders host bookings (not redirected).

Capture a preview screenshot of the guest landing on `/user/my-bookings` after typing a `/dashboard/*` URL as proof.

- [ ] **Step 4: Update working docs**

Append a short note to `docs/current-work.md` under recent changes: guest space is now `/user/*`; two-way role wall (`HostRoute`/`GuestRoute`); become-host in-place flip removed (host signup = separate account); old flat guest paths redirect.

- [ ] **Step 5: Commit + open PR**

```bash
git add docs/current-work.md
git commit -m "docs: record guest/host URL separation"
git push -u origin feat/guest-host-url-separation
gh pr create --title "feat: guest/host URL separation (/user/* namespace + two-way role wall)" --body "<summary + test evidence + preview screenshot>"
```

---

## Self-Review

**Spec coverage:**
- §A guest namespace `/user/*` → Task 3 (routes) + Task 4 (links). ✓
- §A `/review/:bookingId` stays shared/top-level → Task 3 keeps it on `ProtectedRoute`. ✓
- §B two-way guards + redirect map → Task 1 (map) + Task 2 (guards) + Task 3 (wiring). ✓
- §B onboarding-resume retained → guards compose `ProtectedRoute` unchanged; Task 3 Step 4 confirms existing suite green. ✓
- §C backward-compat redirects → Task 3 Step 3. ✓
- §D remove become-host (client) → Task 5; (server) → Task 6. ✓
- §E email/robots/sitemap/login/links → Task 4 (login + links), Task 7 (email/robots/sitemap). ✓
- §F no DB change → none present. ✓
- §G tests → Task 1, 2, 5, 7 add/adjust; Task 8 full verify. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after. PR body `<summary …>` is an intentional author fill at submit time, not a code placeholder. ✓

**Type/name consistency:** `hostPathToGuestPath` used identically in Task 1, 2, and HostRoute. Guard names `HostRoute`/`GuestRoute` consistent across Tasks 2–3. `activateHost` removed everywhere it was referenced (api.js, AuthContext, BeASloth, Dashboard, AuthContext.test). `becomeHost` removed from routes + controller + deleted test. ✓
