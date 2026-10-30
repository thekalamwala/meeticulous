// /features/:slug — data-driven feature marketing page.
//
// Reuses the Meeticulous visual language ported from the About / Attic /
// Enterprise / How-It-Works pages (see featurePage.css, scoped under .fp-page):
//   Hero .............. About HeroV2 (split, peach aura, accent word)
//   Stats ............. Attic odometer strip (dark)
//   Problem/Solution .. How-It-Works BenefitsComparison (without / with)
//   Signature flow .... ONE of: coverflow (HIW ProcessOverview) |
//                       timeline (Enterprise journey map) | automation
//                       (HIW AutomationFlow) — picked per feature via
//                       feature.signature
//   Capabilities ...... About BeliefGrid (icon chips)
//   Product ........... Attic ProductMock (CSS UI, no screenshots)
//   Use cases ......... icon card grid
//   Testimonials ...... About TestimonialsFlip (card row)
//   Related ........... internal-link cards (descriptive anchors)
//   FAQ ............... About FaqAccordion (dark)
//   CTA ............... About JoinSplit
//
// Global Navbar + Footer come from App.jsx (/features is not in hideNavbar).
// All CTAs hand off to the real host signup funnel (/be-a-sloth).

import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, Check, X, Star, Plus, Clock, CalendarCheck, CalendarDays,
  CalendarClock, CalendarX2, CalendarOff, Wallet, CreditCard, IndianRupee, Share2,
  Link2, Bell, BellRing, BellOff, MailCheck, Mail, Users, Layers, Globe, Zap,
  ShieldCheck, FileText, Download, BarChart3, LayoutDashboard, RefreshCw, Video,
  Settings, PenLine, Briefcase, GraduationCap, Repeat, Search, MessageCircle,
  FolderX, FolderCheck, Sparkles, Tag, UserPlus, Receipt,
} from 'lucide-react';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL } from '../../utils/seo';
import { getFeature } from './featureData';
import { TESTIMONIALS } from '../../data/testimonials';
import { HERO_FACES } from '../../components/home/images';
import PageGuides from '../../components/common/PageGuides';
import './featurePage.css';

const ROUTE = '/become-a-host';
// Brand palette cycled for icon chips / borders so a page never reads one-note.
const PALETTE = ['#960D32', '#FF4D93', '#4AB765', '#FFCC1C', '#269CEF', '#8B5CF6'];
const soft = (hex) => `color-mix(in srgb, ${hex} 14%, white)`;

// Icon-name → component. featureData refers to icons by string.
const ICONS = {
  ArrowRight, ArrowLeft, Check, X, Star, Clock, CalendarCheck, CalendarDays,
  CalendarClock, CalendarX2, CalendarOff, Wallet, CreditCard, IndianRupee, Share2,
  Link2, Bell, BellRing, BellOff, MailCheck, Mail, Users, Layers, Globe, Zap,
  ShieldCheck, FileText, Download, BarChart3, LayoutDashboard, RefreshCw, Video,
  Settings, PenLine, Briefcase, GraduationCap, Repeat, Search, MessageCircle,
  FolderX, FolderCheck, Sparkles, Tag, UserPlus, Receipt,
};
const Icon = ({ name, ...p }) => {
  const C = ICONS[name] || Sparkles;
  return <C {...p} />;
};

/* Hero social-proof face + testimonial avatar — copied verbatim from Home.jsx so
   the CDN photos (with initials/neutral fallback) render identically here. */
function HeroFace({ src }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <span className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas bg-gradient-to-br from-primary-light to-sand" />;
  return <img src={src} onError={() => setErr(true)} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-canvas object-cover" />;
}
function TAvatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{name?.charAt(0) || '★'}</div>;
  return <img src={src} onError={() => setErr(true)} alt={name} loading="lazy" className="h-11 w-11 flex-shrink-0 rounded-xl object-cover" />;
}

/* ── shared CTA (global .btn geometry; primary keeps HeroV2 hard shadow) ── */
// Tinted with the page's own accent (--fp-accent) so every CTA matches the
// feature it sits on, instead of a single brand orange.
function Cta({ children = 'Get started free', variant = 'primary' }) {
  if (variant === 'primary') {
    return (
      <Link to={ROUTE} className="btn inline-flex items-center justify-center gap-1.5 px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] hover:no-underline" style={{ background: 'var(--fp-accent)' }}>
        {children} <ArrowRight size={16} />
      </Link>
    );
  }
  return (
    <Link to={ROUTE} className="btn btn--outline inline-flex items-center justify-center gap-1.5 px-7 py-3.5 hover:no-underline" style={{ color: 'var(--fp-accent)', borderColor: 'var(--fp-accent)' }}>
      {children}
    </Link>
  );
}

/* ════════════════ ProductMock — CSS product UI (no images) ════════════════ */
function ProductMock({ mock }) {
  if (!mock) return null;
  const { kind, title, subtitle, rows = [], slots = [], go } = mock;
  return (
    <div className="frame">
      <div className="tt" aria-hidden><i /><i /><i /></div>
      <div className="bd">
        <div className="ch">{title}{subtitle && <small>{subtitle}</small>}</div>
        {kind === 'calendar' && (
          <>
            <div className="days"><b>MON</b><b>TUE</b><b>WED</b><b>THU</b><b>FRI</b></div>
            <div className="slots">
              {slots.map((s, i) => (
                <div key={i} className={`slot${s.on ? ' on' : ''}${s.dim ? ' dim' : ''}`}>{s.t}</div>
              ))}
            </div>
          </>
        )}
        {kind === 'list' && rows.map((r, i) => (
          <div key={i} className="rowline">
            <span>{r.label}</span>
            <span className="pill" style={{ background: soft(r.tint || '#4AB765'), color: r.tint || '#4AB765' }}>{r.value}</span>
          </div>
        ))}
        {go && <div className="go">{go}</div>}
      </div>
      <span className="tag" aria-hidden>Product preview</span>
    </div>
  );
}

/* ════════════════ Hero (About HeroV2) ════════════════ */
function Hero({ feature }) {
  const h = feature.hero || {};
  const glass = feature.heroGlass || [];
  return (
    <header className="fp-hero">
      <span aria-hidden className="aura" />
      <div className="fp-wrap grid">
        <div>
          <nav aria-label="Breadcrumb" className="fp-hero-crumb">
            <Link to="/">Home</Link>
            <span aria-hidden className="sp">/</span>
            <span>Features</span>
            <span aria-hidden className="sp">/</span>
            <span className="cur" aria-current="page">{feature.title}</span>
          </nav>
          <h1 style={{ marginTop: 16 }}>
            {h.pre}{' '}<span className="type">{h.accent}</span>{h.post ? <> <span className="post">{h.post}</span></> : null}
          </h1>
          <p className="sub">{h.sub || feature.description}</p>
          <div className="btn-row">
            <Cta>{h.cta || 'Get started free'}</Cta>
            <Cta variant="outline">See how it works</Cta>
          </div>
          <div className="proof">
            <div className="fp-faces" aria-hidden>
              {HERO_FACES.map((src, i) => <HeroFace key={i} src={src} />)}
            </div>
            <div>
              <div className="fp-stars" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={13} fill="#FFCC1C" />)}</div>
              <p className="fp-proof-cap">Loved by India&rsquo;s creators and coaches.</p>
            </div>
          </div>
        </div>
        <div className="fp-mock">
          <ProductMock mock={feature.heroMock} />
          {glass.map((g, i) => (
            <div key={i} className={`fp-glass g${i + 1}`}>
              <span className="ic" style={{ background: soft(g.tint || feature.accent) }}><Icon name={g.icon} size={15} color={g.tint || feature.accent} /></span>
              <div><div className="lb">{g.label}</div><div className="vl">{g.value}</div></div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ════════════════ Stats (Attic odometer strip) ════════════════ */
function Stats({ stats }) {
  if (!stats?.length) return null;
  return (
    <section className="fp-stats">
      <div className="fp-wrap r">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="n">{s.value}</div>
            <div className="l">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════ Problem → Solution (HIW BenefitsComparison) ════════════════ */
function Benefits({ benefits }) {
  if (!benefits) return null;
  return (
    <section className="fp-sec"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">The problem</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>{benefits.heading}</h2>
      {benefits.lead && <p className="fp-lead">{benefits.lead}</p>}
      <div className="fp-cmp">
        <div className="fp-col bad">
          <h3><span className="fp-head-bad"><X size={18} /></span> Doing it by hand</h3>
          <ul>{benefits.without.map((b, i) => (
            <li key={i}><span className="mk"><X size={13} /></span><div><div className="it-t">{b.title}</div><div className="it-d">{b.desc}</div></div></li>
          ))}</ul>
        </div>
        <div className="fp-col good">
          <h3><span className="fp-head-good"><Check size={18} /></span> With Meeticulous</h3>
          <ul>{benefits.with.map((b, i) => (
            <li key={i}><span className="mk"><Check size={13} /></span><div><div className="it-t">{b.title}</div><div className="it-d">{b.desc}</div></div></li>
          ))}</ul>
        </div>
      </div>
    </div></section>
  );
}

/* ════════════════ Signature: coverflow (HIW ProcessOverview) ════════════════ */
function Coverflow({ steps, heading, lead }) {
  const [active, setActive] = useState(Math.min(1, steps.length - 1));
  if (!steps?.length) return null;
  const pos = (i) => { const d = i - active; return Math.abs(d) > 2 ? 'hidden' : String(d); };
  return (
    <section className="fp-sec fp-soft-bg"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">How it works</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>{heading}</h2>
      {lead && <p className="fp-lead">{lead}</p>}
      <div className="fp-cover">
        {steps.map((s, i) => {
          const tint = PALETTE[i % PALETTE.length];
          return (
            <button type="button" key={s.title} className="fp-pc" data-pos={pos(i)} onClick={() => setActive(i)} aria-label={`Step ${i + 1}: ${s.title}`}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <span className="ic" style={{ background: soft(tint), color: tint }}><Icon name={s.icon} size={22} /></span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="fp-cover-nav">
        <button type="button" className="fp-arrow" onClick={() => setActive((a) => Math.max(0, a - 1))} aria-label="Previous step"><ArrowLeft size={20} /></button>
        <div className="fp-dots">{steps.map((s, i) => (
          <button type="button" key={s.title} className={active === i ? 'on' : ''} onClick={() => setActive(i)} aria-label={`Go to step ${i + 1}`} />
        ))}</div>
        <button type="button" className="fp-arrow" onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))} aria-label="Next step"><ArrowRight size={20} /></button>
      </div>
    </div></section>
  );
}

/* ════════════════ Signature: automation (HIW AutomationFlow) ════════════════ */
function Automation({ automation }) {
  if (!automation) return null;
  const { heading, lead, nodes = [], cards = [] } = automation;
  return (
    <section className="fp-sec fp-auto"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">Automation</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>{heading}</h2>
      {lead && <p className="fp-lead">{lead}</p>}
      <div className="fp-chain">
        {nodes.map((n, i) => (
          <div key={n.label} style={{ display: 'contents' }}>
            <div className="fp-node"><span className="ic"><Icon name={n.icon} size={20} /></span><span>{n.label}</span></div>
            {i < nodes.length - 1 && <ArrowRight className="fp-arw" size={16} aria-hidden />}
          </div>
        ))}
      </div>
      <div className="fp-acards">
        {cards.map((c) => (
          <div key={c.title} className="fp-acard"><span className="ic"><Icon name={c.icon} size={20} /></span><h3>{c.title}</h3><p>{c.desc}</p></div>
        ))}
      </div>
    </div></section>
  );
}

/* ════════════════ Signature: timeline (Enterprise "journey" map, ported) ════════════════ */
// The exact Enterprise curve + node coordinates + morphing blob info-card, copied
// verbatim (enterprise-v2/Timeline.jsx + enterprise.scoped.css), content-swapped.
// All timeline features carry 5 stops → 5 of the 8 Enterprise positions, on-path.
const TL_PATH = 'M 90 150 C 165 200, 260 190, 345 145 C 470 82, 610 58, 735 75 C 885 92, 1035 135, 1115 205 C 1170 260, 1170 340, 1115 395 C 1035 468, 870 505, 720 485 C 555 465, 430 420, 305 412 C 220 405, 145 430, 90 478';
const TL_COORDS = [[13.2, 26.8], [61.25, 13.4], [90.2, 37.5], [60, 86.3], [13.2, 85.4]];
const TL_SHAPE = 'M 200 8 C 310 6, 395 48, 430 120 C 458 178, 449 235, 405 280 C 365 322, 295 344, 208 342 C 98 340, 18 280, 12 186 C 6 90, 88 15, 200 8 Z';
const tlColor = (i) => PALETTE[i % PALETTE.length];

function Timeline({ timeline }) {
  const nodes = timeline?.nodes || [];
  const [active, setActive] = useState(0);
  if (!nodes.length) return null;
  const cur = nodes[active];
  const color = tlColor(active);
  const phaseVars = { '--phase-color': color, '--phase-soft-color': soft(color) };
  return (
    <section className="fp-sec"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">The journey</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>{timeline.heading}</h2>
      {timeline.lead && <p className="fp-lead">{timeline.lead}</p>}

      <div className="fp-tl-map">
        <svg className="path" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path d={TL_PATH} fill="none" stroke="var(--fp-accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="fp-tl-nodes">
          {nodes.map((n, i) => (
            <button type="button" key={n.title} className={`fp-tl-node${active === i ? ' on' : ''}`}
              style={{ left: `${(TL_COORDS[i] || [50, 50])[0]}%`, top: `${(TL_COORDS[i] || [50, 50])[1]}%`, '--phase-color': tlColor(i), '--phase-soft-color': soft(tlColor(i)) }}
              onClick={() => setActive(i)} aria-label={`Stop ${i + 1}: ${n.title}`} aria-pressed={active === i}>
              <span className="fp-tl-node__circle">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="fp-tl-center" style={phaseVars}>
          <svg className="fp-tl-center__shape" viewBox="-18 -18 476 386" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`tlGrad-${timeline.heading?.length}-${active}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor={soft(color)} />
              </linearGradient>
            </defs>
            <path className="fp-tl-shape-outline" d={TL_SHAPE} />
            <path className="fp-tl-shape-main" d={TL_SHAPE} fill={`url(#tlGrad-${timeline.heading?.length}-${active})`} />
          </svg>
          <div className="fp-tl-content">
            <div className="fp-tl-icon"><Icon name={cur.icon} size={29} strokeWidth={1.8} /></div>
            <span className="fp-tl-phase">Stop {active + 1} of {nodes.length}</span>
            <h3>{cur.title}</h3>
            <p>{cur.desc}</p>
            <div className="fp-tl-nav">
              <button type="button" onClick={() => setActive((a) => Math.max(a - 1, 0))} disabled={active === 0} aria-label="Previous stop"><ArrowLeft size={17} strokeWidth={2} /></button>
              <span>{active + 1} / {nodes.length}</span>
              <button type="button" onClick={() => setActive((a) => Math.min(a + 1, nodes.length - 1))} disabled={active === nodes.length - 1} aria-label="Next stop"><ArrowRight size={17} strokeWidth={2} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="fp-tl-mobile">
        {nodes.map((n, i) => (
          <div key={n.title} className="fp-tl-step">
            <span className="n" style={{ background: tlColor(i), color: tlColor(i) === '#FFCC1C' ? '#2A1416' : '#fff' }}>{i + 1}</span>
            <div><div style={{ fontWeight: 700 }}>{n.title}</div><div style={{ fontSize: 13, color: 'var(--fp-muted)', marginTop: 2 }}>{n.desc}</div></div>
          </div>
        ))}
      </div>
    </div></section>
  );
}

function Signature({ feature }) {
  if (feature.signature === 'timeline') return <Timeline timeline={feature.timeline} />;
  if (feature.signature === 'automation') return <Automation automation={feature.automation} />;
  return <Coverflow steps={feature.steps} heading={feature.stepsHeading || 'How it works'} lead={feature.stepsLead} />;
}

/* ════════════════ Capabilities (About BeliefGrid) ════════════════ */
function Capabilities({ feature }) {
  const items = feature.capabilities || [];
  if (!items.length) return null;
  return (
    <section className="fp-sec"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">Capabilities</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>{feature.capabilitiesHeading || `What you can do with ${feature.title.toLowerCase()}`}</h2>
      {feature.capabilitiesLead && <p className="fp-lead">{feature.capabilitiesLead}</p>}
      <div className="fp-belief">
        {items.map((c, i) => {
          const tint = PALETTE[i % PALETTE.length];
          return (
            <div key={c.title} className="fp-bcard" style={{ borderTopColor: tint }}>
              <span className="fp-bchip" style={{ background: soft(tint), color: tint }}><Icon name={c.icon} size={21} /></span>
              <h3>{c.title}</h3><p>{c.body}</p>
            </div>
          );
        })}
      </div>
    </div></section>
  );
}

/* ════════════════ Product panel (Attic ProductMock) ════════════════ */
function ProductPanel({ feature }) {
  const p = feature.product;
  if (!p) return null;
  return (
    <section className="fp-sec fp-soft-bg fp-prod"><div className="fp-wrap in">
      <div>
        <p className="fp-eyebrow">{p.eyebrow || 'See it live'}</p>
        <h2 className="fp-title" style={{ marginTop: 12 }}>{p.heading}</h2>
        <p style={{ marginTop: 16, color: 'var(--fp-muted)', maxWidth: '30rem' }}>{p.body}</p>
        <div className="btn-row" style={{ marginTop: 26 }}><Cta /></div>
      </div>
      <div className="fp-mock" style={{ maxWidth: 420 }}><ProductMock mock={p.mock} /></div>
    </div></section>
  );
}

/* ════════════════ Use cases ════════════════ */
function UseCases({ useCases }) {
  if (!useCases?.length) return null;
  return (
    <section className="fp-sec fp-soft-bg"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">Who it&rsquo;s for</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>Built for the way you work</h2>
      <div className="fp-uc">
        {useCases.map((u) => (
          <div key={u.audience} className="fp-ucard">
            <span className="k" style={{ background: 'var(--fp-accent-soft)', color: 'var(--fp-accent)' }}><Icon name={u.icon} size={24} /></span>
            <h3>{u.audience}</h3><p>{u.description}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}

/* ════════════════ Testimonials — homepage centred carousel, verbatim ════════════════ */
// Ported from Home.jsx (real TESTIMONIALS from data/testimonials.js). Transform
// track, tripled list, forward auto-advance with a seamless jump back one copy,
// drag-to-navigate and keyboard support. Same markup and behaviour as the homepage.
const T_GAP = 20;
function Testimonials() {
  const N_T = TESTIMONIALS.length;
  const [activeT, setActiveT] = useState(N_T);
  const [tAnim, setTAnim] = useState(false);
  const [tW, setTW] = useState(0);
  const tWrapRef = useRef(null);
  const tPausedRef = useRef(false);
  const [dragDX, setDragDX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0 });

  useEffect(() => {
    const el = tWrapRef.current;
    if (!el) return undefined;
    const measure = () => setTW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (tAnim || !tW) return undefined;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setTAnim(true)));
    return () => cancelAnimationFrame(id);
  }, [tAnim, tW]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => { if (!tPausedRef.current) setActiveT((a) => a + 1); }, 2500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (activeT < 2 * N_T) return undefined;
    const id = setTimeout(() => { setTAnim(false); setActiveT((a) => a - N_T); }, 700);
    return () => clearTimeout(id);
  }, [activeT, N_T]);
  useEffect(() => {
    if (activeT >= N_T) return undefined;
    const id = setTimeout(() => { setTAnim(false); setActiveT((a) => a + N_T); }, 700);
    return () => clearTimeout(id);
  }, [activeT, N_T]);

  const tFrac = tW >= 1024 ? 0.44 : tW >= 640 ? 0.6 : 0.84;
  const tCardW = tW ? tW * tFrac : 0;
  const tOffset = tW ? (tW - tCardW) / 2 - activeT * (tCardW + T_GAP) : 0;

  return (
    <section className="fp-sec fp-soft-bg" style={{ overflow: 'hidden' }}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="fp-title">Don&rsquo;t take our word for it.</h2>
        <p className="fp-lead">Real professionals. Real bookings. Real calm.</p>
      </div>
      <div className="relative mt-8">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-12 top-12 z-0 hidden lg:block">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-200" />
          <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-neutral-200" />
          <div className="absolute inset-y-0 left-[28%] border-l border-dashed border-neutral-200" />
          <div className="absolute inset-y-0 left-[72%] border-l border-dashed border-neutral-200" />
        </div>
        <div
          ref={tWrapRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="What our customers say — use the arrow keys to browse"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); setActiveT((a) => a + 1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); setActiveT((a) => a - 1); }
          }}
          onMouseEnter={() => { tPausedRef.current = true; }}
          onMouseLeave={() => { tPausedRef.current = false; }}
          onPointerDown={(e) => {
            dragRef.current = { active: true, startX: e.clientX };
            setDragging(true); tPausedRef.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => { if (dragRef.current.active) setDragDX(e.clientX - dragRef.current.startX); }}
          onPointerUp={(e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.startX;
            const step = tCardW + T_GAP;
            let moved = step ? Math.round(-dx / step) : 0;
            if (moved === 0 && Math.abs(dx) > 48) moved = dx < 0 ? 1 : -1;
            const lim = N_T - 1;
            moved = Math.max(-lim, Math.min(lim, moved));
            dragRef.current.active = false; setDragging(false); setDragDX(0);
            if (moved !== 0) setActiveT((a) => a + moved);
            tPausedRef.current = false;
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          }}
          onPointerCancel={() => { dragRef.current.active = false; setDragging(false); setDragDX(0); tPausedRef.current = false; }}
          className="relative z-10 cursor-grab touch-pan-y select-none overflow-hidden rounded-[6px] py-12 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--fp-accent)] focus-visible:ring-offset-2 active:cursor-grabbing"
        >
          <div
            className={`flex ${tAnim && !dragging ? "transition-transform duration-700 ease-out motion-reduce:transition-none" : ""}`}
            style={{ transform: `translate3d(${tOffset + dragDX}px, 0, 0)`, columnGap: `${T_GAP}px` }}
          >
            {tW > 0 && [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => {
              const isActive = i === activeT;
              return (
                <figure
                  key={i}
                  style={{ width: `${tCardW}px` }}
                  className={`relative flex h-[14rem] flex-shrink-0 flex-col justify-between overflow-hidden rounded-[6px] p-7 text-left transition-[opacity,box-shadow,border-color] duration-500 sm:p-9 ${isActive ? "border border-black/5 bg-white opacity-100 shadow-[0_30px_70px_-30px_rgba(26,26,26,0.35)]" : "border border-transparent bg-transparent opacity-40"}`}
                >
                  {isActive && <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: 'var(--fp-accent)' }} />}
                  <blockquote className="text-[15px] font-semibold leading-snug text-ink sm:text-[18px]">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="flex items-center gap-3">
                    <TAvatar src={t.avatar} name={t.name} />
                    <div>
                      <div className="text-sm font-semibold text-ink">{t.name}</div>
                      <div className="text-xs text-neutral-500">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-12 top-12 z-20 hidden lg:block">
          {["left-[28%] top-0 -translate-x-1/2 -translate-y-1/2", "left-[72%] top-0 -translate-x-1/2 -translate-y-1/2", "left-[28%] bottom-0 -translate-x-1/2 translate-y-1/2", "left-[72%] bottom-0 -translate-x-1/2 translate-y-1/2"].map((pos) => (
            <Plus key={pos} size={18} className={`absolute ${pos} text-neutral-300`} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════ Related features (internal links) ════════════════ */
function Related({ related }) {
  const items = (related || []).map((r) => ({ ...r, feature: getFeature(r.slug) })).filter((r) => r.feature);
  if (!items.length) return null;
  return (
    <section className="fp-sec"><div className="fp-wrap fp-center">
      <p className="fp-eyebrow">Explore</p>
      <h2 className="fp-title" style={{ marginTop: 12 }}>Works better together</h2>
      <div className="fp-rel">
        {items.map((r) => (
          <Link key={r.slug} to={`/features/${r.slug}`} className="hover:no-underline">
            <span className="k"><Icon name={r.icon || 'Sparkles'} size={18} /></span>
            <div><div className="tt">{r.feature.title}</div><div className="ds">{r.label}</div></div>
            <span className="go"><ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
    </div></section>
  );
}

/* ════════════════ FAQ (About FaqAccordion, dark) ════════════════ */
function Faq({ faq }) {
  if (!faq?.length) return null;
  return (
    <section className="fp-sec fp-faqwrap"><div className="fp-wrap fp-center">
      <h2 className="fp-title">Questions, answered.</h2>
      <div className="fp-faq">
        {faq.map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary>{f.q}<Plus className="pl" size={20} /></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div></section>
  );
}

/* ════════════════ Final CTA (About JoinSplit) ════════════════ */
function FinalCta({ feature }) {
  const cta = feature.cta || {};
  return (
    <section className="fp-sec"><div className="fp-wrap fp-join"><div className="in">
      <div>
        <h2>{cta.headline}</h2>
        <p>{cta.subline}</p>
        <div className="btn-row" style={{ marginTop: 24 }}><Cta />{' '}<Cta variant="outline">See pricing</Cta></div>
      </div>
      <div className="vis"><div className="fp-mock" style={{ maxWidth: 'none' }}><ProductMock mock={feature.heroMock} /></div></div>
    </div></div></section>
  );
}

/* ════════════════ Page ════════════════ */
export default function FeaturePage() {
  const { slug } = useParams();
  const feature = getFeature(slug);

  const canonical = feature ? `${SITE_URL}/features/${feature.slug}` : null;
  const jsonLd = useMemo(() => {
    if (!feature) return undefined;
    const graph = [];

    // Breadcrumb trail (Home → this feature).
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: feature.title, item: canonical },
      ],
    });

    // SoftwareApplication — answer engines cite this as the product itself, with
    // its feature list and the real free tier (no fabricated rating).
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Meeticulous',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: canonical,
      description: feature.seo?.description || feature.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      featureList: (feature.capabilities || []).map((c) => c.title),
      publisher: { '@type': 'Organization', name: 'Meeticulous', url: SITE_URL },
    });

    // HowTo — the page's one signature process (coverflow steps, timeline stops,
    // or automation chain) as an ordered how-to for AI "how do I…" answers.
    const howSteps = feature.steps
      ? feature.steps.map((s) => ({ name: s.title, text: s.desc }))
      : feature.timeline?.nodes
        ? feature.timeline.nodes.map((n) => ({ name: n.title, text: n.desc }))
        : feature.automation?.nodes
          ? feature.automation.nodes.map((n) => ({ name: n.label, text: n.label }))
          : [];
    if (howSteps.length) {
      graph.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: feature.stepsHeading || feature.timeline?.heading || feature.automation?.heading || `How ${feature.title} works`,
        description: feature.stepsLead || feature.timeline?.lead || feature.automation?.lead || feature.description,
        step: howSteps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
      });
    }

    // FAQ — direct Q&A for answer-engine extraction.
    if (feature.faq?.length) {
      graph.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: feature.faq.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    return graph;
  }, [feature, canonical]);

  if (!feature) return <Navigate to="/404" replace />;

  const styleVars = {
    '--fp-accent': feature.accent,
    '--fp-accent-soft': feature.accentLight,
    '--fp-dark': feature.darkBg,
  };

  return (
    <div className="fp-page" style={styleVars}>
      <Seo
        title={feature.seo?.title || feature.title}
        description={feature.seo?.description || feature.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={feature.accent}
        ogTitle={feature.seo?.title || feature.title}
        ogDescription={feature.seo?.description || feature.description}
        image={ogCard(`features-${feature.slug}`)}
        jsonLd={jsonLd}
      />

      <Hero feature={feature} />
      <Stats stats={feature.stats} />
      <Benefits benefits={feature.benefits} />
      <Signature feature={feature} />
      <Capabilities feature={feature} />
      <ProductPanel feature={feature} />
      <UseCases useCases={feature.useCases} />
      <Testimonials testimonials={feature.testimonials} />
      <Related related={feature.related} />
      <PageGuides />
      <Faq faq={feature.faq} />
      <FinalCta feature={feature} />
    </div>
  );
}
