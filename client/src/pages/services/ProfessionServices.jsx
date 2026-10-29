// /services/:profession — SEO landing page: every bookable service for one profession.
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Seo from '../../components/common/Seo';
import { SITE_URL, faqJsonLd } from '../../utils/seo';
import ServiceCategoryCard from '../../components/services/ServiceCategoryCard';
import { getProfessionServices } from '../../services/api';
import { professionSeo, cardBlurb, withArticle } from './professionSeoContent';

// Slug → Title Case label ("career-coach" → "Career Coach"). Fallback for the meta
// title before/without the API response, so a real title is always present.
const humanizeSlug = (s) => String(s || '')
  .split('-').filter(Boolean)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ') || 'Professional';

export default function ProfessionServices() {
  const { profession } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProfessionServices(profession)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 404) navigate('/404', { replace: true });
        else setData({ error: true });
      })
      .finally(() => setLoading(false));
  }, [profession, navigate]);

  // Meta is rendered in EVERY state (loading/error/loaded), not gated behind the
  // fetch — otherwise the build-time prerender bakes the generic shell <title> for
  // these pages when its late-in-run API fetch is rate-limited (they'd serve the
  // homepage title to non-JS bots). The slug gives a real fallback title; the fetched
  // data upgrades it. Mirrors the /services hub (ServicesDirectory), which is robust
  // for exactly this reason.
  const prof = data && !data.error ? data.profession : null;
  const services = prof ? data.services : [];
  const hosts = prof ? (data.hosts || []) : [];
  const label = prof?.label || humanizeSlug(profession);
  const canonical = `${SITE_URL}/services/${prof?.slug || profession}`;
  const description = services.length
    ? `Browse ${services.length} bookable ${label.toLowerCase()} services — ${services.slice(0, 3).map((s) => s.name).join(', ')} and more. Compare hosts and book online.`
    : `Browse and book ${label.toLowerCase()} services online on Meeticulous — compare hosts, see pricing, and book instantly.`;
  const jsonLd = prof ? [
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: services.map((s, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: {
          '@type': 'Service', name: s.name, description: s.description,
          url: `${SITE_URL}/explore?category=${encodeURIComponent(prof.slug)}&service=${encodeURIComponent(s.slug)}`,
        },
      })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Services', item: `${SITE_URL}/services` },
        { '@type': 'ListItem', position: 2, name: label, item: canonical },
      ],
    },
    // Crawlable ItemList of the hosts linked below — gives Google a discovery path
    // to each profile from this indexable hub.
    ...(hosts.length ? [{
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${label}s on Meeticulous`,
      itemListElement: hosts.map((h, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Person', name: h.name, url: `${SITE_URL}/${h.username}` },
      })),
    }] : []),
  ] : undefined;
  const seo = (
    <Seo title={`Book ${withArticle(label)} online | Meeticulous`} description={description} canonical={canonical} jsonLd={jsonLd} />
  );

  if (loading) return <div className="app-container py-16">{seo}Loading…</div>;
  if (!prof) return <div className="app-container py-16">{seo}Could not load this page. Please retry.</div>;

  const { intro, faqs, forLanding } = professionSeo(prof, services);
  const faqLd = faqs.length ? faqJsonLd({ faqs }) : null;

  return (
    <div className="app-container py-12">
      <Seo
        title={`Book ${withArticle(label)} online | Meeticulous`}
        description={description}
        canonical={canonical}
        jsonLd={faqLd ? [...jsonLd, faqLd] : jsonLd}
      />
      <nav className="mb-6 text-sm text-[#64748b]">
        <Link to="/services" className="hover:underline">Services</Link> / {prof.label}
      </nav>
      <h1 className="font-heading text-[2.1rem] font-extrabold leading-[1.12] tracking-tight text-[#1E0B4D] xl:text-[2.7rem]">
        Book {withArticle(prof.label)} online
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#475569]">{intro}</p>

      <h2 className="mt-12 font-heading text-xl font-bold text-[#1E0B4D]">
        {prof.label} services you can book today
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s, i) => (
          <ServiceCategoryCard
            key={s.slug}
            service={{ ...s, description: cardBlurb(s.name, prof.label, i) }}
            profession={prof.slug}
          />
        ))}
      </div>

      {faqs.length > 0 && (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-heading text-xl font-bold text-[#1E0B4D]">
            {prof.label} bookings — frequently asked questions
          </h2>
          <dl className="mt-6 space-y-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-[#1E0B4D]">{f.q}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-[#475569]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hosts.length > 0 && (
        <section className="mt-14">
          <h2 className="font-heading text-xl font-bold text-[#1E0B4D]">
            {prof.label}s taking bookings on Meeticulous
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hosts.map((h) => (
              <Link
                key={h.username}
                to={`/${h.username}`}
                className="flex items-center gap-3 rounded-xl border-2 border-[#1E0B4D]/10 p-4 transition-colors hover:border-[#1E0B4D] hover:no-underline"
              >
                {h.profile_image ? (
                  <img src={h.profile_image} alt={h.name} loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E0B4D]/5 font-bold text-[#1E0B4D]">
                    {(h.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#1E0B4D]">{h.name}</span>
                  {h.profession && (
                    <span className="block truncate text-[13px] text-[#64748b]">{h.profession}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 border-t-2 border-[#1E0B4D]/10 pt-8">
        <h2 className="font-heading text-lg font-bold text-[#1E0B4D]">Keep exploring</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/services" className="rounded-full border-2 border-[#1E0B4D] px-4 py-1.5 font-semibold hover:bg-[#1E0B4D] hover:text-white">
            All professions
          </Link>
          <Link to="/explore" className="rounded-full border-2 border-[#1E0B4D] px-4 py-1.5 font-semibold hover:bg-[#1E0B4D] hover:text-white">
            Explore all services
          </Link>
          {forLanding && (
            <Link to={`/for/${forLanding}`} className="rounded-full border-2 border-[#1E0B4D] px-4 py-1.5 font-semibold hover:bg-[#1E0B4D] hover:text-white">
              Why {prof.label.toLowerCase()}s choose Meeticulous
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
