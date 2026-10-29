import { useRef } from "react";
import { useInView } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "./Reveal";

/* ════════════════════════════════════════════════════════════
   LINE-DRAW ICON wrapper — strokes draw themselves on scroll-in
   (CSS keyframe `sloth-draw` in index.css).
   ════════════════════════════════════════════════════════════ */
const LineIcon = ({ children, color = "#1E0B4D" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <svg
      ref={ref}
      viewBox="0 0 48 48"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ stroke: color }}
      className={`sloth-draw h-9 w-9 ${inView ? "is-visible" : ""}`}
    >
      {children}
    </svg>
  );
};

/* "How it works" — outcome-led pipeline (Share → Book & Pay → Focus).
   Single source of truth for the homepage AND landing pages, so the
   three-step story never drifts between surfaces. Renders on a dark
   surface (white text / glass cards). */
export const STEPS = [
  {
    title: "Share one link",
    desc: "Your services, availability and pricing — all in one SlothPage. Send it once, let it work forever.",
    chip: "Replaces 20+ DMs",
    color: "var(--c-blue)",
    draw: (
      <>
        <path d="M20 28a7 7 0 0 1 0-10l4-4a7 7 0 0 1 10 10l-2 2" />
        <path d="M28 20a7 7 0 0 1 0 10l-4 4a7 7 0 0 1-10-10l2-2" />
      </>
    ),
  },
  {
    title: "Clients book and pay upfront",
    desc: "They pick a slot and pay before the session. Money lands before you even open your calendar.",
    chip: "Paid before you show up",
    color: "var(--c-amber)",
    draw: (
      <>
        <rect x="6" y="13" width="36" height="24" rx="4" />
        <line x1="6" y1="21" x2="42" y2="21" />
        <circle cx="14" cy="29" r="2.5" />
      </>
    ),
  },
  {
    title: "Just show up",
    desc: "Reminders go out automatically. Receipts are sent. Follow-ups land. You do nothing.",
    chip: "Near-zero no-shows",
    color: "var(--c-emerald)",
    draw: (
      <>
        <path d="M8 28c6 0 6-8 12-8s6 8 12 8 8-6 8-6" />
        <circle cx="24" cy="14" r="4" />
      </>
    ),
  },
];

/**
 * The three "how it works" cards + directional arrows.
 * Caller supplies the surrounding <section>, heading and background.
 * `theme` ("dark" default | "light") flips the card / text / chevron colours so
 * the component reads on either surface — dark landing pages keep the glass
 * look; the light homepage section gets white cards on the canvas.
 */
export default function HowItWorks({ theme = "dark", lift = true }) {
  const light = theme === "light";
  return (
    <div className="relative mt-16">
      {/* Direction chevrons sitting in the gaps between cards (desktop).
          Bigger glyphs; the wider md:gap-16 grid below leaves room. */}
      <ArrowRight
        aria-hidden
        size={40}
        strokeWidth={2.25}
        className={`absolute left-1/3 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block ${light ? "text-neutral-300" : "text-white/70"}`}
      />
      <ArrowRight
        aria-hidden
        size={40}
        strokeWidth={2.25}
        className={`absolute left-2/3 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block ${light ? "text-neutral-300" : "text-white/70"}`}
      />

      <div className="grid gap-12 md:grid-cols-3 md:gap-16">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.12}>
            <div className={`group relative flex h-full flex-col items-center rounded-[6px] p-8 text-center transition-all duration-300 ${lift ? "hover:-translate-y-1.5" : ""} ${light ? "border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)] hover:shadow-[0_22px_45px_-18px_rgba(26,26,26,0.16)]" : "border border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/10 backdrop-blur-xl hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)]"}`}>
              {/* Vertical connector to the next step (mobile) */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-1/2 top-full z-20 h-12 w-px -translate-x-1/2 md:hidden ${light ? "bg-neutral-200" : "bg-white/25"}`}
                >
                  <ArrowRight
                    size={16}
                    className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rotate-90 ${light ? "bg-canvas text-neutral-400" : "bg-neutral-800 text-white/55"}`}
                  />
                </span>
              )}

              {/* Node: icon box + step number + hover glow */}
              <div className="relative inline-flex h-16 w-16 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100"
                  style={{ backgroundColor: `color-mix(in srgb, ${s.color} 45%, transparent)` }}
                />
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-10px_rgba(26,26,26,0.18)] ring-1 ring-black/5">
                  <LineIcon color={s.color}>{s.draw}</LineIcon>
                </span>
                <span
                  className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-ink"
                  style={{ backgroundColor: `color-mix(in srgb, ${s.color} 70%, white)` }}
                >
                  {i + 1}
                </span>
              </div>

              <h3 className={`mt-6 font-heading text-xl font-bold ${light ? "text-ink" : "text-white"}`}>{s.title}</h3>
              <p className={`mx-auto mt-2 max-w-xs ${light ? "text-neutral-500" : "text-neutral-200"}`}>{s.desc}</p>

              <span
                className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${s.color} 26%, transparent)`,
                  color: light ? `color-mix(in srgb, ${s.color} 55%, #1E0B4D)` : `color-mix(in srgb, ${s.color} 30%, white)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${s.color} 45%, transparent)`,
                }}
              >
                <Check size={13} />
                {s.chip}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
