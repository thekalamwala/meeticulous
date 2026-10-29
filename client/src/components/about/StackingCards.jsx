import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { gsap, useGSAP, EASE } from "./gsapSetup";
import { stackCards, ROUTE_START } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

const ACCENTS = ["var(--c-blue)", "var(--c-emerald)", "var(--c-violet)", "var(--c-amber)"];

export default function StackingCards() {
  const root = useRef(null);
  const [openIdx, setOpenIdx] = useState(null);
  const toggle = (i) => setOpenIdx((cur) => (cur === i ? null : i));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".js-head", {
          opacity: 0, y: 28, duration: 0.8, ease: EASE,
          scrollTrigger: { trigger: root.current, start: "top 82%" },
        });
      });
    },
    { scope: root }
  );

  return (
    <section id="about-how" ref={root} className="px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">How it works</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{stackCards.heading}</h2>

        <div className="mt-10 overflow-hidden rounded-[16px] bg-ink p-8 text-white sm:p-12" data-swap={stackCards.feature.swap}>
          <h3 className="font-heading text-2xl font-bold text-white sm:text-3xl">{stackCards.feature.title}</h3>
          <p className="mt-3 max-w-xl text-white/70">{stackCards.feature.body}</p>
        </div>

        <div className="mt-10">
          {stackCards.cards.slice(0, 3).map((c, i) => {
            const open = openIdx === i;
            return (
              <div key={i} className="sticky" style={{ top: `${6 + i * 1.5}rem` }}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(i); } }}
                  className="relative mb-6 cursor-pointer overflow-hidden rounded-[16px] border border-ink/10 bg-surface p-8 shadow-[0_20px_45px_-25px_rgba(26,26,26,0.4)]"
                  style={{ borderTopColor: ACCENTS[i], borderTopWidth: 3 }}
                >
                  <div className="h-[200px] overflow-hidden rounded-[10px] bg-sand sm:h-[260px] lg:h-[310px]" data-swap={c.swap}>
                    <ImgWithSkeleton src={c.image} alt={c.title} fallbackLabel={c.title} />
                  </div>
                  <h3 className="mt-5 font-heading text-xl font-bold">{c.title}</h3>
                  <p className="mt-2 text-ink/70">{c.body}</p>

                  <div className={`absolute inset-x-0 bottom-0 rounded-t-[16px] bg-ink p-8 text-white transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}>
                    <p className="text-sm text-white/80">{c.more}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link to={ROUTE_START} onClick={(e) => e.stopPropagation()} className="btn inline-flex items-center gap-1.5 bg-primary px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary-dark">
                        {c.ctaPrimary} <ArrowRight size={14} />
                      </Link>
                      <Link to={ROUTE_START} onClick={(e) => e.stopPropagation()} className="btn btn--outline inline-flex items-center px-5 py-2.5 text-sm text-white">
                        {c.ctaSecondary}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
