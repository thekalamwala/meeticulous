import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CheckCircle2 } from "lucide-react";
import { hero, heroMock, ROUTE_START } from "./aboutContent";

// Static H1 (no typewriter): the About hero has to state what Meeticulous is in
// the first line, for people and crawlers alike — an animated word swap made the
// heading's text change over time and never named the product.

function BookingMock() {
  const m = heroMock;
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm">
      <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(26,26,26,0.35)]">
        <div className="flex items-center gap-2 text-xs font-medium text-ink/50">
          <CalendarCheck className="h-4 w-4 text-primary" />
          {m.host}
        </div>
        <div className="mt-4 font-heading text-lg font-bold">{m.service}</div>
        <div className="mt-1 flex items-center justify-between text-sm text-ink/60">
          <span>{m.meta}</span>
          <span className="font-heading font-bold text-ink">{m.price}</span>
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">Tomorrow</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {m.slots.map((s, i) => (
            <span
              key={s}
              className={`rounded-[5px] border px-3 py-2 text-center text-sm font-medium ${
                i === m.activeSlot ? "border-primary bg-primary text-white" : "border-black/10 text-ink/70"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-[6px] bg-ink px-4 py-3 text-center text-sm font-semibold text-white">{m.cta}</div>
      </div>
      {m.toasts.map((t, i) => (
        <div
          key={t.label}
          className={`absolute flex items-center gap-2 rounded-[6px] border border-black/5 bg-white px-3 py-2 text-xs shadow-[0_8px_30px_rgba(26,26,26,0.08)] ${
            i === 0 ? "-left-2 top-10 sm:-left-10" : "-right-2 bottom-16 sm:-right-8"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-[var(--c-emerald)]" />
          <span className="text-ink/60">{t.label}</span>
          <span className="font-semibold text-ink">{t.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function HeroV2() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 lg:pb-24 lg:pt-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(55% 50% at 30% 30%, #FBE3E8 0%, transparent 70%)" }} />
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{hero.eyebrow}</p>
          <h1 className="mt-4 font-heading font-extrabold leading-[1.08] text-[clamp(2.4rem,5.5vw,4rem)]">
            {hero.title} <span className="text-primary-cta">{hero.titleAccent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to={ROUTE_START}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-ink px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,26,26,0.12)] hover:no-underline hover:opacity-90"
            >
              {hero.ctaPrimary}
              <ArrowRight size={16} />
            </Link>
            <Link
              to={hero.ctaGhostHref}
              className="inline-flex items-center justify-center rounded-[6px] border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:no-underline hover:opacity-90"
            >
              {hero.ctaGhost}
            </Link>
          </div>
        </div>
        <BookingMock />
      </div>
    </section>
  );
}
