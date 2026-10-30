# Design Token Specification — Meeticulous

_Deliverable 4. The complete semantic token system: colors, typography, spacing, radii, borders, elevation, z-index, motion, breakpoints — with hex values, usage rules, and accessibility notes. Target single source of truth. Built on the shared-system audit (verified against the live files)._

---

## 0. Architecture — one source of truth

**Rule:** design tokens are defined once as CSS custom properties on `:root` in `client/src/styles/design-tokens.css`. `tailwind.config.js` **references** those vars (`primary: 'var(--primary)'`), so a value changes in exactly one place. Components consume Tailwind classes (`bg-primary`, `text-ink`) or the vars directly — never raw hex.

**Why this matters (current debt):** today Tailwind config and `design-tokens.css` each hardcode the same colors in parallel and have already drifted — `primary-dark`, `secondary` (amber vs purple), and `muted` (two greys) disagree. ~1,800 hardcoded hex across ~205 files bypass tokens entirely. Two referenced vars (`--radius-control`, `--shadow-soft`) are undefined and silently break input radius + card shadow.

**Exception:** host `theme_color` (a per-host hex from a plan-gated palette) is dynamic by design — the public profile + booking flow derive from it via `themeUtils.js`. That is the *only* sanctioned runtime color outside tokens.

---

## 1. Color — brand

| CSS var | Tailwind | Value | Use for | Do NOT use for |
|---|---|---|---|---|
| `--primary` | `primary` | `#0079C1` | Brand accents, active states, links on light, large text (≥24px/bold), icons | White-text buttons (fails AA, 3.26:1) |
| `--primary-dark` | `primary-dark` | `#005E99` | Hover/pressed of primary fills | — |
| `--primary-cta` | `primary-cta` | `#00457C` | **White-text buttons & body links** (AA-safe, ~5.3:1), accent headline words | Large decorative fills (too dark/heavy) |
| `--primary-light` | `primary-light` | `#D6ECF8` | Subtle tints, selected row bg, info chips, focus halo | Text (too light) |
| `--action` | `action` | `#059669` | **The single primary conversion CTA** (Book / Start / Pay) so it pops off blue surfaces | Anything that isn't the main action; status |
| `--action-dark` | `action-dark` | `#047857` | Hover/pressed of action | — |

> **The action-green rule** (from Salesforce's green-vs-blue): a blue-dominant UI needs ONE reserved contrasting action color so the most important CTA never dissolves into blue chrome. Reserve `#059669` for that and nothing else. This value already exists as `--c-emerald`.

## 2. Color — neutrals (surfaces + text)

| CSS var | Tailwind | Value | Use for |
|---|---|---|---|
| `--canvas` | `canvas` | `#F8FAFC` | Page background (the one true page bg — replaces the stray `#fdfcf9` body bg in index.css) |
| `--sand` | `sand` | `#F1F5F9` | Muted section bands, table headers, subtle fills |
| `--surface` | `surface` | `#FFFFFF` | Cards, panels, modals, inputs |
| `--text-strong` | `ink` | `#191919` | Primary text, headings |
| `--text` | `text` | `#334155` | Secondary/body text on white |
| `--text-muted` | `muted` | `#64748B` | Meta, captions, placeholder, disabled-label (consolidates the two conflicting greys to one slate) |
| `--text-disabled` | `text-disabled` | `#94A3B8` | Disabled text/icons |
| `--border` | `border` | `#E2E8F0` | Hairline borders, dividers (replaces the brutalist `#191919` border) |
| `--border-strong` | `border-strong` | `#CBD5E1` | Emphasised borders, input hover |

> Retire the old `--border: #191919` (3px ink brutalist borders), `--secondary: #D8B4FE` (purple leftover), `--accent: #FFB703` (amber leftover), `--color-muted: #64748b` duplicate.

## 3. Color — semantic (status only)

Each status has a **foreground** (text/icon/solid) and a **subtle bg** (alert/badge background). All foregrounds verified ≥4.5:1 on white or on their own subtle bg.

| Concept | `--…-fg` | `--…-bg` | Use for |
|---|---|---|---|
| Success | `#15803D` | `#DCFCE7` | Paid, confirmed, active, approved |
| Warning | `#B45309` | `#FEF3C7` | Pending, grace period, needs attention |
| Error / danger | `#DC2626` | `#FEE2E2` | Failed, cancelled, rejected, destructive |
| Info | `#0369A1` | `#E0F2FE` | Neutral notices, tips (brand-adjacent blue) |

> Only `--success #4CAF50` / `--danger #EF4444` exist today (CSS-var only, no Tailwind side, no warning/info). Every banner/badge currently reinvents status hex (ConsentBanner Material colors, BotWidget rating ramp). Replace with these.

## 4. Color — accents (categorization & charts ONLY)

`--c-blue #0079C1` · `--c-violet #1DA1F2` · `--c-cyan #36D8FF` · `--c-emerald #059669` · `--c-amber #F59E0B` · `--c-pink #DB2777`

- **Use for:** distinguishing categories/professions (chips), chart/graph series, multi-item legends.
- **Do NOT use for:** status (use semantic), primary actions (use `--action`), or decoration.
- **Chart series order:** blue → emerald → violet → amber → pink → cyan (max contrast between adjacent). Keep hex literal (not `var()`) so Tailwind `/opacity` works. Currently near-dead (22 uses) — adopt in charts/category chips or delete; do not leave half-used.
- **Focus ring:** `--focus-ring: #0079C1` rendered as `0 0 0 3px rgba(0,121,193,.4)` with 2px offset. Replaces the global **orange** `rgba(254,81,0,…)` focus/selection rings (a brand bug).

## 5. Component → color application

| Component | Rule |
|---|---|
| **Primary button** | `--action` fill (#059669) + white text, for the ONE main conversion action per view. OR `ink`/`primary-cta` fill + white for primary-but-not-conversion. Never `#0079C1` fill + white (fails AA). No shadow. |
| **Secondary button** | `surface` bg + `--border` 1px + `text-strong`; hover `sand`. |
| **Ghost/tertiary** | transparent + `primary-cta` text; hover `primary-light`. |
| **Danger button** | `--error-fg` fill + white (confirm destructive). |
| **Links** | `primary-cta` on light; underline on hover. |
| **Cards** | `surface` bg, `--border` 1px, `shadow-1`, radius 6px; hover `shadow-2` + `-translate-y-0.5`. |
| **Nav** | `surface`/white bg, `text-strong`; active item `primary`; focus ring token. |
| **Forms** | `surface` bg, `--border`, radius 4px; focus = `primary` border + focus-ring; error = `--error-fg` border + `--error-bg` hint. |
| **Tables** | `surface` body, `sand` header, `--border` row dividers; row hover `sand`/60%. |
| **Badges/pills** | semantic `*-bg` + `*-fg`, `rounded-full`; category badges use `c-*` tint. |
| **Charts** | `c-*` series order above; axes/grid `--border`; labels `text-muted`. |
| **Alerts / notifications** | semantic `*-bg` panel + `*-fg` icon/title; `--border` or tinted border. |

---

## 6. Typography

**Families** (self-hosted, keep):
- `--font-heading: 'Plus Jakarta Sans'` → h1–h3, display, stat numbers, prices, wordmark.
- `--font-sans: 'Poppins'` → body, UI, buttons, inputs, tables, captions.
- Metric-matched fallbacks already configured (`*-Fallback`) — keep for CLS.

**Type scale** (responsive; tight tracking on large sizes — the Semrush lesson):

| Role | Size | Line-height | Weight | Tracking | Font |
|---|---|---|---|---|---|
| Display | `clamp(2.5rem, 5vw, 3.75rem)` | 1.05 | 800 | −0.02em | heading |
| H1 | `clamp(2rem, 4vw, 3rem)` | 1.1 | 800 | −0.02em | heading |
| H2 | `clamp(1.75rem, 3vw, 2.25rem)` | 1.15 | 800 | −0.015em | heading |
| H3 | `1.5rem` | 1.25 | 700 | −0.01em | heading |
| H4 | `1.25rem` | 1.3 | 700 | normal | heading |
| Body-lg | `1.125rem` | 1.6 | 400 | normal | sans |
| Body | `1rem` | 1.6 | 400 | normal | sans |
| Body-sm | `0.875rem` | 1.5 | 400 | normal | sans |
| Caption | `0.75rem` | 1.4 | 500 | normal | sans |
| Overline | `0.75rem` | 1.4 | 600 | +0.08em UPPERCASE | sans |
| Button | `0.875rem` | 1 | 600 | normal | sans |

**Weights:** Jakarta variable 400–800; Poppins 400/500/600/700. Headings 700–800; body 400; UI labels 500–600.

**Note on data density:** Poppins is comparatively wide. For dense dashboard/admin tables where it crowds, prefer `font-sans` at `0.8125rem`/tight leading before considering any new font — do **not** add a third webfont lightly (perf). Admin already runs its own calm scale (`adm-t1/2/3`).

---

## 7. Spacing, layout, radii

**Spacing scale (canonical = Tailwind 4px base):** 0,1(4),2(8),3(12),4(16),5(20),6(24),8(32),10(40),12(48),16(64),20(80),24(96). The legacy `--space-1..5` CSS vars are used only inside the fb-* layer → delete after fb migration (app spacing is 100% Tailwind).

**Section rhythm:** `px-5 py-20 sm:px-8 lg:py-28` (marketing); `p-5 sm:p-7` (cards); gutters `px-5 → sm:px-8`.

**Container widths:** `max-w-6xl` (1152px) standard page; `max-w-3xl` prose/forms; `max-w-7xl` wide marketing; dashboard content `max-w-6xl`.

**Radii** (keep; override already in Tailwind config):

| Token | Value | Use |
|---|---|---|
| `--radius-control` | `4px` | **(define — currently undefined/broken)** inputs, buttons, small controls |
| `--radius-sm/md` · `rounded-sm/md/lg` | 4px | buttons, inputs, small cards |
| `--radius-card` · `rounded-xl/2xl` | 6px | cards, panels, modals |
| (allowed exception) | 10px | the one documented large-card case |
| `--radius-full` · `rounded-full` | 9999px | pills, chips, avatars |

> Nothing ≥8px except the 10px exception. `docs/design-system.md`'s radius table (12/16/24px) is stale by 3–4× — rewrite it.

**Borders:** 1px, low-alpha — `--border #E2E8F0`, or `border-black/5`, `border-white/10` (dark). Never 3px ink borders (brutalist).

## 8. Elevation (soft shadow scale — replaces hard offset shadows)

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(16,24,40,.06)` | subtle lift (inputs, chips) |
| `--shadow-1` | `0 8px 30px rgba(23,32,51,.05)` | **card rest** (this is the missing `--shadow-soft`) |
| `--shadow-2` | `0 24px 60px -28px rgba(16,24,40,.18)` | card hover / raised |
| `--shadow-3` | `0 24px 48px -12px rgba(16,24,40,.22)` | modal, popover, mega-menu |

> **Delete** `--shadow-hard-1/2` (`6px/8px 0` offset) and `--shadow-inset-press`. These still render via the unlayered `fb-*` CSS — removal must follow the fb cascade fix (see roadmap).

## 9. Z-index scale (named layers — replaces ad-hoc z-50/z-[9999])

`--z-base:0` · `--z-dropdown:1000` · `--z-sticky:1020` (nav) · `--z-overlay:1030` · `--z-modal:1040` · `--z-popover:1050` · `--z-toast:1060`. Map existing `z-50`(nav)/`z-[49]`(mega-menu)/`z-[9999]`(consent) onto these to stop collisions.

## 10. Motion

`--motion-fast:120ms` · `--motion-base:180ms` · `--motion-slow:240ms`; easing `--ease-out: cubic-bezier(.2,.8,.2,1)`. Hover/enter only; honour `prefers-reduced-motion: reduce` (already respected in index/opening/error CSS — extend to all new motion).

## 11. Breakpoints (Tailwind defaults — keep)

`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`. Mobile-first. Key behaviors: sidebar → drawer < lg; data tables → stacked cards < md; booking flow 2-col ≥ lg.

## 12. Dark mode

Not a full app dark theme now (YAGNI — the product is light-first and the audience expects it). But structure tokens so it's possible later **without inversion**:
- Admin already ships a real scoped dark theme (`.admin-shell` `--adm-*`, light/dark aware) — keep and standardize ON it for admin.
- Marketing may use **section-scoped dark heroes** (dark bg + light text within a section), not an app toggle.
- Define semantic vars so a future `:root[data-theme="dark"]` can redefine `--canvas/--surface/--text*/--border` + raise elevation — don't hardcode light values into components; use the tokens.

---

## 13. Accessibility (verified contrast pairs)

| Pair | Ratio | Verdict |
|---|---|---|
| `ink #191919` on `canvas #F8FAFC` | ~15:1 | AAA |
| `text #334155` on white | ~9:1 | AAA |
| `muted #64748B` on white | ~4.7:1 | AA (body), use ≥14px |
| white on `primary #0079C1` | 3.26:1 | **FAIL** — never white text here |
| white on `primary-cta #00457C` | ~5.3:1 | AA |
| white on `action #059669` | ~3.3:1 | AA large/▲ — use ≥16px bold or `action-dark` for small |
| white on `error #DC2626` | ~4.8:1 | AA |

Rules encoded: white text only on `primary-cta`/`action-dark`/`error` (not on `primary`/`action` small). Focus ring 3px, 2px offset, `--focus-ring` blue — on every interactive element.

→ Feeds `04-components.md` (which consumes these tokens) and Phase A (define §1–§11 vars, de-orange §4 ring, point Tailwind at vars).
