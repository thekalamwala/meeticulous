# Logo Management — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review), ready for implementation plan
**Author:** Book A Sloth + Claude

## Problem

The website logo is a placeholder SVG (`<GoogleLogo />`) plus the text "Book A Sloth"
([Navbar.jsx:159](../../../client/src/components/common/Navbar.jsx)). There is no real
image logo, and no way for an admin to manage it. Emails likewise fall back to a text
wordmark when `email_settings.logo_url` is empty.

We want a real image logo, admin-managed, with seasonal ("festive") variants — used on
the website navbar and pulled into email templates.

## Goal

1. **Website:** an admin-managed navbar logo with three modes (Icon+Text / Image /
   Festive), one active at a time, images uploadable from admin.
2. **Email:** a fixed, stable image logo in the email header (no modes, no festive swaps).

## Decisions (locked)

| # | Decision |
|---|----------|
| 1 | Navbar logo is **admin-managed** via Admin → Appearance. |
| 2 | **Three modes**, one active: `icon_text` (mark + wordmark), `image` (full lockup), `festive` (seasonal lockup). No plain text-only mode. |
| 3 | Email logo is **fixed and decoupled** from the navbar — a stable image (`sloth-icon-sqr.png`), never festive, never text. |
| 4 | Festive is a **manual toggle** (admin sets mode = festive when wanted). No date-scheduling (phase 2). |
| 5 | Source of truth = a single DB row (`appearance_settings`); image files live in Supabase Storage / CDN; both website and admin read the row. |
| 6 | Navbar **fails safe**: if the appearance fetch fails or is empty, render the current text wordmark. |

## Architecture

### Email (trivial — no code)

Set `email_settings.logo_url` to the hosted stable mark:
`https://company-assets.bookasloth.in/images/email/sloth-icon-sqr.png`

The email header (`emailLayout.js`) already renders `settings.logo_url` as a 48px image
with a text fallback, so this is a one-time value set via the existing admin email-settings
UI (or a seed). No engine change. **Action item:** confirm `sloth-icon-sqr.png` is live at
that URL before setting it.

### Navbar — data model

New single-row table `appearance_settings` (migration `v3.8_appearance_settings.sql`):

| column | type | default | notes |
|--------|------|---------|-------|
| `id` | int PK | 1 | enforced single row (`check (id = 1)`) |
| `navbar_logo_mode` | text | `'icon_text'` | `icon_text` \| `image` \| `festive` |
| `icon_url` | text | `sloth-icon-sqr.png` CDN url | square mark for icon_text mode |
| `logo_image_url` | text | `''` | full lockup for image mode |
| `festive_logo_url` | text | `''` | seasonal lockup |
| `updated_at` | timestamptz | `now()` | |

RLS enabled, service-role only (writes go through the admin API; public read goes through
a server endpoint, not the browser anon client). Resilient fallback: if the table is
missing, the API returns defaults so the navbar still renders.

### API

**Public** (no auth — navbar needs it pre-login):
- `GET /api/appearance` → `{ navbar_logo_mode, icon_url, logo_image_url, festive_logo_url }`.
  Mounted alongside the other public endpoints in `server.js`.

**Admin** (RBAC-gated, isolated admin session):
- `GET /api/admin/appearance` → current row.
- `PUT /api/admin/appearance` → update mode + URLs. Validates `navbar_logo_mode` ∈ enum.
- Permission: reuse the same RBAC permission as the existing admin settings routes
  (`requireAdmin('<settings permission>')`; resolve the exact key from `adminRoutes.js` at
  build).

**Upload — reuse the existing admin route** (no new endpoint):
`POST /api/admin/upload/image?folder=branding` already exists, `requireAdmin()`-gated,
multer → Supabase Storage ([adminRoutes.js:28](../../../server/routes/adminRoutes.js)).
The admin UI uploads here, gets a URL back, then PUTs it into the chosen slot.

Controller: new `appearanceController.js` (`getPublic`, `getAdmin`, `update`).
Routes: public `GET /api/appearance` in `server.js`; admin `GET/PUT /api/admin/appearance`
in `adminRoutes.js`.

### Admin UI — build out `AdminAppearance.jsx` (currently an empty shell)

A "Navbar Logo" card:
- Mode selector (radio/segmented): Icon + Text · Image · Festive.
- Per-image-slot uploader (icon, image, festive) → `POST /api/admin/upload/image?folder=branding`
  → store returned URL in local state.
- Live preview of the active mode.
- Save → `PUT /api/admin/appearance`.

Follows existing admin page + upload patterns. Other Appearance features hinted in the
shell (theme color, favicon, typography) stay out of scope.

### Client — navbar render

A small `useAppearance` hook (or AppearanceContext) that:
- reads a cached value from `localStorage('bas_appearance')` for an instant, flash-free
  first paint;
- fetches `GET /api/appearance` once on mount and updates cache;
- exposes `{ mode, iconUrl, logoImageUrl, festiveLogoUrl, loaded }`.

Navbar logo block renders by mode:
- `icon_text` → `<img icon_url>` + "Book A Sloth" text span (current text styling).
- `image` → `<img logo_image_url>`.
- `festive` → `<img festive_logo_url>`.
- **Fallback** (not loaded / empty url for the active mode) → current text wordmark, so the
  header never breaks.

Images use fixed height + `alt="Book A Sloth"`; width auto.

## Data flow

```
Admin → AdminAppearance UI
  → POST /api/admin/upload/image?folder=branding   (upload file → URL)
  → PUT  /api/admin/appearance                     (mode + URLs → appearance_settings row)

Visitor → Navbar
  → GET /api/appearance (cached)                    → render active logo

Email send → emailLayout
  → settings.logo_url (email_settings, fixed image) → header logo
```

## Error handling & fallbacks

- Appearance table missing / fetch error → API returns defaults; navbar shows text wordmark.
- Active mode's URL empty → navbar falls back to text wordmark (or icon_text if icon present).
- Upload failure → toast, no row change.
- Email `logo_url` empty → existing text-wordmark fallback in `emailLayout.js` (unchanged).

## Testing

- **appearanceController (unit):** `getPublic` returns defaults when table missing; `update`
  rejects an invalid mode; `update` persists mode + URLs; `getAdmin` returns the row.
- **Navbar (component, if vitest covers components):** renders `<img>` for image/festive
  modes, icon+text for icon_text, text wordmark on fallback.
- **Manual:** upload a logo in admin, switch modes, confirm navbar updates; set email
  `logo_url` and test-send an email to confirm the header image renders.

## Out of scope

- Date-scheduled festive logos (manual toggle only; phase 2).
- Favicon, theme color, typography (other Appearance-page features).
- Email logo modes — email logo is a single fixed image.
- Multi-tenant / per-vendor logos.

## Affected files

- `server/migrations/v3.8_appearance_settings.sql` — new table (NOTE: a `v3.8` name is
  already used by monthly-subscriptions; pick the next free suffix at build, e.g.
  `v3.9_appearance_settings.sql`, to avoid a filename collision).
- `server/controllers/appearanceController.js` — new.
- `server/routes/adminRoutes.js` — admin GET/PUT appearance.
- `server/server.js` — mount public `GET /api/appearance`.
- `client/src/services/api.js` — appearance get/update + admin upload helpers.
- `client/src/pages/admin/AdminAppearance.jsx` — build out the Navbar Logo card.
- `client/src/components/common/Navbar.jsx` — render logo by mode.
- `client/src/hooks/useAppearance.js` (or context) — fetch + cache.
- `email_settings.logo_url` — set to the fixed mark (data, not code).
- Tests under `server/tests/`.
