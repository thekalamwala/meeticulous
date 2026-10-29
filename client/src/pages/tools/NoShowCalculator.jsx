import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarX, TrendingDown, BellRing, ArrowRight } from "lucide-react";
import Seo from "../../components/common/Seo";
import { SITE_URL, toolAppJsonLd } from "../../utils/seo";
import { noShowCost } from "../../lib/noShowCalc";

/**
 * /tools/no-show-cost-calculator — a free, linkable tool: a professional enters
 * their monthly bookings, average value and no-show rate, and sees the rupees
 * no-shows cost them a year, plus how much upfront payment + reminders could
 * recover. All numbers are the user's own inputs (lib/noShowCalc.js) — no
 * platform claims, no invented data.
 */

const CANONICAL = `${SITE_URL}/tools/no-show-cost-calculator`;

const inr = (n) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

const FAQS = [
  {
    q: "How is the cost of a no-show calculated?",
    a: "No-shows per month = your monthly bookings × your no-show rate. Multiply that by the average value of a booking to get the monthly loss, then by 12 for the annual figure. This calculator does exactly that with the numbers you enter.",
  },
  {
    q: "What is an average no-show rate for appointments?",
    a: "It varies widely by industry — many service businesses see 10–30% of booked appointments turn into no-shows, and it is higher for free-to-book slots with no reminder. Enter your own rate for an accurate figure; use 15–20% as a starting estimate if you don't track it yet.",
  },
  {
    q: "How do I reduce no-shows?",
    a: "The two biggest levers are taking payment upfront at the time of booking (a paid slot is rarely skipped) and sending automatic reminders — WhatsApp reminders in particular see 95%+ open rates in India. Meeticulous does both out of the box.",
  },
  {
    q: "Is this calculator free?",
    a: "Yes — it's a free tool, no sign-up needed. Meeticulous itself is free to start, then flat-fee plans with 0% commission.",
  },
];

function Field({ label, hint, value, onChange, min, max, step, prefix, suffix }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      <span className="mt-2 flex items-center gap-2 rounded-[12px] border border-black/10 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/25">
        {prefix && <span className="text-neutral-400">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-0 bg-transparent p-0 text-lg font-bold text-ink outline-none focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-label={label}
        />
        {suffix && <span className="text-neutral-400">{suffix}</span>}
      </span>
    </label>
  );
}

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-[14px] border border-black/10 bg-white p-5">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon size={16} className={accent ? "text-primary" : ""} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 font-heading text-3xl font-extrabold ${accent ? "text-primary" : "text-ink"}`}>{value}</p>
    </div>
  );
}

const NoShowCalculator = () => {
  const [bookings, setBookings] = useState(40);
  const [value, setValue] = useState(1200);
  const [rate, setRate] = useState(18);

  const r = useMemo(
    () => noShowCost({ bookingsPerMonth: Number(bookings), avgValue: Number(value), noShowRatePct: Number(rate) }),
    [bookings, value, rate],
  );

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Seo
        title="No-Show Cost Calculator — What Missed Appointments Cost You"
        description="Free calculator: see what appointment no-shows cost your business per year, and how much upfront payment and reminders could recover. Built for Indian professionals."
        canonical={CANONICAL}
        jsonLd={toolAppJsonLd({
          canonical: CANONICAL,
          name: "No-Show Cost Calculator",
          description: "Work out the annual cost of appointment no-shows and how much upfront payment and reminders could recover.",
          breadcrumbName: "No-Show Cost Calculator",
          faqs: FAQS,
        })}
      />

      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link to="/tools" className="hover:text-ink">Tools</Link> <span aria-hidden>→</span> No-Show Cost Calculator
        </nav>

        <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
          No-show cost calculator
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Every missed appointment is a slot you can't resell and time you can't bill. Enter your
          numbers to see what no-shows cost you in a year — and how much you'd stop losing by taking
          payment upfront and sending reminders.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-5 rounded-[16px] border border-black/10 bg-sand/40 p-5 sm:p-6">
            <Field label="Bookings per month" hint="How many appointments you take in a typical month" value={bookings} onChange={setBookings} min={0} max={10000} step={1} />
            <Field label="Average booking value" hint="What one booking is worth to you" value={value} onChange={setValue} min={0} max={1000000} step={50} prefix="₹" />
            <Field label="No-show rate" hint="Share of bookings that don't show up" value={rate} onChange={setRate} min={0} max={100} step={1} suffix="%" />
          </div>

          <div className="space-y-4">
            <Stat icon={CalendarX} label="No-shows / month" value={new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(r.monthlyNoShows)} />
            <Stat icon={TrendingDown} label="Lost per month" value={inr(r.monthlyLost)} />
            <Stat icon={TrendingDown} label="Lost per year" value={inr(r.annualLost)} accent />
            <div className="rounded-[14px] border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary">
                <BellRing size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Recoverable / year</span>
              </div>
              <p className="mt-2 font-heading text-3xl font-extrabold text-primary">{inr(r.recoverableAnnual)}</p>
              <p className="mt-1 text-xs text-neutral-600">
                If upfront payment + reminders cut your no-show rate to ~5%. A prepaid slot is rarely skipped.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[16px] border border-black/10 bg-white p-6 sm:p-8">
          <h2 className="font-heading text-xl font-bold">Stop losing that money</h2>
          <p className="mt-2 max-w-2xl text-neutral-600">
            Meeticulous collects payment when a client books and sends automatic WhatsApp + email
            reminders before every appointment — the two things that cut no-shows most.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/be-a-sloth" className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-white hover:no-underline">
              Create your booking page <ArrowRight size={16} />
            </Link>
            <Link to="/features/notifications" className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-5 py-2.5 font-semibold text-ink hover:no-underline">
              How reminders work
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-5 py-2.5 font-semibold text-ink hover:no-underline">
              See pricing
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
          Also try the <Link to="/tools/gst-calculator" className="text-primary hover:underline">GST calculator</Link> and the{" "}
          <Link to="/earnings-calculator" className="text-primary hover:underline">earnings calculator</Link>.
        </p>
      </main>
    </div>
  );
};

export default NoShowCalculator;
