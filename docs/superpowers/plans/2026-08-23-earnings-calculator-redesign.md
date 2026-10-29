# Earnings Calculator Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/earnings-calculator` into an interactive tool that honestly steers hosts to the top annual plan via a commission-bleed loss moment, count-up reveal, and a Host+ booking-ceiling → Studio nudge.

**Architecture:** Extract all annual/winner/ceiling logic into a pure, unit-tested helper module (`client/src/lib/earningsCalc.js`) that wraps the existing `morPricing.js` per-booking math and pulls annual fees from `data/plans.js` (single source). The page component (`EarningsCalculator.jsx`) becomes presentation + a small reduced-motion-aware count-up hook. No new dependencies.

**Tech Stack:** React 18, Vite, Tailwind, lucide-react, Vitest + @testing-library/react.

## Global Constraints

- Single page file rebuilt: `client/src/pages/EarningsCalculator.jsx`. One new helper file: `client/src/lib/earningsCalc.js`.
- Do NOT edit `client/src/lib/morPricing.js` or its drift test `client/src/lib/__tests__/morPricing.test.js`.
- No invented pricing numbers: annual fees derive from `client/src/data/plans.js` (`PAID_PLANS[].yearly`).
- No new npm dependencies. No animation library.
- UI rules: existing design tokens only, `rounded-[6px]`, 4px borders where already used, ink/neutral colors, accents `starter #4AB765 / hostplus #269CEF / studio #FE5100`, surface `#f7f5ef` + `bg-white`. Plus Jakarta Sans headings / Poppins body inherited from global CSS — do not override.
- Keep `Seo`, `canonical`, `ogCard('earnings-calculator','png')`, `ROUTE_START = "/be-a-sloth"`.
- Honesty rule: winner = highest annual take-home among non-capped plans. Studio is NEVER shown as higher take-home; it surfaces via the booking-ceiling rule only.
- Host+ annual booking cap = 1,000. Studio unlimited.
- Respect `prefers-reduced-motion` (snap to final values).
- Do NOT touch untracked `leadScore` files.
- Before PR: `cd client && npx vitest run` (Vercel gate) and `npm run build`.

---

### Task 1: Pure calculation helper (`earningsCalc.js`)

**Files:**
- Create: `client/src/lib/earningsCalc.js`
- Test: `client/src/lib/__tests__/earningsCalc.test.js`

**Interfaces:**
- Consumes: from `../morPricing` → `computeMorBreakdown`, `CALC_PLANS`, `DEFAULT_GST_RATE`; from `../../data/plans` → `PAID_PLANS`.
- Produces (used by Task 2):
  - `HOSTPLUS_ANNUAL_CAP` = `1000` (number)
  - `ANNUAL_FEE` = `{ starter:0, hostplus:number, studio:number }`
  - `annualBookings(sessionsPerMonth) -> number` (floored monthly × 12)
  - `resultsFor(earning, sessionsPerMonth, cycle) -> Array<{ plan, perBookingTakeHome, guestPays, fee, feeCycleLabel, grossAnnual, netAnnual, capped, outgrows }>` where `cycle` is `'annual' | 'monthly'`
  - `pickWinner(results) -> string` (plan key)
  - `annualSaving(planKey) -> number` (monthly×12 − annual fee; 0 for starter)
  - `ceilingState(sessionsPerMonth) -> 'none' | 'near' | 'over'`
  - `starterCommissionPerYear(earning, sessionsPerMonth) -> number`

- [ ] **Step 1: Write the failing test**

```js
// client/src/lib/__tests__/earningsCalc.test.js
import { describe, it, expect } from 'vitest';
import {
  ANNUAL_FEE, HOSTPLUS_ANNUAL_CAP, annualBookings, resultsFor,
  pickWinner, annualSaving, ceilingState, starterCommissionPerYear,
} from '../earningsCalc';

describe('earningsCalc', () => {
  it('annual fees come from plans.js (Host+ 1499, Studio 3650)', () => {
    expect(ANNUAL_FEE.hostplus).toBe(1499);
    expect(ANNUAL_FEE.studio).toBe(3650);
    expect(ANNUAL_FEE.starter).toBe(0);
  });

  it('annualBookings floors then x12', () => {
    expect(annualBookings(10)).toBe(120);
    expect(annualBookings(10.9)).toBe(120);
  });

  it('annual net = per-booking take-home x annual volume minus annual fee', () => {
    // Host+ at E=1000: per-booking take-home = 970.20 (morPricing drift test)
    const r = resultsFor(1000, 10, 'annual').find((x) => x.plan.key === 'hostplus');
    expect(r.perBookingTakeHome).toBe(970.2);
    expect(r.grossAnnual).toBe(970.2 * 120);
    expect(r.netAnnual).toBe(970.2 * 120 - 1499);
    expect(r.fee).toBe(1499);
  });

  it('monthly cycle subtracts monthly*12 as the fee', () => {
    const r = resultsFor(1000, 10, 'monthly').find((x) => x.plan.key === 'hostplus');
    expect(r.fee).toBe(229 * 12);
  });

  it('winner is highest net take-home among non-capped (Host+ beats Studio, same per-booking)', () => {
    const results = resultsFor(1000, 10, 'annual');
    expect(pickWinner(results)).toBe('hostplus');
  });

  it('Starter is capped and excluded from winner above 5000/session', () => {
    const results = resultsFor(6000, 10, 'annual');
    const starter = results.find((x) => x.plan.key === 'starter');
    expect(starter.capped).toBe(true);
    expect(pickWinner(results)).not.toBe('starter');
  });

  it('Host+ outgrows when annual bookings exceed 1000; ceiling over', () => {
    const results = resultsFor(1000, 90, 'annual'); // 1080/yr
    const hp = results.find((x) => x.plan.key === 'hostplus');
    expect(hp.outgrows).toBe(true);
    expect(ceilingState(90)).toBe('over');
    expect(ceilingState(75)).toBe('near'); // 900/yr, within 840..1000
    expect(ceilingState(10)).toBe('none');
    expect(HOSTPLUS_ANNUAL_CAP).toBe(1000);
  });

  it('annual saving = monthly*12 - annual fee', () => {
    expect(annualSaving('hostplus')).toBe(229 * 12 - 1499); // 1249
    expect(annualSaving('studio')).toBe(555 * 12 - 3650);   // 3010
    expect(annualSaving('starter')).toBe(0);
  });

  it('starter commission per year = 5% x price x annual bookings', () => {
    expect(starterCommissionPerYear(1000, 10)).toBe(0.05 * 1000 * 120); // 6000
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/lib/__tests__/earningsCalc.test.js`
Expected: FAIL — cannot resolve `../earningsCalc`.

- [ ] **Step 3: Write minimal implementation**

```js
// client/src/lib/earningsCalc.js
/**
 * Annual/winner/ceiling orchestration for the earnings calculator.
 * Wraps morPricing (per-booking take-home authority) and pulls annual fees from
 * data/plans.js (single pricing source). Pure + unit-tested so the page stays
 * presentation-only. Display/illustration only — real pricing is server-side.
 */
import { computeMorBreakdown, CALC_PLANS, DEFAULT_GST_RATE } from './morPricing';
import { PAID_PLANS } from '../data/plans';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const HOSTPLUS_ANNUAL_CAP = 1000;

// Annual fees from the single pricing source. plans.js slugs: creator=Host+, professional=Studio.
const yearlyBySlug = Object.fromEntries(PAID_PLANS.map((p) => [p.slug, p.yearly]));
export const ANNUAL_FEE = {
  starter: 0,
  hostplus: yearlyBySlug.creator,
  studio: yearlyBySlug.professional,
};

export const annualBookings = (sessionsPerMonth) =>
  Math.max(0, Math.floor(Number(sessionsPerMonth) || 0)) * 12;

export function resultsFor(earning, sessionsPerMonth, cycle = 'annual') {
  const yearly = annualBookings(sessionsPerMonth);
  return CALC_PLANS.map((plan) => {
    const b = computeMorBreakdown({ targetEarning: earning, ...plan.charge, gstRate: DEFAULT_GST_RATE });
    const perBookingTakeHome = b.hostConsideration;
    const grossAnnual = round2(perBookingTakeHome * yearly);
    const fee = cycle === 'annual' ? ANNUAL_FEE[plan.key] : plan.monthly * 12;
    const netAnnual = round2(grossAnnual - fee);
    const capped = plan.maxServicePrice != null && Number(earning) > plan.maxServicePrice;
    const outgrows = plan.key === 'hostplus' && yearly > HOSTPLUS_ANNUAL_CAP;
    return {
      plan,
      perBookingTakeHome,
      guestPays: b.guestTotal,
      fee,
      feeCycleLabel: cycle === 'annual' ? '/year' : '/year (billed monthly)',
      grossAnnual,
      netAnnual,
      capped,
      outgrows,
    };
  });
}

export function pickWinner(results) {
  const eligible = results.filter((r) => !r.capped);
  const pool = eligible.length ? eligible : results;
  return pool.reduce((a, b) => (b.netAnnual > a.netAnnual ? b : a)).plan.key;
}

export function annualSaving(planKey) {
  const plan = CALC_PLANS.find((p) => p.key === planKey);
  if (!plan || plan.monthly === 0) return 0;
  return plan.monthly * 12 - ANNUAL_FEE[planKey];
}

export function ceilingState(sessionsPerMonth) {
  const yearly = annualBookings(sessionsPerMonth);
  if (yearly > HOSTPLUS_ANNUAL_CAP) return 'over';
  if (yearly > 840) return 'near'; // ~70/mo, approaching the cap
  return 'none';
}

export function starterCommissionPerYear(earning, sessionsPerMonth) {
  const rate = CALC_PLANS.find((p) => p.key === 'starter').charge.commissionRate;
  return round2(rate * (Number(earning) || 0) * annualBookings(sessionsPerMonth));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/lib/__tests__/earningsCalc.test.js`
Expected: PASS (all 9). Also run `npx vitest run src/lib/__tests__/morPricing.test.js` to confirm the drift guard still passes (unchanged).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/earningsCalc.js client/src/lib/__tests__/earningsCalc.test.js
git commit -m "feat(earnings-calculator): annual/winner/ceiling calc helper"
```

---

### Task 2: Rebuild the page (`EarningsCalculator.jsx`)

**Files:**
- Modify (full rewrite): `client/src/pages/EarningsCalculator.jsx`
- Test: `client/src/tests/EarningsCalculator.test.jsx`

**Interfaces:**
- Consumes: everything exported from `../lib/earningsCalc` (Task 1) and `inr`-style formatting done inline.
- Produces: default-exported `EarningsCalculator` React component (route already wired in `App.jsx`).

**Behavior contract (what the tests assert):**
1. On mount with defaults (₹1,500 / 12 sessions, annual cycle) the winner headline names a plan and a `/year` take-home number.
2. A loss line shows Starter commission for the year (`starterCommissionPerYear`) as a negative/"₹0 on Host+ and Studio" contrast.
3. Billing toggle switches annual↔monthly and the plan-fee figures change.
4. Ceiling nudge is ABSENT at low volume and PRESENT (mentions Studio + 1,000) when sessions ≥ ~84/mo.
5. Winner card carries the "Best for your volume" marker; Host+ shows "You'd outgrow this" when over cap.
6. Count-up hook snaps to final value when `matchMedia` is unavailable (jsdom) — final number is present immediately.

- [ ] **Step 1: Write the failing component test**

```jsx
// client/src/tests/EarningsCalculator.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EarningsCalculator from '../pages/EarningsCalculator';

const setup = () => render(<EarningsCalculator />, { wrapper: MemoryRouter });

describe('EarningsCalculator', () => {
  it('shows a winner headline with a yearly take-home on mount', () => {
    setup();
    expect(screen.getByText(/keep the most/i)).toBeTruthy();
    expect(screen.getAllByText(/\/year/i).length).toBeGreaterThan(0);
  });

  it('shows the Starter commission loss line', () => {
    setup();
    // default 1500 x 5% x 144 = 10,800
    expect(screen.getByText(/walks out the door|commission/i)).toBeTruthy();
  });

  it('no ceiling nudge at low volume', () => {
    setup();
    expect(screen.queryByText(/1,000\/year limit|uncapped/i)).toBeNull();
  });

  it('shows the ceiling nudge to Studio at very high volume', () => {
    setup();
    const sessions = screen.getByLabelText('Sessions per month');
    fireEvent.change(sessions, { target: { value: '100' } });
    expect(screen.getByText(/uncapped|1,000\/year limit/i)).toBeTruthy();
    expect(screen.getByText(/Studio/i)).toBeTruthy();
  });

  it('billing toggle changes the plan fee shown', () => {
    setup();
    const toggle = screen.getByRole('button', { name: /pay monthly|monthly/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /pay yearly|yearly/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/tests/EarningsCalculator.test.jsx`
Expected: FAIL — assertions miss (current page has no winner headline / toggle / ceiling copy).

- [ ] **Step 3: Rewrite the component**

Full replacement of `client/src/pages/EarningsCalculator.jsx`. Keep the leading business-logic comment block updated. Structure:

```jsx
import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sprout, Sparkles, Rocket, TrendingUp, ArrowUpRight, ShieldCheck, Info } from "lucide-react";
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL } from "../utils/seo";
import {
  resultsFor, pickWinner, annualSaving, ceilingState,
  starterCommissionPerYear, ANNUAL_FEE, HOSTPLUS_ANNUAL_CAP,
} from "../lib/earningsCalc";

// /earnings-calculator — public conversion tool. Host drags price + monthly
// volume; sees annual take-home per plan (annual billing default), what Starter's
// 5% commission costs over a year, and — once volume passes Host+'s 1,000/yr cap —
// an honest nudge to Studio (identical take-home, uncapped). Winner is always the
// highest annual take-home among non-capped plans; Studio never fakes a higher
// number. Math: lib/earningsCalc.js + lib/morPricing.js (server mirror). Display
// only; real pricing computed server-side at booking.

const ROUTE_START = "/be-a-sloth";
const ICON = { starter: Sprout, hostplus: Sparkles, studio: Rocket };
const ACCENT = { starter: "#4AB765", hostplus: "#269CEF", studio: "#FE5100" };

const inr0 = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
const inr2 = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);

// ponytail: hand-rolled count-up (rAF, ~500ms). Snaps to final when reduced-motion
// is set OR matchMedia is unavailable (jsdom in tests). No animation lib.
function useCountUp(value, ms = 500) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const reduce =
      typeof window === "undefined" || !window.matchMedia
        ? true
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function Field({ label, hint, value, min, max, step, onChange, prefix }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-ink">{label}</label>
        <span className="text-xs text-neutral-500">{hint}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-[6px] border border-black/10 bg-white px-3 py-2 focus-within:border-primary">
        {prefix && <span className="text-neutral-400">{prefix}</span>}
        <input
          type="number" inputMode="numeric" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-lg font-semibold text-ink outline-none"
          aria-label={label}
        />
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={Math.min(Math.max(Number(value) || min, min), max)}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full accent-primary" aria-label={`${label} slider`}
      />
    </div>
  );
}

function PlanCard({ result, winnerKey, cycle }) {
  const { plan } = result;
  const Icon = ICON[plan.key] ?? Sparkles;
  const accent = ACCENT[plan.key];
  const isWinner = winnerKey === plan.key;
  return (
    <div
      className={`relative flex flex-col rounded-[6px] border bg-white p-5 transition-all sm:p-6 ${
        isWinner ? "shadow-[0_10px_36px_rgba(26,26,26,0.10)]" : "border-black/5"
      }`}
      style={isWinner ? { borderColor: accent } : undefined}
    >
      {isWinner && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: accent }}>
          <TrendingUp size={12} /> Best for your volume
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[6px]" style={{ color: accent, background: `${accent}14` }}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">{plan.name}</p>
          <p className="text-[11px] text-neutral-500">{plan.note}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs text-neutral-500">You keep, per year</p>
        <p className="text-2xl font-extrabold" style={{ color: accent }}>{inr0(result.netAnnual)}</p>
        {plan.monthly > 0 && (
          <p className="text-[11px] text-neutral-400">
            {inr0(result.grossAnnual)} earned − {inr0(result.fee)} plan fee{cycle === "annual" ? " (yearly)" : " (monthly ×12)"}
          </p>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-xs">
        <div className="flex justify-between"><dt className="text-neutral-500">Take-home / session</dt><dd className="font-semibold text-ink">{inr2(result.perBookingTakeHome)}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">Your guest pays</dt><dd className="font-semibold text-ink">{inr2(result.guestPays)}</dd></div>
      </dl>

      {result.capped && (
        <p className="mt-3 rounded-[6px] bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          Starter caps at {inr0(plan.maxServicePrice)} per session. Host+ prices above it.
        </p>
      )}
      {result.outgrows && (
        <p className="mt-3 rounded-[6px] bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
          You'd outgrow this — Host+ stops at {HOSTPLUS_ANNUAL_CAP.toLocaleString("en-IN")} bookings/year.
        </p>
      )}
    </div>
  );
}

export default function EarningsCalculator() {
  const [earning, setEarning] = useState(1500);
  const [bookings, setBookings] = useState(12);
  const [cycle, setCycle] = useState("annual"); // annual | monthly

  const results = useMemo(() => resultsFor(earning, bookings, cycle), [earning, bookings, cycle]);
  const winnerKey = useMemo(() => pickWinner(results), [results]);
  const winner = results.find((r) => r.plan.key === winnerKey);
  const loss = starterCommissionPerYear(earning, bookings);
  const ceiling = ceilingState(bookings);
  const saving = annualSaving(winnerKey);

  const animatedNet = useCountUp(winner.netAnnual);
  const animatedLoss = useCountUp(loss);

  const canonical = `${SITE_URL}/earnings-calculator`;

  return (
    <div className="min-h-screen" style={{ background: "#f7f5ef" }}>
      <Seo
        title="Earnings Calculator | Book A Sloth"
        description="See what you'd actually pocket on Book A Sloth. Drag your price and monthly bookings to watch your yearly take-home — and what the wrong plan quietly costs you."
        canonical={canonical}
        image={ogCard("earnings-calculator", "png")}
      />
      <div className="app-container py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          {/* HERO + INPUTS (fused) */}
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">See what you'd actually pocket.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
            Drag the numbers. Watch your year add up — and see what the wrong plan quietly costs you.
          </p>

          <div className="mt-8 grid gap-6 rounded-[6px] border border-black/5 bg-white p-6 sm:grid-cols-2 sm:p-7">
            <Field label="Price per session" hint="what you keep" prefix="₹" value={earning}
              min={100} max={10000} step={50}
              onChange={(v) => setEarning(v === "" ? "" : Math.max(0, Number(v)))} />
            <Field label="Sessions per month" hint="your volume" value={bookings}
              min={1} max={120} step={1}
              onChange={(v) => setBookings(v === "" ? "" : Math.max(0, Number(v)))} />
          </div>

          {/* REVEAL STRIP: annual take-home + loss */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[6px] border bg-white p-5" style={{ borderColor: ACCENT[winnerKey] }}>
              <p className="text-xs text-neutral-500">Your take-home this year on {winner.plan.name}</p>
              <p className="text-3xl font-extrabold" style={{ color: ACCENT[winnerKey] }}>{inr0(animatedNet)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                keep the most on <strong>{winner.plan.name}</strong> at {Math.floor(Number(bookings) || 0)} sessions/mo of {inr0(earning)}
              </p>
            </div>
            <div className="rounded-[6px] border border-black/5 bg-white p-5">
              <p className="text-xs text-neutral-500">On Starter, 5% walks out the door</p>
              <p className="text-3xl font-extrabold text-[#c0392b]">− {inr0(animatedLoss)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">in commission this year. On Host+ and Studio, that's <strong>₹0</strong>.</p>
            </div>
          </div>

          {/* BILLING TOGGLE */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button type="button" onClick={() => setCycle("annual")}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${cycle === "annual" ? "bg-primary text-white" : "text-neutral-500"}`}
              aria-pressed={cycle === "annual"}>
              Pay yearly{saving > 0 ? ` · save ${inr0(saving)}` : ""}
            </button>
            <button type="button" onClick={() => setCycle("monthly")}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${cycle === "monthly" ? "bg-primary text-white" : "text-neutral-500"}`}
              aria-pressed={cycle === "monthly"}>
              Pay monthly
            </button>
          </div>

          {/* PLAN CARDS */}
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            {results.map((r) => (
              <PlanCard key={r.plan.key} result={r} winnerKey={winnerKey} cycle={cycle} />
            ))}
          </div>

          {/* CEILING NUDGE (honest top-plan moment) */}
          {ceiling !== "none" && (
            <div className="mt-6 flex items-start gap-3 rounded-[6px] border p-5" style={{ borderColor: ACCENT.studio, background: `${ACCENT.studio}0D` }}>
              <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px]" style={{ color: ACCENT.studio, background: `${ACCENT.studio}14` }}>
                <Rocket size={18} />
              </span>
              <p className="text-sm text-neutral-700">
                {ceiling === "over" ? "You're booking past" : "You're closing in on"} Host+'s{" "}
                <strong>{HOSTPLUS_ANNUAL_CAP.toLocaleString("en-IN")}/year limit</strong>.{" "}
                <strong style={{ color: ACCENT.studio }}>Studio keeps you uncapped</strong> — same 0% cut, same take-home per session, room to grow.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <Link to={ROUTE_START} className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-95">
              Start on {winner.plan.name} <ArrowUpRight size={16} />
            </Link>
            <Link to="/pricing" className="text-sm font-semibold text-primary hover:underline">
              See full plan comparison →
            </Link>
          </div>

          {/* OBJECTION RESOLVER + footnote */}
          <div className="mt-8 grid gap-2.5 rounded-[6px] border border-black/5 bg-white/60 p-4 text-xs leading-relaxed text-neutral-600 sm:grid-cols-3">
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-primary" /> Real payout math, not a sales number.</p>
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-primary" /> Cancel anytime — no lock-in.</p>
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-primary" /> Same take-home whether or not you're GST-registered.</p>
          </div>
          <div className="mt-3 flex gap-2.5 text-[11px] leading-relaxed text-neutral-500">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            <p>
              An illustration, not a quote. Figures assume 18% GST (most categories; some differ) and your exact price is confirmed when you list a service. See the{" "}
              <Link to="/host-fees" className="text-primary hover:underline">Host Fee &amp; Payment Schedule</Link> for the full breakdown.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run component test to verify it passes**

Run: `cd client && npx vitest run src/tests/EarningsCalculator.test.jsx`
Expected: PASS (5). If the toggle-name assertion is brittle, adjust the test's accessible-name regex to match the rendered button text — do not weaken the component.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/EarningsCalculator.jsx client/src/tests/EarningsCalculator.test.jsx
git commit -m "feat(earnings-calculator): interactive annual-first redesign

Fused hero+calculator, count-up reveal, Starter commission loss line,
annual/monthly toggle, and honest Host+ ceiling -> Studio nudge."
```

---

### Task 3: Full verification + PR

**Files:** none (verification only).

- [ ] **Step 1: Run the full client test suite**

Run: `cd client && npx vitest run`
Expected: PASS. Pay attention to `morPricing.test.js` (drift guard — must stay green) and any snapshot referencing the old calculator copy; update snapshots only if the change is intended (`npx vitest run -u`).

- [ ] **Step 2: Production build**

Run: `cd client && npm run build`
Expected: build succeeds (Vercel gate). Fix any missing-import / lucide-icon errors before proceeding.

- [ ] **Step 3: Browser smoke check (preview_start)**

Start the client dev server via the Browser pane, load `/earnings-calculator`, and verify: default numbers render a winner + loss, dragging sessions to 100 shows the Studio ceiling nudge, the annual/monthly toggle flips the fees, no console errors. Screenshot for the PR.

- [ ] **Step 4: Open the PR (do NOT merge)**

```bash
git push -u origin feat/earnings-calculator-redesign
gh pr create --title "feat(earnings-calculator): interactive annual-first redesign" --body "Rebuilds /earnings-calculator per docs/superpowers/specs/2026-08-23-earnings-calculator-redesign-design.md.

- Fused hero + live calculator; count-up reveal (reduced-motion aware)
- Starter commission-bleed loss line (own pricing data, no fabricated numbers)
- Annual-first with monthly/annual toggle + per-plan savings
- Honest top-plan path: Host+ 1,000/yr cap -> Studio uncapped nudge at high volume
- New pure helper lib/earningsCalc.js (unit-tested); morPricing drift guard untouched

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Hand over the PR link. The user merges.

---

## Self-Review

- **Spec coverage:** Audit (§3→plan intro), journey (§4→structure), structure (§5→Task 2 sections), inputs/outputs (§6→Task 1+2), reveal/animation (§7→useCountUp+count-up strip), annual positioning (§8→toggle+ceiling), copy (§9→JSX text), technical notes (§10→Global Constraints + tasks), out-of-scope (§11→constraints). Covered.
- **Placeholder scan:** none — all steps carry runnable code/commands.
- **Type consistency:** helper names (`resultsFor`, `pickWinner`, `annualSaving`, `ceilingState`, `starterCommissionPerYear`, `ANNUAL_FEE`, `HOSTPLUS_ANNUAL_CAP`) identical across Task 1 definition and Task 2 imports. Result-object keys (`netAnnual`, `grossAnnual`, `fee`, `perBookingTakeHome`, `guestPays`, `capped`, `outgrows`, `plan`) consistent between Task 1 producer and Task 2 consumer.
