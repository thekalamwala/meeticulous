import { useRef, useState } from "react";
import useGsapReveal from "./useGsapReveal";
import { testimonials } from "./aboutContent";

// Readable quote cards (was a hover-to-flip marquee: quotes were hidden behind a
// hover on desktop and effectively unreadable on touch, and the loop duplicated
// every card in the DOM).

function Avatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return <img src={src} onError={() => setErr(true)} alt="" loading="lazy" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />;
}

export default function HostQuotes() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{testimonials.eyebrow}</p>
        <h2 className="js-head mt-3 font-heading text-4xl font-extrabold sm:text-5xl">{testimonials.heading}</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {testimonials.items.map((t) => (
            <figure
              key={t.name}
              className="js-item flex flex-col justify-between rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]"
            >
              <blockquote className="leading-relaxed text-ink/80">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Avatar src={t.avatar} name={t.name} />
                <div>
                  <div className="font-heading font-semibold">{t.name}</div>
                  <div className="text-sm text-ink/60">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
