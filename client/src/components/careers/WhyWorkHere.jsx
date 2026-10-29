import { useRef } from 'react';
import { company } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

const ACCENTS = ['var(--c-blue)', 'var(--c-violet)', 'var(--c-emerald)'];

export default function WhyWorkHere() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head font-heading text-3xl font-bold sm:text-4xl">Why work here</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {company.values.map((v, i) => {
            const Icon = v.icon;
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div key={v.title} className="js-item rounded-[6px] border border-ink/10 bg-surface p-6">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[6px]"
                  style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-heading text-lg font-semibold">{v.title}</h3>
                <p className="mt-1 text-ink/70">{v.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
