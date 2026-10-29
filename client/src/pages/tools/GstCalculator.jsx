import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Receipt, ArrowRight } from "lucide-react";
import Seo from "../../components/common/Seo";
import { SITE_URL, toolAppJsonLd } from "../../utils/seo";
import { gstBreakdown, GST_RATES } from "../../lib/gstCalc";

/**
 * /tools/gst-calculator — a free, linkable, India-specific tool. Enter a service
 * fee, pick the GST slab, and toggle whether the fee already includes GST; see the
 * base, GST amount (with CGST/SGST split) and total. All math is in lib/gstCalc.js.
 * General information only — not tax advice.
 */

const CANONICAL = `${SITE_URL}/tools/gst-calculator`;

const inr = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);

const FAQS = [
  {
    q: "What is the GST rate on professional and booking services in India?",
    a: "Most professional, consulting and appointment-based services are taxed at 18% GST. A few categories fall under 5% or 12%; pick the slab that applies to you in the calculator. GST registration is generally required once your turnover crosses the threshold (₹20 lakh for services in most states, ₹10 lakh in special-category states).",
  },
  {
    q: "What's the difference between GST-inclusive and GST-exclusive?",
    a: "Exclusive means your fee is the net amount and GST is added on top (fee ₹1,000 + 18% = ₹1,180). Inclusive means GST is already inside the price you quote, so the calculator works backwards to show how much of it is tax. Use the toggle to switch.",
  },
  {
    q: "What are CGST and SGST?",
    a: "For a supply within your own state, the 18% GST is split evenly into 9% CGST (central) and 9% SGST (state). For an inter-state supply it's a single IGST of the same total. The calculator shows the intra-state CGST/SGST split.",
  },
  {
    q: "Does Meeticulous handle GST invoices?",
    a: "Yes — every paid booking can generate a GST-ready invoice automatically, so you don't need a separate invoicing tool. See host fees for details.",
  },
];

const GstCalculator = () => {
  const [amount, setAmount] = useState(1000);
  const [rate, setRate] = useState(18);
  const [inclusive, setInclusive] = useState(false);

  const r = useMemo(
    () => gstBreakdown({ amount: Number(amount), ratePct: Number(rate), inclusive }),
    [amount, rate, inclusive],
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Seo
        title="GST Calculator for Services (India) — Add or Extract GST"
        description="Free GST calculator for Indian professionals: enter a service fee, pick the slab (5/12/18/28%), and see the base, GST, CGST/SGST split and total. Inclusive or exclusive."
        canonical={CANONICAL}
        jsonLd={toolAppJsonLd({
          canonical: CANONICAL,
          name: "GST Calculator for Services",
          description: "Add GST to a net service fee or extract GST from a gross fee, with the CGST/SGST split, for Indian professionals.",
          breadcrumbName: "GST Calculator",
          faqs: FAQS,
        })}
      />

      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link to="/tools" className="hover:text-ink">Tools</Link> <span aria-hidden>→</span> GST Calculator
        </nav>

        <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
          GST calculator for services
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Work out the GST on a professional or booking service in seconds — add it to your fee, or
          pull it out of a price that already includes it. Shows the CGST/SGST split for an
          intra-state supply.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-5 rounded-[16px] border border-black/10 bg-sand/40 p-5 sm:p-6">
            <label className="block">
              <span className="text-sm font-bold text-ink">Service fee</span>
              <span className="mt-2 flex items-center gap-2 rounded-[12px] border border-black/10 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25">
                <span className="text-neutral-400">₹</span>
                <input
                  type="number" inputMode="decimal" min={0} step={50} value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border-0 bg-transparent p-0 text-lg font-bold text-ink outline-none focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label="Service fee"
                />
              </span>
            </label>

            <div>
              <span className="text-sm font-bold text-ink">GST rate</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {GST_RATES.map((g) => (
                  <button
                    key={g} type="button" onClick={() => setRate(g)}
                    className={`rounded-[10px] border px-3.5 py-1.5 text-sm font-semibold transition ${
                      Number(rate) === g ? "border-primary bg-primary text-white" : "border-black/10 bg-white text-ink hover:border-black/20"
                    }`}
                    aria-pressed={Number(rate) === g}
                  >
                    {g}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm font-bold text-ink">Is the fee GST-inclusive?</span>
              <div className="mt-2 inline-flex rounded-[10px] border border-black/10 bg-white p-1">
                <button type="button" onClick={() => setInclusive(false)} aria-pressed={!inclusive}
                  className={`rounded-[8px] px-4 py-1.5 text-sm font-semibold ${!inclusive ? "bg-primary text-white" : "text-ink"}`}>
                  Add GST
                </button>
                <button type="button" onClick={() => setInclusive(true)} aria-pressed={inclusive}
                  className={`rounded-[8px] px-4 py-1.5 text-sm font-semibold ${inclusive ? "bg-primary text-white" : "text-ink"}`}>
                  Extract GST
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[12px] border border-black/10 bg-white px-5 py-3.5">
              <span className="text-sm text-neutral-600">Base amount</span>
              <span className="font-heading text-xl font-extrabold text-ink">{inr(r.base)}</span>
            </div>
            <div className="flex items-center justify-between rounded-[12px] border border-black/10 bg-white px-5 py-3.5">
              <span className="text-sm text-neutral-600">GST ({r.ratePct}%)</span>
              <span className="font-heading text-xl font-extrabold text-ink">{inr(r.gst)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[12px] border border-black/10 bg-white px-5 py-3">
                <span className="text-xs text-neutral-500">CGST</span>
                <p className="font-heading text-lg font-bold text-ink">{inr(r.cgst)}</p>
              </div>
              <div className="rounded-[12px] border border-black/10 bg-white px-5 py-3">
                <span className="text-xs text-neutral-500">SGST</span>
                <p className="font-heading text-lg font-bold text-ink">{inr(r.sgst)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[14px] border border-primary/20 bg-primary/5 px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-primary"><Receipt size={16} /> Total payable</span>
              <span className="font-heading text-2xl font-extrabold text-primary">{inr(r.total)}</span>
            </div>
            <p className="text-xs text-neutral-500">General information, not tax advice. Confirm your slab and registration status with a professional.</p>
          </div>
        </div>

        <div className="mt-10 rounded-[16px] border border-black/10 bg-white p-6 sm:p-8">
          <h2 className="font-heading text-xl font-bold">Skip the invoicing admin</h2>
          <p className="mt-2 max-w-2xl text-neutral-600">
            Meeticulous generates GST-ready invoices automatically on every paid booking, and
            collects payment over UPI at the time of booking — no separate accounting tool.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/become-a-host" className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-white hover:no-underline">
              Start taking bookings <ArrowRight size={16} />
            </Link>
            <Link to="/host-fees" className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-5 py-2.5 font-semibold text-ink hover:no-underline">
              Host fees & GST
            </Link>
          </div>
        </div>

        <section id="faq" className="mt-12 scroll-mt-16">
          <h2 className="font-heading text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-black/5">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-10 text-sm text-neutral-500">
          Also try the <Link to="/tools/no-show-cost-calculator" className="text-primary hover:underline">no-show cost calculator</Link> and the{" "}
          <Link to="/earnings-calculator" className="text-primary hover:underline">earnings calculator</Link>.
        </p>
      </main>
    </div>
  );
};

export default GstCalculator;
