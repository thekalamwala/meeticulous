# Topmate LP Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/lp/topmate-vs-meeticulous` to look like Topmate's own homepage (warm cream, playful, rounded floating cards) while the copy sells against Topmate; switch the CTA to one-click Google; fix the consent-banner leak onto /lp.

**Architecture:** Frontend-only. One page file restyled (logic constants kept verbatim), one shared `LeadForm` gains a `google-only` mode, `ConsentBanner` gains a `slim` variant gated by route in `App.jsx`. Logic is TDD'd (LeadForm mode, ConsentBanner variant); the visual page rebuild is verified by a render smoke test + live preview.

**Tech Stack:** React 18 + Vite, Tailwind, react-router-dom v6, Vitest + @testing-library/react, lucide-react icons.

**Reference spec:** `docs/superpowers/specs/2026-06-26-topmate-lp-rebuild-design.md`

---

## File Structure

- `client/src/pages/lp/_shared/LeadForm.jsx` — **modify**: add `mode` prop (`"email"` default | `"google-only"`).
- `client/src/components/common/ConsentBanner.jsx` — **modify**: add `variant` prop (`"full"` default | `"slim"`).
- `client/src/App.jsx` — **modify**: pass `variant` to `<ConsentBanner />` based on `/lp` route (line ~183).
- `client/src/pages/lp/TopmateVsMeeticulous.jsx` — **rewrite**: Topmate-style restyle, keep data/logic constants, use `LeadForm mode="google-only"`.
- `client/src/pages/__tests__/LeadForm.test.jsx` — **create**: mode behaviour.
- `client/src/pages/__tests__/ConsentBanner.test.jsx` — **create**: variant behaviour.
- `client/src/pages/__tests__/TopmateLp.test.jsx` — **create**: page smoke test.

**Reuse:** `HERO_FACES` from `client/src/components/home/images` for the social-proof avatar strip.

---

## Visual system (apply throughout the page rebuild)

Topmate palette weaponised. Use literal Tailwind arbitrary values (no new config needed):

| Purpose | Class / value |
|---|---|
| Page canvas | `bg-[#FFF6EF]` |
| Peach band | `bg-[#FFE4D6]` |
| Win green (BAS wins, checks) | `text-[#009D28]` / `bg-[#009D28]/10` |
| Loss red (Topmate's own red; cuts, X) | `text-[#E44332]` / `bg-[#E44332]/10` |
| CTA | existing `bg-primary` (BAS orange #FE5100) — only CTA color |
| Cards | `rounded-[1.75rem]` to `rounded-[2rem]`, `shadow-[0_20px_60px_-25px_rgba(26,26,26,0.25)]` |
| Headlines | existing `font-heading`, oversized, tight leading |

Keep `text-ink`, `bg-canvas` tokens where neutral. Emoji allowed in badges/headers. Respect existing reduced-motion conventions (no autoplay motion required).

---

## Task 1: LeadForm `google-only` mode

**Files:**
- Modify: `client/src/pages/lp/_shared/LeadForm.jsx`
- Test: `client/src/pages/__tests__/LeadForm.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/pages/__tests__/LeadForm.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeadForm from "../lp/_shared/LeadForm";

const startVendorGoogleAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ startVendorGoogleAuth }),
}));
vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
const track = vi.fn();
vi.mock("../../services/analytics", () => ({
  analytics: { track },
  EVENTS: { LEAD_CAPTURED: "LEAD_CAPTURED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));

beforeEach(() => {
  startVendorGoogleAuth.mockReset();
  track.mockReset();
});

describe("LeadForm google-only mode", () => {
  it("renders no email field and a single Google CTA", () => {
    render(<LeadForm slug="topmate-vs-meeticulous" slot="hero" mode="google-only" ctaLabel="Continue with Google" />);
    expect(screen.queryByPlaceholderText("you@email.com")).toBeNull();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
  });

  it("clicking the CTA fires LP_CTA_CLICKED with_email:false and starts Google signup", () => {
    render(<LeadForm slug="topmate-vs-meeticulous" slot="hero" mode="google-only" ctaLabel="Continue with Google" />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(track).toHaveBeenCalledWith("LP_CTA_CLICKED", expect.objectContaining({ slug: "topmate-vs-meeticulous", slot: "hero", with_email: false }));
    expect(startVendorGoogleAuth).toHaveBeenCalledWith("signup");
  });

  it("default (email) mode still renders the email field", () => {
    render(<LeadForm slug="x" slot="hero" />);
    expect(screen.getByPlaceholderText("you@email.com")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/__tests__/LeadForm.test.jsx`
Expected: FAIL — google-only renders the email field (no `mode` support yet).

- [ ] **Step 3: Implement the `mode` prop**

In `client/src/pages/lp/_shared/LeadForm.jsx`, add `mode = "email"` to the destructured props (after `ctaLabel`). Immediately before the existing `return (`, add a branch:

```jsx
  if (mode === "google-only") {
    return (
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => handoff(false)}
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-8px_rgba(254,81,0,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-dark disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {busy ? "Opening…" : ctaLabel}
          {!busy && <ArrowRight size={15} />}
        </button>
        <p className={`mt-2.5 text-center text-xs ${dark ? "text-white/60" : "text-neutral-500"}`}>
          No card · Free plan available · Cancel anytime
        </p>
      </div>
    );
  }
```

`handoff`, `busy`, `dark`, `ctaLabel`, `ArrowRight` are already in scope. Leave the existing email-mode `return` untouched below it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/__tests__/LeadForm.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/lp/_shared/LeadForm.jsx client/src/pages/__tests__/LeadForm.test.jsx
git commit -m "feat(lp): add google-only mode to shared LeadForm"
```

---

## Task 2: ConsentBanner `slim` variant + route gating

**Files:**
- Modify: `client/src/components/common/ConsentBanner.jsx`
- Modify: `client/src/App.jsx` (~line 183)
- Test: `client/src/pages/__tests__/ConsentBanner.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/pages/__tests__/ConsentBanner.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsentBanner from "../../components/common/ConsentBanner";

const setConsent = vi.fn();
let decided = false;
vi.mock("../../services/analytics", () => ({
  analytics: { hasDecided: () => decided, setConsent },
}));

beforeEach(() => { decided = false; setConsent.mockReset(); });

describe("ConsentBanner", () => {
  it("slim variant renders no cookie image", () => {
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: /agree/i })).toBeTruthy();
  });

  it("full variant (default) renders the cookie image", () => {
    const { container } = render(<ConsentBanner />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("renders nothing once decided", () => {
    decided = true;
    const { container } = render(<ConsentBanner variant="slim" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/__tests__/ConsentBanner.test.jsx`
Expected: FAIL — slim variant still renders the `<img>` (no variant support yet).

- [ ] **Step 3: Add the `variant` prop and slim render**

In `client/src/components/common/ConsentBanner.jsx`, change the signature to `export default function ConsentBanner({ variant = "full" }) {`. Keep `decided`/`choose` logic. After the `if (decided) return null;` guard, add the slim branch before the existing full-card return:

```jsx
  if (variant === "slim") {
    return (
      <div
        role="dialog"
        aria-label="Cookie and analytics consent"
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-black/10 bg-white/95 px-4 py-2.5 text-xs text-[#252525] shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur"
      >
        <span>We use cookies for analytics &amp; marketing. Essential analytics always run.</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => choose(true)} className="rounded-full bg-[#009D28] px-3 py-1 font-semibold text-white">Agree</button>
          <button type="button" onClick={() => choose(false)} className="rounded-full border border-black/20 px-3 py-1 font-medium">Decline</button>
          <a href="/privacy" className="underline-offset-2 hover:underline">Learn more</a>
        </span>
      </div>
    );
  }
```

Leave the existing full-card return below unchanged.

- [ ] **Step 4: Gate the variant by route in App.jsx**

In `client/src/App.jsx`, the component already computes route flags from `location.pathname` (see `hideNavbar` ~line 169-175). Replace the existing `<ConsentBanner />` (line ~183) with:

```jsx
      <ConsentBanner variant={location.pathname.startsWith('/lp') ? 'slim' : 'full'} />
```

(`location` is already in scope — it's used by `hideNavbar`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/__tests__/ConsentBanner.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/common/ConsentBanner.jsx client/src/App.jsx client/src/pages/__tests__/ConsentBanner.test.jsx
git commit -m "fix(lp): slim consent bar on /lp, stop giant banner covering CTAs"
```

---

## Task 3: Rebuild the Topmate LP page (smoke test first)

**Files:**
- Rewrite: `client/src/pages/lp/TopmateVsMeeticulous.jsx`
- Test: `client/src/pages/__tests__/TopmateLp.test.jsx`

**Keep verbatim** from the current file (logic, do not change): `SLUG`, `PRO_MONTHLY`, `PRO_ANNUAL`, `TM_RATE_LO`, `TM_RATE_HI`, `TM_CLAIM_AS_OF`, `inr`, `TRUST`, `COMPARE`, `Cell`, `SavingsCalc`, `STEPS`, `FAQ`, the `useUtm`/`useDocumentMeta`/`analytics` mount effect (`page` + `LP_VIEWED`). Only markup/styling and the LeadForm usage change.

- [ ] **Step 1: Write the failing smoke test**

```jsx
// client/src/pages/__tests__/TopmateLp.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TopmateVsMeeticulous from "../lp/TopmateVsMeeticulous";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ startVendorGoogleAuth: vi.fn() }) }));
vi.mock("../../hooks/useUtm", () => ({ default: () => ({}) }));
vi.mock("../../hooks/useDocumentMeta", () => ({ default: () => {} }));
vi.mock("../../services/analytics", () => ({
  analytics: { page: vi.fn(), track: vi.fn() },
  EVENTS: { LP_VIEWED: "LP_VIEWED", LEAD_CAPTURED: "LEAD_CAPTURED", LP_CTA_CLICKED: "LP_CTA_CLICKED" },
}));
vi.mock("../../components/home/images", () => ({ HERO_FACES: [] }));

const renderPage = () => render(<MemoryRouter><TopmateVsMeeticulous /></MemoryRouter>);

describe("TopmateVsMeeticulous", () => {
  it("renders the anti-Topmate hero and comparison", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getAllByText(/topmate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Meeticulous vs Topmate/i)).toBeTruthy();
  });

  it("uses one-click Google CTAs and no email field", () => {
    renderPage();
    expect(screen.queryByPlaceholderText("you@email.com")).toBeNull();
    expect(screen.getAllByRole("button", { name: /continue with google/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the date-stamped commission disclaimer", () => {
    renderPage();
    expect(screen.getByText(new RegExp(`as of`, "i"))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/__tests__/TopmateLp.test.jsx`
Expected: FAIL — current page renders the email field (`you@email.com`) and has no "Continue with Google" button label.

- [ ] **Step 3: Rewrite the page markup (Topmate skin, anti-Topmate copy)**

Keep all imports plus add `import { HERO_FACES } from "../../components/home/images";`. Keep the constants/helpers block verbatim. Replace the JSX `return (...)` with the Topmate-styled structure below. Apply the **Visual system** table throughout.

Concrete copy + structure (use these strings):

- **Header:** wordmark "Meeticulous" + pill "0% commission"; right CTA `<a href="#start">` "Start free".
- **Hero badge:** `Coming from Topmate? 👋` (rounded white pill, emoji).
- **Hero H1:** `Your storefront.` then accent line `Without the 30% tax.` (accent line in `text-primary`).
- **Hero sub:** `Meeticulous is the 0% commission alternative to Topmate. Flat ₹499/month — keep every rupee your clients pay, instead of losing up to 30% on every booking.`
- **Hero CTA:** `<div id="start" className="scroll-mt-24">` containing `<LeadForm slug={SLUG} slot="hero" mode="google-only" ctaLabel="Continue with Google" />`.
- **Social proof strip:** map `HERO_FACES` into overlapping circular avatars (`-space-x-3`, `h-9 w-9 rounded-full ring-2 ring-white object-cover`); if `HERO_FACES` is empty render nothing. Beside it: `Loved by creators who keep 100% of what they earn.` (no invented numeric counts).
- **Hero mockup (the judo visual):** two stacked rounded cards styled like Topmate booking cards. Card A (front, `bg-white`, green accent): title `Meeticulous`, row `₹1,000 booking`, big `You keep ₹1,000` in `text-[#009D28]`, small `0% commission`. Card B (behind, slightly rotated/`opacity-70`, `bg-[#FFE4D6]`, red accent): title `Topmate`, row `₹1,000 booking`, `You keep ₹700` in `text-[#E44332]`, small `–30% commission`. Wrap so it stacks below the hero copy on mobile, beside on `lg:`.
- **Trust strip:** map `TRUST` (icons) as before, restyled.
- **The math section:** peach band `bg-[#FFE4D6]`. Eyebrow `THE COMMISSION MATH`, H2 `See what Topmate quietly takes.` Render `<SavingsCalc />`. In `SavingsCalc`, restyle the two result blocks: Topmate block → `bg-[#E44332]/10` with `text-[#E44332]` label; BAS block → `bg-[#009D28]/10` with `text-[#009D28]` label. Keep numbers/logic. Keep the disclaimer line `Topmate commission band of 10–30% as of {TM_CLAIM_AS_OF}...`.
- **Comparison table:** H2 `Meeticulous vs Topmate`. Keep `COMPARE` + `Cell`; in `Cell`, good check → `text-[#009D28]`, bad X → `text-[#E44332]`. Keep `<caption className="sr-only">`, `scope` attrs.
- **Switch in 2 minutes:** keep `STEPS`, numbered Topmate blocks; rounded white icon tiles.
- **FAQ:** keep `FAQ` + native `<details>` accordion, restyled rounded card.
- **Final CTA:** dark rounded block (`bg-ink`), H2 `Stop paying commission on your own work.`, sub line, `<LeadForm slug={SLUG} slot="final" mode="google-only" dark ctaLabel="Continue with Google" />`.
- **Footer:** keep existing © + Privacy/Help/email links.

All sticky-header/no-exit-links and `min-h-dvh overflow-x-hidden` page-wrapper conventions from the current file are preserved.

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `cd client && npx vitest run src/pages/__tests__/TopmateLp.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/lp/TopmateVsMeeticulous.jsx client/src/pages/__tests__/TopmateLp.test.jsx
git commit -m "feat(lp): rebuild Topmate LP in Topmate's own style, copy turned against them"
```

---

## Task 4: Live preview verification

**Files:** none (verification only).

- [ ] **Step 1: Start dev server**

Use preview_start (name `client`, port 5173). Navigate to `/lp/topmate-vs-meeticulous`.

- [ ] **Step 2: Desktop check**

Screenshot. Confirm: warm cream canvas; bold black hero with orange accent line; floating dual booking-card mockup (green ₹1,000 vs red ₹700); one-click Google CTA (no email field); **slim consent bar at bottom — no giant girl-card covering content**; green checks / red X in comparison.

- [ ] **Step 3: Mobile check (375px)**

preview_resize preset `mobile`. Confirm no horizontal overflow; hero stacks; mockup cards stack; slim consent bar fits one/two lines.

- [ ] **Step 4: Console check**

preview_console_logs level `error`. Expected: no errors.

- [ ] **Step 5: Click check**

preview_click the hero "Continue with Google" button; confirm it attempts the Google auth handoff (network/console), not an email validation path.

---

## Task 5: Full suite + build + finish

**Files:** none.

- [ ] **Step 1: Run client test suite**

Run: `cd client && npm test`
Expected: all green (existing + 3 new test files).

- [ ] **Step 2: Production build**

Run: `cd client && npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Commit any incidental fixes**, then finish the branch via superpowers:finishing-a-development-branch (PR to main).

---

## Self-Review

- **Spec coverage:** generic-design fix → Task 3 (visual system + sections); lead-flow fix → Task 1 (google-only) + Task 3 (page uses it); consent leak → Task 2; Calendly untouched → only Topmate file + shared LeadForm gains opt-in `mode` (default unchanged) + ConsentBanner default `full` unchanged; success criteria (build/test/mobile/a11y/pricing-stamp) → Tasks 4-5. All covered.
- **Placeholder scan:** no TBD/TODO; all code steps contain real code; copy strings are literal.
- **Type consistency:** `mode` prop values `"email"`/`"google-only"` consistent across Task 1 and Task 3; `variant` values `"full"`/`"slim"` consistent across Task 2; `HERO_FACES` import path consistent; analytics event names match existing `EVENTS`.
