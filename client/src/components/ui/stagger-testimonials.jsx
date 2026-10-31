import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * StaggerTestimonials — JSX port of the 21st.dev "stagger-testimonials"
 * component (originally shadcn + TypeScript). Same geometry and behaviour:
 * square cards with a cut top-right corner + diagonal crease, the centre card
 * raised and filled, side cards tilted ±2.5°, click a card (or the arrows) to
 * rotate the list until it is centred.
 *
 * Adaptations for this codebase (plain React + Tailwind, no shadcn):
 *  - shadcn tokens → site tokens: primary = brand crimson, card = white,
 *    border = #E5E7EB, muted = a faint ink tint.
 *  - data comes from props (real host quotes), not the demo's placeholder list;
 *    the first item starts in the centre.
 *  - a11y: labelled carousel region, ←/→ keys, aria-current on the centre card,
 *    a live region announcing it.
 *
 * items: [{ quote, name, role, avatar }]
 */

const SQRT_5000 = Math.sqrt(5000);
const BORDER = "#E5E7EB";

const cx = (...c) => c.filter(Boolean).join(" ");

// Rotate so items[0] sits at the centre slot (index n/2 for even n, (n-1)/2 for odd).
const centreFirst = (items) => {
  const n = items.length;
  const centre = n % 2 ? (n - 1) / 2 : n / 2;
  return items.map((_, i) => ({ ...items[(i - centre + n) % n], tempId: i }));
};

function Avatar({ src, name }) {
  const [err, setErr] = useState(false);
  const cls = "mb-4 h-14 w-12 bg-black/5 object-cover object-top";
  const style = { boxShadow: "3px 3px 0px #fff" };
  if (err || !src) {
    return (
      <div className={cx(cls, "flex items-center justify-center text-lg font-bold text-primary")} style={style}>
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setErr(true)} className={cls} style={style} />;
}

function TestimonialCard({ position, testimonial, handleMove, cardSize }) {
  const isCenter = position === 0;

  return (
    <figure
      onClick={() => handleMove(position)}
      aria-current={isCenter ? "true" : undefined}
      className={cx(
        "absolute left-1/2 top-1/2 m-0 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
        isCenter ? "z-10 border-primary bg-primary text-white" : "z-0 border-[#E5E7EB] bg-white text-ink hover:border-primary/50"
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath:
          "polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)",
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter ? `0px 8px 0px 4px ${BORDER}` : "0px 0px 0px 0px transparent",
      }}
    >
      <span
        aria-hidden
        className="absolute block origin-top-right rotate-45"
        style={{ right: -2, top: 48, width: SQRT_5000, height: 2, background: BORDER }}
      />
      <Avatar src={testimonial.avatar} name={testimonial.name} />
      <blockquote className={cx("m-0 text-base font-medium sm:text-xl", isCenter ? "text-white" : "text-ink")}>
        “{testimonial.quote}”
      </blockquote>
      <figcaption
        className={cx("absolute bottom-8 left-8 right-8 mt-2 text-sm italic", isCenter ? "text-white/80" : "text-ink/60")}
      >
        - <span>{testimonial.name}</span>, {testimonial.role}
      </figcaption>
    </figure>
  );
}

export function StaggerTestimonials({ items, label = "Testimonials" }) {
  const [cardSize, setCardSize] = useState(365);
  const [list, setList] = useState(() => centreFirst(items));

  const handleMove = (steps) => {
    const newList = [...list];
    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }
    setList(newList);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(min-width: 640px)");
    const updateSize = () => setCardSize(mq.matches ? 365 : 290);
    updateSize();
    // Breakpoint changes don't always come with a window resize event (device
    // emulation, rotation), so listen to the media query too.
    window.addEventListener("resize", updateSize);
    mq.addEventListener?.("change", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      mq.removeEventListener?.("change", updateSize);
    };
  }, []);

  const n = list.length;
  const centre = list[n % 2 ? (n - 1) / 2 : n / 2];
  const arrowBtn =
    "flex h-14 w-14 items-center justify-center border-2 border-[#E5E7EB] bg-white text-2xl text-ink transition-colors " +
    "hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); handleMove(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); handleMove(-1); }
      }}
      className="relative w-full overflow-hidden bg-black/[0.02] outline-none"
      style={{ height: 600 }}
    >
      {list.map((testimonial, index) => {
        const position = n % 2 ? index - (n + 1) / 2 : index - n / 2;
        return (
          <TestimonialCard
            key={testimonial.tempId}
            testimonial={testimonial}
            handleMove={handleMove}
            position={position}
            cardSize={cardSize}
          />
        );
      })}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        <button type="button" onClick={() => handleMove(-1)} className={arrowBtn} aria-label="Previous testimonial">
          <ChevronLeft />
        </button>
        <button type="button" onClick={() => handleMove(1)} className={arrowBtn} aria-label="Next testimonial">
          <ChevronRight />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{centre && `Showing ${centre.name}, ${centre.role}`}</p>
    </div>
  );
}

export default StaggerTestimonials;
