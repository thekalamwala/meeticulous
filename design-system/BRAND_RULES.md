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
| `--mt-marigold` | #F6C35A | **Open time slots**, and one community topic tone (see below). Never decoration |

- At most two grounds per page section: cream + maroon, or cream + blush.
- Body text is ink or maroon. Rose is never used for body text.
- No gradients, glassmorphism, blur, 3D blobs, neon or purple/blue. **One exception:** the four
  official plush mascots (see *Product UI — Kept* below) are 3D and multicoloured by design.
- Proportion: cream 45 · maroon 20 · blush 15 · ink 10 · pink 5 · rose 3 · marigold 2.
- **Community topic pills are the one multicoloured surface** (`.mt-topic--1..8`): a topic
  hashes its name to a fixed tone so the same topic is always the same colour. The tones are
  existing tokens only — maroon-600, maroon-800, rose-500, pink-400, marigold-400, green-600,
  blue-600, neutral-700 — never a new hex. This is the only place marigold appears away from an
  open slot, and the only place green/blue appear outside a feedback state. Red is excluded so a
  topic never reads as an error. Everywhere else the two-grounds rule above still holds.

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
- A form field is one box: the framed `.mt-input` carries the border/background; its inner `input`/`textarea`/`select` is bare (no border, fill, shadow or radius of its own). Never give a nested control its own chrome — it draws a second grey box inside the field. Guarded in `components.css`.

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

## Words: booking, appointment, session
- **Booking** is the product word: dashboard, emails, pricing ("5% per booking"), product names ("booking page", "booking link"). It is the one word that fits everything hosts sell: reserve + pay.
- On a profession page, call the visit what that customer calls it:
  - **Appointment**: clinics (doctors, dentists, vets, eye, ENT, skin), salons, spas.
  - **Session**: coaches, physiotherapists, therapists.
  - **Booking** stays for slot-like things (turf, desks, workshop seats).
- **Meeting** only for an actual video call ("Google Meet link"). It hides that the guest pays.
- Never rename code or data for this: the `bookings` table and API stay.

## Product UI — Kept (dashboard, approved 2026-11-25)
The host dashboard follows **Kept**: the brand stays maroon; the structure borrows from the
best SaaS consoles (a tinted page with white cards, one focal band per page, big type, real
imagery). Pitch and guidelines: claude.ai/artifact/VKsrB9rmuxv2BN5rd3gGBH.
- **Grounds:** cream page + white cards. Cards have **no border** and a 24px radius (20 for
  metric tiles, 32 for the band). A card never holds a bordered card. Hairlines only between rows.
- **Insight band** (`InsightBand` in `client/src/components/dashboard/ui/v2.jsx`): maroon-700 +
  loop pattern + the page's ONE ee thread + at most one mascot. Once per page, at the top. Its
  headline is a sentence built from real figures; at most two actions.
- **Type floor:** nothing under 12px. Page title 28/34px, card title 18/20px, metric 24/28px,
  body 14–15px, meta 12.5–13px. No uppercase labels except the band's eyebrow.
- **Maroon means act or matters:** actions, the active nav item, the band, a featured metric's
  ring. Never a filled maroon stat tile.
- **Notices** are a white card with a blush icon chip, one sentence and one button, never a
  full-width coloured banner.
- **Control radius (dashboard):** buttons, tabs, nav rows and icon buttons are rounded
  rectangles: 12px (10px small / inside a group), badges 8px, tags 6px. Full circles only for
  avatars, dots, toggles and the tab-bar centre button. Pills read soft but make hover fills
  and focus rings look off (founder call, 2026-11-25). The marketing site keeps its pills.
- **Rail (desktop nav):** 232px wide, 34px rows at 13.5px, 28px sub-rows at 13px, 18px icons. Sized
  so every section can expand on a 768px-tall laptop without the footer being cropped.
- **Hover never moves anything in the dashboard:** no lift, no scale, no wobble, no hover shadow.
  Hover only tints the background (white → pink-50 / cream → blush) and links shift colour. This
  overrides the kit's general "cards lift 2px" rule inside the product (founder call, 2026-11-25).
- **Hover and press fills take the element's own shape, never a pill.** A row that runs edge to
  edge inside a card (accordion headers, list rows) has a square hover; the card's 24px corner
  clips the first and last rows. An inset row (with space around it inside the card) uses 12px.
  The dashboard sets `--btn-radius: 12px` on `.dash`, so a button with no radius class can never
  fall back to the marketing pill.
- **Mascots** (`client/public/about/mascot-*.png`, 400px sources): purple star = Intelligence /
  Pro, orange panda = Money / KYC, blue axolotl = Bookings / Today, green sprout = Grow / first
  steps. Use them in bands, empty states, Pro previews, onboarding and celebrations. **Exception
  (founder call, 2026-11-25):** Today carries more than one mascot on purpose: the band's mascot
  (standing on the ee), one per metric tile (80px, 96px on desktop) in the tile's empty right side,
  matched by domain (orange = money, purple = insights, blue = bookings, green = growth) and placed
  out of the flow so it never adds height, and the green sprout on the setup checklist (64px beside
  the heading on a phone; on desktop it fills the space under the heading). Every other page keeps one mascot per screen. Never in
  a table or a list row. Never recolour or crop through the face.
- **Charts:** one hue (maroon-600); a second series or deduction is rose-500. Human labels
  ("Oct", "Mon", "9 am"), 11px minimum, every chart has a tooltip.
- **One fact, one place:** a task (verify KYC, confirm a booking) is asked for in one place on a
  page. A metric shows the number; the ask lives in the setup checklist or the bell.
- **Honest values:** when a figure isn't available, the value slot says so in a sentence
  ("Not tracked yet"), never a dash or a ₹0. Blocks that load show a skeleton, never an empty
  state, until their data has arrived.

## Before shipping any page, check
- [ ] Only tokens, no stray hexes or fonts
- [ ] At most one thread, at most one serif phrase
- [ ] Marigold only on open slots
- [ ] All corners rounded per the radius scale
- [ ] Contrast ≥4.5:1 for body text
- [ ] Focus ring visible on every interactive element
- [ ] Official logo files used, untouched
- [ ] Visit is called what the customer calls it (appointment / session / booking)
- [ ] Dashboard: no text under 12px (charts 11px), no bordered cards, one band, one mascot per
  screen (Today's exceptions above)
