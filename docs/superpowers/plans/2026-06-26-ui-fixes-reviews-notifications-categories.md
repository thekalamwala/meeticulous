# UI Fixes + Reviews UX + In-App Notifications + Admin Service-Categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 validated UI/UX defects and ship 3 features — a clear post-booking review flow, role-separated reviews, a working role-filtered in-app notification system, and a dedicated admin service-categories module.

**Architecture:** Five independent phases on branch `feat/ui-changes`. Phases 0/1 are client-only or light-backend. Phase 2 (notifications) and Phase 4 (service-categories) add a Supabase table each (v3.39, v3.40), server controller+routes, client api wiring, and admin/nav UI. Each phase is independently shippable and testable.

**Tech Stack:** React 18 + Vite, Tailwind, react-router-dom v6; Express 4; Supabase (Postgres, service_role server-side); Vitest (client) / Jest (server). NOTE: client Vitest does NOT load `@testing-library/jest-dom` extended matchers — use `.getAttribute()` / `.textContent` / `toBeInTheDocument` only (see memory `jest-dom-matcher-gap`).

**Branch discipline:** Already on `feat/ui-changes` (off `main` 813f4d4). Shared-worktree HEAD can drift (memory `shared-worktree-head-drift`) — before each commit run `git branch --show-current`; commit by explicit `git add -- <files>`.

---

## Validation summary (what's real)

| # | Issue | Verdict | Root cause |
|---|-------|---------|-----------|
| 1 | Email CTA → no review form | FALSE — `/review/:bookingId` works | n/a |
| 2 | Review block confusing (stars only, no text/edit, inconsistent) | REAL | `CustomerBookings.jsx:311-313` |
| 3 | Reviews not role-separated | REAL | `getReceivedReviews` mixes directions; page not mode-aware |
| 4 | Notification panel always empty + not role-wise | REAL | `Navbar.jsx:155,297-314` hardcoded; no table/endpoint/inserts |
| 5 | Notif dropdown clipped on mobile | REAL | `Navbar.jsx:299` `right-0 w-80` |
| 6 | Role toggle stuck after Back nav | REAL | `mode` sticky in localStorage, not route-derived |
| 7 | Duplicate ₹ on My Bookings | REAL | `CustomerBookings.jsx:140` icon + `amountPaid` (already has ₹) |
| 8 | Admin "Categories" = clone of All Services | REAL | `App.jsx:258` route → `<AdminServices/>`; no service-cat module |
| 9 | Uneven admin filter button widths | REAL | `AdminUsers.jsx:135-146` content-driven widths |

---

## File structure

**Phase 0 — quick fixes (client only)**
- Modify: `client/src/pages/CustomerBookings.jsx` (currency)
- Modify: `client/src/pages/admin/AdminUsers.jsx` (filter buttons)
- Modify: `client/src/utils/roleRoutes.js` (add `routeRole`)
- Modify: `client/src/components/common/Navbar.jsx` (route→mode sync + mobile panel width)

**Phase 1 — review flow + role-separated reviews**
- Modify: `server/controllers/reviewController.js` (add `updateReview`; `direction` filter on received)
- Modify: `server/routes/reviewRoutes.js` (PUT route)
- Modify: `client/src/services/api.js` (add `updateReview`, extend `getReceivedReviews`)
- Modify: `client/src/components/booking/ReviewModal.jsx` (edit mode)
- Modify: `client/src/pages/CustomerBookings.jsx` (clear review states + Edit)
- Modify: `client/src/pages/CustomerReviews.jsx` (role tabs)
- Modify: `client/src/components/common/Navbar.jsx` (add Reviews to host dropdown)
- Modify: `client/src/pages/Bookings.jsx` (host "Review guest" button)

**Phase 2 — in-app notifications**
- Create: `server/migrations/v3.39_in_app_notifications.sql`
- Create: `server/utils/inAppNotify.js`
- Create: `server/controllers/notificationController.js`
- Create: `server/routes/notificationRoutes.js`
- Modify: `server/index.js` / app router (mount route)
- Modify: `server/controllers/bookingController.js` (insert at 5 event sites)
- Modify: `server/controllers/reviewController.js` (insert on new review)
- Modify: `server/controllers/payoutController.js` (insert on payout status change)
- Modify: `client/src/services/api.js` (3 endpoints)
- Modify: `client/src/components/common/Navbar.jsx` (fetch/render/mark-read + role filter)

**Phase 3 — (folded into Phase 1 + 0; role-separated reviews & mode sync)** — no separate files.

**Phase 4 — admin service-categories module**
- Create: `server/migrations/v3.40_service_categories.sql`
- Create: `server/controllers/serviceCategoryController.js`
- Create: `server/routes/serviceCategoryRoutes.js`
- Modify: `server/index.js` (mount routes)
- Create: `client/src/pages/admin/AdminServiceCategories.jsx`
- Modify: `client/src/App.jsx:258` (route → new page)
- Modify: admin sidebar nav config (link)
- Modify: `client/src/services/api.js` (CRUD + public list)
- Modify: `client/src/pages/services/ServiceForm.jsx` (category picker)

---

# PHASE 0 — Quick bug fixes

### Task 0.1: Remove duplicate ₹ on My Bookings

**Files:** Modify `client/src/pages/CustomerBookings.jsx:140`

Root cause: the row renders `<IndianRupee size={12} />` immediately followed by `amountPaid(b)`, which already returns a `₹`-prefixed string → "₹ ₹1". The DetailsModal `Line` is fine (icon sits beside the *label*, value is separate), so only the row needs fixing.

- [ ] **Step 1:** Edit line 140. Change:
```jsx
<span className="inline-flex items-center gap-1"><IndianRupee size={12} />{amountPaid(b)}</span>
```
to:
```jsx
<span className="inline-flex items-center gap-1">{amountPaid(b)}</span>
```
(`amountPaid` already supplies ₹ for paid/refunded and the words "Free"/"Unpaid" for the rest — a leading glyph icon was wrong for those anyway.) Leave the `IndianRupee` import; it's still used by the modal `Line`.

- [ ] **Step 2:** Verify in preview (`/user/my-bookings`) a paid booking shows a single `₹` (snapshot text contains `₹1` not `₹ ₹1`).

- [ ] **Step 3:** Commit
```bash
git add -- client/src/pages/CustomerBookings.jsx
git commit -m "fix(bookings): remove duplicate ₹ symbol on My Bookings amount"
```

### Task 0.2: Uniform admin filter button widths

**Files:** Modify `client/src/pages/admin/AdminUsers.jsx:134-147`

Make the All/Guest/Host/Superadmin group equal-width via an inline grid (4 equal columns sized to the widest label) — balanced segmented look, no per-label drift.

- [ ] **Step 1:** Replace the wrapping `<div className="flex gap-1">` (line 134) with:
```jsx
<div className="inline-grid grid-cols-4 gap-1">
```
- [ ] **Step 2:** Change each button's className (line 142) from `min-w-[76px] inline-flex justify-center ...` to:
```jsx
className={`w-full inline-flex justify-center px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === r ? "bg-gray-900 text-white" : "bg-white border text-gray-500"}`}
```
- [ ] **Step 3:** Verify in preview (`/admin/users`): all four pills equal width.
- [ ] **Step 4:** Commit
```bash
git add -- client/src/pages/admin/AdminUsers.jsx
git commit -m "fix(admin): equal-width filter buttons in Users & Hosts"
```

### Task 0.3: Sync active role to the current route (fix Back-nav desync)

**Files:** Modify `client/src/utils/roleRoutes.js`, `client/src/components/common/Navbar.jsx`

Root cause: `mode` is sticky localStorage, never derived from the URL. Fix: on every route change, if the path is unambiguously host- or guest-space and the user can host, snap `mode` to match. Neutral paths (`/`, `/profile`, `/about`, …) leave mode untouched.

- [ ] **Step 1:** Add a route→role helper to `client/src/utils/roleRoutes.js` (append):
```js
// Maps a pathname to the role-space it belongs to, or null if neutral
// (home, public profile, marketing pages). Used to keep the Hosting/Traveling
// toggle + profile menu in sync after browser back/forward navigation.
export function routeRole(pathname) {
  if (pathname.startsWith('/dashboard')) return 'hosting';
  if (pathname.startsWith('/user')) return 'traveling';
  return null;
}
```
- [ ] **Step 2:** In `Navbar.jsx`, import it alongside `isHost`:
```js
import { isHost, routeRole } from '../../utils/roleRoutes';
```
- [ ] **Step 3:** In `Navbar.jsx`, add `setMode` to the `useAuth()` destructure (line 118):
```js
const { user, logout, mode, setMode, becomeHost } = useAuth();
```
- [ ] **Step 4:** Add an effect after the existing `location.pathname` effect (~line 186):
```js
  // Keep active role in sync with the route. Browser back/forward changes the
  // URL but not the persisted mode, which previously left the toggle + profile
  // menu showing Hosting on a Traveling page. Only snaps for dual-capability
  // accounts and only on role-specific paths (neutral paths leave mode as-is).
  useEffect(() => {
    if (!canHost) return;
    const role = routeRole(location.pathname);
    if (role && role !== mode) setMode(role);
  }, [location.pathname, canHost, mode, setMode]);
```
- [ ] **Step 5:** Verify: switch to Hosting → `/dashboard` → browser Back to `/user/my-bookings` → toggle shows Traveling and dropdown shows customer items. (Preview: navigate, then `preview_eval` history.back(), snapshot the toggle.)
- [ ] **Step 6:** Commit
```bash
git add -- client/src/utils/roleRoutes.js client/src/components/common/Navbar.jsx
git commit -m "fix(nav): sync active role to route on back/forward navigation"
```

### Task 0.4: Mobile-safe notification panel width

**Files:** Modify `client/src/components/common/Navbar.jsx:299`

- [ ] **Step 1:** Change the panel className (line 299) from `... mt-1.5 w-80 bg-white ...` to:
```jsx
className="absolute right-0 top-full mt-1.5 w-[calc(100vw-1.5rem)] max-w-[20rem] sm:w-80 bg-white rounded-xl border border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
```
- [ ] **Step 2:** Verify with `preview_resize` to 360px: panel fully on-screen, header not clipped.
- [ ] **Step 3:** Commit
```bash
git add -- client/src/components/common/Navbar.jsx
git commit -m "fix(nav): notification panel no longer clipped on mobile"
```

---

# PHASE 1 — Review flow + role-separated reviews

### Task 1.1: Backend — allow editing a review + direction filter on received

**Files:** Modify `server/controllers/reviewController.js`, `server/routes/reviewRoutes.js`

- [ ] **Step 1 (test):** Add to `server/tests/reviews.test.js` (create if absent; mirror existing test style — supertest against the app, seeded completed booking). Tests:
  1. Author can PUT their own review for a booking → 200, updated rating/comment.
  2. Non-author PUT → 403.
  3. `GET /reviews/received?direction=guest_to_host` returns only that direction.

- [ ] **Step 2 (impl `updateReview`):** Append to `reviewController.js` before `module.exports`:
```js
// PUT /api/reviews/booking/:id — author updates THEIR review for a booking.
const updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (rating != null && (rating < 1 || rating > 5))
      return res.status(400).json({ message: "Rating must be between 1 and 5" });

    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id, reviewer_id, host_id, direction")
      .eq("booking_id", req.params.id)
      .eq("reviewer_id", req.user.id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ message: "No review to edit" });

    const patch = {};
    if (rating != null) patch.rating = rating;
    if (comment !== undefined) patch.comment = comment;

    const { data: review, error } = await supabaseAdmin
      .from("reviews").update(patch).eq("id", existing.id).select().single();
    if (error) return safeError(res, error);

    if (existing.direction === "guest_to_host") {
      require("../services/badgeEngine")
        .evaluate({ vendorIds: [existing.host_id] })
        .catch((e) => console.error("Badge evaluation error:", e.message));
    }
    res.json(review);
  } catch (error) { safeError(res, error); }
};
```
- [ ] **Step 3 (direction filter):** In `getReceivedReviews`, after building the query add an optional filter. Replace the query block with:
```js
    let q = supabaseAdmin
      .from("reviews")
      .select("id, rating, comment, created_at, direction, profiles!reviews_reviewer_id_fkey(name, profile_image), bookings(services(title))")
      .eq("subject_id", req.user.id)
      .order("created_at", { ascending: false });
    const dir = req.query.direction;
    if (dir === "guest_to_host" || dir === "host_to_guest") q = q.eq("direction", dir);
    const { data: reviews, error } = await q;
```
- [ ] **Step 4:** Export `updateReview`: extend `module.exports = { createReview, updateReview, getReceivedReviews, getHostReviews, getBookingReview };`
- [ ] **Step 5 (route):** In `reviewRoutes.js`, add **above** the dynamic `/:username` line:
```js
router.put('/booking/:id', protect, requireFeature('review_submission'), updateReview);
```
and import `updateReview` in the destructure on line 3.
- [ ] **Step 6:** Run `cd server && npm test -- reviews` → green.
- [ ] **Step 7:** Commit
```bash
git add -- server/controllers/reviewController.js server/routes/reviewRoutes.js server/tests/reviews.test.js
git commit -m "feat(reviews): editable reviews + direction filter on received"
```

### Task 1.2: Client api — updateReview + direction param

**Files:** Modify `client/src/services/api.js:234-237`

- [ ] **Step 1:** Edit the review endpoints block:
```js
export const createReview       = (data)      => API.post('/reviews', data);
export const updateReview       = (id, data)  => API.put(`/reviews/booking/${id}`, data);
export const getReceivedReviews = (direction) => API.get('/reviews/received', { params: direction ? { direction } : {} });
export const getHostReviews     = (username)  => API.get(`/reviews/${username}`);
export const getBookingReview   = (id)        => API.get(`/reviews/booking/${id}`);
```
- [ ] **Step 2:** Commit
```bash
git add -- client/src/services/api.js
git commit -m "feat(reviews): api client for edit + direction-filtered received"
```

### Task 1.3: ReviewModal — edit mode

**Files:** Modify `client/src/components/booking/ReviewModal.jsx`

- [ ] **Step 1:** Accept an optional `existing` review and prefill + switch to update:
```jsx
import { useState } from 'react';
import Modal from './Modal';
import { createReview, updateReview } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReviewModal({ open, booking, onClose, onDone, direction = 'guest_to_host', existing = null }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);
  const isEdit = !!existing;

  const isHostReviewing = direction === 'host_to_guest';
  const title = isEdit ? 'Edit your review' : (isHostReviewing ? 'Review your guest' : 'Leave a review');
  const subjectName = isHostReviewing
    ? (booking?.guest_name || 'your guest')
    : (booking?.['profiles!bookings_host_id_fkey']?.name || booking?.profiles?.name || 'your host');

  const submit = async () => {
    if (rating < 1) { toast.error('Pick a rating'); return; }
    setBusy(true);
    try {
      const { data } = isEdit
        ? await updateReview(booking.id, { rating, comment })
        : await createReview({ booking_id: booking.id, rating, comment, direction });
      toast.success(isEdit ? 'Review updated' : 'Thanks for the review!');
      onDone?.(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit review');
    } finally { setBusy(false); }
  };
  // ...rest unchanged (stars + textarea); button label:
  // {busy ? 'Saving…' : (isEdit ? 'Update review' : 'Submit review')}
}
```
Update the submit button text accordingly.
- [ ] **Step 2:** Commit
```bash
git add -- client/src/components/booking/ReviewModal.jsx
git commit -m "feat(reviews): ReviewModal supports editing an existing review"
```

### Task 1.4: My Bookings — clear review states (Not reviewed / Reviewed+text / Edit)

**Files:** Modify `client/src/pages/CustomerBookings.jsx`

Replace the DetailsModal review block (lines 305-313) so completed bookings always show one of: "Leave a review" (none yet), or a "Review Submitted" card with the stars **and comment text** plus an "Edit review" button.

- [ ] **Step 1:** Replace lines 305-313 with:
```jsx
            {b.status === "completed" && canReview && !review && (
              <button onClick={onReview}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border rounded-xl hover:bg-gray-50">
                <Star size={15} /> Write a review
              </button>
            )}
            {b.status === "completed" && review && (
              <div className="rounded-xl border bg-green-50/60 border-green-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <Star size={14} className="fill-green-600 text-green-600" /> Review submitted
                  </span>
                  {canReview && (
                    <button onClick={onReview} className="text-xs font-medium text-[#FE5100] hover:underline">
                      Edit review
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[#FE5100] text-sm tracking-tight">
                  {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                </p>
                {review.comment && <p className="mt-1 text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
              </div>
            )}
```
- [ ] **Step 2:** The modal must open in edit mode when a review exists. Update the `reviewFor` ReviewModal usage (line 250-253) to pass the existing review:
```jsx
      {reviewFor && (
        <ReviewModal open booking={reviewFor} existing={reviews[reviewFor.id] || null}
          onClose={() => setReviewFor(null)}
          onDone={(review) => { setReviews((m) => ({ ...m, [reviewFor.id]: review })); setReviewFor(null); }} />
      )}
```
- [ ] **Step 3:** Verify in preview: completed booking with review shows green "Review submitted" card + stars + comment + Edit; clicking Edit opens prefilled modal; unreviewed shows "Write a review".
- [ ] **Step 4:** Commit
```bash
git add -- client/src/pages/CustomerBookings.jsx
git commit -m "feat(reviews): clear reviewed/not-reviewed/edit states on My Bookings"
```

### Task 1.5: ReviewPage — show edit when already reviewed

**Files:** Read then modify `client/src/pages/ReviewPage.jsx`

- [ ] **Step 1:** Read `ReviewPage.jsx`. It already detects a prior review via `getBookingReview`. Ensure: if a review exists, render the page in edit mode (prefill rating/comment, button "Update review", call `updateReview`) instead of a dead-end "already reviewed" message. Reuse the same submit branching as ReviewModal (isEdit). Keep the completed-booking + feature-flag guards.
- [ ] **Step 2:** Verify: open `/review/:bookingId` for an already-reviewed completed booking → form prefilled, can update.
- [ ] **Step 3:** Commit
```bash
git add -- client/src/pages/ReviewPage.jsx
git commit -m "feat(reviews): /review page edits an existing review instead of dead-ending"
```

### Task 1.6: Role-separated Reviews page + host access

**Files:** Modify `client/src/pages/CustomerReviews.jsx`, `client/src/components/common/Navbar.jsx`

Reviews `subject_id = me` mixes directions. Split by active role: Traveling → reviews received from hosts (`direction=host_to_guest`); Hosting → reviews received from guests (`direction=guest_to_host`). Show tabs only when the user can host.

- [ ] **Step 1:** Rework `CustomerReviews.jsx` to be role/tab aware:
```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Sparkles, Loader2 } from "lucide-react";
import { getReceivedReviews } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isHost } from "../utils/roleRoutes";
// ...fmtDate + Stars unchanged...

const CustomerReviews = () => {
  const { user, mode } = useAuth();
  const canHost = isHost(user);
  // Tab = the role whose received reviews we show. Default to active mode.
  const [tab, setTab] = useState(canHost && mode === "hosting" ? "hosting" : "traveling");
  const [data, setData] = useState({ reviews: [], count: 0, avg: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const direction = tab === "hosting" ? "guest_to_host" : "host_to_guest";
    getReceivedReviews(direction)
      .then(({ data }) => setData(data || { reviews: [], count: 0, avg: 0 }))
      .catch(() => setData({ reviews: [], count: 0, avg: 0 }))
      .finally(() => setLoading(false));
  }, [tab]);

  const { reviews, count, avg } = data;
  // Header copy by tab: hosting = "What guests say about you"; traveling = "What hosts say about you"
  // Render a 2-button segmented tab bar (Traveling | Hosting) ONLY when canHost.
  // Keep the existing empty-state + review-card list markup below the tabs.
};
```
Tab bar markup (place under the `<h1>`), shown only when `canHost`:
```jsx
{canHost && (
  <div className="inline-grid grid-cols-2 gap-1 mb-5 rounded-full border bg-white p-0.5 text-xs font-medium">
    {[["traveling","As Traveler"],["hosting","As Host"]].map(([k,label]) => (
      <button key={k} onClick={() => setTab(k)}
        className={`px-4 py-1.5 rounded-full ${tab === k ? "bg-gray-900 text-white" : "text-gray-500"}`}>
        {label}
      </button>
    ))}
  </div>
)}
```
- [ ] **Step 2:** Give hosts a Reviews link. In `Navbar.jsx` add to `VENDOR_DROPDOWN` (after Earnings, before Settings):
```js
  { label: 'Reviews', href: '/user/reviews', icon: Star },
```
(`Star` is already imported.)
- [ ] **Step 3:** Verify: as a host in Hosting mode, Reviews tab defaults to "As Host" showing guest→host reviews; switch tab shows traveler reviews. Guest-only user sees no tabs.
- [ ] **Step 4:** Commit
```bash
git add -- client/src/pages/CustomerReviews.jsx client/src/components/common/Navbar.jsx
git commit -m "feat(reviews): role-separated reviews (Traveler vs Host tabs)"
```

### Task 1.7: Host can review the guest

**Files:** Read then modify `client/src/pages/Bookings.jsx`

Backend already supports `direction=host_to_guest`. Add the entry point on the host bookings page.

- [ ] **Step 1:** Read `client/src/pages/Bookings.jsx` to learn its row/details structure and how it loads bookings + feature flags (mirror `CustomerBookings`).
- [ ] **Step 2:** For completed bookings that have a `guest_id`, add a "Review guest" button (gated by `on('review_submission')`) that opens `ReviewModal` with `direction="host_to_guest"`. Fetch the host's existing review via `getBookingReview(b.id)` (same per-booking pattern as CustomerBookings) so it shows submitted/edit state. Reuse the green "Review submitted" card pattern from Task 1.4.
- [ ] **Step 3:** Verify on `/dashboard/bookings`: completed booking with an account-guest shows "Review guest"; submit → submitted card; edit works. Bookings by guests without accounts show no button.
- [ ] **Step 4:** Commit
```bash
git add -- client/src/pages/Bookings.jsx
git commit -m "feat(reviews): host can review the guest on completed bookings"
```

---

# PHASE 2 — In-app notifications (role-filtered)

### Task 2.1: Migration — `in_app_notifications`

**Files:** Create `server/migrations/v3.39_in_app_notifications.sql`

- [ ] **Step 1:** Write the file:
```sql
-- v3.39 — In-app notifications feed (bell panel).
-- Distinct from notification_logs (email/WhatsApp delivery telemetry) and from
-- the external NotificationEngine. Rows are written server-side via service_role
-- only; per the security sweep, anon/authenticated get NO direct grants.

create table if not exists in_app_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'guest' check (role in ('guest','host')),
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_in_app_notif_feed
  on in_app_notifications (user_id, role, created_at desc);
create index if not exists idx_in_app_notif_unread
  on in_app_notifications (user_id, role) where read_at is null;

alter table in_app_notifications enable row level security;
revoke all on in_app_notifications from anon, authenticated;
```
- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` to BOTH the prod (Mumbai `PROD_PROJECT_REF`) and staging (Tokyo `STAGING_PROJECT_REF`) projects (memory `staging-prod-pipeline-and-db-inversion`). Confirm `list_tables` shows it.
- [ ] **Step 3:** Commit
```bash
git add -- server/migrations/v3.39_in_app_notifications.sql
git commit -m "feat(notifications): in_app_notifications table (v3.39)"
```

### Task 2.2: Server helper — `inAppNotify`

**Files:** Create `server/utils/inAppNotify.js`

- [ ] **Step 1:** Write a best-effort, non-blocking insert helper (use the existing `runInBackground` from `server/utils/background.js` per memory `perf-defer-and-freebusy-cache`):
```js
const { supabaseAdmin } = require("../config/supabase");
const { runInBackground } = require("./background");

// Fire-and-forget in-app notification. Never throws into the request path —
// a feed write must not break a booking/review/payout mutation.
// role = which space the notification belongs to ('guest' | 'host').
function inAppNotify({ userId, role = "guest", type, title, body = null, link = null, data = {} }) {
  if (!userId || !type || !title) return;
  runInBackground(async () => {
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .insert({ user_id: userId, role, type, title, body, link, data });
    if (error) console.error("inAppNotify insert failed:", error.message);
  });
}

module.exports = { inAppNotify };
```
- [ ] **Step 2:** Commit
```bash
git add -- server/utils/inAppNotify.js
git commit -m "feat(notifications): inAppNotify best-effort insert helper"
```

### Task 2.3: Controller + routes

**Files:** Create `server/controllers/notificationController.js`, `server/routes/notificationRoutes.js`; modify the app router (mount).

- [ ] **Step 1 (test):** `server/tests/notifications.test.js`: seed two rows for a user (one role=guest, one role=host); `GET /api/notifications?role=guest` returns only the guest row + correct `unreadCount`; `POST /api/notifications/read-all?role=guest` sets `read_at`; subsequent unreadCount = 0.
- [ ] **Step 2 (controller):**
```js
const { supabaseAdmin } = require("../config/supabase");
const { safeError } = require("../utils/httpError");

// GET /api/notifications?role=guest|host  — current user's feed for a role.
const list = async (req, res) => {
  try {
    const role = req.query.role === "host" ? "host" : "guest";
    const { data, error } = await supabaseAdmin
      .from("in_app_notifications")
      .select("id, type, title, body, link, data, read_at, created_at")
      .eq("user_id", req.user.id).eq("role", role)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return safeError(res, error);
    const unreadCount = (data || []).filter((n) => !n.read_at).length;
    res.json({ notifications: data || [], unreadCount });
  } catch (e) { safeError(res, e); }
};

// POST /api/notifications/read-all?role=guest|host
const markAllRead = async (req, res) => {
  try {
    const role = req.query.role === "host" ? "host" : "guest";
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", req.user.id).eq("role", role).is("read_at", null);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

module.exports = { list, markAllRead, markRead };
```
- [ ] **Step 3 (routes):** `notificationRoutes.js`:
```js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { list, markAllRead, markRead } = require("../controllers/notificationController");

router.get("/", protect, list);
router.post("/read-all", protect, markAllRead);
router.patch("/:id/read", protect, markRead);

module.exports = router;
```
- [ ] **Step 4 (mount):** In the server app router (grep for `app.use('/api/reviews'` to find the mount site), add:
```js
app.use("/api/notifications", require("./routes/notificationRoutes"));
```
- [ ] **Step 5:** `cd server && npm test -- notifications` → green.
- [ ] **Step 6:** Commit
```bash
git add -- server/controllers/notificationController.js server/routes/notificationRoutes.js server/tests/notifications.test.js server/index.js
git commit -m "feat(notifications): user notification list/read endpoints"
```

### Task 2.4: Emit notifications at event sites

**Files:** Modify `server/controllers/bookingController.js`, `server/controllers/reviewController.js`, `server/controllers/payoutController.js`

Add `const { inAppNotify } = require("../utils/inAppNotify");` to each, then insert alongside the existing `NotificationEngine.send()` calls. Role = the space the recipient reads it in.

- [ ] **Step 1 — bookings.** At each existing engine-send site add a matching in-app row:
  - New booking created → host: `inAppNotify({ userId: booking.host_id, role:'host', type:'BOOKING_NEW', title:'New booking request', body:\`${guestName} booked ${serviceTitle}\`, link:'/dashboard/bookings', data:{ bookingId } })`
  - Booking confirmed/accepted → guest: `role:'guest', type:'BOOKING_CONFIRMED', title:'Booking confirmed', link:'/user/my-bookings'`
  - Booking cancelled → both parties (two calls, guest role + host role), `type:'BOOKING_CANCELLED'`
  - Booking rescheduled → both, `type:'BOOKING_RESCHEDULED'`, body includes new time
  - Session completed (`markBookingCompleted`) → guest: `type:'BOOKING_COMPLETED', title:'Session completed', body:'Leave a review', link:\`/review/${booking.id}\``
  Use the names/vars already in scope at each site (the controller already has guest/host names + service title for the emails — reuse them).
- [ ] **Step 2 — reviews.** In `createReview`, after successful insert: notify the subject. If `direction==='guest_to_host'` → `inAppNotify({ userId: subjectId, role:'host', type:'REVIEW_RECEIVED', title:'New review received', body:\`${rating}★\`, link:'/user/reviews' })`; else → `role:'guest'`, same shape.
- [ ] **Step 3 — payouts.** In the payout status-change handler (grep `payout` controller for approve/paid/reject), notify the host: `inAppNotify({ userId: hostId, role:'host', type:'PAYOUT_UPDATE', title:\`Payout ${status}\`, link:'/dashboard/payments/payouts' })`.
- [ ] **Step 4:** `cd server && npm test` → green (existing booking/review tests unaffected since inAppNotify is fire-and-forget).
- [ ] **Step 5:** Commit
```bash
git add -- server/controllers/bookingController.js server/controllers/reviewController.js server/controllers/payoutController.js
git commit -m "feat(notifications): emit in-app notifications on booking/review/payout events"
```

### Task 2.5: Client api + Navbar wiring (role-filtered, live)

**Files:** Modify `client/src/services/api.js`, `client/src/components/common/Navbar.jsx`

- [ ] **Step 1 (api):** add:
```js
export const getNotifications        = (role) => API.get('/notifications', { params: { role } });
export const markAllNotificationsRead = (role) => API.post('/notifications/read-all', null, { params: { role } });
export const markNotificationRead     = (id)  => API.patch(`/notifications/${id}/read`);
```
- [ ] **Step 2 (Navbar state):** Replace the hardcoded `const badges = { messages: 0, notifications: 0 };` (line 155) with live state. Add near other hooks:
```js
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const role = hostingView ? 'host' : 'guest';

  const loadNotifs = useCallback(() => {
    if (!user) return;
    getNotifications(role)
      .then(({ data }) => { setNotifs(data.notifications || []); setUnread(data.unreadCount || 0); })
      .catch(() => {});
  }, [user, role]);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);          // on mount + when role flips
  useEffect(() => { if (notifOpen) loadNotifs(); }, [notifOpen]); // refresh on open
```
Import `useCallback`, and `getNotifications, markAllNotificationsRead, markNotificationRead` from `../../services/api`. Set `const badges = { messages: 0, notifications: unread };` so the existing `BadgePill count={badges.notifications}` lights up.
- [ ] **Step 3 (render list):** Replace the empty-state block (lines 309-312) with a list when `notifs.length`:
```jsx
{notifs.length === 0 ? (
  <div className="py-10 text-center">
    <Bell size={28} className="mx-auto text-gray-200 mb-2" />
    <p className="text-sm text-gray-400">No new notifications</p>
  </div>
) : (
  <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
    {notifs.map((n) => (
      <li key={n.id}>
        <Link to={n.link || '#'} onClick={() => { markNotificationRead(n.id).catch(()=>{}); setNotifOpen(false); }}
          className={`block px-4 py-3 hover:bg-gray-50 hover:no-underline ${n.read_at ? '' : 'bg-[#FE5100]/4'}`}>
          <p className="text-sm font-medium text-[#1E1E1E]">{n.title}</p>
          {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
        </Link>
      </li>
    ))}
  </ul>
)}
```
- [ ] **Step 4 (mark all read):** Wire the existing "Mark all read" button (line 305):
```jsx
<button onClick={() => markAllNotificationsRead(role).then(loadNotifs).catch(()=>{})}
  className="text-[11px] text-[#FE5100] font-medium hover:underline focus:outline-none">
  Mark all read
</button>
```
- [ ] **Step 5:** Verify: as host (Hosting mode) the bell shows host-role notifications + unread count; switching to Traveling reloads guest-role feed; opening + Mark-all-read clears the badge; clicking an item navigates + marks read. Mobile width OK (Task 0.4).
- [ ] **Step 6:** Commit
```bash
git add -- client/src/services/api.js client/src/components/common/Navbar.jsx
git commit -m "feat(notifications): live role-filtered notification panel"
```

---

# PHASE 4 — Admin service-categories module

> Decision (locked): a NEW `service_categories` table, separate from the existing industry/profession `categories` taxonomy. Services map to it via a new nullable `services.service_category_id`. The existing profile/industry category system is untouched.

### Task 4.1: Migration — `service_categories` + `services.service_category_id`

**Files:** Create `server/migrations/v3.40_service_categories.sql`

- [ ] **Step 1:**
```sql
-- v3.40 — Dedicated SERVICE categories (admin-managed marketplace taxonomy).
-- Separate from `categories` (host industry/profession taxonomy, v3.21) and from
-- per-service `services.category` slug. Supports parent/sub, icon, description,
-- display order, activation, SEO. Service-side is read-only (vendors pick, never
-- create). Server writes via service_role only (no anon/authenticated grants).

create table if not exists service_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  description     text,
  icon_url        text,
  parent_id       uuid references service_categories(id) on delete set null,
  display_order   int not null default 0,
  is_active       boolean not null default true,
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_service_categories_parent on service_categories(parent_id);
create index if not exists idx_service_categories_active on service_categories(is_active, display_order);

alter table services add column if not exists service_category_id uuid
  references service_categories(id) on delete set null;
create index if not exists idx_services_service_category on services(service_category_id);

alter table service_categories enable row level security;
revoke all on service_categories from anon, authenticated;
```
- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` to BOTH prod (Mumbai) and staging (Tokyo). Verify with `list_tables`.
- [ ] **Step 3:** Commit
```bash
git add -- server/migrations/v3.40_service_categories.sql
git commit -m "feat(admin): service_categories table + services FK (v3.40)"
```

### Task 4.2: Server controller + routes

**Files:** Create `server/controllers/serviceCategoryController.js`, `server/routes/serviceCategoryRoutes.js`; mount in app router.

Use the same admin-guard middleware the other `/admin/*` routes use (grep an existing admin route file, e.g. how `adminCategories` routes are protected — reuse `protect` + the admin/superadmin guard).

- [ ] **Step 1 (test):** `server/tests/serviceCategories.test.js`: admin create → appears in list with `serviceCount:0`; update name/SEO; delete blocked (409) when a service references it; toggle is_active; public list returns active only.
- [ ] **Step 2 (controller):** Implement `listAdmin` (all, each row joined with a service count via `services` count by `service_category_id`), `listPublic` (is_active=true, ordered by display_order), `create` (slugify name, default display_order = max+1), `update`, `remove` (block if any service references it → 409), `reorder` (accept `[{id,display_order}]`). Errors via `safeError`. Slug helper: lowercase, spaces→`-`, strip non `[a-z0-9-]`; ensure uniqueness (append `-2` on conflict).
- [ ] **Step 3 (routes):** `/api/admin/service-categories` (GET list, POST create, PUT :id, DELETE :id, PUT reorder) admin-guarded; `/api/service-categories` (GET public active) — protect not required (public picker) or `protect` if vendor-only. Mirror existing route guard patterns.
- [ ] **Step 4 (mount):** add `app.use('/api/admin/service-categories', ...)` and `app.use('/api/service-categories', ...)`.
- [ ] **Step 5:** `cd server && npm test -- serviceCategories` → green.
- [ ] **Step 6:** Commit
```bash
git add -- server/controllers/serviceCategoryController.js server/routes/serviceCategoryRoutes.js server/tests/serviceCategories.test.js server/index.js
git commit -m "feat(admin): service-categories CRUD API"
```

### Task 4.3: Client api + admin page + route + nav

**Files:** Modify `client/src/services/api.js`, `client/src/App.jsx`, admin sidebar nav; Create `client/src/pages/admin/AdminServiceCategories.jsx`

- [ ] **Step 1 (api):**
```js
export const adminListServiceCategories = ()        => API.get('/admin/service-categories');
export const adminCreateServiceCategory = (d)       => API.post('/admin/service-categories', d);
export const adminUpdateServiceCategory = (id, d)   => API.put(`/admin/service-categories/${id}`, d);
export const adminDeleteServiceCategory = (id)      => API.delete(`/admin/service-categories/${id}`);
export const adminReorderServiceCategories = (rows) => API.put('/admin/service-categories/reorder', { rows });
export const listServiceCategories       = ()       => API.get('/service-categories');
```
- [ ] **Step 2 (page):** Build `AdminServiceCategories.jsx` mirroring the layout/state conventions of the existing `AdminCategories.jsx` (read it first). Features required:
  - Table/tree of categories grouped by parent (parents, then their children indented).
  - Create/Edit drawer or modal: name, description, icon upload (reuse the project's Cloudinary upload util — grep how `AdminCategories`/logo upload does it), parent (select among existing top-level categories), display_order, is_active toggle, SEO (seo_title, seo_description, seo_keywords).
  - Per-row: service count, activate/deactivate toggle, edit, delete (confirm; show the 409 "in use" message as a toast).
  - Reorder via display_order field (drag is optional; a numeric order input is sufficient for v1).
- [ ] **Step 3 (route fix):** In `App.jsx`, add the lazy import and point the categories route at the new page (line ~258). Replace:
```jsx
<Route path="/admin/services/categories" element={<AdminWrapper><AdminServices /></AdminWrapper>} />
```
with:
```jsx
<Route path="/admin/services/categories" element={<AdminWrapper><AdminServiceCategories /></AdminWrapper>} />
```
and add near the other admin lazy imports:
```jsx
const AdminServiceCategories = lazy(() => import('./pages/admin/AdminServiceCategories'));
```
- [ ] **Step 4 (nav):** Grep the admin sidebar nav config (e.g. `client/src/components/admin/` layout/sidebar) for the existing "Categories"/"All Services" entries; ensure the "Categories" link points to `/admin/services/categories` and is labeled clearly (e.g. "Service Categories") distinct from the profession taxonomy page (`/admin/professions`).
- [ ] **Step 5:** Verify in preview at `/admin/services/categories`: create a category, edit it, add a child, toggle active, see service count 0, delete an unused one.
- [ ] **Step 6:** Commit
```bash
git add -- client/src/services/api.js client/src/App.jsx client/src/pages/admin/AdminServiceCategories.jsx client/src/components/admin/
git commit -m "feat(admin): dedicated service-categories management module"
```

### Task 4.4: Vendor service form — category picker (read-only select)

**Files:** Modify `client/src/pages/services/ServiceForm.jsx`

- [ ] **Step 1:** Read `ServiceForm.jsx`. Add a "Category" `<select>` populated from `listServiceCategories()` (active only). On save, send `service_category_id`. Vendors can only pick — never create. Place near the existing profession/`category` field; this is a separate field (service marketplace category).
- [ ] **Step 2:** Confirm the service create/update backend accepts `service_category_id` (grep `serviceController` + `hostController` `updateServiceSafe` — both write services per memory `service-categories-build`; broaden their allowed-column lists to include `service_category_id`, mirroring how `category` was added). Add it to both writers.
- [ ] **Step 3:** Verify: create/edit a service, pick a category, reload → persists.
- [ ] **Step 4:** Commit
```bash
git add -- client/src/pages/services/ServiceForm.jsx server/controllers/serviceController.js server/controllers/hostController.js
git commit -m "feat(services): vendor service-category picker (read-only)"
```

---

## Final verification (all phases)

- [ ] `cd server && npm test` → all green
- [ ] `cd client && npm test` → all green
- [ ] `cd client && npm run build` → succeeds
- [ ] Preview smoke: My Bookings (single ₹, review states), Reviews tabs, notification bell (role-filtered, mobile width), role toggle after Back, admin filter buttons, admin service categories CRUD, vendor category picker.
- [ ] Confirm v3.39 + v3.40 applied to BOTH Supabase projects.
- [ ] `git branch --show-current` == `feat/ui-changes`; open PR against `main`.

## Self-review notes
- Spec coverage: issues 2–9 each have ≥1 task; issue 1 confirmed false (no task needed). ✅
- Type consistency: `inAppNotify({userId,role,type,title,body,link,data})` used identically in helper + all call sites; `getReceivedReviews(direction)` / `?direction=` consistent client↔server; `service_category_id` consistent across migration, both service writers, and form. ✅
- Migrations: v3.39, v3.40 (next free after v3.38). ✅
