# Email Template Redesign — Bold Blocks + Per-Email Identity — Design

**Date:** 2026-06-23
**Status:** Draft, pending user review
**Branch:** `feat/email-template-redesign`
**Author:** Book A Sloth + Claude

## Problem

The current emails are functionally correct but visually flat — every one of the 31
templates renders the same generic body (`eyebrow` → `h` → `lead` → grey `card`) inside the
same chrome. Nothing distinguishes an OTP from a booking confirmation from a payment receipt
except the words. The founder's verdict: **"templates are too lifeless,"** and **"each email
should have its own identity."**

## Goal

Give every transactional email a distinct, recognizable face — its own accent color, header
glyph, and signature "hero block" — **without** hand-authoring 31 bespoke layouts. One shared
system, many faces. Adopt the **Bold Blocks (D2)** visual direction the founder approved.

Scope is **header + body only.** The footer (already live in production) is **not touched.**

## Decisions (locked with founder)

| # | Decision |
|---|----------|
| 1 | Base visual direction = **D2 "Bold Blocks"** — solid color hero blocks, semantic status tags, high contrast. |
| 2 | **Radius scale:** outer card `8px`; inner/"sharp" blocks `1px`; CTA button `2px`; **header category chip = true pill (capsule).** Nothing else above `8px`. |
| 3 | **Header flips:** logo on the **LEFT**, accent **icon + category pill on the RIGHT**. (Today: chip on right, name on left.) |
| 4 | **Left logo = `https://company-assets.bookasloth.in/images/email/footer-logo.png` for ALL emails** — constant, not host-specific. Overrides the vendor-leads-with-own-logo behaviour from the audience-split layout. |
| 5 | **CTA stays brand orange** (`settings.brand_color`) on every email — brand recognition. The per-category **accent** colors only the header pill, header glyph, and the body hero block. |
| 6 | Each email gets a per-category **identity kit** = `{ accent, glyph, hero block }`, driven by one shared registry. |
| 7 | **Footer untouched** (customer nav+legal / vendor "Powered by" both stay exactly as live). No footer code changes. |
| 8 | Header glyphs are **hosted PNG icons** (NOT inline SVG / NOT icon-font) — Outlook desktop renders neither SVG nor webfonts. |

## Visual system

### Radius scale (global)
```
outer card ............ 8px
header category pill ... capsule (full pill)   ← the only >8px element, by decision #2
CTA button ............ 2px
hero blocks / tags .... 1px
logo mark ............. n/a (image)
```

### Header (rewritten in `emailLayout.js`)
```
┌─────────────────────────────────────────────┐
│  [footer-logo.png]            [◆ icon  Pill] │   ← logo LEFT (constant)
├─────────────────────────────────────────────┤      accent pill RIGHT (glyph + email_category)
```
- **Left:** `<img src={FOOTER_LOGO}>` at ~24–28px height, left-aligned, constant for every email and every audience. Replaces today's logo+name+sub-label stack.
- **Right:** capsule pill — `accent`-tinted background, `accent` text, a 16px PNG **glyph** + the `email_category` label. The pill degrades gracefully: if the glyph PNG is blocked, the text label still reads.
- The name wordmark and the sub-label-under-name are **removed** (identity now lives in the pill + hero).

### Accent + glyph registry (NEW `emailThemes.js`)
A single dependency-free module mapping every `email_category` value to a semantic family.
Both the header (in `emailLayout.js`) and the body hero helpers read from it, so the two never
drift. All colors are **precomputed solid hex** (no 8-digit alpha — Outlook).

| `email_category` | Family | Accent | Tint (bg) | Text | Glyph (PNG) | Hero block |
|---|---|---|---|---|---|---|
| Security Check | slate | `#41506a` | `#eef1f5` | `#41506a` | shield-lock | `otpBox` (if `otp`) else CTA only |
| Security Alert | slate | `#41506a` | `#eef1f5` | `#41506a` | shield-alert | `infoCard` (time/IP/device) |
| Booking Confirmed | green | `#1aa463` | `#e8fff1` | `#056800` | calendar-check | `heroDate` + `statusTags` |
| New Booking | brand | `#FE5100` | `#fff1ea` | `#b8410f` | calendar-plus | `bookingCard` + `amountRow` + `statusTags` |
| Reminder | violet | `#6b4bb3` | `#f1ecfb` | `#534ab7` | bell | `countdown` + detail |
| Booking Cancelled | red | `#d8453f` | `#fdeceb` | `#a32d2d` | x-circle | `banner` + refund note |
| Session Complete | teal | `#0f8a74` | `#e2f5f1` | `#0f6e56` | circle-check | detail + review prompt |
| Rescheduled | blue | `#2f7bd6` | `#e9f1fb` | `#185fa5` | calendar-clock | `heroDate` (new time) |
| Account Update | blue | `#2f7bd6` | `#e9f1fb` | `#185fa5` | user-cog | simple hero + CTA |
| Achievement Unlocked | amber | `#e89b1f` | `#fdf2dd` | `#854f0b` | trophy | `celebration` medallion |
| Payment Receipt | green | `#1aa463` | `#e8fff1` | `#056800` | credit-card | `receipt` rows + amount |
| Community Update | pink | `#d4537e` | `#fbeaf0` | `#993556` | gift | `celebration` hero |
| Welcome | brand | `#FE5100` | `#fff1ea` | `#b8410f` | sparkles | welcome hero + CTA |
| Product Feedback | blue | `#2f7bd6` | `#e9f1fb` | `#185fa5` | message-dots | status pill + response card |
| Newsletter | brand | `#FE5100` | `#fff1ea` | `#b8410f` | mail | editorial hero + CTA |

> Result: **9 color families, 15 glyphs** across the 15 categories that exist today.

### Body hero blocks (NEW `emailComponents.js`)
Reusable, accent-aware, Outlook-safe (nested tables, solid hex, 1px radius, PNG-only imagery).
Each takes an `accent` family object from the registry so a template never hardcodes a color.

| Helper | Renders | Used by |
|---|---|---|
| `otpBox(theme, code)` | big letter-spaced code on tinted block | OTP, Password Reset |
| `infoCard(theme, rows)` | accent-bordered detail rows | Login Alert, Password Changed |
| `heroDate(theme, {day,mon,year,time,dur,title,sub})` | solid accent date square + service | Booking Confirmed, Rescheduled |
| `bookingCard(theme, {...})` | service + party + time block | New Booking |
| `amountRow(theme, label, value)` | highlighted money strip (earnings) | New Booking |
| `statusTags([{label,tone}])` | row of 1px semantic tags (paid/online/confirmed…) | bookings |
| `countdown(theme, {inText,big})` | "starts in / 2 hours" strip | Reminder |
| `banner(theme, {title,sub})` | full-width accent-tint banner | Cancelled |
| `receipt(theme, {amount,rows})` | amount-paid block + line items + GST | Payment Receipt, Renewed |
| `celebration(theme, {iconUrl,title})` | medallion hero | Achievement, Birthday, Anniversary |
| `reviewStars(theme, n, quote)` | ★ row + quote | (Session Complete review prompt) |

`statusTags` tone palette (semantic, fixed — independent of email accent): `paid`→orange,
`online`/`offline`→grey, `confirmed`/`completed`→green, `cancelled`→red, `pending`→amber.

## Architecture

### New modules
1. **`server/services/email/emailThemes.js`** — the registry (decision #6). Pure, no DB.
   `themeForCategory(email_category) → { family, accent, tint, text, glyphUrl }` with a safe
   default (brand family) for any unmapped category.
2. **`server/services/email/emailComponents.js`** — the hero-block helper library above. Pure,
   string-returning, Outlook-safe. Imported by `config/emailTemplates.js`.

### Edited files
3. **`server/services/email/emailLayout.js`** — rewrite `headerBlock()` only:
   - left = constant `FOOTER_LOGO` image; right = accent capsule (glyph + `emailCategory`),
     colors from `emailThemes`.
   - Remove the name wordmark + sub-label.
   - **Footer functions, shell, accent bar, CTA button: unchanged.** `tint()` stays.
   - `renderLayout` already receives `emailCategory` — it now resolves the theme from it.
4. **`server/config/emailTemplates.js`** — rewrite each `html_content` to call the new hero
   helpers with its category theme, keeping the same `{{placeholders}}`, `event_key`,
   `audience`, `email_category`, `email_reason`, `cta_label`, `cta_url`. Per-template accent is
   **compiled in** at build time from `emailThemes` (NOT via `{{brand_color}}`, which is always
   orange and reserved for the CTA).

### Data flow (unchanged except header theme resolution)
```
event → communicationEngine.send → getTemplate → renderEmail
  → resolveTemplate (placeholders, unchanged)
  → renderLayout({ emailCategory, bodyHtml, ... })
       → themeForCategory(emailCategory)        # NEW: accent + glyph for header pill
       → headerBlock(logo=FOOTER_LOGO, pill={glyph,category,accent})   # rewritten
       → body (already carries its compiled hero block)                # from emailTemplates.js
       → footer (UNCHANGED)
```

### Icon assets (founder dependency — blocks visual completion)
Header glyphs are **PNG**, hosted on the existing `company-assets.bookasloth.in` CDN, because
Outlook desktop renders neither inline SVG nor icon-fonts. 15 icons needed (one per glyph in
the registry), exported at 2× (e.g. 32px for 16px display), single-color to match `accent`
(or a neutral dark that reads on any tint).

- Path convention: `https://company-assets.bookasloth.in/images/email/icons/<name>.png`
  (e.g. `shield-lock.png`, `calendar-check.png`, `credit-card.png`).
- Until assets exist, the registry `glyphUrl` falls back to empty → pill shows **text only**
  (no broken-image icon). Ship-blocking for the *full* look, not for function.
- Same hard dependency class as `footer-logo.png`. Tabler-outline names in the registry give
  the design team an exact icon list to export.

## Error handling & fallbacks
- Unmapped `email_category` → brand family (orange) + no glyph. Never throws.
- Missing glyph PNG / images-off client → pill renders text-only (label always present).
- `footer-logo.png` fails to load → `alt` text shows; header still structurally valid.
- Hero helper missing a data field (e.g. no `otp`) → that block is omitted; body falls back to
  its prose + CTA. No raw `{{tokens}}` leak (resolver already blanks unknowns).
- CTA unchanged: rendered only when `cta_label` **and** `cta_url` both present.

## Email-client constraints (carried from the live system)
- Table-based layout, max-width 600px, all design tokens inlined.
- **No 8-digit alpha hex** — all accents/tints are precomputed solid hex in the registry.
- **No inline SVG, no webfont icons** — glyphs are PNG (decision #8).
- Capsule pill via `border-radius` on a table cell with a solid tint fill (Outlook tolerates it
  on the small pill; VML not required since the label degrades gracefully).
- Verify in Gmail (web + iOS), Apple Mail, Outlook desktop, dark mode.

## Re-seed & deploy
1. Code change to `emailTemplates.js` only re-renders on **re-seed** — run
   `node scripts/seedEmailTemplates.js` (idempotent upsert by `event_key`+`audience`).
2. **Run against BOTH databases** — Mumbai (`ayjhlwyzszykqtnaktpb`, real prod) **and** Tokyo
   (`xwvciqkayammbvsidqig`, staging). See the staging/prod-inversion note in project memory.
3. These templates are **LIVE** — the header rewrite + body re-seed change production emails on
   next send. Sequence: merge code → re-seed staging → smoke test → re-seed prod.
4. `emailLayout.js` / `emailThemes.js` / `emailComponents.js` are code — they ship with the
   server deploy, no seed needed.

## Testing
- **Unit `emailThemes`** — every existing `email_category` resolves to a family; unknown →
  brand default; all colors are 6-digit hex.
- **Unit `emailComponents`** — each helper returns a string, contains the accent hex, omits
  cleanly when a field is absent (e.g. `otpBox` with no code), uses only 1px radius.
- **Unit `emailLayout`** — header contains `FOOTER_LOGO` on the left and an accent pill with the
  category on the right; **footer output is byte-identical to before** (regression guard so the
  untouched-footer promise is enforced by a test).
- **Snapshot/regression** — render one email per family; assert hero block present, CTA orange,
  pill accent correct.
- **Existing engine/campaign tests** stay green (placeholder/queue/retry untouched).
- **Manual** — test-send one email per family; verify Gmail + Outlook (pill, glyph PNG, hero
  block, 2px CTA, dark mode).

## Out of scope
- **Footer** — no changes (decision #7).
- The customer/vendor footer audience split — untouched.
- Unsubscribe / placeholder resolver / queue / retry / providers — untouched.
- New email events or copy rewrites beyond what a hero block needs.
- WhatsApp templates.
- Producing the icon PNGs (founder/design dependency; code ships with graceful text-only
  fallback).

## Affected files
- `server/services/email/emailThemes.js` — **new** (registry).
- `server/services/email/emailComponents.js` — **new** (hero-block helpers).
- `server/services/email/emailLayout.js` — **edit** header only; footer/shell/CTA unchanged.
- `server/config/emailTemplates.js` — **edit** all 31 `html_content` bodies to use hero blocks.
- `server/tests/unit/` — new `emailThemes` + `emailComponents` tests; updated `emailLayout` test
  (incl. footer-unchanged regression guard).
- Re-seed both DBs via `server/scripts/seedEmailTemplates.js` (no code change to the seeder).
- **Asset dependency:** 15 glyph PNGs on `company-assets.bookasloth.in/images/email/icons/`.

## Appendix: icon asset manifest (founder/design deliverable)

Upload to `https://company-assets.bookasloth.in/images/email/icons/`.

**Shared specs (every icon):**
- **Canvas:** `48 × 48 px` (3× of the 16px display size — crisp on retina).
- **Format:** PNG-24 with alpha (transparent background), sRGB, < 5 KB each.
- **Style:** outline / line-icon (Tabler-outline equivalents), ~2px visual stroke weight, no fill.
- **Color:** single solid color per icon (the family text-shade below) — matches the pill label.
- **Padding:** ~3px safe margin inside the 48px canvas (glyph art ~42px).
- **Display in email:** `width="16" height="16"`.

| # | File | Glyph | Used by (email_category) | Color |
|---|---|---|---|---|
| 1 | `shield-lock.png` | shield + lock | Security Check | `#41506a` |
| 2 | `shield-alert.png` | shield + ! | Security Alert | `#41506a` |
| 3 | `calendar-check.png` | calendar + check | Booking Confirmed | `#056800` |
| 4 | `calendar-plus.png` | calendar + plus | New Booking | `#b8410f` |
| 5 | `bell.png` | bell | Reminder | `#534ab7` |
| 6 | `circle-x.png` | circle + x | Booking Cancelled | `#a32d2d` |
| 7 | `circle-check.png` | circle + check | Session Complete | `#0f6e56` |
| 8 | `calendar-clock.png` | calendar + clock | Rescheduled | `#185fa5` |
| 9 | `user-cog.png` | user + gear | Account Update | `#185fa5` |
| 10 | `trophy.png` | trophy | Achievement Unlocked | `#854f0b` |
| 11 | `credit-card.png` | credit card | Payment Receipt | `#056800` |
| 12 | `gift.png` | gift box | Community Update | `#993556` |
| 13 | `sparkles.png` | sparkles | Welcome | `#b8410f` |
| 14 | `message-dots.png` | speech bubble + dots | Product Feedback | `#185fa5` |
| 15 | `mail.png` | envelope | Newsletter | `#b8410f` |

> Colors are the per-family **pill text-shade** (legible on the light tint background). If you
> prefer fewer variants, a single neutral `#202124` for all 15 also works — less "alive" but
> one less color axis. Source glyphs: Tabler Icons (outline) — names above match the set.

