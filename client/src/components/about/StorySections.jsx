import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X, Check, Tag, Wallet, MessageCircle, FileText, CalendarSync, Scale } from "lucide-react";
import useGsapReveal from "./useGsapReveal";
import { problem, mission, audiences, difference, finalCta, ROUTE_START } from "./aboutContent";

// The About page's narrative sections, in reading order:
// problem (why we built it) → mission → who it's for → how we're different → final CTA.

function Eyebrow({ children, className = "text-primary" }) {
  return <p className={`text-sm font-medium uppercase tracking-[0.2em] ${className}`}>{children}</p>;
}

export function ProblemSection() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[2fr_3fr]">
        <div>
          <Eyebrow>{problem.eyebrow}</Eyebrow>
          <h2 className="js-head mt-3 font-heading text-4xl font-extrabold sm:text-5xl">{problem.heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">{problem.intro}</p>
        </div>
        <ul className="space-y-4">
          {problem.rows.map((r) => (
            <li
              key={r.pain}
              className="js-item grid gap-3 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:grid-cols-2 sm:gap-6"
            >
              <p className="flex items-start gap-2.5 text-ink/60">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" aria-hidden="true" />
                <span><span className="sr-only">Before: </span>{r.pain}</span>
              </p>
              <p className="flex items-start gap-2.5 font-medium text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-emerald)]" aria-hidden="true" />
                <span><span className="sr-only">With Meeticulous: </span>{r.fix}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MissionBand() {
  return (
    <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <Eyebrow className="text-white/60">{mission.eyebrow}</Eyebrow>
        <p className="mt-5 font-heading text-3xl font-bold leading-snug text-white sm:text-4xl">{mission.statement}</p>
      </div>
    </section>
  );
}

export function AudienceSection() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Eyebrow>{audiences.eyebrow}</Eyebrow>
          <h2 className="js-head mt-3 font-heading text-4xl font-extrabold sm:text-5xl">{audiences.heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">{audiences.sub}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
          {audiences.groups.map((g) => (
            <article
              key={g.name}
              className="js-item rounded-[6px] border bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]"
              style={{ borderColor: `color-mix(in srgb, ${g.accent} 30%, transparent)` }}
            >
              <h3 className="font-heading text-2xl font-extrabold" style={{ color: g.accent }}>{g.name}</h3>
              <p className="mt-2 text-ink/70">{g.who}</p>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">What they sell</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {g.sells.map((s) => (
                  <li
                    key={s}
                    className="rounded-full px-3 py-1 text-sm font-medium"
                    style={{ background: `color-mix(in srgb, ${g.accent} 10%, white)`, color: "var(--ink, #191919)" }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const DIFF_ICONS = [Tag, Wallet, MessageCircle, FileText, CalendarSync, Scale];

export function DifferenceSection() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="bg-sand px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Eyebrow>{difference.eyebrow}</Eyebrow>
          <h2 className="js-head mt-3 font-heading text-4xl font-extrabold sm:text-5xl">{difference.heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">{difference.sub}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {difference.items.map((d, i) => {
            const Icon = DIFF_ICONS[i % DIFF_ICONS.length];
            return (
              <div key={d.title} className="js-item rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] bg-primary-light text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-lg font-semibold">{d.title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink/70">{d.body}</p>
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
