// ForFaqIntro — the line + "Ask us anything" link under the sticky FAQ heading
// on every /for page (heading sticks on the left, questions on the right).
// `accent` is the page's own accent colour (a CSS value, usually a var()).

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function ForFaqIntro({ accent = 'currentColor' }) {
  return (
    <>
      <p className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed text-black/60">
        Everything you need to know before you set up your page.
      </p>
      <Link
        to="/contact"
        className="mt-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        style={{ color: accent }}
      >
        Ask us anything <ArrowRight size={16} />
      </Link>
    </>
  );
}
