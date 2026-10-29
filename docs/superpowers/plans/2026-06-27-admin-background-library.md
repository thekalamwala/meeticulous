# Admin Background Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `DotGrid` service-page backdrop with an admin-curated, registry-driven library of 7 animated background types that hosts pick for their service page, each tinted from the host's theme color.

**Architecture:** A client-side **type registry** maps each background `key` to a lazy-loaded engine component + param schema + thumbnail. A shared `<HostBackground>` renderer owns the 70vh masked band, Suspense, and reduced-motion fallback. Admin curates enabled types + params in `appearance_settings.backgrounds` (JSONB) with a `default_background`; hosts store their pick in `profiles.background_key`. `ServiceDetail` resolves host pick → admin params → renders via `<HostBackground>`.

**Tech Stack:** React 18 + Vite (Vitest), Express 4 (Jest), Supabase Postgres (JSONB), GSAP core (already present), Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-06-27-admin-background-library-design.md`

**Premium quality is non-negotiable** — see the spec's "Premium Quality Bar". Every engine: 60fps, DPR-correct, ease-based, slow/restrained defaults, fade-in on mount, full teardown. Final design-review checkpoint per PR (Task 22).

---

## File Structure

**Client (new) — `client/src/backgrounds/`**
- `palette.js` — color helpers: hex↔rgb, hue rotation, tints, festive palette derivation. Pure functions.
- `registry.js` — single source of truth: array of type descriptors `{ key, label, seasonal, thumbnail, Component, defaultParams, paramSchema }`.
- `HostBackground.jsx` — shared renderer (wrapper + mask + Suspense + reduced-motion).
- `useBackgroundCanvas.js` — reusable canvas/DPR/resize/RAF/fade-in hook for new engines.
- `engines/DotGrid.jsx` — moved from `components/DotGrid.jsx`, adapted to friendly params.
- `engines/DotGrid.css` — moved from `components/DotGrid.css`.
- `engines/MeshGradient.jsx`, `Galaxy.jsx`, `Rain.jsx`, `Holi.jsx`, `Diwali.jsx`, `Celebration.jsx`.
- `thumbnails/*.svg` — static preview assets per type.

**Client (modified)**
- `pages/ServiceDetail.jsx` — swap `<DotGrid>` for `<HostBackground>`.
- `pages/admin/AdminAppearance.jsx` — add Backgrounds section.
- `pages/ProfileSetup.jsx` — add Background picker in Appearance section (458–476).
- `services/api.js` — `getAppearance` (143) reused; no new fn needed (admin update at 145 reused).

**Server (new)**
- `config/backgroundKeys.js` — allow-list of keys (mirror of registry).
- `migrations/v3.52_backgrounds.sql` — schema changes.

**Server (modified)**
- `controllers/appearanceController.js` — `update` validation + `getPublic` payload.
- `controllers/hostController.js` — add `background_key` to profile allow-list (227–313).
- `controllers/serviceController.js` — `fetchPublicVendor` cols (133–142) + embed appearance (497–506).

**Tests**
- `client/src/backgrounds/__tests__/*.test.{js,jsx}`
- `server/tests/appearanceBackgrounds.test.js`, `server/tests/backgroundKeys.test.js`

---

## PHASE 1 — Foundation (registry + HostBackground + DotGrid refactor + service page parity)

### Task 1: Color palette helper

**Files:**
- Create: `client/src/backgrounds/palette.js`
- Test: `client/src/backgrounds/__tests__/palette.test.js`

- [ ] **Step 1: Write the failing test**

```js
// client/src/backgrounds/__tests__/palette.test.js
import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, rotateHue, tint, festivePalette } from '../palette';

describe('palette', () => {
  it('parses hex to rgb', () => {
    expect(hexToRgb('#FE5100')).toEqual({ r: 254, g: 81, b: 0 });
    expect(hexToRgb('bad')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('round-trips rgb<->hex', () => {
    expect(rgbToHex({ r: 254, g: 81, b: 0 })).toBe('#fe5100');
  });
  it('rotateHue returns a valid hex different from input', () => {
    const out = rotateHue('#FE5100', 120);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out).not.toBe('#fe5100');
  });
  it('tint lightens toward white at amount 1', () => {
    expect(tint('#000000', 1)).toBe('#ffffff');
    expect(tint('#000000', 0)).toBe('#000000');
  });
  it('festivePalette returns N on-brand hex colors', () => {
    const p = festivePalette('#FE5100', 5);
    expect(p).toHaveLength(5);
    p.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/backgrounds/__tests__/palette.test.js`
Expected: FAIL (`palette` not found).

- [ ] **Step 3: Write the implementation**

```js
// client/src/backgrounds/palette.js
export function hexToRgb(hex) {
  const m = String(hex).match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function rgbToHex({ r, g, b }) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function rotateHue(hex, deg) {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ ...hsl, h: hsl.h + deg }));
}

export function tint(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, amount));
  return rgbToHex({ r: r + (255 - r) * a, g: g + (255 - g) * a, b: b + (255 - b) * a });
}

// Harmonious, on-brand multi-color set derived from one base color.
// Controlled hue rotation + gentle tint variance — never raw rainbow.
export function festivePalette(hex, n = 5) {
  const spread = 38; // degrees each side — analogous, stays on-brand
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
    out.push(tint(rotateHue(hex, t * spread), 0.08 + Math.abs(t) * 0.12));
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/backgrounds/__tests__/palette.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/backgrounds/palette.js client/src/backgrounds/__tests__/palette.test.js
git commit -m "feat(backgrounds): color palette helper for host-tinted backgrounds"
```

---

### Task 2: Move + adapt DotGrid engine to friendly params

**Files:**
- Create: `client/src/backgrounds/engines/DotGrid.jsx` (from `client/src/components/DotGrid.jsx`)
- Create: `client/src/backgrounds/engines/DotGrid.css` (from `client/src/components/DotGrid.css`)
- Delete: `client/src/components/DotGrid.jsx`, `client/src/components/DotGrid.css`
- Test: `client/src/backgrounds/__tests__/dotgrid.test.jsx`

- [ ] **Step 1: Move the files**

```bash
git mv client/src/components/DotGrid.jsx client/src/backgrounds/engines/DotGrid.jsx
git mv client/src/components/DotGrid.css client/src/backgrounds/engines/DotGrid.css
```

- [ ] **Step 2: Adapt the component signature to `{ color, params }`**

Replace the props block in `engines/DotGrid.jsx` so the engine takes the registry contract `{ color, params }` and maps friendly tiers to internal numbers. Replace the existing `const DotGrid = ({ ...long prop list... }) => {` header with:

```jsx
const DENSITY = { low: { dotSize: 4, gap: 34 }, medium: { dotSize: 5, gap: 24 }, high: { dotSize: 6, gap: 16 } };
const SPEED = { calm: 2.0, normal: 1.4, lively: 0.9 }; // returnDuration seconds

const DotGrid = ({ color = '#5227FF', params = {} }) => {
  const { dotSize, gap } = DENSITY[params.density] || DENSITY.medium;
  const returnDuration = SPEED[params.speed] || SPEED.normal;
  const baseColor = color;
  const activeColor = color;
  const proximity = 120;
  const speedTrigger = 100;
  const shockRadius = 220;
  const shockStrength = 4;
  const maxSpeed = 5000;
  const className = '';
  const style = undefined;
```

Keep the rest of the component body (refs, effects, draw loop, pushDot, JSX) exactly as shipped in PR #215. The `./DotGrid.css` import path is unchanged (same folder).

- [ ] **Step 3: Write the test**

```jsx
// client/src/backgrounds/__tests__/dotgrid.test.jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DotGrid from '../engines/DotGrid';

afterEach(cleanup);

describe('DotGrid engine', () => {
  it('renders a canvas and accepts color + params without throwing', () => {
    const { container } = render(<DotGrid color="#FE5100" params={{ density: 'high', speed: 'calm' }} />);
    expect(container.querySelector('canvas.dot-grid__canvas')).toBeInTheDocument();
  });
  it('uses safe defaults for unknown params', () => {
    const { container } = render(<DotGrid color="#FE5100" params={{}} />);
    expect(container.querySelector('.dot-grid')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test**

Run: `cd client && npx vitest run src/backgrounds/__tests__/dotgrid.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/backgrounds/engines/DotGrid.jsx client/src/backgrounds/engines/DotGrid.css client/src/backgrounds/__tests__/dotgrid.test.jsx
git commit -m "refactor(backgrounds): move DotGrid into engines, adapt to friendly params"
```

---

### Task 3: Type registry (dotgrid + mesh stub)

**Files:**
- Create: `client/src/backgrounds/registry.js`
- Test: `client/src/backgrounds/__tests__/registry.test.js`

> Note: `mesh` and later engines are registered here as they are built. For Phase 1, register only `dotgrid` (real) so the registry is usable; later tasks append entries.

- [ ] **Step 1: Write the failing test**

```js
// client/src/backgrounds/__tests__/registry.test.js
import { describe, it, expect } from 'vitest';
import { BACKGROUNDS, getBackground, backgroundKeys } from '../registry';

describe('background registry', () => {
  it('every entry has the required shape', () => {
    BACKGROUNDS.forEach((b) => {
      expect(typeof b.key).toBe('string');
      expect(typeof b.label).toBe('string');
      expect(b.Component).toBeTruthy();
      expect(b.defaultParams && typeof b.defaultParams).toBe('object');
      expect(Array.isArray(b.paramSchema)).toBe(true);
      expect(typeof b.thumbnail).toBe('string');
    });
  });
  it('keys are unique', () => {
    const keys = BACKGROUNDS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('getBackground resolves by key and returns undefined for unknown', () => {
    expect(getBackground('dotgrid')?.key).toBe('dotgrid');
    expect(getBackground('nope')).toBeUndefined();
  });
  it('exports the flat key list', () => {
    expect(backgroundKeys).toContain('dotgrid');
  });
});
```

- [ ] **Step 2: Run test** — Run: `cd client && npx vitest run src/backgrounds/__tests__/registry.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement**

```js
// client/src/backgrounds/registry.js
import { lazy } from 'react';

export const BACKGROUNDS = [
  {
    key: 'dotgrid',
    label: 'Dot Grid',
    seasonal: false,
    thumbnail: '/backgrounds/dotgrid.svg',
    Component: lazy(() => import('./engines/DotGrid.jsx')),
    defaultParams: { density: 'medium', speed: 'normal' },
    paramSchema: [
      { key: 'density', label: 'Density', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'speed', label: 'Speed', type: 'select', options: ['calm', 'normal', 'lively'] },
    ],
  },
];

export const backgroundKeys = BACKGROUNDS.map((b) => b.key);
export const getBackground = (key) => BACKGROUNDS.find((b) => b.key === key);
```

- [ ] **Step 4: Run test** — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/backgrounds/registry.js client/src/backgrounds/__tests__/registry.test.js
git commit -m "feat(backgrounds): type registry with dotgrid entry"
```

---

### Task 4: HostBackground shared renderer

**Files:**
- Create: `client/src/backgrounds/HostBackground.jsx`
- Test: `client/src/backgrounds/__tests__/hostBackground.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/backgrounds/__tests__/hostBackground.test.jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import HostBackground from '../HostBackground';

afterEach(cleanup);

describe('HostBackground', () => {
  it('renders the masked band wrapper', () => {
    const { container } = render(<HostBackground typeKey="dotgrid" color="#FE5100" />);
    expect(container.querySelector('[data-bg-band]')).toBeInTheDocument();
  });
  it('renders nothing engine-side for an unknown key', () => {
    const { container } = render(<HostBackground typeKey="nope" color="#FE5100" />);
    expect(container.querySelector('[data-bg-band]')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeNull();
  });
  it('renders a static fallback under reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { container } = render(<HostBackground typeKey="dotgrid" color="#FE5100" />);
    expect(container.querySelector('[data-bg-static]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test** — Run: `cd client && npx vitest run src/backgrounds/__tests__/hostBackground.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement**

```jsx
// client/src/backgrounds/HostBackground.jsx
import { Suspense, useEffect, useState } from 'react';
import { getBackground } from './registry';
import { tint } from './palette';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

// Owns the above-the-fold band (top 70% of fold) + fade-to-transparent mask.
export default function HostBackground({ typeKey, color = '#FE5100', params = {} }) {
  const reduced = usePrefersReducedMotion();
  const entry = getBackground(typeKey);
  const Engine = entry?.Component;

  return (
    <div
      aria-hidden
      data-bg-band
      className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] overflow-hidden"
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
        maskImage: 'linear-gradient(to bottom, #000, transparent)',
      }}
    >
      {(!Engine || reduced) ? (
        <div
          data-bg-static
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${tint(color, 0.12)}, ${tint(color, 0.45)})` }}
        />
      ) : (
        <Suspense fallback={null}>
          <Engine color={color} params={{ ...(entry.defaultParams || {}), ...params }} />
        </Suspense>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test** — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/backgrounds/HostBackground.jsx client/src/backgrounds/__tests__/hostBackground.test.jsx
git commit -m "feat(backgrounds): HostBackground renderer with masked band + reduced-motion fallback"
```

---

### Task 5: Wire ServiceDetail to HostBackground (static default)

**Files:**
- Modify: `client/src/pages/ServiceDetail.jsx` (import at 11; backdrop block where `<DotGrid>` currently sits; `dotColor` const)

- [ ] **Step 1: Replace the import**

In `ServiceDetail.jsx`, replace `import DotGrid from '../components/DotGrid';` with:

```jsx
import HostBackground from '../backgrounds/HostBackground';
```

- [ ] **Step 2: Replace the backdrop block**

Replace the entire `<div aria-hidden ... h-[70vh] ...>` … `</div>` block (the one wrapping `<DotGrid …/>`) with a single line — `HostBackground` now owns the band:

```jsx
      {/* ── Above-the-fold backdrop — host-themed background type ── */}
      <HostBackground typeKey="dotgrid" color={dotColor} />
```

(`dotColor` const stays as-is. Host-pick resolution is added in Task 14.)

- [ ] **Step 3: Run the existing client test suite + build**

Run: `cd client && npx vitest run && npm run build`
Expected: tests PASS, build succeeds (no `components/DotGrid` import remains).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ServiceDetail.jsx
git commit -m "feat(service): render backdrop via HostBackground registry"
```

---

## PHASE 2 — Server + admin curation

### Task 6: Migration v3.52 (schema)

**Files:**
- Create: `server/migrations/v3.52_backgrounds.sql`

- [ ] **Step 1: Write the migration**

```sql
-- server/migrations/v3.52_backgrounds.sql
-- Admin background library: appearance curation + per-host pick.
ALTER TABLE appearance_settings
  ADD COLUMN IF NOT EXISTS backgrounds JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_background TEXT NOT NULL DEFAULT 'dotgrid';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS background_key TEXT;
```

- [ ] **Step 2: Apply to BOTH Supabase DBs**

Run in Supabase SQL Editor for **both** projects (Tokyo staging `xwvciqkayammbvsidqig`, Mumbai prod `ayjhlwyzszykqtnaktpb`). Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='appearance_settings' AND column_name IN ('backgrounds','default_background');
SELECT column_name FROM information_schema.columns
WHERE table_name='profiles' AND column_name='background_key';
```
Expected: 3 rows total.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.52_backgrounds.sql
git commit -m "feat(db): v3.52 background library columns"
```

---

### Task 7: Server key allow-list + parity test

**Files:**
- Create: `server/config/backgroundKeys.js`
- Test: `server/tests/backgroundKeys.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/backgroundKeys.test.js
const { BACKGROUND_KEYS, isBackgroundKey } = require('../config/backgroundKeys');

describe('backgroundKeys', () => {
  it('is a non-empty unique list including dotgrid', () => {
    expect(BACKGROUND_KEYS).toContain('dotgrid');
    expect(new Set(BACKGROUND_KEYS).size).toBe(BACKGROUND_KEYS.length);
  });
  it('validates membership', () => {
    expect(isBackgroundKey('dotgrid')).toBe(true);
    expect(isBackgroundKey('nope')).toBe(false);
    expect(isBackgroundKey(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** — `cd server && npx jest tests/backgroundKeys.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement** (keys MUST mirror client `registry.js` — landmine: update both when adding a type)

```js
// server/config/backgroundKeys.js
// MIRROR of client/src/backgrounds/registry.js keys. Adding a type updates BOTH.
const BACKGROUND_KEYS = ['dotgrid', 'mesh', 'galaxy', 'rain', 'holi', 'diwali', 'celebration'];
const isBackgroundKey = (k) => typeof k === 'string' && BACKGROUND_KEYS.includes(k);
module.exports = { BACKGROUND_KEYS, isBackgroundKey };
```

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/config/backgroundKeys.js server/tests/backgroundKeys.test.js
git commit -m "feat(backgrounds): server background key allow-list"
```

---

### Task 8: appearanceController — validate update + extend getPublic

**Files:**
- Modify: `server/controllers/appearanceController.js` (`update` ~58, `getPublic` ~46)
- Test: `server/tests/appearanceBackgrounds.test.js`

- [ ] **Step 1: Write the failing unit test (pure sanitizer)**

We extract a pure `sanitizeBackgrounds(input, knownParams)` so it is testable without DB.

```js
// server/tests/appearanceBackgrounds.test.js
const { sanitizeBackgrounds, resolveDefaultBackground } = require('../controllers/appearanceController');

describe('sanitizeBackgrounds', () => {
  it('drops unknown keys and coerces shape', () => {
    const out = sanitizeBackgrounds({
      dotgrid: { enabled: true, order: 2, params: { density: 'high' } },
      hacker: { enabled: true },
    });
    expect(out.hacker).toBeUndefined();
    expect(out.dotgrid).toEqual({ enabled: true, order: 2, params: { density: 'high' } });
  });
  it('coerces enabled to boolean and order to number', () => {
    const out = sanitizeBackgrounds({ galaxy: { enabled: 'yes', order: '3', params: 5 } });
    expect(out.galaxy.enabled).toBe(true);
    expect(out.galaxy.order).toBe(3);
    expect(out.galaxy.params).toEqual({});
  });
});

describe('resolveDefaultBackground', () => {
  const bg = { dotgrid: { enabled: false }, galaxy: { enabled: true } };
  it('keeps a valid enabled default', () => {
    expect(resolveDefaultBackground('galaxy', bg)).toBe('galaxy');
  });
  it('falls back to first enabled when default is disabled/unknown', () => {
    expect(resolveDefaultBackground('dotgrid', bg)).toBe('galaxy');
  });
  it('falls back to dotgrid when nothing enabled', () => {
    expect(resolveDefaultBackground('x', {})).toBe('dotgrid');
  });
});
```

- [ ] **Step 2: Run** — `cd server && npx jest tests/appearanceBackgrounds.test.js` — Expected: FAIL.

- [ ] **Step 3: Add the pure helpers + export them, and use them in `update`/`getPublic`**

Add near the top of `appearanceController.js` (after requires):

```js
const { isBackgroundKey, BACKGROUND_KEYS } = require('../config/backgroundKeys');

function sanitizeBackgrounds(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(input)) {
    if (!isBackgroundKey(key)) continue;
    const v = input[key] || {};
    out[key] = {
      enabled: !!v.enabled,
      order: Number.isFinite(+v.order) ? +v.order : 0,
      params: v.params && typeof v.params === 'object' && !Array.isArray(v.params) ? v.params : {},
    };
  }
  return out;
}

function resolveDefaultBackground(requested, backgrounds) {
  if (isBackgroundKey(requested) && backgrounds?.[requested]?.enabled) return requested;
  const firstEnabled = BACKGROUND_KEYS.find((k) => backgrounds?.[k]?.enabled);
  return firstEnabled || 'dotgrid';
}

module.exports.sanitizeBackgrounds = sanitizeBackgrounds;
module.exports.resolveDefaultBackground = resolveDefaultBackground;
```

In the `update` handler, before the upsert, merge sanitized fields:

```js
const backgrounds = sanitizeBackgrounds(req.body.backgrounds);
const default_background = resolveDefaultBackground(req.body.default_background, backgrounds);
// include `backgrounds, default_background` in the upsert payload alongside logo fields
```

In `getPublic`, after loading the row, return enabled-only sorted backgrounds:

```js
const all = row?.backgrounds || {};
const enabled = Object.entries(all)
  .filter(([, v]) => v?.enabled)
  .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
  .map(([key, v]) => ({ key, params: v.params || {} }));
// add to the JSON response: backgrounds: enabled, default_background: row?.default_background || 'dotgrid'
```

> Ensure `module.exports = { ... }` style in this file still exports the existing handlers; if the file uses `exports.getPublic = ...`, keep that and add the two `module.exports.fn` lines as shown.

- [ ] **Step 4: Run** — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/controllers/appearanceController.js server/tests/appearanceBackgrounds.test.js
git commit -m "feat(backgrounds): validate admin backgrounds + expose via public appearance"
```

---

### Task 9: Registry↔server parity test (client)

**Files:**
- Test: `client/src/backgrounds/__tests__/parity.test.js`

> Guards the dual-list landmine. Client test imports the server constant via relative path.

- [ ] **Step 1: Write the test**

```js
// client/src/backgrounds/__tests__/parity.test.js
import { describe, it, expect } from 'vitest';
import { backgroundKeys } from '../registry';
// server constant is CommonJS; vitest can require it
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { BACKGROUND_KEYS } = require('../../../../server/config/backgroundKeys.js');

describe('registry/server key parity', () => {
  it('client registry keys are all in the server allow-list', () => {
    backgroundKeys.forEach((k) => expect(BACKGROUND_KEYS).toContain(k));
  });
});
```

> Note: this asserts client ⊆ server (server may list types not yet built client-side, since `backgroundKeys.js` is seeded with the full launch set in Task 7). When all engines exist (end of Phase 4), tighten to set-equality.

- [ ] **Step 2: Run** — `cd client && npx vitest run src/backgrounds/__tests__/parity.test.js` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/backgrounds/__tests__/parity.test.js
git commit -m "test(backgrounds): registry/server key parity guard"
```

---

### Task 10: Admin Backgrounds section

**Files:**
- Create: `client/src/components/admin/BackgroundCurator.jsx`
- Modify: `client/src/pages/admin/AdminAppearance.jsx`
- Test: `client/src/components/admin/__tests__/backgroundCurator.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/admin/__tests__/backgroundCurator.test.jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import BackgroundCurator from '../BackgroundCurator';

afterEach(cleanup);

describe('BackgroundCurator', () => {
  it('renders a card per registry type and reflects enabled state', () => {
    const value = { backgrounds: { dotgrid: { enabled: true, order: 1, params: {} } }, default_background: 'dotgrid' };
    const { getByLabelText } = render(<BackgroundCurator value={value} onChange={() => {}} />);
    expect(getByLabelText(/enable dot grid/i)).toBeChecked();
  });
  it('emits onChange when a type is toggled', () => {
    const onChange = vi.fn();
    const value = { backgrounds: {}, default_background: 'dotgrid' };
    const { getByLabelText } = render(<BackgroundCurator value={value} onChange={onChange} />);
    fireEvent.click(getByLabelText(/enable dot grid/i));
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** — `cd client && npx vitest run src/components/admin/__tests__/backgroundCurator.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement `BackgroundCurator.jsx`**

Controlled component: takes `{ value: { backgrounds, default_background }, onChange }`. Iterates `BACKGROUNDS`. Each card: thumbnail, label, seasonal chip, enable checkbox, generic param controls from `paramSchema`, default radio (enabled-only), live preview via `HostBackground` in a sample color.

```jsx
// client/src/components/admin/BackgroundCurator.jsx
import { BACKGROUNDS } from '../../backgrounds/registry';
import HostBackground from '../../backgrounds/HostBackground';

const SAMPLE = '#FE5100'; // platform accent — shows motion to admin

export default function BackgroundCurator({ value, onChange }) {
  const backgrounds = value?.backgrounds || {};
  const def = value?.default_background || 'dotgrid';

  const patch = (key, next) =>
    onChange({
      default_background: def,
      backgrounds: { ...backgrounds, [key]: { enabled: false, order: 0, params: {}, ...backgrounds[key], ...next } },
    });

  const setDefault = (key) => onChange({ backgrounds, default_background: key });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BACKGROUNDS.map((b) => {
        const cfg = backgrounds[b.key] || { enabled: false, params: {} };
        const params = { ...b.defaultParams, ...(cfg.params || {}) };
        return (
          <div key={b.key} className="rounded-xl border border-gray-200 p-4">
            <div className="relative h-28 mb-3 overflow-hidden rounded-lg bg-gray-50">
              <HostBackground typeKey={b.key} color={SAMPLE} params={params} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{b.label}</span>
              {b.seasonal && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Seasonal</span>}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Enable ${b.label}`}
                checked={!!cfg.enabled}
                onChange={(e) => patch(b.key, { enabled: e.target.checked })}
              />
              Enabled
            </label>
            {b.paramSchema.map((p) => (
              <label key={p.key} className="mt-2 flex items-center justify-between gap-2 text-sm">
                {p.label}
                <select
                  value={params[p.key]}
                  onChange={(e) => patch(b.key, { params: { ...params, [p.key]: e.target.value } })}
                  className="rounded border-gray-300 text-sm">
                  {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="default-bg"
                checked={def === b.key}
                disabled={!cfg.enabled}
                onChange={() => setDefault(b.key)}
              />
              Default
            </label>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run** — Expected: PASS (2 tests).

- [ ] **Step 5: Integrate into `AdminAppearance.jsx`**

Load existing appearance (it already calls `adminGetAppearance`). Hold `backgrounds`/`default_background` in state, render `<BackgroundCurator value={{backgrounds, default_background}} onChange={(v)=>{ setBackgrounds(v.backgrounds); setDefaultBackground(v.default_background); }} />` under the logo section, and include both fields in the existing `adminUpdateAppearance({...})` save payload. Add a section heading "Backgrounds" matching the page's existing section styling.

- [ ] **Step 6: Run full client suite + build**

Run: `cd client && npx vitest run && npm run build` — Expected: PASS + build OK.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/admin/BackgroundCurator.jsx client/src/components/admin/__tests__/backgroundCurator.test.jsx client/src/pages/admin/AdminAppearance.jsx
git commit -m "feat(admin): backgrounds curation section in appearance"
```

---

## PHASE 3 — Host picker + service-page resolution

### Task 11: Allow `background_key` on host profile update

**Files:**
- Modify: `server/controllers/hostController.js` (`updateProfile` 225–344: destructure 227–238, validation 252–313, update payload)
- Test: `server/tests/hostBackgroundKey.test.js`

- [ ] **Step 1: Write the failing test (pure validator)**

Extract a tiny pure helper `cleanBackgroundKey(v)` and test it.

```js
// server/tests/hostBackgroundKey.test.js
const { cleanBackgroundKey } = require('../controllers/hostController');
describe('cleanBackgroundKey', () => {
  it('keeps known keys', () => { expect(cleanBackgroundKey('galaxy')).toBe('galaxy'); });
  it('nulls unknown/empty', () => {
    expect(cleanBackgroundKey('nope')).toBeNull();
    expect(cleanBackgroundKey('')).toBeNull();
    expect(cleanBackgroundKey(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `cd server && npx jest tests/hostBackgroundKey.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement** — add at top of `hostController.js`:

```js
const { isBackgroundKey } = require('../config/backgroundKeys');
const cleanBackgroundKey = (v) => (isBackgroundKey(v) ? v : null);
module.exports.cleanBackgroundKey = cleanBackgroundKey;
```

In `updateProfile`, add `background_key` to the destructured body and to the update object:

```js
const { /* …existing… */ background_key } = req.body;
// …in the update payload object:
...(background_key !== undefined ? { background_key: cleanBackgroundKey(background_key) } : {}),
```

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/hostController.js server/tests/hostBackgroundKey.test.js
git commit -m "feat(host): accept background_key on profile update"
```

---

### Task 12: Host Background picker in ProfileSetup

**Files:**
- Create: `client/src/components/BackgroundPicker.jsx`
- Modify: `client/src/pages/ProfileSetup.jsx` (Appearance section 458–476; save handler)
- Test: `client/src/components/__tests__/backgroundPicker.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/__tests__/backgroundPicker.test.jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import BackgroundPicker from '../BackgroundPicker';

afterEach(cleanup);
const enabled = [{ key: 'dotgrid', params: {} }, { key: 'galaxy', params: {} }];

describe('BackgroundPicker', () => {
  it('renders a card per enabled type plus a None option', () => {
    const { getByText } = render(<BackgroundPicker color="#FE5100" enabled={enabled} value="galaxy" onChange={() => {}} />);
    expect(getByText('Dot Grid')).toBeInTheDocument();
    expect(getByText('Galaxy')).toBeInTheDocument();
    expect(getByText(/none/i)).toBeInTheDocument();
  });
  it('calls onChange with the chosen key', () => {
    const onChange = vi.fn();
    const { getByText } = render(<BackgroundPicker color="#FE5100" enabled={enabled} value={null} onChange={onChange} />);
    fireEvent.click(getByText('Galaxy'));
    expect(onChange).toHaveBeenCalledWith('galaxy');
  });
});
```

- [ ] **Step 2: Run** — `cd client && npx vitest run src/components/__tests__/backgroundPicker.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement `BackgroundPicker.jsx`**

```jsx
// client/src/components/BackgroundPicker.jsx
import HostBackground from '../backgrounds/HostBackground';
import { getBackground } from '../backgrounds/registry';

export default function BackgroundPicker({ color, enabled = [], value, onChange }) {
  const options = [{ key: null, label: 'None' }, ...enabled.map((e) => ({ ...e, label: getBackground(e.key)?.label || e.key }))];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => {
        const selected = value === o.key || (o.key === null && !value);
        return (
          <button
            type="button"
            key={o.key || 'none'}
            onClick={() => onChange(o.key)}
            className={`relative h-28 rounded-xl overflow-hidden border-2 transition ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-gray-300'}`}>
            {o.key ? (
              <HostBackground typeKey={o.key} color={color} params={o.params} />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-gray-400 text-sm">None</span>
            )}
            <span className="absolute bottom-1 left-2 text-xs font-semibold text-gray-700 bg-white/70 px-1.5 rounded">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run** — Expected: PASS (2 tests).

- [ ] **Step 5: Integrate in `ProfileSetup.jsx` Appearance section**

In the Appearance section (around 458–476, near the theme-color swatches):
- On mount (or with existing appearance load) call `getAppearance()` → store `enabledBackgrounds = res.data.backgrounds`.
- Render `<BackgroundPicker color={themeColor} enabled={enabledBackgrounds} value={backgroundKey} onChange={setBackgroundKey} />`.
- Include `background_key: backgroundKey` in the existing `updateProfile({...})` save payload.
- Seed `backgroundKey` state from the loaded profile's `background_key`.

- [ ] **Step 6: Run client suite + build** — `cd client && npx vitest run && npm run build` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/BackgroundPicker.jsx client/src/components/__tests__/backgroundPicker.test.jsx client/src/pages/ProfileSetup.jsx
git commit -m "feat(host): background picker in profile appearance"
```

---

### Task 13: Embed background data in public service payload

**Files:**
- Modify: `server/controllers/serviceController.js` (`fetchPublicVendor` cols 133–142; response 497–506)

- [ ] **Step 1: Add `background_key` to vendor columns**

In `VENDOR_PUBLIC_COLS` (133–142), append `background_key` to the selected columns.

- [ ] **Step 2: Embed enabled backgrounds + default in the response**

In `getPublicServiceByProfileAndSlug`, load appearance once and attach to the response. Add near where the response object is built (497–506):

```js
const { getPublicAppearanceData } = require('./appearanceController'); // export a helper that returns { backgrounds, default_background }
const appearance = await getPublicAppearanceData(); // {backgrounds:[{key,params}], default_background}
// add to response JSON: appearance
```

Add `getPublicAppearanceData` to `appearanceController.js` (refactor the body of `getPublic` to call it):

```js
async function getPublicAppearanceData() {
  // load appearance_settings row via supabaseAdmin (same as getPublic)
  // return { backgrounds: <enabled sorted [{key,params}]>, default_background }
}
module.exports.getPublicAppearanceData = getPublicAppearanceData;
```

- [ ] **Step 3: Run server tests** — `cd server && npx jest` — Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add server/controllers/serviceController.js server/controllers/appearanceController.js
git commit -m "feat(service): embed host background + appearance in public payload"
```

---

### Task 14: ServiceDetail resolves host pick

**Files:**
- Modify: `client/src/pages/ServiceDetail.jsx`
- Test: `client/src/pages/__tests__/serviceDetailBackground.test.jsx`

- [ ] **Step 1: Write the failing test** (mock `services/api`)

```jsx
// client/src/pages/__tests__/serviceDetailBackground.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { resolveBackgroundKey } from '../ServiceDetail';

describe('resolveBackgroundKey', () => {
  const enabled = [{ key: 'galaxy', params: {} }, { key: 'rain', params: {} }];
  it('uses host pick when enabled', () => {
    expect(resolveBackgroundKey('galaxy', enabled, 'rain').key).toBe('galaxy');
  });
  it('falls back to default when host pick missing/disabled', () => {
    expect(resolveBackgroundKey(null, enabled, 'rain').key).toBe('rain');
    expect(resolveBackgroundKey('holi', enabled, 'rain').key).toBe('rain');
  });
  it('falls back to dotgrid when nothing matches', () => {
    expect(resolveBackgroundKey(null, [], null).key).toBe('dotgrid');
  });
});
```

- [ ] **Step 2: Run** — `cd client && npx vitest run src/pages/__tests__/serviceDetailBackground.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement + export the resolver, use it in render**

Add to `ServiceDetail.jsx` (exported for test):

```jsx
export function resolveBackgroundKey(hostKey, enabled = [], defaultKey) {
  const find = (k) => enabled.find((e) => e.key === k);
  const chosen = find(hostKey) || find(defaultKey) || enabled[0] || { key: 'dotgrid', params: {} };
  return chosen;
}
```

In render, derive from the fetched payload (`data.appearance`, `vendor.background_key`):

```jsx
const bg = resolveBackgroundKey(vendor?.background_key, data?.appearance?.backgrounds, data?.appearance?.default_background);
// …
<HostBackground typeKey={bg.key} color={dotColor} params={bg.params} />
```

- [ ] **Step 4: Run** — Expected: PASS (3 tests).

- [ ] **Step 5: Run full client suite + build** — `cd client && npx vitest run && npm run build` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/ServiceDetail.jsx client/src/pages/__tests__/serviceDetailBackground.test.jsx
git commit -m "feat(service): resolve host-picked background with default fallback"
```

---

## PHASE 4 — Engines (each independent; parallelizable)

### Task 15: Reusable canvas hook

**Files:**
- Create: `client/src/backgrounds/useBackgroundCanvas.js`
- Test: `client/src/backgrounds/__tests__/useBackgroundCanvas.test.jsx`

Provides DPR-correct sizing, ResizeObserver, RAF loop with `draw(ctx, t, dims)`, fade-in opacity ramp, full teardown. Engines supply only `init(dims)` + `draw`.

- [ ] **Step 1: Write the test**

```jsx
// client/src/backgrounds/__tests__/useBackgroundCanvas.test.jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import useBackgroundCanvas from '../useBackgroundCanvas';

function Probe() {
  const ref = useBackgroundCanvas({ draw: () => {} });
  return <div style={{ width: 200, height: 100 }}><canvas ref={ref} /></div>;
}
afterEach(cleanup);

describe('useBackgroundCanvas', () => {
  it('mounts a canvas ref without throwing', () => {
    const { container } = render(<Probe />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** — `cd client && npx vitest run src/backgrounds/__tests__/useBackgroundCanvas.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement**

```js
// client/src/backgrounds/useBackgroundCanvas.js
import { useEffect, useRef } from 'react';

// draw(ctx, t, dims) — t = seconds since mount; dims = {w,h}. init(dims) optional.
export default function useBackgroundCanvas({ init, draw }) {
  const canvasRef = useRef(null);
  const state = useRef({ raf: 0, start: 0, dims: { w: 0, h: 0 } });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let alive = true;

    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.current.dims = { w: width, h: height };
      init && init(state.current.dims);
    };

    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    ro ? ro.observe(parent) : window.addEventListener('resize', resize);
    resize();

    const loop = (ts) => {
      if (!alive) return;
      if (!state.current.start) state.current.start = ts;
      const t = (ts - state.current.start) / 1000;
      const fade = Math.min(1, t / 0.8); // 0.8s ease-in
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = fade;
      draw(ctx, t, state.current.dims);
      ctx.globalAlpha = 1;
      state.current.raf = requestAnimationFrame(loop);
    };
    state.current.raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(state.current.raf);
      ro ? ro.disconnect() : window.removeEventListener('resize', resize);
    };
  }, [init, draw]);

  return canvasRef;
}
```

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/backgrounds/useBackgroundCanvas.js client/src/backgrounds/__tests__/useBackgroundCanvas.test.jsx
git commit -m "feat(backgrounds): reusable DPR canvas/RAF hook for engines"
```

---

### Task 16: Galaxy engine (fully worked reference)

**Files:**
- Create: `client/src/backgrounds/engines/Galaxy.jsx`
- Create: `client/public/backgrounds/galaxy.svg` (thumbnail)
- Modify: `client/src/backgrounds/registry.js` (append entry)
- Test: `client/src/backgrounds/__tests__/galaxy.test.jsx`

- [ ] **Step 1: Engine** — drifting starfield, twinkle, host-tinted.

```jsx
// client/src/backgrounds/engines/Galaxy.jsx
import { useCallback, useMemo } from 'react';
import useBackgroundCanvas from '../useBackgroundCanvas';
import { hexToRgb, tint } from '../palette';

const COUNT = { low: 70, medium: 130, high: 220 };
const SPEED = { calm: 6, normal: 12, lively: 22 };

export default function Galaxy({ color = '#5227FF', params = {} }) {
  const count = COUNT[params.starCount] || COUNT.medium;
  const speed = SPEED[params.speed] || SPEED.calm;
  const rgb = useMemo(() => hexToRgb(tint(color, 0.4)), [color]);

  const starsRef = useMemo(() => ({ list: [], dims: { w: 0, h: 0 } }), []);
  const init = useCallback((dims) => {
    starsRef.dims = dims;
    starsRef.list = Array.from({ length: count }, (_, i) => ({
      x: (Math.sin(i * 12.9898) * 43758.5453) % 1 * dims.w,
      y: (Math.cos(i * 78.233) * 12543.123) % 1 * dims.h,
      r: 0.4 + ((i % 7) / 7) * 1.6,
      ph: (i % 100) / 100 * Math.PI * 2,
    })).map((s) => ({ ...s, x: Math.abs(s.x), y: Math.abs(s.y) }));
  }, [count, starsRef]);

  const draw = useCallback((ctx, t, dims) => {
    for (const s of starsRef.list) {
      const y = (s.y + t * speed) % dims.h;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.ph);
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.25 + tw * 0.6})`;
      ctx.fill();
    }
  }, [rgb, speed, starsRef]);

  const ref = useBackgroundCanvas({ init, draw });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
```

- [ ] **Step 2: Thumbnail** — `client/public/backgrounds/galaxy.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#0c0c16"/><g fill="#fff"><circle cx="20" cy="30" r="1.5"/><circle cx="50" cy="60" r="1"/><circle cx="90" cy="25" r="2"/><circle cx="120" cy="70" r="1.2"/><circle cx="140" cy="40" r="1.6"/><circle cx="70" cy="80" r="1"/></g></svg>
```

- [ ] **Step 3: Register** — append to `BACKGROUNDS` in `registry.js`:

```js
  {
    key: 'galaxy',
    label: 'Galaxy',
    seasonal: false,
    thumbnail: '/backgrounds/galaxy.svg',
    Component: lazy(() => import('./engines/Galaxy.jsx')),
    defaultParams: { starCount: 'medium', speed: 'calm' },
    paramSchema: [
      { key: 'starCount', label: 'Stars', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'speed', label: 'Drift', type: 'select', options: ['calm', 'normal', 'lively'] },
    ],
  },
```

- [ ] **Step 4: Test**

```jsx
// client/src/backgrounds/__tests__/galaxy.test.jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Galaxy from '../engines/Galaxy';
afterEach(cleanup);
it('renders a canvas with color + params', () => {
  const { container } = render(<div style={{ width: 300, height: 200 }}><Galaxy color="#FE5100" params={{ starCount: 'high' }} /></div>);
  expect(container.querySelector('canvas')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run** — `cd client && npx vitest run src/backgrounds/__tests__/galaxy.test.jsx` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/backgrounds/engines/Galaxy.jsx client/public/backgrounds/galaxy.svg client/src/backgrounds/registry.js client/src/backgrounds/__tests__/galaxy.test.jsx
git commit -m "feat(backgrounds): galaxy engine"
```

---

### Tasks 17–21: Remaining engines (same contract as Galaxy)

For each engine below, repeat Task 16's 6 steps exactly, substituting the engine name, draw algorithm, registry entry, thumbnail, and test. **All share the identical contract:** default export `({ color, params })`, uses `useBackgroundCanvas({ init, draw })`, returns `<canvas className="absolute inset-0 h-full w-full" />`, derives colors from `color` via `palette.js`, caps counts by friendly tiers, restrained/slow defaults (premium bar).

| Task | key / label | params (schema) | draw algorithm (premium, on-brand) |
|---|---|---|---|
| 17 | `rain` / Rain | `density`(low/med/high → 60/120/220 drops), `speed`(calm/normal/lively) | Vertical streaks at slight angle (~12°). Each drop: x, y, len 8–18, speed. Stroke `rgba(tint(color,0.5), 0.35)`, lineWidth 1–1.6. Wrap y past height. Subtle, glassy. |
| 18 | `holi` / Holi (seasonal) | `intensity`(soft/med/vivid), `speed` | Rising soft color puffs. Spawn N particles with radius 6–22, palette = `festivePalette(color, 5)`, alpha 0.08–0.22, drift upward + lateral sine, fade as they rise. Radial-gradient fills for soft edges. Elegant, not loud. |
| 19 | `diwali` / Diwali (seasonal) | `glow`(soft/med/bright), `rate`(calm/normal/lively) | Row of warm diya glows along the bottom (radial gradients, `tint(color,0.3)`→transparent, gentle flicker via sine). Occasional firework: expanding ring of sparks in `festivePalette(color,4)`, ease-out fade. Timed by `rate`. |
| 20 | `celebration` / Celebration (seasonal) | `density`, `rate` | Confetti: rectangles in `festivePalette(color,5)`, random rotation, fall with gravity + flutter (sin sway), recycle at top. Periodic burst increases spawn. Crisp, joyful, capped count. |
| 21 | `mesh` / Mesh Gradient | `speed`(calm/normal/lively), `blur`(soft/med/strong) | Animated multi-stop radial/linear gradient blobs drifting (no per-pixel cost): 3–4 large radial gradients in `tint`/`rotateHue` variants of color, positions animated by slow sine, heavy blur via layered alpha. Adapt from changelog mesh-gradient backdrop (commit `aad8e43`) if reusable; else canvas gradients. CSS-driven acceptable (no `useBackgroundCanvas`) — if CSS, still default-export `({color,params})` and render an absolutely-positioned animated div. |

After Task 21, **tighten the parity test** (Task 9) to assert set-equality between `backgroundKeys` (client) and `BACKGROUND_KEYS` (server):

```js
it('client and server key sets are equal', () => {
  expect([...backgroundKeys].sort()).toEqual([...BACKGROUND_KEYS].sort());
});
```

Commit each engine separately (`feat(backgrounds): <key> engine`). Update the parity test in its own commit (`test(backgrounds): enforce key set-equality`).

---

### Task 22: Premium polish + design-review checkpoint

**Files:** all engines + admin/host UI.

- [ ] **Step 1:** For each engine, verify against the spec's Premium Quality Bar: 60fps (DevTools perf), DPR-sharp on retina, ease-based motion, slow restrained defaults, 0.8s fade-in present, listeners + RAF torn down on unmount (no leak across route changes), reduced-motion path shows the tasteful static gradient (not blank).
- [ ] **Step 2:** Admin Backgrounds section + host picker match existing admin/dashboard polish (spacing, cards, toggles, hover/selected states); thumbnails crisp.
- [ ] **Step 3:** Run the design-review skill if available, or self-review each engine in a real foreground browser (RAF runs only when tab is visible — see PR #215). Capture one screenshot per type.
- [ ] **Step 4:** Fix any jank/aliasing/banding found. Commit fixes (`polish(backgrounds): <what>`).

---

## Verification (whole feature)

- [ ] `cd client && npx vitest run` — all green.
- [ ] `cd server && npx jest` — all green.
- [ ] `cd client && npm run build` — succeeds.
- [ ] Migration v3.52 applied to BOTH DBs (verified via the SELECTs in Task 6).
- [ ] Manual: in a foreground browser, admin enables 3 types + sets default; a host picks one; their service page renders it in their brand color; reduced-motion shows static gradient; an invalid `background_key` falls back to default.

## Open Landmines (carry into PRs)

- **Dual key list**: `client/src/backgrounds/registry.js` ↔ `server/config/backgroundKeys.js` — adding/removing a type touches both; parity test guards it.
- Apply v3.52 to **both** Supabase DBs (Tokyo staging, Mumbai prod).
- `/admin/*` and gated host pages aren't preview-verifiable when SIGNED_OUT wipes the injected user → rely on vitest render tests.
- Backgrounded tab pauses RAF (engines must tolerate; not a bug).
- jest-dom custom matchers are NOT loaded in client vitest — use `.getAttribute()/.textContent`/`toBeInTheDocument`.
