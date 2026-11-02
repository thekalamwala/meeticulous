# Meeticulous: brand rules (always follow)

Direction: **Loop & Slot**. A rounded calendar slot is the layout module, the ee thread connects things, the pink dot means *booked*, and heavy solid type sits against open monoline.

## Colour: use tokens only
| Token | Hex | Use |
|---|---|---|
| `--mt-maroon` | #960D32 | Brand field, primary buttons, headings |
| `--mt-maroon-dark` | #7A0A28 | Hover/press, footers, cards on maroon |
| `--mt-rose` | #E0506F | ee stroke, display accent (≥24px only) |
| `--mt-pink` | #FF9FB0 | Booked dot, accent on maroon, onBrand buttons |
| `--mt-blush` | #FFE4EA | Light brand ground |
| `--mt-cream` | #FBF5F3 | Page background |
| `--mt-ink` | #2B0A14 | Body text |
| `--mt-marigold` | #F6C35A | **Open time slots only**, never decoration |

- At most two grounds per page section: cream + maroon, or cream + blush.
- Body text is ink or maroon. Rose is never used for body text.
- No gradients, glassmorphism, blur, 3D blobs, neon or purple/blue.
- Proportion: cream 45 · maroon 20 · blush 15 · ink 10 · pink 5 · rose 3 · marigold 2.

## Type
- Display/headings: **Bricolage Grotesque 800**, tracking −3% to −4.5%, maroon.
- Body/UI: **Poppins** 400/500/600.
- Accent: **Instrument Serif italic**, at most one phrase per layout, at ×1.08 size. Only the human half of a headline. Never in buttons, nav or body.
- Sentence case everywhere. No ALL CAPS except overlines.

## Shape & space
- Nothing is square-cornered. Radii: inputs 16 · slots 20 · cards 24 · dialogs 32 · buttons/tags/badges pill.
- 12-col grid, 24 gutter, 80 margin (20 mobile), 1280 container. Spacing on a 4px scale (`--space-*`).
- Slot grid: 96px cells, 10px gap, 20px radius.
- Borders 2px (3px selected). Shadows only for overlays and hover lift (`--shadow-*`). Cards are flat fills.
- Use a 2px ink rule between major document sections.

## Signature elements
- **ee thread** (`assets/02-ee/`): ONE per layout, bleeding off an edge, behind content. Never under body text, never rotated, never two at once.
- **Pink dot** = booked/live. It is data, not decoration.
- **Slot cell** states: empty (outline) · open (marigold) · booked (maroon + pink dot) · busy (hatched) · selected (rose ring).
- **Patterns** (`assets/03-patterns/`): tone-on-tone only, behind headlines, empty states, email headers or social posts. Never behind paragraphs.
- **Illustrations** (`assets/04-illustrations/`): the camera+calendar grammar only, light or dark versions. Never stretch the icon body.

## Logo
- Wordmark = brand sign-off (site header, email header, deck cover). Inverse version on maroon.
- Camera+calendar icon = product/UI/favicon. Use the `-small-` file under 24px.
- ee = app-store icon and motif source.
- Clear space = ¼ of mark width. Minimum 16px on screen. Never stretch, rotate, recolour, add effects, or move the dot.

## Icons
- Lucide (`lucide-static@0.460.0`), 2px round stroke, sizes 16/20/24/32, `currentColor`. No filled sets, no emoji.

## Interaction
- Hover: primary 600→700, outline/ghost get a pink-100 tint, cards lift 2px.
- Press: one step darker plus translateY(1px).
- Focus: 3px rose ring (`--focus-ring`) on everything. Never browser blue.
- Motion: 140–220ms `--ease-out`, fades plus 4–8px moves. The thread may draw in once on hero load. No bounces. Respect reduced motion.

## Voice
- Warm, calm, confident. Speak to "you". Short sentences.
- Two-beat headlines: practical + human ("Sell your time. *Keep your calm.*").
- Verb-first buttons ("Get your booking link"). Facts in product ("Tue 14 Nov · 10:30 · Paid £120").
- No emoji. No hype words (seamless, revolutionary, supercharge).

## Before shipping any page, check
- [ ] Only tokens, no stray hexes or fonts
- [ ] At most one thread, at most one serif phrase
- [ ] Marigold only on open slots
- [ ] All corners rounded per the radius scale
- [ ] Contrast ≥4.5:1 for body text
- [ ] Focus ring visible on every interactive element
- [ ] Official logo files used, untouched
