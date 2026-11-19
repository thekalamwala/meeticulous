# Dashboard face-uplift — audit against the marketing guide

**Date:** 2026-11-18
**Trigger:** "Meeticulous — Dashboard Face-uplift Guide" (HTML spec from the marketing team).
**Verdict:** the guide specifies a state the product already shipped. The genuine gaps it
missed sit in two files it never looked at.

---

## 1. What the guide asked for, and where it already lives

The guide's deliverable is a `:root` token block plus a region-by-region "from → to"
table. Every token in it is already in the repo, with identical values.

| Guide asks for | Already in repo | Evidence |
|---|---|---|
| maroon 50–900, `#960D32` brand | same hexes | `client/src/styles/brand.css:21` |
| cream `#FBF5F3`, ink `#2B0A14` | same | `client/src/styles/brand.css:15` |
| radius 16/20/24/32/pill, nothing square | same scale | `client/src/styles/brand.css:134` |
| maroon-tinted shadow ramp | same | `client/src/styles/brand.css:143` |
| Bricolage / Poppins / Instrument Serif | mapped | `client/tailwind.config.js:60` |
| warm neutrals replacing cold Tailwind greys | `neutral-*` remapped site-wide | `client/tailwind.config.js:25` |
| pill maroon buttons, 16px inputs, hairline cards | `.mt-btn` / `.mt-input` / `.mt-card` | `client/src/styles/brand.css:173,201,248` |

**Do not generate a `tokens.json`.** The design system already has one source of truth —
`design-system/tokens/*` → synced to `client/src/styles/brand.css` → mapped into
`client/tailwind.config.js`. A fourth copy of the palette is the most likely way for the
brand to drift. Anything the kit is missing gets added in `design-system/` and re-synced
(`design-system/BRAND_RULES.md`).

## 2. "Don't touch the left rail" — already true, for a different reason

The live host dashboard is **Host Lab** (`client/src/pages/hostlab/`), permanently on since
2026-11-18. It ships its own shell. The `ConsoleSidebar` the guide appears to be describing
is the flag-OFF legacy path.

## 3. Measured brand conformance

Cold Tailwind greys (`-gray-N`) are the off-brand marker — `neutral-N` is remapped to the
warm cream→ink ramp and is correct by design.

| Surface | `-gray-*` hits before | After |
|---|---|---|
| Host Lab (`pages/hostlab/`) | 1 (a code comment) | 1 (same comment) |
| Guest dashboard pages (`/user/*`) | 0 | 0 |
| Shared dashboard primitives (`components/dashboard/`, `components/guest/`) | **80** | **0** |
| Rest of client (admin, booking, marketing pages) | ~869 | untouched — out of scope |

Host Lab and the guest pages were already clean. The off-brand surface was the **shared
primitives both of them render through**, which is why it was invisible to a page-by-page
read of the live site.

## 4. The gap the guide missed

`components/common/OverviewLayout.jsx` — the live host dashboard shell (mounted at
`client/src/App.jsx:496`) — and the `ProfileCompletionPanel` popover it renders were still
painted in the **pre-rebrand pink/navy** palette, as 26 hardcoded hexes:

| Legacy hex | Was | Now |
|---|---|---|
| `#F50069` | hot pink primary | `maroon` `#960D32` |
| `#D90059` | gradient end | `maroon-dark` `#7A0A28` |
| `#17164A` | navy ink | `ink` `#2B0A14` |
| `#71639E` | lavender muted | `muted` `#6B524F` |
| `#FFE1F1`, `#FFD8ED` | pink borders | `neutral-200` `#EBDCD9` |
| `#FFF7FB`, `#FFF0F8` | pink tint fills | `blush` `#FFE4EA` |
| `rgba(23,22,74,…)` | navy shadow | `rgba(122,10,40,…)` maroon-tinted |

These were hardcoded, so neither the token sync nor the Tailwind remap could reach them —
and `v3.189_maroon_color_defaults.sql` only repainted DB-stored colours, not source.

## 5. Changes made

1. **21 shared primitive files**: `-gray-N` → `-neutral-N` (same scale, warm ramp).
   88 class swaps. Fixes every caller at once rather than per page.
2. **`OverviewLayout.jsx` + `ProfileCompletionPanel.jsx`**: 26 legacy hexes → brand tokens.
   The two SVG `stroke` attributes keep real hex (`MAROON`, `TRACK` consts) — an SVG
   attribute cannot take a Tailwind class name.
3. **`ui/EmptyState.jsx`**: on the warm ramp; gains an optional `script` prop — one short
   phrase in Instrument Serif italic, the guide's one genuinely new idea. Mirrors the
   existing community `EmptyState` so the two read as one system rather than diverging
   further. Opt-in: callers that want a quiet empty row pass only `title`.
4. **`ui/DataTable.jsx`**: a right-aligned column is a numeric one, so right-aligned cells
   now get `tabular-nums`. One edit covers every ₹ column in every table built on it.

## 6. Deliberately not done

- **Density pass on Host Lab.** The guide says "denser and quieter than the marketing
  site". Host Lab already runs at 11–12px meta / 12px body with a dedicated `Empty`
  component and `tabular-nums` in 14 of its files. It is already the quiet version;
  re-spacing a working, shipped UI on a spec written from the marketing site is churn.
- **`tabular-nums` on inline money.** `GuestInvoices.jsx:67` and `CustomerBookings.jsx:54`
  render ₹ inside a prose sentence, not a column. Tabular figures only buy alignment in a
  column; inline they just look wider.
- **The other ~869 `-gray-*` hits** (admin console, `ServiceDetail`, `ServiceBooking`,
  `Navbar`). Real debt, but not the dashboard, and not this change.

## 7. For the marketing team

No screenshot or URL is needed. The ask should be inverted: the spec was written by reading
meeticulous.com, so it re-derived a palette the product already uses and missed the one
shell that had actually drifted. Future UI specs should start from
`design-system/BRAND_RULES.md` and name the component files in question.
