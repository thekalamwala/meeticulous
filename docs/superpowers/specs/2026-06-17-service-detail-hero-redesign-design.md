# Service Detail — Hero Redesign (CSS-only)

**Date:** 2026-06-17
**File:** `client/src/pages/ServiceDetail.jsx`
**Scope:** Visual restyle of the hero section only. Structure, components, and
functions stay the same. No backend, schema, or data changes.

## Goal

Replace the flat cream-background white-card hero with a soft, theme-derived
gradient band and a cleaner single-column stack, matching the reference mock.
Premium, light, conversion-focused. Everything below the hero (tabs,
deliverables, booking card, profile card) is untouched.

## Hard Constraints

- **No DOM reorder beyond the hero section.** Only the hero `<section>` and its
  inner markup change. The top badge row is removed and its data (Bestseller +
  meeting-mode tag) relocates into the meta row — same data, moved.
- **Components unchanged:** `BookingCard`, `ProfileCard`, all tab components,
  `Stars`, `SocialIcon`, helpers — no edits.
- **Functions unchanged:** `handleBookNow`, data fetch, theme application, SEO
  meta logic — no edits.
- **Booking-card CTA color stays vendor-driven** via `--profile-accent`. Not
  touched.

## Design

### Gradient band

- The hero `<section>` becomes a full-width band with a soft diagonal wash
  derived from the vendor's theme color — option A (monochrome tint → near
  white), pure CSS, no JS hue math.
- Gradient: `linear-gradient(135deg, color-mix(in srgb, <accent> 14%, white),
  color-mix(in srgb, <accent> 4%, white))`.
  - `<accent>` = `var(--profile-accent, #FE5100)` (already applied per-vendor on
    page load via `applyProfileTheme`).
- Band wraps the hero only. Cream `#f7f5ef` page background resumes below it.
- No white card: remove `bg-white border border-gray-200 rounded-2xl shadow-sm`
  from the hero. Content sits directly on the gradient.
- Generous vertical padding on the band (≈ `py-12`).

### Hero stack (top → bottom)

1. **Title** — `text-4xl sm:text-5xl`, black weight, tight leading
   (`leading-[1.1] tracking-tight`), `text-gray-900`.
2. **Short description** — `text-gray-600`, `max-w-2xl` (unchanged content).
3. **Creator row** — single line: circular avatar (with subtle ring) +
   `by ` **Name** ` in ` **Category**. Verified tick rendered after the name
   only when `vendor.is_verified`.
4. **Meta row** — one line, wraps on mobile, light styling:
   `[Bestseller] · 4.8 ★★★★★ · <reviewCount> Rating · <bookings> Bookings ·
   ⏱ <duration> · <mode tag>`
   - **Bestseller**: subtle — small text, tiny icon, faint tint background, NOT
     a chunky pill. Shown only when `isBestseller` (existing heuristic).
   - **Rating**: dynamic — `rating.toFixed(1)` + `Stars` + `"<reviewCount>
     Rating"` (label changed from "reviews").
   - **Bookings**: `"<bookings> Bookings"` (label changed from "booked"). Shown
     when `bookings > 0`.
   - **Duration**: small clock icon + `fmtDuration(service.duration)`. Always
     shown (relocated from old trust row).
   - **Mode tag**: Online / In-person — kept (relocated from the removed top
     badge row). Light inline style with small icon, not a heavy colored pill.

### Removed

- Top badge row (`Online/In-person` pill + `Bestseller` pill block) — markup
  deleted; both signals relocated into the meta row.
- White hero card chrome (bg/border/radius/shadow).

### Unchanged

- Mobile booking/profile card block placement, "Important note" block, tabs
  section, sidebar stickiness, all handlers and data flow.

## Judgment calls (override if wrong)

- Verified tick: kept conditional on `is_verified`.
- Title color: stays `gray-900`; no new token introduced.

## Out of scope (revisit later)

- Whether the gradient should be a band vs full-page top — assumed band-only.
- Two-tone / multi-hue gradient (option B/C).
- Restyle of booking card, profile card, or tabs.

## Verification

- Run the dev server, load a service page, confirm gradient renders from the
  vendor theme color, title/desc/creator/meta layout matches the mock, and the
  booking card CTA color is unchanged.
- Check mobile width (375px): meta row wraps cleanly, no card chrome regressions.
