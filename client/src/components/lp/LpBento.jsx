import { BENTO } from "./lpData";

export default function LpBento() {
  return (
    <section className="bg-neutral-100 px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-[2.8rem]">
          <span className="text-primary">What you get</span> with Meeticulous
        </h2>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map((b) => {
            const accent = `var(--${b.color})`;
            return (
              <div
                key={b.label}
                className="rounded-[8px] p-7"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, white)` }}
              >
                <div
                  className="text-5xl font-extrabold tracking-tight sm:text-6xl"
                  style={{ color: accent }}
                >
                  {b.big}
                </div>
                <div className="mt-3 text-lg font-bold text-ink">{b.label}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{b.sub}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
