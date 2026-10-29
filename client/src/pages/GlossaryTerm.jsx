import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Seo from "../components/common/Seo";
import { SITE_URL, glossaryTermJsonLd } from "../utils/seo";
import { glossaryBySlug, GLOSSARY } from "../data/glossaryData";

/**
 * /glossary/:slug — a single glossary term. Answer-first definition (first
 * sentence stands alone for AEO), related terms, and a CTA. DefinedTerm +
 * WebPage + BreadcrumbList JSON-LD via glossaryTermJsonLd. Unknown slug → /glossary.
 * Optional `details` (paragraphs) and `example` render below the definition.
 */

const titleFor = (term) => {
  const t = `What is ${term.replace(/^(a|an)\s+/i, "")}? — Meeticulous`;
  return t.length <= 60 ? t : `${term} — Meeticulous glossary`;
};

const GlossaryTerm = () => {
  const { slug } = useParams();
  const entry = glossaryBySlug(slug);
  if (!entry) return <Navigate to="/glossary" replace />;

  const canonical = `${SITE_URL}/glossary/${entry.slug}`;
  const related = (entry.related || []).map(glossaryBySlug).filter(Boolean);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Seo
        title={titleFor(entry.term)}
        description={entry.def.length <= 160 ? entry.def : `${entry.def.slice(0, 157).trimEnd()}…`}
        canonical={canonical}
        jsonLd={glossaryTermJsonLd({
          slug: entry.slug,
          term: entry.term,
          definition: entry.def,
          breadcrumbName: entry.term,
        })}
      />

      <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <nav className="mb-6 text-sm text-neutral-500">
          <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>→</span>{" "}
          <Link to="/glossary" className="hover:text-ink">Glossary</Link> <span aria-hidden>→</span> {entry.term}
        </nav>

        <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">{entry.term}</h1>
        <p id="definition" className="mt-4 text-lg leading-relaxed text-neutral-700">{entry.def}</p>

        {entry.details?.length > 0 && (
          <section className="mt-8 space-y-4 leading-relaxed text-neutral-700">
            <h2 className="font-heading text-xl font-bold text-ink">{`Why ${entry.term.toLowerCase()} matters`}</h2>
            {entry.details.map((para, i) => <p key={i}>{para}</p>)}
          </section>
        )}

        {entry.example && (
          <div className="mt-8 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-neutral-500">Example</h2>
            <p className="mt-2 leading-relaxed text-neutral-700">{entry.example}</p>
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-neutral-500">Related terms</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <Link key={r.slug} to={`/glossary/${r.slug}`} className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm font-medium text-ink hover:border-primary/40 hover:no-underline">
                  {r.term}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 rounded-[16px] border border-black/10 bg-white p-6">
          <p className="text-neutral-600">
            Meeticulous turns these into one link: a booking page with upfront payment over UPI, GST
            invoices and automatic reminders.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/become-a-host" className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-white hover:no-underline">
              Create your booking page
            </Link>
            <Link to="/glossary" className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-5 py-2.5 font-semibold text-ink hover:no-underline">
              <ArrowLeft size={15} /> All terms ({GLOSSARY.length})
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GlossaryTerm;
