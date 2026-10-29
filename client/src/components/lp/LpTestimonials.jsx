import { useRef } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Avatar } from "./LpKit";
import { TESTIMONIALS } from "./lpData";

export default function LpTestimonials() {
  const trackRef = useRef(null);

  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const by = card ? card.clientWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * by, behavior: "smooth" });
  };

  return (
    <section className="bg-sand px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
            What hosts say about Meeticulous.
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous testimonials"
              className="grid h-11 w-11 place-items-center rounded-[6px] bg-white text-ink shadow-sm transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next testimonials"
              className="grid h-11 w-11 place-items-center rounded-[6px] bg-white text-ink shadow-sm transition-transform"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              data-card
              className="flex w-[20rem] flex-none snap-start flex-col rounded-[8px] border border-black/5 bg-white p-7 shadow-[0_16px_50px_-30px_rgba(26,26,26,0.4)] sm:w-[24rem]"
            >
              <Quote size={26} className="text-primary/30" />
              <blockquote className="mt-4 flex-1 text-[17px] leading-relaxed text-ink">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-black/5 pt-5">
                <Avatar src={t.avatar} name={t.name} className="h-11 w-11 rounded-[6px]" />
                <div>
                  <div className="font-heading text-sm font-bold text-ink">{t.name}</div>
                  <div className="text-xs text-neutral-500">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
