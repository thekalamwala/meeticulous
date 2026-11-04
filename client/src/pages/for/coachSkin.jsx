// coachSkin — the "growth journey" body for /for/coaches.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'coach'`, and swaps the hero's
// generic booking card for <GoalTrackerMock />. Every component is a piece of
// a coaching engagement:
//   · hero: a client's goal tracker — a progress ring that fills per session
//   · services: a trail of milestones winding across topographic contours
//   · steps: a flip chart on an easel, drawn in marker with arrows
//   · real impact: progress rings on a deep-forest band
//   · testimonials: breakthrough-journal pages with a highlighted line
//   · with/without: a coaching scorecard — stuck vs. growing
//   · FAQ: worksheet prompts — two columns, one open at a time
//   · final CTA: the summit at sunrise, flag planted
// Integrations, pricing and about come from the shared v2Sections, wearing a
// small flag ornament. No hover lift. Colours from --v2-* (calm green) with a
// warm sunrise peach as the second hue.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Check, ChevronDown, Flag, Sparkles, CircleCheck } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(15,36,28,0.1)]';
const MINT = '#6EE7B7'; // highlight on the deep-forest surfaces
const SUN = '#FDBA74'; // sunrise peach — the second hue
const MARKER = '#C2410C'; // sunrise marker ink, readable on white
const HIGHLIGHT = 'rgba(253,186,116,0.6)';
const BORDER = 'rgba(15,36,28,0.12)';
const RINGS = [0.92, 1, 0.78, 0.62]; // how full each stat ring is drawn
const CONTOURS = [
  'repeating-radial-gradient(circle at 12% 22%, transparent 0 26px, rgba(16,185,129,0.13) 26px 27.5px)',
  'repeating-radial-gradient(circle at 88% 78%, transparent 0 30px, rgba(16,185,129,0.11) 30px 31.5px)',
].join(', ');

const CO_CSS = `
.co-draw{animation:co-draw 1.6s cubic-bezier(.22,1,.36,1) both}
@keyframes co-draw{from{stroke-dashoffset:var(--c)}}
@media (prefers-reduced-motion: reduce){.co-draw{animation:none}}
`;

/* A progress ring (SVG), drawn from 12 o'clock. */
function Ring({ pct, size = 132, stroke = 10, color, track = 'rgba(255,255,255,0.12)', animate = true, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={animate ? 'co-draw' : ''} style={{ '--c': c, transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className="relative text-center">{children}</span>
    </span>
  );
}

/* Card ornament for the shared sections: a small flag in the top-right corner. */
function FlagDecor() {
  return <Flag aria-hidden="true" size={17} className="pointer-events-none absolute right-5 top-5" style={{ color: 'var(--v2-accent)', opacity: 0.45 }} />;
}

function SectionHead({ title, accent, lead, dark = false, center = false }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? MINT : 'var(--v2-heading-accent)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a client's goal tracker ─────────────────────────────────────────── */
export function GoalTrackerMock({ mock }) {
  const svcs = mock?.services || [];
  const [active, setActive] = useState(1);
  if (!mock) return null;
  const s = svcs[active];
  const initials = mock.brand.split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <div className="relative mx-auto w-full max-w-md">
      <style>{CO_CSS}</style>
      <div className="overflow-hidden rounded-[24px] border-2 bg-white shadow-[0_30px_70px_-34px_rgba(7,32,25,0.55)]" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--v2-dark)' }}>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-bold" style={{ background: SUN, color: 'var(--v2-dark)' }}>{initials}</span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-white">{mock.brand}</div>
            <div className="truncate text-[12px] text-white/60">{mock.tag}</div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-5">
            <Ring pct={(active + 1) / Math.max(svcs.length, 1)} size={104} stroke={9} color="var(--v2-accent)" track="var(--v2-wash)" animate={false}>
              <span className="block font-heading text-[22px] font-extrabold leading-none" style={{ color: 'var(--v2-ink)' }}>{active + 1}/{svcs.length}</span>
              <span className="mt-1 block text-[10px] font-semibold text-black/50">sessions</span>
            </Ring>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-black/50">Client goal</div>
              <div className="mt-0.5 font-heading text-[16px] font-bold leading-snug" style={{ color: 'var(--v2-ink)' }}>Land a leadership role by March</div>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(253,186,116,0.35)', color: MARKER }}>
                <Sparkles size={11} /> On track
              </span>
            </div>
          </div>

          {/* the plan — sessions as checkpoints */}
          <ol className="relative mt-5 space-y-1">
            <span aria-hidden="true" className="absolute bottom-5 left-[15px] top-5 w-[2px]" style={{ background: 'var(--v2-wash)' }} />
            {svcs.map((x, i) => {
              const done = i < active;
              const on = i === active;
              return (
                <li key={x.name}>
                  <button
                    type="button" onClick={() => setActive(i)} aria-pressed={on}
                    className={`relative flex w-full items-center gap-3 rounded-[16px] px-1.5 py-2 text-left transition-colors ${FOCUS}`}
                    style={on ? { background: 'var(--v2-wash)' } : undefined}
                  >
                    <span className="relative z-10 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2" style={done || on ? { background: 'var(--v2-accent-cta)', borderColor: 'var(--v2-accent-cta)' } : { background: '#fff', borderColor: BORDER }}>
                      {done ? <Check size={12} strokeWidth={3} className="text-white" /> : on ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--v2-ink)' }}>{x.name}</span>
                      <span className="block truncate text-[11px] text-black/50">{x.meta}</span>
                    </span>
                    <span className="whitespace-nowrap pr-2 text-[14px] font-extrabold" style={{ color: 'var(--v2-ink)' }}>{x.price}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
            Book {s?.name} · {s?.price} <ArrowRight size={14} />
          </div>
        </div>
      </div>
      {/* the "paid" toast */}
      <div className="absolute -left-5 -top-4 flex items-center gap-2 rounded-full border-2 bg-white px-3.5 py-2" style={{ borderColor: BORDER }}>
        <CircleCheck size={16} style={{ color: 'var(--v2-accent)' }} />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--v2-ink)' }}>Paid · on your calendar</span>
      </div>
    </div>
  );
}

/* ── FAQ: worksheet prompts — two columns, one open ────────────────────────── */
function WorksheetFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="flex overflow-hidden rounded-[20px] border-2 bg-white" style={{ borderColor: isOpen ? 'var(--v2-accent)' : BORDER }}>
        <span aria-hidden="true" className="flex w-12 flex-shrink-0 justify-center pt-[18px] font-heading text-[13px] font-extrabold" style={isOpen ? { background: 'var(--v2-accent-cta)', color: '#fff' } : { background: 'rgba(253,186,116,0.3)', color: MARKER }}>
          Q{i + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 style={{ margin: 0 }}>
            <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`co-faq-${i}`} className={`flex w-full items-center gap-3 rounded-[16px] px-4 py-4 text-left ${FOCUS}`}>
              <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
              <ChevronDown size={18} className="flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
          </h3>
          <div id={`co-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <div className="overflow-hidden">
              <div className="mx-4 mb-4 rounded-[16px] p-4" style={{ background: 'var(--v2-wash)' }}>
                <p className="text-[14.5px] leading-relaxed text-black/70">{f.a}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--v2-accent-ink)' }}><Check size={13} strokeWidth={3} /> Answered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

/* A hand-drawn marker arrow between flip-chart steps. */
function MarkerArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 80 40" className="mt-6 hidden h-10 w-16 sm:block lg:w-20" fill="none" stroke={MARKER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 30 C 22 4, 50 4, 72 22" />
      <path d="M62 22 L73 23 L70 12" />
    </svg>
  );
}

export default function CoachSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;
  const rows = [whatYouGet.items.slice(0, 4), whatYouGet.items.slice(4, 8)];

  return (
    <>
      <style>{CO_CSS}</style>

      {/* ════════ SERVICES — a trail of milestones over contour lines ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ backgroundColor: 'var(--v2-wash)', backgroundImage: CONTOURS }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 space-y-6 lg:pr-8">
            {rows.map((row, r) => (
              <div key={r} className={`relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${r === 1 ? 'lg:[direction:rtl]' : ''}`}>
                {/* the trail through this row's markers */}
                <span aria-hidden="true" className="absolute left-6 right-6 top-[18px] hidden border-t-[3px] border-dashed lg:block" style={{ borderColor: 'color-mix(in srgb, var(--v2-accent) 55%, transparent)' }} />
                {/* the switchback down to the next row */}
                {r === 0 && (
                  <span aria-hidden="true" className="absolute -right-8 top-[18px] hidden w-14 rounded-r-full border-[3px] border-l-0 border-dashed lg:block" style={{ height: 'calc(100% + 24px)', borderColor: 'color-mix(in srgb, var(--v2-accent) 55%, transparent)' }} />
                )}
                {row.map((it, k) => {
                  const i = r * 4 + k;
                  const Icon = icons.get[i % icons.get.length];
                  const summit = i === whatYouGet.items.length - 1;
                  return (
                    <Link
                      key={it.title} to={routeStart} aria-label={`${it.title} — create your page`}
                      className={`relative block text-[color:var(--v2-ink)] [direction:ltr] hover:no-underline ${FOCUS} group rounded-[24px]`}
                    >
                      <span className="relative z-10 ml-4 flex h-9 w-9 items-center justify-center rounded-full border-[3px] font-heading text-[13px] font-extrabold" style={summit ? { background: SUN, borderColor: '#fff', color: 'var(--v2-dark)' } : { background: 'var(--v2-accent-cta)', borderColor: '#fff', color: '#fff' }}>
                        {summit ? <Flag size={14} /> : i + 1}
                      </span>
                      <span className="mt-3 block rounded-[24px] border-2 bg-white p-5 transition-colors duration-200 group-hover:border-[color:var(--v2-accent)]" style={{ borderColor: BORDER }}>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: i % 2 ? 'rgba(253,186,116,0.3)' : 'var(--v2-wash)', color: i % 2 ? MARKER : 'var(--v2-accent-ink)' }}><Icon size={18} /></span>
                        <span className="mt-4 block font-heading text-[15px] font-bold leading-snug">{it.title}</span>
                        <span className="mt-1.5 block text-[13px] leading-relaxed text-black/60">{it.desc}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          {whatYouGet.addons && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-black/60">Side trails:</span>
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-full border-2 border-dashed bg-white px-3 py-1 text-[12.5px] font-semibold" style={{ borderColor: 'color-mix(in srgb, var(--v2-accent) 45%, transparent)', color: 'var(--v2-accent-ink)' }}>{a}</span>
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

      {/* ════════ STEPS — a flip chart on an easel ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} lead="Set it up once in the session room. After that, every booking runs itself." center />
          <Reveal className="mx-auto mt-12 max-w-5xl">
            {/* clip bar */}
            <div aria-hidden="true" className="relative z-10 mx-auto flex h-7 w-[86%] items-center justify-between rounded-full px-10" style={{ background: 'var(--v2-dark)' }}>
              <span className="h-3 w-3 rounded-full" style={{ background: MINT }} />
              <span className="h-3 w-3 rounded-full" style={{ background: MINT }} />
            </div>
            {/* the paper */}
            <div className="-mt-3 rounded-[24px] border-2 bg-white px-6 pb-10 pt-10 shadow-[0_26px_50px_-32px_rgba(7,32,25,0.5)] sm:px-10" style={{ borderColor: BORDER }}>
              <p className="text-center font-serif text-[clamp(1.5rem,2.6vw,2rem)] italic" style={{ color: MARKER }}>three steps to a full calendar</p>
              <ol className="mt-8 grid items-start gap-8 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-3">
                {flow.steps.map((st, i) => (
                  <li key={st.title} className="contents">
                    <div className="text-center">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] font-heading text-[24px] font-extrabold" style={{ borderColor: 'var(--v2-accent)', color: 'var(--v2-accent-ink)', borderRadius: ['48% 52% 45% 55% / 55% 45% 55% 45%', '55% 45% 50% 50% / 45% 55% 45% 55%', '50% 50% 55% 45% / 50% 45% 55% 50%'][i % 3] }}>{i + 1}</span>
                      <h3 className="mt-4 font-heading text-[17px] font-bold" style={{ margin: 0, color: 'var(--v2-ink)' }}>
                        <span style={{ backgroundImage: `linear-gradient(transparent 58%, ${HIGHLIGHT} 58%)` }}>{st.title}</span>
                      </h3>
                      <p className="mx-auto mt-2 max-w-[17rem] text-[14px] leading-relaxed text-black/60">{st.desc}</p>
                    </div>
                    {i < flow.steps.length - 1 && <MarkerArrow />}
                  </li>
                ))}
              </ol>
            </div>
            {/* easel legs */}
            <div aria-hidden="true" className="relative mx-auto h-10 w-[60%]">
              <span className="absolute left-[12%] top-0 h-full w-[4px] origin-top rotate-[14deg] rounded-full" style={{ background: 'var(--v2-dark)' }} />
              <span className="absolute left-1/2 top-0 h-full w-[4px] -translate-x-1/2 rounded-full" style={{ background: 'var(--v2-dark)' }} />
              <span className="absolute right-[12%] top-0 h-full w-[4px] origin-top -rotate-[14deg] rounded-full" style={{ background: 'var(--v2-dark)' }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — flag ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={FlagDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — progress rings on deep forest ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto grid ${wrap} grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4`}>
          {stats.map((s, i) => (
            <Reveal key={s.label} className="flex flex-col items-center text-center">
              <Ring pct={RINGS[i % RINGS.length]} size={136} stroke={10} color={i % 2 ? SUN : MINT}>
                <span className="block whitespace-nowrap font-heading text-[clamp(1.35rem,2vw,1.6rem)] font-extrabold leading-none tracking-[-0.02em] text-white">
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </span>
              </Ring>
              <p className="mt-4 max-w-[15rem] text-[13px] leading-snug text-white/70">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════ TESTIMONIALS — breakthrough-journal pages ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Fewer messages," accent="more breakthroughs." lead="What career coaches, mentors and life coaches say." />
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {testimonials.map((t, i) => {
              const cut = t.quote.indexOf('. ');
              const lead = cut > 0 ? t.quote.slice(0, cut + 1) : t.quote;
              const rest = cut > 0 ? t.quote.slice(cut + 1) : '';
              return (
                <Reveal key={t.name} delay={i * 0.06} className="h-full">
                  <figure
                    className={`relative flex h-full flex-col rounded-[20px] border-2 bg-white py-6 pl-12 pr-6 ${['md:-rotate-1', 'md:rotate-1', 'md:-rotate-[0.5deg]'][i % 3]}`}
                    style={{ margin: 0, borderColor: BORDER, backgroundImage: `linear-gradient(90deg, transparent 34px, ${SUN} 34px 36px, transparent 36px), repeating-linear-gradient(180deg, transparent 0 27px, rgba(15,36,28,0.07) 27px 28px)` }}
                  >
                    {/* binder holes */}
                    <span aria-hidden="true" className="absolute left-3 top-0 flex h-full flex-col justify-around py-8">
                      {[0, 1, 2].map((h) => <span key={h} className="h-3.5 w-3.5 rounded-full" style={{ background: 'var(--v2-wash)', boxShadow: `inset 0 1px 2px ${BORDER}` }} />)}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-black/50">Session notes · week {[6, 4, 9][i % 3]}</span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(253,186,116,0.35)', color: MARKER }}><Sparkles size={11} /> Breakthrough</span>
                    </div>
                    <blockquote className="mt-4 flex-1 text-[15px] leading-[28px] text-black/75" style={{ margin: 0 }}>
                      <span style={{ backgroundImage: `linear-gradient(transparent 55%, ${HIGHLIGHT} 55%)` }}>{lead}</span>{rest}
                    </blockquote>
                    <figcaption className="mt-5 text-[14px]">
                      <span className="font-bold" style={{ color: 'var(--v2-ink)' }}>— {t.name}</span>
                      <span className="text-black/60">, {t.role}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — a coaching scorecard ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} dark />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {[
              { title: 'Without a booking link', tag: 'Stuck', list: beforeAfter.before, score: 1, good: false },
              { title: 'With Meeticulous', tag: 'Growing', list: beforeAfter.after, score: 5, good: true },
            ].map((card, c) => (
              <Reveal key={card.title} delay={c * 0.08} className={`rounded-[24px] p-6 sm:p-7 ${card.good ? 'bg-white' : 'border-2 border-white/10 bg-white/[0.04]'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`font-heading text-[17px] font-bold ${card.good ? '' : 'text-white/80'}`} style={{ margin: 0, color: card.good ? 'var(--v2-accent-ink)' : undefined }}>{card.title}</h3>
                  <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={card.good ? { background: 'var(--v2-accent-cta)', color: '#fff' } : { background: 'rgba(253,186,116,0.18)', color: SUN }}>{card.tag}</span>
                </div>
                <ul className="mt-5 space-y-4">
                  {card.list.map((line) => (
                    <li key={line} className="flex items-start justify-between gap-4">
                      <span className={`text-[14.5px] leading-relaxed ${card.good ? 'text-black/75' : 'text-white/65'}`}>{line}</span>
                      <span aria-hidden="true" className="mt-1.5 flex flex-shrink-0 gap-1">
                        {[0, 1, 2, 3, 4].map((d) => (
                          <span key={d} className="h-2.5 w-2.5 rounded-full" style={{ background: d < card.score ? (card.good ? 'var(--v2-accent)' : SUN) : card.good ? 'var(--v2-wash)' : 'rgba(255,255,255,0.12)' }} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className={`mt-6 flex items-center justify-between border-t-2 pt-4 ${card.good ? '' : 'border-white/10'}`} style={card.good ? { borderColor: BORDER } : undefined}>
                  <span className={`text-[13px] font-bold ${card.good ? 'text-black/60' : 'text-white/50'}`}>Score</span>
                  <span className="font-heading text-[22px] font-extrabold" style={{ color: card.good ? 'var(--v2-accent-ink)' : SUN }}>{card.score * card.list.length}/{5 * card.list.length}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={FlagDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={FlagDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — worksheet prompts ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><WorksheetFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — the summit at sunrise ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 pt-16 text-center sm:px-10" style={{ background: `linear-gradient(180deg, #FFF4E8 0%, #FFE2C4 45%, ${SUN} 100%)` }}>
          <div className="relative z-10">
            <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: 'var(--v2-ink)' }}>{finalCta.headline}</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-black/70">{finalCta.subline}</p>
            <Link to={routeStart} className={`mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </div>
          {/* sun, ridges and the planted flag */}
          <svg aria-hidden="true" viewBox="0 0 1000 220" preserveAspectRatio="none" className="relative mt-6 block h-[160px] w-[calc(100%+3rem)] -translate-x-6 sm:h-[200px] sm:w-[calc(100%+5rem)] sm:-translate-x-10">
            <circle cx="470" cy="115" r="70" fill="#FFF7ED" opacity="0.85" />
            <path d="M0 220 L0 150 L140 90 L260 150 L380 85 L470 125 L650 75 L760 150 L860 105 L1000 165 L1000 220 Z" fill="var(--v2-accent)" opacity="0.55" />
            <path d="M0 220 L0 185 L180 135 L330 190 L560 62 L760 185 L900 150 L1000 175 L1000 220 Z" fill="var(--v2-dark)" />
            <path d="M560 62 L560 8" stroke="var(--v2-dark)" strokeWidth="4" strokeLinecap="round" />
            <path d="M562 10 L604 22 L562 36 Z" fill={MARKER} />
          </svg>
        </div>
      </section>
    </>
  );
}
