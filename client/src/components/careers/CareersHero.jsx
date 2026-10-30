import { useRef } from 'react';
import { gsap, useGSAP, EASE } from '../about/gsapSetup';
import { company } from './careersContent';

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
    <section ref={root} className="relative overflow-hidden px-5 py-24 text-center sm:px-8 lg:py-32">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(55% 50% at 50% 30%, #FBE3E8 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="mx-auto max-w-3xl">
        <p className="js-rise font-heading text-sm font-semibold uppercase tracking-wide text-primary">Careers</p>
        <h1 className="js-rise mt-3 font-heading text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
          Build the calm way to get booked.
        </h1>
        <p className="js-rise mx-auto mt-5 max-w-xl text-lg text-ink/70">{company.missionBlurb}</p>
        <div className="js-rise mt-9 flex justify-center">
          <a
            href="#open-roles"
            className="btn inline-flex items-center justify-center bg-primary px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] transition-colors hover:bg-primary-dark hover:no-underline"
          >
            See open roles
          </a>
        </div>
      </div>
    </section>
  );
}
