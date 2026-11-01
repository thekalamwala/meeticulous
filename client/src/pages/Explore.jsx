/**
 * Explore.jsx — Public Explore page. Lists ranked SERVICES.
 * Route: /explore  |  /explore?category=yoga  |  /explore?q=therapist&page=2
 *
 * Ranking is a precomputed per-service quality score (0–100) × search relevance,
 * served by GET /api/explore. URL state (q, category, service, page) is the source
 * of truth so every view is a shareable, crawlable link.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, X, Sparkles } from 'lucide-react';
import ServiceCard from '../components/guest/ServiceCard';
import Pagination from '../components/guest/Pagination';
import CategoryFilter from '../components/guest/CategoryFilter';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from '../utils/seo';
import { getExploreServices, getExploreCategories } from '../services/api';

// Launch flag: flip true to show the placeholder instead of the live page.
const COMING_SOON = false;
// 9 = three whole rows of the 3-up grid. The card is portrait; 4-up gives slivers.
const PAGE_SIZE = 9;

function ExploreFull() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL is the source of truth.
  const q        = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const service  = searchParams.get('service') || '';
  // Server caps results at 96 = 8 pages (exploreController.paginate).
  const page     = Math.max(1, Math.min(8, parseInt(searchParams.get('page'), 10) || 1));

  const [inputVal,   setInputVal]   = useState(q);
  const [categories, setCategories] = useState([]);
  const [services,   setServices]   = useState([]);
  const [meta,       setMeta]       = useState({ total: 0, totalPages: 0, page: 1 });
  // What the server understood ({text, location, mode}) + whether results are a
  // fallback ('exact' | 'partial' | 'relaxed_topic' | 'relaxed_location' | 'none').
  const [parsed,     setParsed]     = useState(null);
  const [fetching,   setFetching]   = useState(false);

  const reqRef   = useRef(0);
  const abortRef = useRef(null);

  // Merge params, dropping empties; page 1 is implicit (omitted for clean URLs).
  const updateParams = useCallback((patch) => {
    const next = { q, category, service, page: String(page), ...patch };
    const sp = {};
    if (next.q)        sp.q = next.q;
    if (next.category) sp.category = next.category;
    if (next.service)  sp.service = next.service;
    if (next.page && String(next.page) !== '1') sp.page = String(next.page);
    setSearchParams(sp, { replace: true });
  }, [q, category, service, page, setSearchParams]);

  // Keep the box in sync when q changes from elsewhere (back button, clear pill).
  useEffect(() => { setInputVal(q); }, [q]);

  // Debounced search: 400ms, client min 3 chars (server enforces min 2); '' clears.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = inputVal.trim();
      const nextQ = v.length >= 3 ? v : '';
      if (nextQ !== q) updateParams({ q: nextQ, page: '1' });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputVal]);

  // Categories (once).
  useEffect(() => {
    getExploreCategories().then(res => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  // Fetch services. AbortController cancels the in-flight request when inputs change;
  // a monotonic reqId guards against a slow, superseded response overwriting fresh data.
  useEffect(() => {
    const reqId = ++reqRef.current;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetching(true);
    getExploreServices({ q, category, service, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then(res => {
        if (reqId !== reqRef.current) return;
        setServices(res.data.services || []);
        setMeta(res.data.meta || { total: 0, totalPages: 0, page });
        setParsed(res.data.filters?.parsed || null);
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return; // superseded
        if (reqId !== reqRef.current) return;
        setServices([]);
        setMeta({ total: 0, totalPages: 0, page: 1 });
        setParsed(null);
      })
      .finally(() => { if (reqId === reqRef.current) setFetching(false); });
  }, [q, category, service, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const v = inputVal.trim();
    updateParams({ q: v.length >= 3 ? v : '', page: '1' });
  };
  const clearSearch  = () => { setInputVal(''); updateParams({ q: '', page: '1' }); };
  const handleCategory = (slug) => updateParams({ category: slug, service: '', page: '1' });

  // Crawlable hrefs preserving q + filters.
  const hrefFor = (p) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (service) sp.set('service', service);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `/explore?${s}` : '/explore';
  };

  const headingText = q
    ? `Results for "${q}"`
    : category
    ? `${categories.find(c => c.slug === category)?.label || category} services`
    : 'Explore all services';

  const firstLoad = fetching && services.length === 0;

  // "offline in Nagpur" — the filters the server peeled off the query.
  const pMode  = parsed?.mode === 'online' || parsed?.mode === 'offline' ? parsed.mode : '';
  const pWhere = [pMode, parsed?.location && `in ${parsed.location}`].filter(Boolean).join(' ');
  // Say so when results are a fallback, instead of passing them off as matches.
  const fallbackNote = !q || !services.length ? null
    : meta.match === 'partial'
    ? <>No exact match for “{q}” — showing the closest matches.</>
    : meta.match === 'relaxed_topic'
    ? <>No “{parsed?.text}” services {pWhere} yet — here’s everything else {pWhere}.</>
    : meta.match === 'relaxed_location'
    ? <>No services in {parsed?.location} yet — showing online {parsed?.text ? <>“{parsed.text}” </> : null}services you can book from anywhere.</>
    : null;

  // Faceted / searched / paginated Explore views are thin, duplicative variants of
  // the canonical /explore (which they already canonicalize to). Google was indexing
  // them and flagging "soft 404" (the ?category=&service= combos are emitted as
  // crawlable links + ItemList JSON-LD from /services/:profession). noindex any
  // variant with an active param, or an empty result set; keep the bare /explore
  // indexable. `follow` so crawlers still reach the host/service pages the cards link to.
  const noindex = !!(q || category || service || page > 1) || (!fetching && services.length === 0);

  return (
    <div className="min-h-screen bg-surface">
      <Seo
        title="Explore Services — Meeticulous"
        description="Discover and book 1:1 services from coaches, consultants, therapists and creators on Meeticulous. Search by skill or browse by category."
        image={ogCard('explore')}
        canonical={`${SITE_URL}/explore`}
        robots={noindex ? 'noindex, follow' : undefined}
        jsonLd={[
          collectionPageJsonLd({
            name: 'Explore Services — Meeticulous',
            description: 'Discover and book 1:1 services from coaches, consultants, therapists and creators on Meeticulous. Search by skill or browse by category.',
            url: '/explore',
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }] }),
        ]}
      />

      {/* Thin top progress bar while (re)fetching. */}
      {fetching && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary/30 z-50 overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-[explore-bar_1s_ease-in-out_infinite]" />
        </div>
      )}

      {/* HERO / SEARCH — a browsing page should be quiet so the results are the
          loud part. Same restrained language as /blog: hairline rules, ink on
          white, colour reserved for the one action. */}
      <div className="border-b border-black/5">
        <div className="app-container py-12 text-center sm:py-16">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            Find Your Perfect Expert
          </h1>
          <p className="mt-3 text-base text-muted">
            Book 1:1 services with coaches, therapists, mentors &amp; more
          </p>
          <form onSubmit={handleSearchSubmit} className="relative mx-auto mt-8 max-w-xl">
            <div className="flex overflow-hidden rounded-xl border border-black/10 bg-white transition-shadow focus-within:border-primary/40 focus-within:shadow-md">
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Try “Mock Interview in Nagpur” or “Career Consultation online”"
                aria-label="Search services"
                className="flex-1 bg-transparent px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted"
              />
              {inputVal && (
                <button type="button" onClick={clearSearch}
                  className="px-3 text-muted transition-colors hover:text-ink" aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
              <button type="submit" aria-label="Search"
                className="bg-primary px-5 text-white transition-colors hover:bg-[#2A1416]">
                <Search size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="app-container space-y-8 py-8">
        <CategoryFilter categories={categories} selected={category} onChange={handleCategory} />

        {/* Toolbar */}
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-ink">{headingText}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {fetching && services.length === 0 ? 'Searching…' : `${meta.total} service${meta.total === 1 ? '' : 's'} found`}
            {q && pWhere && !fallbackNote && ` · ${pWhere}`}
          </p>
        </div>

        {fallbackNote && (
          <p role="status" className="rounded-[6px] border border-black/5 bg-sand px-4 py-3 text-sm text-ink">
            {fallbackNote}
          </p>
        )}

        {/* Active filter pills */}
        {(q || category || service) && (
          <div className="flex flex-wrap gap-2">
            {q && (
              <FilterPill label={<>Search: <strong>{q}</strong></>} onClear={clearSearch} />
            )}
            {category && (
              <FilterPill
                label={categories.find(c => c.slug === category)?.label || category}
                onClear={() => updateParams({ category: '', service: '', page: '1' })}
              />
            )}
            {service && (
              <FilterPill label={service.replace(/-/g, ' ')} onClear={() => updateParams({ service: '', page: '1' })} />
            )}
          </div>
        )}

        {/* Grid / skeleton / empty */}
        {firstLoad ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="page-card animate-pulse overflow-hidden">
                <div className="aspect-[4/3] bg-black/[0.04]" />
                <div className="space-y-2 p-4">
                  <div className="h-5 w-3/4 rounded bg-black/[0.04]" />
                  <div className="h-3 w-full rounded bg-black/[0.04]" />
                  <div className="h-3 w-2/3 rounded bg-black/[0.04]" />
                  <div className="flex gap-1.5 pt-1">
                    <div className="h-6 w-20 rounded-full bg-black/[0.04]" />
                    <div className="h-6 w-16 rounded-full bg-black/[0.04]" />
                  </div>
                  <div className="flex items-end justify-between pt-3">
                    <div className="h-7 w-20 rounded bg-black/[0.04]" />
                    <div className="h-9 w-28 rounded bg-black/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border border-black/5 bg-[#F8FAFC] px-6 py-16 text-center">
            <p className="font-heading text-lg font-bold text-ink">No services found</p>
            <p className="mt-1 text-sm text-muted">
              {q ? 'Try a different search' : 'Try a different category'} or clear your filters.
            </p>
            {(q || category || service) && (
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="btn mt-5 inline-flex items-center bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#2A1416] hover:no-underline">
                Clear filters
              </button>
            )}
            {categories.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {categories.slice(0, 6).map(c => (
                  <button key={c.slug} onClick={() => handleCategory(c.slug)}
                    className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.04]">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Keep previous results rendered while a new page loads (dim only).
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity
                          ${fetching ? 'opacity-60' : 'opacity-100'}`}>
            {services.map((s, idx) => (
              <ServiceCard key={s.id || idx} service={s} rank={(page - 1) * PAGE_SIZE + idx + 1} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={meta.totalPages} hrefFor={hrefFor} />

        {/* BECOME A HOST CTA */}
        <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-black/5 bg-[#F8FAFC] p-8 md:flex-row">
          <div className="text-center md:text-left">
            <p className="font-heading text-xl font-bold text-ink">You could be on this page</p>
            <p className="mt-1 text-sm text-muted">Join coaches, mentors &amp; experts on Meeticulous</p>
          </div>
          <Link to="/become-a-host"
            className="btn inline-flex shrink-0 items-center bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#2A1416] hover:no-underline">
            Become a host →
          </Link>
        </section>
      </div>

      <style>{`@keyframes explore-bar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}

function FilterPill({ label, onClear }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-medium text-ink">
      {label}
      <button onClick={onClear} className="ml-1 text-muted transition-colors hover:text-ink" aria-label="Remove filter">
        <X size={13} />
      </button>
    </span>
  );
}

function ExploreComingSoon() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-16">
      <Seo
        title="Explore Services — Meeticulous"
        description="Discover and book 1:1 services from coaches, consultants, therapists and creators on Meeticulous."
        image={ogCard('explore')}
        canonical={`${SITE_URL}/explore`}
        jsonLd={[
          collectionPageJsonLd({
            name: 'Explore Services — Meeticulous',
            description: 'Discover and book 1:1 services from coaches, consultants, therapists and creators on Meeticulous.',
            url: '/explore',
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }] }),
        ]}
      />
      <div className="w-full max-w-lg text-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          <Sparkles size={13} /> Coming Soon
        </span>
        <h1 className="mb-3 font-heading text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
          Explore is on its way
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-muted">
          A place to discover coaches, mentors, therapists &amp; experts — search by skill and book instantly.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/categories"
            className="btn inline-flex w-full items-center justify-center bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#2A1416] hover:no-underline sm:w-auto">
            Browse Categories
          </Link>
          <Link to="/become-a-host"
            className="btn btn--outline inline-flex w-full items-center justify-center border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-black/[0.04] hover:no-underline sm:w-auto">
            Become a host →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  return COMING_SOON ? <ExploreComingSoon /> : <ExploreFull />;
}
