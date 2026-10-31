import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

/* "Who it's for" — Calendly-style carousel: the current audience is a big card
   in the centre (horizontal on wide screens), the others sit at the edges as
   narrow, shorter tinted cards. Click a side card, swipe/drag, the arrows or
   arrow keys to switch. The blocks stay put — only the content inside them
   swaps, with a soft fade (instant under prefers-reduced-motion).
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
      className={`absolute bottom-3 right-4 rounded-full px-4 py-1.5 text-xs font-semibold text-white ${on ? "opacity-100" : "opacity-70"}`}
      style={{ backgroundColor: a.color }}
    >
      Book a session
    </span>
  </div>
);


export default function AudienceCarousel({ audiences }) {
  const reduce = useReducedMotion();
  const n = audiences.length;
  const [active, setActive] = useState(0);
  const stageRef = useRef(null);
  const measureRefs = useRef([]);
  const [stageW, setStageW] = useState(0);
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
  const centreW = Math.max(0, Math.min(stageW - 2 * (sideW + outerW + 2 * gap), 820));
  const wide = centreW >= 600; // centre card goes horizontal (panel | text)
  const centreH = contentH;
  const sideH = Math.round(centreH * 0.66);
  const outerH = Math.round(centreH * 0.42);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const hs = measureRefs.current.map((m) => m?.offsetHeight || 0);
    setContentH(Math.max(0, ...hs));
    setMeasuredW(centreW);
  }, [centreW, wide, audiences]);

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
    const dir = Math.sign(off);
    const nearL = dir < 0 ? centreLeft - gap - sideW : centreLeft + centreW + gap;
    if (Math.abs(off) === 1) return { left: nearL, width: sideW, height: sideH, opacity: 1 };
    const outerL = dir < 0 ? nearL - gap - outerW : nearL + sideW + gap;
    if (Math.abs(off) === 2) return { left: outerL, width: outerW, height: outerH, opacity: 1 };
    // parked beyond the outer slot, hidden
    return { left: dir < 0 ? outerL - outerW : outerL + outerW, width: outerW, height: outerH, opacity: 0 };
  };

  // Card body — identical markup for the measurer and the live card.
  const Body = ({ a }) => (
    <div className={wide ? "grid grid-cols-[0.95fr_1.05fr] items-center gap-8 p-6" : "p-4 text-center sm:p-5"}>
      <Vignette a={a} on />
      <div className={wide ? "pr-4 text-left" : ""}>
        <h3 className={`font-heading text-3xl font-bold tracking-tight text-ink ${wide ? "" : "mt-6"}`}>{a.title}</h3>
        <p className={`mt-3 text-base leading-relaxed text-ink ${wide ? "" : "mx-auto max-w-sm"}`}>{a.desc}</p>
        <Link
          to={a.learnMore}
          className="mt-5 inline-block border-b-2 border-primary pb-0.5 text-sm font-semibold text-ink hover:text-primary-cta hover:no-underline"
        >
          Learn more
        </Link>
      </div>
    </div>
  );

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
            <Body a={a} />
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
                  ...slot(off),
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: on ? 3 : Math.abs(off) === 1 ? 2 : 1,
                  pointerEvents: Math.abs(off) > 2 ? "none" : undefined,
                }}
                onClick={() => !on && go(off)}
                aria-hidden={!on}
                className={`absolute overflow-hidden rounded-[10px] border border-black/10 bg-white ${
                  on ? "shadow-[0_30px_70px_-30px_rgba(26,26,26,0.3)]" : "cursor-pointer shadow-[0_8px_30px_rgba(26,26,26,0.06)]"
                }`}
              >
                {on ? (
                  // Centre card: old content fades out, then the new one fades up in
                  // (no hard cut between audiences).
                  <AnimatePresence mode="wait" initial={false} custom={dir}>
                    <motion.div
                      key={a.key}
                      custom={dir}
                      variants={{
                        enter: (d) => ({ opacity: 0, x: 48 * d }),
                        show: { opacity: 1, x: 0 },
                        leave: (d) => ({ opacity: 0, x: -48 * d, transition: { duration: 0.35, ease: "easeInOut" } }),
                      }}
                      initial={reduce ? false : "enter"}
                      animate="show"
                      exit={reduce ? undefined : "leave"}
                      transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeInOut" }}
                      className="h-full bg-white"
                      style={{ width: centreW }}
                    >
                      <Body a={a} />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  // Side sliver: the tint cross-fades into the next audience's
                  // (gradients can't be CSS-transitioned, so the layers fade instead),
                  // while the icon slides with the same direction + timing as the
                  // centre card's text.
                  <>
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={a.key}
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.8, ease: "easeInOut" }}
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(150deg, color-mix(in srgb, ${a.color} 10%, white), color-mix(in srgb, ${a.color} 26%, white))`,
                        }}
                      />
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                      <motion.span
                        key={a.key}
                        custom={dir}
                        variants={{
                          enter: (d) => ({ opacity: 0, x: 24 * d }),
                          show: { opacity: 1, x: 0 },
                          leave: (d) => ({ opacity: 0, x: -24 * d, transition: { duration: 0.35, ease: "easeInOut" } }),
                        }}
                        initial={reduce ? false : "enter"}
                        animate="show"
                        exit={reduce ? undefined : "leave"}
                        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeInOut" }}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: a.color }}
                      >
                        <a.icon size={Math.abs(off) === 1 ? (big ? 24 : 14) : big ? 18 : 10} />
                      </motion.span>
                    </AnimatePresence>
                  </>
                )}
              </article>
            );
          })}
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
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
