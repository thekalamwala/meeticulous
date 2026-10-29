# Footer Redesign — Design Spec

**Date:** 2026-06-25
**Branch:** `feat/footer-redesign-plan` (built in an isolated worktree; the original `feat/footer-redesign` was corrupted by a concurrent session resetting the shared tree — see notes at end)
**Status:** Design approved → pending implementation plan

---

## 1. Goal

Replace the Home-only, inline-hardcoded footer with a single **reusable, refined footer component** rendered across all public/marketing surfaces. Keep it visually minimal (the "refined A" direction), add a brand blurb + social row + trust line, and structure the content so a future DB-driven **Footer Builder** is a drop-in swap.

## 2. Scope

**Phase 1 — build now:**
- New `<Footer/>` component, content driven by a local config object.
- Global render in `App.jsx`, gated by `hideFooter` (mirrors `hideNavbar`).
- Remove the inline footer + `FOOTER_COLS` const from `Home.jsx`.
- Refined-A content: CTA band, brand blurb, social icons, 3 link columns, trust line, legal bar.
- Fix on-page anchors to be root-relative (`/#section`) so they work site-wide.
- Render test + manual preview verification.

**Phase 2 — later (documented, NOT built here):**
- Wire the stubbed `AdminFooterBuilder` (`/admin/platform/footer`) to a DB-backed footer config + API; component reads config from API with the Phase-1 hardcoded object as fallback. See §10.

**Explicitly out of scope:** newsletter signup, dashboard/app footers, any change to `/lp/*` (landing pages keep their own footer), navbar.

## 3. Decisions (locked)

| Question | Decision |
|---|---|
| Layout direction | **A — refined & minimal** (today's Calendly-style, cleaned up) |
| Extra blocks | Social icons + brand blurb + trust line (**no** newsletter) |
| Render scope | **Public + marketing only** (mirror `hideNavbar` boundary) |
| DB-driven depth | **Static now, Footer Builder deferred to Phase 2** |
| Support email | **Keep `bolt@bookasloth.in`** (confirmed intentional) |
| Socials | Instagram, X/Twitter, LinkedIn, Facebook, WhatsApp (handles TBD) |
| Wiring | Global render in `App.jsx` gated by `hideFooter` |

## 4. Current state

- Real site footer is **inline in `client/src/pages/Home.jsx`** (`<footer>` block near the end) with a `FOOTER_COLS` const (~L504). (Line numbers approximate — `Home.jsx` shifted after #167.)
- It is **Home-only** — profile/service/about/help/legal pages render no footer.
- `client/src/pages/admin/AdminFooterBuilder.jsx` is a **"coming soon" empty-state stub**; route `/admin/platform/footer` is wired but non-functional.
- `App.jsx` renders `<Navbar/>` globally via `{!hideNavbar && <Navbar/>}`; `hideNavbar` excludes `/dashboard`, `/admin`, `/super-dashboard`, `/vendor-register`, `/lp`, and `/hello-sloth`.
- `HostProfile.jsx`'s `{/* Footer */}` comment is a **service-card row**, not a page footer — no conflict.

## 5. Architecture

### 5.1 Component
`client/src/components/common/Footer.jsx` — presentational, no data fetching in Phase 1.

Content comes from a single module-scope config object so Phase 2 can replace it with an API payload of the same shape:

```js
const FOOTER = {
  cta:    { heading: "Power up your\nbookings.", sub: "Get started in seconds — for free.",
            primary: { t: "Let's Get Started", to: ROUTE_START },
            secondary: { t: "See how it works", href: "/#how-it-works" } },
  blurb:  "Booking pages + payments for India's creators and professionals. 0% commission on paid plans.",
  socials: [ /* {name, href, icon} — see §6.4 */ ],
  columns: [ /* {h, links:[{t, href}]} — see §6.3 */ ],
  trust:  "Razorpay-secure payments · GST invoices · Made in India 🇮🇳",
  legal:  { copyright: "Book A Sloth", links: [
            {t:"Terms", to:"/terms"}, {t:"Privacy", to:"/privacy"}, {t:"Refund", to:"/refund"} ],
            email: "bolt@bookasloth.in" },
};
```

Link rendering helper: `to` (internal) → `<Link>`; `href` starting with `/#`, `#`, `mailto:`, or `http` → `<a>`. (Same branch logic as the current footer, extended for `/#` anchors.) The CTA heading stores `\n` and the component renders it as a `<br/>`.

`<Footer/>` is a normal (non-lazy) import — it renders on every public page and is tiny.

### 5.2 Wiring (`App.jsx`)
Add alongside `hideNavbar`:

```js
const hideFooter = hideNavbar; // same boundary for now
```
…and render `<Footer/>` once inside the top-level fragment, after `</Suspense>`:
```jsx
{!hideFooter && <Footer />}
```
`<Footer/>` uses `<Link>`, so it must stay inside the Router context (App already is). Then **delete** the inline `<footer>…</footer>` block and the `FOOTER_COLS` const from `Home.jsx`.

> `hideFooter` is its own variable (aliased to `hideNavbar`) rather than reusing `hideNavbar` directly, so future tweaks (e.g. hide on auth pages) don't couple footer and navbar visibility.

## 6. Content spec

### 6.1 CTA band
Heading "Power up your bookings." + sub "Get started in seconds — for free." + primary **Let's Get Started** (→ `ROUTE_START`, the same start target Home uses — replicate the constant in the component) + secondary **See how it works** (→ `/#how-it-works`).

### 6.2 Brand row
Wordmark "Book A Sloth" + blurb (§5.1) + social icon row (§6.4).

### 6.3 Link columns (3)
| Column | Links (label → href) |
|---|---|
| **Product** | How it works → `/#how-it-works` · Pricing → `/#pricing` · FAQ → `/#faq` · Be a Host → `/be-a-sloth` · Explore → `/explore` |
| **Company** | About → `/about` · Reviews → `/#collective` · Log in → `/login-as-vendor` |
| **Support** | Help → `/help` · Contact → `mailto:bolt@bookasloth.in` · Support → `/support` |

### 6.4 Socials (handles **TBD — verify before merge**)
| Network | Placeholder href |
|---|---|
| Instagram | `https://instagram.com/bookasloth` |
| X / Twitter | `https://x.com/bookasloth` |
| LinkedIn | `https://linkedin.com/company/bookasloth` |
| Facebook | `https://facebook.com/bookasloth` |
| WhatsApp | `https://wa.me/<number>` |

Icons: inline SVGs (no new dependency). Open in new tab (`target="_blank" rel="noopener noreferrer"`).

### 6.5 Trust line
"Razorpay-secure payments · GST invoices · Made in India 🇮🇳"

### 6.6 Legal bar
© {current year} Book A Sloth · Terms · Privacy · Refund · `bolt@bookasloth.in`. Wordmark links to `#top` / scroll-to-top.

## 7. Anchor handling (important)
On-page anchors (`#how-it-works`, `#pricing`, `#faq`, `#collective`) only resolve on Home. Because the footer is now site-wide, they must be **root-relative** (`/#how-it-works`): from any page they navigate to Home, then scroll to the section. Verify the Home sections have matching `id`s (they currently back the Home-local anchors). React-router does not auto-scroll to a hash by default — confirm existing hash-scroll behaviour (`useLenis` is present) or add a small hash-scroll-on-load handler on Home if needed.

## 8. Visual / design
- Dark `bg-ink`, white text at graded opacity (matches current footer + design system).
- Radii 4–6px (`rounded-[5px]`) per the global button/radius tokens.
- Primary CTA keeps the current white-on-dark treatment; secondary is outline. (Orange accent only if a design-system review prefers it — default keep white.)
- Hover states on every link (`hover:text-white`), `hover:no-underline` consistent with current.
- Responsive: columns `grid-cols-2 sm:grid-cols-3`; CTA band stacks on mobile; social row wraps.
- A11y: `<footer>` landmark, social links have `aria-label`, focus-visible rings, sufficient contrast on `white/40+` text, no motion.

## 9. Files touched (Phase 1)
| File | Change |
|---|---|
| `client/src/components/common/Footer.jsx` | **new** — component + `FOOTER` config |
| `client/src/App.jsx` | add `hideFooter`, render `<Footer/>`, import |
| `client/src/pages/Home.jsx` | remove inline `<footer>` + `FOOTER_COLS` const |
| `client/src/components/common/__tests__/Footer.test.jsx` | **new** — render test |
| `.gitignore` | ignore `.superpowers/` (brainstorm artifacts) |

## 10. Phase 2 outline (DB-driven, deferred)
- DB: `footer_config` (single-row JSON or normalized `footer_columns` / `footer_links` / `footer_socials`) — TBD at Phase-2 design.
- API: `GET /api/footer` (public, cached) + admin `PUT /api/admin/footer`.
- `AdminFooterBuilder`: replace empty-state with a real editor (columns, links, socials, blurb, trust, legal, copyright).
- `Footer.jsx`: read config from API (load-once), fall back to the Phase-1 `FOOTER` object on empty/error. Because Phase 1 already centralizes content in one object of the target shape, this is additive.

## 11. Testing & verification
- **Unit (Vitest):** Footer renders; all column links + legal links present; legal email correct; socials have `aria-label` + `target=_blank`.
- **Manual (preview):** footer appears on `/`, a `/:profileSlug` profile, and `/about`; **absent** on `/dashboard`, `/super-dashboard`, `/lp/*`; anchor links from `/about` jump to Home sections; mobile layout stacks; dark contrast OK.
- Existing client test suite stays green.

## 12. Open items
- **Social handles/URLs** — placeholders in §6.4 must be confirmed before merge.
- **WhatsApp** — need the click-to-chat number for `wa.me/<number>`.
- Confirm Home hash-scroll works for `/#section` deep-links (§7).

## Notes — shared-worktree drift during planning
The original branch `feat/footer-redesign` was created off `main`, but a concurrent Claude session sharing the same working tree repeatedly switched branches and ran `git reset HEAD~2`, which moved that branch pointer back 2 commits and wiped this uncommitted spec from the tree. This spec was therefore re-created and committed from an **isolated git worktree** (`feat/footer-redesign-plan`, based on `origin/main` @ 5f3775c). Implementation should continue in an isolated worktree, not the shared main tree. The stale local `feat/footer-redesign` branch can be deleted.
