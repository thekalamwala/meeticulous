import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sprout, Rocket } from "lucide-react";
import {
  FREE_PLAN,
  PREMIUM_PLAN,
  PREMIUM_PER_DAY,
  PREMIUM_ANNUAL_SAVE_PCT,
  PREMIUM_YEARLY_PER_MONTH,
  PREMIUM_PLAN_USD,
  PREMIUM_USD_YEARLY_PER_MONTH,
  PREMIUM_USD_ANNUAL_SAVE_PCT,
} from "../../data/plans";
import useFeeOnly from "../../hooks/useFeeOnly";
import { getPricingRegion } from "../../lib/pricingRegion";

const ROUTE_START = "/become-a-host"; // must match Home.jsx
const ICONS = { Sprout, Rocket };

// Glow is hover-only now: the accent shadow lives in a CSS var and is applied
// via a `group-hover` / `hover` shadow class, so the cards sit calm until the
// pointer lands on them (design ask — no always-on glow).
function AccentIcon({ name, accent, size = 20 }) {
  const Icon = ICONS[name] ?? Rocket;
  return (
    <span
      className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] transition-shadow duration-300"
      style={{ color: accent, background: `${accent}14`, "--ig": `${accent}66` }}
    >
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}

function Persona({ plan }) {
  return (
    <div className="mt-7 flex items-start gap-3 border-t border-neutral-200 pt-5">
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
      <ul className={`space-y-3 ${plan.intro ? "mt-4" : "mt-7"}`}>
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

// The top-right chip. Recommended card shows the yearly saving ONLY on the
// yearly tab (the 25% is an annual figure — showing it on Monthly was the bug).
// On the monthly tab it shows the always-true "0% commission" instead. Free
// card keeps its per-booking badge.
function PlanBadge({ plan, yearly, savePct }) {
  if (plan.recommended) {
    return yearly ? (
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold text-white"
        style={{ background: plan.accent }}
      >
        Save {savePct}%
      </span>
    ) : (
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ color: plan.accent, background: `${plan.accent}14` }}
      >
        0% commission
      </span>
    );
  }
  return <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-primary">{plan.badge}</span>;
}

function PlanCard({ plan, yearly, savePct, children }) {
  const recommended = !!plan.recommended;
  // Base shadow is soft and static; the accent glow only appears on hover
  // (--glow), so a card lights up under the pointer and never before.
  const glow = recommended ? `${plan.accent}80` : "rgba(26,26,26,0.16)";
  return (
    <div
      className="group relative flex h-full flex-col rounded-[24px] border bg-white p-7 transition-shadow duration-300 sm:p-8"
      style={{ borderColor: recommended ? `${plan.accent}4d` : "rgba(0,0,0,0.06)", "--glow": glow }}
    >
      <div className="flex items-center justify-between">
        <span
          className="rounded-full border px-2.5 py-1 font-heading text-lg font-bold"
          style={{ color: plan.accent, borderColor: `${plan.accent}33` }}
        >
          {plan.name}
        </span>
        <PlanBadge plan={plan} yearly={yearly} savePct={savePct} />
      </div>
      <p className="mt-3 text-sm text-neutral-500">{plan.tagline}</p>
      {children}
      <Features plan={plan} />
      <div className="flex-1" />
      <Persona plan={plan} />
    </div>
  );
}

// `freeAccent` optionally re-tints the Starter card for one placement (e.g. the
// Home section uses a brand shade instead of the green) without changing it
// on /pricing and the other pages that share this component.
// `startLabel` renames the Starter button for one placement (homepage CTA copy).
export default function PricingCards({ freeAccent, startLabel = "Start free" } = {}) {
  const [yearly, setYearly] = useState(true);
  const freePlan = freeAccent ? { ...FREE_PLAN, accent: freeAccent } : FREE_PLAN;
  // Interim (fee-only) mode: hide the free plan from the pricing display. Free
  // signup still works — we just don't advertise it. Reverts on Route go-live.
  const feeOnly = useFeeOnly();
  // Outside India → USD list price + "Get early access" (no USD checkout yet —
  // see PREMIUM_PLAN_USD in data/plans.js).
  const [intl] = useState(() => getPricingRegion() === "INTL");
  const savePct = intl ? PREMIUM_USD_ANNUAL_SAVE_PCT : PREMIUM_ANNUAL_SAVE_PCT;

  // On the yearly tab we lead with the monthly-equivalent (₹1,179 / 12 = ₹300)
  // so annual reads as the cheaper per-month price, with the real ₹1,179/year
  // charge stated underneath. Monthly leads with ₹235. Both are GST-inclusive.
  const displayPrice = intl
    ? `$${yearly ? PREMIUM_USD_YEARLY_PER_MONTH.toFixed(2) : PREMIUM_PLAN_USD.monthly}`
    : `₹${(yearly ? PREMIUM_YEARLY_PER_MONTH : PREMIUM_PLAN.monthly).toLocaleString("en-IN")}`;
  const priceNote = intl
    ? yearly
      ? `billed $${PREMIUM_PLAN_USD.yearly}/year · USD`
      : `or $${PREMIUM_PLAN_USD.yearly}/year · USD`
    : yearly
      ? `billed ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · under ${PREMIUM_PER_DAY} a day · incl. GST`
      : `or ₹${PREMIUM_PLAN.yearly.toLocaleString("en-IN")}/year · incl. GST`;

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border-2 border-neutral-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-colors ${!yearly ? "bg-ink text-white" : "text-neutral-500 hover:text-ink"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-semibold transition-colors ${yearly ? "bg-ink text-white" : "text-neutral-500 hover:text-ink"}`}
          >
            Yearly
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${yearly ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
              Save {savePct}%
            </span>
          </button>
        </div>
      </div>

      <div className={`mt-10 grid gap-5 ${feeOnly ? "mx-auto max-w-lg" : "md:grid-cols-2"}`}>
        {/* Starter — free (hidden in interim fee-only mode; free signup still works) */}
        {!feeOnly && (
          <PlanCard plan={freePlan} yearly={yearly} savePct={savePct}>
            <div className="mt-6 flex items-end gap-2">
              <span className="font-heading text-5xl font-extrabold text-ink">{intl ? "$0" : "₹0"}</span>
              <span className="mb-1.5 text-sm text-neutral-400">/ forever</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              We take 5% when you get paid. Nothing when you don't.
            </p>
            <Link
              to={ROUTE_START}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline"
            >
              {startLabel}
            </Link>
          </PlanCard>
        )}

        {/* Pro — premium */}
        <PlanCard plan={PREMIUM_PLAN} yearly={yearly} savePct={savePct}>
          <div className="mt-6 flex items-end gap-2">
            <span className="font-heading text-5xl font-extrabold text-ink">{displayPrice}</span>
            <span className="mb-1.5 text-sm text-neutral-400">/ month</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">{priceNote}</p>
          <Link
            to={intl ? "/contact" : ROUTE_START}
            className="mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline"
            style={{ background: PREMIUM_PLAN.accent }}
          >
            {intl ? "Get early access" : "Go Premium"}
          </Link>
        </PlanCard>
      </div>
    </div>
  );
}
