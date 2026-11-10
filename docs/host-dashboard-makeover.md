# Host dashboard makeover — audit & plan

**Status:** proposal (2026-11-10). No code changed by this doc.
**Goal:** make the host dashboard human-centric and on-brand — every important thing has clear
hierarchy so a host can scan and act without hunting. Keep all current function; change only UI/UX.
**Design law:** `design-system/BRAND_RULES.md` ("Loop & Slot"). Tokens only. No exceptions.

---

## 1. What we found (dashboard-wide)

Good news: the Overview + most host pages are already close to brand after the recent redesign.
The pain is concentrated in a few **legacy pages** that predate the design system.

Brand-drift scan (count of hardcoded values per page — these are all violations of "tokens only"):

| Page | gray-* | raw #hex | gradients | amber/yellow | green/blue/indigo | verdict |
|---|---:|---:|---:|---:|---:|---|
| **ProfileSetup** (Settings) | 59 | 9 | 2 | 4 | 5 | 🔴 worst — the target |
| **ServiceForm** (add/edit service) | 56 | 9 | 0 | 0 | 0 | 🔴 legacy |
| **UpgradePlan** (Plan) | 37 | 1 | 2 | 3 | 1 | 🟠 legacy |
| ProfessionServices / ServicesDirectory | 0 | 22 / 8 | – | – | – | 🟡 public, hardcoded palette |
| Dashboard, Bookings, Clients, Earnings, Availability, Payouts, Transactions, Invoices, ReferEarn, Feedback, ServicesList | 0 | 0 | 0 | 0 | 0 | 🟢 clean |

Takeaway: this is **not** a full rewrite. It's 3 legacy pages (Settings first) brought onto the
token system + a hierarchy pass. The clean pages only need a light hierarchy/voice review.

### Cross-cutting issues (apply everywhere we touch)

1. **No visual hierarchy in section headers.** Legacy pages use identical tiny `text-sm
   font-semibold text-gray-800` for every heading. Brand headings are **Bricolage 800, maroon**,
   sized by importance. A host can't tell the primary action from a footnote.
2. **Off-palette status colors.** Green "Connected/Verified" chips, amber "Coming soon" boxes —
   none are brand tokens. Brand has maroon / blush / pink / marigold + the pink dot = live.
3. **Banned visuals present.** `#4F46E5` indigo, gray→gray gradients, `linear-gradient` cover
   fills. Brand bans gradients, blur, purple/blue.
4. **Buttons not pill.** Legacy uses `rounded` (4px). Brand buttons/tags/badges are **pill**.
5. **Focus rings off-brand.** `focus:ring-gray-400` / `ring-primary/25`. Brand = **3px rose ring**
   on every interactive element.
6. **Voice drift.** "Book a Session" in generic previews — brand product word is **booking**
   ("session" is only for coaches). Two-beat human headlines are missing.

---

## 2. Settings page (Profile) — deep dive

File: `client/src/pages/ProfileSetup.jsx` (766 lines). Route `/dashboard/profile`.
Functionally solid (save flow, image crop, XSS-safe social sanitizer, plan gating). UI/UX is the problem.

### 2a. Information architecture is wrong

Current tabs: **Profile Info · Categories · Social Links · Appearance · Integrations**.

The "Integrations" tab is a junk drawer — it holds Google Calendar **plus**:
- **Booking Policy** (guest reschedule fee) — not an integration.
- **Discovery & Privacy** (profile visibility) — not an integration.
- the "more integrations coming soon" catalog.

A host looking for "can people find me?" or "reschedule fee" will never guess it's under
Integrations. Settings has no **Account & security** or **Notifications** home at all.

### 2b. Proposed IA (group by the host's mental model)

Settings becomes a hub with clearly named sections, ordered by how often a host touches them and
how much they matter:

| Section | Holds | Source today |
|---|---|---|
| **Your public profile** | photo, cover, name, title, bio, location, username, tagline | Profile Info tab |
| **What you do** | categories / profession | Categories tab |
| **Social links** | the 9 social fields | Social Links tab |
| **Look & feel** | theme color, plan border (drop the "Coming soon" list) | Appearance tab |
| **Booking policy** | reschedule fee (+ future: cancellation window, buffers) | moved out of Integrations |
| **Privacy & discovery** | profile visibility (listed/hidden) | moved out of Integrations |
| **Integrations** | Google Calendar + catalog only | Integrations tab |
| **Plan** | already its own sidebar item (`/dashboard/upgrade`) | keep link, don't duplicate |

Future (not in this pass, but the IA should leave room): **Account & security** (email, connected
login, danger zone) and **Notifications** (email/WhatsApp toggles).

### 2c. Hierarchy & layout

- One **Bricolage-800 maroon** section title per group, with a one-line ink/70 subtitle in Poppins.
  Sub-labels (field groups) step down in size — real type scale, not all-`text-sm`.
- **2px ink rule** between major sections (brand rule: separate major document sections).
- Lead with the **live profile card preview** (the WYSIWYG card already exists) so "how guests see
  you" is the anchor — that's the human framing the brand voice wants.
- Keep the **one sticky Save bar** as the single commit for form fields. Call out the two
  self-saving sub-areas (username, categories) with a small "saved separately" note so the save
  model stops being ambiguous.

### 2d. Token remap (the mechanical part)

| Now (banned) | → Brand token |
|---|---|
| `text-gray-900/800` (headings/body) | `text-ink`, section titles `text-maroon font-display` |
| `text-gray-600/500` | `text-ink/70` |
| `text-gray-400/300` (placeholder/meta) | `text-ink/45` (keep ≥4.5:1 where it's real text) |
| `bg-gray-50/100` panels | `bg-blush` or `bg-cream` (max two grounds/section) |
| `border-gray-100/300` | `border-ink/10`, selected `border-maroon` (2px / 3px) |
| cover fallback `bg-gradient-to-br from-gray-100` & preview `linear-gradient(...)` | flat `bg-blush` |
| amber "Coming soon" box | blush ground + maroon text, or drop entirely |
| green "Connected/Verified" chips | maroon chip + **pink dot** (brand's live signal) |
| `#4F46E5` indigo placeholder/default | `--mt-maroon` |
| `#111827` swatch selected ring | `--mt-ink` / rose focus ring |
| buttons `rounded px-8` | `rounded-full` (pill), `.mt-btn` |
| `focus:ring-gray-400` / `ring-primary/25` | 3px rose focus ring (`--focus-ring`) |
| `rounded-lg` swatch (20px on 8×8) | `rounded-md` or `rounded-full` dot |
| avatar `border-4` | 2px (3px if "selected/plan" emphasis) |
| CTA preview "Book a Session" | "Book" / brand booking word |

Note: the host's **theme_color** (personal brand color on their public page) is legitimately
user-chosen and stays as an inline style — that's data, not chrome. The remap is for the
**dashboard chrome around it**, not the host's own color.

### 2e. Structure

766-line monolith with inline sub-components. When we touch it, split into
`client/src/pages/settings/` section components (`PublicProfile`, `SocialLinks`, `LookAndFeel`,
`BookingPolicy`, `Privacy`, `Integrations`) under one `Settings.jsx` shell. Reuse
`components/dashboard/ui` primitives; **don't invent new one-off styles** — extend the design
system if something's missing (BRAND_RULES §"if a need isn't covered").

---

## 3. Plan (phased, one PR each, base = open release train)

Every PR ends with the BRAND_RULES "before shipping" checklist + a hierarchy check, and reuses the
`OverviewLayout.bg.test.js`-style guard pattern where a regression is easy to make.

- **P0 — Settings (Profile) revamp.** The target. New IA (§2b), hierarchy pass (§2c), full token
  remap (§2d), structure split (§2e). Function unchanged — same API calls, same save flow.
  *Biggest user-visible win; do first.*
- **P1a — ServiceForm.** Same token remap + hierarchy pass (56 gray / 9 hex). High-traffic (every
  host adds/edits services).
- **P1b — UpgradePlan (Plan).** Token remap + drop gradients/amber; pricing hierarchy pass.
- **P2 — Public service pages** (`ProfessionServices`, `ServicesDirectory`) hardcoded palettes.
- **P3 — Light pass on the clean pages**: voice (two-beat headlines, booking word), confirm Bricolage
  section headers + rose focus rings are actually used (not just absent-gray). No restructure.
- **Future (separate spec):** add **Account & security** and **Notifications** sections — real new
  surface, needs its own brainstorm, not part of this makeover.

### Guardrails so drift doesn't come back
- A lint/test that fails on `text-gray-`, raw `#hex`, `gradient`, and off-palette color classes in
  `client/src/pages/**` dashboard files (allowlist the few legit inline `style` data-color spots).
  This is the scalable version of the per-file guard test — it keeps the whole dashboard honest.

---

## 4. Acceptance (per page)

- [ ] Only design tokens — zero stray hex/gray/font (scan returns 0)
- [ ] Section titles Bricolage-800 maroon, real type scale, 2px ink rule between majors
- [ ] Buttons/tags/badges pill; cards per radius scale; borders 2px/3px
- [ ] 3px rose focus ring on every interactive element; no gradients/blur/purple/blue
- [ ] Status = brand (pink dot / maroon), never raw green/amber
- [ ] Booking word correct; one serif phrase max; at most one ee thread
- [ ] Function identical — same routes, API, save flow, plan gating
- [ ] Contrast ≥4.5:1 on body text
