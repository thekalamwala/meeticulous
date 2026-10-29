import { HIRING_EMAIL } from './careersContent';

export default function CareersCta() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl rounded-[6px] border border-ink/10 bg-surface px-6 py-12 text-center sm:px-10">
        <h2 className="font-heading text-3xl font-bold sm:text-4xl">Don't see your role?</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink/70">
          We're a small team that grows fast. If you're great at what you do, tell us how you'd help.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href={`mailto:${HIRING_EMAIL}?subject=${encodeURIComponent('I’d love to work at Meeticulous')}`}
            className="btn inline-flex items-center justify-center bg-primary px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] transition-colors hover:bg-primary-dark hover:no-underline"
          >
            Get in touch
          </a>
        </div>
      </div>
    </section>
  );
}
