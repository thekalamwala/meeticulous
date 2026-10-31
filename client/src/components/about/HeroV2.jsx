import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { hero } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

// Static H1 (no typewriter): the About hero has to state what Meeticulous is in
// the first line, for people and crawlers alike — an animated word swap made the
// heading's text change over time and never named the product.
//
// Layout: text on the light page panel, a full-height photo on the right whose
// left edge is a soft curve — the panel bulges into the photo (clipPath below).
// Below lg the photo stacks under the text as a plain rounded image.

// Curve in the photo's own 0–1 box: starts at the top-left corner, bulges ~24%
// into the photo just past mid-height, eases back to ~20% at the bottom.
const CURVE = "M0,0 C0.13,0.06 0.25,0.28 0.24,0.55 C0.235,0.75 0.215,0.9 0.2,1 L1,1 L1,0 Z";

export default function HeroV2() {
  return (
    <section className="relative overflow-hidden bg-white">
      <svg aria-hidden width="0" height="0" className="absolute">
        <clipPath id="about-hero-curve" clipPathUnits="objectBoundingBox">
          <path d={CURVE} />
        </clipPath>
      </svg>

      {/* Desktop photo — fills the right ~56% edge to edge, curved on the left */}
      <div
        className="absolute inset-y-0 right-0 hidden w-[56%] lg:block"
        style={{ clipPath: "url(#about-hero-curve)" }}
      >
        <ImgWithSkeleton src={hero.image} alt={hero.imageAlt} fallbackLabel="Meeticulous" loading="eager" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 lg:flex lg:min-h-[560px] lg:items-center lg:py-20">
        <div className="lg:max-w-[52%] lg:pr-6">
          <h1 className="font-heading font-extrabold leading-[1.08] text-[clamp(2.4rem,5vw,3.75rem)]">
            {hero.title} <span className="text-primary-cta">{hero.titleAccent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to={hero.ctaPrimaryHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-cta px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
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
              className="inline-flex items-center justify-center rounded-[6px] border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:no-underline hover:opacity-90"
            >
              {hero.ctaGhost}
            </a>
          </div>
        </div>

        {/* Mobile / tablet photo — stacked under the copy */}
        <div className="mt-10 aspect-[4/3] overflow-hidden rounded-[10px] bg-sand lg:hidden">
          <ImgWithSkeleton src={hero.image} alt="" fallbackLabel="Meeticulous" />
        </div>
      </div>
    </section>
  );
}
