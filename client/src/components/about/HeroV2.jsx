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
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-12 sm:px-8 lg:min-h-[calc(100svh-57px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-8 lg:py-20">
        <div className="lg:pr-6">
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
