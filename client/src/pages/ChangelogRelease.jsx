import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, breadcrumbJsonLd } from "../utils/seo";
import { SORTED_RELEASES, findRelease } from '../data/changelog';

// /changelog/:version — one release, plain and readable. Reached from a road
// sign on /changelog. Unknown version -> 404 via <Navigate> (same as MomentPage).
const ChangelogRelease = () => {
  const { version } = useParams();
  const r = findRelease(version);
  if (!r) return <Navigate to="/404" replace />;

  const idx = SORTED_RELEASES.indexOf(r);
  const newer = SORTED_RELEASES[idx - 1];
  const older = SORTED_RELEASES[idx + 1];
  const path = `/changelog/${r.version}`;

  return (
    <div className="bg-cream">
      <Seo
        title={`Meeticulous v${r.version} — ${r.title}`}
        description={`What changed in Meeticulous v${r.version} (${r.date}): ${r.points[0]}`}
        image={ogCard('changelog')}
        canonical={`${SITE_URL}${path}`}
        jsonLd={[
          breadcrumbJsonLd({ items: [
            { name: 'Home', path: '/' },
            { name: 'Changelog', path: '/changelog' },
            { name: `v${r.version}`, path },
          ] }),
        ]}
      />
      <div className="app-container py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <Link to="/changelog" className="mt-btn mt-btn--ghost mt-btn--s hover:no-underline">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> All releases
          </Link>

          <header className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              {r.tags.map((t) => (
                <span key={t} className="mt-badge mt-badge--brand"><span className="mt-badge__dot" />{t}</span>
              ))}
              <time className="text-sm text-ink/70">{r.date}</time>
            </div>
            <h1 className="mt-4 font-display text-5xl font-extrabold tracking-[-0.04em] text-maroon sm:text-7xl">
              v{r.version}
            </h1>
            <p className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-ink sm:text-2xl">
              {r.title}
            </p>
          </header>

          <section className="mt-card mt-card--outline mt-10 !gap-0 !p-6 sm:!p-8" aria-labelledby="cl-what">
            <h2 id="cl-what" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
              What changed
            </h2>
            <ul className="mt-5 space-y-5">
              {r.points.map((p) => (
                <li key={p} className="flex gap-4 text-[15px] leading-relaxed text-ink sm:text-base">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-maroon text-pink" aria-hidden="true">
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>

          {(newer || older) && (
            <nav className="mt-10 flex flex-wrap justify-between gap-3" aria-label="Other releases">
              {older ? (
                <Link to={`/changelog/${older.version}`} className="mt-btn mt-btn--secondary hover:no-underline">
                  <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> v{older.version}
                </Link>
              ) : <span />}
              {newer && (
                <Link to={`/changelog/${newer.version}`} className="mt-btn mt-btn--secondary hover:no-underline">
                  v{newer.version} <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              )}
            </nav>
          )}
        </article>
      </div>
    </div>
  );
};

export default ChangelogRelease;
