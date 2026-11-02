import { motion, useReducedMotion } from 'framer-motion';
import Reveal from '../../../components/home/Reveal';
import GoogleButton from '../GoogleButton';

const LEAD = ['Your', 'booking', 'link', 'that'];

export default function S01Hook() {
  const reduce = useReducedMotion();
  const float = reduce ? {} : { animate: { y: [0, -12, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } };

  return (
    <div className="grid gap-8 lg:grid-cols-2 items-center">
      <div>
        {/* wordmark — tells a cold shared-link viewer what this is */}
        <Reveal as="div" y={12} className="mb-6 flex items-center gap-2">
          <img src="/brand/meeticulous-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-heading text-sm font-bold tracking-tight">Meeticulous</span>
        </Reveal>

        {/* headline — words rise in, promise phrase lands last */}
        <h1 className="font-heading text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          {LEAD.map((w, i) => (
            <Reveal key={w} as="span" y={16} delay={i * 0.08} className="mr-[0.25em] inline-block">{w}</Reveal>
          ))}
          <Reveal as="span" y={16} delay={0.42} className="inline-block"><span className="text-primary">actually gets you paid</span>.</Reveal>
        </h1>

        <Reveal delay={0.58}><p className="mt-5 max-w-md text-lg text-muted">Share one link — clients book, pay over UPI, and the money lands in your account.</p></Reveal>
        <Reveal delay={0.68}><GoogleButton className="mt-7" /></Reveal>
      </div>

      <Reveal delay={0.25} className="justify-self-center">
        <div className="relative">
          <motion.img
            src="/brand/meeticulous-icon.svg" alt="Meeticulous" width={320} height={320}
            className="h-auto w-56 sm:w-72 lg:w-80" loading="eager" {...float}
          />
          {/* money beat — makes "gets you paid" concrete in the first frame */}
          {!reduce && (
            <motion.div
              className="absolute -right-1 top-6 flex items-center gap-2 rounded-full border border-ink/5 bg-white px-3 py-2 shadow-[0_8px_30px_rgba(23,32,51,0.12)] sm:-right-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -8] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 1.2, times: [0, 0.18, 0.82, 1], ease: 'easeInOut' }}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full text-xs" style={{ background: 'rgba(76,175,80,0.16)', color: '#3a9d3f' }}>✓</span>
              <span className="font-heading text-sm font-semibold">₹2,000 landed</span>
            </motion.div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
