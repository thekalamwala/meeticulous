// languageSkin — the "passport & phrasebook" body for /for/language-teachers.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'language'`, and swaps the
// hero's generic booking card for <PhrasebookMock />. Every component borrows
// from travel and phrasebooks:
//   · hero: a phrasebook — switch language, the greeting changes; pick a lesson
//   · services: flashcards — a stacked second card peeking from behind
//   · steps: passport stamps (double-ring circles)
//   · real impact: one boarding pass, a perforated field per figure
//   · testimonials: postcards — message left, stamp box + address lines right
//   · with/without: two visa pages — "Not approved" vs "Approved" stamps
//   · FAQ: a phrasebook with bookmark ribbons on the open entry
//   · final CTA: a passport cover with a gold foil emblem
// Integrations, pricing and about come from the shared v2Sections, wearing a
// small stamp-ring ornament. No hover lift.
//
// Colour roles (all text pairs ≥ 4.5:1): passport green (--v2-dark / CTA) for
// dark bands and buttons; terracotta for stamps and icons, its darker
// --v2-accent-ink for accent text; peach (--v2-wash) for paper bands; gold only
// as foil on the green.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Check, X, Globe2, Link2, CreditCard, Languages, Plane } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(30,42,36,0.1)]';
const BORDER = 'rgba(30,42,36,0.12)';
const TERRA = '#B4532A'; // stamps + icons (4.99:1 on white)
const GOLD = '#E9C46A'; // foil — only on the passport green
const PEACH = '#F4B184'; // light accent on the dark green
const STEP_ICONS = [Link2, CreditCard, Languages];

/* A passport stamp: two terracotta rings with content inside. */
function Stamp({ size = 'h-28 w-28', children }) {
  return (
    <span className={`relative flex ${size} flex-shrink-0 items-center justify-center rounded-full border-[3px]`} style={{ borderColor: TERRA }}>
      <span aria-hidden="true" className="absolute inset-[5px] rounded-full border border-dashed" style={{ borderColor: TERRA }} />
      <span className="relative flex flex-col items-center" style={{ color: 'var(--v2-accent-ink)' }}>{children}</span>
    </span>
  );
}

/* Card ornament for the shared sections: a small stamp ring. */
function StampDecor() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-6 w-6 rounded-full border-2" style={{ borderColor: TERRA, opacity: 0.55 }}>
      <span className="absolute inset-[3px] rounded-full border border-dashed" style={{ borderColor: TERRA }} />
    </span>
  );
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? PEACH : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a phrasebook — pick a language, then a lesson ───────────────────── */
const GREETINGS = [
  { lang: 'French', hello: 'Bonjour', say: 'bon-zhoor' },
  { lang: 'German', hello: 'Guten Tag', say: 'goo-ten tahk' },
  { lang: 'Japanese', hello: 'こんにちは', say: 'kon-nee-chee-wah' },
  { lang: 'English', hello: 'Hello', say: 'heh-low' },
];

export function PhrasebookMock({ mock }) {
  const [g, setG] = useState(0);
  const [svc, setSvc] = useState(0);
  if (!mock) return null;
  const s = mock.services[svc];

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border-2 bg-white" style={{ borderColor: BORDER }}>
      {/* passport strip */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--v2-dark)' }}>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold text-white">{mock.brand}</div>
          <div className="truncate text-[11.5px] text-white/70">{mock.tag}</div>
        </div>
        <Globe2 size={22} style={{ color: GOLD }} />
      </div>
      <div className="p-5">
        <div role="tablist" aria-label="Language" className="flex flex-wrap gap-1.5">
          {GREETINGS.map((x, i) => (
            <button
              key={x.lang} type="button" role="tab" aria-selected={g === i} onClick={() => setG(i)}
              className={`rounded-full border-2 px-3 py-1 text-[12px] font-semibold transition-colors ${FOCUS}`}
              style={g === i ? { background: TERRA, borderColor: TERRA, color: '#fff' } : { borderColor: BORDER, color: 'var(--v2-ink)' }}
            >
              {x.lang}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-[18px] px-5 py-4" style={{ background: 'var(--v2-wash)' }}>
          <div className="font-heading text-[30px] font-extrabold leading-none" style={{ color: 'var(--v2-ink)' }} lang={['fr', 'de', 'ja', 'en'][g]}>{GREETINGS[g].hello}</div>
          <div className="mt-1.5 text-[12px] italic text-black/60">/{GREETINGS[g].say}/ · your first lesson starts here</div>
        </div>
        <div className="mt-3 space-y-1.5">
          {mock.services.map((x, i) => (
            <button
              key={x.name} type="button" onClick={() => setSvc(i)} aria-pressed={svc === i}
              className={`flex w-full items-center justify-between gap-3 rounded-[14px] border-2 px-3.5 py-2.5 text-left transition-colors ${FOCUS}`}
              style={svc === i ? { borderColor: TERRA, background: '#fff' } : { borderColor: 'transparent', background: '#fff' }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-[color:var(--v2-ink)]">{x.name}</span>
                <span className="block truncate text-[11px] text-black/60">{x.meta}</span>
              </span>
              <span className="text-[14px] font-extrabold text-[color:var(--v2-ink)]">{x.price}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
          Book {s.name.split(' — ')[0].toLowerCase()} · {s.price} <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}

/* ── FAQ: a phrasebook — the open entry gets a bookmark ribbon ─────────────── */
function PhrasebookFaq({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="relative rounded-[18px] border-2 bg-white" style={{ borderColor: isOpen ? TERRA : BORDER }}>
        <span aria-hidden="true" className="absolute right-6 top-0 h-7 w-4 transition-transform duration-200" style={{ background: TERRA, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', transform: isOpen ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'top' }} />
        <h3 style={{ margin: 0 }}>
          <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`lt-faq-${i}`} className={`w-full rounded-[16px] py-4 pl-5 pr-14 text-left ${FOCUS}`}>
            <span className="font-heading text-[15.5px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
          </button>
        </h3>
        <div id={`lt-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-black/70"><span className="font-semibold" style={{ color: 'var(--v2-accent-ink)' }}>—</span> {f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

export default function LanguageSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — flashcards ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = icons.get[i % icons.get.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="relative h-full pb-2.5 pr-2.5">
                  {/* the card behind */}
                  <span aria-hidden="true" className="absolute bottom-0 left-2.5 right-0 top-2.5 rounded-[22px]" style={{ background: i % 2 ? 'var(--v2-dark)' : TERRA }} />
                  <Link
                    to={routeStart} aria-label={`${it.title} — create your page`}
                    className={`relative block h-full rounded-[22px] border-2 bg-white p-6 text-[color:var(--v2-ink)] transition-colors duration-200 hover:bg-[color:var(--v2-wash)] hover:no-underline ${FOCUS}`}
                    style={{ borderColor: BORDER }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--v2-wash)', color: TERRA }}><Icon size={18} /></span>
                      <span className="font-heading text-[15.5px] font-bold leading-snug">{it.title}</span>
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
                <span key={a} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>{a}</span>
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

      {/* ════════ STEPS — passport stamps ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} lead="Three stamps and your learner is in class." center />
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {flow.steps.map((st, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <Reveal key={st.title} delay={i * 0.07} className="flex flex-col items-center text-center">
                  <Stamp>
                    <Icon size={26} />
                    <span className="mt-1.5 text-[11px] font-bold">{['Shared', 'Paid', 'In class'][i] || 'Done'}</span>
                  </Stamp>
                  <h3 className="font-heading text-[18px] font-bold" style={{ margin: '20px 0 0', color: 'var(--v2-ink)' }}>{st.title}</h3>
                  <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-black/65">{st.desc}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — stamp-ring ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={StampDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — one boarding pass ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <Reveal className="relative overflow-hidden rounded-[28px] bg-white">
            <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8" style={{ background: TERRA }}>
              <span className="flex items-center gap-2 text-[14px] font-bold text-white"><Plane size={17} /> Lessons · one way to booked</span>
              <span className="hidden text-[13px] font-semibold text-white sm:inline">Seat: yours</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s, i) => (
                <div key={s.label} className={`px-6 py-7 sm:px-8 ${i ? 'border-t-2 border-dashed sm:border-t-0' : ''} ${i % 2 ? 'sm:border-l-2 sm:border-dashed' : ''} ${i >= 2 ? 'sm:border-t-2 sm:border-dashed lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l-2 lg:border-dashed' : ''}`} style={{ borderColor: BORDER }}>
                  <div className="whitespace-nowrap font-heading text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold leading-none tracking-[-0.03em]" style={{ color: 'var(--v2-ink)' }}>
                    <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                  </div>
                  <p className="mt-3 text-[13px] leading-snug text-black/65">{s.label}</p>
                </div>
              ))}
            </div>
            {/* the tear-off notches */}
            <span aria-hidden="true" className="absolute -left-4 top-1/2 h-8 w-8 rounded-full" style={{ background: 'var(--v2-dark)' }} />
            <span aria-hidden="true" className="absolute -right-4 top-1/2 h-8 w-8 rounded-full" style={{ background: 'var(--v2-dark)' }} />
          </Reveal>
        </div>
      </section>

      {/* ════════ TESTIMONIALS — postcards ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Postcards from" accent="busy tutors." lead="What language teachers say." oneLine />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="relative flex h-full flex-col rounded-[22px] border-2 bg-white p-6" style={{ margin: 0, borderColor: BORDER }}>
                  <span aria-hidden="true" className="absolute right-5 top-5 flex h-12 w-10 items-center justify-center rounded-[6px] border-2 border-dashed" style={{ borderColor: TERRA, color: TERRA }}><Globe2 size={18} /></span>
                  <blockquote className="flex-1 pr-14 text-[15px] leading-relaxed text-black/75" style={{ margin: 0 }}>“{t.quote}”</blockquote>
                  {/* address lines */}
                  <figcaption className="mt-6 border-t-2 border-dashed pt-4" style={{ borderColor: BORDER }}>
                    <div className="border-b pb-1.5 text-[14px] font-bold text-[color:var(--v2-ink)]" style={{ borderColor: BORDER }}>{t.name}</div>
                    <div className="border-b pb-1.5 pt-2 text-[12.5px] text-black/65" style={{ borderColor: BORDER }}>{t.role}</div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — two visa pages ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="relative rounded-[24px] bg-white p-8 pr-28">
              <div className="absolute right-6 top-6"><Stamp size="h-20 w-20"><X size={18} /><span className="mt-0.5 text-[10px] font-bold">Not approved</span></Stamp></div>
              <h3 className="font-heading text-[18px] font-bold text-black/65" style={{ margin: 0 }}>Without a booking link</h3>
              <ul className="mt-6 space-y-3.5">
                {beforeAfter.before.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-black/65"><X size={17} className="mt-0.5 flex-shrink-0" style={{ color: TERRA }} />{b}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="relative rounded-[24px] p-8 pr-28" style={{ background: 'var(--v2-dark)' }}>
              <span className="absolute right-6 top-6 flex h-20 w-20 flex-col items-center justify-center rounded-full border-[3px]" style={{ borderColor: GOLD, color: GOLD }}>
                <span aria-hidden="true" className="absolute inset-[5px] rounded-full border border-dashed" style={{ borderColor: GOLD }} />
                <Check size={18} /><span className="mt-0.5 text-[10px] font-bold">Approved</span>
              </span>
              <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: PEACH }}>With Meeticulous</h3>
              <ul className="mt-6 space-y-3.5">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-white/85"><Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{a}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING ════════ */}
      <V2Pricing routeStart={routeStart} Decor={StampDecor} cardClass={CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={StampDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — a phrasebook ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><PhrasebookFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — a passport cover ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px] p-3`} style={{ background: 'var(--v2-dark)' }}>
          <div className="rounded-[24px] border-2 px-6 py-16 text-center sm:px-10" style={{ borderColor: 'rgba(233,196,106,0.5)' }}>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ borderColor: GOLD, color: GOLD }}><Globe2 size={30} /></span>
            <h2 className="mx-auto mt-6 max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{finalCta.subline}</p>
            <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold hover:no-underline ${FOCUS}`} style={{ background: GOLD, color: 'var(--v2-dark)' }}>
              {finalCta.ctaText} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
