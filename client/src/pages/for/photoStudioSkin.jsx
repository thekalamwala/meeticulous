// photoStudioSkin — the "photographer's studio" body for /for/photo-studios.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'studio'`. Same data, same
// copy, same CTAs as the shared template — only the presentation changes, so
// the page reads as made for studios rather than a recoloured sibling:
//   · stats as a camera exposure readout (meter scale + settings strip)
//   · the 3-step flow as frames on a strip of film
//   · services ("what you get") as a contact sheet (hairline grid, one panel)
//   · before/after as RAW vs EDITED with a compare handle
//   · testimonials as framed client notes, FAQ as a two-column accordion
//   · final CTA framed like a darkroom viewfinder
//   · integrations, pricing + about (shared v2Sections) wear the viewfinder corners
// Flat fills, 2px borders, card radius 24 / pills for buttons, colours from
// the page's own --v2-* palette (see design block in professionLandingV2Data).

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import ForFaqIntro from '../../components/common/ForFaqIntro';
import {
  ArrowRight, Check, X, Plus, Quote, ChevronsLeftRight,
  Link2, CreditCard, CalendarCheck,
} from 'lucide-react';

const FLOW_ICONS = [Link2, CreditCard, CalendarCheck];
const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const STUDIO_CARD = 'rounded-[24px] border-2 border-black/[0.06]';

/* Viewfinder corner marks — sit inside a `group relative` card and pick up the
   accent on hover. */
function Corners({ tone = 'rgba(0,0,0,0.18)', hover = true, inset = 'inset-3', size = 'h-4 w-4' }) {
  const base = `pointer-events-none absolute ${size} border-[color:var(--corner)] transition-colors duration-200 ${hover ? 'group-hover:border-[color:var(--v2-accent)]' : ''}`;
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute ${inset}`} style={{ '--corner': tone }}>
      <span className={`${base} left-0 top-0 rounded-tl-[6px] border-l-2 border-t-2`} />
      <span className={`${base} right-0 top-0 rounded-tr-[6px] border-r-2 border-t-2`} />
      <span className={`${base} bottom-0 left-0 rounded-bl-[6px] border-b-2 border-l-2`} />
      <span className={`${base} bottom-0 right-0 rounded-br-[6px] border-b-2 border-r-2`} />
    </span>
  );
}

/* Icon chip + title on one row. */
function IconTitle({ icon: Icon, title, size = 'text-[16px]', dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2"
        style={dark
          ? { borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }
          : { borderColor: 'var(--v2-wash)', background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}
      >
        <Icon size={18} />
      </span>
      <h3 className={`font-heading font-bold leading-snug ${size} ${dark ? 'text-white' : ''}`}>{title}</h3>
    </div>
  );
}

// `oneLine` keeps the heading on a single line from sm up (phones still wrap).
function SectionHead({ title, accent, lead, dark = false, wide = false, oneLine = false }) {
  return (
    <div className={oneLine ? 'max-w-none' : `max-w-2xl ${wide ? 'lg:max-w-none' : ''}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? 'var(--v2-accent)' : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${dark ? 'text-white/60' : 'text-black/55'}`}>{lead}</p>}
    </div>
  );
}

/* Light-meter scale: −3 … 0 … +3 with the needle centred. */
function MeterScale() {
  const ticks = Array.from({ length: 31 }, (_, i) => i - 15);
  return (
    <div aria-hidden="true" className="mx-auto flex max-w-md items-end justify-between">
      {ticks.map((t) => (
        <span
          key={t}
          className="w-[2px] rounded-full"
          style={{
            height: t === 0 ? 18 : t % 5 === 0 ? 11 : 6,
            background: t === 0 ? 'var(--v2-accent)' : 'rgba(255,255,255,0.28)',
          }}
        />
      ))}
    </div>
  );
}

/* A row of film sprocket holes. */
function Sprockets() {
  return (
    <div aria-hidden="true" className="flex h-3 items-center justify-between gap-2 overflow-hidden px-3">
      {Array.from({ length: 48 }, (_, i) => (
        <span key={i} className="h-2 w-3 flex-shrink-0 rounded-[3px]" style={{ background: 'var(--v2-canvas)', opacity: 0.85 }} />
      ))}
    </div>
  );
}

/* FAQ accordion — one answer open at a time. Height animates via the
   grid-rows 0fr→1fr trick; while it animates, the clicked question is held at
   the same screen position so an answer closing above it doesn't yank the page.
   Answers stay in the DOM (hidden from AT when closed) so the FAQPage JSON-LD
   copy is also on the page. */
const FAQ_MS = 280;

function FaqAccordion({ items }) {
  const [open, setOpen] = useState(-1);
  const btnRefs = useRef([]);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const toggle = (i) => {
    const btn = btnRefs.current[i];
    const startTop = btn ? btn.getBoundingClientRect().top : 0;
    setOpen((cur) => (cur === i ? -1 : i));
    if (!btn) return;

    // Anchor the clicked question for the length of the transition.
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const hold = (now) => {
      const drift = btn.getBoundingClientRect().top - startTop;
      if (Math.abs(drift) > 0.5) window.scrollBy(0, drift);
      if (now - t0 < FAQ_MS + 40) rafRef.current = requestAnimationFrame(hold);
    };
    rafRef.current = requestAnimationFrame(hold);
  };

  const renderItem = (f, i) => {
    const isOpen = open === i;
    const id = `faq-${i}`;
    return (
      <div key={f.q} className="rounded-[20px] border-2 bg-white transition-colors duration-200" style={{ borderColor: isOpen ? 'var(--v2-accent)' : 'rgba(0,0,0,0.07)' }}>
        <h3 style={{ margin: 0 }}>
          <button
            type="button"
            ref={(el) => { btnRefs.current[i] = el; }}
            onClick={() => toggle(i)}
            aria-expanded={isOpen}
            aria-controls={`${id}-panel`}
            id={`${id}-btn`}
            className={`flex w-full cursor-pointer items-center gap-4 rounded-[18px] px-5 py-4 text-left ${FOCUS}`}
          >
            <span className="flex-1 font-heading text-[16px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200"
              style={{ borderColor: isOpen ? 'var(--v2-accent)' : 'rgba(0,0,0,0.1)', color: isOpen ? 'var(--v2-accent-ink)' : 'inherit' }}
            >
              <Plus size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
            </span>
          </button>
        </h3>
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-btn`}
          aria-hidden={!isOpen}
          className="grid motion-reduce:transition-none"
          style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: `grid-template-rows ${FAQ_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
        >
          <div className="overflow-hidden">
            <p
              className="px-5 pb-5 text-[14.5px] leading-relaxed text-black/60 transition-opacity duration-200 motion-reduce:transition-none"
              style={{ opacity: isOpen ? 1 : 0 }}
            >
              {f.a}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Two columns on sm+, odd/even split — same layout as the dedicated /for pages.
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

export default function StudioSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;
  const wide = !!data.design.wideLayout;

  return (
    <>
      {/* ════════ SERVICES — contact sheet + host-signup CTA ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <Reveal className="mt-12 overflow-hidden rounded-[24px] border-2 border-black/[0.07]">
            <div className="grid gap-[2px] bg-black/[0.07] sm:grid-cols-2 lg:grid-cols-4">
              {whatYouGet.items.map((it, i) => {
                const Icon = icons.get[i % icons.get.length];
                return (
                  <Link key={it.title} to={routeStart} aria-label={`${it.title} — create your page`} className={`block text-[color:var(--v2-ink)] group relative bg-white p-7 transition-colors duration-200 hover:bg-[color:var(--v2-canvas)] hover:no-underline ${FOCUS}`}>
                    <Corners inset="inset-2.5" size="h-3 w-3" tone="transparent" />
                    <IconTitle icon={Icon} title={it.title} size="text-[15px]" />
                    <p className="mt-3 text-[13px] leading-relaxed text-black/55">{it.desc}</p>
                  </Link>
                );
              })}
            </div>
          </Reveal>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="text-[12px] font-semibold text-black/40">Also available</span>
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-full border-2 border-black/[0.07] px-3.5 py-1.5 text-[12.5px] font-medium text-black/60">{a}</span>
              ))}
            </div>
          )}
          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to={routeStart} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
              Create your page <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ════════ FLOW — frames on a film strip ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} />
          <Reveal className="mt-12 overflow-hidden rounded-[24px] py-3" style={{ background: 'var(--v2-dark)' }}>
            <Sprockets />
            <div className="grid gap-3 px-3 py-3 md:grid-cols-3">
              {flow.steps.map((st, i) => (
                <div key={st.title} className="group relative rounded-[20px] border-2 border-white/10 bg-white/[0.04] p-7 transition-colors duration-200 hover:border-white/25">
                  <Corners tone="rgba(255,255,255,0.22)" inset="inset-2.5" size="h-3 w-3" />
                  <IconTitle icon={FLOW_ICONS[i % FLOW_ICONS.length]} title={st.title} size="text-[17px]" dark />
                  <p className="mt-4 text-[14px] leading-relaxed text-white/60">{st.desc}</p>
                  <div aria-hidden="true" className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--v2-accent)' }} />
                    Meeticulous · 400
                  </div>
                </div>
              ))}
            </div>
            <Sprockets />
          </Reveal>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — framed tool cards ════════ */}
      <V2Integrations wrap={wrap} Decor={Corners} cardClass={STUDIO_CARD} lift={false} />

      {/* ════════ REAL IMPACT — exposure readout ════════ */}
      <section className="px-5 py-14 sm:px-8" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <MeterScale />
          <div className="mt-10 grid grid-cols-2 gap-y-10 lg:grid-cols-4 lg:divide-x lg:divide-white/10">
            {stats.map((s) => (
              <Reveal key={s.label} className="px-2 text-center lg:px-8">
                <div className="font-heading text-[clamp(2rem,4vw,3rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <p className="mx-auto mt-3 max-w-[22ch] text-[12.5px] leading-snug text-white/55">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS — framed client notes ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="From the studios" accent="already booked out." lead="What studio owners say." oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className={`group relative flex h-full flex-col bg-white p-8 ${STUDIO_CARD}`} style={{ margin: 0 }}>
                  <Corners />
                  <Quote size={28} aria-hidden="true" style={{ color: 'var(--v2-accent)' }} />
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-black/75" style={{ margin: 0 }}>{t.quote}</blockquote>
                  <figcaption className="mt-7 flex items-center gap-3 border-t-2 border-black/[0.06] pt-5">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-bold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>
                      {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <div>
                      <div className="text-[14px] font-bold">{t.name}</div>
                      <div className="text-[12.5px] text-black/50">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ BEFORE / AFTER — RAW vs EDITED ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} dark wide={wide} />
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-0">
            <Reveal className="rounded-[24px] border-2 border-white/10 p-8 md:rounded-r-none md:border-r-0">
              <div className="flex items-baseline justify-between">
                <span className="font-heading text-[22px] font-extrabold tracking-[-0.02em] text-white/35">RAW</span>
                <span className="text-[12px] font-semibold text-white/35">Before</span>
              </div>
              <ul className="mt-6 space-y-4">
                {beforeAfter.before.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] leading-relaxed text-white/50"><X size={16} className="mt-1 flex-shrink-0 text-white/25" />{b}</li>
                ))}
              </ul>
            </Reveal>

            {/* compare handle */}
            <div aria-hidden="true" className="relative hidden w-14 md:block">
              <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2" style={{ background: 'var(--v2-accent)' }} />
              <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white" style={{ background: 'var(--v2-accent)' }}>
                <ChevronsLeftRight size={18} />
              </span>
            </div>

            <Reveal delay={0.08} className="rounded-[24px] border-2 p-8 md:rounded-l-none md:border-l-0" style={{ borderColor: 'var(--v2-accent)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-baseline justify-between">
                <span className="font-heading text-[22px] font-extrabold tracking-[-0.02em] text-white">EDITED</span>
                <span className="text-[12px] font-semibold" style={{ color: 'var(--v2-accent)' }}>After</span>
              </div>
              <ul className="mt-6 space-y-4">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-3 text-[14px] leading-relaxed text-white/85"><Check size={16} className="mt-1 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />{a}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING — framed plan cards ════════ */}
      <V2Pricing routeStart={routeStart} Decor={Corners} cardClass={STUDIO_CARD} lift={false} />

      {/* ════════ ABOUT — framed trust cards ════════ */}
      <V2About wrap={wrap} label={data.label} background="transparent" Decor={Corners} cardClass={STUDIO_CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — two-column accordion ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <h2 className="text-center font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold tracking-[-0.02em]">Frequently asked questions.</h2>
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><FaqAccordion items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — viewfinder ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`group relative mx-auto ${wrap} overflow-hidden rounded-[32px] px-6 py-20 text-center sm:px-10`} style={{ background: 'var(--v2-dark)' }}>
          <Corners tone="rgba(255,255,255,0.35)" hover={false} inset="inset-6" size="h-8 w-8" />
          <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">{finalCta.subline}</p>
          <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
            {finalCta.ctaText} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
