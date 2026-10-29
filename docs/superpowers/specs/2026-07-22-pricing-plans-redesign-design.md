# Pricing Plans Redesign — Design Spec

**Date:** 2026-07-22
**Branch:** `redesign/pricing-plans`
**Surfaces:** Homepage pricing section (`Home.jsx`) + dedicated pricing page (`Pricing.jsx`)
**Reference:** Relume pricing layout (name-tab chip, per-card accent, persona footer)

## Goal

Refresh the pricing UI (visual + layout + clarity), matching a Relume-style card
design, and **extract a shared component** so Home and /pricing never drift.
Add a 4th **Enterprise** tier.

## Constraints (do not violate)

- Existing design tokens only: 6px radius, Plus Jakarta headings, Poppins body.
- **No emojis.** Line icons (lucide) only; accent = soft glow around the line icon.
- No new npm deps. Reuse `Reveal`, `Check` (lucide), existing shadows.
- `data/plans.js` numbers for Starter/Host+/Studio stay unchanged (DB is enforcement
  authority per v3.55). Only additive changes (Enterprise entry, `accent` field).
- Preserve billing-toggle behavior (Monthly/Yearly, Yearly default).

## Brand accent palette ("bottom 5")

Not in `tailwind.config.js`. Store the hex per-plan in `plans.js` and apply via
**inline style** (dynamic per card → purge-safe, avoids arbitrary-class purge issues).

| Plan | Accent hex | Line icon |
|---|---|---|
| Starter (Free) | `#4AB765` green | `Sprout` |
| Host+ | `#269CEF` blue | `Sparkles` |
| Studio ★ recommended | `#FE5100` orange | `Rocket` |
| Enterprise | `#FF4D93` pink | `Building2` |

Unused 5th brand color (`#FFCC1C` yellow) reserved, not applied.

## Layout

- **Top row:** 3 paid cards `md:grid-cols-3` → Host+, Studio, Enterprise. Equal height.
- **Below:** Starter/Free wide horizontal card (keeps current horizontal treatment).
- **Billing toggle** above the row, unchanged. Starter (₹0/forever) and Enterprise
  (custom) ignore the toggle.
- Mobile: everything stacks single-column.

## Card anatomy (paid card)

1. **Header row:** name-tab chip top-left (bordered white pill, plan name in its
   accent color) + line icon top-right inside a tile with a soft accent glow
   (`box-shadow: 0 0 20px <accent>55` + faint accent bg).
2. **Tagline** (2 lines, `plans.js`).
3. **Price block:** big `₹<price>` + small `/mo` + subline
   (`billed yearly · save X%` when yearly, `billed monthly` otherwise).
   - Enterprise: no number → "Custom" + subline "Volume pricing".
4. **CTA (full-width):** Studio = orange (`primary-cta`), Host+ = ink, Enterprise
   = outline+accent → links to `/enterprise` ("Talk to Sales"); paid signup CTAs →
   `ROUTE_START` ("Let's Get Started").
5. **Divider.**
6. **Feature list:** thin-check rows, keeps `intro` line ("Everything in Host+, plus:").
   Enterprise features = teaser bullets ("Everything in Studio, plus:" — SSO & SAML,
   role-based access, multi-location, REST API + webhooks, dedicated SLA & onboarding).
7. **Persona footer:** line icon in a small glowing accent tile + persona title +
   1-line "who it's for" blurb. **No emoji.**

**Studio (recommended):** accent ring + outer glow + "Recommended" chip top-right.
Others = plain `border-black/5`.

**Starter wide card:** same visual language (green accent, `Sprout` icon, persona
footer) but horizontal on desktop like the current implementation.

## Persona footer copy

| Plan | Persona title | Blurb |
|---|---|---|
| Starter | Just Starting Out | Testing the waters — your first bookings, at zero cost. |
| Host+ | Solo Creator | Booking regularly and want 0% commission + automation. |
| Studio | Growing Studio | A full practice — CRM, analytics, unlimited everything. |
| Enterprise | Teams & Agencies | Multiple seats, locations and workflows, custom needs. |

## Data changes — `client/src/data/plans.js` (additive only)

1. Add `accent` + `icon` (lucide name string) + `persona: { title, blurb }` to
   `STARTER_PLAN` and each `PAID_PLANS` entry.
2. Add `ENTERPRISE_PLAN`:
   ```js
   export const ENTERPRISE_PLAN = {
     name: "Enterprise", slug: "enterprise",
     tagline: "For teams, agencies & multi-location practices.",
     price: "Custom", cta: { label: "Talk to Sales", to: "/enterprise" },
     accent: "#FF4D93", icon: "Building2",
     intro: "Everything in Studio, plus:",
     features: ["SSO & SAML", "Role-based access", "Multi-location", "REST API + webhooks", "Dedicated SLA & onboarding"],
     persona: { title: "Teams & Agencies", blurb: "Multiple seats, locations and workflows, custom needs." },
   };
   ```
3. Add `"enterprise"` column to `PLAN_COLUMNS` and an `enterprise` cell to every
   `PLAN_MATRIX` row (`"Custom"` / `true` / value as appropriate; Enterprise ⩾ Studio
   on every capability).

Icon strings resolved to components via a small local `{ Sprout, Sparkles, Rocket,
Building2 }` lookup in the component (no dynamic import).

## Component — `client/src/components/pricing/PricingCards.jsx`

Single source consumed by Home + Pricing.

- Props: `{ yearly, onToggle }` (billing state stays owned by each page so Home can
  keep its existing `useState`), or self-contained with an optional `showToggle` prop.
  **Decision:** component owns nothing DB-side; accepts `yearly` + `setYearly` so both
  pages share identical toggle UI. Component renders toggle + top-row + Starter card.
- Exports default `PricingCards`. Pure presentational; imports plan data itself.
- Home replaces its inline pricing markup (lines ~1666–1808) with `<PricingCards …>`
  plus the surrounding heading/footnote copy it already has.
- Pricing.jsx replaces its inline card markup with `<PricingCards …>`; keeps the
  `PLAN_MATRIX` comparison table below (now 4 columns).

## /pricing comparison table

- 4 columns: Starter / Host+ / Studio / Enterprise.
- Mobile: horizontal scroll wrapper (`overflow-x-auto`) so 4 cols don't crush.

## Out of scope (skipped)

- No `/enterprise` page work — it already exists (`pages/Enterprise.jsx` +
  `enterpriseData.js`). Card only links to it.
- No plan price/limit changes; no DB migration.
- No new brand-color Tailwind tokens (inline hex per card).
- No landing-page (`lp/*`) pricing changes — those import `plans.js` and keep their
  own layout; the new `accent`/`persona`/`ENTERPRISE_PLAN` fields are additive and
  ignored there.

## Testing / verification

- `cd client && npm run build` green (Vercel gate runs `vitest run && build`).
- `npx vitest run` — routeManifestSync + existing tests pass (no new route added).
- Browser preview: Home pricing section + /pricing at desktop + mobile; verify
  toggle, ring/glow, Enterprise CTA → /enterprise, matrix horizontal scroll on mobile.
