import { CtaButton, Avatar } from "./LpKit";
import { HERO_COL_A, HERO_COL_B, PRICE_LINE } from "./lpData";
import { PREMIUM_PLAN } from "../../data/plans";

/* One floating creator card (Topmate-style: duotone photo + name/role). */
function FloatCard({ p }) {
  const accent = `var(--${p.accent})`;
  return (
    <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_18px_50px_-24px_rgba(26,26,26,0.3)]">
      <div className="relative aspect-[5/4]" style={{ backgroundColor: accent }}>
        <Avatar
          src={p.img}
          name={p.name}
          className="h-full w-full rounded-[4px] object-cover mix-blend-luminosity opacity-90"
        />
        <div className="pointer-events-none absolute inset-0 mix-blend-color opacity-60" style={{ backgroundColor: accent }} />
      </div>
      <div className="px-4 py-3">
        <div className="font-heading text-[15px] font-bold text-ink">{p.name}</div>
        <div className="text-[13px] text-neutral-500">{p.tagline}</div>
      </div>
    </div>
  );
}

/* A vertical marquee column. dir: "up" | "down". List duplicated for seamless loop. */
function MarqueeCol({ items, dir }) {
  const doubled = [...items, ...items];
  return (
    <div className="lp-marquee-mask h-full overflow-hidden">
      <div className={`flex flex-col gap-5 ${dir === "up" ? "lp-scroll-up" : "lp-scroll-down"}`}>
        {doubled.map((p, i) => (
          <FloatCard key={`${p.name}-${i}`} p={p} />
        ))}
      </div>
    </div>
  );
}

export default function LpHero() {
  return (
    <section className="relative overflow-hidden bg-[#fde7da] px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
      <style>{`
        @keyframes lpUp   { from { transform: translateY(0); }     to { transform: translateY(-50%); } }
        @keyframes lpDown { from { transform: translateY(-50%); }  to { transform: translateY(0); } }
        .lp-scroll-up   { animation: lpUp   28s linear infinite; }
        .lp-scroll-down { animation: lpDown 28s linear infinite; }
        .lp-marquee-mask { -webkit-mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent);
                                   mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent); }
        @media (prefers-reduced-motion: reduce) {
          .lp-scroll-up, .lp-scroll-down { animation: none; }
        }
      `}</style>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ── Left: copy + CTA ── */}
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-black/5 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-neutral-700 backdrop-blur">
            The Topmate alternative · Built for India
          </span>

          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-[3.4rem] lg:text-[4rem]">
            The Topmate alternative
            <br />
            with <span className="text-primary">0% commission</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-neutral-700 lg:mx-0">
            Meeticulous is a booking page for Indian creators and consultants. Clients pay by
            UPI or card when they book, every paid booking gets a GST invoice, and{" "}
            <strong className="text-ink">{PREMIUM_PLAN.name} takes 0% commission</strong> for a flat{" "}
            {PRICE_LINE}. Topmate takes 10% of each sale.
          </p>

          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row lg:items-center">
            <CtaButton slot="hero" />
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="inline-flex items-center justify-center rounded-[4px] border border-black/5 bg-white/70 px-3 py-1 font-medium text-neutral-700">
                0% commission · {PRICE_LINE}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: two opposing marquee columns ── */}
        <div className="relative hidden h-[30rem] grid-cols-2 gap-5 sm:grid">
          <MarqueeCol items={HERO_COL_A} dir="up" />
          <MarqueeCol items={HERO_COL_B} dir="down" />
        </div>
      </div>
    </section>
  );
}
