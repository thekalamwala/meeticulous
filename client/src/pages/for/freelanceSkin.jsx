// freelanceSkin — the "desktop workspace" body for /for/freelancers.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'freelance'`, and swaps the
// hero's generic booking card for <BookingAppMock />. Every component is
// something on a freelancer's screen:
//   · hero: a booking app window — pick a call and a day, a "paid" toast pops
//   · services: a project board (three columns of ticket cards)
//   · steps: a terminal session — one command per step
//   · real impact: sticky notes taped to a dark desk
//   · testimonials: chat threads — the client's message, then "Booked ✓"
//   · with/without: an email thread (Re: Re: Re:) against a PAID invoice
//   · FAQ: a notes app — two columns of note files, one open at a time
//   · final CTA: a laptop — screen with bezel, keyboard deck below
// Integrations, pricing and about come from the shared v2Sections, wearing
// window-dot ornaments. No hover lift. Colours from --v2-* (brand maroon + rose on cream, matching
// the navbar's Freelancers tile).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Check, FileText, ChevronDown, Mail, CircleCheck } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(43,10,20,0.1)]';
const MINT = '#FF9FB0'; // --mt-pink: highlight on the dark maroon surfaces
const NOTE = '#FFF4C7'; // sticky-note paper
const BORDER = 'rgba(43,10,20,0.12)';
const BOARD = [
  { title: 'Get booked', from: 0, to: 3 },
  { title: 'Get paid', from: 3, to: 6 },
  { title: 'Stay organised', from: 6, to: 8 },
];
const COMMANDS = ['share --link portfolio', 'book --pay advance', 'work --focus'];

/* Window title-bar dots. */
function Dots({ tone = 'rgba(43,10,20,0.2)' }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: tone }} />)}
    </span>
  );
}

/* Card ornament for the shared sections: window dots in the top-right corner. */
function DotsDecor() {
  return <span className="pointer-events-none absolute right-5 top-5"><Dots /></span>;
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? MINT : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a booking app window ────────────────────────────────────────────── */
const DAYS = [{ d: 'Mon', n: 10, open: true }, { d: 'Tue', n: 11, open: false }, { d: 'Wed', n: 12, open: true }, { d: 'Thu', n: 13, open: true }, { d: 'Fri', n: 14, open: true }];

export function BookingAppMock({ mock }) {
  const svcs = mock?.services || [];
  const [svc, setSvc] = useState(0);
  const [day, setDay] = useState(2);
  if (!mock) return null;
  const s = svcs[svc];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[24px] border-2 bg-white" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3 border-b-2 px-4 py-3" style={{ borderColor: BORDER, background: 'var(--v2-wash)' }}>
          <Dots />
          <span className="flex-1 truncate rounded-full bg-white px-3 py-1 text-center text-[11px] font-semibold text-black/60">meeticulous.com/ananya</span>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full font-heading text-[13px] font-bold text-white" style={{ background: 'var(--v2-accent-cta)' }}>AR</span>
            <div>
              <div className="text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
              <div className="text-[12px] text-black/60">{mock.tag}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {svcs.map((x, i) => (
              <button
                key={x.name} type="button" onClick={() => setSvc(i)} aria-pressed={svc === i}
                className={`flex w-full items-center justify-between gap-3 rounded-[16px] border-2 px-4 py-3 text-left transition-colors ${FOCUS}`}
                style={svc === i ? { borderColor: 'var(--v2-accent)', background: 'var(--v2-wash)' } : { borderColor: BORDER }}
              >
                <span>
                  <span className="block text-[13px] font-bold text-[color:var(--v2-ink)]">{x.name}</span>
                  <span className="block text-[11px] text-black/60">{x.meta}</span>
                </span>
                <span className="text-[14px] font-extrabold text-[color:var(--v2-ink)]">{x.price}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {DAYS.map((x, i) => (
              <button
                key={x.d} type="button" disabled={!x.open} onClick={() => setDay(i)} aria-pressed={day === i}
                className={`flex flex-col items-center rounded-[14px] py-2 text-[10.5px] font-semibold transition-colors ${FOCUS} ${x.open ? '' : 'cursor-not-allowed line-through'}`}
                style={!x.open ? { color: 'rgba(43,10,20,0.45)', background: 'rgba(43,10,20,0.05)' }
                  : day === i ? { background: 'var(--v2-accent-cta)', color: '#fff' } : { background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}
              >
                {x.d}<span className="text-[15px] font-extrabold">{x.n}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
            Pay {s?.price} advance <ArrowRight size={14} />
          </div>
        </div>
      </div>
      {/* the "paid" toast */}
      <div className="absolute -bottom-5 -left-4 flex items-center gap-2.5 rounded-[16px] border-2 bg-white px-4 py-2.5" style={{ borderColor: BORDER }}>
        <CircleCheck size={18} style={{ color: 'var(--v2-accent)' }} />
        <span className="text-[12px] font-semibold text-[color:var(--v2-ink)]">Paid · reminder scheduled</span>
      </div>
    </div>
  );
}

/* ── FAQ: a notes app — two columns of note files, one open ────────────────── */
function NotesFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[18px] border-2 bg-white" style={{ borderColor: isOpen ? 'var(--v2-accent)' : BORDER }}>
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`fl-faq-${i}`} className={`flex w-full items-center gap-3 rounded-[16px] px-5 py-4 text-left ${FOCUS}`}>
            <FileText size={18} className="flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
            <ChevronDown size={18} className="flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
        </h3>
        <div id={`fl-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            {/* ruled note paper — one rule under every 26px text line (line-height and
                rule pitch must match; content-box keeps the rules out of the top padding) */}
            <p
              className="mx-5 mb-5 border-t-2 pb-1 pt-4 text-[14.5px] leading-[26px] text-black/70"
              style={{ borderColor: BORDER, backgroundImage: `repeating-linear-gradient(180deg, transparent 0 25px, ${BORDER} 25px 26px)`, backgroundOrigin: 'content-box', backgroundClip: 'content-box' }}
            >{f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

export default function FreelanceSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — a project board ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {BOARD.map((col) => (
              <Reveal key={col.title} className="rounded-[24px] p-3" style={{ background: 'var(--v2-wash)' }}>
                <div className="flex items-center justify-between px-3 pb-3 pt-2">
                  <h3 className="font-heading text-[15px] font-bold" style={{ margin: 0, color: 'var(--v2-ink)' }}>{col.title}</h3>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold" style={{ color: 'var(--v2-accent-ink)' }}>{col.to - col.from}</span>
                </div>
                <div className="space-y-2.5">
                  {whatYouGet.items.slice(col.from, col.to).map((it, k) => {
                    const i = col.from + k;
                    const Icon = icons.get[i % icons.get.length];
                    return (
                      <Link
                        key={it.title} to={routeStart} aria-label={`${it.title} — create your page`}
                        className={`block rounded-[18px] border-2 bg-white p-5 text-[color:var(--v2-ink)] transition-colors duration-200 hover:border-[color:var(--v2-accent)] hover:no-underline ${FOCUS}`}
                        style={{ borderColor: BORDER }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}><Icon size={17} /></span>
                          <span className="font-heading text-[15px] font-bold leading-snug">{it.title}</span>
                        </div>
                        <p className="mt-2.5 text-[13.5px] leading-relaxed text-black/60">{it.desc}</p>
                      </Link>
                    );
                  })}
                </div>
              </Reveal>
            ))}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap gap-2">
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-[8px] border-2 bg-white px-3 py-1 text-[12.5px] font-semibold text-black/70" style={{ borderColor: BORDER }}>#{a.toLowerCase().replace(/\s*&\s*|\s+/g, '-')}</span>
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

      {/* ════════ STEPS — a terminal session ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto grid ${wrap} items-center gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16`}>
          <SectionHead title={flow.title} lead="Set it up once. After that, every booking runs itself." />
          <Reveal className="overflow-hidden rounded-[24px]" style={{ background: 'var(--v2-dark)' }}>
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
              <Dots tone="rgba(255,255,255,0.25)" />
              <span className="text-[12px] font-semibold text-white/60">booking — zsh</span>
            </div>
            <div className="space-y-6 p-6 font-mono text-[13.5px] sm:p-8">
              {flow.steps.map((st, i) => (
                <div key={st.title}>
                  <div className="text-white"><span style={{ color: MINT }}>~ $</span> {COMMANDS[i] || 'run'}</div>
                  <div className="mt-1.5 flex items-start gap-2 pl-5 font-sans">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: MINT }} />
                    <span><span className="font-bold text-white">{st.title}.</span> <span className="text-white/70">{st.desc}</span></span>
                  </div>
                </div>
              ))}
              <div className="text-white"><span style={{ color: MINT }}>~ $</span> <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse motion-reduce:animate-none" style={{ background: MINT }} /></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — window-dot ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={DotsDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — sticky notes on a dark desk ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto grid ${wrap} grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4`}>
          {stats.map((s) => (
            <Reveal key={s.label} className="relative pt-3">
              <span aria-hidden="true" className="absolute left-1/2 top-0 z-10 h-5 w-16 -translate-x-1/2 rounded-[4px]" style={{ background: 'rgba(255,159,176,0.6)' }} />
              <div className="relative overflow-hidden rounded-[16px] p-6 pb-7" style={{ background: NOTE }}>
                <span aria-hidden="true" className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-[10px]" style={{ background: 'rgba(43,10,20,0.12)' }} />
                <div className="whitespace-nowrap font-heading text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold leading-none tracking-[-0.03em]" style={{ color: 'var(--v2-ink)' }}>
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <p className="mt-3 text-[13px] leading-snug text-black/70">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════ TESTIMONIALS — chat threads ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Booked, paid," accent="and back to work." lead="What designers, developers and writers say." oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="flex h-full flex-col rounded-[24px] border-2 bg-white p-5" style={{ margin: 0, borderColor: BORDER }}>
                  <figcaption className="flex items-center gap-3 border-b-2 pb-4" style={{ borderColor: BORDER }}>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-heading text-[12px] font-bold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>
                      {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-[color:var(--v2-ink)]">{t.name}</div>
                      <div className="truncate text-[12px] text-black/60">{t.role}</div>
                    </div>
                  </figcaption>
                  <div className="flex flex-1 flex-col gap-3 pt-4">
                    <blockquote className="max-w-[92%] rounded-[18px] rounded-tl-[6px] px-4 py-3 text-[14.5px] leading-relaxed text-black/75" style={{ margin: 0, background: 'var(--v2-wash)' }}>{t.quote}</blockquote>
                    <span className="mt-auto self-end rounded-[18px] rounded-br-[6px] px-4 py-2 text-[13px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>Booked & paid ✓</span>
                  </div>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — an email thread vs a paid invoice ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="overflow-hidden rounded-[24px] border-2 bg-white" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2 border-b-2 px-6 py-4" style={{ borderColor: BORDER }}>
                <Mail size={17} className="text-black/50" />
                <h3 className="font-heading text-[17px] font-bold text-black/70" style={{ margin: 0 }}>Without a booking link</h3>
              </div>
              <ul>
                {beforeAfter.before.map((b, i) => (
                  <li key={b} className={`flex items-start gap-3 px-6 py-4 text-[14.5px] leading-relaxed text-black/70 ${i ? 'border-t' : ''}`} style={{ borderColor: BORDER }}>
                    <span className="mt-0.5 flex-shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold text-black/60" style={{ background: 'rgba(43,10,20,0.07)' }}>{'Re: '.repeat(Math.min(i + 1, 3)).trim()}</span>
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="relative overflow-hidden rounded-[24px] border-2 bg-white" style={{ borderColor: 'var(--v2-accent)' }}>
              <div className="flex items-center justify-between border-b-2 px-6 py-4" style={{ borderColor: BORDER }}>
                <h3 className="font-heading text-[17px] font-bold" style={{ margin: 0, color: 'var(--v2-accent-ink)' }}>With Meeticulous</h3>
                <span className="rounded-[8px] border-2 px-2.5 py-0.5 text-[12px] font-extrabold" style={{ borderColor: 'var(--v2-accent)', color: 'var(--v2-accent-ink)' }}>Paid</span>
              </div>
              <ul className="px-6 py-2">
                {beforeAfter.after.map((a, i) => (
                  <li key={a} className={`flex items-start gap-3 py-3.5 text-[14.5px] leading-relaxed text-black/80 ${i ? 'border-t border-dashed' : ''}`} style={{ borderColor: BORDER }}>
                    <Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />{a}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={DotsDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={DotsDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — a notes app ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><NotesFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — a laptop ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-t-[32px] p-3 sm:p-4" style={{ background: '#2B0A14' }}>
            <div className="rounded-[22px] px-6 py-16 text-center sm:px-10" style={{ background: 'var(--v2-dark)' }}>
              <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{finalCta.subline}</p>
              <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold hover:no-underline ${FOCUS}`} style={{ background: MINT, color: 'var(--v2-dark)' }}>
                {finalCta.ctaText} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          {/* keyboard deck */}
          <div aria-hidden="true" className="relative mx-auto h-5 w-[108%] -translate-x-[3.7%] rounded-b-[24px]" style={{ background: '#3D0514' }}>
            <span className="absolute left-1/2 top-0 h-2 w-28 -translate-x-1/2 rounded-b-[10px]" style={{ background: '#2B0A14' }} />
          </div>
        </div>
      </section>
    </>
  );
}
