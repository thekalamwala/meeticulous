# Industry Categories — Design Spec

**Date:** 2026-06-20
**Branch:** `feat/category-system`
**Status:** Approved design → ready for implementation plan

## Goal

Launch a curated, admin-managed **industry category** taxonomy (60 professions across 3 rollout phases). Hosts pick a **Primary Category** at onboarding; paid plans can manage additional categories in settings. Admin controls which categories are live (on/off) from a redesigned table with per-category analytics.

## Decisions (locked)

| Question | Decision |
|---|---|
| Structure | **Flat list of 60 professions** + a `group_label` for display grouping (no separate groups table). |
| Per host | **Multi-select** array, but capped by plan; one entry is the **Primary**. |
| Editability | Plan-gated (see Primary Category Model). |
| Old data | **Replace entirely** — delete the 11 old categories, seed the 60 new. Clear orphaned host arrays. |
| Colors | **Untouched.** Existing color/theme rules stay as-is. |

## The 60 Categories (3 phases)

Day 1 = `active` (20). Day 30 + Day 60 = `disabled` (40). Admin flips `disabled → active` to roll out a phase.

### Day 1 — `active` (20)
**Technology & Product:** Software Engineer, Product Manager, UX Designer, Data Scientist, AI Engineer
**Coaching & Consulting:** Career Coach, Life Coach, Executive Coach, Leadership Coach, Business Coach
**Health & Wellness:** Psychologist, Nutritionist, Speech Therapist
**Education:** Language Tutor, IELTS Coach, Study Abroad Consultant
**Business Services:** Financial Advisor, Startup Advisor, Business Consultant, HR Consultant

### Day 30 — `disabled` (20)
**Marketing & Creative:** Content Creator, Content Writer, Digital Marketer, Social Media Manager, Brand Consultant, Graphic Designer, Voice Artist, Music Producer
**Spiritual & Wellness:** Astrologer, Tarot Reader, Reiki Practitioner
**Design & Advisory:** Architect, Interior Designer, Fashion Stylist
**Teaching & Skills:** Music Teacher, Dance Teacher, Art Teacher, Coding Instructor, Public Speaking Coach, Communication Coach

### Day 60 — `disabled` (20, offline hosts)
**Offline Hosts:** Makeup Artist, Hair Stylist, Nail Artist, Tattoo Artist, Photographer, Videographer, Physiotherapist, Dentist, Dermatologist, Doctor, Yoga Trainer, Fitness Coach, Dance Studio, Music Academy, Coworking Space Owner, Event Planner, Wedding Planner, Spa Owner, Salon Owner, Recording Studio Owner

> Implementation note: each row gets a stable `slug` (e.g. `software-engineer`), a `group_label`, and a `sort_order` so phases/groups render in order. The Day-60 set keeps `group_label = 'Offline Hosts'` unless a finer grouping is specified at build time.

## Data Model

### `categories` table — migration `v3.20_industry_categories.sql`
Current schema (v1.9): `id, slug, label, status, sort_order, suggested_by, created_at, updated_at`.

Changes:
1. **Add column** `group_label text` (nullable; the heading shown in admin + onboarding grouping).
2. **Extend `status` CHECK** from `('active','pending','rejected')` → `('active','disabled','pending','rejected')`.
   - `active` = ON / green (selectable everywhere).
   - `disabled` = OFF / red (hidden from onboarding + profile picker; phased categories ship here).
   - `pending` / `rejected` = unchanged vendor-suggestion workflow.
3. **Replace seed:** `DELETE FROM categories;` then insert the 60 rows (20 active, 40 disabled) with `group_label` + `sort_order`.
4. **Clear orphans:** for every host whose `profiles.categories` references a now-deleted old slug, reset that array to `[]` (replace-entirely policy; near-zero real vendors). `primary_category` is added in this same migration so it starts `NULL` for all hosts — no clearing needed there.

### `profiles` table — same migration
1. **Add column** `primary_category text` (slug). The designated Primary — drives profile, listings, service organization.
2. **Repurpose existing** `categories jsonb` — full set of slugs the host holds, **always including** `primary_category`.

Invariant: if `primary_category` is set, it is also an element of `categories`.

## Primary Category Model (plan-gated)

| Plan | Onboarding | Settings management | Cap (total categories) |
|---|---|---|---|
| **Free** (`explorer`) | pick 1 → Primary | 🔒 locked — must contact Admin | 1 |
| **Creator** | pick 1 → Primary | change/swap Primary | 1 |
| **Pro** (`professional`) | pick 1 → Primary | change Primary **+ add up to 2 more** | 3 |

### Server-side invariants (`PUT /api/host/categories`)
- Exactly **one** Primary, always present in `categories`.
- Total categories ≤ plan cap (`explorer`=1, `creator`=1, `professional`=3).
- Free plan → `403` (locked; cannot self-edit).
- Only `status='active'` categories are selectable.
- Pro cannot end up with zero Primary — one must always remain designated.
- Plan read from `profiles.plan` server-side; never trusted from client.

### Admin override
- `PATCH /api/admin/users/:id/categories` — admin sets any host's `primary_category` + `categories`, **bypassing plan cap**. Validates categories are `active` and the invariant holds.
- Surfaced in the admin user detail view (handles the "Free contacts Admin" path). If no host-edit surface exists, add a minimal Category field there.

## Admin Categories Table (redesign `/admin/services/categories`)

Replaces the current flat list in `client/src/pages/admin/AdminCategories.jsx`. Rows **grouped by `group_label`**.

### Columns (exactly as specced)
| Category Name | Status | Registered Hosts | Active Services | Date Added | Actions |
|---|---|---|---|---|---|
| Label + `/slug` | dropdown 🟢 Active / 🔴 Off | count | count | `created_at` | ✏️ edit · 🗑️ delete |

- **Status** = `<select>` dropdown (no toggle), per requirement. Options: 🟢 Active (`active`), 🔴 Off (`disabled`). On change → `adminUpdateCategory(id, { status })`.
- **Pending suggestions** keep their Approve / Reject controls (separate pending section retained).
- **Delete guard:** if Registered Hosts > 0 → delete button disabled, tooltip "N hosts registered — set to Off instead." Enforced **server-side too** (`adminDelete` pre-checks count, returns `409`).
- **Add new:** label + group dropdown (existing groups, or new) + initial status (default Active).

### Analytics
- Per-row counts (Registered Hosts, Active Services).
- Top strip summary: total active categories, total hosts categorised, busiest category.

### Counts source
One SQL RPC `admin_category_stats()` returns `(slug, registered_hosts, active_services)`:
- `registered_hosts` = `count(profiles where categories ? slug)` (the `?` jsonb operator — slug present in array).
- `active_services` = `count(services s join profiles p on s.host_id = p.id where s.is_active and p.categories ? slug)`.

`adminList` calls the RPC and merges counts by slug into the category rows. Cheap at this scale (60 categories × small host count).

## Onboarding (Step 4 — `client/src/pages/onboarding/CategoryStep.jsx`)

- Change from multi-select → **single-select**.
- Heading/label → **"Pick Your Primary Service Category"**.
- Options grouped by `group_label`; only `active` categories shown.
- Custom-suggest box **stays** (→ `status='pending'`, admin approval).
- On save: persist `primary_category = slug` and `categories = [slug]` via `updateOnboardingStep` (payload extended; the controller writes both columns).
- `FALLBACK` array in the file updated to a slice of the new active set (offline resilience).

## Profile Settings (new "Service Categories" section)

- Lives in the dashboard profile page (`ProfileSetup.jsx`).
- Shows current Primary + additional categories.
- Renders plan-appropriate controls:
  - **Free:** read-only + "Upgrade / contact Admin to change" note.
  - **Creator:** Primary swap (single picker).
  - **Pro:** Primary picker + add up to 2 additional (active categories only).
- Saves via `PUT /api/host/categories`. `PUT /api/host/profile` continues to **not** touch categories.

## Backend Summary

| Endpoint | Change |
|---|---|
| `GET /api/categories` (`listActive`) | unchanged (already filters `active`); returns `group_label` too. |
| `GET /api/admin/categories` (`adminList`) | merge RPC counts; include `group_label`. |
| `POST /api/admin/categories` (`adminCreate`) | accept `group_label`; status may be `disabled`. |
| `PUT /api/admin/categories/:id` (`adminUpdate`) | accept `group_label`; allow `disabled`. |
| `DELETE /api/admin/categories/:id` (`adminDelete`) | block (`409`) if registered hosts > 0. |
| `PUT /api/host/categories` | **new** — plan-cap enforced primary/additional management. |
| `PATCH /api/admin/users/:id/categories` | **new** — admin override, no cap. |
| `updateOnboardingStep` (step 4) | write `primary_category` + `categories`. |

## Out of Scope (YAGNI)
- Two-level group/category hierarchy (groups as their own table).
- Scheduled / automated phase rollout (admin flips manually).
- Old→new slug mapping (we replace + clear).
- `services` table getting its own `category` column (category derives from host).
- Any change to color/theme plan rules.

## Testing
- **Migration:** applies cleanly; 60 rows present (20 active / 40 disabled); old 11 gone; orphan host arrays cleared.
- **Plan caps:** Free `PUT /host/categories` → 403; Creator capped at 1; Pro capped at 3; Primary invariant always holds; disabled category rejected.
- **Delete guard:** delete with registered hosts → 409; delete empty category → 200.
- **Counts RPC:** registered/active-service counts correct for a seeded host+service.
- **Onboarding:** single-select saves `primary_category` + `categories`.
- **Admin override:** sets any host's category bypassing cap; invariant validated.
- Existing suites stay green (server Jest, client Vitest).
