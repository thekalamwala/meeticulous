# Meeticulous Design System

Meeticulous is a scheduling and appointment-booking platform for professionals who sell their time: coaches, consultants and creators. Primary audiences are founders and small teams, sales and customer-success people, and agencies/consultants. This system is the foundation for the website, product UI, emails, social, decks and marketing.

**Direction: C · Loop & Slot** (chosen in round 1, see `Brand Exploration.dc.html`). A rounded calendar slot is the layout module, the ee thread connects things, the pink dot means *booked*, and heavy solid type sits against open monoline.

## Sources
- `meeticulous-logo-kit/` (local folder supplied by the user): wordmarks, ee mark, M monogram, camera+calendar icon, app icons, favicons, social/print/banner files, README with colours and logo rules. The originals are not modified; the files we use are copied into `assets/01-logo/` and `assets/06-favicon/` under the `mt-` naming scheme.
- Brand answers from the user: personality is warm & human, calm & focused, confident & bold. Fonts: a grotesque (primary), Poppins (secondary), Instrument Serif (script, used rarely).
- Note: the "Modernist" system attached to this project (square corners, red, Archivo) conflicts with the Meeticulous logo. We borrowed only its structural ideas: visible grid, strong 2px rules, flush-left type.

## Index
- `styles.css`: the single entry point (imports only).
- `tokens/`: `fonts` · `colors` · `typography` · `spacing` · `radius` · `elevation` · `stroke` · `motion` · `base`
- `components/`: `components.css` (class layer) plus React primitives:
  - actions: **Button**, **IconButton**
  - forms: **Input**, **Select**, **Checkbox**, **Radio**, **Switch**
  - display: **Card**, **Badge**, **Tag**, **Tooltip**
  - navigation: **Tabs**
  - feedback: **Dialog**, **Toast**
  - brand: **SlotCell**, **Logo**, **Thread**, **Illustration**, **Icon**
- `guidelines/`: foundation specimen cards (Colors, Type, Spacing, Brand).
- `assets/`: see Asset library below.
- `Brand Exploration.dc.html`: audit, opportunities, the three directions, and the comparison.
- `SKILL.md`: an agent-skill wrapper for use in Claude Code.

**Intentional additions** (no source component existed): Icon (Lucide wrapper), Logo/Thread/Illustration (asset wrappers so nobody redraws brand art), SlotCell (the core booking atom and layout module).

## Asset library (`assets/`)
Naming: `mt-<family>-<variant>-<tone|ground>.svg`
- `01-logo/` with `wordmark/`, `mark/` (ee, M monogram), `icon/` (camera+calendar, plus the small variant for sizes under 24px), `app/`
- `02-ee/` with `mt-ee-{color}` (the mark alone), `mt-ee-thread-{color}` (flat line → loop → flat line), `mt-ee-ribbon-{color}` (continuous loops)
- `03-patterns/` with seamless tiles: `loop` (one 62u period, tiles horizontally), `ee-scatter`, `camcal`, `slots`, `dots`, each as `-on-{maroon|blush|cream}`
- `04-illustrations/` with `mt-camcal-{tone}` and `mt-illo-{availability|group|reschedule|reminder|payment|live}-{light|dark}`
- `05-dividers/` with `mt-divider-tabs-{color}` (binder-tab rule)
- `06-favicon/` with the favicon set and `head-snippet.html`
- To add an asset, copy the nearest existing file, keep the 240×160 illustration grid and 6u stroke, and add both light and dark versions.

---

## CONTENT FUNDAMENTALS
- **Voice:** warm, calm, confident, like a well-organised friend who respects your time. Short sentences. Plain words.
- **Person:** speak to the user as *you*. Meeticulous is *we* only when owning a mistake or an action ("We'll send the reminder").
- **Casing:** sentence case everywhere, including headlines, buttons and nav. No Title Case and no ALL CAPS, except overlines (CSS-uppercased).
- **Headlines:** two-beat lines with a practical half and a human half: "Sell your time. *Keep your calm.*", "Every booking, beautifully kept.", "Booked, without the back-and-forth." The human half may take the Instrument Serif accent.
- **Buttons:** verb first, specific: "Get your booking link", "Add to calendar", "Reschedule". Avoid "Submit", "Click here" or "Learn more" on their own.
- **Product copy:** state facts and times: "Tue 14 Nov · 10:30–11:15 GMT · Paid £120". Use a middle dot (·) as the separator.
- **No emoji.** No exclamation marks in UI, at most one per marketing email.
- **Numbers:** use numerals ("3 slots open"), 24h or locale time, currency symbols.
- **Avoid:** "seamless", "revolutionary", "supercharge", "AI-powered" as an opener, and guilt-based nudges.

## VISUAL FOUNDATIONS
- **Colour:** maroon `#960D32` is the brand field and the primary action. Pink `#FF9FB0` is the *booked* dot and the accent on maroon. Rose `#E0506F` is the ee stroke and display-size accent (3.6:1 on cream, so never body text). Blush `#FFE4EA` is the light brand ground, cream `#FBF5F3` the page, and ink `#2B0A14` the text. Marigold `#F6C35A` means *open time* only, never decoration. Ramps live in `tokens/colors.css`; always use the semantic aliases (`--bg-*`, `--fg-*`, `--border-*`, `--status-*`).
- **Grounds:** at most two per layout: cream + maroon, or cream + blush. No gradients, no glass, no blur, no blobs.
- **Type:** Bricolage Grotesque 800 for display and headings, with tight negative tracking (−3% to −4.5%). Poppins 400/500/600 for body and UI. Instrument Serif italic is a rare accent: one phrase per layout, ×1.08 size, never in UI chrome.
- **The rule of contrast:** solid heavy type and fills against open monoline (thread, illustrations, slot outlines). Never make the thread solid or the type outlined.
- **Layout:** 12-column grid, 24 gutter, 80 margin (20 on mobile), 1280 container. Inside it, the **slot grid** (96px cells, 10px gap, 20px radius) structures pickers, dashboards and hero compositions. Headings and copy are flush left. Use a strong 2px ink rule between major document sections.
- **The thread:** one per layout, bleeding off an edge, behind content, never under body text, never rotated. Pink/white on maroon; rose/maroon on light grounds.
- **Backgrounds & textures:** flat colour by default. Pattern tiles go at low contrast (the tone-on-tone `-on-*` files) for social posts, email headers and empty states. Never put a pattern behind paragraphs.
- **Imagery:** warm, natural-light photography of real people at work (coaching calls, studios, desks). No stock handshakes. Photos can sit inside a camera-frame or slot-shaped crop with a 24px radius. Don't recolour photos.
- **Corner radii:** nothing is square. xs 6 (checkbox) · sm 10 · md 16 (inputs) · lg 20 (slots, toasts) · xl 24 (cards) · 2xl 32 (dialogs) · pill (buttons, tags, badges). The radii come from the icon body (corner ≈ 18% of the short side).
- **Cards:** flat fills (white on cream, blush, maroon), 24px radius, no border by default. The outline variant uses a 2px `--border-1`. Shadows are reserved for overlays and hover lift.
- **Borders:** 2px is the UI default, 3px for selected or strong states, 1px hairlines only inside dense tables.
- **Shadows:** warm maroon-tinted `--shadow-sm/md/lg`; no grey shadows and no inner shadows.
- **Hover:** primary buttons darken one ramp step (600→700). Outline and ghost buttons get a pink-100 tint. Cards lift 2px with shadow-md. Links shift to rose-600.
- **Press:** one more step darker (→800) plus a 1px translateY. No shrink.
- **Focus:** a 3px rose ring (`--focus-ring`) on every interactive element. Never the browser blue.
- **Motion:** calm. Use `--ease-out` with 140–220ms durations for state changes, and fades plus small 4–8px translates. The thread may "draw" in once on hero load (stroke-dashoffset, 1200ms, `--ease-loop`). No bounces, no infinite loops. Respect `prefers-reduced-motion`.
- **Transparency:** only for the dialog overlay (`--bg-overlay`, ink at 48%).
- **Status logic:** booked = maroon cell + pink dot · open = marigold · busy = hatched neutral · selected = rose ring.

## ICONOGRAPHY
- **UI icons:** [Lucide](https://lucide.dev), loaded from CDN (`lucide-static@0.460.0`) through the `Icon` component (CSS mask, inherits `currentColor`). Lucide's 2px round stroke at 24px matches the logo icon's stroke-to-body ratio (6u on 76u). *This is a substitution: the kit has no UI icon set.* Sizes 16/20/24/32. Use maroon or ink on light, white on maroon. Never mix with filled sets.
- **Brand symbol:** the camera+calendar icon (`assets/01-logo/icon/`) is the product/UI/favicon symbol. Use the `-small-` file under 24px.
- **Illustrations:** built from the icon's own parts (rounded body, binder tabs, lens triangle, pink dot) at a 6u stroke on a 240×160 grid. Each comes in light and dark. Spot use only: features, empty states, emails.
- **The pink dot** is a status signal (booked/live), not decoration. Never use more than one decorative dot per composition.
- **No emoji, no unicode glyphs as icons** (except × in chips and toasts).

## Caveats
- Fonts are loaded from Google Fonts. If you have licensed or self-hosted files (especially if "grostreque" means a font other than Bricolage Grotesque), add `@font-face` rules in `tokens/fonts.css`.
- There is no product codebase or screenshots yet, so no UI kits or slide templates are included. Those are the next layer.
