import { Link } from "react-router-dom";
import Seo from "../components/common/Seo";
import { SITE_URL, definedTermSetJsonLd, breadcrumbJsonLd } from "../utils/seo";
import { GLOSSARY } from "../data/glossaryData";

/**
 * /glossary — the booking & scheduling glossary index. A crawlable A–Z of the
 * definitional terms Meeticulous's audience searches ("what is a booking page",
 * "what is a no-show"), each linking to its own term page. DefinedTermSet +
 * BreadcrumbList JSON-LD.
 */

const CANONICAL = `${SITE_URL}/glossary`;
const SORTED = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

const Glossary = () => (
  <div className="min-h-dvh bg-canvas text-ink">
    <Seo
      title="Booking & Scheduling Glossary — Meeticulous"
      description="Plain-English definitions of booking and scheduling terms — booking page, no-show, advance payment, buffer time, UPI, GST invoice and more. The Meeticulous glossary."
      canonical={CANONICAL}
      jsonLd={[
        definedTermSetJsonLd({
          url: "/glossary",
          name: "Meeticulous booking & scheduling glossary",
          description: "Plain-English definitions of booking, scheduling and payment terms for Indian professionals.",
          terms: GLOSSARY,
        }),
        breadcrumbJsonLd({ items: [{ name: "Home", path: "/" }, { name: "Glossary", path: "/glossary" }] }),
      ]}
    />

    <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>→</span> Glossary
      </nav>

      <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
        Booking &amp; scheduling glossary
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Plain-English definitions of the booking, scheduling and payment terms that come up when you
        sell your time — from <em>booking page</em> and <em>no-show</em> to <em>UPI</em> and{" "}
        <em>GST invoice</em>.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SORTED.map((g) => (
          <Link
            key={g.slug}
            to={`/glossary/${g.slug}`}
            className="rounded-[14px] border border-black/10 bg-white p-5 transition hover:border-primary/40 hover:no-underline"
          >
            <h2 className="font-heading text-base font-bold text-ink">{g.term}</h2>
            <p className="mt-1 text-sm text-neutral-600">{g.short}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-neutral-500">
        Ready to put these into practice? <Link to="/be-a-sloth" className="text-primary hover:underline">Create your booking page</Link> or try the{" "}
        <Link to="/tools" className="text-primary hover:underline">free calculators</Link>.
      </p>
    </main>
  </div>
);

export default Glossary;
