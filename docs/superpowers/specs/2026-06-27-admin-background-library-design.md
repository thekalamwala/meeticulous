# Admin Background Library — Design

**Date:** 2026-06-27
**Status:** Approved (pre-implementation)
**Branch:** `feat/admin-background-library`

## Summary

Add an admin-curated library of animated **background types** for host service
pages. Engineers ship background *engines* (code components); admin enables /
disables them and tunes a few params each; hosts pick one enabled type for their
service page. Every type is tinted from the **host's theme color** — no separate
background color choice for hosts.

This generalizes the single hardcoded `DotGrid` backdrop shipped on
`ServiceDetail` (PR #215) into a registry-driven, pluggable system.

## Goals

- Admin can curate which background types are live and set per-type params + a
  default, from a new **Backgrounds** section under Admin → Appearance.
- Hosts pick one *enabled* background for their service page; it renders in their
  brand color.
- Adding a new background type is a small, isolated change: one engine component
  + one registry entry. No changes to admin/host/service wiring required.
- Festive/seasonal types (Holi, Diwali, Celebration) can be toggled on around
  their occasion and off afterward.

## Non-Goals (YAGNI)

- No admin-saved *named param-presets* per type (a `background_presets` table).
  Variety comes from distinct engine types, not multiple configs of one type.
- No per-page-type assignment by admin. Scope is the **service page hero only**.
- No host-chosen background color separate from their theme color.
- No applying backgrounds to the profile/landing page (deferred; possible later).

## Launch Type Set (7)

| key | label | engine | source |
|---|---|---|---|
| `dotgrid` | Dot Grid | exists | refactor PR #215 component into registry |
| `mesh` | Mesh Gradient | reuse | adapt changelog mesh-gradient backdrop (commit `aad8e43`) |
| `galaxy` | Galaxy | new canvas | drifting starfield + twinkle |
| `rain` | Rain | new canvas | falling streaks, slight angle |
| `holi` | Holi | new canvas | rising color-splash bursts |
| `diwali` | Diwali | new canvas | diyas + periodic fireworks |
| `celebration` | Celebration | new canvas | confetti burst + fall |

`galaxy`, `rain` are ambient (non-seasonal). `holi`, `diwali`, `celebration` are
flagged `seasonal: true` (UI hint only; does not gate behavior).

### Color rule

`HostBackground` receives a single `color` (the host's `theme_color`, falling
back to `DEFAULT_THEME_COLOR`). Each engine derives whatever palette it needs
from that one color:
- Ambient types (dotgrid, mesh, galaxy, rain): use `color` directly + tints.
- Festive types (holi, diwali, celebration): derive a small palette by rotating
  hue / lightening / darkening `color` (e.g. ±3 hue-shifted variants) so the
  effect stays multi-colored but on-brand. Palette derivation lives in a shared
  `client/src/backgrounds/palette.js` helper.

## Architecture

### 1. Type registry — `client/src/backgrounds/registry.js`

Single source of truth. Array/map of descriptors:

```js
{
  key: 'dotgrid',
  label: 'Dot Grid',
  seasonal: false,
  thumbnail: '/backgrounds/dotgrid.svg',   // static preview asset
  Component: lazy(() => import('./engines/DotGrid.jsx')),
  defaultParams: { density: 'medium', speed: 'normal' },
  paramSchema: [
    { key: 'density', label: 'Density', type: 'select', options: ['low','medium','high'] },
    { key: 'speed',   label: 'Speed',   type: 'select', options: ['calm','normal','lively'] },
  ],
}
```

- `Component` is `React.lazy` → each engine is code-split. The service page only
  downloads the chosen engine.
- `paramSchema` drives the admin controls generically (select / range / toggle).
  Keep **2–4 params per type**, expressed in friendly terms (density/speed), not
  raw pixel values. Each engine maps friendly values → its internal numbers.
- Adding a type = add an `engines/Foo.jsx` + one registry entry. Nothing else.

Engines live in `client/src/backgrounds/engines/`. The PR #215 `DotGrid.jsx`
moves from `components/` to `backgrounds/engines/DotGrid.jsx` and is adapted to
accept the friendly `params` (density→dotSize/gap, speed→returnDuration) plus
`color`.

### 2. Shared renderer — `client/src/backgrounds/HostBackground.jsx`

```jsx
<HostBackground typeKey="galaxy" color="#FE5100" params={{...}} />
```

Responsibilities (owns presentation so every engine looks consistent):
- Resolve `typeKey` → registry entry; if missing/disabled, render nothing.
- Wrap the engine in the **70vh top band** + `linear-gradient(to bottom,#000,transparent)`
  mask (the wrapper extracted from ServiceDetail PR #215).
- `prefers-reduced-motion: reduce` → render a static, non-animated fallback
  (engines expose a `static` render path, or HostBackground renders a simple
  tinted gradient when reduced-motion is set).
- `<Suspense fallback={null}>` around the lazy engine.

Reused by: ServiceDetail (live), AdminAppearance preview, host picker preview.

### 3. Data model

**`appearance_settings`** (single row, id=1) — add:
- `backgrounds` JSONB, default `'{}'`. Shape:
  ```json
  {
    "dotgrid":      { "enabled": true,  "order": 1, "params": { "density":"medium","speed":"normal" } },
    "galaxy":       { "enabled": true,  "order": 2, "params": { "starCount":"medium","speed":"calm" } },
    "diwali":       { "enabled": false, "order": 6, "params": {} }
  }
  ```
- `default_background` TEXT, default `'dotgrid'`.

Keys not present in JSONB fall back to registry `defaultParams` + `enabled:false`.

**`profiles`** — add:
- `background_key` TEXT NULL. The host's chosen type. NULL → use
  `default_background`. An invalid/disabled value also falls back to default.

Migration: `server/migrations/v3.x_backgrounds.sql` (next free version). Idempotent
`ADD COLUMN IF NOT EXISTS`. Apply to BOTH DBs (Tokyo staging, Mumbai prod) per
existing process.

### 4. Server

`server/controllers/appearanceController.js`:
- `update` (admin): accept + validate `backgrounds` (only known registry keys;
  params coerced to allowed schema values; booleans/order sanitized) and
  `default_background` (must be an enabled key, else first enabled, else
  `'dotgrid'`). Reject unknown keys silently (drop them).
- `getPublic`: include `backgrounds` (enabled only, with effective params, sorted
  by `order`) and `default_background` in the response, alongside existing
  navbar-logo fields.

Registry **key list** is duplicated server-side as a small constant
(`server/config/backgroundKeys.js`) for validation — client owns rendering, server
owns the allow-list. Adding a type updates both (documented landmine, like the
reserved-namespace dual-list).

Host `background_key` is written through the existing host profile update path
(the same endpoint ProfileSetup already uses to save theme/appearance — confirm
during planning, e.g. `PUT /auth/me` or host profile controller). Server validates
the value is a known key; invalid → store NULL.

### 5. Admin UI — Backgrounds section in `AdminAppearance.jsx`

New section below the existing logo settings (same page, `/admin/platform/appearance`):
- Loads `adminGetAppearance()` (already wired) → reads `backgrounds` + `default_background`.
- Renders one **card per registry type** (iterates the client registry so new
  types appear automatically):
  - thumbnail, label, `seasonal` chip,
  - **enable** toggle,
  - **param controls** generated from `paramSchema`,
  - **default** radio (only selectable among enabled),
  - **live preview** — `<HostBackground typeKey params color={SAMPLE_COLOR} />`
    in a fixed-height box (SAMPLE_COLOR = the platform accent so admin sees motion).
- Save button → `adminUpdateAppearance({ ...logoFields, backgrounds, default_background })`.

### 6. Host pick UI

A **Background** picker in the host appearance area (ProfileSetup appearance
section — confirm exact tab during planning):
- Fetch public appearance → list of **enabled** types only.
- Gallery of cards, each previewing `<HostBackground>` in the **host's own**
  theme color. "None"/default option present.
- Selecting a card saves `profiles.background_key` via the host profile update.
- Gated behind the page's existing save flow (no new endpoint if the profile
  update already accepts arbitrary profile fields).

### 7. Service page wiring

`ServiceDetail.jsx`:
- Replace the hardcoded `<DotGrid …>` (added in PR #215) with:
  ```jsx
  <HostBackground
    typeKey={resolvedBackgroundKey}
    color={dotColor}
    params={paramsForType}
  />
  ```
  inside the same 70vh masked wrapper — or let `HostBackground` own the wrapper
  and drop the local wrapper div.
- `resolvedBackgroundKey` = `vendor.background_key` if it's an enabled key, else
  `appearance.default_background`, else `'dotgrid'`.
- Source of `appearance` (enabled types + params + default): ServiceDetail fetches
  public appearance once (new lightweight call to `getPublic`) on mount, OR the
  service public payload is extended to embed it. Plan picks one; embedding in the
  service payload avoids an extra round-trip and is preferred.

## Error / Edge Handling

- Unknown or disabled `background_key` on a profile → silent fallback to default.
- Empty `backgrounds` JSONB → every type falls back to registry defaults, all
  disabled except `dotgrid` is treated as the implicit default so existing pages
  keep their current look.
- Reduced-motion users → static fallback, no canvas animation.
- Lazy engine import failure → Suspense/error boundary renders nothing (page
  unaffected; background is decorative).
- Backgrounded tab pauses `requestAnimationFrame` (known, see PR #215) — engines
  must tolerate paused RAF and resume on visibility; not a correctness issue.

## Performance

- Per-engine code splitting via `React.lazy` — only the chosen engine ships to a
  given service page.
- Engines cap dot/particle counts by friendly density tiers; honor reduced-motion.
- Thumbnails are static SVG/PNG assets, not live canvases, in admin/host galleries
  except the single focused live preview.

## Testing

- **Registry shape** (vitest): every entry has `key,label,Component,defaultParams,
  paramSchema,thumbnail`; keys unique; every key exists in the server
  `backgroundKeys` allow-list (import both, assert equal sets).
- **HostBackground** (vitest): renders chosen engine; falls back to nothing on
  unknown key; renders static path under mocked reduced-motion. Mind the
  jest-dom matcher gap — use `.getAttribute()/.textContent`, not custom matchers.
- **appearanceController** (jest): `update` drops unknown keys, clamps params,
  forces `default_background` to an enabled key; `getPublic` returns only enabled,
  sorted.
- **ServiceDetail** (vitest): given a profile `background_key`, mounts the right
  type; given an invalid one, mounts the default. Mock `services/api`.

## Premium Quality Bar (non-negotiable)

Every type and every screen must feel high-end, not a toy. Acceptance:

- **Motion**: steady 60fps; DPR-correct canvas (sharp on retina); ease-based, not
  linear; subtle and slow by default (premium = restrained, not busy). Each engine
  fades in on mount (no hard pop). No visible aliasing, banding, or tearing.
- **Palette**: festive types use refined, harmonious palettes derived from the host
  color (controlled hue rotation + tasteful tints), never raw saturated rainbow.
  Ambient types stay elegant and minimal.
- **Density default**: defaults tuned to look expensive — sparse/clean beats dense.
  High-density is opt-in.
- **Admin + host UI**: matches the existing admin shell polish (spacing, cards,
  toggles, radios) — consistent, not bolted-on. Crisp thumbnails (hand-tuned SVG/
  PNG, not screenshots). Live preview framed cleanly. Smooth control interactions.
- **Host gallery**: cards with real previews in the host's color, hover lift,
  selected state clearly indicated; feels like choosing a theme in a premium product.
- **Degradation**: reduced-motion fallback is itself tasteful (soft tinted gradient),
  not a blank box. Lazy-load shows nothing jarring (no layout shift).
- **Performance**: particle/dot counts capped; offscreen/hidden tab pauses cleanly;
  no memory growth over time; listeners + RAF fully torn down on unmount.

The plan must include a polish pass per engine and a final design-review checkpoint
against this bar before each PR.

## Implementation Phases (for the plan)

1. **Foundation** — registry + `HostBackground` + `palette.js`; move/refactor
   DotGrid into `engines/`; wire ServiceDetail to `HostBackground` using a static
   default (no admin/host data yet). Ship parity with PR #215.
2. **Server + admin** — migration (both DBs), controller validate/getPublic,
   `backgroundKeys.js`, AdminAppearance Backgrounds section. Admin can curate;
   service page reads `default_background`.
3. **Host picker** — `profiles.background_key`, host appearance picker, ServiceDetail
   honors host pick.
4. **New engines** — galaxy, rain, holi, diwali, celebration. Each is independent
   and parallelizable (registry entry + engine + thumbnail + palette use).

## Landmines / Notes

- **Dual key list**: client `registry.js` keys MUST match server `backgroundKeys.js`
  — adding a type touches both (CI test asserts equality).
- Apply the migration to **both** Supabase DBs (Tokyo staging, Mumbai prod).
- `/admin/*` and gated host pages are not preview-verifiable when SIGNED_OUT wipes
  the injected user → verify via vitest render tests, per existing dashboard pattern.
- Festive types must still read as "the host's brand" — palette derivation, not
  arbitrary rainbow, keeps them on-brand.
