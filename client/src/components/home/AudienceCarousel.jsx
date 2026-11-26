import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Play } from "lucide-react";

/* "Who it's for" — Calendly-style carousel: the current audience is a big card
   in the centre (horizontal on wide screens), the others sit at the edges as
   narrow, shorter tinted cards. Click a side card, swipe/drag, the arrows or
   arrow keys to switch. The blocks stay put; their content push-slides: the
   old content travels out one side while the new one travels in from the other,
   in sync, with no fade (instant under prefers-reduced-motion).
   Each `audience`: { key, icon, title, desc, who:[{label,href?}], points:[], color, learnMore }. */

/* Top vignette — a small UI-style card built only from real labels (who it's
   for + what they get), on the audience's tint. */
const Vignette = ({ a }) => (
  <div
    className="relative overflow-hidden rounded-[24px] p-2.5 sm:p-6"
    style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${a.color} 8%, white), color-mix(in srgb, ${a.color} 22%, white))` }}
  >
    <div className="rounded-[24px] bg-white p-3 shadow-[var(--shadow-md)] sm:p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: `color-mix(in srgb, ${a.color} 14%, white)`, color: a.color }}
        >
          <a.icon size={17} />
        </span>
        <p className="font-heading text-lg font-bold leading-tight text-ink sm:text-sm">Built for {a.title.toLowerCase()}</p>
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
  </div>
);


// Push-slide: content enters from the side it is travelling from and leaves out
// the other, both at once (no opacity, no "wait" gap). d: 1 = forward.
const PUSH = {
  enter: (d) => ({ x: `${100 * d}%` }),
  show: { x: "0%" },
  leave: (d) => ({ x: `${-100 * d}%` }),
};
const EASE = [0.32, 0.72, 0, 1]; // fast out, soft landing

// Card body — identical markup for the measurer and the live card.
const Body = ({ a, wide }) => (
  <div className={wide ? "grid grid-cols-[0.95fr_1.05fr] items-center gap-8 p-6" : "p-2.5 text-left sm:p-5 sm:text-center"}>
    <Vignette a={a} />
    <div className={wide ? "pr-4 text-left" : "max-sm:px-1.5 max-sm:pb-1.5"}>
      <h3 className={`font-heading text-xl font-bold tracking-tight text-ink sm:text-3xl ${wide ? "" : "mt-3 sm:mt-6"}`}>{a.title}</h3>
      <p className={`mt-2 text-sm leading-relaxed text-ink sm:mt-3 sm:text-base ${wide ? "" : "mx-auto max-w-sm"}`}>{a.desc}</p>
      <Link
        to={a.learnMore}
        aria-label={`Learn more about Meeticulous for ${a.title.toLowerCase()}`}
        className="relative mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--audience-color)] px-4 py-1.5 text-xs font-semibold text-white hover:text-white hover:no-underline max-md:!min-h-0 max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-2 max-sm:mx-auto max-sm:flex max-sm:w-fit sm:mt-5"
        style={{ "--audience-color": a.color }}
      >
        Learn more <Play size={12} fill="currentColor" aria-hidden />
      </Link>
    </div>
  </div>
);

export default function AudienceCarousel({ audiences }) {
  const reduce = useReducedMotion();
  const n = audiences.length;
  const [active, setActive] = useState(0);
  const stageRef = useRef(null);
  const measureRefs = useRef([]);
  const [stageW, setStageW] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [measuredW, setMeasuredW] = useState(-1); // centre width contentH was measured at

  // dir: 1 = forward (content slides out left, in from the right), -1 = back.
  const [dir, setDir] = useState(1);
  const go = (d) => { setDir(d < 0 ? -1 : 1); setActive((a) => (a + d + n) % n); };

  // Geometry (Calendly-style): a big centre card, then on each side a narrow
  // card (±1) and a thinner, shorter one further out (±2); anything further is
  // parked off-stage, invisible. Widths come from the stage; the height is the
  // tallest card content at the centre width, so the stage never jumps.
  const big = stageW >= 640;
  const sideW = big ? 80 : 22;
  const outerW = big ? 44 : 10;
  const gap = big ? 16 : 6;
  const centreW = mobile
    ? Math.round(stageW * 0.84)
    : Math.max(0, Math.min(stageW - 2 * (sideW + outerW + 2 * gap), 820));
  const wide = centreW >= 600; // centre card goes horizontal (panel | text)
  const centreH = contentH;
  const sideH = Math.round(centreH * 0.66);
  const outerH = Math.round(centreH * 0.42);

  // Measure before paint: setting the stage height after paint would flash a
  // collapsed (0-height) stage on first render and shove the page down (CLS).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const breakpoint = window.matchMedia("(min-width: 640px)");
    const measure = () => {
      setStageW(el.clientWidth);
      setMobile(!breakpoint.matches);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    breakpoint.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      breakpoint.removeEventListener("change", measure);
    };
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      const hs = measureRefs.current.map((m) => m?.offsetHeight || 0);
      setContentH(Math.max(0, ...hs) + (mobile ? 4 : 0));
      setMeasuredW(centreW);
    };
    measure();
    const ro = new ResizeObserver(measure);
    measureRefs.current.forEach((el) => { if (el) ro.observe(el); });
    return () => ro.disconnect();
  }, [centreW, wide, mobile, audiences]);

  // Simple swipe / drag: 40px+ horizontal moves one card.
  const startX = useRef(null);
  const onPointerDown = (e) => { startX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  const centreLeft = (stageW - centreW) / 2;
  const slot = (off) => {
    if (off === 0) return { left: centreLeft, width: centreW, height: centreH, opacity: 1 };
    if (mobile) {
      const outer = Math.abs(off) === 2;
      return {
        left: centreLeft + Math.sign(off) * stageW * (outer ? 0.065 : 0.045),
        width: centreW,
        height: centreH * (outer ? 0.66 : 0.8),
        top: outer ? "61%" : "54%",
        transform: `translateY(-50%) rotate(${Math.sign(off) * (outer ? 14 : 8)}deg)`,
        opacity: Math.abs(off) <= 2 ? 1 : 0,
      };
    }
    const dir = Math.sign(off);
    const nearL = dir < 0 ? centreLeft - gap - sideW : centreLeft + centreW + gap;
    if (Math.abs(off) === 1) return { left: nearL, width: sideW, height: sideH, opacity: 1 };
    const outerL = dir < 0 ? nearL - gap - outerW : nearL + sideW + gap;
    if (Math.abs(off) === 2) return { left: outerL, width: outerW, height: outerH, opacity: 1 };
    // parked beyond the outer slot, hidden
    return { left: dir < 0 ? outerL - outerW : outerL + outerW, width: outerW, height: outerH, opacity: 0 };
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Who Meeticulous is for"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
    >
      {/* Off-screen measurer: each card body at the centre width, to size the stage */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 -z-10" style={{ width: centreW }}>
        {audiences.map((a, i) => (
          <div key={a.key} ref={(el) => { measureRefs.current[i] = el; }}>
            <Body a={a} wide={wide} />
          </div>
        ))}
      </div>

      <div
        ref={stageRef}
        className="relative w-full touch-pan-y select-none"
        style={{ height: centreH || undefined }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startX.current = null; }}
      >
        {stageW > 0 && contentH > 0 && measuredW === centreW &&
          audiences.map((_, i) => {
            let off = (i - active + n) % n; // 0 centre, 1 right, n-1 left
            if (off > n / 2) off -= n;
            return off;
          }).sort((x, y) => x - y).map((off) => {
            // Slots are keyed by position, not audience: the blocks never move or
            // resize — switching only swaps (and fades) what each slot shows.
            const a = audiences[(active + off + n) % n];
            const on = off === 0;
            return (
              <article
                key={`slot-${off}`}
                style={{
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...slot(off),
                  "--audience-color": a.color,
                  zIndex: on ? 3 : Math.abs(off) === 1 ? 2 : 1,
                  pointerEvents: Math.abs(off) > 2 ? "none" : undefined,
                }}
                onClick={() => !on && go(off)}
                aria-hidden={!on}
                className={`absolute overflow-hidden rounded-[24px] border-2 ${
                  on
                    ? "border-neutral-200 bg-white shadow-[var(--shadow-md)] max-sm:border-ink/75"
                    : "cursor-pointer border-neutral-200 bg-white max-sm:border-[color-mix(in_srgb,var(--audience-color)_45%,white)] max-sm:bg-white/60 max-sm:shadow-[0_4px_12px_rgba(26,26,26,0.06)] max-sm:backdrop-blur-[1px]"
                }`}
              >
                {on ? (
                  // Centre card: the new audience pushes the old one out.
                  <AnimatePresence initial={false} custom={dir}>
                    <motion.div
                      key={a.key}
                      custom={dir}
                      variants={PUSH}
                      initial={reduce ? false : "enter"}
                      animate="show"
                      exit={reduce ? undefined : "leave"}
                      transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}
                      className="absolute inset-y-0 left-0 bg-white"
                      style={{ width: centreW }}
                    >
                      <Body a={a} wide={wide} />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  // Side card: tint and preview push-slide together, same direction
                  // and timing as the centre card.
                  <AnimatePresence initial={false} custom={dir}>
                    <motion.div
                      key={a.key}
                      custom={dir}
                      variants={PUSH}
                      initial={reduce ? false : "enter"}
                      animate="show"
                      exit={reduce ? undefined : "leave"}
                      transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        color: a.color,
                        background: mobile
                          ? `linear-gradient(150deg, rgb(255 255 255 / 55%), color-mix(in srgb, ${a.color} 23%, transparent))`
                          : `linear-gradient(150deg, color-mix(in srgb, ${a.color} 10%, white), color-mix(in srgb, ${a.color} 26%, white))`,
                      }}
                    >
                      {mobile ? (
                        <div
                          className={`pointer-events-none absolute top-5 w-1/2 space-y-2 text-[11px] leading-snug opacity-25 blur-[0.6px] ${
                            off < 0 ? "left-2 text-left" : "right-2 text-right"
                          }`}
                        >
                          <p className="font-heading text-sm font-bold">{a.title}</p>
                          <ul className="space-y-2 border-t border-current/20 pt-2">
                            {a.points.map((point) => <li key={point}>{point}</li>)}
                          </ul>
                        </div>
                      ) : (
                        <a.icon size={Math.abs(off) === 1 ? (big ? 24 : 14) : big ? 18 : 10} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </article>
            );
          })}
      </div>

      <div className="mt-4 flex justify-center sm:hidden">
        {audiences.map((a, i) => (
          <button
            key={a.key}
            type="button"
            aria-label={`Show ${a.title}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => i !== active && go(i - active)}
            className="grid h-11 w-11 place-items-center rounded-full"
          >
            <span className={`h-3 w-3 rounded-full border border-ink/60 ${i === active ? "bg-ink/75" : "bg-white"}`} />
          </button>
        ))}
      </div>
      <div className="mt-8 hidden items-center justify-center gap-4 sm:flex">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous audience"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next audience"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{audiences[active].title}</p>
    </div>
  );
}
