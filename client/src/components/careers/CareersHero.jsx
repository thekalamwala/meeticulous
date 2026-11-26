import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Coffee, Heart, Sparkles, Sun, Flame } from 'lucide-react';
import { gsap, useGSAP, EASE } from '../about/gsapSetup';
import { company, getOpenJobs } from './careersContent';
import './careersHero.css';

export default function CareersHero() {
  const root = useRef(null);
  const openRoles = getOpenJobs().length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(root.current.querySelectorAll('.js-rise'), {
          opacity: 0, y: 28, duration: 0.8, ease: EASE, stagger: 0.1,
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} className="careers-hero px-5 py-12 sm:px-8 lg:py-16">
      <div className="careers-hero__layout">
        <div className="careers-hero__copy">
          <h1 className="js-rise">Build the calm way<br className="hidden xl:block" /> to <span>get booked.</span></h1>
          <p className="js-rise careers-hero__mission">{company.missionBlurb}</p>
          <div className="js-rise careers-hero__actions">
            <a href="#open-roles" className="careers-hero__primary">See open roles <ArrowRight size={15} aria-hidden="true" /></a>
            <Link to="/about#team" className="careers-hero__team">Meet the team</Link>
          </div>
          <ul className="js-rise careers-hero__perks">
            <li><MapPin size={13} aria-hidden="true" />Remote-first (India)</li>
            <li><Coffee size={13} aria-hidden="true" />Flexible, calm hours</li>
            <li><Heart size={13} aria-hidden="true" />Work with creators</li>
          </ul>
        </div>
        <div className="js-rise careers-hero__frame">
          <span className="careers-hero__tag careers-hero__tag--remote"><Sparkles size={14} aria-hidden="true" />Remote-first</span>
          <span className="careers-hero__tag careers-hero__tag--calm"><Sun size={14} aria-hidden="true" />Calm over chaos</span>
          <a href="#open-roles" className="careers-hero__tag careers-hero__tag--roles"><Flame size={14} aria-hidden="true" />{openRoles} open roles</a>
          <img src="/images/careers/mascot-team.webp" alt="Meeticulous mascots collaborating around a table" width="1100" height="733" loading="eager" fetchPriority="high" className="careers-hero__scene" />
          <span className="careers-hero__tag careers-hero__tag--creators"><Heart size={14} aria-hidden="true" />Creators first</span>
        </div>
      </div>
    </section>
  );
}
