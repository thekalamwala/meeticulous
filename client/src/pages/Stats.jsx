import { Link } from "react-router-dom";
import { Percent, Smartphone, FileText, MapPin, Wrench, BookOpen } from "lucide-react";
import Seo from "../components/common/Seo";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";
import { FEATURES } from "./features/featureData";
import { GLOSSARY } from "../data/glossaryData";

/**
 * /stats — "Meeticulous by the numbers": durable, citable product facts for
 * press and link reference. Deliberately NOT vanity growth metrics (bookings/
 * GMV) — those aren't publication-ready yet (see docs/seo-aeo-audit.md Pillar 4);
 * this page states what the product IS. Counts that CAN drift are derived from
 * the real source arrays (features, glossary) so they stay accurate.
 */

const CANONICAL = `${SITE_URL}/stats`;
const TOOLS_COUNT = 3; // /tools: no-show, GST, earnings — keep in sync with ToolsIndex

const FACTS = [
  { icon: Percent, value: "0%", label: "Commission on paid plans", sub: "A flat fee, never a cut of what you earn" },
  { icon: Smartphone, value: "UPI", label: "Payments, India-native", sub: "PhonePe, Google Pay, Paytm, cards & net banking via Razorpay" },
  { icon: FileText, value: "Auto", label: "GST invoices", sub: "Tax-ready invoice generated on every paid booking" },
  { icon: MapPin, value: "🇮🇳", label: "Made in India", sub: "Built in Odisha for Indian professionals" },
  { icon: Wrench, value: String(FEATURES.length), label: "Core features", sub: "Scheduling, payments, reminders, calendar & more" },
  { icon: BookOpen, value: String(GLOSSARY.length), label: "Glossary terms", sub: "Plain-English booking & scheduling definitions" },
];

const Stats = () => (
  <div className="min-h-dvh bg-canvas text-ink">
    <Seo
      title="Meeticulous by the Numbers — Fast Facts"
      description="Fast facts about Meeticulous: 0% commission on paid plans, UPI payments, automatic GST invoices, made in India. The citable facts for press and reference."
      canonical={CANONICAL}
      jsonLd={[
        collectionPageJsonLd({
          name: "Meeticulous by the numbers",
          description: "Fast, citable product facts about Meeticulous — 0% commission, UPI payments, GST invoices, made in India.",
          url: CANONICAL,
        }),
        breadcrumbJsonLd({ items: [{ name: "Home", path: "/" }, { name: "Stats", path: "/stats" }] }),
      ]}
    />

    <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>→</span> By the numbers
      </nav>

      <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">Meeticulous by the numbers</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        The facts that matter for people who sell their time — and for anyone writing about us.
        Free to cite; link back to this page.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FACTS.map(({ icon: Icon, value, label, sub }) => (
          <div key={label} className="rounded-[16px] border border-black/10 bg-white p-6">
            <Icon size={18} className="text-primary" />
            <p className="mt-3 font-heading text-3xl font-extrabold text-ink">{value}</p>
            <p className="mt-1 font-semibold text-ink">{label}</p>
            <p className="mt-1 text-sm text-neutral-600">{sub}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-[16px] border border-black/10 bg-white p-6 sm:p-8">
        <h2 className="font-heading text-xl font-bold">What Meeticulous does</h2>
        <p className="mt-2 leading-relaxed text-neutral-700">
          One link that lets a professional show their services, take bookings and get paid upfront
          over UPI — with automatic WhatsApp and email reminders, Google Calendar sync and GST-ready
          invoices. On paid plans there's 0% commission, so you keep what you earn. Also {TOOLS_COUNT}{" "}
          free <Link to="/tools" className="text-primary hover:underline">calculators</Link> and a{" "}
          <Link to="/glossary" className="text-primary hover:underline">glossary</Link> of booking terms.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          Growth figures (bookings, GMV) aren't published yet — we'll add them here once they're
          large enough to be meaningful. For data requests, see <Link to="/press" className="text-primary hover:underline">press</Link>.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/be-a-sloth" className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-white hover:no-underline">
          Create your booking page
        </Link>
        <Link to="/press" className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-5 py-2.5 font-semibold text-ink hover:no-underline">
          Press kit
        </Link>
      </div>
    </main>
  </div>
);

export default Stats;
