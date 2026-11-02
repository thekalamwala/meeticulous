import { ArrowRight } from 'lucide-react';
import { HIRING_EMAIL } from './careersContent';

// Closing band in the brand crimson: "Don't see your role?" → hiring inbox.
export default function CareersCta() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[10px] bg-primary-cta px-6 py-14 text-center text-white sm:px-12">
        <h2 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">Don't see your role?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          We're a small team that grows fast. If you're great at what you do, tell us how you'd help.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href={`mailto:${HIRING_EMAIL}?subject=${encodeURIComponent('I’d love to work at Meeticulous')}`}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-white px-6 py-3 text-sm font-semibold text-ink shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)] hover:no-underline hover:opacity-90"
          >
            Get in touch <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
