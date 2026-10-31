import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { gsap, useGSAP, EASE } from "./gsapSetup";
import { faq } from "./aboutContent";

export default function FaqAccordion() {
  const root = useRef(null);
  const [open, setOpen] = useState(-1);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".js-head", {
          opacity: 0,
          y: 28,
          duration: 0.8,
          ease: EASE,
          scrollTrigger: { trigger: root.current, start: "top 82%" },
        });
        gsap.from(".js-row", {
          opacity: 0,
          y: 24,
          duration: 0.6,
          ease: EASE,
          stagger: 0.08,
          scrollTrigger: { trigger: ".js-list", start: "top 80%" },
        });
      });
    },
    { scope: root }
  );

  return (
    // Bright section (owner request 2026-10-31) — was a dark bg-ink band.
    <section ref={root} className="bg-white px-5 py-12 text-ink sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        {/* Heading spans the full width, centred; the Q&A list stays a readable column */}
        <h2 className="js-head text-center font-heading text-3xl font-bold text-ink sm:text-4xl">{faq.heading}</h2>
        <p className="mt-4 text-center text-lg leading-relaxed text-ink/70">{faq.sub}</p>
        <div className="js-list mx-auto mt-8 max-w-3xl divide-y divide-black/10 border-y border-black/10">
          {faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="js-row">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-heading text-lg font-semibold">{item.q}</span>
                  <Plus className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} />
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <p className="overflow-hidden text-ink/70">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
