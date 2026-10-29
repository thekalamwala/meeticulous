# Background Redesign — Lines + Dots

**Date:** 2026-07-06
**Branch:** `chore/background-redesign`
**Status:** Approved

## Summary

Replace all 7 existing animated host-page backgrounds (DotGrid, Galaxy, Rain, Holi, Diwali, Celebration, MeshGradient) with 2 new clean, minimal patterns: **Lines** and **Dots**. Keep **None** as the default option.

## New Engines

### Lines ("Wave Lines")

Canvas-based via `useBackgroundCanvas` hook.

- 6–8 horizontal sine waves spanning full viewport width
- Each wave: different amplitude (8–20px), wavelength (300–600px), phase offset
- Slow rightward phase drift (~0.3px/frame at "calm")
- Stroke color = host accent color at 0.08–0.20 opacity (layered for depth)
- Line width 1–2px
- ~60 lines of code, zero dependencies

**Admin params:**
| Param | Label | Options |
|-------|-------|---------|
| density | Density | few, normal, many |
| speed | Speed | calm, normal, lively |

### Dots ("Floating Particles")

Canvas-based via `useBackgroundCanvas` hook.

- 40 soft circles at random initial positions, sizes 2–5px
- Slow Brownian drift: each dot has random dx/dy velocity (±0.1–0.3 px/frame)
- Seamless edge wrapping
- Fill = host accent color at 0.06–0.18 opacity (varied per dot)
- No mouse interaction — purely ambient
- ~60 lines of code, zero dependencies

**Admin params:**
| Param | Label | Options |
|-------|-------|---------|
| count | Count | sparse, medium, dense |
| speed | Speed | calm, normal, lively |

### Shared Behaviour

- Both use existing `useBackgroundCanvas` hook (DPR, resize, 0.8s fade-in)
- Both use `palette.js` for color utils
- `prefers-reduced-motion` → static gradient fallback (handled by `HostBackground.jsx`)
- 60fps target, lightweight — no GSAP or external deps

## Registry Changes

### Client (`client/src/backgrounds/registry.js`)

Shrinks from 7 entries to 2:

```
BACKGROUNDS = [
  { key: 'lines', label: 'Lines', ... },
  { key: 'dots',  label: 'Dots',  ... },
]
```

### Server (`server/config/backgroundKeys.js`)

```
BACKGROUND_KEYS = ['lines', 'dots']
```

### Default Background

`appearanceController.js` fallback changes: `'dotgrid'` → `'lines'`

## Database Impact

None. `appearance_settings.backgrounds` is a JSON column. Old keys (dotgrid, galaxy, etc.) become inert — `sanitizeBackgrounds()` already strips unknown keys. No migration needed.

## Files to Delete

**Engines (7):**
- `client/src/backgrounds/engines/DotGrid.jsx`
- `client/src/backgrounds/engines/DotGrid.css`
- `client/src/backgrounds/engines/Galaxy.jsx`
- `client/src/backgrounds/engines/Rain.jsx`
- `client/src/backgrounds/engines/Holi.jsx`
- `client/src/backgrounds/engines/Diwali.jsx`
- `client/src/backgrounds/engines/Celebration.jsx`
- `client/src/backgrounds/engines/MeshGradient.jsx`

**Tests (7):**
- `client/src/backgrounds/__tests__/dotgrid.test.jsx`
- `client/src/backgrounds/__tests__/galaxy.test.jsx`
- `client/src/backgrounds/__tests__/rain.test.jsx`
- `client/src/backgrounds/__tests__/holi.test.jsx`
- `client/src/backgrounds/__tests__/diwali.test.jsx`
- `client/src/backgrounds/__tests__/celebration.test.jsx`
- `client/src/backgrounds/__tests__/mesh.test.jsx`

## Files to Create

- `client/src/backgrounds/engines/Lines.jsx`
- `client/src/backgrounds/engines/Dots.jsx`

## Files to Update

- `client/src/backgrounds/registry.js` — 2 entries instead of 7
- `server/config/backgroundKeys.js` — `['lines', 'dots']`
- `server/controllers/appearanceController.js` — default fallback `'dotgrid'` → `'lines'`
- `client/src/backgrounds/__tests__/registry.test.js` — update key assertions
- `client/src/backgrounds/__tests__/parity.test.js` — match new keys
- `server/tests/backgroundKeys.test.js` — update key list
- `server/tests/appearanceBackgrounds.test.js` — update default fallback

## Files Kept Untouched

- `client/src/backgrounds/useBackgroundCanvas.js` + test
- `client/src/backgrounds/palette.js` + test
- `client/src/backgrounds/HostBackground.jsx` + test
- `client/src/components/BackgroundPicker.jsx` + test
- `client/src/components/admin/BackgroundCurator.jsx` + test
