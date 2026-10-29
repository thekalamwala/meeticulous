# Page-by-Page Redesign Matrix — Meeticulous

_Deliverable 6. For each major route/group: current state, problems, proposed direction, components to reuse vs modify/create, required tokens, responsive + a11y notes, expected UX gain, and priority. Grouped by surface; templated families treated as one._

> Legend — Priority: **P1** brand/trust/conversion · **P2** consistency/UX · **P3** hygiene. Most pages need *refinement*, not redesign (per the brief). Reuse > create everywhere.

---

## Marketing

### Home · Pricing  — _priority P3 (already strong)_
- **Current:** token-clean soft-SaaS; reuse `PricingCards` + `Seo`/JSON-LD. **Problems:** minor hardcoded blue hex. **Proposed:** keep layout; swap hex→tokens; adopt one reserved `action` CTA + tighter hero tracking per `03`/`02`. **Reuse:** PricingCards, pure-CSS mock, section scaffold. **Create:** none. **Tokens:** action, focus-ring, heading tracking. **Responsive/a11y:** already good. **Gain:** consistency + stronger CTA.

### Bespoke feature/for/compare (~36 pages) — _P2_
- **Current:** `FeaturePage`/`ProfessionLanding`/compare templates + ~36 bespoke per-page designs driving color via `--lp-*`/`--fp-accent` CSS vars (SEO-intentional). **Problems:** each re-implements hero/FAQ/testimonials/CTA → rhythm/radius/shadow drift (245 arbitrary radii/31 files; 3 testimonial UIs); brutalist CTA shadows (HeroV2/Careers/FeaturePage/JobDetail). **Proposed:** keep per-page palette-via-CSS-var architecture; extract **opt-in shared section primitives** — `SectionHeader`, `FaqAccordion`, `FinalCta`, one `Testimonials` — the bespoke pages compose. Normalize radii to 4–6px (avatars→`rounded-full`). Replace hard CTA shadows. **Reuse:** CSS-var template system, pure-CSS mocks, Seo. **Create:** 3–4 section primitives. **Tokens:** radius, elevation, action. **Responsive/a11y:** audit focus rings per bespoke page. **Gain:** consistency + far smaller QA/maintenance surface; SEO distinctiveness preserved.

### Contact — _P1_
- **Current:** only marketing body still on `fb-*` (`fb-input`×4 → hard shadows), raw-palette success. **Proposed:** rebuild form on `dashboard/ui/Form` + token success (`success-bg`/`-fg`). **Reuse:** Form primitives, Button. **Tokens:** field, semantic. **Gain:** consistency + accessible form.

### Help/HelpDocs · About · Careers · Blog · Explore/Search — _P2/P3_
- **Help:** remove placeholder/TODO content, wire support contacts to settings, tokenize. **About/Careers:** replace brutalist CTA shadows; tokenize; keep components. **Blog:** tokenize grays; keep the (good) card art + crawlable pager + states. **Explore/Search:** fix orange hover (P1-2), keep the excellent data-fetch hygiene (AbortController/reqId/empty/noindex). **Create:** none. **Gain:** coherence, no dead content.

---

## Guest booking & profile

### HostProfile (`/:username`) — _P2_
- **Current:** sticky profile card + service/product grid; per-host theme via `--profile-accent`; inline card components; local grey token obj. **Problems:** theme-contrast gap for light host colors (P1-4); inline hex. **Proposed:** keep layout + theming; apply contrast clamp; tokenize chrome; use canonical Card. **Reuse:** theming engine, Card. **Tokens:** neutral ramp, focus-ring. **a11y:** contrast fix. **Gain:** readable on any host theme.

### ServiceDetail (`/:username/:slug`) — _P1_
- **Current:** dark hero + 6 tabs + sticky BookingCard + mobile CTA. **Problems:** **fabricated social proof + unconditional "Verified host" (P1-3 — escalate)**; "Book A Sloth Pro" ad copy + 4 ad cards (P2-4); inline hex. **Proposed:** drive proof from real data or remove; rebrand/cut ads to 1; tokenize; keep tabs + sticky card + the good click-toggle fee tooltip. **Reuse:** tooltip pattern, BookingCard. **Gain:** trust + conversion focus.

### ServiceBooking (`/:username/booking/:slug`) — _P1 (conversion-critical)_
- **Current:** two-col sticky-profile + step engine (time→details→otp→payment→confirmed); strong resilience. **Problems:** orange hovers (P1-2); stale cream bg (P2-1); fee tooltip hover-only (P2-5); calendar-day a11y labels (P3). **Proposed:** fix hovers→blue; bg→`canvas`; fee tooltip→focusable toggle; add day `aria-label`s. **Keep everything else** (skeletons, auto-advance, labour-illusion, payment-error split). **Reuse:** theming, step card. **Tokens:** action (pay CTA), canvas, focus. **Gain:** no brand flash + keyboard/mobile-safe fee transparency on the money path.

### ProductPurchase · ManageBooking · ReviewPage · Guest space (`/user/*`) — _P2_
- **ProductPurchase:** fix OTP copy (WhatsApp not email, P2-3); share `OtpBoxes`+floating labels with ServiceBooking; fix orange hover. **ManageBooking:** fix orange hover; keep token-auth + non-refundable disclosure. **Guest space (CustomerBookings/Profile/Reviews):** `window.confirm/prompt`→Modal (P3); hero gradient orange leg→blue (P1-2); hex→tokens. **Reuse:** shared OTP, Modal, StatusBadge. **Gain:** consistent, polished checkout + guest area.

---

## Host dashboard & onboarding

### Shell (`DashboardLayout` + `ConsoleSidebar`) — _P2/P3_
- **Current:** strong — rail+panel sidebar, plan-lock upsell, attention badges, excellent a11y. **Problems:** canvas hardcoded `#f7f5ef` (×3); ACCENT raw hex. **Proposed:** expose `--dash-canvas` as class / `bg-canvas`; map ACCENT→`c-*`. **Keep** structure + NotifBell template. **Gain:** token-correct chrome.

### Core data pages (Dashboard, Bookings, Transactions, Earnings, Payouts, Availability) — _P2_
- **Current:** mostly on `dashboard/ui/*` — good. **Problems:** `Bookings` hand-rolls its table (P2-6); orange Select chevron app-wide (P1-1); `fb-card` around EarningsTrendChart; `Availability` lacks load/error state (P3); dashboard overview uses local `Stat` not `StatCard`. **Proposed:** Bookings→`DataTable`; chevron→blue; chart→`Card`; add Availability skeleton/error; overview→`StatCard`. **Reuse:** DataTable/StatCard/Skeleton/ErrorState. **Gain:** consistency + no silent failures + no orange.

### Services CRUD (`services/*`) — _P2_
- **Current:** uses `Form`. **Problems:** `ServiceForm` orange hover + `#0079C1` hex (P1/P2); public `ServicesDirectory`/`ProfessionServices` still brutalist (`border-2 #191919` + hard shadow, P3). **Proposed:** hover→blue, hex→tokens; re-skin directory pages to soft/token. **Gain:** consistency.

### Onboarding (`onboarding/*`) — _P2_
- **Current:** separate pre-`.dash` world (`fb-input`+`btn-*`), two progress indicators, unlabeled inputs. **Proposed:** migrate inputs/buttons/cards to `dashboard/ui`; standardize on `OnboardingStepper`; add labels. **Reuse:** Form/Button/Card, stepper. **Create:** none. **a11y:** labels. **Gain:** one continuous host journey before/after go-live.

### KYC (`kyc/*`) — _P3_
- **Current:** clean status state-machine on `dashboard/ui`. **Proposed:** keep; tokenize any stray hex. **Gain:** minimal.

---

## Admin / superadmin — _mostly P2/P3 (internal)_

### Shell + core pages
- **Current:** best-in-app — `AdminLayout` + `StackSidebar` + `admin/ui/*` + `adm-*` tokens. **Problems:** dead-orange hover in shared `Btn`/`AdminEmptyState` (P1-1); 6 residual orange literals; row keyboard a11y in shared `Table` (P2-8); 3 empty-state idioms; no shared `Modal`/`Drawer`; ~300 inline hex (mostly status/chart). **Proposed:** fix shared orange (Phase A); add Table row keyboard; extract `AdminModal`/`Drawer`; one `EmptyState`; extract a shared status/chart palette module. **Keep** the shell + kit + nav. **Gain:** the last visible dead-brand gone + a11y + less duplication.

### Clusters (sales CRM ~33, finance/GST ~13, bolt ~7, SEO ~7, 360 ×4)
- **Current:** inherit the shell; sales/cold-call use nested `Outlet` sub-layouts (good). **Problems:** hand-rolled headers (ColdCallingLayout), heaviest inline hex, `fb-input` forms. **Proposed:** route headers through `PageHeader`; add `Input`/`Select` wrappers over `fb-input` (or rename `adm-input`); batch hex→palette module. **Priority:** low (internal). **Gain:** consistency, lower drift.

---

## Priority rollup
- **P1 (brand/trust/conversion):** Contact rebuild · ServiceDetail trust+ads · ServiceBooking/guest orange+canvas · shared-code orange (admin/dashboard) · theme contrast clamp · marketing brutalist CTA shadows.
- **P2:** onboarding migration · bespoke-marketing section primitives · Bookings→DataTable · admin Modal/Drawer + Table a11y · tokenize chrome · OTP copy/shared OTP.
- **P3:** inline-hex sweep · state gaps (Availability) · status-component consolidation · dead-brand wordmarks · pitch-deck gating.

→ Sequenced in `06-roadmap.md`.
