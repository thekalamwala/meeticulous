import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { gsap, useGSAP, EASE } from '../about/gsapSetup';
import { company } from './careersContent';

// Centred hero: eyebrow, heading, mission line and the two CTAs. (The photo
// composition — portraits, fact chips, icon tiles — was removed 2026-11-02 at
// the owner's request.)

export default function CareersHero() {
  const root = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(root.current.querySelectorAll('.js-rise'), {
          opacity: 0, y: 28, duration: 0.8, ease: EASE, stagger: 0.1,
        });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="relative overflow-hidden bg-canvas px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="js-rise text-sm font-semibold uppercase tracking-[0.2em] text-primary">Careers</p>
        <h1 className="js-rise mt-3 font-display font-extrabold leading-[1.08] text-maroon text-[clamp(2.4rem,5vw,3.75rem)]">
          Build the calm way to <span className="text-rose">get booked.</span>
        </h1>
        <p className="js-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{company.missionBlurb}</p>
        <div className="js-rise mt-9 flex flex-wrap items-center justify-center gap-6">
          <a
            href="#open-roles"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-cta px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
          >
            See open roles <ArrowRight size={16} aria-hidden="true" />
          </a>
          <Link
            to="/about"
            className="border-b-2 border-ink pb-0.5 text-sm font-semibold text-ink hover:border-primary hover:text-primary-cta hover:no-underline"
          >
            Meet the team
          </Link>
        </div>
      </div>
    </section>
  );
}
