import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { logos } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

function LogoChip({ item }) {
  return (
    <div
      title={item.name}
      className="group flex h-16 w-44 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-ink/10 bg-white p-3"
    >
      <ImgWithSkeleton
        src={item.src}
        alt={item.name}
        fallbackLabel={item.name}
        objectFit="contain"
        className="grayscale transition-all duration-300 group-hover:grayscale-0"
      />
    </div>
  );
}

// Single track scrolling right → left (content drifts leftward).
function Marquee({ items }) {
  const track = useRef(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          track.current,
          { xPercent: 0 },
          { xPercent: -50, duration: 45, ease: "none", repeat: -1 }
        );
      });
    },
    { scope: track }
  );
  return (
    <div className="flex w-max gap-5" ref={track}>
      {[...items, ...items].map((item, i) => (
        <LogoChip key={i} item={item} />
      ))}
    </div>
  );
}

export default function LogoMarquee() {
  return (
    <section className="overflow-hidden py-10">
      <p className="mb-8 px-5 text-center text-sm font-medium uppercase tracking-[0.2em] text-ink/40 sm:px-8">
        {logos.eyebrow}
      </p>
      <Marquee items={logos.brands} />
    </section>
  );
}
