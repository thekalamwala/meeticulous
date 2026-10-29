# Design System v4 — Foundation (Tokens + Components)

Date: 2026-07-01
Phase: 1 of 5 (Foundation). Public/booking, host dashboard, guest dashboard, admin are separate follow-on specs.

## Objective

Replace "Friendly Brutalism" (hard offset shadows + thick borders on every surface) with a modern SaaS aesthetic: **75% editorial minimalism / 20% soft glassmorphism / 5% neobrutalism accents**, inspired by Stripe/Linear/Notion/LinkedIn/Ramp/Arc. This spec covers only the shared token layer and shared component CSS — no page-level layout changes.

## Decisions (confirmed via visual brainstorming)

- **Base neutrals:** warm off-white `#FAFAF8` background, pure white `#FFFFFF` surfaces (kept from current, not shifting cooler/gray).
- **Brand accent:** unchanged, `#FE5100` (primary), used intentionally, not decoratively.
- **Radius — hard rule:** small components (buttons, inputs, badges, pills, chips) = **4px**. Larger components (cards, modals, drawers) = **8px**. No pill/999px shapes anywhere. This overrides the brief's own radius suggestion (20–24px cards, pill buttons) per explicit user call.
- **Glassmorphism (20%):** applied to floating/summary UI only — dashboard summary cards, floating action panels, dropdowns, modals-on-open. NOT applied to standard content cards, tables, or forms. Recipe: `background: linear-gradient(135deg, rgba(255,255,255,.55), rgba(255,255,255,.25))`, `backdrop-filter: blur(14px)`, `border: 1px solid rgba(255,255,255,.6)`, shadow `0 4px 24px rgba(0,0,0,.04)` — near-invisible.
- **Neobrutalism (5%):** reserved for CTA buttons, selected/active card state, and notification/plan badges only. Recipe: `2px solid var(--text)` border + `4px 4px 0 var(--text)` offset shadow, no hover-lift exaggeration.
- **Typography:** unchanged — Plus Jakarta Sans (headings) + Poppins (body). Already geometric-sans, satisfies brief.
- **Icons:** unchanged — `lucide-react` already in use. Satisfies "rounded, simple, consistent stroke" rule.
- **Shadows:** near-invisible by default (`0 1px 2px rgba(0,0,0,.04)` style elevation), spacing carries hierarchy instead of shadow depth — except the two exceptions above (glass card ambient shadow, neobrutal offset shadow).
- **Motion:** keep existing `--motion-fast`/`--motion-base` tokens (120ms/180ms). Add `--motion-slow: 280ms` for modal/drawer enter. Fade + slight scale/lift only, no bounce/spin.

## Files touched

| File | Change |
|---|---|
| `client/src/styles/design-tokens.css` | Add `--radius-card: 8px`, `--radius-modal: 8px` (keep `--radius-sm/md`=4px). Add glass tokens (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`). Add neobrutal tokens (`--nb-border`, `--nb-shadow`). Add `--motion-slow`. |
| `client/src/styles/components/button.css` | Default `.fb-btn` loses hard-shadow (`box-shadow: var(--shadow-hard-2)` → flat `0 1px 2px rgba(0,0,0,.06)`, no translateY lift). New `.fb-btn--cta` variant carries the 5% neobrutal treatment (offset shadow) for primary marketing/high-emphasis CTAs only. |
| `client/src/styles/components/card.css` | Default `.fb-card` loses 3px border + hard shadow → `1px solid var(--color-line)` + near-invisible shadow, radius 8px. New `.fb-card--glass` variant (glass recipe). New `.fb-card--selected` variant (neobrutal recipe, for "currently selected plan/option" cards). |
| `client/src/styles/components/input.css` | Radius → 4px (verify currently matches; keep border style, drop any hard-shadow remnants). |
| `client/src/styles/components/badge.css` | Radius → 4px. Add `.badge--neobrutal` variant (solid border + tiny offset shadow) for plan/notification badges only — default badges stay flat/soft. |
| `client/src/styles/components/modal.css` | Radius → 8px. Apply glass recipe to modal backdrop panel (`.modal-panel` or equivalent) since modals are explicitly called out as a glass surface in the brief. |
| `docs/design-system.md` | Rewrite to match v4 (this doc supersedes the current "Friendly Brutalism" description — token values in the doc are already stale vs. `design-tokens.css`, so this also fixes that drift). |

## Non-goals (deferred to later phases)

- No changes to page layouts (Home, booking flow steps, dashboard sidebar structure, admin shell).
- No new components beyond variants listed above (Hero/Feature/KPI/Timeline/etc. cards from the brief's full component list are designed per-page in later phases, built on these primitives).
- No illustration/stock-art work.

## Testing

- `cd client && npm run build` — must pass (no CSS syntax errors, no broken class refs).
- Visual spot-check via dev server on: a page using `.fb-btn`, `.fb-card`, `.badge`, and any existing modal — confirm no regressions (existing pages keep functioning, just look flatter/different radius) before moving to later phases.

## Open follow-ups (separate specs, not part of this phase)

1. Public + booking flow redesign
2. Host dashboard redesign
3. Guest dashboard redesign
4. Admin panel redesign
