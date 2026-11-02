# Current-State UX Audit — Meeticulous

_Deliverable 2. Prioritized audit of the shipped app across all four surfaces + the shared layer, from a read-only inspection of `client/src` (five parallel surface audits, 2026-10-29). Verified counts where cited. No files were modified during the audit._

---

## 0. Executive summary

The app is **healthier than its token layer suggests**. Three of the newer subsystems — the admin shell (`admin/ui/*` + `adm-*` tokens), the host dashboard (`dashboard/ui/*` under `.dash`), and the flagship marketing pages (Home/Pricing/ProfessionLanding) — are already token-driven, soft-shadowed, and accessible. They are the model.

The debt is **not "bad design" — it's an unfinished rebrand and an un-unified foundation**:

1. **Rebrand lag (orange → blue).** The brand flipped to blue `#0079C1`, but dead-orange survives as hover states, gradient legs, peach tints, an SVG chevron, and global focus rings. This is the single most visible, lowest-risk thing to fix.
2. **Four parallel styling systems** with no single source of truth (Tailwind tokens / `fb-*` brutalist CSS / mixed `design-tokens.css` / ~1,800 inline hex). Two referenced CSS vars are undefined and silently break input radius + card shadow.
3. **Three good-but-siloed component libraries** that should converge.
4. **~36 bespoke marketing pages** each hand-built (SEO-intentional, but a consistency/QA scale risk).

Plus two **non-design, must-escalate** issues on conversion surfaces (fabricated social proof; dead-brand copy).

---

## 1. Health by surface

| Surface | Grade | State |
|---|---|---|
| **Admin / superadmin** | A− | One `AdminLayout` shell, config-driven `StackSidebar`, shared `admin/ui/*` kit (~90 pages), scoped `adm-*` light/dark tokens. `fb-*` effectively absent. Debt = inline hex + dead-orange hover in the shared `Btn`. |
| **Host dashboard** | A− | Clean `.dash`-scoped `dashboard/ui/*` library (`DataTable`, `StatCard`, `Form`, `Card`, `Button`, `Skeleton`, `ErrorState`…), soft `--elev-*` shadows, strong a11y sidebar. Debt = orange Select chevron, a couple of `fb-card`/hex leaks. |
| **Guest booking funnel** | B+ | Well-engineered (per-host theming, DOMPurify, CLS-aware, labour-illusion finalize, smart payment-error split). Debt = dead-orange hovers in the funnel, stale cream backgrounds, theme-contrast gap, and two trust issues. |
| **Marketing — flagship** | A− | Home, Pricing, ProfessionLanding, About = token-clean soft-SaaS; strong SEO/JSON-LD; reusable `PricingCards`, pure-CSS mocks. |
| **Marketing — bespoke** | C+ | ~36 hand-built feature/for/compare pages, each its own mini design; rhythm/radius/shadow drift; `Contact` still on `fb-*`. |
| **Onboarding** | C+ | A separate pre-`.dash` styling world (`fb-input` + `btn-*`), two different progress indicators, unlabeled inputs. |
| **Shared token layer** | C | The root cause: conflicts, undefined vars, orange bleed, no semantic/neutral/elevation/z scales, unlayered `fb-*` cascade trap. |

---

## 2. Cross-cutting findings (the themes that matter most)

### 2.1 Rebrand lag — dead orange still live (brand bug, funnel-wide)
Verified orange remnants (grepped): hover shades `#e54900` (admin `Btn.jsx:6`, `AdminEmptyState.jsx`, `AdminBookings`, `AdminServices`, ColdCall*), `#e04800` (`ServiceForm.jsx:315`), `#e64800`/`#e04800` (`ManageBooking`, `CustomerBookings`), `#a83400` (`Explore.jsx`, `guest/ServiceCard.jsx`); gradient legs `#ff8244` (`Navbar.jsx:418`), `#ff7a3c` (`CustomerBookings` hero, `Loyalty`); peach tints `#FFF8F4`/`#FFE4D1` (`BotWidget`); the **orange Select-chevron SVG `%23FE5100` in the shared `dashboard/ui/Form.jsx:39`** (every dashboard dropdown); and global `rgba(254,81,0,…)` focus/selection/`.btn-primary`-shadow in `index.css` (286/292/308/348). **Every primary blue button/field in the guest funnel, admin, and dashboard flashes dead orange on hover or shows an orange arrow.** → Phase A.

### 2.2 Four styling systems, no source of truth
- Tailwind tokens (config) vs `design-tokens.css` vars **drift**: `primary-dark` (CSS var = primary, not #005E99), `secondary` (amber vs purple), `muted` (two greys).
- **Two undefined vars render broken:** `--radius-control` (`index.css:270`) → inputs lose radius; `--shadow-soft` (`index.css:327`) → `.page-card` loses shadow.
- **`fb-*` cascade trap:** `index.css` `@import`s the 5 `fb-*` CSS files **unlayered, before `@tailwind`**, so brutalist hard shadows beat Tailwind utilities *and* the soft redefinitions in `@layer components`. Any `shadow-[…]`/`rounded-[…]` on an `fb-*` element loses.
- **Missing scales:** no semantic `warning`/`info` (global), no neutral/text ramp, no focus-ring token, no soft-elevation scale, no z-index scale (ad-hoc `z-50`…`z-[9999]` collide).
- **~1,800 hardcoded hex across ~205 files** (Navbar 49, BotWidget 49, SuperDashboard 60, AnalyticsFeature 81, PitchDeck 101) — mostly right-color-wrong-source blue literals → drift.

### 2.3 Good components, siloed
`dashboard/ui/*` (`.dash`) and `admin/ui/*` (`adm-*`) are two separate, high-quality, token-driven libraries; marketing uses a third CSS-var template system. They don't share a `Button`/`Input`/`Card`/`Modal`. Converge into one `components/ui/` over time.

### 2.4 Brutalist remnants (fb-*)
~330 `fb-*` uses across ~65 files — ~90% in admin/sales + onboarding + a few public pages (`Contact`, `ServicesDirectory`, `ProfessionServices` still carry `border-2 border-[#191919]` + `shadow-[4px_4px_0]`). Hard shadows + 3px ink borders + stale amber/green ring tokens. Migrate off (don't restyle — the cascade trap defeats in-place restyle).

### 2.5 Stale warm-cream canvas
Orange-era page backgrounds `#f7f5ef` / `#fdfcf9` / `#fffaf3` across guest funnel, GuestLayout, DashboardLayout, Help/Legal — now clashing under blue. Replace with `canvas #F8FAFC`.

---

## 3. Master issue register (prioritized, de-duplicated)

**P0 — none.** Nothing is broken/unrenderable.

**P1 — brand-damaging or trust/correctness (fix first):**

| # | Where | Problem | Fix | Risk |
|---|---|---|---|---|
| P1-1 | shared: `admin/ui/Btn.jsx:6`, `admin/AdminEmptyState.jsx:45/51`, `dashboard/ui/Form.jsx:39` (chevron), `index.css:286/292/308/348` | Dead-orange hovers + orange Select chevron + orange focus/selection rings in **shared code** → orange flashes app-wide | → blue tokens (`primary-cta`/`primary-dark`/focus-ring) | low |
| P1-2 | guest funnel: `Explore.jsx`, `guest/ServiceCard.jsx`, `ManageBooking.jsx`, `CustomerBookings.jsx`, `Loyalty.jsx`, `Navbar.jsx:418` | Blue CTAs/heroes flash/fade to dead orange on the conversion path | hover→`primary-cta`; gradient legs→blue/`c-cyan` | low |
| P1-3 | `ServiceDetail.jsx:453-469,583` | **Fabricated social proof** ("{2–5} people booked in 3 days" = hash of service id) + unconditional "Verified host" row on a payment page | drive from real `total_bookings`/`is_verified` or remove | **escalate — trust/consumer-law** |
| P1-4 | `themeUtils.js:28-31` (`getContrastColor`) | Contrast picker is a luminance heuristic, not 4.5:1; Studio allows arbitrary host hex → light host color used as text-on-white is unreadable | add real WCAG-ratio clamp; darken accent for text uses | a11y failure on light themes |
| P1-5 | marketing CTAs: `about/HeroV2.jsx:52`, `careers/CareersHero.jsx`, `CareersCta.jsx`, `features/FeaturePage.jsx:80`, `JobDetail.jsx:110` | Brutalist `shadow-[var(--shadow-hard-1)]` on primary CTAs (forbidden hard shadow) | soft token shadow / none | low |
| P1-6 | `Contact.jsx:47-95` | Only marketing body still on `fb-*` (`fb-input` ×4 render hard shadows) + raw-palette success state | rebuild with token field styles | med (form behavior) |

**P2 — consistency / brand coherence / notable UX:**

| # | Where | Problem | Fix |
|---|---|---|---|
| P2-1 | guest/dashboard/help: `#f7f5ef`/`#fdfcf9`/`#fffaf3` | Stale warm-cream canvas under blue brand | → `bg-canvas` |
| P2-2 | onboarding: `CategoryStep/PreviewStep/PlansStep/SlugClaim` | Parallel styling world (`fb-input`+`btn-*`), two progress indicators, unlabeled inputs | migrate to `dashboard/ui` primitives; one stepper |
| P2-3 | `ProductPurchase.jsx:108-127,609` | OTP sent to WhatsApp but UI says "Check your email" | fix copy to WhatsApp + masked phone |
| P2-4 | `ServiceDetail.jsx:683` | old-brand "Pro" ad copy + non-token palette; 4 ad cards clutter a conversion page | rebrand to Meeticulous; cut to 1 ad slot |
| P2-5 | `ServiceBooking.jsx:1506` | Platform-fee tooltip hover-only (no focus/tap) — invisible to keyboard+mobile | focusable click-toggle (reuse ServiceDetail's) |
| P2-6 | `Bookings.jsx:648` | Hand-rolls desktop table instead of shared `DataTable` | refactor to `DataTable` |
| P2-7 | bespoke marketing (features/for/compare, ~36 pages) | Each re-implements hero/FAQ/testimonials/CTA; 245 arbitrary radii across 31 files; 3 testimonial UIs | extract shared section primitives (SectionHeader/FaqAccordion/FinalCta) the bespoke pages opt into |
| P2-8 | admin: `Table.jsx:22`, drawers/modals | Shared table rows mouse-only (no keyboard); no shared `Modal`/`Drawer` (focus-trap re-implemented) | add row keyboard handler; extract `AdminModal`/`Drawer` |
| P2-9 | `Help.jsx` | Placeholder/TODO content live; hardcoded support contacts | wire to settings; tokenize |

**P3 — hygiene / future-drift (opportunistic):** ~1,800 inline hex → tokens (whole app); `StatusChip` vs `StatusBadge` duplication; `ConsoleSidebar` ACCENT raw hex; `Availability` missing load/error state; `window.confirm`/`prompt` in CustomerBookings → Modal; calendar-day `aria-label`s; palette name/hex mismatches in `themeUtils` ("Purple" = blue); Pagination "Sloooth" wordmark + founder-palette; pitch-deck/presentation brutalist (internal — confirm out of sitemap); `c-*` accents near-dead (22 uses) — adopt in charts/chips or delete.

---

## 4. What to KEEP (do not regress)

- **`dashboard/ui/*`** scoped under `.dash` with `--elev-*` soft shadows — the backbone; extend it.
- **`admin/ui/*` + `AdminLayout` + `StackSidebar`** (config-driven, permission-filtered, strong a11y) — the admin standard.
- **Per-host theming engine** (`themeUtils.applyProfileTheme` → `--profile-accent*`) — legitimate dynamic color (fix only the contrast clamp).
- **Booking-flow resilience** (slot skeletons, auto-advance, labour-illusion finalize, payment server-reject-vs-network split with "don't pay again").
- **Marketing CSS-var template architecture** (`--lp-*`/`--fp-accent`), `PricingCards`, pure-CSS product mocks, and the **SEO/JSON-LD discipline** (no fake aggregateRating).
- **`InviteLanding.jsx`** — reference implementation of the new look (tokens, soft shadows, correct CTA).
- **Security/perf/a11y hygiene** already present: `safeUrl`, DOMPurify, `fetchpriority`, reduced-motion guards, aria on nav/tooltips/carousels.

---

## 5. Decisions needed from the founder

1. **P1-3 fabricated social proof** on the payment page — remove, or wire to real data? (Trust/legal; design can't decide this.)
2. **Dead-brand cleanup** (old-brand social handles in Footer, old-brand "Pro" ad copy, old-brand wordmarks) — in scope for this initiative or a separate rebrand ticket?
3. **Bespoke marketing pages** (~36) — keep per-page bespoke designs (SEO value) and only add shared primitives, or consolidate harder? (Default recommendation: keep + add opt-in primitives.)

→ Prioritized remediation is sequenced in `06-roadmap.md`. Phase A tackles the token foundation + the shared-code dead-orange (P1-1, parts of P1-2/P1-5).
