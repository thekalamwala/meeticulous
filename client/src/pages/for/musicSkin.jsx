// musicSkin — the "on stage" body for /for/musicians.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'music'`, and swaps the hero's
// generic booking card for <SetlistMock />. Every component is something from
// a musician's world:
//   · hero: tonight's setlist — pick a track (service), an equaliser plays
//   · services: a mixing desk — one channel strip per feature, with a fader
//   · steps: a bar of sheet music — three rising notes on a staff, 4/4
//   · real impact: LED level meters on a stage-lit band
//   · testimonials: record sleeves with the vinyl sliding out
//   · with/without: an out-of-tune score against a tuned one
//   · FAQ: a tracklist — two columns, one track playing at a time
//   · final CTA: a stage under a spotlight
// Integrations, pricing and about come from the shared v2Sections, wearing a
// small note ornament. No hover lift. Colours from --v2-* (stage violet), with
// lilac + fuchsia stage lights on the dark surfaces.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Check, X, Play, Music2, CircleCheck } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(28,20,51,0.1)]';
const LILAC = '#C4B5FD'; // stage light on the dark violet surfaces
const SPOT = '#F0ABFC'; // fuchsia stage light — peaks and highlights only
const BORDER = 'rgba(28,20,51,0.12)';
const STAFF = 'rgba(28,20,51,0.16)';
const FADERS = [82, 64, 74, 56, 88, 70, 60, 78]; // channel fader positions (%)
const LEVELS = [9, 10, 7, 8]; // lit LED segments per stat meter (of 10)
const SLEEVES = [
  'var(--v2-accent-cta)',
  'var(--v2-dark)',
  'linear-gradient(140deg, #A21CAF, var(--v2-accent-ink))',
];

// Equaliser, spinning vinyl, marquee ribbon, rising notes and the LED peak blink.
// Everything stops for prefers-reduced-motion.
const EQ_CSS = `
.mt-eq-bar{transform-origin:bottom;animation:mt-eq .9s ease-in-out infinite alternate}
@keyframes mt-eq{0%{transform:scaleY(.25)}100%{transform:scaleY(1)}}
.mt-spin{animation:mt-spin 6s linear infinite}
@keyframes mt-spin{to{transform:rotate(360deg)}}
.mt-marquee{animation:mt-marquee 32s linear infinite}
@keyframes mt-marquee{to{transform:translateX(-50%)}}
.mt-rise{animation:mt-rise 7s ease-in infinite;opacity:0}
@keyframes mt-rise{0%{transform:translateY(0) rotate(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-260px) rotate(18deg);opacity:0}}
.mt-peak{animation:mt-peak 1.2s steps(2,jump-none) infinite}
@keyframes mt-peak{50%{opacity:.25}}
@media (prefers-reduced-motion: reduce){.mt-eq-bar{animation:none;transform:scaleY(.7)}.mt-spin,.mt-marquee,.mt-peak{animation:none}.mt-rise{animation:none;opacity:.5}}
`;

/* Grooved vinyl with a light sheen, so the spin reads. */
function Vinyl({ label = LILAC, className = '', style }) {
  return (
    <span aria-hidden="true" className={`mt-spin rounded-full ${className}`} style={{ background: `conic-gradient(from 0deg, transparent 0 8%, rgba(255,255,255,0.14) 12%, transparent 18% 58%, rgba(255,255,255,0.1) 62%, transparent 68%), repeating-radial-gradient(circle, #120C24 0 2px, #241A42 2px 4px)`, ...style }}>
      <span className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `conic-gradient(${label} 0 75%, var(--v2-accent) 75% 100%)` }}>
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: '#120C24' }} />
      </span>
    </span>
  );
}

/* Deterministic waveform bar heights (%), drawn behind the stats band. */
const WAVE = Array.from({ length: 96 }, (_, i) => Math.round(18 + 70 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11))));
const NOTES = [{ c: '♪', l: '8%', d: 0 }, { c: '♫', l: '20%', d: 2.4 }, { c: '♪', l: '78%', d: 1.2 }, { c: '♬', l: '90%', d: 3.6 }, { c: '♩', l: '64%', d: 4.8 }];

/* A little equaliser — bars bounce while something is "playing". */
function EqBars({ color = LILAC, bars = 4, className = 'h-4' }) {
  return (
    <span aria-hidden="true" className={`inline-flex items-end gap-[3px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="mt-eq-bar h-full w-[3px] rounded-full" style={{ background: color, animationDelay: `${i * 0.17}s` }} />
      ))}
    </span>
  );
}

/* Card ornament for the shared sections: a note in the top-right corner. */
function NoteDecor() {
  return <Music2 aria-hidden="true" size={18} className="pointer-events-none absolute right-5 top-5" style={{ color: 'var(--v2-accent)', opacity: 0.35 }} />;
}

function SectionHead({ title, accent, lead, dark = false, center = false }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? LILAC : 'var(--v2-heading-accent)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: tonight's setlist ───────────────────────────────────────────────── */
export function SetlistMock({ mock }) {
  const svcs = mock?.services || [];
  const [active, setActive] = useState(0);
  if (!mock) return null;
  const s = svcs[active];
  const initials = mock.brand.split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <div className="relative mx-auto w-full max-w-md">
      <style>{EQ_CSS}</style>
      {/* the record spinning behind the setlist */}
      <Vinyl label={SPOT} className="absolute -right-16 -top-14 h-48 w-48" />
      <div className="relative z-10 overflow-hidden rounded-[24px] text-white shadow-[0_30px_70px_-30px_rgba(28,20,51,0.7)]" style={{ background: 'var(--v2-dark)' }}>
        {/* spotlight from above */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-44" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(196,181,253,0.3), transparent 72%)' }} />
        <div className="relative p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-bold" style={{ background: `linear-gradient(135deg, ${LILAC}, ${SPOT})`, color: 'var(--v2-dark)' }}>{initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{mock.brand}</div>
              <div className="truncate text-[12px] text-white/60">{mock.tag}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SPOT }} />LIVE
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between text-[11px] font-semibold text-white/50">
            <span>Tonight’s setlist</span><span>{svcs.length} tracks</span>
          </div>
          <ol className="mt-2 space-y-1.5">
            {svcs.map((x, i) => {
              const on = active === i;
              return (
                <li key={x.name}>
                  <button
                    type="button" onClick={() => setActive(i)} aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors ${FOCUS}`}
                    style={on ? { background: 'rgba(196,181,253,0.16)', boxShadow: `inset 0 0 0 1.5px ${LILAC}` } : { background: 'rgba(255,255,255,0.04)' }}
                  >
                    <span className="flex w-6 flex-shrink-0 justify-center font-mono text-[12px] text-white/50">
                      {on ? <EqBars className="h-3.5" /> : String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{x.name}</span>
                      <span className="block truncate text-[11px] text-white/55">{x.meta}</span>
                    </span>
                    <span className="whitespace-nowrap text-[14px] font-extrabold" style={{ color: on ? LILAC : '#fff' }}>{x.price}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* progress — the slot being "played" */}
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((active + 1) / Math.max(svcs.length, 1)) * 100}%`, background: `linear-gradient(90deg, var(--v2-accent), ${SPOT})` }} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-bold" style={{ background: LILAC, color: 'var(--v2-dark)' }}>
            Pay {s?.price} &amp; lock the slot <ArrowRight size={14} />
          </div>
        </div>
      </div>
      {/* the "locked" toast */}
      <div className="absolute -bottom-5 -right-4 z-20 flex items-center gap-2.5 rounded-[16px] border-2 bg-white px-4 py-2.5" style={{ borderColor: BORDER }}>
        <CircleCheck size={18} style={{ color: 'var(--v2-accent)' }} />
        <span className="text-[12px] font-semibold text-[color:var(--v2-ink)]">Slot locked · reminder sent</span>
      </div>
    </div>
  );
}

/* ── FAQ: a tracklist — two columns, one track playing ─────────────────────── */
function TracklistFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="rounded-[18px] transition-colors" style={{ background: isOpen ? 'var(--v2-wash)' : 'transparent' }}>
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`mu-faq-${i}`} className={`flex w-full items-center gap-4 rounded-[18px] px-4 py-4 text-left ${FOCUS}`}>
            <span className="w-6 flex-shrink-0 font-mono text-[13px] font-semibold" style={{ color: isOpen ? 'var(--v2-accent-ink)' : 'rgba(0,0,0,0.4)' }}>{String(i + 1).padStart(2, '0')}</span>
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={isOpen ? { background: 'var(--v2-accent-cta)' } : { border: `2px solid ${BORDER}`, color: 'var(--v2-accent-ink)' }}>
              {isOpen ? <EqBars color="#fff" bars={3} className="h-3" /> : <Play size={13} className="translate-x-[1px] fill-current" />}
            </span>
          </button>
        </h3>
        <div id={`mu-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="pb-5 pl-14 pr-5 text-[14.5px] leading-relaxed text-black/70">{f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="divide-y rounded-[32px] border-2 bg-white p-3 sm:p-5" style={{ borderColor: BORDER }}>
      {items.map((f, i) => <div key={f.q} className="py-1" style={{ borderColor: BORDER }}>{renderItem(f, i)}</div>)}
    </div>
  );
}

export default function MusicSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      <style>{EQ_CSS}</style>

      {/* ════════ SERVICES — a mixing desk (opens with a scrolling marquee ribbon) ════════ */}
      <section className="overflow-hidden pb-20 pt-6 lg:pb-28">
        <div aria-hidden="true" className="-mx-4 -rotate-[1.5deg] py-3" style={{ background: 'var(--v2-accent-cta)' }}>
          <div className="mt-marquee flex w-max">
            {[0, 1].map((dup) => (
              <span key={dup} className="flex shrink-0 items-center">
                {[...(data.hero.audiences || []), ...(whatYouGet.addons || [])].map((a) => (
                  <span key={a} className="flex items-center gap-6 whitespace-nowrap px-6 font-heading text-[15px] font-extrabold uppercase tracking-[0.06em] text-white">
                    {a}<span style={{ color: SPOT }}>♪</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 sm:px-8"><div className={`mx-auto mt-16 lg:mt-20 ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <Reveal className="mt-12 rounded-[32px] p-3 sm:p-4" style={{ background: 'var(--v2-dark)' }}>
            <div className="flex items-center justify-between px-3 pb-3 pt-1 sm:px-4">
              <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-white/50">BOOKING DESK · {whatYouGet.items.length} CH</span>
              <span aria-hidden="true" className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SPOT }} />
                <span className="h-2 w-2 rounded-full" style={{ background: LILAC }} />
                <span className="h-2 w-2 rounded-full bg-white/20" />
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {whatYouGet.items.map((it, i) => {
                const Icon = icons.get[i % icons.get.length];
                const level = FADERS[i % FADERS.length];
                return (
                  <Link
                    key={it.title} to={routeStart} aria-label={`${it.title} — create your page`}
                    className={`flex flex-col rounded-[20px] border border-white/10 bg-white/[0.04] p-5 text-white transition-colors duration-200 hover:bg-white/[0.09] hover:no-underline ${FOCUS}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold" style={{ color: LILAC }}>CH {String(i + 1).padStart(2, '0')}</span>
                      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: i % 3 === 0 ? SPOT : LILAC, boxShadow: `0 0 8px ${i % 3 === 0 ? SPOT : LILAC}` }} />
                    </div>
                    <span className="mt-4 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(196,181,253,0.15)', color: LILAC }}><Icon size={18} /></span>
                    <h3 className="mt-4 font-heading text-[15px] font-bold leading-snug text-white" style={{ margin: 0 }}>{it.title}</h3>
                    <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/65">{it.desc}</p>
                    {/* the channel fader */}
                    <div aria-hidden="true" className="relative mt-5 h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${level}%`, background: `linear-gradient(90deg, var(--v2-accent), ${LILAC})` }} />
                      <span className="absolute top-1/2 h-4 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${level}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
            {whatYouGet.addons && (
              <div className="mt-3 flex flex-wrap items-center gap-2 px-3 pb-2 pt-2 sm:px-4">
                <span className="font-mono text-[11px] font-semibold tracking-[0.12em] text-white/50">FX</span>
                {whatYouGet.addons.map((a) => (
                  <span key={a} className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] font-semibold text-white/80">{a}</span>
                ))}
              </div>
            )}
          </Reveal>
          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to={routeStart} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
              Create your page <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div></div>
      </section>

      {/* ════════ STEPS — a bar of sheet music ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} lead="Set your availability once. Every booking after that plays itself." />
          <Reveal className="mt-12 rounded-[24px] bg-white px-6 pb-8 pt-4 sm:px-10" style={{ boxShadow: `inset 0 0 0 2px ${BORDER}` }}>
            <ol className="grid sm:grid-cols-3 lg:grid-cols-[72px_1fr_1fr_1fr]">
              {/* time signature */}
              <li aria-hidden="true" className="relative hidden h-[130px] lg:block">
                <Staff />
                <span className="absolute left-3 top-[30px] flex flex-col font-heading text-[30px] font-extrabold leading-[44px]" style={{ color: 'var(--v2-ink)' }}><span>4</span><span>4</span></span>
              </li>
              {flow.steps.map((st, i) => {
                const y = [96, 74, 52][i] ?? 74; // rising notes, one staff step each
                const last = i === flow.steps.length - 1;
                return (
                  <li key={st.title} className="pb-6 sm:pb-0 [&>h3]:sm:pr-8 [&>p]:sm:pr-8">
                    <div className="relative h-[130px]">
                      <Staff />
                      {/* note head + stem */}
                      <span aria-hidden="true" className="absolute w-[3px] rounded-full" style={{ left: 49, top: y - 52, height: 52, background: 'var(--v2-accent)' }} />
                      <span className="absolute flex h-6 w-[30px] -rotate-[18deg] items-center justify-center rounded-full font-heading text-[12px] font-extrabold text-white" style={{ left: 22, top: y - 12, background: 'var(--v2-accent-cta)' }}>
                        <span className="rotate-[18deg]">{i + 1}</span>
                      </span>
                      {last && (
                        <span aria-hidden="true" className="absolute right-0 hidden gap-[3px] sm:flex" style={{ top: 30, height: 90 }}>
                          <span className="h-full w-[2px]" style={{ background: 'var(--v2-ink)' }} />
                          <span className="h-full w-[6px]" style={{ background: 'var(--v2-ink)' }} />
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-heading text-[17px] font-bold" style={{ margin: 0, color: 'var(--v2-ink)' }}>{st.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-black/60">{st.desc}</p>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — note ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={NoteDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — LED level meters under stage light ════════ */}
      <section className="relative overflow-hidden px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'linear-gradient(160deg, var(--v2-dark) 0%, color-mix(in srgb, var(--v2-accent) 30%, var(--v2-dark)) 100%)' }}>
        {/* waveform across the band */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 flex h-28 -translate-y-1/2 items-center gap-[3px] opacity-[0.12]">
          {WAVE.map((h, i) => <span key={i} className="flex-1 rounded-full" style={{ height: `${h}%`, background: i % 7 === 0 ? SPOT : LILAC }} />)}
        </div>
        <div className={`relative mx-auto grid ${wrap} grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4`}>
          {stats.map((s, i) => {
            const lit = LEVELS[i % LEVELS.length];
            return (
              <Reveal key={s.label} className="flex items-end gap-5">
                <span aria-hidden="true" className="flex flex-col-reverse gap-1">
                  {Array.from({ length: 10 }).map((_, k) => (
                    <span
                      key={k} className={`h-2 w-4 rounded-[3px] ${k === lit - 1 ? 'mt-peak' : ''}`}
                      style={{ background: k >= lit ? 'rgba(255,255,255,0.1)' : k >= 8 ? SPOT : k >= 5 ? LILAC : 'var(--v2-accent)' }}
                    />
                  ))}
                </span>
                <div className="min-w-0">
                  <div className="whitespace-nowrap font-heading text-[clamp(2rem,3.4vw,2.8rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                    <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                  </div>
                  <p className="mt-2.5 text-[13px] leading-snug text-white/70">{s.label}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ════════ TESTIMONIALS — record sleeves ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Booked, paid," accent="and back to rehearsal." lead="What teachers, coaches and players say." />
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="relative h-full pr-10" style={{ margin: 0 }}>
                  {/* the vinyl, sliding out of the sleeve */}
                  <span aria-hidden="true" className="absolute right-0 top-1/2 aspect-square w-[82%] -translate-y-1/2">
                    <Vinyl label={i === 1 ? SPOT : LILAC} className="absolute inset-0" style={{ animationDuration: `${7 + i * 1.5}s` }} />
                  </span>
                  <div className="relative z-10 flex h-full min-h-[300px] flex-col justify-between rounded-[20px] p-6 text-white shadow-[0_24px_50px_-28px_rgba(28,20,51,0.8)]" style={{ background: SLEEVES[i % SLEEVES.length] }}>
                    <blockquote style={{ margin: 0 }}>
                      <span aria-hidden="true" className="block font-heading text-[44px] font-extrabold leading-none" style={{ color: i === 1 ? SPOT : LILAC }}>“</span>
                      <p className="mt-1 text-[15px] leading-relaxed text-white/90">{t.quote}</p>
                    </blockquote>
                    <figcaption className="mt-6 border-t border-white/20 pt-4">
                      <div className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-white/60">SIDE {String.fromCharCode(65 + i)}</div>
                      <div className="mt-1 text-[14px] font-bold">{t.name}</div>
                      <div className="text-[12.5px] text-white/70">{t.role}</div>
                    </figcaption>
                  </div>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — out of tune vs in tune ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal className="rounded-[24px] border-2 bg-white p-6 sm:p-7 md:-rotate-1" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-[17px] font-bold text-black/70" style={{ margin: 0 }}>Without a booking link</h3>
                <span className="rounded-full px-3 py-1 text-[12px] font-bold text-black/60" style={{ background: 'rgba(28,20,51,0.07)' }}>Out of tune ♭</span>
              </div>
              <ul className="mt-4">
                {beforeAfter.before.map((b, i) => (
                  <li key={b} className="flex items-start gap-4 border-t py-4 text-[14.5px] leading-relaxed text-black/65" style={{ borderColor: STAFF }}>
                    <span className="mt-1 flex h-[18px] w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-black/30" style={{ transform: `rotate(-18deg) translateY(${i % 2 ? 4 : -3}px)` }}>
                      <X size={10} className="rotate-[18deg] text-black/45" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="rounded-[24px] border-2 bg-white p-6 sm:p-7" style={{ borderColor: 'var(--v2-accent)' }}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-[17px] font-bold" style={{ margin: 0, color: 'var(--v2-accent-ink)' }}>With Meeticulous</h3>
                <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: 'var(--v2-accent-cta)' }}>In tune ♮</span>
              </div>
              <ul className="mt-4">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-4 border-t py-4 text-[14.5px] leading-relaxed text-black/80" style={{ borderColor: STAFF }}>
                    <span className="mt-1 flex h-[18px] w-6 flex-shrink-0 -rotate-[18deg] items-center justify-center rounded-full" style={{ background: 'var(--v2-accent-cta)' }}>
                      <Check size={11} className="rotate-[18deg] text-white" strokeWidth={3} />
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={NoteDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={NoteDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — a tracklist ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><TracklistFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — a stage under a spotlight ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 pb-20 pt-20 text-center sm:px-10" style={{ background: 'var(--v2-dark)' }}>
          {/* side lights + the main spot */}
          <span aria-hidden="true" className="pointer-events-none absolute -left-10 top-0 h-full w-1/2" style={{ background: `linear-gradient(200deg, ${SPOT}33, transparent 60%)`, clipPath: 'polygon(0 0, 18% 0, 100% 100%, 40% 100%)' }} />
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 top-0 h-full w-1/2" style={{ background: `linear-gradient(160deg, ${SPOT}33, transparent 60%)`, clipPath: 'polygon(82% 0, 100% 0, 60% 100%, 0 100%)' }} />
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-full w-[75%] -translate-x-1/2" style={{ background: 'linear-gradient(180deg, rgba(196,181,253,0.38), rgba(196,181,253,0) 88%)', clipPath: 'polygon(43% 0, 57% 0, 100% 100%, 0 100%)' }} />
          <span aria-hidden="true" className="absolute left-1/2 top-0 h-3 w-20 -translate-x-1/2 rounded-b-[10px]" style={{ background: LILAC }} />
          {/* stage floor */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 100%, color-mix(in srgb, var(--v2-accent) 60%, transparent), transparent 75%)' }} />
          {/* notes drifting up off the stage */}
          {NOTES.map((n) => (
            <span key={n.l} aria-hidden="true" className="mt-rise pointer-events-none absolute bottom-6 font-heading text-[28px] font-extrabold" style={{ left: n.l, color: n.c === '♫' || n.c === '♬' ? SPOT : LILAC, animationDelay: `${n.d}s` }}>{n.c}</span>
          ))}
          <div className="relative">
            <EqBars color={SPOT} bars={5} className="h-6" />
            <h2 className="mx-auto mt-5 max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">{finalCta.subline}</p>
            <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold hover:no-underline ${FOCUS}`} style={{ background: LILAC, color: 'var(--v2-dark)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* Five staff lines inside a 130px-tall note area (lines at 30–118px). */
function Staff() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0"
      style={{ top: 30, height: 90, backgroundImage: `repeating-linear-gradient(180deg, ${STAFF} 0 2px, transparent 2px 22px)` }}
    />
  );
}
