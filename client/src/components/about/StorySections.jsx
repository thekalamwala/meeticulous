import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Tag, Wallet, MessageCircle, FileText, CalendarSync, Scale } from "lucide-react";
import useGsapReveal from "./useGsapReveal";
import ProblemCompare from "./ProblemCompare";
import { problem, mission, difference, finalCta, ROUTE_START } from "./aboutContent";

// The About page's narrative sections, in reading order:
// problem (why we built it) → mission → how we're different → final CTA.

export function ProblemSection() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    // lg+: sized to fit one screen under the 57px navbar (copy + both cards
    // visible at once, down to a 1280×720 screen), content centred vertically.
    // mt-*: breathing room between the hero (its photo runs to the hero's bottom
    // edge) and this section.
    // id="our-story": target of the About hero's "More about us" button.
    <section ref={root} id="our-story" className="mt-6 scroll-mt-16 overflow-hidden px-5 py-20 sm:px-8 lg:mt-16 lg:flex lg:min-h-[calc(100svh-57px)] lg:items-center lg:py-4">
      {/* Split (lg+): heading + intro on the left, the before/after cards on the
          right (owner request — keep this split, not a centred stack). */}
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[2fr_3fr] lg:gap-12">
        <div>
          <h2 className="js-head font-heading text-4xl font-extrabold sm:text-5xl">{problem.heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">{problem.intro}</p>
        </div>
        <ProblemCompare />
      </div>
    </section>
  );
}

export function MissionBand() {
  return (
    <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-heading text-3xl font-bold leading-snug text-white sm:text-4xl">{mission.statement}</p>
      </div>
    </section>
  );
}

const DIFF_ICONS = [Tag, Wallet, MessageCircle, FileText, CalendarSync, Scale];

// One accent per card, from the brand palette (crimson + the --c-* tokens).
// Written out in full so Tailwind generates every class. Resting card: white
// with a light tinted icon tile; on hover it becomes the "featured" card —
// tinted background, accent border, deeper shadow, solid tile + white icon.
const DIFF_ACCENTS = [
  { tile: "bg-primary/10 text-primary group-hover:bg-primary", card: "hover:border-primary/40 hover:bg-primary/[0.06]" },
  { tile: "bg-c-blue/10 text-c-blue group-hover:bg-c-blue", card: "hover:border-c-blue/40 hover:bg-c-blue/[0.06]" },
  { tile: "bg-c-violet/10 text-c-violet group-hover:bg-c-violet", card: "hover:border-c-violet/40 hover:bg-c-violet/[0.06]" },
  { tile: "bg-c-emerald/10 text-c-emerald group-hover:bg-c-emerald", card: "hover:border-c-emerald/40 hover:bg-c-emerald/[0.06]" },
  { tile: "bg-c-amber/10 text-c-amber group-hover:bg-c-amber", card: "hover:border-c-amber/40 hover:bg-c-amber/[0.06]" },
  { tile: "bg-c-pink/10 text-c-pink group-hover:bg-c-pink", card: "hover:border-c-pink/40 hover:bg-c-pink/[0.06]" },
];

export function DifferenceSection() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="bg-white px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Header: full width, centred, with a quiet text link underneath */}
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-full">
            <h2 className="js-head font-heading text-4xl font-extrabold sm:text-5xl">{difference.heading}</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink/70">{difference.sub}</p>
          </div>
          <Link
            to="/pricing"
            className="group inline-flex flex-shrink-0 items-center gap-1.5 text-base font-semibold text-primary-cta hover:no-underline"
          >
            See plans &amp; pricing
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {difference.items.map((d, i) => {
            const Icon = DIFF_ICONS[i % DIFF_ICONS.length];
            const accent = DIFF_ACCENTS[i % DIFF_ACCENTS.length];
            return (
              <div
                key={d.title}
                // Transition colour/border/shadow ONLY: the GSAP reveal animates this
                // card's opacity + transform, and a CSS transition on those makes
                // gsap.from capture a mid-fade value (cards stuck invisible).
                className={`js-item group rounded-[6px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-[background-color,border-color,box-shadow] duration-300 hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)] sm:p-8 ${accent.card}`}
              >
                <span
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-[6px] transition-colors duration-300 group-hover:text-white ${accent.tile}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-6 font-heading text-xl font-bold text-ink">{d.title}</h3>
                <p className="mt-3 leading-relaxed text-ink/60">{d.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl rounded-[10px] bg-ink px-6 py-14 text-center text-white sm:px-12">
        <h2 className="font-heading text-4xl font-extrabold text-white sm:text-5xl">{finalCta.heading}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">{finalCta.sub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTE_START}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-cta px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
          >
            {finalCta.ctaPrimary}
            <ArrowRight size={16} />
          </Link>
          <Link
            to={finalCta.ctaSecondaryHref}
            className="inline-flex items-center rounded-[6px] border border-white/10 px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
          >
            {finalCta.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
