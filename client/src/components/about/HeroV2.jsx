import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { hero, ROUTE_START } from "./aboutContent";
import ImgWithSkeleton from "./ImgWithSkeleton";

const WORDS = hero.typeWords;
// One colour per word — Pink · Blue · Green · Orange · Yellow (PBGOY).
const TYPE_COLORS = ["#FF4D93", "#269CEF", "#4AB765", "#0079C1", "#FFCC1C"];

function useTypewriter(words) {
  const [state, setState] = useState({ text: words[0], wi: 0 });
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let wi = 0, ci = 0, deleting = false, raf;
    const tick = () => {
      const word = words[wi];
      ci += deleting ? -1 : 1;
      setState({ text: word.slice(0, ci), wi });
      let delay = deleting ? 45 : 95;
      if (!deleting && ci === word.length) { deleting = true; delay = 1300; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 260; }
      raf = window.setTimeout(tick, delay);
    };
    raf = window.setTimeout(tick, 700);
    return () => window.clearTimeout(raf);
  }, [words]);
  return state;
}

export default function HeroV2() {
  const { text: typed, wi } = useTypewriter(WORDS);
  const aura = useRef(null);
  const color = TYPE_COLORS[wi % TYPE_COLORS.length];

  return (
    <section className="relative overflow-hidden px-5 py-12 sm:px-8 lg:py-16">
      <div ref={aura} aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(55% 50% at 30% 30%, #D6ECF8 0%, transparent 70%)" }} />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[3fr_2fr]">
        <div>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.12] sm:text-5xl lg:text-6xl">
            {hero.leadPre}{" "}
            <span className="whitespace-nowrap">
              <span aria-hidden="true" style={{ color }}>{typed}</span>
              <span aria-hidden="true" className="ml-0.5 inline-block w-[2px] animate-pulse align-middle" style={{ height: "0.9em", backgroundColor: color }} />
            </span>{" "}
            <span className="text-ink/80">{hero.leadPost}</span>
            <span data-testid="hero-typeword" className="sr-only">{WORDS.join(" ")}</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink/70">{hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={ROUTE_START} className="btn inline-flex items-center justify-center gap-1.5 bg-primary px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] transition-colors hover:bg-primary-dark">
              {hero.ctaPrimary}
              <ArrowRight size={16} />
            </Link>
            <a href="#about-how" className="btn btn--outline inline-flex items-center justify-center px-7 py-3.5">
              {hero.ctaGhost}
            </a>
          </div>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[10px] bg-sand ring-1 ring-black/5" data-swap="hero-portrait">
          <ImgWithSkeleton
            src={hero.image}
            alt="A calm creator getting booked with Meeticulous"
            fallbackLabel="Meeticulous"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
