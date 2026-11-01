/**
 * Pagination.jsx — "Meeeeeeeeeet" doodle pager for Explore, à la Google's
 * "Goooogle". The word always spells "Meet" with a fixed TEN e's — one per page
 * slot, left→right = pages 1‥10. The current page's 'e' lights up in a palette
 * colour; e's for pages that exist stay clickable greyscale; e's past the real
 * page count are dimmed and dead. M/t are decoration. Arrows carry
 * rel="prev"/"next" and scroll to top on change.
 *
 * Props: page, totalPages, hrefFor(pageNum) => string
 */
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Ten fixed slots so the brand word is always "Meeeeeeeeeet".
const SLOTS = 10;
// Founder palette (photo), black/white excluded. Cycled by page → across 10
// slots each colour lands exactly twice. Only the active o shows its colour.
const PAGE_COLORS = ['#960D32', '#FF4D93', '#4AB765', '#FFCC1C', '#269CEF'];
const colorFor = (p) => PAGE_COLORS[(p - 1) % PAGE_COLORS.length];

const wordBase = 'font-heading text-4xl font-extrabold tracking-tight sm:text-5xl';
const arrowBase =
  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150';

export default function Pagination({ page, totalPages, hrefFor }) {
  // Show the full "Meeeeeeeeeet" word from the first page on as brand
  // decoration — only truly empty results (no pages) hide it.
  if (!totalPages) return null;
  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const slots = Array.from({ length: SLOTS }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-2 mt-10" aria-label="Pagination">
      <Link
        to={hrefFor(Math.max(1, page - 1))}
        rel="prev"
        aria-label="Previous page"
        aria-disabled={page === 1}
        onClick={(e) => (page === 1 ? e.preventDefault() : toTop())}
        className={`${arrowBase} ${page === 1
          ? 'pointer-events-none text-gray-300'
          : 'text-gray-600 hover:bg-black/[0.04] hover:text-ink'}`}
      >
        <ChevronLeft size={18} />
      </Link>

      {/* M-eeeeeeeeee-t. Ten e's: real pages link, the rest are dead word. */}
      <span className={`${wordBase} select-none flex items-baseline`}>
        <span className="text-gray-300" aria-hidden="true">M</span>
        {slots.map((p) => {
          const real = p <= totalPages;
          const active = p === page;
          // Past the real page count: decorative dim 'e', not a link.
          if (!real) {
            return <span key={p} className="text-gray-200" aria-hidden="true">e</span>;
          }
          return (
            <Link
              key={p}
              to={hrefFor(p)}
              aria-label={`Page ${p}`}
              aria-current={active ? 'page' : undefined}
              onClick={toTop}
              style={active ? { color: colorFor(p) } : undefined}
              className={`transition-colors duration-150 ${active
                ? ''
                : 'text-gray-300 hover:text-gray-500'}`}
            >
              e
            </Link>
          );
        })}
        <span className="text-gray-300" aria-hidden="true">t</span>
      </span>

      <Link
        to={hrefFor(Math.min(totalPages, page + 1))}
        rel="next"
        aria-label="Next page"
        aria-disabled={page === totalPages}
        onClick={(e) => (page === totalPages ? e.preventDefault() : toTop())}
        className={`${arrowBase} ${page === totalPages
          ? 'pointer-events-none text-gray-300'
          : 'text-gray-600 hover:bg-black/[0.04] hover:text-ink'}`}
      >
        <ChevronRight size={18} />
      </Link>
    </nav>
  );
}
