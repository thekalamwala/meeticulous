# Design System — Meeticulous

## Design Language
"Friendly Brutalism" — clean white surfaces with bold typography, hard offset shadows, and warm brand orange. Tailwind utility-first with a custom CSS-variable token layer.

---

## Color Tokens (CSS Custom Properties)

### Core Brand
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#FE5100` | Brand orange — primary CTAs, active states, links |
| `--bg` | `#FFF8EE` | Warm off-white page background |
| `--surface` | `#FFFFFF` | Card/panel backgrounds |
| `--text` | `#1E1E1E` | Primary text |
| `--secondary` | `#D8B4FE` | Purple accent |
| `--accent` | `#FFB703` | Amber accent |
| `--success` | `#4CAF50` | Success states |
| `--danger` | `#EF4444` | Error/delete states |
| `--border` | `#1E1E1E` | Hard borders (brutalism) |

### Tailwind Extensions
```js
colors: {
  primary: "#FE5100",
  "primary-dark": "#d94400",
  secondary: "#f59e0b",
  surface: "#ffffff",
  muted: "#6b7280",
}
```

### Legacy Mapping Tokens
| Token | Maps To |
|---|---|
| `--color-ink` | `--text` (#1E1E1E) |
| `--color-muted` | #64748b |
| `--color-soft` | `--bg` |
| `--color-surface` | `--surface` |
| `--color-line` | #e5e7eb |
| `--color-primary` | `--primary` |
| `--color-primary-dark` | `--primary` |

---

## Typography
| Font | Role |
|---|---|
| **Plus Jakarta Sans** (500-800) | Headings (h1–h6) |
| **Poppins** (400-700) | Body, buttons, inputs |

### Font Scale
| Element | Size | Weight |
|---|---|---|
| h1 | `clamp(2.1rem, 5vw, 3.7rem)` | 800 |
| h2 | `clamp(1.45rem, 3vw, 2.35rem)` | 700 |
| h3 | 1.25rem | 700 |
| body | 1rem | 400 |
| small | 0.875rem | 400 |

---

## Spacing Tokens
| Token | Value |
|---|---|
| `--space-1` | 8px |
| `--space-2` | 16px |
| `--space-3` | 24px |
| `--space-4` | 32px |
| `--space-5` | 48px |

---

## Border Radius
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 12px | Inputs, small cards |
| `--radius-md` | 16px | Medium cards |
| `--radius-lg` | 24px | Large modals, feature cards |

---

## Shadows
| Token | Value | Usage |
|---|---|---|
| `--shadow-hard-1` | `6px 6px 0 rgba(30,30,30,0.9)` | Brutalism card effect |
| `--shadow-hard-2` | `8px 8px 0 rgba(30,30,30,0.9)` | Larger brutalism effect |
| `--shadow-inset-press` | `inset 0 3px 0 rgba(0,0,0,0.12)` | Pressed button state |

---

## Motion
| Token | Value |
|---|---|
| `--motion-fast` | 120ms |
| `--motion-base` | 180ms |

---

## Shared CSS Classes (`styles/components/`)

### Buttons (button.css)
```html
<button class="fb-btn fb-btn--primary">Save</button>
<button class="fb-btn fb-btn--secondary">Cancel</button>
<button class="fb-btn fb-btn--danger">Delete</button>
```

### Cards (card.css)
```html
<div class="fb-card">...</div>
<div class="fb-card fb-card--compact">...</div>
```

### Inputs (input.css)
```html
<input class="fb-input" />
<textarea class="fb-input resize-none" />
<select class="fb-input" />
```

### Badges (badge.css)
```html
<span class="badge badge--success">Active</span>
<span class="badge badge--muted">Disabled</span>
```

---

## Plan-Gated Colors (Host Theme)
Hosts choose a theme color from a plan-gated palette. Used throughout public profile + booking flow.

| Plan | Available Colors |
|---|---|
| Explorer | Milk White (#F8F7F2), Grey (#6B7280), Brand Orange (#FE5100) |
| Creator | Full 16-color palette (blues, purples, greens, etc.) |
| Professional | Full palette + custom hex input |

**Default:** `#FE5100` (brand orange)

### Theme Application Pattern
```js
import { DEFAULT_THEME_COLOR, getContrastColor, getPlanBorderColor, isValidHex } from '../utils/themeUtils';
const tc = isValidHex(host?.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
const textOnTheme = getContrastColor(tc); // '#ffffff' or '#111827'
// Usage:
<button style={{ background: tc, color: textOnTheme }}>CTA</button>
```

### Plan Border Colors
| Plan | Color | Label |
|---|---|---|
| explorer | #6B7280 (grey) | Explorer |
| creator | #FE5100 (orange) | Creator |
| professional | #D4AF37 (gold) | Pro |

---

## Layout

### App Container
```html
<div class="app-container">...</div>
```
Defined in `base-fb.css` — max-width container with horizontal padding.

### Booking Flow Layout
Two-column on `lg+`:
- **Left (fixed 300px):** sticky profile card
- **Right (flex-1):** booking engine steps

```html
<div class="flex flex-col lg:flex-row gap-6 lg:items-start">
  <div class="lg:w-[300px] flex-shrink-0">
    <!-- Profile card: lg:sticky lg:top-24 -->
  </div>
  <div class="flex-1 min-w-0">
    <!-- Booking steps -->
  </div>
</div>
```

### Step Card Pattern
All booking step cards must use the same container:
```html
<!-- Full-width card (same for ALL steps: time, details, otp, payment, confirmed) -->
<div class="bg-white border rounded-2xl p-5 sm:p-7">
  <!-- Center inner content with: -->
  <div class="max-w-md mx-auto text-center">
    <!-- icon, heading, action elements -->
  </div>
</div>
```

### Dashboard Layout
Sidebar (DashboardLayout.jsx) + `<main>` content area.
Dashboard pages use `w-full max-w-6xl` for content containers.

---

## Responsive Rules
| Breakpoint | Behavior |
|---|---|
| Default (mobile) | Single column, stacked layout |
| `sm:` (640px+) | 2-col form grids, wider padding |
| `md:` (768px+) | Show additional table columns |
| `lg:` (1024px+) | Side-by-side booking layout, sticky profile card |

---

## Page Background
```css
body {
  background:
    radial-gradient(circle at top left, rgba(232,239,229,0.55), transparent 28rem),
    linear-gradient(180deg, #fdfcf9 0%, #f8fafc 44%, #f7f5ef 100%);
}
```
Booking flow overrides with: `style={{ background: '#f7f5ef' }}`
