// client/src/pages/Moments.jsx
// Moments archive index. Route: /moments. Google-Doodle-style: recent moment as a
// wide horizontal card up top, then a horizontally-scrolling row of the rest with
// a "next" arrow. Renders from the static moments data.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import Seo from '../components/common/Seo';
import { MOMENTS, FEATURED } from '../data/moments';

// Fixed share card for the archive index — constant, unlike the featured
// moment's art which changes as moments are added. Upload once to the CDN.
const OG_IMAGE = 'https://company-assets.meeticulous.in/images/moments/moments-og.png';

export default function Moments() {
  const rest = MOMENTS.slice(1);
  const railRef = useRef(null);

  const scrollNext = () => {
    railRef.current?.scrollBy({ left: railRef.current.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div
      className="min-h-screen"
      // ponytail: grid backdrop is pure CSS, no asset. Doodle-board look.
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <Seo
          title="Moments — Meeticulous"
          description="A little archive of the days the world stopped to watch. Meeticulous moments, doodle-style."
          canonical="https://meeticulous.com/moments"
          image={OG_IMAGE}
        />

        <header className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">Moments</h1>
          <p className="mt-3 text-muted">The days worth marking, drawn by the Meeticulous team.</p>
        </header>

        {/* Recent moment — wide horizontal card */}
        <Link
          to={`/moments/${FEATURED.slug}`}
          className="group mt-10 grid grid-cols-1 overflow-hidden rounded-xl border-2 border-ink/10 bg-white transition hover:border-primary/40 sm:grid-cols-2"
        >
          <div className="flex items-center justify-center bg-ink/5 p-6">
            <img src={FEATURED.image} alt={FEATURED.alt} className="max-h-64 w-full object-contain" />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-sm font-medium text-primary">{FEATURED.date}</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-ink sm:text-2xl">{FEATURED.title}</h2>
            <p className="mt-2 text-sm text-muted">{FEATURED.excerpt}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Read moment <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {/* Latest moments — horizontal scroll rail */}
        {rest.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-center gap-2 text-ink">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Discover more Moments</span>
            </div>
            <h2 className="mt-3 text-center font-heading text-2xl font-bold text-ink sm:text-3xl">
              Latest Moments from around the world
            </h2>

            <div className="relative mt-8">
              <div
                ref={railRef}
                className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {rest.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/moments/${m.slug}`}
                    className="group block w-64 shrink-0 snap-start overflow-hidden rounded-xl border-2 border-ink/10 bg-white transition hover:border-primary/40"
                  >
                    <div className="flex h-40 items-center justify-center bg-ink/5 p-4">
                      <img src={m.image} alt={m.alt} className="max-h-full w-full object-contain" />
                    </div>
                    <div className="border-t-2 border-ink/10 p-4">
                      <p className="text-xs font-medium text-muted">{m.date}</p>
                      <h3 className="mt-1 font-heading text-base font-semibold text-ink">{m.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>

              <button
                type="button"
                onClick={scrollNext}
                aria-label="Show more moments"
                className="absolute -right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white shadow-lg transition hover:bg-ink/80 sm:flex"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
