import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PAGE_GUIDES } from "../../data/pageGuides";

// /for/* and /features/* pages render <PageGuides /> themselves, directly above
// their FAQ (the /for pages also draw their own footer, so an App-level mount
// landed BELOW it). App skips these routes to avoid a double render.
export const GUIDES_IN_PAGE = /^\/(for|features)\//;

/**
 * "Guides" strip on product, tool, profession and glossary pages that have an
 * entry in PAGE_GUIDES. App mounts it above the footer for most routes; /for and
 * /features place it above their FAQ. Renders nothing on unmapped routes.
 */
export default function PageGuides({ pathname }) {
  const location = useLocation();
  const guides = PAGE_GUIDES[(pathname ?? location.pathname).replace(/\/+$/, "")];
  if (!guides?.length) return null;

  return (
    <section aria-labelledby="page-guides-title" className="bg-canvas px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 id="page-guides-title" className="font-heading text-2xl font-extrabold text-ink">Guides</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                to={`/blog/${g.slug}`}
                className="group flex h-full items-start justify-between gap-3 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-colors hover:border-primary/30 hover:no-underline"
              >
                <span className="font-heading text-[15px] font-bold leading-snug text-ink">{g.title}</span>
                <ArrowRight size={16} className="mt-0.5 flex-shrink-0 text-primary-cta transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
