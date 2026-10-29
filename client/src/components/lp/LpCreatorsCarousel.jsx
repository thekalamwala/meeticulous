import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Avatar } from "./LpKit";
import { COHORTS } from "./lpData";

export default function LpCreatorsCarousel() {
  const trackRef = useRef(null);
  // Pointer drag-to-scroll state (mouse/touch). Refs so dragging never re-renders.
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const by = card ? card.clientWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * by, behavior: "smooth" });
  };

  const onPointerDown = (e) => {
    const el = trackRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const el = trackRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = (e) => {
    const el = trackRef.current;
    drag.current.down = false;
    el?.releasePointerCapture?.(e.pointerId);
  };
  // Swallow the click that follows a drag so a card link isn't accidentally fired.
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <section className="bg-primary px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-xl text-3xl font-extrabold leading-tight text-white sm:text-[2.6rem]">
              See what creators build on Meeticulous
            </h2>
            <p className="mt-3 max-w-md text-white/80">
              1:1 sessions, in-person appointments and digital products, from real Meeticulous hosts.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous creators"
              className="grid h-11 w-11 place-items-center rounded-[6px] bg-white text-ink transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next creators"
              className="grid h-11 w-11 place-items-center rounded-[6px] bg-white text-ink transition-transform"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          className="mt-10 flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto pb-4 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {COHORTS.map((c) => (
            <article
              key={c.title}
              data-card
              className="flex min-h-[20rem] w-[19rem] flex-none snap-start flex-col rounded-[8px] bg-neutral-900 p-6 text-white sm:w-[21rem]"
            >
              <h3 className="text-xl font-bold leading-snug text-white">{c.title}</h3>
              <p className="mt-2 text-sm text-white/55">{c.blurb}</p>

              <div className="mt-auto flex items-center gap-3 pt-6">
                <span className="rounded-[4px] bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                  {c.tag}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                <Avatar src={c.img} name={c.name} className="h-10 w-10 rounded-[6px]" />
                <span className="flex-1 text-sm font-semibold">{c.name}</span>
                <ArrowRight size={16} className="text-white/60" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
