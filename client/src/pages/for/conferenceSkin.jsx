// conferenceSkin — the "seating chart" body for /for/conference-halls.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'conference'`, and swaps the
// hero's generic booking card for <SeatingChartMock />. Same data and CTAs as
// the shared template; the presentation is built around a hall's seating:
//   · hero: a stage with seats — switch Theatre / Classroom / Boardroom layouts
//   · services: table-tent cards (a folded accent band on top)
//   · steps: a printed programme — when, then what, ruled rows
//   · real impact: capacity gauges (a half-circle "auditorium" arc above each figure)
//   · testimonials: event name badges with a lanyard slot
//   · with/without: two seat blocks either side of an aisle
//   · FAQ: a Q&A session — two columns, a raised hand on the open question
//   · final CTA: curtain call — the stage edge with a fan of seats below
// Integrations, pricing and about come from the shared v2Sections, wearing a
// three-seat ornament. No hover lift anywhere. Colours from --v2-* (navy/blue).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Plus, Hand, Link2, CreditCard, Presentation, X, Check } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(18,28,46,0.1)]';
const STEP_ICONS = [Link2, CreditCard, Presentation];
const STEP_WHEN = ['Before the event', 'Booking day', 'On the day'];
const PALE = '#BFDBFE'; // light blue for seats / gauges on the navy bands

/* Three seats in a row — the card ornament for the shared sections. */
function SeatsDecor() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute right-5 top-5 flex gap-1">
      {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i === 1 ? 'var(--v2-accent)' : 'rgba(18,28,46,0.15)' }} />)}
    </span>
  );
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? PALE : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/60' : 'text-black/55'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a stage + seats, switchable between three hall layouts ─────────── */
const booked = (r, c) => (r * 7 + c * 3) % 5 === 0;

function TheatreSeats() {
  const rows = [10, 12, 14, 14];
  return (
    <div className="space-y-1">
      {rows.map((n, r) => (
        <div key={r} className="flex justify-center gap-1">
          {Array.from({ length: n }, (_, c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-t-full rounded-b-[3px]" style={booked(r, c) ? { background: 'var(--v2-ink)' } : { border: '2px solid var(--v2-accent)' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ClassroomSeats() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((r) => (
        <div key={r} className="flex justify-center gap-4">
          {[0, 1, 2].map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span className="h-2 w-12 rounded-full" style={{ background: 'rgba(18,28,46,0.15)' }} />
              <div className="flex gap-2">
                {[0, 1].map((c) => <span key={c} className="h-3 w-3 rounded-t-full rounded-b-[3px]" style={booked(r, t * 2 + c) ? { background: 'var(--v2-ink)' } : { border: '2px solid var(--v2-accent)' }} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function BoardroomSeats() {
  const seat = (k) => <span key={k} className="h-3 w-3 rounded-full" style={{ border: '2px solid var(--v2-accent)' }} />;
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {seat('l')}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((k) => seat('t' + k))}</div>
        <div className="flex h-10 w-48 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>Table for 12</div>
        <div className="flex gap-3">{[0, 1, 2, 3, 4].map((k) => seat('b' + k))}</div>
      </div>
      {seat('r')}
    </div>
  );
}

export function SeatingChartMock({ mock }) {
  const [boardroom, seminar, conference] = mock?.services || [];
  const layouts = [
    { key: 'theatre', label: 'Theatre', svc: conference, Seats: TheatreSeats },
    { key: 'classroom', label: 'Classroom', svc: seminar, Seats: ClassroomSeats },
    { key: 'boardroom', label: 'Boardroom', svc: boardroom, Seats: BoardroomSeats },
  ];
  const [active, setActive] = useState(0);
  if (!mock) return null;
  const L = layouts[active];

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border-2 bg-white p-4 sm:p-5" style={{ borderColor: 'rgba(18,28,46,0.12)' }}>
      <div>
        <div className="text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
        <div className="text-[12px] text-black/45">{mock.tag}</div>
      </div>
      <div role="tablist" aria-label="Hall layout" className="mt-3 grid grid-cols-3 gap-1 rounded-full p-1" style={{ background: 'var(--v2-wash)' }}>
        {layouts.map((l, i) => (
          <button
            key={l.key} type="button" role="tab" aria-selected={active === i} onClick={() => setActive(i)}
            className={`rounded-full py-2 text-[12px] font-semibold transition-colors ${FOCUS}`}
            style={active === i ? { background: 'var(--v2-ink)', color: '#fff' } : { color: 'var(--v2-accent-ink)' }}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-[20px] border-2 px-3 pb-3 pt-2.5" style={{ borderColor: 'rgba(18,28,46,0.08)' }}>
        <div className="mx-auto mb-3 w-2/3 rounded-b-[18px] rounded-t-[6px] py-1 text-center text-[11px] font-semibold text-white" style={{ background: 'var(--v2-ink)' }}>Stage</div>
        <L.Seats />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] p-3 pl-4" style={{ background: 'var(--v2-wash)' }}>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-[color:var(--v2-ink)]">{L.svc?.name}</div>
          <div className="truncate text-[11px] text-black/50">{L.svc?.meta}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[15px] font-extrabold text-[color:var(--v2-ink)]">{L.svc?.price}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
            Hold date <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* Half-circle capacity gauge — decorative, the arc of an auditorium. */
function Gauge({ fill }) {
  const r = 52; const len = Math.PI * r;
  return (
    <svg aria-hidden="true" viewBox="0 0 120 66" className="w-full max-w-[150px]">
      <path d={`M8 60 A${r} ${r} 0 0 1 112 60`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M8 60 A${r} ${r} 0 0 1 112 60`} fill="none" stroke={PALE} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${len * fill} ${len}`} />
    </svg>
  );
}
const GAUGE_FILL = [0.92, 1, 0.78, 0.86];

/* ── FAQ: a Q&A session — two columns, one question "on the floor" at a time ── */
function QandA({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="rounded-[20px] border-2 transition-colors duration-200" style={{ borderColor: isOpen ? 'var(--v2-ink)' : 'rgba(18,28,46,0.1)', background: isOpen ? 'var(--v2-ink)' : '#fff' }}>
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`ch-faq-${i}`} className={`flex w-full items-center gap-3 rounded-[18px] px-5 py-4 text-left ${FOCUS}`}>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200" style={isOpen ? { background: PALE, color: 'var(--v2-ink)' } : { background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>
              <Hand size={15} />
            </span>
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: isOpen ? '#fff' : 'var(--v2-ink)' }}>{f.q}</span>
            <Plus size={18} className="flex-shrink-0 transition-transform duration-200" style={{ color: isOpen ? PALE : 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(45deg)' : 'none' }} />
          </button>
        </h3>
        <div id={`ch-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="pb-5 pl-[64px] pr-6 text-[14.5px] leading-relaxed text-white/75">{f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

export default function ConferenceSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — table-tent cards ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = icons.get[i % icons.get.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="h-full">
                  <Link to={routeStart} aria-label={`${it.title} — create your page`} className={`text-[color:var(--v2-ink)] flex h-full flex-col overflow-hidden rounded-[24px] border-2 bg-white hover:no-underline ${FOCUS}`} style={{ borderColor: 'rgba(18,28,46,0.1)' }}>
                    <span aria-hidden="true" className="h-3 w-full" style={{ background: i % 2 ? 'var(--v2-ink)' : 'var(--v2-accent)' }} />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}><Icon size={18} /></span>
                        <h3 className="font-heading text-[15.5px] font-bold leading-snug" style={{ margin: 0 }}>{it.title}</h3>
                      </div>
                      <p className="mt-3 text-[13.5px] leading-relaxed text-black/60">{it.desc}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>{a}</span>
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

      {/* ════════ STEPS — a printed programme ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto grid ${wrap} items-start gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16`}>
          <SectionHead title={flow.title} lead="Your venue's booking, run like an event programme." />
          <div className="overflow-hidden rounded-[24px] border-2 bg-white" style={{ borderColor: 'rgba(18,28,46,0.1)' }}>
            {flow.steps.map((st, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <Reveal key={st.title} delay={i * 0.07} className={`grid gap-3 p-6 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-6 sm:p-7 ${i ? 'border-t-2' : ''}`} style={{ borderColor: 'rgba(18,28,46,0.08)' }}>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--v2-accent-ink)' }}>{STEP_WHEN[i] || ''}</div>
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--v2-ink)' }}><Icon size={19} /></span>
                    <div>
                      <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0 }}>{st.title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-black/60">{st.desc}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — three-seat ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={SeatsDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — capacity gauges ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto grid ${wrap} grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4`}>
          {stats.map((s, i) => (
            <Reveal key={s.label} className="flex flex-col items-center text-center">
              <div className="w-full max-w-[120px]">
                <Gauge fill={GAUGE_FILL[i % GAUGE_FILL.length]} />
              </div>
              <div className="mt-3 whitespace-nowrap font-heading text-[clamp(1.8rem,3.2vw,2.6rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
              </div>
              <p className="mt-3 max-w-[24ch] text-[12.5px] leading-snug text-white/55">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════ TESTIMONIALS — event name badges ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Venues that stopped" accent="chasing enquiries." lead="What venue teams say." oneLine center />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="relative flex h-full flex-col items-center rounded-[24px] border-2 bg-white px-7 pb-8 pt-10 text-center" style={{ margin: 0, borderColor: 'rgba(18,28,46,0.1)' }}>
                  <span aria-hidden="true" className="absolute left-1/2 top-4 h-2.5 w-14 -translate-x-1/2 rounded-full" style={{ background: 'rgba(18,28,46,0.12)' }} />
                  <figcaption>
                    <div className="font-heading text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--v2-ink)' }}>{t.name}</div>
                    <div className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--v2-accent-ink)' }}>{t.role}</div>
                  </figcaption>
                  <span aria-hidden="true" className="my-5 h-[3px] w-12 rounded-full" style={{ background: 'var(--v2-accent)' }} />
                  <blockquote className="text-[14.5px] leading-relaxed text-black/70" style={{ margin: 0 }}>“{t.quote}”</blockquote>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — two seat blocks either side of an aisle ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} oneLine />
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-[1fr_72px_1fr] md:gap-0">
            <Reveal className="rounded-[24px] bg-white p-8">
              <h3 className="font-heading text-[18px] font-bold text-black/45" style={{ margin: 0 }}>Without a booking link</h3>
              <ul className="mt-6 space-y-4">
                {beforeAfter.before.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-black/50">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-t-full rounded-b-[3px]" style={{ background: 'rgba(18,28,46,0.18)' }}><X size={10} className="text-white" /></span>{b}
                  </li>
                ))}
              </ul>
            </Reveal>
            {/* the aisle */}
            <div aria-hidden="true" className="hidden flex-col items-center justify-center gap-2 md:flex">
              <span className="w-0 flex-1 border-l-2 border-dashed" style={{ borderColor: 'rgba(18,28,46,0.2)' }} />
              <span className="text-[11px] font-semibold text-black/40 [writing-mode:vertical-rl]">Aisle</span>
              <span className="w-0 flex-1 border-l-2 border-dashed" style={{ borderColor: 'rgba(18,28,46,0.2)' }} />
            </div>
            <Reveal delay={0.08} className="rounded-[24px] p-8" style={{ background: 'var(--v2-ink)' }}>
              <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: PALE }}>With Meeticulous</h3>
              <ul className="mt-6 space-y-4">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-white/85">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-t-full rounded-b-[3px]" style={{ background: PALE }}><Check size={10} style={{ color: 'var(--v2-ink)' }} /></span>{a}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={SeatsDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={SeatsDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — a Q&A session ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><QandA items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — curtain call ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px] text-center`} style={{ background: 'var(--v2-dark)' }}>
          <div className="relative px-6 pb-10 pt-20 sm:px-10">
            <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">{finalCta.subline}</p>
            <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold hover:no-underline ${FOCUS}`} style={{ background: '#fff', color: 'var(--v2-accent-ink)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </div>
          {/* the stage edge, then a fan of seats facing it */}
          <div aria-hidden="true" className="mx-auto h-3 w-2/3 rounded-b-full" style={{ background: PALE, opacity: 0.35 }} />
          <div aria-hidden="true" className="space-y-2 px-6 pb-10 pt-6 opacity-40">
            {[16, 20, 24].map((n, r) => (
              <div key={r} className="flex justify-center gap-2">
                {Array.from({ length: n }, (_, c) => <span key={c} className="h-2.5 w-2.5 rounded-t-full rounded-b-[3px]" style={{ background: PALE }} />)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
