# Onboarding Google-First Reshape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile 12-step email/OTP/password host onboarding with a 7-step Google-first flow whose state lives entirely server-side, where profile data is pulled from Google, completion is gated on real payment, and no screen exceeds one viewport.

**Architecture:** Google OAuth (which already exists for hosts via `startVendorGoogleAuth`) becomes the sole entry. The server callback captures name-split + avatar from the Google identity and seeds onboarding. Every step page reads the server step pointer (`profiles.onboarding_step_completed`) as the single source of truth, writes its step *before* navigating, and is reachable only at the right point via a resume map. The email steps (slug-first claim, OTP verify, password) and the deferred steps (work-hours, profile photo, first service) are removed from the flow.

**Tech Stack:** React 18 + Vite + react-router-dom v6 (client, Vitest), Node + Express 4 (server, Jest), Supabase (Postgres + Auth), Razorpay subscriptions. Google OAuth via `server/config/google.js` (googleapis).

---

## Scope & Phasing

This spans four loosely-coupled subsystems. Each phase is an **independently shippable PR** that leaves the app working:

| Phase | Subsystem | Ships on its own? |
|---|---|---|
| 1 | Google identity capture (name split + avatar) | Yes — pure additive: callback writes more profile fields |
| 2 | Flow reshape (state machine, remove email + deferred steps, Back nav, server-truth resume) | Yes — the new 7-step flow |
| 3 | Payment-gated completion + dead-code removal | Yes — completion correctness |
| 4 | Category page redesign | Yes — drop-in replacement for the category step |

Recommended merge order: 1 → 2 → 3 → 4. Phase 2 depends on Phase 1's fields existing. Phase 4 can land any time after Phase 2 (it replaces the category step component).

---

## Current-State Map (read before starting)

**The flow as it exists today (the thing we are replacing):**

- Client routes: `client/src/App.jsx:209-220` — 12 bare `<Route>`s under `/vendor-register/*`.
- Resume logic: `client/src/components/common/ProtectedRoute.jsx:48-69` — array indexed by `onboarding_step_completed`, **off-by-one** (`steps[stepCompleted]`, no `+1`).
- Server onboarding controller: `server/controllers/vendorOnboardingController.js` — slug/OTP/account/update-step/order/verify/activate/status/resume.
- Server onboarding routes: `server/routes/vendorOnboardingRoutes.js` — public `check-slug`/`send-otp`/`verify-otp`/`create-account`, protected `update-step`/`status`/`create-order`/`verify-payment`/`mark-complete`.
- Onboarding step columns: `server/migrations/v1.8_vendor_onboarding.sql` — `onboarding_slug`, `onboarding_step_completed`, `vendor_type`, `categories`, `booking_type`, `calendar_connected/skipped`, `onboarding_completed`, `plan_activated_at`.

**The Google host auth that already exists (the thing we are reusing):**

- Client trigger: `AuthContext.jsx:126-129` `startVendorGoogleAuth('signup'|'login')` → `api.js:93` `getVendorGoogleUrl` → `GET /auth/google/vendor`.
- Server callback: `server/controllers/authController.js:354-458` `googleCallback` (`GET /auth/google/callback`). For a **new** host it: creates the auth user (`:394`), calls `upsertProfile({id,name,email,role:'host'})` (`:405-410`), then `markGoogleVendorOnboarding(profileId, profile.username)` (`:418`) which **sets `onboarding_step_completed = 3` and uses the username as `onboarding_slug`**, then mints a session and redirects to `/auth/google/done#access_token=…`.
- Profile upsert: `authController.js:94-124` `upsertProfile({id,name,email,role,username})` — **does not currently accept `first_name`, `last_name`, or `avatar`.**
- OAuth scopes (already include identity): `server/config/google.js:13-19` — `calendar`, `calendar.events`, `openid`, `email`, `profile`.
- Client callback page: `client/src/pages/GoogleAuthDone.jsx:31` → `AuthContext.adoptSession`.
- Profile columns that **exist**: `name`, `email`, `profile_image`, `phone`, `bio`, `username`. Columns that **do not exist**: `first_name`, `last_name`, `avatar`/`picture`.

**Audit findings → how this reshape resolves each (spec coverage):**

| Audit finding | Resolution |
|---|---|
| Refresh wipes `sessionStorage` identity → broken account | Phase 2: no client-held identity; Google + server pointer |
| Resume off-by-one | Phase 2: explicit `RESUME` map keyed by completed value |
| Step-6 client/server mismatch (`work_hours_set` vs `calendar_*`) | Phase 2: work-hours removed from onboarding |
| Service-before-plan hard block | Phase 2: first-service removed from onboarding (deferred to dashboard) |
| Fire-and-forget step writes (drift) | Phase 2: every step awaits its save before navigating |
| Completion without paid plan | Phase 3: `mark-complete` gated on active plan |
| Dead `verify-payment`/`activatePlan` code | Phase 3: removed |
| Duplicate WhatsApp verify + dashboard re-ask | Phase 2: single verify; dashboard reads the flag |
| No Back button; URL-jumpable | Phase 2: Back on every step; resume redirect guards order |
| Category page UX (60 cats, 2-col, fake "saving") | Phase 4: search-first redesign |

---

## File Structure

**Phase 1 — Google identity capture**
- Create: `server/migrations/v3.30_profile_name_split.sql` — adds `first_name`, `last_name` to `profiles`.
- Modify: `server/controllers/authController.js` — `upsertProfile` accepts/writes `first_name`/`last_name`/`avatar`; `googleCallback` passes Google `given_name`/`family_name`/`picture`.
- Modify: `server/config/google.js` — ensure `exchangeGoogleCode` surfaces `given_name`/`family_name`/`picture` on `googleUser`.
- Test: `server/tests/unit/googleProfileCapture.test.js`.

**Phase 2 — Flow reshape**
- Create: `client/src/pages/onboarding/GoogleStart.jsx` — the `/vendor-register` Google CTA landing.
- Create: `client/src/pages/onboarding/AboutYouStep.jsx` — merged host-type + booking-type.
- Create: `client/src/pages/onboarding/useOnboardingGuard.js` — shared hook: load status, redirect if out of place.
- Modify: `client/src/pages/onboarding/SlugClaim.jsx` — becomes the authed post-Google slug **claim** (pre-filled, editable, awaits save).
- Modify: `client/src/pages/onboarding/WhatsAppStep.jsx`, `ExploreWithBolt.jsx` — add guard + Back; await saves.
- Modify: `client/src/App.jsx` — new 7-route map; drop removed routes/lazy imports.
- Modify: `client/src/components/common/ProtectedRoute.jsx` — `RESUME` map, slug-optional in-flow check.
- Delete: `client/src/pages/onboarding/OtpVerify.jsx`, `PasswordStep.jsx`, `VendorTypeStep.jsx`, `BookingTypeStep.jsx`, `WorkHoursStep.jsx`, `ProfileStep.jsx`, `FirstServiceStep.jsx`.
- Modify: `server/controllers/vendorOnboardingController.js` — new step→column map; `claimSlug`; `getResumeStep` deleted; `markGoogleVendorOnboarding` step value.
- Modify: `server/controllers/authController.js` — `markGoogleVendorOnboarding` sets `onboarding_step_completed = 1`.
- Modify: `server/routes/vendorOnboardingRoutes.js` — remove email endpoints; add `POST /onboarding/claim-slug`.
- Test: `server/tests/unit/onboardingClaimSlug.test.js`, `client/src/tests/AboutYouStep.test.jsx`, `client/src/tests/onboardingResume.test.jsx`.

**Phase 3 — Payment-gated completion**
- Modify: `server/routes/vendorOnboardingRoutes.js` — `mark-complete` requires an active plan; delete `create-order`(paid)/`verify-payment`.
- Modify: `server/controllers/vendorOnboardingController.js` — remove `createRazorpayOrder`/`verifyRazorpayPayment`/`activatePlan`(onboarding copy); add `activateFreePlan`; `markComplete` guard.
- Modify: `client/src/pages/onboarding/PlansStep.jsx` — `modal.ondismiss`; verify activation via `getMe` before advancing.
- Modify: `client/src/services/api.js` — drop `verifyOnboardingPayment`; add `activateFreePlan` if needed.
- Test: `server/tests/unit/onboardingCompletionGate.test.js`.

**Phase 4 — Category redesign**
- Modify: `client/src/pages/onboarding/CategoryStep.jsx` — rebuild per mockup (search, live matches, custom-add `+` auto-pick, selected chip, ≤100vh, internal-scroll list, awaited save).
- Test: `client/src/tests/CategoryStep.test.jsx` (extend existing).

---

## Phase 1 — Google Identity Capture

### Task 1.1: Migration — name split columns

**Files:**
- Create: `server/migrations/v3.30_profile_name_split.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.30: split-name capture for Google-sourced host profiles.
-- profile_image already exists; we only add first/last name.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;
```

- [ ] **Step 2: Apply to BOTH Supabase DBs** (Mumbai prod `ayjhlwyzszykqtnaktpb`, Tokyo staging `xwvciqkayammbvsidqig`) via the Supabase MCP `apply_migration` or SQL editor. Verify with `list_tables` that `profiles.first_name` / `last_name` exist.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.30_profile_name_split.sql
git commit -m "feat(db): add first_name/last_name to profiles (v3.30)"
```

### Task 1.2: `upsertProfile` writes name split + avatar

**Files:**
- Modify: `server/controllers/authController.js:94-124`
- Test: `server/tests/unit/googleProfileCapture.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const { __test } = require('../../controllers/authController');
// upsertProfile is not exported today — export it for testing (Step 3).

describe('upsertProfile name split + avatar', () => {
  it('passes first_name, last_name, profile_image through to the upsert payload', async () => {
    const captured = {};
    const fakeAdmin = {
      from: () => ({
        upsert: (row) => { Object.assign(captured, row); return { select: () => ({ single: () => ({ data: { ...row, id: row.id }, error: null }) }) }; },
        select: () => ({ eq: () => ({ maybeSingle: () => ({ data: { username: 'keep-me' } }) }) }),
      }),
    };
    await __test.upsertProfileWith(fakeAdmin, {
      id: 'u1', name: 'Ada Lovelace', email: 'a@b.com', role: 'host',
      first_name: 'Ada', last_name: 'Lovelace', avatar: 'https://img/x.png',
    });
    expect(captured.first_name).toBe('Ada');
    expect(captured.last_name).toBe('Lovelace');
    expect(captured.profile_image).toBe('https://img/x.png');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd server && npx jest tests/unit/googleProfileCapture.test.js`
Expected: FAIL — `__test.upsertProfileWith` undefined.

- [ ] **Step 3: Implement** — extend the `upsertProfile` signature and payload, and expose a DI seam for the test.

In `authController.js`, change the signature and the upsert object:

```javascript
const upsertProfile = async ({ id, name, email, role, username, first_name, last_name, avatar }) => {
  // ...existing username resolution unchanged...
  const row = {
    id,
    name,
    email: email.toLowerCase().trim(),
    role,
    username: slug,
    updated_at: new Date().toISOString(),
  };
  if (first_name !== undefined) row.first_name = first_name;
  if (last_name !== undefined) row.last_name = last_name;
  // Only set the photo when one was supplied AND the row has none — never
  // clobber a user-edited dashboard photo on a later Google re-login.
  if (avatar) row.profile_image = avatar;

  const { data, error } = await supabaseAdmin.from('profiles')
    .upsert(row, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  await usernameService.recordInitialUsername(id, slug);
  return data;
};
```

Add at the bottom of the file (near other exports) a test seam:

```javascript
module.exports.__test = {
  upsertProfileWith: async (admin, args) => {
    const real = supabaseAdmin; // swap for the fake, run, restore
    try { /* eslint-disable */ global.__sa = admin; } finally {}
    return upsertProfile(args);
  },
};
```

> Note for the executor: if a clean DI seam is awkward, instead export `upsertProfile` directly and have the test stub `supabaseAdmin.from` via `jest.spyOn`. The behavioral assertion (first_name/last_name/profile_image present in the upsert row) is what matters.

- [ ] **Step 4: Run it, verify it passes**

Run: `cd server && npx jest tests/unit/googleProfileCapture.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/authController.js server/tests/unit/googleProfileCapture.test.js
git commit -m "feat(auth): upsertProfile writes first_name/last_name/avatar"
```

### Task 1.3: Callback passes Google fields; `exchangeGoogleCode` surfaces them

**Files:**
- Modify: `server/config/google.js` (the `exchangeGoogleCode` return shape)
- Modify: `server/controllers/authController.js:405-410` (the new-vendor `upsertProfile` call)

- [ ] **Step 1: Verify `googleUser` carries the fields.** Open `server/config/google.js`, find `exchangeGoogleCode`. It requests the `profile` scope, so the userinfo response includes `given_name`, `family_name`, `picture`. Ensure the returned `googleUser` object includes them (it may currently project only `{ email, name }`). If projected, widen it:

```javascript
// inside exchangeGoogleCode, where googleUser is built from the userinfo / id_token:
return {
  tokens,
  googleUser: {
    email: info.email,
    name: info.name,
    given_name: info.given_name || '',
    family_name: info.family_name || '',
    picture: info.picture || '',
  },
};
```

- [ ] **Step 2: Pass them at the call site** — `authController.js:405-410`:

```javascript
const profile = await upsertProfile({
  id: created.user.id,
  name: googleUser.name || googleEmail.split("@")[0],
  email: googleEmail,
  role: "host",
  first_name: googleUser.given_name || null,
  last_name: googleUser.family_name || null,
  avatar: googleUser.picture || null,
});
```

- [ ] **Step 3: Manual smoke** — run a real Google host signup against staging; confirm `profiles.first_name/last_name/profile_image` populate. (No automated test for the live OAuth round-trip.)

- [ ] **Step 4: Commit**

```bash
git add server/config/google.js server/controllers/authController.js
git commit -m "feat(auth): capture Google given/family name + picture on host signup"
```

---

## Phase 2 — Google-First Flow Reshape

### Step model (the contract every later task obeys)

`profiles.onboarding_step_completed` is the single source of truth. Values and the page that *writes* them on success:

| completed | meaning | written by |
|---|---|---|
| 1 | Google identity done (account exists) | server `markGoogleVendorOnboarding` |
| 2 | slug claimed | slug-claim page |
| 3 | about (type + booking) saved | about page |
| 4 | category saved | category page |
| 5 | whatsapp verified or skipped | whatsapp page |
| 6 | plan active → `onboarding_completed = true` | plan activation (Phase 3) |

Resume map (next URL given `completed`):

```javascript
const RESUME = {
  1: '/vendor-register/:slug/claim',
  2: '/vendor-register/:slug/about',
  3: '/vendor-register/:slug/category',
  4: '/vendor-register/:slug/whatsapp',
  5: '/vendor-register/:slug/plan',
};
// completed >= 6 OR onboarding_completed === true  → allowed through to /dashboard
```

### Task 2.1: Server — `markGoogleVendorOnboarding` seeds step 1

**Files:**
- Modify: `server/controllers/authController.js` (the `markGoogleVendorOnboarding` helper, called at `:418`)

- [ ] **Step 1:** Find `markGoogleVendorOnboarding`. Change the `onboarding_step_completed` it writes from `3` to `1`, keep `onboarding_slug = username`, keep `role='host'` and the calendar auto-skip. The slug remains the auto username so URLs work; the claim step lets the host customize it.

```javascript
// inside markGoogleVendorOnboarding(profileId, username):
await supabaseAdmin.from('profiles').update({
  onboarding_slug: username,
  onboarding_step_completed: 1,   // was 3 — Google satisfies identity only
  onboarding_completed: false,
  calendar_skipped: true,
  updated_at: new Date().toISOString(),
}).eq('id', profileId);
```

- [ ] **Step 2: Commit**

```bash
git add server/controllers/authController.js
git commit -m "refactor(onboarding): Google signup seeds step 1 (claim slug next)"
```

### Task 2.2: Server — authed `claim-slug`; rewrite `update-step` map; drop email endpoints

**Files:**
- Modify: `server/controllers/vendorOnboardingController.js`
- Modify: `server/routes/vendorOnboardingRoutes.js`
- Test: `server/tests/unit/onboardingClaimSlug.test.js`

- [ ] **Step 1: Write the failing test** (`onboardingClaimSlug.test.js`):

```javascript
const ctrl = require('../../controllers/vendorOnboardingController');

describe('claimSlug', () => {
  it('rejects an invalid slug', async () => {
    await expect(ctrl.claimSlug('uid', 'No Spaces!')).rejects.toThrow(/lowercase|invalid/i);
  });
  it('rejects a slug already taken by another profile', async () => {
    // stub checkSlugAvailable → false
    jest.spyOn(ctrl, 'checkSlugAvailable').mockResolvedValue(false);
    await expect(ctrl.claimSlug('uid', 'taken-name')).rejects.toThrow(/taken/i);
  });
});
```

- [ ] **Step 2: Run, verify fail.** Run: `cd server && npx jest tests/unit/onboardingClaimSlug.test.js` — FAIL (`claimSlug` undefined).

- [ ] **Step 3: Implement `claimSlug`** in `vendorOnboardingController.js` (reuse the existing `isValidSlug` + `checkSlugAvailable`, plus the reserved-word guard from `usernameService` used elsewhere):

```javascript
// Authed: set the host's chosen public slug. The account already exists
// (Google), so this is an UPDATE keyed by the authed user id — never a
// pre-account write. Uniqueness excludes the caller's own current slug.
const claimSlug = async (vendorId, slug) => {
  const clean = (slug || '').toLowerCase().trim();
  if (!isValidSlug(clean)) {
    throw new Error('Slug must be lowercase, 3-60 chars, alphanumeric with hyphens only');
  }
  if (usernameService.isReserved && usernameService.isReserved(clean)) {
    throw new Error('That name is reserved');
  }
  const { data: owner } = await supabaseAdmin
    .from('profiles').select('id').eq('onboarding_slug', clean).maybeSingle();
  if (owner && owner.id !== vendorId) throw new Error('Slug already taken');

  const { data, error } = await supabaseAdmin.from('profiles')
    .update({
      onboarding_slug: clean,
      username: clean,                  // first onboarding claim is the free username set
      onboarding_step_completed: 2,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendorId).select().single();
  if (error) throw error;
  return { slug: clean, profile: data };
};
```

- [ ] **Step 4: Rewrite `updateOnboardingStep`'s step→column map** for the new model. Replace the `if (stepNumber === 3) … 8` block with:

```javascript
// step 3 = "about you" (merged host type + booking type)
if (stepNumber === 3) {
  updates.vendor_type  = data.vendor_type || null;
  updates.booking_type = data.booking_type || null;
} else if (stepNumber === 4) {
  const cats = Array.isArray(data.categories) ? data.categories.filter(Boolean) : [];
  const primary = data.primary_category || cats[0] || null;
  updates.primary_category = primary;
  updates.categories = primary ? [primary] : [];
} else if (stepNumber === 5) {
  // whatsapp: verified row written by /whatsapp/verify-otp; only the skip path here
  if (data.whatsapp_skipped) { updates.whatsapp_verified = false; updates.whatsapp_number = null; }
}
// no calendar / work-hours / profile / first-service branches — those steps are gone
```

- [ ] **Step 5: Delete the dead resume helper.** Remove `getResumeStep` (controller `:482-499`) and its export — resume now lives in `ProtectedRoute` as the `RESUME` map.

- [ ] **Step 6: Routes** — in `vendorOnboardingRoutes.js`: delete `check-slug`, `send-otp`, `verify-otp`, `create-account` (the entire email path). Add:

```javascript
router.post('/claim-slug', protect, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ message: 'Slug is required' });
    const result = await claimSlug(req.user.id, slug);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
```

Keep a public availability check for the live typing UI (re-add a thin `POST /onboarding/slug-available` that returns `{ available }` using `checkSlugAvailable`, rate-limited by `slugLimiter`).

- [ ] **Step 7: Run the full server suite.** Run: `cd server && npm test` — fix any tests referencing the deleted endpoints (`server/__tests__/vendorOnboarding.test.js`, `server/tests/unit/onboardingOtp.test.js`): delete the OTP/create-account cases, keep/adjust slug + update-step cases.

- [ ] **Step 8: Commit**

```bash
git add server/controllers/vendorOnboardingController.js server/routes/vendorOnboardingRoutes.js server/tests
git commit -m "feat(onboarding): authed claim-slug, new step map, drop email path"
```

### Task 2.3: Client — `api.js` surface

**Files:**
- Modify: `client/src/services/api.js`

- [ ] **Step 1:** Remove `sendOnboardingOtp`, `verifyOnboardingOtp`, `createVendorAccount`. Add:

```javascript
export const claimOnboardingSlug = (slug) => API.post('/onboarding/claim-slug', { slug });
export const checkOnboardingSlug = (slug) => API.post('/onboarding/slug-available', { slug });
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(onboarding): client api for claim-slug + availability"
```

### Task 2.4: Client — onboarding guard hook

**Files:**
- Create: `client/src/pages/onboarding/useOnboardingGuard.js`

- [ ] **Step 1: Implement** — one hook every step uses: fetch server status on mount, redirect if the user is not meant to be on this step. `expected` is the step value this page handles.

```javascript
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getOnboardingStatus } from '../../services/api';

const RESUME = {
  1: 'claim', 2: 'about', 3: 'category', 4: 'whatsapp', 5: 'plan',
};

export default function useOnboardingGuard(expected) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    getOnboardingStatus()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.isComplete) { navigate('/dashboard', { replace: true }); return; }
        const done = data?.stepCompleted || 1;
        const target = done >= 6 ? null : RESUME[done];
        // allow the current page only if it IS the next step; otherwise bounce
        const here = window.location.pathname.split('/').pop();
        if (target && target !== here) {
          navigate(`/vendor-register/${data.slug || slug}/${target}`, { replace: true });
          return;
        }
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => { alive = false; };
  }, [expected, navigate, slug]);
  return ready;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/onboarding/useOnboardingGuard.js
git commit -m "feat(onboarding): server-truth resume guard hook"
```

### Task 2.5: Client — Google CTA landing replaces slug-first entry

**Files:**
- Create: `client/src/pages/onboarding/GoogleStart.jsx`

- [ ] **Step 1: Implement** — the `/vendor-register` entry. One primary action; no email path.

```jsx
import { useAuth } from '../../context/AuthContext';

export default function GoogleStart() {
  const { startVendorGoogleAuth } = useAuth();
  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4">
      <div className="page-card w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Start hosting on Book A Sloth</h1>
        <p className="mt-2 text-gray-600">
          Continue with Google — we'll pull your name and photo so you can skip the forms.
        </p>
        <button
          onClick={() => startVendorGoogleAuth('signup')}
          className="btn mt-6 w-full flex items-center justify-center gap-2"
        >
          <img src="/google.svg" alt="" className="h-5 w-5" />
          Continue with Google
        </button>
        <p className="mt-4 text-xs text-gray-500">Free to start. No credit card.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/onboarding/GoogleStart.jsx
git commit -m "feat(onboarding): Google CTA landing as sole entry"
```

### Task 2.6: Client — SlugClaim becomes the authed claim step

**Files:**
- Modify: `client/src/pages/onboarding/SlugClaim.jsx`

- [ ] **Step 1: Rewrite** — pre-fill from the authed user's current `onboarding_slug`/`username`; debounced availability via `checkOnboardingSlug`; on continue `await claimOnboardingSlug(slug)` then navigate to `about`. Guard with `useOnboardingGuard(1)`. Use the existing markup but: drop the `bookasloth.com/` `pl-[160px]` magic-number padding in favor of a prefix `<span>` in a flex row; add a Back button to `/vendor-register`; enforce `maxLength={60}`; show a "min 3 chars" hint distinct from "taken".

Key handler:

```javascript
const handleClaim = async () => {
  if (!available) return;
  setSaving(true);
  try {
    await claimOnboardingSlug(slug);
    navigate(`/vendor-register/${slug}/about`);
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not claim that name');
    setSaving(false);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/onboarding/SlugClaim.jsx
git commit -m "feat(onboarding): slug claim is authed, awaited, prefilled, with Back"
```

### Task 2.7: Client — merged About You step (host type + booking type)

**Files:**
- Create: `client/src/pages/onboarding/AboutYouStep.jsx`
- Test: `client/src/tests/AboutYouStep.test.jsx`

- [ ] **Step 1: Write the failing test:**

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutYouStep from '../pages/onboarding/AboutYouStep';

it('renders both host-type and booking-type choices on one screen', () => {
  render(<MemoryRouter><AboutYouStep /></MemoryRouter>);
  expect(screen.getByText(/individual/i)).toBeInTheDocument();
  expect(screen.getByText(/online/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify fail.** `cd client && npx vitest run src/tests/AboutYouStep.test.jsx` — FAIL (module missing).

- [ ] **Step 3: Implement** — two compact choice groups (type: individual/organisation; booking: online/in-person/both) as chip-rows, a single **Continue** that awaits one `updateOnboardingStep({ slug, step: 3, data: { vendor_type, booking_type } })` then navigates to `category`. `useOnboardingGuard(2)`. Selection held in local state; **not** fire-and-forget. Back → `claim`. Keep total height ≤ one viewport (two short groups + button).

```jsx
const onContinue = async () => {
  if (!type || !booking) return;
  setSaving(true);
  try {
    await updateOnboardingStep({ slug, step: 3, data: { vendor_type: type, booking_type: booking } });
    navigate(`/vendor-register/${slug}/category`);
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not save'); setSaving(false);
  }
};
```

- [ ] **Step 4: Run, verify pass.** `cd client && npx vitest run src/tests/AboutYouStep.test.jsx` — PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/onboarding/AboutYouStep.jsx client/src/tests/AboutYouStep.test.jsx
git commit -m "feat(onboarding): merged About You step (type + booking), awaited save"
```

### Task 2.8: Client — WhatsApp + Live steps get guard, Back, awaited saves

**Files:**
- Modify: `client/src/pages/onboarding/WhatsAppStep.jsx`, `ExploreWithBolt.jsx`

- [ ] **Step 1:** `WhatsAppStep`: add `useOnboardingGuard(4)`; on verify success **await** `updateOnboardingStep({ slug, step: 5, data: {} })` (stop swallowing its error) before navigating to `plan`; skip path awaits `{ whatsapp_skipped: true }`. Add Back → `category`.

- [ ] **Step 2:** `ExploreWithBolt`: add `useOnboardingGuard(6)`; this is the terminal "you're live" screen (Phase 3 makes the plan step the thing that flips `onboarding_completed`). Remove the hardcoded `/sndatarkar` demo target — link to a config/env value or drop the demo button.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/onboarding/WhatsAppStep.jsx client/src/pages/onboarding/ExploreWithBolt.jsx
git commit -m "feat(onboarding): guard + Back + awaited saves on whatsapp/live"
```

### Task 2.9: Client — router + ProtectedRoute; delete dead step files

**Files:**
- Modify: `client/src/App.jsx:209-220` and the lazy imports `:40-51`
- Modify: `client/src/components/common/ProtectedRoute.jsx:48-69`
- Delete: `OtpVerify.jsx`, `PasswordStep.jsx`, `VendorTypeStep.jsx`, `BookingTypeStep.jsx`, `WorkHoursStep.jsx`, `ProfileStep.jsx`, `FirstServiceStep.jsx`
- Test: `client/src/tests/onboardingResume.test.jsx`

- [ ] **Step 1: New routes** in `App.jsx` (replace the 12-route block):

```jsx
<Route path="/vendor-register" element={<GoogleStart />} />
<Route path="/vendor-register/:slug/claim"    element={<SlugClaim />} />
<Route path="/vendor-register/:slug/about"    element={<AboutYouStep />} />
<Route path="/vendor-register/:slug/category" element={<CategoryStep />} />
<Route path="/vendor-register/:slug/whatsapp" element={<WhatsAppStep />} />
<Route path="/vendor-register/:slug/plan"     element={<PlansStep />} />
<Route path="/vendor-register/:slug/live"     element={<ExploreWithBolt />} />
```

Update the lazy imports: drop the seven deleted components, add `GoogleStart`, `AboutYouStep`.

- [ ] **Step 2: Write the failing resume test** (`onboardingResume.test.jsx`): a host with `stepCompleted: 3` hitting `/dashboard` is redirected to `/vendor-register/:slug/category` (proves the off-by-one is gone — completed 3 → category, not booking).

```jsx
// mock getOnboardingStatus → { slug:'me', stepCompleted:3, isComplete:false }
// render <ProtectedRoute><Dashboard/></ProtectedRoute> with a host user
// expect redirect target to be /vendor-register/me/category
```

- [ ] **Step 3: Rewrite `ProtectedRoute` resume** with the explicit map (no array off-by-one), slug-optional in-flow check:

```javascript
const RESUME = { 1:'claim', 2:'about', 3:'category', 4:'whatsapp', 5:'plan' };

if (user.role === 'host' && onboardingStatus && !onboardingStatus.isComplete) {
  const done = onboardingStatus.stepCompleted || 1;
  if (done < 6) {
    const slug = onboardingStatus.slug;
    return <Navigate to={`/vendor-register/${slug}/${RESUME[done]}`} replace />;
  }
}
```

- [ ] **Step 4: Delete the seven dead step files.**

```bash
git rm client/src/pages/onboarding/OtpVerify.jsx client/src/pages/onboarding/PasswordStep.jsx \
  client/src/pages/onboarding/VendorTypeStep.jsx client/src/pages/onboarding/BookingTypeStep.jsx \
  client/src/pages/onboarding/WorkHoursStep.jsx client/src/pages/onboarding/ProfileStep.jsx \
  client/src/pages/onboarding/FirstServiceStep.jsx
```

- [ ] **Step 5: Run the client suite.** `cd client && npm test` — delete/adjust the obsolete tests (`PlansStep.test.jsx` stays; remove any importing deleted files). Resume test passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(onboarding): 7-step router, fixed resume map, remove dead steps"
```

### Task 2.10: Dashboard — stop re-asking for verified WhatsApp

**Files:**
- Modify: the dashboard WhatsApp surface (locate with `grep -rl "whatsapp" client/src/pages` — likely a dashboard settings/profile section)

- [ ] **Step 1:** Read `profiles.whatsapp_verified`; if true, render the number as verified (badge) with no "verify" CTA. Only show the verify entry point when `whatsapp_verified` is false. (Resolves the duplicate-verify complaint end-to-end.)

- [ ] **Step 2: Commit**

```bash
git add client/src/pages
git commit -m "fix(dashboard): hide WhatsApp verify when already verified"
```

---

## Phase 3 — Payment-Gated Completion + Dead-Code Removal

### Task 3.1: Server — gate `mark-complete` on an active plan; free-activate endpoint

**Files:**
- Modify: `server/routes/vendorOnboardingRoutes.js`
- Modify: `server/controllers/vendorOnboardingController.js`
- Test: `server/tests/unit/onboardingCompletionGate.test.js`

- [ ] **Step 1: Write the failing test:**

```javascript
const ctrl = require('../../controllers/vendorOnboardingController');
it('markComplete refuses when the profile has no active plan', async () => {
  jest.spyOn(ctrl, 'getActivePlan').mockResolvedValue(null);
  await expect(ctrl.markComplete('uid')).rejects.toThrow(/plan/i);
});
it('markComplete succeeds when a plan is active', async () => {
  jest.spyOn(ctrl, 'getActivePlan').mockResolvedValue('creator');
  await expect(ctrl.markComplete('uid')).resolves.toMatchObject({ onboarding_completed: true });
});
```

- [ ] **Step 2: Run, verify fail.** `cd server && npx jest tests/unit/onboardingCompletionGate.test.js`.

- [ ] **Step 3: Implement** — `markComplete(vendorId)` reads the profile's effective plan (free `explorer` counts as active once chosen; paid counts only when the subscription is active). Replace the unconditional `mark-complete` route body with a call to `markComplete` that throws if no active plan:

```javascript
const markComplete = async (vendorId) => {
  const plan = await getActivePlan(vendorId);     // 'explorer' | 'creator' | 'professional' | null
  if (!plan) throw new Error('Choose and activate a plan before finishing');
  const { data, error } = await supabaseAdmin.from('profiles')
    .update({ onboarding_completed: true, onboarding_step_completed: 6, updated_at: new Date().toISOString() })
    .eq('id', vendorId).select().single();
  if (error) throw error;
  return data;
};

// Free plan path used by PlansStep's "Start free" — activates explorer and
// marks complete in one call (no Razorpay).
const activateFreePlan = async (vendorId) => {
  await supabaseAdmin.from('profiles')
    .update({ plan: 'explorer', plan_activated_at: new Date().toISOString() })
    .eq('id', vendorId);
  return markComplete(vendorId);
};
```

`getActivePlan` reads `profiles.plan` + `plan_expires_at` (reuse `planService.resolveVendorPlan` if present) and returns null when the plan is unset/expired.

- [ ] **Step 4: Routes** — `mark-complete` calls `markComplete` and 400s on the thrown guard; add `POST /onboarding/activate-free` → `activateFreePlan`.

- [ ] **Step 5: Delete dead paid-order code** — remove `createRazorpayOrder`, `verifyRazorpayPayment`, the onboarding `activatePlan`, and the `create-order`(paid branch)/`verify-payment` routes. (Paid plans go through `/payment/subscription/*`, which already exists.) Keep `razorpay_orders` table for the subscription module if it uses it; otherwise leave it untouched.

- [ ] **Step 6: Run, verify pass + full suite.** `cd server && npm test`.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/vendorOnboardingController.js server/routes/vendorOnboardingRoutes.js server/tests/unit/onboardingCompletionGate.test.js
git commit -m "fix(onboarding): gate completion on active plan; drop dead order code"
```

### Task 3.2: Client — PlansStep activation correctness

**Files:**
- Modify: `client/src/pages/onboarding/PlansStep.jsx`
- Modify: `client/src/services/api.js` (drop `verifyOnboardingPayment`; add `activateFreePlan = () => API.post('/onboarding/activate-free')`)

- [ ] **Step 1:** Free path → `await activateFreePlan()` then navigate to `live`. Paid path → after the Razorpay subscription `handler` success, `await syncSubscription()`, then **re-fetch** via `getMe()` and only `navigate('live')` once `user.plan` is the paid plan; add `modal.ondismiss` that clears `busy` and toasts "Checkout closed — you can pick a plan when ready." Fix the blank Razorpay prefill by reading name/email from the freshly-fetched `getMe()` user, not stale `localStorage`.
- [ ] **Step 2:** `useOnboardingGuard(5)`; Back → `whatsapp`.

- [ ] **Step 3: Run client suite.** `cd client && npm test` (update `PlansStep.test.jsx` for the new free-activate call).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/onboarding/PlansStep.jsx client/src/services/api.js client/src/tests/PlansStep.test.jsx
git commit -m "fix(onboarding): plan step gates advance on real activation"
```

---

## Phase 4 — Category Page Redesign

### Task 4.1: Rebuild CategoryStep per the approved mockup

**Files:**
- Modify: `client/src/pages/onboarding/CategoryStep.jsx`
- Test: `client/src/tests/CategoryStep.test.jsx` (extend)

Design contract (matches the mockup shown to the founder):
- Search box on top (autofocus), filtering a **bounded, internally-scrolling** matches list (the *page* never exceeds 100vh — only the list scrolls).
- Tap a match → it becomes the single selected chip (auto-pick).
- When the query has no exact match → a highlighted **Add "<query>"** row with a `+` button → tapping it calls `suggestCategory`, then **auto-selects** the new category (pending-approval badge).
- Selected chip shows with a clear remove control.
- Continue is pinned at the bottom; on continue **await** `updateOnboardingStep({ slug, step: 4, data: { primary_category, categories:[selected] } })` then navigate to `whatsapp`. No fake "saving" state.
- `useOnboardingGuard(3)`; Back → `about`.

- [ ] **Step 1: Write the failing tests:**

```jsx
it('selects a typed match on click and enables Continue', async () => { /* type "yo", click match, assert chip + enabled button */ });
it('shows an Add row with a plus when the query has no exact match', async () => { /* type "novel-thing", assert Add "novel-thing" + role=button plus */ });
```

- [ ] **Step 2: Run, verify fail.** `cd client && npx vitest run src/tests/CategoryStep.test.jsx`.

- [ ] **Step 3: Implement** the component. Reuse the existing category data source the current `CategoryStep` already calls (host categories + global list + `suggestCategory`); keep the `FALLBACK` list. Cap rendered matches (e.g. `.slice(0, 8)`) and put `overflow-y:auto` on the list container with a fixed `max-height`, so the page stays within one viewport. Awaited save on Continue:

```javascript
const onContinue = async () => {
  if (!selected) return;
  setSaving(true);
  try {
    await updateOnboardingStep({ slug, step: 4, data: { primary_category: selected, categories: [selected] } });
    navigate(`/vendor-register/${slug}/whatsapp`);
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not save'); setSaving(false);
  }
};

const onAddCustom = async () => {
  const v = query.trim(); if (!v) return;
  try {
    const { data } = await suggestCategory(v);   // existing API
    setSelected(data.slug || v);                  // auto-pick
  } catch (e) { toast.error('Could not add that'); }
};
```

- [ ] **Step 4: Run, verify pass.** `cd client && npx vitest run src/tests/CategoryStep.test.jsx`.

- [ ] **Step 5: Verify ≤100vh** in the preview at 375px (search + bounded list + pinned Continue; only the list scrolls). Adjust `max-height` so nothing pushes the page past the viewport.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/onboarding/CategoryStep.jsx client/src/tests/CategoryStep.test.jsx
git commit -m "feat(onboarding): search-first category step with auto-pick custom add"
```

---

## Self-Review

**Spec coverage** — every founder directive and audit critical maps to a task:
- Google supplies name/last-name/email/photo, no double entry → Tasks 1.2, 1.3, 2.5 (entry), 2.6 (no email re-entry).
- Photo edit deferred to dashboard → ProfileStep removed (2.9); dashboard already edits photo.
- WhatsApp verified once; dashboard never re-asks → 2.8, 2.10.
- Custom category `+` auto-add + auto-pick; redesigned search picker → 4.1.
- ≤100vh on every screen → 2.6/2.7/4.1 layout notes + 4.1 Step 5 preview check.
- Completion gated on payment → 3.1.
- Resume off-by-one, fire-and-forget, step-6 mismatch, service-before-plan → dissolved/fixed in Phase 2/3 (see coverage table above).

**Placeholder scan** — no "TBD"/"handle errors"/"similar to". Where an existing helper's exact internals matter (`exchangeGoogleCode`, `markGoogleVendorOnboarding`, `getActivePlan`/`planService.resolveVendorPlan`, `suggestCategory`), the task names the file and the precise change; the executor confirms the signature in that file (these are real codebase symbols, not plan inventions).

**Type/contract consistency** — step values are one model throughout: `claim` writes 2, `about` writes 3, `category` writes 4, `whatsapp` writes 5, plan activation writes 6+`completed`. `RESUME` (client guard + ProtectedRoute) is keyed by the same values. `updateOnboardingStep` server map writes the columns those steps own. `onboarding_slug` is set at Google signup (= username) and only customized at `claim`, so URLs are valid the whole way.

**Open items the executor must confirm in-file (not blockers):**
1. `exchangeGoogleCode` currently projects `googleUser` — widen to include `given_name/family_name/picture` (Task 1.3 Step 1).
2. `getActivePlan` — reuse `planService.resolveVendorPlan` if it exists; else read `profiles.plan`/`plan_expires_at` directly (Task 3.1).
3. Dashboard WhatsApp surface location (Task 2.10) — `grep -rl whatsapp client/src/pages`.
4. Whether `razorpay_orders` is still used by `/payment/subscription/*` before removing onboarding order code (Task 3.1 Step 5).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-onboarding-google-first-reshape.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration. Best for a four-phase change this size; each phase merges as its own PR.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.
