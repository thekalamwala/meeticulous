# Vendor Feedback — Design Spec

_Date: 2026-06-20 · Branch: `feat/vendor-feedback` · Status: approved, pending implementation plan_

## 1. Problem & Goal

Vendors (hosts) currently have no channel to tell us about their experience on the
platform or suggest improvements. The existing `reviews` system is for **booking**
reviews (guest ↔ host) — a different concern. We need a **vendor → platform**
feedback channel.

The explicit requirement is that this feature **lasts long term**. That means:

- **One extensible schema** so new feedback modes are additive, never a rewrite.
- **A visible loop** — vendors must see that their feedback goes somewhere, or they
  stop contributing and the feature rots into a graveyard.
- **Triageable signal** for the team, so feedback is organized, not an unread pile.

## 2. Scope & Phasing

Architecture is **unified** (single source of truth), but delivery is **phased** so we
ship small without sacrificing the long-term spine.

- **Phase 1 (build now):** spontaneous feedback widget + admin triage + notify-vendor
  loop, on the full unified schema.
- **Phase 2 (later, additive — no rework):** pulse / NPS surveys triggered at lifecycle
  moments. Survey responses write into the **same** `feedback` table.
- **Phase 3 (maybe):** public roadmap + voting. Columns exist from day one (dormant);
  this becomes a UI-only addition with no migration.

**In scope:** vendors only. **Out of scope:** guest-facing feedback, public roadmap UI
(Phase 3), surveys (Phase 2 — designed here, not built now).

## 3. Data Model — the long-term spine

### `feedback` table (new — migration `v3.20_vendor_feedback.sql`)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `vendor_id` | uuid FK → `profiles(id)` | submitter |
| `source` | text NOT NULL default `'widget'` | `widget` (P1) \| `survey` (P2) |
| `type` | text NOT NULL | `idea` \| `bug` \| `complaint` \| `praise` \| `other` |
| `area` | text NULL | `booking` \| `payments` \| `dashboard` \| `profile` \| `availability` \| `other` |
| `rating` | int NULL | NPS 0–10; used by surveys (P2), null for widget. CHECK 0–10 |
| `subject` | text NULL | short title (optional) |
| `body` | text NOT NULL | the feedback content |
| `status` | text NOT NULL default `'new'` | `new` → `reviewing` → `planned` → `shipped` → `declined` |
| `admin_note` | text NULL | internal triage note (never shown to vendor) |
| `admin_response` | text NULL | vendor-facing reply sent on loop-close |
| `screenshot_url` | text NULL | reuse existing Cloudinary upload |
| `context` | jsonb NULL | `{ page_url, user_agent }` for bug debugging |
| `vote_count` | int NOT NULL default `0` | **dormant** (Phase 3 roadmap) |
| `is_public` | bool NOT NULL default `false` | **dormant** (Phase 3 roadmap) |
| `survey_id` | uuid NULL | Phase 2 link; null for widget. Plain nullable col in P1; FK added in P2 migration |
| `handled_by` | uuid NULL | admin id who last triaged |
| `handled_at` | timestamptz NULL | last triage time |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | |

**Indexes:** `(vendor_id)`, `(status)`, `(source)`, `(type)`.

**Enums enforced** by CHECK constraints (Postgres) **and** server-side validation
(reject unknown values). `status` transitions are stamped (`handled_by`, `handled_at`,
`updated_at`) on every change.

**RLS:** vendor can SELECT/INSERT their own rows (`vendor_id = auth.uid()`); no vendor
UPDATE of `status`/admin fields. Admin access is server-side via the service-role client
(not client RLS), matching the existing admin pattern. `survey_id` FK is created now but
references a table added in Phase 2 — define it as nullable with the constraint added in
the Phase 2 migration to avoid a forward dependency (P1 migration leaves `survey_id` as a
plain nullable uuid column; P2 migration adds the FK).

### Phase 2 tables (designed now, built later)

- **`feedback_surveys`** — `id`, `key` (unique), `title`, `question`, `metric`
  (`nps` \| `csat`), `trigger_rule` jsonb (e.g. `{ "event": "onboarding_complete" }`,
  `{ "recurring": "monthly" }`, `{ "after_bookings": 10 }`), `is_active`, timestamps.
- **`feedback_survey_sends`** — `id`, `survey_id` FK, `vendor_id` FK, `sent_at`,
  `responded_at` null, `feedback_id` null FK. **Anti-spam:** unique
  `(survey_id, vendor_id, period)` so a vendor is never re-asked within the window.

Survey answers are **not** a separate response table — they INSERT into `feedback` with
`source='survey'`, `survey_id` set, and `rating` populated. This is what keeps the schema
unified.

## 4. Components & Flow

### Server

- **`server/controllers/feedbackController.js`** (new), conventions from
  `reviewController.js`:
  - `createFeedback` — `POST /api/feedback`, gated `requireFeature('vendor_feedback')`.
    Validates `type`/`area` enums, `body` length, optional `screenshot_url`. Inserts
    `status='new'`. Optionally fires `FEEDBACK_RECEIVED_ADMIN` (background).
  - `getMyFeedback` — `GET /api/feedback/mine` (protected). Returns vendor's own
    submissions with current `status` — **this is how the vendor sees the loop in-app.**
  - `listFeedback` (admin) — filters: `status`, `type`, `area`, free-text search.
  - `updateFeedbackStatus` (admin) — `PATCH`. Sets `status`, `admin_note`,
    `admin_response`; stamps `handled_by`/`handled_at`. Fires `FEEDBACK_STATUS_CHANGED`
    to the vendor when crossing into `planned` / `shipped` / `declined`.
- **`server/routes/feedbackRoutes.js`** (new) — vendor routes, `vendor_feedback` gated,
  `POST /feedback` rate-limited (reuse existing rate-limit middleware).
- Admin routes added to **`server/routes/adminRoutes.js`** with
  `requireAdmin('feedback.view')` / `requireAdmin('feedback.manage')`.
- Notification sends use the existing background helper (`server/utils/background.js`
  `runInBackground`) so the request stays snappy.

### Client

- **Vendor surfaces** (both wrapped in `<FeatureGate flag="vendor_feedback">`):
  - **Floating "Feedback" button** in `client/src/components/common/DashboardLayout.jsx`
    → opens a modal form (type select, area select, subject, body, optional screenshot).
    Low friction = more feedback = the feature lasts.
  - **`/dashboard/feedback`** page — "My feedback" list showing each submission and its
    status, so the loop is visible without waiting for an email.
- **Admin:** new `client/src/pages/admin/AdminFeedback.jsx` at `/admin/feedback` —
  triage table with status filter + detail drawer (set status, note, response). Nav item
  added to `AdminLayout.jsx` `NAV` (Support section), perm `feedback.view`. Lazy route in
  `client/src/App.jsx`.

## 5. Loop Close — Notifications

New rows in `notification_events` (seeded by the migration):

- **`FEEDBACK_STATUS_CHANGED`** — emails the vendor when an item moves to
  `planned` / `shipped` / `declined`, including `admin_response`.
- **`FEEDBACK_RECEIVED_ADMIN`** (optional) — pings ops on a new submission.

Email-only (WhatsApp is disabled platform-wide). Copy and channel toggles are editable by
admins in `/admin/notifications`. Fired via `NotificationEngine.send({ event, data })`.

## 6. Feature Flag

Add `vendor_feedback` to `server/config/featureRegistry.js` (category `Operations`, scope
`vendor`). A single switch gates the widget now and surveys later. Admins flip it in
`/admin/features`. Behavior is fail-open (consistent with existing flags).

## 7. Permissions

Add `feedback.view` and `feedback.manage` to `server/lib/adminPermissions.js`
`PERMISSIONS`, and assign to relevant roles (e.g. `operations`, `support`).

## 8. Error Handling

- Server-side validation of all enums, `body` length, and `rating` range; reject unknown
  enum values with 400.
- Notification sending is best-effort/background — failure never blocks a submit or a
  status update.
- Screenshot upload is optional; on upload failure the submit proceeds without it and the
  client warns.
- RLS prevents cross-vendor reads; admin writes go through the service-role client only.
- `POST /api/feedback` is rate-limited to prevent spam.

## 9. Testing

- **Unit:** enum rejection, `body` required, `rating` bounds, status-transition stamping,
  notification fires **only** on the right transitions (`planned`/`shipped`/`declined`).
- **Integration:** vendor submit → appears in admin `listFeedback` → admin sets `shipped`
  → vendor `GET /mine` shows `shipped` and a notification was attempted.
- **Feature flag:** off → `POST /feedback` returns 503 and the vendor UI is hidden.
- Follows the existing Jest setup (`--runInBand`, sandbox-off).

## 10. Why It Lasts

1. **One schema** — widget, surveys, and a future public roadmap all live in `feedback`;
   every new mode is additive (a column flip or a side table), never a rewrite.
2. **Visible loop** — vendors see status in-app (`/dashboard/feedback`) *and* by email,
   so contributing feels worthwhile and they keep doing it.
3. **Triageable** — admin pipeline + permissions keep the signal organized instead of
   rotting into an unread pile.

## 11. Migration Note

`v3.20_vendor_feedback.sql` must be run in the Supabase SQL Editor against **both** DBs
(Mumbai prod + Tokyo staging) after merge, per the project's migration workflow. All DDL
uses `IF NOT EXISTS` for idempotent reruns.
