import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1];

/* "Who it's for" carousel — the active audience sits centred (white, full
   opacity, "Learn more"), its neighbours sit faded on either side, and the
   round arrows (or a swipe) rotate through them.
   Cards move with transforms only (x / scale / opacity), one move at a time.
   Each `audience`: { key, icon, title, desc, who:[{label,href?}], points:[], color, learnMore }. */

/* Top vignette — a small UI-style card built only from real labels (who it's
   for + what they get), on the audience's tint. */
const Vignette = ({ a, on }) => (
  <div
    className="relative overflow-hidden rounded-[10px] p-5 sm:p-6"
    style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${a.color} 8%, white), color-mix(in srgb, ${a.color} 22%, white))` }}
  >
    <div className="rounded-[6px] bg-white p-4 shadow-[0_18px_40px_-24px_rgba(26,26,26,0.35)]">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${a.color} 14%, white)`, color: a.color }}
        >
          <a.icon size={17} />
        </span>
        <p className="font-heading text-sm font-bold text-ink">Built for {a.title.toLowerCase()}</p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {a.who.map((w) => (
          <li key={w.label} className="rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
            {w.label}
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
        {a.points.map((p) => (
          <li key={p} className="flex items-center gap-2 text-[12px] text-ink">
            <Check size={13} className="flex-shrink-0" style={{ color: a.color }} />
            {p}
          </li>
        ))}
      </ul>
    </div>
    {/* "Book" pill — echoes the reference's floating action button */}
    <span
      aria-hidden
      className={`absolute bottom-3 right-4 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] transition-opacity ${on ? "opacity-100" : "opacity-70"}`}
      style={{ backgroundColor: a.color }}
    >
      Book a session
    </span>
  </div>
);

const DUR = 0.55; // seconds — card glide

export default function AudienceCarousel({ audiences }) {
  const reduce = useReducedMotion();
  const n = audiences.length;
  const [active, setActive] = useState(0);
  const busyRef = useRef(false);
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const [geo, setGeo] = useState({ stageW: 0, cardW: 0 });

  // Measure the stage + one card (offsetWidth ignores transforms) so the side
  // slots sit just outside the centre card at every breakpoint.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setGeo({ stageW: el.clientWidth, cardW: cardRef.current?.offsetWidth || 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One move at a time: ignore clicks while a glide is in flight.
  const go = (d) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setActive((a) => (a + d + n) % n);
    window.setTimeout(() => { busyRef.current = false; }, reduce ? 0 : DUR * 1000);
  };

  const wide = geo.stageW >= 768; // md+: side cards peek; below: off-stage
  const sideX = wide ? geo.cardW * 0.95 + 32 : geo.stageW + 24;

  // Swipe (touch / pen / mouse drag)
  const swipe = useRef(null);
  const onPointerDown = (e) => { swipe.current = e.clientX; };
  const onPointerUp = (e) => {
    if (swipe.current == null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Who Meeticulous is for"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
    >
      {/* Stage: every card shares one grid cell (height = tallest card) and is
          moved into its slot with transforms only — the centre card glides in,
          the outgoing one eases to the side. */}
      <div
        ref={stageRef}
        className="relative mx-auto grid max-w-6xl touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null; }}
      >
        {audiences.map((a, i) => {
          let off = (i - active + n) % n; // 0 = centre, 1 = right, n-1 = left
          if (off > n / 2) off -= n;
          const on = off === 0;
          return (
            <motion.article
              key={a.key}
              ref={i === 0 ? cardRef : undefined}
              initial={false}
              animate={{
                x: off * sideX,
                scale: on ? 1 : 0.9,
                opacity: on ? 1 : wide ? 0.6 : 0,
              }}
              transition={reduce ? { duration: 0 } : { duration: DUR, ease: EASE }}
              style={{ zIndex: on ? 20 : 10, gridArea: "1 / 1" }}
              onClick={() => !on && go(off)}
              aria-hidden={!on}
              className={`w-full max-w-[26rem] justify-self-center rounded-[10px] bg-white p-4 text-center will-change-transform sm:p-5 lg:max-w-[28rem] lg:py-7 ${
                on
                  ? "border border-black/5 shadow-[0_30px_70px_-30px_rgba(61,5,20,0.35)]"
                  : "cursor-pointer border border-black/10 shadow-[0_8px_30px_rgba(26,26,26,0.04)]"
              }`}
            >
              <Vignette a={a} on={on} />
              <h3 className={`mt-6 font-heading text-3xl font-bold tracking-tight ${on ? "text-ink" : "text-ink/70"}`}>{a.title}</h3>
              <p className={`mx-auto mt-3 max-w-sm text-base leading-relaxed ${on ? "text-ink" : "text-neutral-600"}`}>{a.desc}</p>
              {/* Rendered on every card (keeps heights equal); only the centre one is visible/focusable */}
              <Link
                to={a.learnMore}
                tabIndex={on ? 0 : -1}
                className={`mt-5 inline-block border-b-2 border-primary pb-0.5 text-sm font-semibold text-ink hover:text-primary-cta hover:no-underline ${on ? "" : "invisible"}`}
              >
                Learn more
              </Link>
            </motion.article>
          );
        })}
      </div>

      {/* Arrows — floating at the sides on md+ */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous audience"
        className="absolute left-0 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-ink shadow-[0_10px_30px_-12px_rgba(26,26,26,0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14 md:flex lg:left-2"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next audience"
        className="absolute right-0 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-ink shadow-[0_10px_30px_-12px_rgba(26,26,26,0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14 md:flex lg:right-2"
      >
        <ChevronRight size={24} />
      </button>

      {/* Mobile arrows under the card */}
      <div className="mt-8 flex items-center justify-center gap-4 md:hidden">
        <button type="button" onClick={() => go(-1)} aria-label="Previous audience" className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink shadow-[0_8px_24px_-12px_rgba(26,26,26,0.35)]">
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next audience" className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink shadow-[0_8px_24px_-12px_rgba(26,26,26,0.35)]">
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{audiences[active].title}</p>
    </div>
  );
}
