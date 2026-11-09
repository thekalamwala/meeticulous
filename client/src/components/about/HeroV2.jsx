import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { hero } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

// Static H1 (no typewriter): the About hero has to state what Meeticulous is in
// the first line, for people and crawlers alike — an animated word swap made the
// heading's text change over time and never named the product.
//
// Layout (lg+): the photo covers the WHOLE hero edge to edge; the text sits on
// a white panel over its left side, whose right edge is a soft curve bulging
// into the photo (clipPath below). Below lg the photo stacks under the text as
// a plain rounded image.

// White panel in its own 0–1 box (it spans the left 58% of the hero): straight
// top/left/bottom; the right edge starts ~76% across at the top, bulges to the
// full width just past mid-height, and eases back to ~95% at the bottom.
const PANEL = "M0,0 H0.76 C0.885,0.06 1,0.28 0.99,0.55 C0.985,0.75 0.967,0.9 0.952,1 H0 Z";

export default function HeroV2() {
  return (
    <section className="relative overflow-hidden bg-canvas">
      <svg aria-hidden width="0" height="0" className="absolute">
        <clipPath id="about-hero-panel" clipPathUnits="objectBoundingBox">
          <path d={PANEL} />
        </clipPath>
      </svg>

      {/* Desktop: full-bleed photo behind everything, then the curved cream panel */}
      <div className="absolute inset-0 hidden lg:block">
        {/* Focus right of centre — the left part sits under the cream panel */}
        <ImgWithSkeleton src={hero.image} alt={hero.imageAlt} fallbackLabel="Meeticulous" loading="eager" imgClassName="object-[75%_50%]" />
      </div>
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 hidden w-[58%] bg-canvas lg:block"
        style={{ clipPath: "url(#about-hero-panel)" }}
      />

      {/* lg+: left-anchor the copy to the page gutter (mr-auto) so it hugs the
          left of the cream panel near the nav logo, instead of drifting right
          with mx-auto centering as the viewport widens. Mobile stays centered. */}
      <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 lg:ml-20 lg:mr-auto lg:flex lg:min-h-[calc(100svh-57px)] lg:items-center lg:py-20">
        <div className="lg:max-w-[52%] lg:pr-6">
          <h1 className="font-display font-extrabold leading-[1.08] text-[clamp(2.4rem,5vw,3.75rem)]">
            {hero.title} <span className="text-rose">{hero.titleAccent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to={hero.ctaPrimaryHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-cta px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
            >
              {hero.ctaPrimary}
              <ArrowRight size={16} />
            </Link>
            {/* In-page jump to the story below — a plain anchor, smooth-scrolled */}
            <a
              href={hero.ctaGhostHref}
              onClick={(e) => {
                const target = document.querySelector(hero.ctaGhostHref);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:no-underline hover:opacity-90"
            >
              {hero.ctaGhost}
            </a>
          </div>
        </div>

        {/* Mobile / tablet photo — stacked under the copy */}
        <div className="mt-10 aspect-[4/3] overflow-hidden rounded-[16px] bg-sand lg:hidden">
          <ImgWithSkeleton src={hero.image} alt="" fallbackLabel="Meeticulous" />
        </div>
      </div>
    </section>
  );
}
