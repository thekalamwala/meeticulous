# Service Categories — Design

**Date:** 2026-06-20 (reconciled 2026-06-21 against PR #107)
**Branch:** `feat/service-categories`
**Status:** Approved (brainstorming), pending implementation plan

## Context update — PR #107 (`6c3bade`)

After this spec was first approved, **PR #107 "industry categories"** merged to `main`. It reworked the **host** category system (migration v3.21):

- `categories` table → **60-row taxonomy** with `group_label`, status enum extended with `disabled` (20 active / 40 disabled).
- **`profiles.primary_category`** (single slug) added. `profiles.categories` JSONB array retained, now **primary-first** and **plan-capped**.
- Plan caps in `subscription_plans.limits.categories`: free **0** (locked), creator **1**, professional **3**.
- Onboarding step 4 rebuilt as a **single-select, industry-grouped Primary Category** step (the old multi-select grid is gone).
- New shared logic: `server/lib/categoryRules.js` (`validateCategorySelection`), `client/src/utils/categoryUtils.js` (`getCategoryRules`, `groupCategories`); endpoints `GET/PUT /host/categories`; dashboard `CategoriesSection`; admin categories redesign.

**Impact on this feature:** #107 never touched the `services` table or `serviceController` — the **service↔category link is still missing**, so this feature stands. Two changes from the original spec: (1) the "polish the category grid" item is **dropped** (that step was rewritten by #107), and (2) the picker sources the host's categories from the **new model** (`profiles.categories`, primary-first; default `primary_category`).

## Problem

A host now declares a **primary category** (+ up to 2 more on Pro) via onboarding and the dashboard `CategoriesSection`. But **services still carry no category** — the `services` table has no category column, and neither the onboarding first-service step nor the dashboard service form captures one. Services are disconnected from the host's declared categories.

**Ask:** every service must live inside one of the host's declared categories (service's category = a host-owned category), captured wherever a service is created.

## Goals

- Every service carries a `category` (a category slug) drawn from the host's own registered categories (`profiles.categories`, primary-first).
- Default a new service's category to the host's `primary_category`.
- Capture it in onboarding first-service step **and** dashboard add/edit.
- Display the category on service cards and the public service page.

## Non-Goals (deferred)

- ~~Category-grid polish~~ — superseded by PR #107's rebuilt onboarding step.
- Explore page filtering by category (Explore foundation deferred project-wide).
- Service templates / pre-filled suggested services per category.
- Multi-category-per-service (single category only; nullable TEXT can widen later).
- Sharpening `admin_category_stats()` to count by the service's own category instead of the host's categories (possible follow-up once `services.category` exists — noted, not built here).

## Decisions (approved)

- **One category per service**, **required** (every host has a `primary_category` after onboarding).
- **Default = host's `primary_category`.** Auto-assigned and shown read-only when the host has a single category (free/creator). Selectable among `profiles.categories` when the host has 2–3 (professional).
- Store as a **slug string** (`services.category TEXT`), matching the slug convention used everywhere (`profiles.categories`, `primary_category`, `/api/categories`).

## Approach (chosen: A)

**A — `category` slug column on `services`.** Reuses the slug convention (profiles store slugs, the categories API returns slugs) — no joins, no new key type. Tiny additive schema change. Forward-compatible with future Explore filtering and with sharpening the stats RPC.

Rejected: **B** — `category_id` UUID FK (breaks the app-wide slug convention, forces joins); **C** — multi-category array per service (YAGNI; a nullable TEXT can widen later).

## Design

### 1. Data model

New migration `server/migrations/v3.22_service_category.sql`:

```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);
```

- **Nullable** so existing rows stay valid (no backfill — legacy services show no badge / "Uncategorized" until edited).
- Stores a category **slug** (e.g. `'career-coach'`). Allowed values = the host's `profiles.categories`.
- Index supports future category filtering and a sharper stats RPC.

### 2. Backend ([serviceController.js](../../../server/controllers/serviceController.js))

- `buildPayload`: whitelist `category` → `p.category` (trimmed string, or null/empty when the host has none).
- `V2_SELECT_COLS`: add `category`. The existing `schemaMissing()` graceful-degrade path already falls back when the column isn't present yet (pre-migration safety).
- **Validation** on create + update: load the host's `profiles.categories`. If the host has categories, `category` is **required** and must be a member of that array → else 400. If the host somehow has none (shouldn't happen post-onboarding), allow null. Keep this a small inline check (the existing `categoryRules.validateCategorySelection` governs *host* selection, not service tagging — do not overload it).
- `category` is surfaced on public service reads automatically once it's in `V2_SELECT_COLS`.

### 3. Selector — shared component

New `client/src/components/services/ServiceCategoryPicker.jsx` (small, presentational):

- Props: `categories` (host's registered list, primary-first: `[{slug,label,group_label}]`), `value` (slug), `onChange`.
- Resolve the host's set as: `profiles.categories` if non-empty, else `[primary_category]` (robust whether onboarding wrote the array or just the primary). Default `value` = `primary_category` || first item.
- **1 category** (free/creator) → auto-select; render a read-only chip ("Category: Career Coach"). No interaction required.
- **2–3 categories** (professional) → required single-select chips; nothing selected blocks submit.
- slug→label resolved from the host's category objects via `categoryUtils` (fallback: prettified slug).

Used in two places:

- **[ServiceForm.jsx](../../../client/src/pages/services/ServiceForm.jsx)** (dashboard add/edit): fetch host categories (via `/auth/me` profile, or `GET /host/categories`); add `category` to form state; prefill from `initialData.category` on edit; include in submit payload.
- **[FirstServiceStep.jsx](../../../client/src/pages/onboarding/FirstServiceStep.jsx)** (onboarding step 9): read the host's `primary_category` / `categories` from onboarding state (keyed by `slug`); include `category` in the `createService` call. (Integration point: confirm the onboarding-state fetch exposes `primary_category`/`categories`, or extend it.)

### 4. Display

- **Dashboard service cards** and **public service page header**: render a small category badge.
- slug→label via the categories list already available on those pages / `categoryUtils` (fallback: prettified slug).
- Legacy null category → no badge (dashboard may show a muted "Uncategorized").

## Edge cases

- **Host with 0 categories** (shouldn't happen post-onboarding): selector hidden, category optional, service saves null.
- **Professional host downgrades** so a service's category is no longer in their (now smaller) `profiles.categories`: keep the stored value and show it; the picker only offers their current categories on next edit. (No forced rewrite.)
- **Pre-migration runtime** (column not yet added in a given DB): `schemaMissing()` fallback keeps reads working; writes omit `category` until the column exists.

## Testing

- Backend: create/update with a valid host category → persists; with a slug not in the host's `profiles.categories` → 400; with no category when the host has none → allowed.
- Frontend: single-category host sees auto-assigned read-only chip; professional (multi) host must pick; edit prefills existing category; default is `primary_category`.
- Migration applied to both DBs (staging Tokyo + prod Mumbai) before merge.

## Rollout

1. Apply `v3.22` migration to both Supabase DBs.
2. Ship backend (graceful pre-migration fallback makes ordering forgiving).
3. Ship frontend selector + display.
