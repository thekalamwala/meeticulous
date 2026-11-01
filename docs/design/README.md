# Meeticulous Design System

_A comprehensive UI/UX audit + design strategy + token/component system + implementation roadmap, informed by Kit, Salesforce, Semrush, and beehiiv. Created 2026-10-29 on branch `feat/design-system-foundation`._

## Confirmed facts this is built on
- **Live brand = blue `#0079C1`** (post "Meeticulous" → "Meeticulous" rebrand). Orange `#FE5100` is dead in code (0 occurrences); only old docs were stale. "Refine the existing blue system" — not a reinvention.
- Stack: React 18 + Vite + Tailwind + CSS custom properties. Fonts (self-hosted): Plus Jakarta Sans (display) + Poppins (body).
- Design language: **soft modern SaaS** — soft shadows, 4–6px radii, token-driven.

## The documents
| # | File | What it is |
|---|---|---|
| 1 | [`00-reference-research.md`](00-reference-research.md) | Verified analysis of Kit/Salesforce/Semrush/beehiiv + comparison + adopt/reject synthesis |
| 2 | [`01-ux-audit.md`](01-ux-audit.md) | Prioritized current-state audit across all 4 surfaces + shared layer (P0–P3 register) |
| 3 | [`02-design-strategy.md`](02-design-strategy.md) | Philosophy, 8 principles, brand personality, consistency rules |
| 4 | [`03-design-tokens.md`](03-design-tokens.md) | Complete semantic token spec — color/type/spacing/radii/elevation/z/motion + a11y |
| 5 | [`04-components.md`](04-components.md) | Shared-component standards (variants/states/a11y) + which implementation to standardize on |
| 6 | [`05-page-redesign-matrix.md`](05-page-redesign-matrix.md) | Page-by-page plan (current→proposed, reuse/create, priority) |
| 7+8 | [`06-roadmap.md`](06-roadmap.md) | Technical approach + phased rollout A–E with risks + acceptance criteria |
| 10 | `07-validation-report.md` | Written during implementation (tests/build/visual checks per phase) |

## Core direction (one screen)
- **Keep:** blue `#0079C1`, Jakarta+Poppins, 4–6px radii, the `dashboard/ui`/`admin/ui` libraries, per-host theming, SEO/JSON-LD discipline.
- **Add:** one reserved **action green `#059669`** for the single primary CTA (so it pops off blue); missing semantic/neutral/elevation/z/focus tokens; tighter heading tracking.
- **Kill:** dead-orange rebrand lag (hovers/gradients/chevron/focus rings), brutalist hard shadows, the 4-parallel-systems fragmentation, ~1,800 inline hex.
- **Fix (latent bugs):** undefined `--radius-control` (square inputs) + `--shadow-soft` (missing card shadow); `fb-*` unlayered cascade trap.

## Health by surface
Admin **A−** · Dashboard **A−** · Guest funnel **B+** · Marketing flagship **A−** · Marketing bespoke **C+** · Onboarding **C+** · Shared token layer **C** (the root cause).

## Status
- ✅ Research, audit, strategy, tokens, components, page matrix, roadmap — written.
- ⏳ **Phase A (foundation PR)** — token foundation + de-orange shared code + 2 bugfixes. In progress on this branch.
- 📋 Phases B–E — sequenced in `06-roadmap.md`.

## Founder decisions pending (see `01` §5 / `06`)
1. Fabricated social proof on ServiceDetail payment page — remove or wire to real data? (trust/legal)
2. Dead-brand cleanup (old-brand handles, old-brand "Pro" copy, old-brand wordmarks) — here or separate ticket?
3. Bespoke marketing (~36 pages) — keep + add primitives (recommended) or consolidate harder?
