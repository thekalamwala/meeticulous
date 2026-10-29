# Reference Research Report — Kit · Salesforce · Semrush · beehiiv

_Deliverable 1 of the Meeticulous design-system initiative. Captured 2026-10-29 by inspecting the live sites in a real browser (computed styles via `getComputedStyle` + `document.fonts`, plus hero screenshots). Values marked **(verified)** were read from the running CSS; values marked **(approx)** were judged from the rendered page and not read byte-for-byte._

> **Purpose.** Extract the strongest, transferable ideas from four best-in-class SaaS marketing/product sites — not to copy any one of them, but to inform a single coherent design language for Meeticulous (booking SaaS, blue `#0079C1`, India). Each observation is framed as **Observed → Why it works → What we learn → How it translates to Meeticulous.**

---

## Method & scope

- Analysed each site's homepage hero + primary nav + CTA hierarchy (the publicly accessible, highest-signal surface).
- Pulled real `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, text/background colors, and the primary CTA's background/radius/shadow from the live DOM.
- Did **not** chase decorative details that don't change UX. Focused on type system, color/hierarchy, CTA pattern, and layout rhythm.

---

## A. Kit (kit.com) — email platform for creators

**Verified snapshot**

| Token | Value | Note |
|---|---|---|
| Body font | `KitSansFont` (proprietary) + Libre Franklin + system | Custom display sans doubles as body |
| H1 | `KitSansFont` · **48px / 48px** (line-height 1.0) · wt 500 · white | Tight, heavy-reading display |
| Text ink | `#1E1E1E` (verified) | Near-black, not gray |
| Primary CTA | bg **`#44B1FF`** (bright blue) · **dark** text `#1E1E1E` · radius **8px** · **no shadow** | Light-blue fill, dark label |
| Hero | Dark starfield navy, centered mega-heading, single pill CTA | Immersive, focused |

**Observed →** One oversized, tightly-set heading on a dark immersive hero, a single bright-blue pill CTA with *dark* text, and enormous surrounding whitespace. Nav is lean (Features · Pricing · Use Cases · Resources).
**Why it works →** A single visual focal point (one heading, one CTA) removes choice paralysis; the bright-blue-on-dark CTA has very high pop without needing a shadow; dark-text-on-light-blue is a confident, modern inversion of the usual white-on-saturated button.
**What we learn →** You don't need shadows to make a CTA pop — a high-chroma accent on a restrained background does it. One hero = one decision.
**How it translates →** Meeticulous heroes should commit to **one** headline + **one** primary CTA. Our `primary #0079C1` is close to Kit's accent family; a lighter blue fill with dark ink is a viable secondary-CTA treatment. Keep shadows off CTAs entirely.

---

## B. Salesforce (salesforce.com) — enterprise AI CRM

**Verified snapshot**

| Token | Value | Note |
|---|---|---|
| Body/UI font | `Salesforce Sans`, Arial | Also loads **Inter** for app UI |
| Display font | `ITC Avant Garde` ("Avant Garde for Salesforce") | Geometric display for headings |
| H1 | Avant Garde · **60px / 60px** · wt 400 · **`#002C6E`** (deep navy) | Navy display, very large |
| Text ink | `#080707` (verified) | Near-black |
| Link | `#0B5CAB` (verified) | Mid-blue |
| Primary CTA | **green** ("Get started") — distinct from brand blue (approx) | Action color ≠ brand color |
| Hero | Sky-blue gradient, navy heading, **colorful product cards with icons** (Slack / Tableau / Agentforce / Data 360), AI assistant widget | Segmented, dense, trustworthy |

**Observed →** A deep-navy display headline on a light sky-blue gradient, product capability expressed as a grid of **colorful icon cards**, a **green** primary CTA that is deliberately *not* the brand blue, and an always-present AI assistant.
**Why it works →** Navy-on-light-blue gives powerful hierarchy inside a single hue family. The green CTA is unmissable precisely because it contrasts the blue brand — action color decoupled from brand color. Icon cards let a complex product be scanned in seconds.
**What we learn →** (1) A monochrome-blue system still needs **one contrasting action accent** so CTAs never blend into brand-blue surfaces. (2) Segment a broad product into labelled, iconographic cards.
**How it translates →** Meeticulous is blue-dominant and feature-broad (bookings, payments, calendar, products, reviews, analytics). Adopt **icon-led feature cards** (we already have profession/feature iconography) and introduce a **single reserved action accent** distinct from `#0079C1` for the most important CTAs — our `--c-emerald #059669` is the natural candidate, mirroring Salesforce's green.

> Note: our deep `primary-cta #00457C` is essentially Salesforce's navy `#002C6E` — validation that a dark-navy blue reads as premium/trustworthy for an action/heading accent.

---

## C. Semrush (semrush.com) — SEO/visibility platform

**Verified snapshot**

| Token | Value | Note |
|---|---|---|
| Body/UI font | **Inter** | The workhorse for a data-dense product |
| Display font | `Lazzer` (variable) | Expressive marketing display |
| H1 | Lazzer · **84px / 92.4px** (lh ~1.1) · wt 600 · **tracking `-3.36px`** (~−0.04em) · `#181E15` | Giant, very tight |
| Text ink | `#181E15` / body `#333333` (verified) | Near-black display, gray body |
| Primary CTA | **black pill** ("Start for free") | Max contrast |
| Accent | **`#C190FF`** lavender · secondary buttons **0px radius** (verified) | Pop accent + sharp corners |
| Hero | Pastel lavender→mint gradient, centered giant heading | Bold, airy |

**Observed →** An enormous display headline with aggressive negative tracking, a black pill primary CTA, a lavender pop accent, and **Inter for everything functional**.
**Why it works →** The expressive display font carries brand personality on *marketing* pages, while Inter keeps the *product* (famously data-dense: tables, charts, metrics) legible and compact. Splitting "expressive display" from "neutral UI" font is the key move. Tight tracking on huge type feels intentional and premium.
**What we learn →** Use a character-rich display font only at large sizes; use a neutral, high-legibility font for dense UI, tables, and body. Add negative letter-spacing to large headings.
**How it translates →** Meeticulous already splits fonts: **Plus Jakarta Sans** (display/headings) + **Poppins** (body). Keep that split — but (a) **tighten tracking** on large headings (`letter-spacing: -0.02em` on H1/H2, which we currently don't do), and (b) recognise Poppins is *wide* for dense data tables. Recommendation in the token spec: keep Poppins for body/marketing, but allow a tabular/UI escape hatch where density matters (dashboard tables) rather than adding a third webfont lightly.

---

## D. beehiiv (beehiiv.com) — newsletter/creator platform

**Verified snapshot**

| Token | Value | Note |
|---|---|---|
| Body font | **Satoshi** | Clean geometric sans |
| Display font | **Clash Grotesk** | Heavy grotesk for headings |
| H1 | Clash Grotesk · **48px / 48px** · wt 700 · **UPPERCASE** · white on dark | Bold, condensed feel |
| Text ink | `#000` (verified) | Pure black |
| Accent | violet/magenta accent word + glow (approx) | One pop hue |
| Hero | Dark navy, uppercase display, **product dashboard screenshot** (metric cards $2,563 / 372,096 / 39.31% + chart), trust bar "4.9 from 28,479" | Product-as-proof |

**Observed →** A dark hero with a bold uppercase grotesk headline, one violet accent word, a **real product screenshot** (stat cards + chart) beside the copy, dual "Sign up with Google / email" CTAs, and an immediate social-proof trust bar.
**Why it works →** Showing the actual product dashboard (numbers + chart) is the strongest possible value proof for a tool whose job is analytics. Dual-CTA (Google + email) lowers signup friction. One accent hue keeps a dark theme from feeling chaotic.
**What we learn →** Lead with the product's real data UI as the hero visual; offer the lowest-friction auth first; social proof above the fold.
**How it translates →** Meeticulous host signup is **Google-only** (per product rules) — beehiiv's dual-CTA validates leading with the Google button prominently. Our marketing heroes should show a **real booking page / earnings dashboard screenshot** (we have polished dashboards) rather than abstract illustration. Keep to one pop accent per section against our blue.

---

## Comparison table

| Dimension | Kit | Salesforce | Semrush | beehiiv | Meeticulous direction |
|---|---|---|---|---|---|
| Display font | KitSansFont (custom) | ITC Avant Garde | Lazzer | Clash Grotesk | **Plus Jakarta Sans** (keep) |
| UI/body font | Libre Franklin | Salesforce Sans / Inter | **Inter** | Satoshi | **Poppins** (keep) |
| Text ink | `#1E1E1E` | `#080707` | `#181E15` | `#000` | `#191919` (keep — on-trend) |
| Hero backdrop | Dark starfield | Sky-blue gradient | Pastel gradient | Dark navy + product shot | Light canvas default; dark hero option |
| Heading scale | 48/1.0 | 60/1.0 | 84/1.1 **tight** | 48/1.0 uppercase | **Bigger + tighter tracking** |
| Primary CTA | Bright-blue pill, no shadow | **Green** (≠ brand) | Black pill | Light pill + Google | Blue/ink fill, **no shadow**, +1 reserved action accent |
| CTA radius | 8px | mixed | **0px** | 0px | **4–6px** (keep — friendlier) |
| Shadows | none on CTA | minimal | none on CTA | none on CTA | **soft only; kill hard offset shadows** |
| Accent strategy | 1 bright blue | blue + green action | black + lavender | 1 violet | blue brand + `--c-*` palette + 1 reserved action green |
| Proof device | whitespace/focus | icon product cards | — | **product screenshot + trust bar** | **product screenshots + trust bar** |

---

## Synthesis — what to adopt, what to reject

**Adopt (with reasons):**
1. **Split "expressive display" from "neutral UI" type** (Semrush/beehiiv). We already have it (Jakarta + Poppins) — enforce it and tighten heading tracking.
2. **One contrasting action accent** decoupled from brand blue (Salesforce green) so CTAs never blend into blue surfaces → reserve `--c-emerald #059669` for primary conversion CTAs; keep `#0079C1`/`#00457C` for brand/links/secondary.
3. **No shadows on CTAs; soft shadows only on cards** (all four) → directly kills our legacy brutalist hard offset shadows.
4. **One hero = one headline + one primary CTA**, bigger and tighter (all four).
5. **Icon-led feature cards** to segment a broad product (Salesforce).
6. **Product screenshots + above-the-fold social proof** as the proof device (beehiiv) — and lead host signup with the Google button.

**Reject / don't chase:**
- 0px sharp-corner buttons (Semrush/beehiiv) — too severe for a friendly, trust-sensitive booking product aimed at Indian SMB creators; our 4–6px radius reads warmer. Keep it.
- Fully dark default theme (Kit/beehiiv) — our audience + current light `canvas #F8FAFC` system is right; offer dark *heroes* as an option, not a dark app.
- Proprietary custom display fonts (Kit/Salesforce) — unnecessary cost/perf; Plus Jakarta Sans already gives us distinct character, self-hosted.
- Salesforce's enterprise information density and mega-menus — we are SMB/creator-facing; keep navigation lean (Kit model).

→ Feeds: `02-design-strategy.md` (philosophy), `03-design-tokens.md` (the reserved action accent, heading tracking, shadow scale), `04-components.md` (CTA, feature card, hero patterns).
