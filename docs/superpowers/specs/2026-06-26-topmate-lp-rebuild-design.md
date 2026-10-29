# Topmate LP Rebuild — Design Spec

**Date:** 2026-06-26
**Branch:** `feat/landing-page`
**Target:** `client/src/pages/lp/TopmateVsMeeticulous.jsx` (`/lp/topmate-vs-meeticulous`)
**Scope:** Redesign one page + fix shared LeadForm flow + fix consent-banner leak. Calendly LP untouched.

## Goal

Rebuild the Topmate conversion LP so it looks and feels like **Topmate's own homepage** — same warm, playful, creator-first aesthetic — but every visual and copy cue turns that style against Topmate. A visitor arriving from a Topmate ad feels at home, then realises the page is selling them the 0%-commission alternative. Single conversion goal: start a Google host signup.

## The three problems being fixed

1. **Generic design.** Current page is a competent but safe center-stacked template. Not world-class, not on-brand-against-Topmate.
2. **Lead-flow friction.** Email field then bounce to Google auth = double step, expectation mismatch. Decision: **one-click Google, drop the email field** on this page.
3. **Consent-banner leak (bug).** `<ConsentBanner />` (App.jsx:183) renders globally, *not* gated by `hideNavbar`. On `/lp` it shows a giant fixed girl-with-cookies card covering the comparison table and final CTA the entire scroll. Decision: **slim dismissible bottom bar on /lp only.**

## Visual system — mirror Topmate, weaponised

Source palette (Topmate brand, via Brandfetch): red `#E44332`, peach `#FFE4D6`, green `#009D28`.

| Token | Value | Use |
|---|---|---|
| Canvas | `#FFF6EF` warm cream | page background |
| Band | `#FFE4D6` peach | alternating section bands |
| Win green | `#009D28` | "you keep" / Meeticulous wins / checkmarks |
| Loss red | `#E44332` (Topmate's own red) | every place Topmate takes a cut / X marks |
| CTA | `#FE5100` BAS orange | the only CTA color (brand anchor, pops on cream) |
| Ink | existing `text-ink` | headlines/body |

- **Type:** oversized bold-black geometric headlines, tight leading (Topmate hero feel). Reuse existing `font-heading`.
- **Cards:** 24–32px radius, soft floating shadows — Topmate creator-card look.
- **Trademark touches:** emoji in badges/headers; circular-avatar social-proof strip (reuse the homepage `.png` faces if available, else neutral avatars — no invented counts).

The judo is explicit: use **Topmate's red** to mark losses and a warm playful skin, so the page reads as "made by Topmate, against Topmate."

## Section structure (AIDA kept, restyled)

1. **Sticky slim header** — wordmark + `0% commission` pill + orange "Start free" anchor to `#start`. No nav links (no exit).
2. **Hero (Attention)** — badge "Coming from Topmate? 👋"; headline *"Your storefront. Without the 30% tax."*; subcopy (0% commission, flat ₹499/mo); **one-click Google CTA**; circular-avatar social-proof row; trust-icon strip. Floating Topmate-style booking-card mockup beside/under headline: a ₹1,000 booking shown twice — BAS card "you keep ₹1,000" (green), faded Topmate card "you keep ₹700" (red).
3. **The math (Interest→Desire)** — keep `SavingsCalc` logic and constants verbatim (`PRO_MONTHLY`, `TM_RATE_LO/HI`, `TM_CLAIM_AS_OF`, `inr`). Restyle the two result blocks: Topmate-takes in loss-red, BAS in win-green. Keep the date-stamped commission disclaimer.
4. **Comparison table (Desire)** — keep `COMPARE` rows + `Cell`. Restyle as a rounded Topmate-ish card; green checks, red X. Keep `<caption>` + scope attrs (accessibility).
5. **Switch in 2 minutes (Action setup)** — keep `STEPS`; restyle as numbered Topmate blocks.
6. **FAQ (objection handling)** — keep `FAQ` content + native `<details>` accordion; restyle card.
7. **Final CTA (Action)** — warm dark block; one-click Google CTA.
8. **Minimal footer** — © + Privacy/Help/email links (keep existing).

## Components & interfaces

### `LeadForm` (`client/src/pages/lp/_shared/LeadForm.jsx`)
Add a `mode` prop (default `"email"` so Calendly LP is unchanged):
- `mode="email"` — current behaviour (email field + "or continue with Google" + handoff(true/false)).
- `mode="google-only"` — render a single "Continue with Google" pill, no email field, no email validation. Calls `handoff(false)` (which fires `LP_CTA_CLICKED` with `with_email:false` and `startVendorGoogleAuth("signup")`).
- All existing analytics events and the `slug`/`slot`/`dark`/`ctaLabel` props preserved. `busy` state and error toast preserved.
- The Topmate page passes `mode="google-only"` for both hero and final slots.

### `ConsentBanner` leak fix (`client/src/App.jsx` + `ConsentBanner`)
- Render a **slim one-line dismissible bottom bar** when on `/lp`, the full banner otherwise. Two options at implementation time (decide in plan): (a) pass a `variant="slim"` prop to `ConsentBanner` driven by `location.pathname.startsWith('/lp')`; or (b) a dedicated slim component for /lp. Constraint: must still gate the same marketing pixels (Meta/GA/Clarity) and persist the same consent decision — only the chrome changes.

### `TopmateVsMeeticulous.jsx`
- Keep all data constants and the `SavingsCalc`, `Cell` helpers (logic unchanged).
- Keep `useUtm`, `useDocumentMeta`, analytics `page` + `LP_VIEWED` on mount.
- Restyle markup + swap LeadForm to `mode="google-only"`.

## Out of scope (YAGNI)

- Calendly LP redesign.
- Backend leads table / persistence (still sessionStorage + events).
- New analytics events.
- Sitewide design changes (unless consent fix chooses the slim-everywhere route — it does not; /lp-only).

## Success criteria

- `/lp/topmate-vs-meeticulous` renders in Topmate's warm style with the color judo; no consent card covering content (slim bar only).
- One-click Google CTA in hero + final; no email field on this page; clicking fires `LP_CTA_CLICKED` and starts Google signup.
- Calendly LP visually unchanged; its LeadForm still email mode.
- Mobile 375px clean; no layout overflow; accessibility (table scopes/caption, labelled controls, reduced-motion respected) preserved.
- `cd client && npm run build` passes; `npm test` green.
- Pricing facts unchanged and still date-stamped.
