import { useRef } from 'react';
import { company } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

export default function CultureStrip() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head font-heading text-3xl font-bold sm:text-4xl">Life at Meeticulous</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {company.culture.map((c, i) => (
            <figure
              key={i}
              data-swap="careers-culture-photo"
              className="js-item overflow-hidden rounded-[6px] border border-ink/10 bg-surface"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-ink/5 text-ink/30" aria-hidden={!c.img}>
                {c.img ? (
                  <img src={c.img} alt={c.alt} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm">Photo</span>
                )}
              </div>
              <figcaption className="px-4 py-3 text-sm text-ink/70">{c.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
