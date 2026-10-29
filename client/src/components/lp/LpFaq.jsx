import { FAQ } from "./lpData";

export default function LpFaq() {
  return (
    <section className="bg-canvas px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-[2.6rem]">
          Questions, answered.
        </h2>
        <div className="mt-10 divide-y divide-black/5 rounded-[8px] border border-black/5 bg-white px-6 shadow-sm">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-base font-semibold text-ink marker:content-none">
                {item.q}
                <span className="text-primary transition-transform duration-200 group-open:rotate-45">
                  <span className="block text-xl leading-none">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
