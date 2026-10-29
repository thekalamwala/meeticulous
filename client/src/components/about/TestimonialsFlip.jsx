import { useRef, useState } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { testimonials } from "./aboutContent";

function Avatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return <img src={src} onError={() => setErr(true)} alt={name} loading="lazy" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />;
}

function FlipCard({ t }) {
  return (
    <div className="group relative h-56 w-72 shrink-0 [perspective:1200px]">
      <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-within:[transform:rotateY(180deg)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[10px] border border-ink/10 bg-surface p-6 text-center [backface-visibility:hidden]">
          <Avatar src={t.avatar} name={t.name} />
          <div>
            <div className="font-heading font-semibold">{t.name}</div>
            <div className="text-sm text-ink/60">{t.role}</div>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col justify-center rounded-[10px] bg-ink p-6 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-sm leading-relaxed">
            <span aria-hidden="true">“</span>
            {t.quote}
            <span aria-hidden="true">”</span>
          </p>
          <div className="mt-3 text-xs font-semibold text-primary">{t.name} · {t.role}</div>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsFlip() {
  const root = useRef(null);
  const track = useRef(null);
  // Hide team members who also appear as testimonial authors on the About page.
  const HIDE = new Set(["Arjun Ravikumar", "Happy Singh"]);
  const items = testimonials.items.filter((t) => !HIDE.has(t.name));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(track.current, {
          xPercent: -50,
          duration: 40,
          ease: "none",
          repeat: -1,
        });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="overflow-hidden px-0 py-12 lg:py-16">
      <div className="mx-auto mb-10 max-w-6xl px-5 sm:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Loved by hosts</p>
        <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{testimonials.heading}</h2>
      </div>
      <div ref={track} className="flex w-max gap-5 px-5">
        {[...items, ...items].map((t, i) => (
          <FlipCard key={i} t={t} />
        ))}
      </div>
    </section>
  );
}
