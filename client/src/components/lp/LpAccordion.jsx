import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CtaButton } from "./LpKit";
import { CAPABILITIES } from "./lpData";

/* Left mockup card — re-renders whenever the open capability changes. */
function Preview({ item }) {
  const { preview } = item;
  const accent = `var(--${preview.accent})`;
  return (
    <div
      key={preview.title}
      className="lp-fade grid place-items-center rounded-[8px] p-8 sm:p-12"
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, white)` }}
    >
      <div className="w-full max-w-xs overflow-hidden rounded-[6px] bg-white shadow-[0_20px_60px_-25px_rgba(26,26,26,0.4)]">
        <div className="h-24" style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, white))` }} />
        <div className="p-5">
          <h4 className="font-heading text-lg font-bold text-ink">{preview.title}</h4>
          <p className="mt-1 text-sm text-neutral-500">{preview.meta}</p>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-lg font-extrabold text-ink">{preview.price}</span>
            <span className="rounded-[6px] bg-ink px-4 py-2 text-sm font-semibold text-white">Book</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LpAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <section className="bg-canvas px-5 py-24 sm:px-8">
      <style>{`
        @keyframes lpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .lp-fade { animation: lpFade .35s ease both; }
        @media (prefers-reduced-motion: reduce) { .lp-fade { animation: none; } }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
          One link. Every way you get paid.
        </h2>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          {/* Left preview */}
          <Preview item={CAPABILITIES[open]} />

          {/* Right accordion */}
          <div>
            <ul className="divide-y divide-black/10 border-y border-black/10">
              {CAPABILITIES.map((c, i) => {
                const active = open === i;
                return (
                  <li key={c.title}>
                    <button
                      type="button"
                      aria-expanded={active}
                      onClick={() => setOpen(i)}
                      className="flex w-full items-center gap-4 py-5 text-left"
                    >
                      <span className={`font-heading text-sm font-bold ${active ? "text-primary" : "text-neutral-400"}`}>
                        0{i + 1}
                      </span>
                      <span className={`flex-1 text-lg font-bold ${active ? "text-ink" : "text-neutral-700"}`}>
                        {c.title}
                      </span>
                      <ChevronDown
                        size={20}
                        className={`text-primary transition-transform duration-300 ${active ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className="grid transition-all duration-300 ease-out"
                      style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-5 pl-9 pr-4 text-[15px] leading-relaxed text-neutral-600">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8">
              <CtaButton slot="accordion" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
