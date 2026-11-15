import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * ProTeaser — the shared "locked Pro feature" pattern: the real feature rendered
 * behind the glass, blurred + aria-hidden, under a translucent overlay with an
 * attributed upgrade CTA. Lets a free host see the *shape* of what Pro unlocks at
 * the friction moment (a hit cap, an empty lane) instead of a dead greyed-out row.
 *
 * Canonical replacement for the hand-rolled blur overlays in ConversionFunnel /
 * ClientsList / Products — one look, and every CTA carries ?src for measurement.
 *
 * Props:
 *   children     — the sample/real feature content shown blurred behind the glass
 *   title, sub   — overlay headline + one line of why
 *   ctaLabel     — CTA text (default "Upgrade to Pro")
 *   src          — attribution tag → /dashboard/upgrade?src=<src>
 */
export default function ProTeaser({ children, title, sub, ctaLabel = 'Upgrade to Pro', src }) {
  const to = `/dashboard/upgrade${src ? `?src=${src}` : ''}`;
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-maroon/15 bg-white p-4 sm:p-5">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-cream/55 p-4 backdrop-blur-[2px]">
        <div className="max-w-xs text-center">
          <h3 className="mb-1 font-display font-bold text-maroon">{title}</h3>
          <p className="mb-3 text-sm text-ink/60">{sub}</p>
          <Link
            to={to}
            className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-dark"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </section>
  );
}
