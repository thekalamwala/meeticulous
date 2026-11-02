# Website migration audit

Status of `WEBSITE_MIGRATION.md` against `client/` (332 page files, 589 `.jsx`).
Counts are from `client/src` on 2026-11-02, after the first migration PR.

## Done (first PR)

| Phase | What changed |
|---|---|
| 0 Install | Kit at `design-system/`. Tokens + component classes wired as `client/src/styles/brand.css` (loaded after `design-tokens.css`, so the kit wins). Assets copied to `client/public/brand/ds/`. Favicon set replaced from `assets/06-favicon` (96/192 PNGs resized from the 512). Instrument Serif italic self-hosted in `public/fonts` (OFL). Tailwind theme mapped to kit colours, `font-serif` and the kit radius scale. |
| 2 Foundations | Legacy tokens repointed: `canvas` → cream, `sand` → blush, `ink` → #2B0A14, `muted` → neutral-600. Teal and the multi-hue `c-*` accents collapsed onto the brand ramp (kit: no blue/purple, no second accent). Status colours → kit feedback ramp. Focus ring → 3px rose. `--btn-radius` → pill. 148 literal `#2A1416` / `#FFF8FA` / `#6E5257` swapped. |
| Radius | Tailwind `rounded-*` scale now = kit (md 16 · lg 20 · xl/2xl 24 · 3xl 32). Codemod on 562 arbitrary radii: button-shaped → `rounded-full` (122), padded cards → `rounded-[24px]` (131), everything else → `rounded-[16px]` (309). |
| 3 Components | Navbar default logo → official wordmark SVG (admin `image`/`festive` modes still honoured). Hero CTAs use `.mt-btn`. |
| 4 Sections | **Home hero**: cream, two-beat H1 with serif human half, primary + ghost CTA, slot-grid composition with one rose thread (lg+ only). **Footer**: maroon-dark, inverse wordmark, maroon CTA band with pink thread + onBrand button, binder-tab divider. Bee honeycomb + doodle wordmark removed (bee retired). |

## Done (second PR: rest of Home)

- Problems → maroon feature grid: dark `maroon-dark` cards, Bricolage titles, blush body, pink checks, `onBrand` CTA.
- How it works → blush ground; flow cards flat white, 24px.
- Integrations panel → blush, maroon headline, rose accent (teal gone).
- Who-it's-for, testimonials, trust, FAQ → cream; maroon H2 with rose accent word; flat white cards (no shadows); 2px ink/warm rules on trust + FAQ.
- Tailwind `neutral` = kit warm ramp, so every `text-/border-/bg-neutral-*` on the site is warm, not cold grey.
- Copy: Home CTAs "Start for free" → "Get your booking link".
- Pricing section heading restyled; `PricingCards` itself left for the Pricing PR (shared with /pricing).

## Remaining (follow-up PRs, one area each)

| Area | Debt | Notes |
|---|---|---|
| Hard-coded hex | 3,136 literals | Worst: `pitch-deck/PitchDeck.jsx` (100), `features/*Feature.jsx` (~330 combined), `admin/SuperDashboard.jsx` (59), `for/SportsTurf.jsx`, `for/Astrologers.jsx`. Off-brand hues to remove: indigo `#4F46E5`/`#EEF0FF`, lime `#A3E635`, slate `#64748B`/`#94A3B8`/`#CBD5E1`, amber `#F59E0B`, sky `#269CEF`/`#1DA1F2`. |
| Shadows | 441 arbitrary `shadow-[…]` | Kit: cards are flat fills; shadows only for overlays + hover lift (`--shadow-*`, maroon-tinted). |
| Borders | 396 `border-black/5` | Kit: 2px (`--border-1/2`), 3px selected, 2px ink rule between major sections. |
| Radius stragglers | 44 arbitrary radii | Inside template expressions the codemod skipped. |
| Section patterns | `/for/*` landings, `/features/*`. About, Careers, Pricing done (Aastha's #71 layouts + brand pass); `PricingCards` still needs the recommended plan as a `brand` card | Rebuild per WEBSITE_MIGRATION Phase 4: feature grid on maroon with dark illustrations, how-it-works on blush with the ribbon, pricing with a `brand` card. |
| Components | No shared `Button`/`Input`/`Card` in `components/ui` yet | Port `design-system/components/*` into `client/src/components/ds/` and replace call sites area by area. |
| Copy (Phase 5) | Title Case buttons ("Start for Free"), hype words | Sentence case, verb-first ("Get your booking link"). |
| Legacy CSS | `styles/base-fb.css`, `styles/components/*.css`, `howitworks.scoped.css`, `enterprise.scoped.css` | Migrate off or delete once their pages are rebuilt. |
| Assets | OG images, email header logo, admin `appearance_settings.icon_url` (old bee in DB) | Point at `assets/01-logo/*`. |
| QA (Phase 6) | Lighthouse a11y ≥95, 375/768/1280/1920, reduced motion | Run per page as each area lands. |
