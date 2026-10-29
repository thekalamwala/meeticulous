# Admin Shell Overhaul — Design Spec

**Date:** 2026-06-22
**Branch:** `feat/admin-shell-overhaul`
**Scope:** Admin **shell only** (sidebar + header + layout chrome). No per-page redesign.

## Problem

The admin shell (`client/src/components/common/AdminLayout.jsx`, ~480 lines) has three classes of issue, confirmed against the live shell:

1. **Visual** — near-black rail (`#1E1E1E`) vs light body (`#F6F7F9`) reads as a stark seam; dense tiny type (13/12/9.5px) and low-contrast grey labels look dated.
2. **Structure** — 9 sections, ~50 items overflow past the pinned footer; the `FUTURE MODULES` block is a flat list of disabled leaves.
3. **Dishonest controls** — the dark-mode toggle is a no-op (state set, nothing reads it); the `⌘K` search and the bell are decorative with no handlers.

## Decisions (locked with user 2026-06-22)

- **Look:** refine the dark rail (keep dark + orange `#FE5100`). Do **not** switch to light.
- **Nav:** **no cuts.** Keep every existing item. **Add** new inactive top-level tabs that expand to inactive children (roadmap teasers; nothing navigates).
- **Search / Bell / Dark mode:** make all three actually work.
- **Dark mode extent:** **shell chrome only** — header + content canvas + breadcrumbs flip to match the rail; persists. Page interiors with hardcoded light Tailwind stay light for now (accepted partial).
- **Bell content:** **needs-attention feed** — live counts of pending KYC / payouts / disputes / tickets with quick links.
- **Search content:** navigation-only command palette (no data search) — keeps it shell-scoped.

## Architecture

Extract feature widgets and nav data out of the layout (the file is already too large; isolation aids testing and keeps `AdminLayout` focused on layout):

| File | Change | Purpose |
|---|---|---|
| `client/src/components/common/AdminLayout.jsx` | edit | Visual refine, dark-mode wiring, header crowding fix, mount palette + bell, new "coming-soon group" render branch |
| `client/src/components/admin/adminNav.js` | **new** | Export `IC`, `NAV`, `PATH_LABELS`, `QUICK_ACTIONS`, and new `ROADMAP` groups. Pure data — unit-testable. |
| `client/src/components/admin/CommandPalette.jsx` | **new** | ⌘K modal: fuzzy-filter active destinations, keyboard nav |
| `client/src/components/admin/NotificationBell.jsx` | **new** | Bell dropdown: fetch + render attention feed |
| `client/src/styles/<admin>.css` | edit/new | `.admin-shell.dark` token block (header/canvas/breadcrumb/border) |
| `server/...` (notifications summary) | **conditional** | Only if no existing endpoint serves the counts — see Bell section |

### 1. Visual refinement (dark rail)
- Rail: soften charcoal, add subtle right border; keep orange active state (left border + tint).
- Labels gray-400 → gray-300; section caps gray-600 → gray-500, size 9.5 → 10.5px; modest line-height/padding bump.
- Header (light mode): cap the search button width, tighten the right cluster so the profile no longer collides near ~1280px.
- Final look approved via live preview screenshot, not mockup.

### 2. Nav — keep all + nested inactive roadmap
- Every current section/item preserved verbatim.
- Replace the flat `FUTURE MODULES` leaves with **disabled parent groups that still expand** to disabled children. Parent shows a "soon" badge; expand/collapse works so the roadmap is previewable; neither parent nor children navigate.
- New item shape: `{ comingSoon: true, label, icon, children: [{ label }] }`. New render branch `ComingSoonGroup` (distinct from the active `groupId` children branch and the inert leaf `disabled` branch).
- Proposed roadmap groups (editable):
  - CRM → Leads · Contacts · Pipelines · Deals
  - Marketing Automation → Journeys · Triggers · A/B Tests · Audiences
  - Affiliates → Partners · Commissions · Payout Rules · Links
  - Revenue Analytics → Cohorts · LTV · Churn · Forecasts
  - Integrations → Webhooks · API Keys · Zapier · OAuth Apps
  - AI Assistant → Auto-replies · Smart Insights · Copilot
  - Mobile App → Push · App Banners · Deep Links

### 3. Command palette (⌘K)
- Global keydown for Cmd/Ctrl+K; header search button also opens it.
- Centered modal overlay; text input auto-focused; fuzzy filter over a flat list of all **active** destinations built from `NAV` (children flattened, `disabled`/`comingSoon` excluded), each tagged with its section for context.
- ↑/↓ move highlight, Enter navigates (`useNavigate`), Esc/overlay-click closes; focus trap; respects existing permission filter (only show destinations the session can reach).
- No API. No state leaves the component.

### 4. Notification bell (needs-attention feed)
- On open, fetch attention counts: pending KYC, pending payouts, open disputes, open tickets.
- **Endpoint:** verify during planning whether an aggregate already exists. Prefer one read-only `GET /api/admin/notifications/summary` returning `{ kyc, payouts, disputes, tickets }` if not. This is the **only** sanctioned step past "shell only," and only if required.
- Dropdown: one row per category (icon, label, count, link); red dot on the bell when total > 0; empty state "Nothing needs attention"; error state on fetch failure. Counts respect admin permissions.

### 5. Dark mode (shell chrome only)
- Toggle adds/removes `dark` on the `.admin-shell` root and persists to `localStorage` key `adm_theme` (read on mount).
- Scoped CSS: when `.admin-shell.dark`, flip header bg, content canvas bg, breadcrumb text, and border tokens to dark values matching the rail. Rail already dark — unchanged.
- Page interior cards (white) remain until a later full-theme pass. Documented partial.

## Out of scope
- Per-page redesign; full dark theme for page interiors; removing/renaming any active nav item; building any real roadmap module; data search in the palette.

## Testing
- **Vitest (client):**
  - `adminNav` — flattening yields only active destinations (excludes `disabled`/`comingSoon`); roadmap groups are all inactive.
  - `CommandPalette` — filter narrows results; Enter navigates to highlighted route; Esc closes.
  - Dark-mode — toggle adds/removes `.dark` and writes/reads `localStorage`.
- **Regression:** existing admin test suites stay green (`AdminFeatureStatus`, `AdminCampaigns`, `AdminFinance`, `AdminPayouts`, `AdminLogin`, `AdminCategories`).
- **Manual:** live preview screenshots — desktop + mobile, light + dark — for sign-off before PR.

## Risks / landmines
- `AdminLayout` extraction must not break the security guard (`isValidAdminSession`) or the permission filter (`sessionCan`) — preserve both exactly.
- Bell endpoint may not exist; adding one touches the server (flagged, minimal, read-only, permission-gated).
- Shared-worktree HEAD drift (see project memory): chain `git checkout && git add -- <files> && git commit`; verify branch after each commit; push early.
