// creatorSkin — the "creator feed" body for /for/content-creators.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'creator'`, and swaps the hero's
// generic booking card for <CreatorProfileMock />. Every component borrows from
// a creator's phone. Every section uses the same full content width (`wrap`),
// FAQ and pricing included:
//   · hero: a phone profile — handle, bio, link-in-bio buttons that book a call
//   · services: a content grid of post tiles
//   · steps: stories — segmented progress bars over three story cards
//   · real impact: an insights panel — a mini bar chart under each figure
//   · testimonials: comments under a post (pinned, heart + reply row)
//   · with/without: two phone screens — a DM inbox vs a bookings list
//   · FAQ: a minimal list — hairline dividers, one question open at a time
//   · final CTA: a dark panel with one crimson button
// Integrations, pricing and about come from the shared v2Sections, wearing a
// small red "live" dot. No hover lift.
//
// Colour roles (all text pairs ≥ 4.5:1): deep ink for text, dark bands and the
// phone frame; violet (--v2-accent-cta / --v2-accent-ink) for buttons, accent
// text and icons; the brand primary maroon (RED) for fills with white text and
// accents on light surfaces, and a brighter crimson of the same red (RED_BRIGHT)
// for accents on the dark ink — never used as text on ink; lavender bands.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import { ArrowRight, Plus, Heart, MessageCircle, Send, Check, Pin, BadgeCheck, Link2, CreditCard, Video, Inbox, CalendarCheck } from 'lucide-react';
import ForFaqIntro from '../../components/common/ForFaqIntro';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const CARD = 'rounded-[24px] border-2 border-[rgba(23,17,31,0.1)]';
const BORDER = 'rgba(23,17,31,0.12)';
const RED = '#960D32'; // brand primary maroon (--mt-maroon): light surfaces; white on it 8.75:1
const RED_BRIGHT = '#D7263D'; // crimson of the same red, for the dark ink: shapes 3.7:1, white text on it 4.96:1
const LILAC = '#C4B5FD'; // light accent on the ink background
const STEP_ICONS = [Link2, CreditCard, Video];
const TILE_STYLES = [
  { bg: 'var(--v2-dark)', fg: '#fff', sub: 'rgba(255,255,255,0.72)', icon: LILAC },
  { bg: 'var(--v2-wash)', fg: 'var(--v2-ink)', sub: 'rgba(0,0,0,0.65)', icon: 'var(--v2-accent-ink)' },
  { bg: RED, fg: '#fff', sub: 'rgba(255,255,255,0.88)', icon: '#fff' }, // white on maroon (8.75:1)
  { bg: '#fff', fg: 'var(--v2-ink)', sub: 'rgba(0,0,0,0.65)', icon: 'var(--v2-accent-ink)' },
];
const SPARK = [[3, 5, 4, 7, 6, 9, 8], [2, 2, 3, 2, 3, 3, 3], [8, 6, 5, 4, 3, 2, 1], [4, 5, 5, 6, 7, 7, 9]];

/* Small red "live" dot — the card ornament for the shared sections. */
function LiveDecor() {
  return <span aria-hidden="true" className="pointer-events-none absolute right-5 top-5 h-2.5 w-2.5 rounded-full" style={{ background: RED, boxShadow: `0 0 0 4px rgba(150,13,50,0.16)` }} />;
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? LILAC : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 max-w-2xl text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} ${dark ? 'text-white/70' : 'text-black/60'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a phone profile with link-in-bio buttons ────────────────────────── */
export function CreatorProfileMock({ mock }) {
  const [svc, setSvc] = useState(0);
  if (!mock) return null;
  const s = mock.services[svc];
  const handle = '@' + mock.brand.toLowerCase().split(' ').slice(0, 2).join('');

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[44px] border-[10px] bg-white p-5 pt-6" style={{ borderColor: 'var(--v2-dark)' }}>
      <span aria-hidden="true" className="mx-auto -mt-2 mb-4 block h-1.5 w-20 rounded-full" style={{ background: 'rgba(23,17,31,0.15)' }} />
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-[3px] p-0.5" style={{ borderColor: RED }}>
          <span className="flex h-full w-full items-center justify-center rounded-full font-heading text-[18px] font-extrabold text-white" style={{ background: 'var(--v2-accent-cta)' }}>RS</span>
        </span>
        <div className="grid flex-1 grid-cols-3 text-center">
          {[['248', 'posts'], ['86k', 'followers'], ['1:1', 'calls']].map(([n, l]) => (
            <div key={l}><div className="text-[15px] font-extrabold text-[color:var(--v2-ink)]">{n}</div><div className="text-[10.5px] text-black/60">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[14px] font-bold text-[color:var(--v2-ink)]">{mock.brand} <BadgeCheck size={15} style={{ color: 'var(--v2-accent-ink)' }} /></div>
      <div className="text-[12px] text-black/60">{handle} · {mock.tag}</div>

      <div className="mt-4 text-[11px] font-semibold text-black/60">Link in bio</div>
      <div className="mt-1.5 space-y-1.5">
        {mock.services.map((x, i) => (
          <button
            key={x.name} type="button" onClick={() => setSvc(i)} aria-pressed={svc === i}
            className={`flex w-full items-center justify-between gap-2 rounded-full border-2 px-4 py-2 text-left text-[12.5px] font-semibold transition-colors ${FOCUS}`}
            style={svc === i ? { background: 'var(--v2-dark)', borderColor: 'var(--v2-dark)', color: '#fff' } : { borderColor: BORDER, color: 'var(--v2-ink)' }}
          >
            <span className="truncate">{x.name}</span><span className="flex-shrink-0">{x.price}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-full py-3 text-[13px] font-bold text-white" style={{ background: RED }}>
        Book · {s.meta.split('·')[0].trim()} · {s.price} <ArrowRight size={14} />
      </div>
    </div>
  );
}

/* ── FAQ: a minimal list — hairline dividers, one question open at a time ── */
function MinimalFaq({ items }) {
  const [open, setOpen] = useState(-1);
  return (
    <div className="border-t" style={{ borderColor: BORDER }}>
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="border-b" style={{ borderColor: BORDER }}>
            <h3 style={{ margin: 0 }}>
              <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`cc-faq-${i}`} className={`flex w-full items-center gap-4 rounded-[12px] py-5 text-left ${FOCUS}`}>
                <span className="flex-1 text-[16px] font-medium leading-snug" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
                <Plus size={18} strokeWidth={1.75} className="flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(45deg)' : 'none' }} />
              </button>
            </h3>
            <div id={`cc-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
              <div className="overflow-hidden">
                <p className="pb-5 pr-10 text-[15px] leading-relaxed text-black/65">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* A phone screen frame for the with/without section. */
function Screen({ title, icon: Icon, dark = false, children }) {
  return (
    <div className="mx-auto w-full max-w-[420px] rounded-[40px] border-[10px] p-5" style={{ borderColor: 'var(--v2-dark)', background: dark ? 'var(--v2-dark)' : '#fff' }}>
      <div className="flex items-center gap-2 pb-3">
        <Icon size={18} style={{ color: dark ? LILAC : 'rgba(0,0,0,0.6)' }} />
        <h3 className="font-heading text-[17px] font-bold" style={{ margin: 0, color: dark ? '#fff' : 'rgba(0,0,0,0.7)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function CreatorSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — a content grid of post tiles ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {whatYouGet.items.map((it, i) => {
              const Icon = icons.get[i % icons.get.length];
              const st = TILE_STYLES[(i + Math.floor(i / 4)) % TILE_STYLES.length];
              return (
                <Reveal key={it.title} delay={(i % 4) * 0.05} className="h-full">
                  <Link
                    to={routeStart} aria-label={`${it.title} — create your page`}
                    className={`flex h-full min-h-[210px] flex-col justify-between rounded-[22px] border-2 p-6 hover:no-underline ${FOCUS}`}
                    style={{ background: st.bg, borderColor: st.bg === '#fff' ? BORDER : st.bg }}
                  >
                    <div className="flex items-start justify-between">
                      <Icon size={24} style={{ color: st.icon }} />
                      <Heart size={18} style={{ color: st.bg === RED ? '#fff' : st.bg === 'var(--v2-dark)' ? RED_BRIGHT : RED, fill: st.bg === RED ? '#fff' : st.bg === 'var(--v2-dark)' ? RED_BRIGHT : RED }} aria-hidden="true" />
                    </div>
                    <div>
                      <span className="block font-heading text-[17px] font-bold leading-snug" style={{ color: st.fg }}>{it.title}</span>
                      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: st.sub }}>{it.desc}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {whatYouGet.addons && (
            <div className="mt-6 flex flex-wrap gap-2">
              {whatYouGet.addons.map((a) => (
                <span key={a} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>#{a.toLowerCase().replace(/\s*&\s*|\s+/g, '')}</span>
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

      {/* ════════ STEPS — stories ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} lead="Three stories. Then your calendar fills itself." />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {flow.steps.map((st, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <Reveal key={st.title} delay={i * 0.07} className="flex flex-col rounded-[28px] p-6 md:min-h-[340px]" style={{ background: 'var(--v2-dark)' }}>
                  {/* story progress segments */}
                  <div aria-hidden="true" className="flex gap-1.5">
                    {flow.steps.map((_, k) => <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? '#fff' : 'rgba(255,255,255,0.25)' }} />)}
                  </div>
                  <div className="mt-4 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 p-0.5" style={{ borderColor: RED_BRIGHT }}>
                      <span className="flex h-full w-full items-center justify-center rounded-full" style={{ background: 'var(--v2-accent-cta)' }}><Icon size={14} className="text-white" /></span>
                    </span>
                    <span className="text-[12.5px] font-semibold text-white/75">your story</span>
                  </div>
                  <div className="mt-auto pt-10">
                    <h3 className="font-heading text-[24px] font-extrabold leading-tight text-white" style={{ margin: 0 }}>{st.title}</h3>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-white/75">{st.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — live-dot ornament ════════ */}
      <V2Integrations wrap={wrap} Decor={LiveDecor} cardClass={CARD} lift={false} />

      {/* ════════ REAL IMPACT — an insights panel ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Your insights," accent="this month." dark />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} className="rounded-[22px] border-2 border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="whitespace-nowrap font-heading text-[clamp(1.9rem,3vw,2.5rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <div aria-hidden="true" className="mt-5 flex h-12 items-end gap-1.5">
                  {SPARK[i % SPARK.length].map((h, k, arr) => (
                    <span key={k} className="flex-1 rounded-t-[4px]" style={{ height: `${(h / 9) * 100}%`, background: k === arr.length - 1 ? RED_BRIGHT : 'rgba(196,181,253,0.45)' }} />
                  ))}
                </div>
                <p className="mt-4 text-[13px] leading-snug text-white/70">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS — comments under a post ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Top comments" accent="from creators." lead="What creators say after their first paid calls." oneLine />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="flex h-full gap-3.5 rounded-[24px] border-2 bg-white p-6" style={{ margin: 0, borderColor: BORDER }}>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 p-0.5" style={{ borderColor: RED }}>
                    <span className="flex h-full w-full items-center justify-center rounded-full font-heading text-[12px] font-bold" style={{ background: 'var(--v2-wash)', color: 'var(--v2-accent-ink)' }}>
                      {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <figcaption className="text-[13.5px]">
                      <span className="font-bold text-[color:var(--v2-ink)]">{t.name}</span> <span className="text-black/60">· {t.role}</span>
                    </figcaption>
                    {i === 0 && <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--v2-accent-ink)' }}><Pin size={12} /> Pinned</span>}
                    <blockquote className="mt-2 flex-1 text-[15px] leading-relaxed text-black/80" style={{ margin: 0 }}>{t.quote}</blockquote>
                    <div aria-hidden="true" className="mt-4 flex items-center gap-4 text-[12px] font-semibold text-black/60">
                      <span className="flex items-center gap-1"><Heart size={14} style={{ color: RED, fill: RED }} /> Liked by creator</span>
                      <span className="flex items-center gap-1"><MessageCircle size={14} /> Reply</span>
                      <Send size={14} />
                    </div>
                  </div>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — a DM inbox vs a bookings list ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} oneLine />
          <div className="mt-12 grid items-start gap-8 md:grid-cols-2">
            <Reveal>
              <Screen title="Without a booking link" icon={Inbox}>
                <ul className="space-y-2">
                  {beforeAfter.before.map((b) => (
                    <li key={b} className="flex items-start gap-3 rounded-[16px] p-3" style={{ background: 'rgba(23,17,31,0.04)' }}>
                      <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: RED }} />
                      <span className="text-[14px] leading-snug text-black/70">{b}</span>
                    </li>
                  ))}
                </ul>
              </Screen>
            </Reveal>
            <Reveal delay={0.08}>
              <Screen title="With Meeticulous" icon={CalendarCheck} dark>
                <ul className="space-y-2">
                  {beforeAfter.after.map((a) => (
                    <li key={a} className="flex items-start gap-3 rounded-[16px] p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: RED_BRIGHT }}><Check size={12} style={{ color: '#fff' }} strokeWidth={3} /></span>
                      <span className="text-[14px] leading-snug text-white/85">{a}</span>
                    </li>
                  ))}
                </ul>
              </Screen>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING (full width, like every section on this page) ════════ */}
      <V2Pricing routeStart={routeStart} Decor={LiveDecor} cardClass={CARD} lift={false} wrap={wrap} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={LiveDecor} cardClass={CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — minimal list (full width) ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto grid ${wrap} items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><MinimalFaq items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — dark panel, one button ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-10`} style={{ background: 'var(--v2-dark)' }}>
          <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{finalCta.subline}</p>
          <Link to={routeStart} className={`mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold hover:no-underline ${FOCUS}`} style={{ background: RED_BRIGHT, color: '#fff' }}>
            {finalCta.ctaText} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
