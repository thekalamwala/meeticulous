// /for/:profession — profession-specific marketing landing page.
//
// One data-driven template (config in professionLandingData.js). Each profession
// carries its OWN palette + voice + product mockup, applied here via CSS custom
// properties on the page root, so the pages feel distinct. Design pattern:
// "Trust & Authority + Conversion" — credibility band, security badges, metric
// proof, transparent pricing, low-friction CTA. Marketing-only: every CTA hands
// off to the real host signup funnel (/be-a-sloth).
//
// SEO: clean commercial title/meta for Google; clickbait OG for social; full
// JSON-LD graph (SoftwareApplication + FAQPage + BreadcrumbList + Service) for
// AEO/GEO citation by ChatGPT / Claude / Gemini / Perplexity. New profession URLs
// must also be added to scripts/prerender.mjs so scrapers see the baked HTML.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from '../../components/home/Reveal';
import { ArrowRight, Check, Star, Sparkles, ShieldCheck, Plus } from 'lucide-react';
import useLenis from '../../hooks/useLenis';
import Seo from '../../components/common/Seo';
import OperatorCredit from '../../components/common/OperatorCredit';
import PageGuides from '../../components/common/PageGuides';
import ErrorPage from '../ErrorPage';
import { SITE_URL } from '../../utils/seo';
import { HERO_FACES } from '../../components/home/images';
import { TESTIMONIALS } from '../../data/testimonials';
import { FREE_PLAN, PAID_PLANS } from '../../data/plans';
import useFeeOnly from '../../hooks/useFeeOnly';
import { getProfessionLanding } from './professionLandingData';

const ROUTE_START = '/become-a-host';
const YEAR = 2026;

/* ── Minimal page header — logo left, themed CTA right; mobile = logo centered ── */
function ForHeader({ ctaText }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-5 py-3.5 sm:justify-between sm:px-8">
        <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
          <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="text-[15px] font-bold tracking-tight text-[color:var(--lp-primary)]">Meeticulous</span>
        </Link>
        <Link
          to={ROUTE_START}
          className="hidden items-center gap-1.5 rounded-[6px] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:no-underline sm:inline-flex"
          style={{ background: 'var(--lp-accent-cta)' }}
        >
          {ctaText} <ArrowRight size={15} />
        </Link>
      </div>
    </header>
  );
}

/* ── Minimal page footer — brand line + accent trust line + "Made for India's …" ── */
function ForFooter({ madeFor, label }) {
  return (
    <footer className="border-t border-black/10 px-5 py-12 text-center sm:px-8" style={{ background: 'var(--lp-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <div className="text-lg font-bold text-white">Meeticulous</div>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/60">
          <span>© {YEAR} All rights reserved.</span>
        </p>
        <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--lp-accent)' }}>
          <OperatorCredit />
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/40">
          Made for {madeFor || `India's ${label}`}
        </p>
      </div>
    </footer>
  );
}

/* ── Single-open, smoothly-animated FAQ accordion (fixes native <details>) ── */
function FaqAccordion({ faq }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-3">
      {faq.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-[6px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'color-mix(in srgb, var(--lp-accent) 40%, transparent)' : 'rgba(0,0,0,0.06)' }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-[color:var(--lp-primary)]"
            >
              {f.q}
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300"
                style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 14%, transparent)', color: 'var(--lp-accent-cta)', transform: isOpen ? 'rotate(45deg)' : 'none' }}
              >
                <Plus size={15} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 text-[15px] leading-relaxed text-neutral-500">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ── Contextual mid-page CTA banner (themed, placed between sections) ── */
function MidCta({ text, ctaText }) {
  if (!text) return null;
  return (
    <section className="px-5 py-14 sm:px-8" style={{ background: 'var(--lp-primary)' }}>
      <Reveal className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <p className="text-lg font-bold text-white sm:text-xl">{text}</p>
        <Link
          to={ROUTE_START}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-[6px] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:no-underline"
          style={{ background: 'var(--lp-accent-cta)' }}
        >
          {ctaText} <ArrowRight size={16} />
        </Link>
      </Reveal>
    </section>
  );
}

/* Hero social-proof face — CDN photo with neutral fallback chip. */
function HeroFace({ src }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="h-9 w-9 flex-shrink-0 rounded-full border-2 border-white/80 object-cover" />
  ) : (
    <span className="h-9 w-9 flex-shrink-0 rounded-full border-2 border-white/80 bg-white/20" />
  );
}

/* Testimonial avatar with initials fallback. */
function TAvatar({ src, name }) {
  return src ? (
    <img src={src} alt={name} loading="lazy" className="h-11 w-11 flex-shrink-0 rounded-xl object-cover" />
  ) : (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 15%, transparent)', color: 'var(--lp-accent-cta)' }}>
      {name?.charAt(0) || '★'}
    </div>
  );
}

/* Hero product mockup — a themed booking page for this profession. Pure CSS,
   no screenshot needed; reads the practice + service names from config. */
function BookingMock({ mock, label }) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Browser chrome */}
      <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.55)] ring-1 ring-black/10">
        <div className="flex items-center gap-2 border-b border-black/5 bg-neutral-50 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          </span>
          <div className="ml-2 flex-1 truncate rounded-full bg-white px-3 py-1 text-[11px] text-neutral-400 ring-1 ring-inset ring-black/5">
            meeticulous.com/meera-law
          </div>
        </div>
        {/* Page body */}
        <div className="p-5">
          {/* Banner + avatar */}
          <div className="relative">
            <div className="h-14 rounded-[8px]" style={{ background: 'linear-gradient(110deg, var(--lp-hero-from), var(--lp-accent))' }} />
            <div className="absolute -bottom-5 left-3 flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white text-sm font-bold text-white" style={{ background: 'var(--lp-accent-cta)' }}>
              {mock.practice.split(' ').slice(-1)[0].charAt(0)}
            </div>
          </div>
          <div className="pl-1 pt-6">
            <div className="text-sm font-bold text-[color:var(--lp-primary)]">{mock.practice}</div>
            <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 14%, transparent)', color: 'var(--lp-accent-cta)' }}>
              {mock.practiceTag}
            </span>
          </div>
          {/* Services */}
          <div className="mt-4 space-y-2.5">
            {mock.services.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-[8px] border border-neutral-100 bg-white p-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[color:var(--lp-primary)]">{s.name}</div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">{s.meta}</div>
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs font-bold text-[color:var(--lp-primary)]">{s.price}</span>
                  <span className="rounded-[6px] px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'var(--lp-accent-cta)' }}>Book</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 pl-0.5 text-[10px] font-medium text-neutral-500">
            <ShieldCheck size={12} style={{ color: 'var(--lp-accent-cta)' }} />
            Fee paid securely before the consultation
          </div>
        </div>
      </div>
      {/* Floating "paid" chip */}
      <div className="absolute -right-3 top-16 hidden rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-black/5 sm:block">
        <div className="text-[10px] font-medium text-neutral-400">Fee received</div>
        <div className="text-sm font-bold" style={{ color: 'var(--lp-accent-cta)' }}>₹2,500</div>
      </div>
    </div>
  );
}

const HOW_STEPS = [
  { n: '1', title: 'Claim your link', desc: 'Pick your handle and add your consultation services in minutes.' },
  { n: '2', title: 'Share it anywhere', desc: 'Website, Instagram bio, WhatsApp status, email signature — one link does it all.' },
  { n: '3', title: 'Get booked & paid', desc: 'Clients pick a slot, pay upfront, and get reminded. You just show up.' },
];

export default function ProfessionLanding() {
  useLenis();
  const { profession } = useParams();
  const data = getProfessionLanding(profession);
  // Interim (fee-only): a single honest banner caveats the earn/commission copy
  // below (which stays as-is), and we drop the free Sloth offer from JSON-LD.
  const feeOnly = useFeeOnly();

  // Prefer profession-specific testimonials; fall back to weighted shared set.
  const testimonials = useMemo(() => {
    if (!data) return [];
    if (data.testimonials?.length) return data.testimonials.slice(0, 3);
    const roles = new Set(data.testimonialRoles || []);
    const first = TESTIMONIALS.filter((t) => roles.has(t.role));
    const rest = TESTIMONIALS.filter((t) => !roles.has(t.role));
    return [...first, ...rest].slice(0, 3);
  }, [data]);

  // Unknown profession → branded 404 (noindex/nofollow via ErrorLayout). A redirect
  // to home was friendlier but is a Google "soft 404" pattern (redirecting a dead URL
  // to an unrelated page), which is exactly what we're clearing from Search Console.
  if (!data) return <ErrorPage code={404} />;

  const { theme, seo, hero, socialProof, trust, stats, painPoints, features, headings, pricing, faq, finalCta, midCtas = {}, madeFor, label } = data;
  const canonical = `${SITE_URL}/for/${data.slug}`;
  // Headline "₹X/day" sells the paid plan. ₹3,599/yr = ₹9.86/day; rounding UP to
  // ₹10 is deliberate — advertise at or above what we actually charge, never below.
  const topPlan = PAID_PLANS[PAID_PLANS.length - 1];
  const perDay = Math.max(1, Math.round(topPlan.yearly / 365));

  // ── JSON-LD graph — SEO + AEO + GEO ──────────────────────────────────────
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Meeticulous',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Appointment Scheduling Software',
      operatingSystem: 'Web',
      url: canonical,
      description: seo.description,
      offers: feeOnly
        ? [{ '@type': 'Offer', price: String(PAID_PLANS[0].yearly), priceCurrency: 'INR', name: `${PAID_PLANS[0].name} plan (yearly)` }]
        : [
            { '@type': 'Offer', price: '0', priceCurrency: 'INR', name: `${FREE_PLAN.name} plan` },
            { '@type': 'Offer', price: String(PAID_PLANS[0].yearly), priceCurrency: 'INR', name: `${PAID_PLANS[0].name} plan (yearly)` },
          ],
      // No aggregateRating: a testimonial-derived 5.0 self-rating is exactly the
      // "self-serving review" markup Google's policy flags (enterpriseSeo.js made
      // the same call). Re-add only if backed by genuine on-page review data.
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: `Appointment booking software for ${label.toLowerCase()}`,
      provider: { '@type': 'Organization', name: 'Meeticulous', url: SITE_URL },
      areaServed: 'IN',
      description: seo.description,
      url: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: label, item: canonical },
      ],
    },
  ];

  // Palette → CSS custom properties consumed by the sections below.
  const styleVars = {
    '--lp-primary': theme.primary,
    '--lp-accent': theme.accent,
    '--lp-accent-cta': theme.accentCta,
    '--lp-tint': theme.tint,
    '--lp-hero-from': theme.heroFrom,
    '--lp-hero-to': theme.heroTo,
  };

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--lp-primary)]" style={styleVars}>
      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={theme.primary}
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        image={seo.ogImage}
        jsonLd={jsonLd}
      />
      <ForHeader ctaText="Get Started" />

      {/* ════════════════ HERO (dark, themed, two-column) ════════════════ */}
      <section
        className="relative px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24"
        style={{ background: 'linear-gradient(160deg, var(--lp-hero-from), var(--lp-hero-to))' }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* LEFT — copy */}
          <div className="text-center text-white lg:text-left">
            <Reveal as="p" className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--lp-accent)' }}>
              {hero.eyebrow}
            </Reveal>
            <Reveal as="h1" delay={0.05} className="mt-5 text-[clamp(2rem,5.4vw,3.6rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
              {hero.headline}{' '}
              <span className="italic" style={{ color: 'var(--lp-accent)' }}>{hero.headlineAccent}</span>{' '}
              {hero.headlineTail}
            </Reveal>
            <Reveal as="p" delay={0.12} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
              {hero.subline}
            </Reveal>

            <Reveal delay={0.18} className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to={ROUTE_START}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] px-7 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:no-underline sm:w-auto"
                style={{ background: 'var(--lp-accent-cta)' }}
              >
                {hero.ctaText}
                <ArrowRight size={16} />
              </Link>
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <Check size={13} style={{ color: 'var(--lp-accent)' }} />
                {hero.microcopy}
              </span>
            </Reveal>

            {/* Social proof */}
            <Reveal delay={0.24} className="mt-10 flex items-center justify-center gap-4 lg:justify-start">
              <div className="flex -space-x-3">
                {HERO_FACES.map((f, i) => <HeroFace key={i} src={f} />)}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1 text-sm font-semibold text-white">5/5</span>
                </div>
                <p className="max-w-xs text-xs text-white/50">{socialProof}</p>
              </div>
            </Reveal>
          </div>

          {/* RIGHT — product mockup */}
          <Reveal delay={0.1} className="hidden lg:block">
            <BookingMock mock={hero.mock} label={label} />
          </Reveal>
        </div>

        {/* Trust badge row */}
        <Reveal delay={0.3} className="mx-auto mt-14 max-w-5xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {trust.map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 rounded-[6px] border border-white/10 bg-white/10 px-3.5 py-3">
                <t.icon size={17} className="flex-shrink-0" style={{ color: 'var(--lp-accent)' }} />
                <span className="text-[12.5px] font-medium leading-tight text-white/80">{t.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ════════════════ STAT BAND (authority metrics) ════════════════ */}
      <section className="border-b border-black/5 px-5 py-12 sm:px-8" style={{ background: 'var(--lp-tint)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.07} className="text-center">
              <s.icon size={22} className="mx-auto" style={{ color: 'var(--lp-accent-cta)' }} />
              <div className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{s.value}</div>
              <p className="mx-auto mt-1.5 max-w-[13rem] text-xs leading-snug text-neutral-500">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════ PROBLEM → SOLUTION ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--lp-accent-cta)' }}>
            {headings.problems.eyebrow}
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-3xl font-bold leading-tight sm:text-4xl">
            {headings.problems.title} <span className="italic" style={{ color: 'var(--lp-accent-cta)' }}>{headings.problems.titleAccent}</span>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {painPoints.map((p, i) => (
              <Reveal key={p.problem} delay={(i % 2) * 0.08}>
                <div className="h-full rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.16)] sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent-cta)' }}>
                      <p.icon size={18} />
                    </span>
                    <p className="text-sm font-semibold text-neutral-500 line-through decoration-neutral-400 decoration-[1.5px]">
                      {p.problem}
                    </p>
                  </div>
                  <div className="mt-4 flex items-start gap-3 border-t border-dashed border-neutral-200 pt-4">
                    <Check size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--lp-accent-cta)' }} />
                    <p className="text-[15px] font-medium leading-relaxed text-[color:var(--lp-primary)]">{p.solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contextual CTA #1 — right after the pain is fresh */}
      <MidCta text={midCtas.afterProblems?.text} ctaText={midCtas.afterProblems?.ctaText} />

      {/* ════════════════ FEATURES / BENEFITS ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--lp-tint)' }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="p" className="text-center text-sm font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--lp-accent-cta)' }}>
            {headings.features.eyebrow}
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mx-auto mt-3 max-w-[750px] text-center text-3xl font-bold leading-tight sm:text-4xl">
            {headings.features.title} <span className="italic" style={{ color: 'var(--lp-accent-cta)' }}>{headings.features.titleAccent}</span>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.07}>
                <div className="flex h-full flex-col rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.16)] sm:p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent-cta)' }}>
                    <f.icon size={22} />
                  </span>
                  <h3 className="mt-5 font-heading text-base font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS (dark, themed) ════════════════ */}
      <section className="px-5 py-20 text-white sm:px-8 lg:py-28" style={{ background: 'var(--lp-primary)' }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="mx-auto max-w-[750px] text-center text-3xl font-bold leading-tight text-white sm:text-4xl">
            From link to paid. <span className="italic" style={{ color: 'var(--lp-accent)' }}>In three steps.</span>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {HOW_STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="h-full rounded-[6px] border border-white/10 bg-white/5 p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: 'var(--lp-accent-cta)' }}>
                    {s.n}
                  </span>
                  <h3 className="mt-5 font-heading text-lg font-bold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ TESTIMONIALS ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="text-center text-3xl font-bold leading-tight sm:text-4xl">
            {headings.testimonials?.title || 'Built for how you really work.'}
          </Reveal>
          <Reveal as="p" delay={0.08} className="mx-auto mt-3 max-w-[600px] text-center text-base text-neutral-500">
            {headings.testimonials?.subtitle || 'Booked, paid and reminded — without the admin.'}
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.08}>
                <figure className="flex h-full flex-col justify-between rounded-[6px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.05)]">
                  <span aria-hidden className="block h-[3px] w-10 rounded-full" style={{ background: 'var(--lp-accent-cta)' }} />
                  <blockquote className="mt-4 flex-1 text-[15px] font-semibold leading-snug text-[color:var(--lp-primary)]">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <TAvatar src={t.avatar} name={t.name} />
                    <div>
                      <div className="text-sm font-bold text-[color:var(--lp-primary)]">{t.name}</div>
                      <div className="text-xs text-neutral-400">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contextual CTA #2 — social proof → conversion */}
      <MidCta text={midCtas.afterHow?.text} ctaText={midCtas.afterHow?.ctaText} />

      {/* ════════════════ REAL-PAGE PROOF ════════════════ */}
      {/* Not a staged mockup — a live, bookable Meeticulous page the visitor can open.
         Profession-neutral copy so one real page works on every /for/ landing. */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <Reveal as="span" className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 14%, transparent)', color: 'var(--lp-accent-cta)' }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--lp-accent-cta)' }} /> Live right now
            </Reveal>
            <Reveal as="h2" delay={0.05} className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
              Not a mockup. <span style={{ color: 'var(--lp-accent-cta)' }}>A real Meeticulous page.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mx-auto mt-4 max-w-md text-base leading-relaxed text-neutral-500 lg:mx-0">
              Everything you have seen is the actual product — profile, services, prices and a working Book Now button. Here is a live page you can open and book this second.
            </Reveal>
            <Reveal delay={0.14} className="mt-7">
              <Link to="/sndatarkar" className="inline-flex items-center justify-center gap-2 rounded-[6px] border px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline" style={{ borderColor: 'var(--lp-accent-cta)', color: 'var(--lp-accent-cta)' }}>
                Open a real page <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="relative">
            <picture>
              <source media="(max-width: 640px)" srcSet="/images/real-page-mobile.webp" />
              <img
                src="/images/real-page.webp"
                alt="A real, live Meeticulous booking page — profile, services, prices and a Book Now button"
                width="1440"
                height="900"
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl border border-black/5 shadow-[0_30px_70px_-30px_rgba(26,26,26,0.35)]"
              />
            </picture>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ PRICING TEASER ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--lp-tint)' }}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 14%, transparent)', color: 'var(--lp-accent-cta)' }}>
            <Sparkles size={13} /> {pricing.hook}
          </Reveal>
          <Reveal as="h2" delay={0.05} className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
            About <span style={{ color: 'var(--lp-accent-cta)' }}>₹{perDay}/day</span> for a page that books &amp; bills for you.
          </Reveal>
          <Reveal as="p" delay={0.08} className="mt-2 text-xs text-neutral-400">
            {topPlan.name} plan, billed yearly (₹{topPlan.yearly.toLocaleString('en-IN')}/year) · + 18% GST
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-xl text-base text-neutral-500">
            {pricing.line}
          </Reveal>
          <Reveal delay={0.16} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={ROUTE_START} className="inline-flex items-center justify-center gap-2 rounded-[6px] px-7 py-4 text-sm font-semibold text-white transition-all hover:no-underline" style={{ background: 'var(--lp-accent-cta)' }}>
              Start free <ArrowRight size={16} />
            </Link>
            <Link to="/pricing" className="text-sm font-semibold text-[color:var(--lp-primary)] underline-offset-4 hover:underline">
              See full pricing
            </Link>
          </Reveal>
        </div>
      </section>

      <PageGuides />

      {/* ════════════════ FAQ ════════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className="text-center text-3xl font-bold leading-tight sm:text-4xl">
            Questions, answered.
          </Reveal>
          <div className="mt-12">
            <FaqAccordion faq={faq} />
          </div>
        </div>
      </section>

      {/* ════════════════ FINAL CTA (dark, themed, urgency) ════════════════ */}
      <section
        className="px-5 py-24 text-center text-white sm:px-8"
        style={{ background: 'linear-gradient(160deg, var(--lp-hero-from), var(--lp-hero-to))' }}
      >
        <div className="mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--lp-accent) 20%, transparent)' }}>
            <finalCta.icon size={26} style={{ color: 'var(--lp-accent)' }} />
          </Reveal>
          {finalCta.urgency && (
            <Reveal as="p" delay={0.04} className="mt-6 text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--lp-accent)' }}>
              {finalCta.urgency}
            </Reveal>
          )}
          <Reveal as="h2" delay={0.08} className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
            {finalCta.headline}
          </Reveal>
          <Reveal as="p" delay={0.12} className="mx-auto mt-4 max-w-lg text-base text-white/70">
            {finalCta.subline}
          </Reveal>
          <Reveal delay={0.18} className="mt-8">
            <Link to={ROUTE_START} className="inline-flex items-center justify-center gap-2 rounded-[6px] px-8 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:no-underline" style={{ background: 'var(--lp-accent-cta)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      <ForFooter madeFor={madeFor} label={label} />
    </main>
  );
}
