import { Link } from "react-router-dom";
import { CalendarX, Receipt, Wallet, ArrowRight } from "lucide-react";
import Seo from "../../components/common/Seo";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../../utils/seo";

/**
 * /tools — hub for Meeticulous's free calculators. A thin, crawlable index that
 * links every tool (so they're one click from here and discoverable), with
 * CollectionPage + BreadcrumbList JSON-LD.
 */

const CANONICAL = `${SITE_URL}/tools`;

const TOOLS = [
  {
    to: "/tools/no-show-cost-calculator",
    icon: CalendarX,
    title: "No-show cost calculator",
    desc: "See what missed appointments cost you a year — and how much upfront payment and reminders recover.",
  },
  {
    to: "/tools/gst-calculator",
    icon: Receipt,
    title: "GST calculator for services",
    desc: "Add or extract GST on a service fee, with the CGST/SGST split. Built for Indian professionals.",
  },
  {
    to: "/earnings-calculator",
    icon: Wallet,
    title: "Earnings calculator",
    desc: "See your annual take-home on each plan, and how much more 0% commission keeps in your pocket.",
  },
];

const ToolsIndex = () => (
  <div className="min-h-dvh bg-canvas text-ink">
    <Seo
      title="Free Tools & Calculators for Professionals — Meeticulous"
      description="Free calculators for people who sell their time: work out the cost of no-shows, GST on your services, and your earnings on each plan. No sign-up needed."
      canonical={CANONICAL}
      jsonLd={[
        collectionPageJsonLd({
          name: "Tools & calculators",
          description: "Free calculators for Indian professionals — no-show cost, GST on services, and earnings.",
          url: CANONICAL,
          items: TOOLS.map((t) => ({ url: t.to, name: t.title })),
        }),
        breadcrumbJsonLd({ items: [{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }] }),
      ]}
    />

    <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">Free tools &amp; calculators</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Quick, free calculators for people who sell their time — no sign-up, no catch. Work out what
        no-shows cost you, the GST on your services, and what you'd take home on each plan.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TOOLS.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} className="group rounded-[16px] border border-black/10 bg-white p-6 transition hover:border-primary/40 hover:no-underline">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <Icon size={22} />
            </span>
            <h2 className="mt-4 font-heading text-lg font-bold text-ink">{title}</h2>
            <p className="mt-1.5 text-sm text-neutral-600">{desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Open <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-neutral-500">
        Ready to take bookings and get paid upfront? <Link to="/become-a-host" className="text-primary hover:underline">Create your booking page</Link>.
      </p>
    </main>
  </div>
);

export default ToolsIndex;
