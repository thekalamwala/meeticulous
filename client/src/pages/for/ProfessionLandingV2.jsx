// ProfessionLandingV2 — v2 /for/:profession marketing template.
//
// Timewheel-referenced structure: a light hero with a product mock, animated
// stat counters on a dark band, numbered "why it works" principles, a 3-step
// booking flow, a "what you get" grid, a before/after comparison, numbered
// "why us", testimonials, a numbered FAQ, and a final CTA with a sticky pill.
//
// Each page carries its OWN `design` block (palette + heroVariant + texture) in
// professionLandingV2Data.js, applied here as CSS custom properties, so pages
// look genuinely different — not just a recoloured accent.
//
// Reuses the v1 infra: Seo, the JSON-LD graph (SoftwareApplication + Service +
// FAQPage + BreadcrumbList), the plan/fee hooks, Reveal and useLenis. Marketing
// only — every CTA hands off to the real host signup funnel.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import {
  ArrowRight, Check, X, Star, Plus,
  CalendarCheck, Wallet, DoorOpen, BellRing, CalendarClock,
  FileCheck, Star as StarIcon, Compass,
  BadgePercent, Lock, Landmark, Zap,
} from 'lucide-react';
import useLenis from '../../hooks/useLenis';
import Seo from '../../components/common/Seo';
import OperatorCredit from '../../components/common/OperatorCredit';
import PageGuides from '../../components/common/PageGuides';
import { SITE_URL } from '../../utils/seo';
import { FREE_PLAN, PAID_PLANS } from '../../data/plans';
import useFeeOnly from '../../hooks/useFeeOnly';
import { getV2Landing } from './professionLandingV2Data';

const ROUTE_START = '/become-a-host';
const YEAR = 2026;

const GET_ICONS = [Wallet, CalendarClock, DoorOpen, BellRing, CalendarCheck, FileCheck, StarIcon, Compass];
const WHYUS_ICONS = [BadgePercent, Lock, Landmark, Zap];

/* ── Count-up number, triggered when scrolled into view ── */
function Counter({ to, prefix = '', suffix = '', duration = 1400 }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to === 0) { setV(to); return undefined; }
    let raf;
    let started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / duration);
            setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{prefix}{v}{suffix}</span>;
}

/* ── Themed product mock — a booking page for this profession ── */
function BookingMock({ mock }) {
  const [active, setActive] = useState(0);
  if (!mock) return null;
  return (
    <div className="mx-auto w-full max-w-md rounded-[20px] border border-black/10 bg-white shadow-[0_30px_70px_-30px_rgba(23,21,58,0.45)]">
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <span className="ml-3 truncate text-[11px] text-black/30">meeticulous.com/{mock.brand ? mock.brand.toLowerCase().replace(/\s+/g, '') : 'book'}</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 flex-shrink-0 rounded-[12px]" style={{ background: 'linear-gradient(135deg, var(--v2-accent), var(--v2-accent-ink))' }} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
            <div className="truncate text-[12px] text-black/40">{mock.tag}</div>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-black/35">Choose a service</div>
        <div className="mt-2 space-y-2">
          {mock.services.map((s, i) => (
            <button
              type="button"
              key={s.name}
              onClick={() => setActive(i)}
              className="flex w-full items-center justify-between gap-2 rounded-[12px] border px-3 py-2.5 text-left transition-colors"
              style={active === i
                ? { borderColor: 'var(--v2-accent)', background: 'var(--v2-wash)' }
                : { borderColor: 'rgba(0,0,0,0.08)', background: 'transparent' }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[color:var(--v2-ink)]">{s.name}</span>
                <span className="block truncate text-[11px] text-black/40">{s.meta}</span>
              </span>
              <span className="whitespace-nowrap text-[14px] font-extrabold text-[color:var(--v2-ink)]">{s.price}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-[10px] py-3 text-[13px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
          Confirm &amp; pay <ArrowRight size={15} />
        </div>
      </div>
    </div>
  );
}

export default function ProfessionLandingV2() {
  useLenis();
  const { profession } = useParams();
  const data = getV2Landing(profession);
  const feeOnly = useFeeOnly();
  if (!data) return null; // dispatcher only sends real v2 slugs here

  const { design, seo, hero, stats, why, flow, whatYouGet, beforeAfter, whyUs, testimonials, faq, finalCta, madeFor, label } = data;
  const canonical = `${SITE_URL}/for/${data.slug}`;

  const styleVars = {
    '--v2-ink': design.ink,
    '--v2-accent': design.accent,
    '--v2-accent-ink': design.accentInk,
    '--v2-accent-cta': design.accentCta,
    '--v2-wash': design.wash,
    '--v2-dark': design.surfaceDark,
    '--v2-canvas': design.canvas,
  };
  const texture = {
    grid: 'linear-gradient(var(--v2-wash) 1px, transparent 1px), linear-gradient(90deg, var(--v2-wash) 1px, transparent 1px)',
    dots: 'radial-gradient(var(--v2-wash) 1.4px, transparent 1.4px)',
    lines: 'repeating-linear-gradient(135deg, var(--v2-wash) 0 1px, transparent 1px 14px)',
    none: 'none',
  }[design.texture || 'none'];
  const textureSize = design.texture === 'grid' ? '26px 26px' : design.texture === 'dots' ? '22px 22px' : 'auto';

  // ── JSON-LD graph — SEO + AEO + GEO (mirrors v1) ──────────────────────────
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Meeticulous',
      applicationCategory: 'BusinessApplication', applicationSubCategory: 'Appointment Scheduling Software',
      operatingSystem: 'Web', url: canonical, description: seo.description,
      offers: feeOnly
        ? [{ '@type': 'Offer', price: String(PAID_PLANS[0].yearly), priceCurrency: 'INR', name: `${PAID_PLANS[0].name} plan (yearly)` }]
        : [
            { '@type': 'Offer', price: '0', priceCurrency: 'INR', name: `${FREE_PLAN.name} plan` },
            { '@type': 'Offer', price: String(PAID_PLANS[0].yearly), priceCurrency: 'INR', name: `${PAID_PLANS[0].name} plan (yearly)` },
          ],
    },
    {
      '@context': 'https://schema.org', '@type': 'Service',
      serviceType: `Appointment booking software for ${label.toLowerCase()}`,
      provider: { '@type': 'Organization', name: 'Meeticulous', url: SITE_URL },
      areaServed: 'IN', description: seo.description, url: canonical,
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: label, item: canonical },
      ],
    },
  ];

  return (
    <main className="overflow-x-clip font-sans text-[color:var(--v2-ink)]" style={{ ...styleVars, background: 'var(--v2-canvas)' }}>
      <Seo
        title={seo.title} description={seo.description} keywords={seo.keywords} canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1" siteName="Meeticulous" locale="en_IN"
        themeColor={design.ink} ogTitle={seo.ogTitle} ogDescription={seo.ogDescription} image={seo.ogImage} jsonLd={jsonLd}
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-black/5 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--v2-canvas) 86%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="font-heading text-[15px] font-extrabold tracking-tight text-[color:var(--v2-ink)]">Meeticulous</span>
          </Link>
          <Link to={ROUTE_START} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:no-underline" style={{ background: 'var(--v2-accent-cta)' }}>
            {hero.ctaText} <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ════════ HERO (light, textured, split) ════════ */}
      <section className="relative px-5 sm:px-8" style={{ backgroundColor: 'var(--v2-canvas)', backgroundImage: texture, backgroundSize: textureSize }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full" style={{ background: 'linear-gradient(180deg, transparent, var(--v2-canvas) 92%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="p" className="font-heading text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--v2-accent-ink)' }}>{hero.eyebrow}</Reveal>
            <Reveal as="h1" delay={0.05} className="mt-4 font-heading text-[clamp(2rem,5.2vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
              {hero.headline}{' '}<span style={{ color: 'var(--v2-accent-ink)' }}>{hero.headlineAccent}</span>{hero.headlineTail ? ` ${hero.headlineTail}` : ''}
            </Reveal>
            <Reveal as="p" delay={0.12} className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-black/60 sm:text-base lg:mx-0">{hero.subline}</Reveal>
            <Reveal delay={0.18} className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link to={ROUTE_START} className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:no-underline sm:w-auto" style={{ background: 'var(--v2-accent-cta)' }}>
                {hero.ctaText} <ArrowRight size={16} />
              </Link>
              <span className="flex items-center gap-1.5 text-xs text-black/45"><Check size={13} style={{ color: 'var(--v2-accent)' }} />{hero.microcopy}</span>
            </Reveal>
            {hero.audiences && (
              <Reveal delay={0.24} className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
                {hero.audiences.map((a) => (
                  <span key={a} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: 'var(--v2-wash)', background: '#fff', color: 'var(--v2-accent-ink)' }}>{a}</span>
                ))}
              </Reveal>
            )}
          </div>
          <Reveal delay={0.1} className="hidden lg:block"><BookingMock mock={hero.mock} /></Reveal>
        </div>
      </section>

      {/* ════════ STAT COUNTERS (dark band) ════════ */}
      <section className="px-5 py-14 sm:px-8" style={{ background: 'var(--v2-dark)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((s) => (
            <Reveal key={s.label} className="text-center lg:text-left">
              <div className="font-heading text-[clamp(2rem,4vw,3rem)] font-extrabold leading-none text-white">
                <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
              </div>
              <p className="mt-2.5 text-[12.5px] leading-snug text-white/55">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════ WHY IT WORKS (numbered) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--v2-accent-ink)' }}>{why.eyebrow}</p>
            <h2 className="mt-3 font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.01em]">{why.title} <span style={{ color: 'var(--v2-accent-ink)' }}>{why.titleAccent}</span></h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-black/55">{why.lead}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {why.items.map((it, i) => (
              <Reveal key={it.title} delay={i * 0.06} className="rounded-[14px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(23,21,58,0.05)]">
                <div className="font-heading text-sm font-extrabold" style={{ color: 'var(--v2-accent-ink)' }}>{String(i + 1).padStart(2, '0')}</div>
                <h3 className="mt-3 font-heading text-[17px] font-bold">{it.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-black/55">{it.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FLOW — 3 steps (wash band) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'var(--v2-wash)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--v2-accent-ink)' }}>{flow.eyebrow}</p>
            <h2 className="mt-3 font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.01em]">{flow.title}</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {flow.steps.map((st, i) => (
              <Reveal key={st.title} delay={i * 0.07} className="relative rounded-[14px] border border-black/5 bg-white p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm font-extrabold text-white" style={{ background: 'var(--v2-accent)' }}>{i + 1}</div>
                <h3 className="mt-4 font-heading text-[17px] font-bold">{st.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-black/55">{st.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WHAT YOU GET (grid) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--v2-accent-ink)' }}>{whatYouGet.eyebrow}</p>
            <h2 className="mt-3 font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.01em]">{whatYouGet.title}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-black/55">{whatYouGet.lead}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = GET_ICONS[i % GET_ICONS.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="rounded-[14px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(23,21,58,0.04)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}><Icon size={18} /></span>
                  <h3 className="mt-4 font-heading text-[15px] font-bold">{it.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-black/55">{it.desc}</p>
                </Reveal>
              );
            })}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-black/35">Also available</span>
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-full border border-black/10 px-3 py-1.5 text-[12.5px] font-medium text-black/60">{a}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ════════ BEFORE / AFTER ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'var(--v2-dark)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--v2-accent)' }}>{beforeAfter.eyebrow}</p>
            <h2 className="mt-3 font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.01em] text-white">{beforeAfter.title}</h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-white/55">{beforeAfter.lead}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="rounded-[14px] border border-white/10 bg-white/[0.04] p-7">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/40">Before</div>
              <ul className="mt-5 space-y-3.5">
                {beforeAfter.before.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] text-white/60"><X size={17} className="mt-0.5 flex-shrink-0 text-white/30" />{b}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="rounded-[14px] border p-7" style={{ borderColor: 'var(--v2-accent)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--v2-accent)' }}>After</div>
              <ul className="mt-5 space-y-3.5">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-3 text-[14px] text-white/85"><Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />{a}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ WHY MEETICULOUS (numbered) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--v2-accent-ink)' }}>{whyUs.eyebrow}</p>
            <h2 className="mt-3 font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.01em]">{whyUs.title}</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {whyUs.items.map((it, i) => {
              const Icon = WHYUS_ICONS[i % WHYUS_ICONS.length];
              return (
                <Reveal key={it.title} delay={i * 0.05} className="rounded-[14px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(23,21,58,0.04)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}><Icon size={18} /></span>
                  <div className="mt-4 font-heading text-sm font-extrabold" style={{ color: 'var(--v2-accent-ink)' }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 className="mt-1.5 font-heading text-[16px] font-bold">{it.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-black/55">{it.desc}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS (wash band) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'var(--v2-wash)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} className="fill-amber-400 text-amber-400" />)}
            <span className="ml-2 font-heading text-sm font-bold">What hosts say</span>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="flex flex-col rounded-[14px] border border-black/5 bg-white p-6">
                <p className="text-[14.5px] leading-relaxed text-black/70">“{t.quote}”</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-xs font-bold text-white" style={{ background: 'var(--v2-accent)' }}>{t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div>
                    <div className="text-[13px] font-bold">{t.name}</div>
                    <div className="text-[12px] text-black/45">{t.role}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FAQ (numbered) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold tracking-[-0.01em]">Frequently asked questions.</h2>
          <div className="mt-8 divide-y divide-black/8">
            {faq.map((f, i) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start gap-4">
                  <span className="font-heading text-sm font-extrabold tabular-nums" style={{ color: 'var(--v2-accent-ink)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-heading text-[16px] font-bold">{f.q}</span>
                  <Plus size={18} className="mt-0.5 flex-shrink-0 text-black/30 transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 pl-9 pr-7 text-[14.5px] leading-relaxed text-black/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[20px] px-6 py-16 text-center shadow-[0_30px_70px_-30px_rgba(23,21,58,0.5)] sm:px-10" style={{ background: 'linear-gradient(135deg, var(--v2-accent), var(--v2-accent-ink))' }}>
          <h2 className="font-heading text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold text-white">{finalCta.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/85">{finalCta.subline}</p>
          <Link to={ROUTE_START} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 hover:no-underline" style={{ color: 'var(--v2-accent-ink)' }}>
            {finalCta.ctaText} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Sticky CTA pill ── */}
      <Link to={ROUTE_START} className="fixed bottom-5 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-10px_rgba(23,21,58,0.6)] transition-transform hover:-translate-y-0.5 hover:no-underline" style={{ background: 'var(--v2-accent-cta)', bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        {hero.ctaText} <ArrowRight size={15} />
      </Link>

      {/* ── Footer ── */}
      <footer className="px-5 py-12 text-center sm:px-8" style={{ background: 'var(--v2-dark)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="font-heading text-lg font-bold text-white">Meeticulous</div>
          <p className="mt-2 text-sm text-white/55">© {YEAR} All rights reserved.</p>
          <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--v2-accent)' }}><OperatorCredit /></p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/35">Made for {madeFor || `India's ${label}`}</p>
        </div>
      </footer>

      <PageGuides />
    </main>
  );
}
