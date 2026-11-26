import { useRef } from 'react';
import { company } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

export default function WhyWorkHere() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="bg-[#fcf8f2] px-5 pb-10 pt-16 sm:px-8 lg:pb-12 lg:pt-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="js-head text-center font-heading text-3xl font-bold tracking-tight text-[#581025] sm:text-[2.75rem] sm:leading-tight">
          Why build with us
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink/75 sm:text-base">
          A small team with real ownership, building for the people who sell their time.
        </p>
        <div className="mx-auto mt-8 grid max-w-md gap-4 md:mt-11 md:max-w-none md:grid-cols-3 lg:gap-5">
          {company.values.map(({ image, tone, title, body }) => (
            <div key={title} className={`js-item flex flex-col rounded-xl border p-5 lg:p-6 ${tone}`}>
              <img
                src={image}
                alt=""
                width={114}
                height={102}
                loading="lazy"
                decoding="async"
                className="mx-auto mb-4 h-auto w-40 lg:w-48"
              />
              <h3 className="font-heading text-lg font-bold text-[#581025]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
