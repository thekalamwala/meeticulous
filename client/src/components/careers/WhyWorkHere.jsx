import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { company } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

// "Why build with us" — the company values as soft pastel cards (crimson /
// violet / amber washes), each with a big faint line icon in the corner and a
// link down to the open roles.
const ACCENTS = ['var(--primary, #960D32)', 'var(--c-violet)', 'var(--c-amber)'];

export default function WhyWorkHere() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head text-center font-heading text-4xl font-extrabold sm:text-5xl">
          Why build <span className="text-primary-cta">with us</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-ink/70">
          A small team with real ownership, building for the people who sell their time.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {company.values.map((v, i) => {
            const Icon = v.icon;
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div
                key={v.title}
                className="js-item relative flex min-h-[260px] flex-col overflow-hidden rounded-[6px] p-7"
                style={{ background: `color-mix(in srgb, ${accent} 10%, white)` }}
              >
                <h3 className="font-heading text-xl font-bold text-ink">{v.title}</h3>
                <p className="mt-3 max-w-[16rem] leading-relaxed text-ink/65">{v.body}</p>
                <a
                  href="#open-roles"
                  className="relative z-10 mt-auto inline-flex items-center gap-1 pt-8 text-sm font-semibold text-ink hover:text-primary-cta hover:no-underline"
                >
                  See open roles <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Icon
                  className="pointer-events-none absolute -bottom-3 -right-3 h-32 w-32"
                  style={{ color: accent, opacity: 0.35 }}
                  strokeWidth={1.25}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
