// coworkingSkin — the "floor plan" body for /for/coworking-spaces.
//
// ProfessionLandingV2 renders these sections (everything between the hero and
// the footer) when a page's design sets `skin: 'coworking'`, and swaps the
// hero's generic booking card for <FloorPlanMock />. Same data and CTAs as the
// shared template; the presentation is drawn like a workspace floor plan:
//   · hero: a clickable floor plan — desks, rooms, a phone booth, door swings
//   · services: a floor directory — intro left, an even plan of rooms right
//   · steps: a dashed walkway with three stops
//   · real impact: seat rows under each figure, like an occupancy board
//   · testimonials: member desk plaques (name first, then the note)
//   · with/without: a dashed "unbuilt" plan vs a solid one
//   · FAQ: a two-column directory with a lit room bar on the open answer
//   · final CTA: the front door, with a large door swing
// Integrations, pricing and about come from the shared v2Sections, wearing the
// door-swing ornament. No hover lift anywhere. Colours from --v2-* (indigo).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/home/Reveal';
import PageGuides from '../../components/common/PageGuides';
import { V2Integrations, V2Pricing, V2About } from './v2Sections';
import ForFaqIntro from '../../components/common/ForFaqIntro';
import {
  ArrowRight, Plus, Link2, CreditCard, Armchair, CalendarX, CalendarCheck, Quote,
} from 'lucide-react';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const PLAN_CARD = 'rounded-[24px] border-2 border-[rgba(30,27,58,0.12)]';
const STEP_ICONS = [Link2, CreditCard, Armchair];

/* A door swing — the leaf (solid) and its arc (dashed). Sits in a room's corner. */
function DoorSwing({ size = 34, className = '', tone = 'var(--v2-accent)' }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" className={`pointer-events-none ${className}`} fill="none">
      <path d="M2 38 V4" stroke={tone} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 4 A34 34 0 0 1 36 38" stroke={tone} strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/* Card ornament for the shared sections: a small door swing in the top-right corner. */
function DoorDecor() {
  return <DoorSwing size={22} className="absolute right-4 top-4 opacity-60" />;
}

function SectionHead({ title, accent, lead, dark = false, center = false, oneLine = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} ${oneLine ? 'max-w-none' : 'max-w-2xl'}`}>
      <h2 className={`font-heading text-[clamp(1.7rem,3.3vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] ${oneLine ? 'sm:whitespace-nowrap' : ''} ${dark ? 'text-white' : ''}`}>
        {title}{accent ? <> <span style={{ color: dark ? '#A5B4FC' : 'var(--v2-accent-ink)' }}>{accent}</span></> : null}
      </h2>
      {lead && <p className={`mt-4 text-[15.5px] leading-relaxed ${center ? 'mx-auto' : ''} max-w-2xl ${dark ? 'text-white/60' : 'text-black/55'}`}>{lead}</p>}
    </div>
  );
}

/* ── Hero: a clickable floor plan of the space, with a booking bar ─────────── */
const DESKS = ['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06'];
const DESK_BOOKED = new Set(['A-02', 'A-05']);

export function FloorPlanMock({ mock }) {
  const [desk, room, cabin] = mock?.services || [];
  const [sel, setSel] = useState({ id: 'room', label: 'Meeting Room 2', svc: room });
  if (!mock) return null;
  const pick = (id, label, svc) => setSel({ id, label, svc });
  const isSel = (id) => sel.id === id;
  const roomCls = () => `relative flex flex-col justify-between rounded-[14px] border-2 p-3 text-left transition-colors ${FOCUS}`;
  const roomStyle = (id) => ({ borderColor: isSel(id) ? 'var(--v2-accent)' : 'rgba(30,27,58,0.16)', background: isSel(id) ? 'var(--v2-wash)' : '#fff' });

  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] border-2 bg-white p-5" style={{ borderColor: 'rgba(30,27,58,0.14)' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-bold text-[color:var(--v2-ink)]">{mock.brand}</div>
          <div className="text-[12px] text-black/45">Level 3 · {mock.tag}</div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-black/50">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] border-2" style={{ borderColor: 'var(--v2-accent)' }} />Open</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: 'var(--v2-ink)' }} />Booked</span>
        </div>
      </div>

      {/* the plan */}
      <div className="mt-4 grid grid-cols-6 grid-rows-[auto_auto_auto] gap-2">
        {/* hot desks */}
        <div className="col-span-4 rounded-[14px] border-2 border-dashed p-2.5" style={{ borderColor: 'rgba(30,27,58,0.16)' }}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">Hot desks</div>
          <div className="grid grid-cols-3 gap-1.5">
            {DESKS.map((d) => {
              const booked = DESK_BOOKED.has(d);
              return (
                <button
                  key={d} type="button" disabled={booked}
                  onClick={() => pick(d, `Desk ${d}`, desk)}
                  aria-pressed={isSel(d)}
                  className={`rounded-[10px] border-2 py-2 text-[11px] font-bold transition-colors ${FOCUS} ${booked ? 'cursor-not-allowed' : ''}`}
                  style={booked
                    ? { background: 'var(--v2-ink)', borderColor: 'var(--v2-ink)', color: 'rgba(255,255,255,0.7)' }
                    : { borderColor: 'var(--v2-accent)', background: isSel(d) ? 'var(--v2-accent)' : '#fff', color: isSel(d) ? '#fff' : 'var(--v2-accent-ink)' }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        {/* phone booth */}
        <div className="col-span-2 flex flex-col items-center justify-center rounded-[14px] border-2 p-2 text-center" style={{ borderColor: 'rgba(30,27,58,0.16)', background: 'var(--v2-ink)' }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Booth</div>
          <div className="mt-1 text-[12px] font-bold text-white/80">Booked</div>
        </div>
        {/* meeting room */}
        <button type="button" onClick={() => pick('room', 'Meeting Room 2', room)} aria-pressed={isSel('room')} className={`col-span-3 min-h-[92px] ${roomCls('room')}`} style={roomStyle('room')}>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">Meeting room 2</span>
          <span className="text-[12px] font-bold" style={{ color: 'var(--v2-accent-ink)' }}>Seats 6 · open</span>
          <DoorSwing size={26} className="absolute bottom-2 right-2" />
        </button>
        {/* cabin */}
        <button type="button" onClick={() => pick('cabin', 'Private Cabin 3', cabin)} aria-pressed={isSel('cabin')} className={`col-span-3 min-h-[92px] ${roomCls('cabin')}`} style={roomStyle('cabin')}>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">Cabin 3</span>
          <span className="text-[12px] font-bold" style={{ color: 'var(--v2-accent-ink)' }}>Lockable · open</span>
          <DoorSwing size={26} className="absolute bottom-2 right-2" />
        </button>
        {/* walkway */}
        <div aria-hidden="true" className="col-span-6 flex items-center gap-2 px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/30">
          <span className="h-0 flex-1 border-t-2 border-dashed" style={{ borderColor: 'rgba(30,27,58,0.18)' }} />
          Entrance
          <span className="h-0 flex-1 border-t-2 border-dashed" style={{ borderColor: 'rgba(30,27,58,0.18)' }} />
        </div>
      </div>

      {/* booking bar */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] p-3 pl-4" style={{ background: 'var(--v2-wash)' }}>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-[color:var(--v2-ink)]">{sel.label}</div>
          <div className="truncate text-[11px] text-black/50">{sel.svc?.meta}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-[15px] font-extrabold text-[color:var(--v2-ink)]">{sel.svc?.price}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[12px] font-semibold text-white" style={{ background: 'var(--v2-accent-cta)' }}>
            Book <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ: two-column directory, one answer open, a lit bar on the open room ── */
function FaqDirectory({ items }) {
  const [open, setOpen] = useState(-1);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="relative overflow-hidden rounded-[20px] border-2 bg-white transition-colors duration-200" style={{ borderColor: isOpen ? 'var(--v2-accent)' : 'rgba(30,27,58,0.1)' }}>
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 transition-opacity duration-200" style={{ background: 'var(--v2-accent)', opacity: isOpen ? 1 : 0 }} />
        <h3 style={{ margin: 0 }}>
          <button
            type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`cw-faq-${i}`}
            className={`flex w-full items-center gap-4 rounded-[18px] px-6 py-4 text-left ${FOCUS}`}
          >
            <span className="flex-1 font-heading text-[15px] font-bold" style={{ color: 'var(--v2-ink)' }}>{f.q}</span>
            <Plus size={18} className="flex-shrink-0 transition-transform duration-200" style={{ color: 'var(--v2-accent-ink)', transform: isOpen ? 'rotate(45deg)' : 'none' }} />
          </button>
        </h3>
        <div id={`cw-faq-${i}`} role="region" aria-hidden={!isOpen} className="grid motion-reduce:transition-none" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <div className="overflow-hidden">
            <p className="px-6 pb-5 text-[14.5px] leading-relaxed text-black/60">{f.a}</p>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">{items.map((f, i) => renderItem(f, i))}</div>
  );
}

// Decorative seat rows under each stat on the occupancy board (aria-hidden).
const SEAT_FILL = [10, 12, 8, 11];

export default function CoworkingSections({ data, wrap, Counter, icons, routeStart }) {
  const { stats, flow, whatYouGet, beforeAfter, testimonials, faq, finalCta } = data;

  return (
    <>
      {/* ════════ SERVICES — floor directory: intro on the left, an even plan of rooms on the right ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto grid ${wrap} items-start gap-12 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-16`}>
          <div className="xl:sticky xl:top-28">
            <SectionHead title={whatYouGet.title} lead={whatYouGet.lead} />
            {whatYouGet.addons && (
              <div className="mt-8">
                <div className="flex flex-wrap gap-2">
                  {whatYouGet.addons.map((a) => (
                    <span key={a} className="rounded-full border-2 border-dashed px-3.5 py-1.5 text-[12.5px] font-medium text-black/60" style={{ borderColor: 'rgba(30,27,58,0.18)' }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            <Reveal delay={0.1} className="mt-10 xl:text-left">
              <Link to={routeStart} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white hover:no-underline ${FOCUS}`} style={{ background: 'var(--v2-accent-cta)' }}>
                Create your page <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>

          {/* the plan: outer wall, 2px inner walls, a doorway gap on each room's top wall */}
          <Reveal className="overflow-hidden rounded-[28px] border-2" style={{ borderColor: 'var(--v2-ink)' }}>
            <div className="grid gap-[2px] sm:grid-cols-2" style={{ background: 'var(--v2-ink)' }}>
              {whatYouGet.items.map((it, i) => {
                const Icon = icons.get[i % icons.get.length];
                return (
                  <Link key={it.title} to={routeStart} aria-label={`${it.title} — create your page`} className={`block text-[color:var(--v2-ink)] group relative bg-white p-6 transition-colors duration-200 hover:bg-[color:var(--v2-wash)] sm:p-7 hover:no-underline ${FOCUS}`}>
                    <span aria-hidden="true" className="absolute left-7 top-0 h-[2px] w-10 bg-white transition-colors duration-200 group-hover:bg-[color:var(--v2-wash)]" style={{ marginTop: '-2px' }} />
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: 'var(--v2-accent-cta)' }}>
                        <Icon size={18} />
                      </span>
                      <h3 className="font-heading text-[16px] font-bold leading-snug" style={{ margin: 0 }}>{it.title}</h3>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-black/60">{it.desc}</p>
                  </Link>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════ STEPS — a dashed walkway with three stops ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={flow.title} />
          <div className="relative mt-14">
            <span aria-hidden="true" className="absolute left-[8%] right-[8%] top-6 hidden border-t-2 border-dashed md:block" style={{ borderColor: 'var(--v2-accent)' }} />
            <div className="grid gap-10 md:grid-cols-3 md:gap-6">
              {flow.steps.map((st, i) => {
                const Icon = STEP_ICONS[i % STEP_ICONS.length];
                return (
                  <Reveal key={st.title} delay={i * 0.07} className="relative text-center">
                    <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 text-white" style={{ background: 'var(--v2-accent-cta)', borderColor: 'var(--v2-wash)', boxShadow: '0 0 0 6px var(--v2-wash)' }}>
                      <Icon size={20} />
                    </span>
                    <div className="mx-auto mt-6 max-w-xs">
                      <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0 }}>{st.title}</h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-black/60">{st.desc}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════ INTEGRATIONS — door-swing cards ════════ */}
      <V2Integrations wrap={wrap} Decor={DoorDecor} cardClass={PLAN_CARD} lift={false} />

      {/* ════════ REAL IMPACT — occupancy board ════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--v2-dark)' }}>
        <div className={`mx-auto ${wrap}`}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label}>
                <div className="font-heading text-[clamp(2rem,4vw,3rem)] font-extrabold leading-none tracking-[-0.03em] text-white">
                  <Counter to={s.to} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                </div>
                <div aria-hidden="true" className="mt-4 grid max-w-[180px] grid-cols-12 gap-[3px]">
                  {Array.from({ length: 12 }, (_, k) => (
                    <span key={k} className="h-2.5 rounded-[3px]" style={{ background: k < SEAT_FILL[i % SEAT_FILL.length] ? '#A5B4FC' : 'rgba(255,255,255,0.12)' }} />
                  ))}
                </div>
                <p className="mt-3 max-w-[24ch] text-[12.5px] leading-snug text-white/55">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS — member desk plaques ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title="Spaces that run" accent="on one link." lead="What coworking teams say." oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06} className="h-full">
                <figure className="flex h-full flex-col overflow-hidden rounded-[24px] border-2 bg-white" style={{ margin: 0, borderColor: 'rgba(30,27,58,0.12)' }}>
                  <figcaption className="flex items-center gap-3 px-6 py-4" style={{ background: 'var(--v2-ink)' }}>
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] font-heading text-[13px] font-bold" style={{ background: '#A5B4FC', color: 'var(--v2-ink)' }}>
                      {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-white">{t.name}</div>
                      <div className="truncate text-[12px] text-white/55">{t.role}</div>
                    </div>
                  </figcaption>
                  <div className="flex flex-1 gap-3 p-6">
                    <Quote size={20} aria-hidden="true" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />
                    <blockquote className="text-[15px] leading-relaxed text-black/75" style={{ margin: 0 }}>{t.quote}</blockquote>
                  </div>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ WITH / WITHOUT — a dashed (unbuilt) plan vs a solid one ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--v2-wash)' }}>
        <div className={`mx-auto ${wrap}`}>
          <SectionHead title={beforeAfter.title} lead={beforeAfter.lead} oneLine />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="rounded-[24px] border-2 border-dashed bg-white/60 p-8" style={{ borderColor: 'rgba(30,27,58,0.25)' }}>
              <h3 className="font-heading text-[18px] font-bold text-black/45" style={{ margin: 0 }}>Without a booking link</h3>
              <ul className="mt-6 space-y-4">
                {beforeAfter.before.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-black/50"><CalendarX size={18} className="mt-0.5 flex-shrink-0 text-black/30" />{b}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="relative rounded-[24px] border-2 bg-white p-8" style={{ borderColor: 'var(--v2-accent)' }}>
              <DoorSwing size={30} className="absolute right-5 top-5" />
              <h3 className="font-heading text-[18px] font-bold" style={{ margin: 0, color: 'var(--v2-accent-ink)' }}>With Meeticulous</h3>
              <ul className="mt-6 space-y-4">
                {beforeAfter.after.map((a) => (
                  <li key={a} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-black/80"><CalendarCheck size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--v2-accent)' }} />{a}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ PRICING — door-swing plan cards ════════ */}
      <V2Pricing routeStart={routeStart} Decor={DoorDecor} cardClass={PLAN_CARD} lift={false} />

      {/* ════════ ABOUT ════════ */}
      <V2About wrap={wrap} label={data.label} background="var(--v2-wash)" Decor={DoorDecor} cardClass={PLAN_CARD} />

      {/* Guides sit directly above the FAQ, as on the bespoke /for pages. */}
      <PageGuides />

      {/* ════════ FAQ — two-column directory ════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="text-center lg:sticky lg:top-28 lg:text-left lg:[&_.text-center]:text-left lg:[&_.mx-auto]:mx-0">
            <SectionHead title="Frequently asked questions." center />
            <ForFaqIntro accent="var(--v2-accent-ink)" />
          </div>
          <div className="min-w-0"><FaqDirectory items={faq} /></div>
        </div>
      </section>

      {/* ════════ FINAL CTA — the front door ════════ */}
      <section className="px-5 pb-24 pt-4 sm:px-8">
        <div className={`relative mx-auto ${wrap} overflow-hidden rounded-[32px] px-6 py-20 text-center sm:px-10`} style={{ background: 'var(--v2-dark)' }}>
          <DoorSwing size={220} tone="rgba(165,180,252,0.35)" className="absolute -bottom-6 -right-4 hidden sm:block" />
          <DoorSwing size={140} tone="rgba(165,180,252,0.2)" className="absolute -left-6 -top-4 hidden rotate-180 sm:block" />
          <h2 className="relative mx-auto max-w-3xl font-heading text-[clamp(1.9rem,3.8vw,2.8rem)] font-extrabold leading-tight tracking-[-0.02em] text-white">{finalCta.headline}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">{finalCta.subline}</p>
          <Link to={routeStart} className={`relative mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold hover:no-underline ${FOCUS}`} style={{ background: '#fff', color: 'var(--v2-accent-ink)' }}>
            {finalCta.ctaText} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
