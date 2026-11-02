import { ArrowRight } from 'lucide-react';
import { HIRING_EMAIL } from './careersContent';

// Closing band on the design-system maroon field: "Don't see your role?" → hiring inbox.
export default function CareersCta() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[24px] bg-maroon px-6 py-14 text-center text-white sm:px-12">
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Don't see your role?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-blush">
          We're a small team that grows fast. If you're great at what you do, tell us how you'd help.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href={`mailto:${HIRING_EMAIL}?subject=${encodeURIComponent('I’d love to work at Meeticulous')}`}
            className="mt-btn mt-btn--onbrand"
          >
            Get in touch <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
