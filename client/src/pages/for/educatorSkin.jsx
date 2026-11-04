// educatorSkin — the "school notebook" body for /for/educators.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'educator'`, and swaps the
// hero's generic booking card for <TimetableMock />. Every component is a piece
// of school stationery:
//   · hero: a weekly timetable — booked periods in ink, open ones highlighted
//   · services: notebook dividers — a coloured index tab on each card
//   · steps: one ruled notebook page with a red margin line
//   · real impact: a report card — subjects down the side, marks in red pen
//   · testimonials: notes torn from a spiral pad (binding holes on top)
//   · with/without: two marked answer sheets — red crosses vs red ticks
//   · FAQ: an exam paper — "Q." / "Ans.", the open question highlighted
//   · final CTA: an exercise-book cover with a name label
// Integrations, pricing and about come from the shared v2Sections, wearing a
// red margin line. No hover lift.
//
// Colour roles (all text pairs ≥ 4.5:1): navy ink (--v2-ink / --v2-dark / CTA)
// for text, dark bands and buttons; ink blue (--v2-accent-ink) for accent text
// and icons; teacher's red pen only for margins, marks and grades; pencil
// yellow only as a highlighter fill behind navy text; paper + pale-blue bands.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Check, X, Pencil, Link2, CreditCard, BookOpen } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(27,42,74,0.1)]';
const BORDER = 'rgba(27,42,74,0.12)';
const RED = '#B83A28'; // teacher's red pen — margins, marks, grades
const HIGHLIGHT = '#F2C230'; // pencil yellow — highlighter fill only, navy text on top
const RULED = 'rgba(47,74,138,0.14)'; // notebook rule lines
const TAB_COLOURS = ['var(--v2-ink)', RED, HIGHLIGHT, 'var(--v2-accent-ink)'];
const STEP_ICONS = [Link2, CreditCard, BookOpen];

/* Red margin line — the card ornament for the shared sections. */
function MarginDecor() {
  return <span aria-hidden="true" className="pointer-events-none absolute bottom-4 right-5 top-4 w-[2px] rounded-full" style={{ background: RED, opacity: 0.45 }} />;
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? HIGHLIGHT : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a weekly timetable — booked periods in ink, open ones highlighted ── */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIMES = ['4 pm', '5 pm', '6 pm'];
// booked periods, keyed "day-time"
const TAKEN = { '0-0': 'Maths', '1-1': 'Physics', '2-2': 'Maths', '3-0': 'Doubts', '4-1': 'Maths', '0-2': 'Physics' };

export function TimetableMock({ mock }) {
  const [svc, setSvc] = useState(0);
  const [cell, setCell] = useState('2-1');
  if (!mock) return null;
  const s = mock.services[svc];
  const [d, t] = cell.split('-').map(Number);

  return (
    <div className="mx-auto w-full max-w-md rounded-[26px] border-2 bg-white p-4 sm:p-5" style={{ borderColor: BORDER }}>
      <div className="text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
      <div className="text-[12px] text-black/60">{mock.tag}</div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {mock.services.map((x, i) => (
          <button
            key={x.name} type="button" onClick={() => setSvc(i)} aria-pressed={svc === i}
            className={`rounded-full border-2 px-3 py-1 text-[11.5px] font-semibold transition-colors ${FOCUS}`}
            style={svc === i ? { background: 'var(--v2-ink)', borderColor: 'var(--v2-ink)', color: '#fff' } : { borderColor: BORDER, color: 'var(--v2-ink)' }}
          >
            {x.name.split(' — ')[0]}
          </button>
        ))}
      </div>

      {/* the timetable */}
      <div className="mt-3 overflow-hidden rounded-[16px] border-2" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-[44px_repeat(5,minmax(0,1fr))] text-center text-[10.5px] font-bold" style={{ background: 'var(--v2-wash)' }}>
          <span />
          {DAYS.map((x) => <span key={x} className="py-1.5" style={{ color: 'var(--v2-accent-ink)' }}>{x}</span>)}
        </div>
        {TIMES.map((tm, ti) => (
          <div key={tm} className="grid grid-cols-[44px_repeat(5,minmax(0,1fr))] border-t" style={{ borderColor: BORDER }}>
            <span className="flex items-center justify-center text-[10px] font-semibold text-black/60">{tm}</span>
            {DAYS.map((_, di) => {
              const key = `${di}-${ti}`; const taken = TAKEN[key]; const on = cell === key;
              return taken ? (
                <span key={key} className="m-1 flex h-9 items-center justify-center rounded-[8px] text-[10px] font-semibold text-white" style={{ background: 'var(--v2-ink)' }}>{taken}</span>
              ) : (
                <button
                  key={key} type="button" onClick={() => setCell(key)} aria-pressed={on} aria-label={`${DAYS[di]} ${tm} — open`}
                  className={`m-1 h-9 rounded-[8px] border-2 text-[10px] font-bold transition-colors ${FOCUS}`}
                  style={on ? { background: HIGHLIGHT, borderColor: HIGHLIGHT, color: 'var(--v2-ink)' } : { borderColor: 'rgba(242,194,48,0.6)', borderStyle: 'dashed', color: 'var(--v2-ink)' }}
                >
                  {on ? '✓' : 'Open'}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] p-3 pl-4" style={{ background: 'var(--v2-ink)' }}>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-white">{s.name}</div>
          <div className="truncate text-[11px] text-white/70">{DAYS[d]} · {TIMES[t]} · {s.meta.split('·')[0].trim()}</div>
        </div>
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-bold" style={{ background: HIGHLIGHT, color: 'var(--v2-ink)' }}>
          {s.price} · Book <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
}

/* ── FAQ: an exam paper — Q. / Ans., the open question highlighted ──────────── */
function ExamFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="rounded-[18px] border-2 bg-white" style={{ borderColor: isOpen ? 'var(--v2-ink)' : BORDER }}>
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`ed-faq-${i}`} className={`flex w-full items-start gap-3 rounded-[16px] px-5 py-4 text-left ${FOCUS}`}>
            <span className="mt-0.5 flex-shrink-0 font-heading text-[14px] font-extrabold" style={{ color: RED }}>Q.</span>
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>
              <span className="rounded-[4px] px-0.5 transition-colors duration-200" style={{ background: isOpen ? 'rgba(242,194,48,0.55)' : 'transparent', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{f.q}</span>
            </span>
          </button>
        </h3>
        <div id={`ed-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="flex gap-3 px-5 pb-5 text-[14.5px] leading-relaxed text-black/70">
              <span className="flex-shrink-0 font-heading text-[13px] font-extrabold" style={{ color: 'var(--v2-accent-ink)' }}>Ans.</span>
              <span>{f.a}</span>
            </p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

const REPORT_GRADES = ['A+', 'A+', 'A', 'A+'];

export default function EducatorSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — notebook dividers with index tabs ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-14 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = icons.get[i % icons.get.length];
              const tab = TAB_COLOURS[i % TAB_COLOURS.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="relative h-full">
                  {/* the index tab */}
                  <span aria-hidden="true" className="absolute -top-5 left-6 flex h-7 w-14 items-center justify-center rounded-t-[10px]" style={{ background: tab, color: tab === HIGHLIGHT ? 'var(--v2-ink)' : '#fff' }}>
                    <Icon size={14} />
                  </span>
                  <Link
                    to={routeStart} aria-label={`${it.title} — create your page`}
                    className={`relative block h-full rounded-[20px] border-2 border-t-[5px] bg-white p-6 text-[color:var(--v2-ink)] transition-colors duration-200 hover:bg-[color:var(--v2-wash)] hover:no-underline ${FOCUS}`}
                    style={{ borderColor: BORDER, borderTopColor: tab }}
                  >
                    <span className="font-heading text-[16px] font-bold leading-snug">{it.title}</span>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-black/60">{it.desc}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap gap-2">
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-[6px] px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: 'rgba(242,194,48,0.45)', color: 'var(--v2-ink)' }}>{a}</span>
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

      {/* ════════ STEPS — one ruled notebook page ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto grid ${wrap} items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16`}>
          <SectionHead title={flow.title} lead="Write it down once. The rest takes care of itself." />
          <Reveal
            className="relative overflow-hidden rounded-[24px] bg-white py-8 pl-16 pr-6 sm:pl-20 sm:pr-10"
            style={{ backgroundImage: `repeating-linear-gradient(180deg, transparent 0 35px, ${RULED} 35px 36px)` }}
          >
            <span aria-hidden="true" className="absolute bottom-0 left-10 top-0 w-[2px] sm:left-14" style={{ background: RED, opacity: 0.6 }} />
            <div className="space-y-7">
              {flow.steps.map((st, i) => {
                const Icon = STEP_ICONS[i % STEP_ICONS.length];
                return (
                  <div key={st.title} className="relative">
                    <span className="absolute -left-12 top-0.5 flex h-7 w-7 items-center justify-center rounded-full sm:-left-14" style={{ background: 'var(--v2-ink)', color: '#fff' }}><Icon size={14} /></span>
                    <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: 'var(--v2-ink)' }}>{st.title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-black/70">{st.desc}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — red margin ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={MarginDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — a report card ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <SectionHead title="The report card" accent="you'll want framed." lead="How a term on Meeticulous adds up." dark />
          <Reveal className="overflow-hidden rounded-[22px] bg-white">
            <div className="flex items-center justify-between border-b-2 px-6 py-3.5" style={{ borderColor: BORDER, background: 'var(--v2-wash)' }}>
              <span className="text-[13px] font-bold" style={{ color: 'var(--v2-ink)' }}>Progress report · this term</span>
              <span className="text-[13px] font-bold" style={{ color: RED }}>Grade</span>
            </div>
            {stats.map((s, i) => (
              <div key={s.label} className={`flex items-center gap-4 px-6 py-4 ${i ? 'border-t' : ''}`} style={{ borderColor: BORDER }}>
                <div className="w-[118px] flex-shrink-0 whitespace-nowrap font-heading text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold leading-none tracking-[-0.02em]" style={{ color: 'var(--v2-ink)' }}>
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <p className="flex-1 text-[13.5px] leading-snug text-black/70">{s.label}</p>
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 font-heading text-[14px] font-extrabold" style={{ borderColor: RED, color: RED }}>{REPORT_GRADES[i % REPORT_GRADES.length]}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ════════ TESTIMONIALS — notes torn from a spiral pad ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Notes from" accent="the staff room." lead="What tutors and coaches say." oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="relative flex h-full flex-col rounded-[20px] border-2 bg-white px-6 pb-6 pt-10" style={{ margin: 0, borderColor: BORDER, backgroundImage: `repeating-linear-gradient(180deg, transparent 0 27px, ${RULED} 27px 28px)`, backgroundPosition: '0 30px' }}>
                  {/* spiral binding holes */}
                  <span aria-hidden="true" className="absolute inset-x-6 top-3 flex justify-between">
                    {Array.from({ length: 9 }, (_, k) => <span key={k} className="h-3 w-3 rounded-full border-2" style={{ borderColor: BORDER, background: 'var(--v2-canvas)' }} />)}
                  </span>
                  <blockquote className="flex-1 text-[15px] leading-[28px] text-black/80" style={{ margin: 0 }}>“{t.quote}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-2">
                    <Pencil size={15} style={{ color: RED }} />
                    <span className="text-[14px] font-bold text-[color:var(--v2-ink)]">{t.name}</span>
                    <span className="text-[12.5px] text-black/60">· {t.role}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — two marked answer sheets ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {[
              { title: 'Without a booking link', items: beforeAfter.before, good: false },
              { title: 'With Meeticulous', items: beforeAfter.after, good: true },
            ].map((sheet, k) => (
              <Reveal key={sheet.title} delay={k * 0.08} className="relative rounded-[22px] border-2 bg-white py-7 pl-14 pr-24" style={{ borderColor: sheet.good ? 'var(--v2-ink)' : BORDER }}>
                <span aria-hidden="true" className="absolute bottom-0 left-9 top-0 w-[2px]" style={{ background: RED, opacity: 0.5 }} />
                <span className="absolute right-6 top-6 flex h-14 w-14 items-center justify-center rounded-full border-[3px] font-heading text-[15px] font-extrabold" style={{ borderColor: RED, color: RED }}>
                  {sheet.good ? '10/10' : '3/10'}
                </span>
                <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: sheet.good ? 'var(--v2-ink)' : 'rgba(0,0,0,0.65)' }}>{sheet.title}</h3>
                <ul className="mt-5 space-y-3.5">
                  {sheet.items.map((x) => (
                    <li key={x} className={`relative text-[14.5px] leading-relaxed ${sheet.good ? 'text-black/80' : 'text-black/65'}`}>
                      <span className="absolute -left-[46px] top-0.5" style={{ color: RED }}>{sheet.good ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}</span>
                      {x}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={MarginDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={MarginDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — an exam paper ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><ExamFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — an exercise-book cover ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px] px-6 py-14 sm:px-10`} style={{ background: 'var(--v2-dark)' }}>
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-6 sm:w-8" style={{ background: RED }} />
          <div className="mx-auto max-w-2xl rounded-[20px] bg-white px-6 py-10 text-center sm:px-10">
            <div className="mx-auto flex max-w-xs items-end gap-2 border-b-2 pb-1 text-left text-[13px] font-semibold text-black/60" style={{ borderColor: BORDER }}>
              Name: <span className="font-heading text-[15px] font-bold" style={{ color: 'var(--v2-accent-ink)' }}>Your class</span>
            </div>
            <h2 className="mx-auto mt-7 max-w-xl font-heading text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: 'var(--v2-ink)' }}>{finalCta.headline}</h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-black/65">{finalCta.subline}</p>
            <Link to={routeStart} className={`mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
