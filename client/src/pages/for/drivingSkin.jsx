// drivingSkin — the "road & signs" body for /for/driving-schools.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'driving'`, and swaps the hero's
// generic booking card for <LessonRouteMock />. Same data and CTAs as the shared
// template; every component is drawn from the road:
//   · hero: a lesson route (road + centre line), vehicle tiles, time slots
//   · services: diamond warning-sign badges beside each title
//   · steps: milestones standing beside a stretch of road
//   · real impact: each figure on an Indian number plate
//   · testimonials: signboards on posts
//   · with/without: traffic lights — red for the old way, green for the new
//   · FAQ: two lanes of questions, the open one in the amber lane
//   · final CTA: a green light at the end of the road
// Integrations, pricing and about come from the shared v2Sections, wearing an
// L-plate ornament. No hover lift anywhere. Colours from --v2-* (amber/asphalt).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, ChevronRight, Car, Bike, RotateCcw, Link2, CreditCard, GraduationCap, Check, X } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(28,28,26,0.1)]';
const ASPHALT = '#1C1C1A';
const ASPHALT_DEEP = '#121211';
const LINE = '#F5B700'; // the one signal yellow: signs, road lines, highlights (fills, never text on light)
const STEP_ICONS = [Link2, CreditCard, GraduationCap];

/* A stretch of road: asphalt with a dashed yellow centre line. */
function Road({ className = '', height = 'h-14' }) {
  return (
    <div aria-hidden="true" className={`relative ${height} w-full overflow-hidden rounded-full ${className}`} style={{ background: ASPHALT }}>
      <span className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${LINE} 0 22px, transparent 22px 40px)` }} />
    </div>
  );
}

/* L-plate — the card ornament for the shared sections. */
function LPlateDecor() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-[6px] border-2 bg-white font-heading text-[12px] font-extrabold" style={{ borderColor: 'rgba(28,28,26,0.15)', color: '#DC2626' }}>L</span>
  );
}

/* Diamond warning-sign badge with an icon inside. */
function SignBadge({ icon: Icon }) {
  return (
    <span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
      <span aria-hidden="true" className="absolute inset-[5px] rotate-45 rounded-[6px] border-[3px]" style={{ background: LINE, borderColor: ASPHALT }} />
      <Icon size={16} className="relative" style={{ color: ASPHALT }} />
    </span>
  );
}

/* A traffic light; `on` = 'red' | 'green'. */
function TrafficLight({ on }) {
  const lamp = (c, lit) => <span className="h-4 w-4 rounded-full" style={{ background: lit ? c : 'rgba(255,255,255,0.14)' }} />;
  return (
    <span aria-hidden="true" className="inline-flex flex-col items-center gap-1.5 rounded-full px-2 py-2.5" style={{ background: ASPHALT }}>
      {lamp('#EF4444', on === 'red')}{lamp('#F59E0B', false)}{lamp('#22C55E', on === 'green')}
    </span>
  );
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? LINE : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/60' : 'text-black/55'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a lesson route, pick a vehicle and a slot ───────────────────────── */
const SLOTS = [{ t: '07:00', open: true }, { t: '08:00', open: false }, { t: '09:00', open: true }, { t: '17:00', open: true }, { t: '18:00', open: false }, { t: '19:00', open: true }];

export function LessonRouteMock({ mock }) {
  const svcs = mock?.services || [];
  const vehicles = [{ icon: Car, label: 'Car', svc: svcs[0] }, { icon: Bike, label: 'Two-wheeler', svc: svcs[1] }, { icon: RotateCcw, label: 'Refresher', svc: svcs[2] }];
  const [v, setV] = useState(0);
  const [slot, setSlot] = useState('09:00');
  if (!mock) return null;
  const cur = vehicles[v];

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border-2 bg-white p-4 sm:p-5" style={{ borderColor: 'rgba(28,28,26,0.12)' }}>
      <div className="text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
      <div className="text-[12px] text-black/60">{mock.tag}</div>

      {/* the route */}
      <div className="relative mt-4 overflow-hidden rounded-[20px] px-4 py-5" style={{ background: 'var(--v2-wash)' }}>
        <svg aria-hidden="true" viewBox="0 0 300 70" className="w-full">
          <path d="M14 52 C 80 52, 90 18, 150 18 S 230 52, 286 30" fill="none" stroke={ASPHALT} strokeWidth="14" strokeLinecap="round" />
          <path d="M14 52 C 80 52, 90 18, 150 18 S 230 52, 286 30" fill="none" stroke={LINE} strokeWidth="2" strokeDasharray="8 7" strokeLinecap="round" />
          <circle cx="14" cy="52" r="7" fill="#fff" stroke={ASPHALT} strokeWidth="3" />
          <circle cx="286" cy="30" r="7" fill="#22C55E" stroke={ASPHALT} strokeWidth="3" />
        </svg>
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-black/65"><span>School</span><span>Test ground</span></div>
      </div>

      {/* vehicle tiles */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {vehicles.map((x, i) => (
          <button
            key={x.label} type="button" onClick={() => setV(i)} aria-pressed={v === i}
            className={`flex flex-col items-center gap-1 rounded-[16px] border-2 py-2.5 text-[11.5px] font-semibold transition-colors ${FOCUS}`}
            style={v === i ? { borderColor: ASPHALT, background: ASPHALT, color: '#fff' } : { borderColor: 'rgba(28,28,26,0.12)', color: 'var(--v2-ink)' }}
          >
            <x.icon size={18} style={{ color: v === i ? LINE : 'var(--v2-accent-ink)' }} />{x.label}
          </button>
        ))}
      </div>

      {/* time slots */}
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {SLOTS.map((s) => (
          <button
            key={s.t} type="button" disabled={!s.open} onClick={() => setSlot(s.t)} aria-pressed={slot === s.t}
            className={`rounded-full py-1.5 text-[10.5px] font-bold transition-colors ${FOCUS} ${s.open ? '' : 'cursor-not-allowed line-through'}`}
            style={!s.open ? { color: 'rgba(28,28,26,0.45)', background: 'rgba(28,28,26,0.05)' }
              : slot === s.t ? { background: ASPHALT, color: LINE } : { background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}
          >
            {s.t}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] p-3 pl-4" style={{ background: ASPHALT }}>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-white">{cur.svc?.name}</div>
          <div className="truncate text-[11px] text-white/55">Today · {slot} · {cur.svc?.meta?.split('·')[1]?.trim()}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[15px] font-extrabold text-white">{cur.svc?.price}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-bold" style={{ background: LINE, color: ASPHALT }}>
            Book <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ: two lanes; the open question moves into the amber lane ─────────── */
function LaneFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="relative rounded-[20px] border-2 pl-3 transition-colors duration-200" style={{ borderColor: isOpen ? 'var(--v2-accent)' : 'rgba(28,28,26,0.1)', background: isOpen ? 'var(--v2-wash)' : '#fff' }}>
        <span aria-hidden="true" className="absolute bottom-4 left-4 top-4 w-[3px] rounded-full" style={{ backgroundImage: `repeating-linear-gradient(180deg, ${isOpen ? 'var(--v2-accent)' : 'rgba(28,28,26,0.18)'} 0 8px, transparent 8px 14px)` }} />
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`ds-faq-${i}`} className={`flex w-full items-center gap-3 rounded-[18px] py-4 pl-6 pr-5 text-left ${FOCUS}`}>
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
            <ChevronRight size={18} className="flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
          </button>
        </h3>
        <div id={`ds-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="pb-5 pl-6 pr-6 text-[14.5px] leading-relaxed text-black/65">{f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

export default function DrivingSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — road-sign cards ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = icons.get[i % icons.get.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="h-full">
                  <Link
                    to={routeStart} aria-label={`${it.title} — create your page`}
                    className={`block h-full rounded-[24px] border-2 bg-white p-6 text-[color:var(--v2-ink)] transition-colors duration-200 hover:bg-[color:var(--v2-wash)] hover:no-underline ${FOCUS}`}
                    style={{ borderColor: 'rgba(28,28,26,0.1)' }}
                  >
                    <div className="flex items-center gap-3">
                      <SignBadge icon={Icon} />
                      <h3 className="font-heading text-[15.5px] font-bold leading-snug" style={{ margin: 0 }}>{it.title}</h3>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-black/60">{it.desc}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap gap-2">
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-[10px] border-2 px-3 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: ASPHALT, color: ASPHALT, background: '#fff' }}>{a}</span>
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

      {/* ════════ STEPS — milestones beside the road ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} center />
          <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
            {flow.steps.map((st, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <Reveal key={st.title} delay={i * 0.07} className="flex flex-col items-center text-center">
                  {/* milestone stone */}
                  <span className="flex h-16 w-14 flex-col items-center justify-center rounded-t-[28px] rounded-b-[8px] border-2 bg-white" style={{ borderColor: ASPHALT }}>
                    <Icon size={20} style={{ color: 'var(--v2-accent-ink)' }} />
                  </span>
                  <span aria-hidden="true" className="h-4 w-1 rounded-b" style={{ background: ASPHALT }} />
                  <h3 className="mt-4 font-heading text-[18px] font-bold" style={{ margin: '16px 0 0' }}>{st.title}</h3>
                  <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-black/60">{st.desc}</p>
                </Reveal>
              );
            })}
          </div>
          <Road className="mt-10" />
        </div>
      </section>

      {/* ════════ INTEGRATIONS — L-plate ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={LPlateDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — number plates ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: ASPHALT }}>
        <div className={`mx-auto grid ${wrap} grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4`}>
          {stats.map((s) => (
            <Reveal key={s.label} className="flex flex-col">
              <div className="flex overflow-hidden rounded-[14px] border-[3px] bg-white" style={{ borderColor: ASPHALT }}>
                <span aria-hidden="true" className="flex w-9 flex-shrink-0 flex-col items-center justify-end pb-1.5 text-[9px] font-extrabold" style={{ background: ASPHALT, color: LINE }}>IND</span>
                <span className="flex-1 whitespace-nowrap px-3 py-3 text-center font-heading text-[clamp(1.7rem,2.6vw,2.3rem)] font-extrabold leading-none tracking-[0.02em]" style={{ color: ASPHALT }}>
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </span>
              </div>
              <p className="mt-3 text-[12.5px] leading-snug text-white/60">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════ TESTIMONIALS — signboards on posts ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Fewer calls," accent="more lessons." lead="What driving-school owners say." oneLine />
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="flex flex-col items-center">
                <figure className="flex w-full flex-1 flex-col rounded-[24px] border-[3px] p-7" style={{ margin: 0, background: LINE, borderColor: ASPHALT }}>
                  <blockquote className="flex-1 text-[15px] font-medium leading-relaxed" style={{ margin: 0, color: ASPHALT }}>“{t.quote}”</blockquote>
                  <figcaption className="mt-6 border-t-2 pt-4" style={{ borderColor: 'rgba(28,28,26,0.2)' }}>
                    <div className="text-[14px] font-bold" style={{ color: ASPHALT }}>{t.name}</div>
                    <div className="text-[12.5px]" style={{ color: 'rgba(28,28,26,0.72)' }}>{t.role}</div>
                  </figcaption>
                </figure>
                {/* the post */}
                <span aria-hidden="true" className="h-10 w-3 rounded-b-[4px]" style={{ background: ASPHALT }} />
                <span aria-hidden="true" className="h-2 w-12 rounded-full" style={{ background: 'rgba(28,28,26,0.15)' }} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — traffic lights ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="flex gap-5 rounded-[24px] bg-white p-7">
              <TrafficLight on="red" />
              <div>
                <h3 className="font-heading text-[18px] font-bold text-black/60" style={{ margin: 0 }}>Without a booking link</h3>
                <ul className="mt-5 space-y-3.5">
                  {beforeAfter.before.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-black/60"><X size={17} className="mt-0.5 flex-shrink-0 text-[#EF4444]" />{b}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="flex gap-5 rounded-[24px] border-2 bg-white p-7" style={{ borderColor: '#22C55E' }}>
              <TrafficLight on="green" />
              <div>
                <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: 'var(--v2-ink)' }}>With Meeticulous</h3>
                <ul className="mt-5 space-y-3.5">
                  {beforeAfter.after.map((a) => (
                    <li key={a} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-black/80"><Check size={17} className="mt-0.5 flex-shrink-0 text-[#16A34A]" />{a}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={LPlateDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={LPlateDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — two lanes ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><LaneFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — a green light at the end of the road ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px]`} style={{ background: ASPHALT }}>
          <div className="relative flex flex-col items-center gap-10 px-6 pb-16 pt-16 text-center sm:px-10 lg:flex-row lg:text-left">
            <div className="flex-1">
              <h2 className="font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65 lg:max-w-2xl">{finalCta.subline}</p>
              <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold hover:no-underline ${FOCUS}`} style={{ background: LINE, color: ASPHALT }}>
                {finalCta.ctaText} <ArrowRight size={16} />
              </Link>
            </div>
            <span aria-hidden="true" className="hidden flex-col items-center gap-2.5 rounded-[28px] border-2 border-white/10 px-4 py-5 lg:flex" style={{ background: ASPHALT_DEEP }}>
              <span className="h-10 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="h-10 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="h-10 w-10 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 0 6px rgba(34,197,94,0.18)' }} />
            </span>
          </div>
          <div className="px-6 pb-8"><Road height="h-10" /></div>
        </div>
      </section>
    </>
  );
}
