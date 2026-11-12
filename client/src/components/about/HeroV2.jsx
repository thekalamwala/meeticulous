import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { hero } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

// Static H1 (no typewriter): the About hero has to state what Meeticulous is in
// the first line, for people and crawlers alike — an animated word swap made the
// heading's text change over time and never named the product.
//
// Layout: copy on the left, the full silhouette image on the right (contained,
// never cropped). Stacks copy → image below lg. No curved panel: the art sits
// directly on the cream page background.

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

        {/* Whole silhouette on the right — aspect-[3/2] matches the asset, so
            object-contain shows every pixel without cropping or a C-shaped cut. */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-[620px]">
            <ImgWithSkeleton
              src={hero.image}
              alt={hero.imageAlt}
              fallbackLabel="Meeticulous"
              loading="eager"
              objectFit="contain"
              className="aspect-[3/2]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
