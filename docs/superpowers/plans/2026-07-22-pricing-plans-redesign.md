# Pricing Plans Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign pricing on Home + /pricing into a Relume-style 4-plan layout via one shared `PricingCards` component.

**Architecture:** New presentational component `client/src/components/pricing/PricingCards.jsx` owns the billing toggle + renders 3 paid cards (Host+, Studio, Enterprise) in a top row plus a wide Starter card below. All plan copy/accents come from `client/src/data/plans.js` (additive changes only). Home and Pricing drop their inline card markup and render `<PricingCards />`; Pricing keeps its `PLAN_MATRIX` comparison table (now 4 columns).

**Tech Stack:** React 18, Vite, Tailwind, react-router-dom v6, lucide-react, Vitest + @testing-library/react.

## Global Constraints

- Design tokens only: 6px card radius, Plus Jakarta headings (`font-heading`), Poppins body, existing shadows. No new Tailwind color tokens.
- **No emojis.** lucide line icons only; accent = soft glow (box-shadow) on the icon tile.
- No new npm dependencies.
- `plans.js` numeric prices/limits for Starter/Host+/Studio unchanged (DB is authority, v3.55). Only additive fields.
- Brand accents applied via **inline style** using per-plan hex (dynamic → purge-safe), NOT arbitrary Tailwind classes.
- Accent map: Starter `#4AB765` (Sprout) · Host+ `#269CEF` (Sparkles) · Studio `#FE5100` (Rocket, recommended) · Enterprise `#FF4D93` (Building2).
- Client Vitest has **no jest-dom** — use only basic matchers / `.getAttribute()` / `.textContent` (see `docs` memory: jest-dom matcher gap).
- Enterprise card: no price ("Custom"), CTA → `/enterprise` ("Talk to Sales"); other paid CTAs → `ROUTE_START`.
- Verify with `npm run build` before done — a missing lucide icon breaks the whole bundle silently.

---

### Task 1: Extend plan data + Enterprise entry + matrix column

**Files:**
- Modify: `client/src/data/plans.js`
- Test: `client/src/data/__tests__/plans.pricing.test.js` (create)

**Interfaces:**
- Produces:
  - Each plan object gains `accent: string` (hex), `icon: string` (lucide name), `persona: { title: string, blurb: string }`.
  - `export const ENTERPRISE_PLAN` — `{ name, slug:"enterprise", tagline, price:"Custom", cta:{label,to}, accent, icon, intro, features:string[], persona }`.
  - `PLAN_COLUMNS` gains a 4th entry `{ key:"enterprise", name:"Enterprise", slug:"enterprise" }`.
  - Every `PLAN_MATRIX` row gains an `enterprise` cell.

- [ ] **Step 1: Write the failing test**

```js
// client/src/data/__tests__/plans.pricing.test.js
import { describe, it, expect } from "vitest";
import { ALL_PLANS, ENTERPRISE_PLAN, PLAN_COLUMNS, PLAN_MATRIX, STARTER_PLAN, PAID_PLANS } from "../plans";

describe("plans data — redesign fields", () => {
  it("every display plan has accent + icon + persona", () => {
    for (const p of [STARTER_PLAN, ...PAID_PLANS, ENTERPRISE_PLAN]) {
      expect(p.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof p.icon).toBe("string");
      expect(p.persona.title.length).toBeGreaterThan(0);
      expect(p.persona.blurb.length).toBeGreaterThan(0);
    }
  });
  it("ENTERPRISE_PLAN links to /enterprise with custom price", () => {
    expect(ENTERPRISE_PLAN.price).toBe("Custom");
    expect(ENTERPRISE_PLAN.cta.to).toBe("/enterprise");
    expect(ENTERPRISE_PLAN.features.length).toBeGreaterThan(0);
  });
  it("PLAN_COLUMNS has an enterprise column and every matrix row fills it", () => {
    expect(PLAN_COLUMNS.map((c) => c.key)).toContain("enterprise");
    for (const section of PLAN_MATRIX)
      for (const row of section.rows)
        expect(row).toHaveProperty("enterprise");
  });
  it("ALL_PLANS keeps 3 signup tiers (Enterprise is separate)", () => {
    expect(ALL_PLANS.map((p) => p.slug)).toEqual(["starter", "creator", "professional"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/data/__tests__/plans.pricing.test.js`
Expected: FAIL (`ENTERPRISE_PLAN` undefined / missing `accent`).

- [ ] **Step 3: Add accent/icon/persona to existing plans**

In `STARTER_PLAN` add after `badge`:
```js
  accent: "#4AB765",
  icon: "Sprout",
  persona: { title: "Just Starting Out", blurb: "Testing the waters — your first bookings, at zero cost." },
```
In the Host+ object (`slug:"creator"`) add after `yearly`:
```js
  accent: "#269CEF",
  icon: "Sparkles",
  persona: { title: "Solo Creator", blurb: "Booking regularly and want 0% commission + automation." },
```
In the Studio object (`slug:"professional"`) add after `recommended`:
```js
  accent: "#FE5100",
  icon: "Rocket",
  persona: { title: "Growing Studio", blurb: "A full practice — CRM, analytics, unlimited everything." },
```

- [ ] **Step 4: Add ENTERPRISE_PLAN export**

After the `PAID_PLANS` array (before `ALL_PLANS`):
```js
/** Enterprise — no self-serve price; card teases and links to /enterprise. */
export const ENTERPRISE_PLAN = {
  name: "Enterprise",
  slug: "enterprise",
  tagline: "For teams, agencies & multi-location practices.",
  price: "Custom",
  cta: { label: "Talk to Sales", to: "/enterprise" },
  accent: "#FF4D93",
  icon: "Building2",
  intro: "Everything in Studio, plus:",
  features: [
    "SSO & SAML sign-in",
    "Role-based team access",
    "Multi-location & multi-seat",
    "REST API + webhooks",
    "Dedicated SLA & onboarding",
  ],
  persona: { title: "Teams & Agencies", blurb: "Multiple seats, locations and workflows, custom needs." },
};
```

- [ ] **Step 5: Add enterprise column + matrix cells**

Append to `PLAN_COLUMNS`:
```js
  { key: "enterprise", name: "Enterprise", slug: "enterprise" },
```
Add an `enterprise` value to EVERY row in `PLAN_MATRIX`. Enterprise ⩾ Studio on every capability. Exact cells:
```js
// Pricing & commission
{ label: "Price (monthly)", ..., studio: "₹555", enterprise: "Custom" },
{ label: "Price (yearly)",  ..., studio: "₹3,650", enterprise: "Custom" },
{ label: "Commission",      ..., studio: "0%", enterprise: "0%" },
{ label: "Support",         ..., studio: "WhatsApp + Call", enterprise: "Dedicated + SLA" },
// Limits
{ label: "Services",              ..., studio: "Unlimited", enterprise: "Unlimited" },
{ label: "Bookings / year",       ..., studio: "Unlimited", enterprise: "Unlimited" },
{ label: "Digital products",      ..., studio: "Unlimited", enterprise: "Unlimited" },
{ label: "Service categories",    ..., studio: "Unlimited", enterprise: "Unlimited" },
{ label: "Calendar integrations", ..., studio: "2", enterprise: "Unlimited" },
{ label: "Meeting integrations",  ..., studio: "Google & iCal (Planned)", enterprise: "Google, iCal & custom" },
// Booking & scheduling — all true for enterprise
{ ..., studio: true,  enterprise: true },   // Professional booking page
{ ..., studio: true,  enterprise: true },   // Online appointments
{ ..., studio: true,  enterprise: true },   // Offline appointments
{ ..., studio: true,  enterprise: true },   // Payment collection
{ ..., studio: true,  enterprise: true },   // Multiple availability schedules
{ ..., studio: true,  enterprise: true },   // Priority feature access
// Notifications
{ ..., studio: true,       enterprise: true },        // Booking confirmations
{ ..., studio: "Advanced", enterprise: "Advanced" },  // Email & WhatsApp
{ ..., studio: "Unlimited",enterprise: "Unlimited" }, // Reminder automation
// Clients (CRM) — all true
{ ..., studio: true, enterprise: true }, // (×6 rows: booking history, records, history, notes, custom fields, recurring)
// Invoicing & reports
{ ..., studio: true, enterprise: true }, // Auto invoices
{ ..., studio: true, enterprise: true }, // Basic reports
{ ..., studio: true, enterprise: true }, // Advanced analytics
{ ..., studio: true, enterprise: true }, // Data export
// Branding
{ ..., studio: "Premium", enterprise: "White-label" },
```
Add one Enterprise-only extra row to the "Branding" or a new "Enterprise" group (optional; keep minimal — skip if it bloats). Also add two Enterprise-distinguishing rows to make the column earn its place, in a new group:
```js
{
  group: "Enterprise",
  rows: [
    { label: "SSO & SAML",        starter: false, hostplus: false, studio: false, enterprise: true },
    { label: "Role-based access", starter: false, hostplus: false, studio: false, enterprise: true },
    { label: "REST API + webhooks", starter: false, hostplus: false, studio: false, enterprise: true },
  ],
},
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/data/__tests__/plans.pricing.test.js`
Expected: PASS (all 4 tests).

- [ ] **Step 7: Commit**

```bash
git add client/src/data/plans.js client/src/data/__tests__/plans.pricing.test.js
git commit -m "feat(pricing): add accent/persona fields + Enterprise plan + matrix column"
```

---

### Task 2: Build shared PricingCards component

**Files:**
- Create: `client/src/components/pricing/PricingCards.jsx`
- Test: `client/src/components/pricing/__tests__/PricingCards.test.jsx` (create)

**Interfaces:**
- Consumes: `PAID_PLANS`, `STARTER_PLAN`, `ENTERPRISE_PLAN` from `../../data/plans`; `ROUTE_START` — define locally as `"/start-selling"` if not already exported (check `Home.jsx` for the real value in Step 3 and match it).
- Produces: `export default function PricingCards()` — self-contained, owns its own `yearly` `useState(true)`, renders toggle + top row (Host+, Studio, Enterprise) + wide Starter card. No required props.

- [ ] **Step 1: Confirm ROUTE_START value + icons exist**

Run: `cd client && grep -rn "ROUTE_START" src/pages/Home.jsx | head -1`
Note the exact path string (e.g. `/start-selling`). Confirm icons:
Run: `node -e "const l=require('lucide-react'); ['Sprout','Sparkles','Rocket','Building2','Check'].forEach(n=>console.log(n, !!l[n]))"`
Expected: all `true`.

- [ ] **Step 2: Write the failing test**

```jsx
// client/src/components/pricing/__tests__/PricingCards.test.jsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PricingCards from "../PricingCards";

const setup = () => render(<MemoryRouter><PricingCards /></MemoryRouter>);

describe("PricingCards", () => {
  it("renders all four plan names", () => {
    const { container } = setup();
    const text = container.textContent;
    for (const name of ["Starter", "Host+", "Studio", "Enterprise"])
      expect(text).toContain(name);
  });
  it("Enterprise CTA links to /enterprise", () => {
    const { container } = setup();
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/enterprise");
  });
  it("shows persona titles", () => {
    const { container } = setup();
    expect(container.textContent).toContain("Solo Creator");
    expect(container.textContent).toContain("Teams & Agencies");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/pricing/__tests__/PricingCards.test.jsx`
Expected: FAIL (cannot resolve `../PricingCards`).

- [ ] **Step 4: Write the component**

```jsx
// client/src/components/pricing/PricingCards.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sprout, Sparkles, Rocket, Building2 } from "lucide-react";
import { PAID_PLANS, STARTER_PLAN, ENTERPRISE_PLAN } from "../../data/plans";

const ROUTE_START = "/start-selling"; // must match Home.jsx (confirmed in Task 2 Step 1)
const ICONS = { Sprout, Sparkles, Rocket, Building2 };

function AccentIcon({ name, accent, size = 20 }) {
  const Icon = ICONS[name] ?? Sparkles;
  return (
    <span
      className="inline-flex h-10 w-10 items-center justify-center rounded-[6px]"
      style={{ color: accent, background: `${accent}14`, boxShadow: `0 0 18px ${accent}55` }}
    >
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}

function Persona({ plan }) {
  return (
    <div className="mt-7 flex items-start gap-3 border-t border-black/5 pt-5">
      <AccentIcon name={plan.icon} accent={plan.accent} size={18} />
      <div>
        <p className="text-sm font-semibold text-ink">{plan.persona.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{plan.persona.blurb}</p>
      </div>
    </div>
  );
}

function Features({ plan }) {
  return (
    <>
      {plan.intro && <p className="mt-7 text-sm font-semibold text-ink">{plan.intro}</p>}
      <ul className="mt-4 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
            <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: plan.accent }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function PaidCard({ plan, yearly }) {
  const isEnterprise = plan.slug === "enterprise";
  const perMo = isEnterprise ? 0 : Math.round(plan.yearly / 12);
  const savePct = isEnterprise ? 0 : Math.round((1 - plan.yearly / 12 / plan.monthly) * 100);
  const bigPrice = yearly ? plan.yearly : plan.monthly;
  const cta = isEnterprise ? plan.cta : { label: "Let's Get Started", to: ROUTE_START };

  return (
    <div
      className={`relative flex h-full flex-col rounded-[6px] border bg-white p-7 sm:p-8 ${
        plan.recommended ? "" : "border-black/5 shadow-[0_8px_30px_rgba(26,26,26,0.05)]"
      }`}
      style={
        plan.recommended
          ? { borderColor: `${plan.accent}4d`, boxShadow: `0 24px 60px -30px ${plan.accent}73` }
          : undefined
      }
    >
      {plan.recommended && (
        <span
          className="absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: plan.accent }}
        >
          Recommended
        </span>
      )}
      <div className="flex items-center justify-between">
        <span
          className="rounded-[6px] border px-2.5 py-1 font-heading text-lg font-bold"
          style={{ color: plan.accent, borderColor: `${plan.accent}33` }}
        >
          {plan.name}
        </span>
        <AccentIcon name={plan.icon} accent={plan.accent} />
      </div>
      <p className="mt-3 text-sm text-neutral-500">{plan.tagline}</p>

      <div className="mt-6 flex items-end gap-2">
        {isEnterprise ? (
          <span className="text-4xl font-extrabold text-ink">Custom</span>
        ) : (
          <>
            <span className="text-5xl font-extrabold text-ink">₹{bigPrice.toLocaleString("en-IN")}</span>
            <span className="mb-1.5 text-sm text-neutral-400">/ {yearly ? "year" : "month"}</span>
            {yearly && (
              <span className="mb-2 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold" style={{ color: plan.accent }}>
                Save {savePct}%
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        {isEnterprise ? "Volume pricing — tailored to your team" : yearly ? `just ₹${perMo}/month, billed yearly` : "billed monthly"}
      </p>

      <Link
        to={cta.to}
        className="mt-6 inline-flex items-center justify-center rounded-[6px] px-6 py-3 text-sm font-semibold text-white transition-transform hover:no-underline"
        style={{ background: plan.recommended ? plan.accent : "#1a1a1a" }}
      >
        {cta.label}
      </Link>

      <Features plan={plan} />
      <div className="flex-1" />
      <Persona plan={plan} />
    </div>
  );
}

export default function PricingCards() {
  const [yearly, setYearly] = useState(true);
  const paid = [...PAID_PLANS, ENTERPRISE_PLAN]; // Host+, Studio, Enterprise

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${!yearly ? "bg-ink text-white" : "text-neutral-500 hover:text-ink"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${yearly ? "bg-ink text-white" : "text-neutral-500 hover:text-ink"}`}
          >
            Yearly
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${yearly ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
              Best value
            </span>
          </button>
        </div>
      </div>

      {/* Top row: 3 paid cards */}
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {paid.map((p) => (
          <PaidCard key={p.slug} plan={p} yearly={yearly} />
        ))}
      </div>

      {/* Starter — wide card */}
      <div className="mt-5 rounded-[6px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.05)] sm:p-8 lg:flex lg:items-center lg:gap-8">
        <div className="lg:shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="rounded-[6px] border px-2.5 py-1 font-heading text-lg font-bold"
              style={{ color: STARTER_PLAN.accent, borderColor: `${STARTER_PLAN.accent}33` }}
            >
              {STARTER_PLAN.name}
            </span>
            <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-primary">{STARTER_PLAN.badge}</span>
            <AccentIcon name={STARTER_PLAN.icon} accent={STARTER_PLAN.accent} />
          </div>
          <p className="mt-2 text-sm text-neutral-500">{STARTER_PLAN.tagline}</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-extrabold text-ink">₹0</span>
            <span className="mb-1 text-sm text-neutral-400">/ forever</span>
          </div>
        </div>
        <ul className="mt-6 grid gap-3 lg:mt-0 lg:flex-1 lg:grid-cols-2 lg:gap-x-8">
          {STARTER_PLAN.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
              <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: STARTER_PLAN.accent }} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 lg:mt-0 lg:shrink-0">
          <Link
            to={ROUTE_START}
            className="inline-flex w-full items-center justify-center rounded-[6px] bg-ink px-7 py-3 text-sm font-semibold text-white transition-transform hover:bg-neutral-800 hover:no-underline lg:w-auto"
          >
            Let's Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/pricing/__tests__/PricingCards.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/pricing/PricingCards.jsx client/src/components/pricing/__tests__/PricingCards.test.jsx
git commit -m "feat(pricing): shared PricingCards component (4 plans, accents, persona)"
```

---

### Task 3: Wire PricingCards into Home.jsx

**Files:**
- Modify: `client/src/pages/Home.jsx` (pricing section ~1666–1808; state at ~735–738)

**Interfaces:**
- Consumes: `PricingCards` default export.

- [ ] **Step 1: Import + remove now-dead state**

Add near the other imports:
```jsx
import PricingCards from "../components/pricing/PricingCards";
```
Delete the now-unused local pricing state/data (lines ~735–738: `const [yearly, setYearly] = useState(true);` and `const PLANS = PAID_PLANS;`) **only if `yearly`/`PLANS` are not referenced elsewhere** — grep first:
Run: `grep -n "yearly\|PLANS\|PAID_PLANS\|STARTER_PLAN" src/pages/Home.jsx`
Remove only the pricing-section-owned ones. If `PAID_PLANS`/`STARTER_PLAN` imports become unused, drop them from the import at line 60.

- [ ] **Step 2: Replace the inline pricing markup**

In the `#pricing` section, replace everything from the billing-toggle `<Reveal>` (~1676) through the closing of the Starter `<Reveal>` card (~1794) with:
```jsx
          <Reveal delay={0.12} className="mt-8">
            <PricingCards />
          </Reveal>
```
Keep the section heading (~1669–1674) and the trailing copy/footnotes (~1796–1806) exactly as-is.

- [ ] **Step 3: Verify build + no unused-import errors**

Run: `cd client && npm run build`
Expected: build succeeds (exit 0). Fix any "imported but never used" / undefined `yearly` errors surfaced.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "refactor(home): use shared PricingCards in pricing section"
```

---

### Task 4: Wire PricingCards into Pricing.jsx + widen matrix

**Files:**
- Modify: `client/src/pages/Pricing.jsx` (cards block ~58–150; table wrapper ~162)

**Interfaces:**
- Consumes: `PricingCards`. `PLAN_COLUMNS`/`PLAN_MATRIX` already drive the table (enterprise column auto-renders from Task 1).

- [ ] **Step 1: Import PricingCards**

```jsx
import PricingCards from "../components/pricing/PricingCards";
```

- [ ] **Step 2: Replace the toggle + cards block with the component**

Replace from the billing-toggle block (~58) through the end of the `ALL_PLANS.map` cards grid (closing `</div>` of the `md:grid-cols-3` block, ~150) with:
```jsx
        <PricingCards />
```
Remove the now-unused `const [yearly, setYearly] = useState(true);` if nothing else on the page uses it (the matrix table does not). Drop unused imports (`ALL_PLANS`, `Check`, `X`, `useState`) only if the matrix no longer references them — grep to confirm before deleting:
Run: `grep -n "ALL_PLANS\|useState\|<Check\|<X" src/pages/Pricing.jsx`

- [ ] **Step 3: Ensure the 4-col matrix scrolls on mobile**

The table has `min-w-[560px]` inside a wrapper. Bump to `min-w-[720px]` to fit 4 columns and confirm the wrapper has `overflow-x-auto`:
Run: `grep -n "overflow-x-auto\|min-w-\[" src/pages/Pricing.jsx`
If the wrapper lacks `overflow-x-auto`, add it to the table's parent `div`.

- [ ] **Step 4: Verify**

Run: `cd client && npx vitest run && npm run build`
Expected: all tests pass, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Pricing.jsx
git commit -m "refactor(pricing): use shared PricingCards + 4-col comparison matrix"
```

---

### Task 5: Full-suite verification + browser QA

**Files:** none (verification only)

- [ ] **Step 1: Run the Vercel gate locally**

Run: `cd client && npx vitest run`
Expected: PASS (incl. `routeManifestSync` — no new route added, so no manifest change needed).

- [ ] **Step 2: Production build**

Run: `cd client && npm run build`
Expected: exit 0, no missing-icon / undefined errors.

- [ ] **Step 3: Browser QA (preview)**

Start dev server (via preview_start `client` config or `npm run dev`), then check:
- Home `#pricing`: 3 paid cards in a row + Starter wide below; toggle flips prices; Studio has orange ring + Recommended chip; Enterprise shows "Custom" + "Talk to Sales" → `/enterprise`.
- `/pricing`: same cards + 4-column matrix; matrix scrolls horizontally at mobile width (375px).
- No console errors (`read_console_messages`).
- Screenshot desktop + mobile as proof.

- [ ] **Step 4: Final commit (if any QA fixes)**

```bash
git add -A && git commit -m "fix(pricing): QA polish from browser review"
```

---

## Self-Review Notes

- **Spec coverage:** shared component (T2), 4 plans / 3-top+Starter-bottom layout (T2), per-card accents + glow (T2), Studio ring (T2), Enterprise → /enterprise (T1/T2), persona footers no-emoji (T2), 4-col matrix (T1/T4), inline-hex accents (T2), additive plans.js (T1). ✓
- **jest-dom gap:** tests use `.textContent` / `.getAttribute` only. ✓
- **ROUTE_START:** hardcoded in component; Task 2 Step 1 confirms the real value and Task 3 Step 1 cross-checks Home — reconcile if different.
- **Icon safety:** Task 2 Step 1 verifies lucide exports; `npm run build` in T3/T4/T5 catches any missing icon.
