# Friendly Brutalism — Design Audit

Date: 2026-06-05

Scope

- Audit of the client-side UI (no functional/server changes).
- Produce component inventory, styling inconsistencies, and a migration plan to a single design system called "Friendly Brutalism".

Executive summary

- Current codebase uses Tailwind + a small global stylesheet (`client/src/index.css`).
- UI components are fragmented: a small `components/common` set exists, but most screens implement page-level markup and ad-hoc styling.
- Visual system leans soft/modern; the requested Friendly Brutalism requires stronger borders, hard shadows, larger spacing, and tactile components.

Inventory — component-like files found (client/src)

- `client/src/components/common`
  - DashboardLayout.jsx
  - BackButton.jsx
  - AdminLayout.jsx
  - Navbar.jsx
  - ImageCropper.jsx
  - ProtectedRoute.jsx

- Pages (high-level screens)
  - AdminLogin.jsx, Availability.jsx, Bookings.jsx, Dashboard.jsx, Earnings.jsx, ForgotPassword.jsx, Home.jsx, HostProfile.jsx, Login.jsx, NotFound.jsx, Payouts.jsx, ProductPurchase.jsx, Products.jsx, ProfileSetup.jsx, ResetPassword.jsx, ServiceBooking.jsx, Services.jsx, Transactions.jsx, UpgradePlan.jsx, UserSignup.jsx, VendorSignup.jsx
  - `client/src/pages/admin/*` (AdminBookings, AdminOverview, AdminServices, AdminSettings, AdminUsers)

- Other UI-relevant files
  - `client/src/App.jsx`, `client/src/main.jsx`
  - `client/src/context/AuthContext.jsx`

Notes

- There are many JSX files that act as composite UI (page-level components) rather than small reusable primitives.
- `guest/` and `host/` component folders are currently empty.
- Global styles live in `client/src/index.css` and Tailwind is enabled.

Styling inconsistencies and design debt (high-level)

- Design tokens:
  - Existing tokens (`--color-primary`, `--radius-card` etc.) differ from requested tokens and naming. Tokens are scattered and inconsistent.
- Radii:
  - Current cards use `--radius-card: 18px` and many controls use `999px` (pills). Friendly Brutalism prescribes structured radii: 12px / 16px / 24px.
- Shadows:
  - Current shadows are soft (large blur). Friendly Brutalism requires hard, offset shadows (e.g., `8px 8px 0 var(--border)`).
- Buttons & controls:
  - Buttons are pill-shaped and rely on soft shadows; need tactile press states (translate + shadow changes) and stronger typography.
- Cards:
  - Card borders are subtle. System requires visible 3px borders and hard shadows.
- Layout & spacing:
  - Many pages use tight spacing. We must increase global spacing scale and whitespace.
- Typography:
  - Primary font is included (Plus Jakarta Sans) but body currently uses Poppins largely. Weight usage should be restricted to 500/600/700/800 and scaled for hierarchy.
- Accessibility:
  - Focus styles exist but are inconsistent and tailored to current primary color only; must ensure all components have clear focus, AA contrast, and keyboard interaction.
- Tailwind usage:
  - Mixed utility styles scattered across pages will hamper consistent migration. We need a small set of utility classes plus component primitives.
- Repetition:
  - Page-level duplication of card/button patterns; these must be replaced by design-system components.

Design-system architecture (high level)

- Tokens: single `:root` token set and a small theme CSS file (variables):
  - Colors: `--bg`, `--surface`, `--text`, `--primary`, `--secondary`, `--accent`, `--success`, `--danger`, `--border`.
  - Radii: `--radius-sm: 12px`, `--radius-md: 16px`, `--radius-lg: 24px`.
  - Spacing scale: `--space-1: 8px`, `--space-2: 16px`, `--space-3: 24px`, `--space-4: 32px`, `--space-5: 48px`.
  - Shadows: `--shadow-hard-1: 6px 6px 0 var(--border)`, `--shadow-hard-2: 8px 8px 0 var(--border)`.
  - Type scale: component sizes and weights mapped to tokens.

- CSS structure
  - `client/src/styles/design-tokens.css` — variables only
  - `client/src/styles/base.css` — resets, typography, spacing, utility helpers
  - `client/src/styles/components/*.css` — Button, Card, Badge, Input, Modal, Tabs, Navbar, Footer, VendorCard, ServiceCard, PricingCard, BookingSidebar, etc.
  - Optionally a small JS wrapper (React) for accessible component behavior (no logic changes to business code).

Component primitives (must implement first)

- Button (primary, secondary, ghost, icon)
- Card (base card with token-driven options)
- Badge (sticker style)
- Input, Textarea, Select
- Modal
- Accordion
- Tabs
- Navbar, Footer
- VendorCard, ServiceCard, PricingCard, BookingSidebar, FAQCard, TestimonialCard, StatsCard, EmptyState, SectionHeader

Migration plan (phased)

1. Audit & tokens (this report) — deliverable: `DESIGN_AUDIT.md` (this file). Priority: critical.
2. Implement global tokens and base styles (`design-tokens.css`, `base.css`). Priority: high.
3. Build primitives library CSS (`components/*.css`) and a small `design-system/index.js` exporting className helpers. Priority: high.
4. Replace global `client/src/index.css` references with imports of tokens + base and remove duplicate rules. Priority: high.
5. Refactor core primitives into `client/src/components/ui/` (Button, Card, Input, Badge). Update a small set of pages to use them as proof-of-concept (Home, ServiceBooking, HostProfile). Priority: medium-high.
6. Systematic migration of remaining pages to use primitives. Priority: medium.
7. Responsive pass: mobile-first tweaks and breakpoints (320/375/768/1024/1440). Priority: medium.
8. Accessibility pass. Ensure ARIA, keyboard nav, focus states. Priority: medium.
9. Performance cleanup: remove dead CSS, consolidate Tailwind usage to only utility helpers. Priority: lower.
10. Documentation and QA. Priority: lower.

Constraints & rules

- No functional code changes. Routes, server, and JS logic must remain untouched.
- All changes limited to CSS and component styling files.
- Keep Tailwind enabled but greatly reduce ad-hoc use in favor of component classes.

Immediate next steps (after approval)

- Implement `client/src/styles/design-tokens.css` and `client/src/styles/base.css`.
- Create `client/src/components/ui/Button.jsx` + `client/src/styles/components/button.css` (pure styling; minimal JSX wrappers allowed for class names and accessibility).

References

- Current global styles: `client/src/index.css`

---

This audit captures the initial inventory and migration approach required to convert the app to the Friendly Brutalism design system. If you approve, I will implement tokens and base styles next, then build the Button and Card primitives and migrate a small set of pages as a proof-of-concept before a full migration.
