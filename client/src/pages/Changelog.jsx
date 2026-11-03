import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CornerUpRight, Flag, Milestone, ShieldCheck } from 'lucide-react';
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";
import { SORTED_RELEASES } from '../data/changelog';
import './changelog.css';

// /changelog — public "What's New" as a road trip. A road switchbacks down the
// page (left→right, right→left, …); each release is a road sign standing on it,
// newest first, and links to /changelog/:version. Release content lives in
// data/changelog.js. Phones (< lg) get one vertical winding road down the left.

// First tag picks the sign (see data/changelog.js).
const SIGN_KIND = { New: 'board', Improved: 'stone', Fixed: 'turn', Security: 'shield' };

// Desktop road geometry, in viewBox units (1000 wide, scales uniformly).
// Stop i stands on leg i; legs are joined by half-circle U-turns.
const VB_W = 1000;
const LEG = 280;            // vertical distance between legs
const TOP = 110;            // first leg's y (stop 0 is the short "road ahead" marker)
const X_LEFT = 150;
const X_RIGHT = 850;
const ROAD_W = 56;
const EDGE = 40;            // road runs in/out this close to the edges (round caps, no clipping)

const STOPS = [{ kind: 'ahead' }, ...SORTED_RELEASES.map((r) => ({ kind: 'release', r })), { kind: 'start' }];
const legY = (i) => TOP + i * LEG;
const VB_H = legY(STOPS.length - 1) + 110;

const DESKTOP_D = STOPS.map((_, i) => {
  const ltr = i % 2 === 0;
  const last = i === STOPS.length - 1;
  const run = `H ${last ? (ltr ? VB_W - EDGE : EDGE) : ltr ? X_RIGHT : X_LEFT}`;
  if (last) return run;
  const r = LEG / 2;
  return `${run} A ${r} ${r} 0 0 ${ltr ? 1 : 0} ${ltr ? X_RIGHT : X_LEFT} ${legY(i + 1)}`;
}).reduce((d, seg) => `${d} ${seg}`, `M ${EDGE} ${TOP}`);

// Signs alternate between two spots on the straight, so they never stack.
const stopX = (i) => (i % 2 === 0 ? 380 : 620);

// Phone road: a sine wave down a 56px strip, built in px once the list height is known.
const mobileD = (h) => {
  if (!h) return '';
  let d = 'M 28 0 Q 50 55 28 110';
  for (let y = 220; y < h + 110; y += 110) d += ` T 28 ${y}`;
  return d;
};

const Sign = ({ r }) => {
  const kind = SIGN_KIND[r.tags[0]] || 'board';
  return (
    <Link to={`/changelog/${r.version}`} className={`cl-sign cl-sign--${kind}`}>
      {kind === 'turn' && <span className="cl-diamond" aria-hidden="true"><CornerUpRight size={24} strokeWidth={2} /></span>}
      {kind === 'shield' && <span className="cl-shield" aria-hidden="true"><ShieldCheck size={24} strokeWidth={2} /></span>}
      {kind === 'stone' && <span className="cl-stone-cap" aria-hidden="true">KM</span>}
      <span className="cl-plate">
        <span className="cl-plate__v">v{r.version}</span>
        <span className="cl-plate__title">{r.title}</span>
        <span className="cl-plate__meta">
          <time>{r.date}</time>
          <span className="inline-flex items-center gap-1 font-semibold">
            Read <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        </span>
      </span>
      {kind !== 'stone' && <span className="cl-posts" aria-hidden="true" />}
    </Link>
  );
};

const Road = ({ d, width, refs }) => (
  <>
    <path d={d} className="cl-road__base" strokeWidth={width} />
    <path d={d} className="cl-road__paved" strokeWidth={width} pathLength="1" strokeDasharray="1 1" ref={(el) => el && refs.current.add(el)} />
    <path d={d} className="cl-road__centre" strokeWidth={Math.max(2, width / 14)} strokeDasharray={width > 30 ? '18 22' : '8 12'} />
  </>
);

const Changelog = () => {
  const listRef = useRef(null);
  const paved = useRef(new Set());
  const [listH, setListH] = useState(0);
  const [anim, setAnim] = useState(false);

  // Phone road follows the list's real height.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setListH(Math.round(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw the road as you scroll + reveal signs. Reduced motion: road stays fully
  // drawn and signs stay visible (prerendered HTML is already the final state).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const list = listRef.current;
    setAnim(true);

    let raf = 0;
    const draw = () => {
      raf = 0;
      const box = list.getBoundingClientRect();
      // Paved up to the line 60% down the viewport.
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - box.top) / box.height));
      paved.current.forEach((el) => { el.style.strokeDashoffset = String(1 - p); });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(draw); };
    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -15% 0px' });
    list.querySelectorAll('.cl-stop').forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className="relative overflow-x-clip bg-cream">
      <Seo
        title="What's New — Meeticulous Changelog"
        description="Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous."
        image={ogCard('changelog')}
        canonical={`${SITE_URL}/changelog`}
        jsonLd={[
          collectionPageJsonLd({
            name: "What's New — Meeticulous Changelog",
            description: 'Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous.',
            url: '/changelog',
            items: SORTED_RELEASES.map((r) => ({ name: `v${r.version} — ${r.title}`, url: `/changelog/${r.version}` })),
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Changelog', path: '/changelog' }] }),
        ]}
      />
      <div className="app-container py-12 sm:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
            Product updates
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.035em] text-maroon sm:text-6xl">
            The road so far.{' '}
            <span className="font-serif font-normal italic tracking-[-0.02em] text-rose sm:whitespace-nowrap">One stop at a time.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink/70 sm:text-base">
            Every improvement we’ve shipped to help you get booked and get paid, newest first.
            Tap a sign to see what changed.
          </p>
        </header>

        <ol
          ref={listRef}
          className={`relative mx-auto mt-12 max-w-[1000px] space-y-12 pl-[76px] lg:mt-6 lg:space-y-0 lg:pl-0 lg:[aspect-ratio:var(--cl-ar)] ${anim ? 'cl-anim' : ''}`}
          style={{ '--cl-ar': `${VB_W} / ${VB_H}` }}
        >
          {/* Phone road */}
          <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 lg:hidden" width="56" height={listH} viewBox={`0 0 56 ${listH || 1}`}>
            <Road d={mobileD(listH)} width={20} refs={paved} />
          </svg>
          {/* Desktop switchback road */}
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Road d={DESKTOP_D} width={ROAD_W} refs={paved} />
          </svg>

          {STOPS.map((s, i) => (
            <li
              key={s.r?.version || s.kind}
              className="cl-stop flex lg:absolute lg:-translate-x-1/2 lg:-translate-y-full lg:justify-center"
              style={{ left: `${(stopX(i) / VB_W) * 100}%`, top: `${((legY(i) - ROAD_W / 2 - 6) / VB_H) * 100}%` }}
            >
              {s.kind === 'release' && <Sign r={s.r} />}
              {s.kind === 'ahead' && (
                <span className="cl-marker">
                  <Milestone size={20} strokeWidth={2} aria-hidden="true" /> Road ahead · more stops coming
                </span>
              )}
              {s.kind === 'start' && (
                <span className="cl-marker cl-marker--start">
                  <Flag size={20} strokeWidth={2} aria-hidden="true" /> Start of the road
                </span>
              )}
            </li>
          ))}
        </ol>

        {/* Footer CTA */}
        <div className="mx-auto mt-16 max-w-3xl rounded-2xl bg-blush px-6 py-10 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-maroon sm:text-3xl">
            Want all of this for your bookings?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">
            Set up your page, sync your calendar and start getting paid — at 0% commission.
          </p>
          <Link to="/become-a-host" className="mt-btn mt-5 hover:no-underline">
            Become a host
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Changelog;
