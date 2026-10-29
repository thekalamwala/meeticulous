// ErrorLayout — the single visual shell every branded error / offline page uses.
//
// No header, no footer (it calls useHideChrome to drop the global chrome), one
// centred column, one primary CTA, calm fade-in, keyboard accessible. SEO is
// locked to noindex/nofollow with no canonical. The page-specific bits (title,
// copy, CTA) come in as props from the catalog via ErrorPage, so adding a new
// error never touches this file.
//
// Colour: error pages are ALWAYS light (no dark-mode variant), on a #F1F2F2
// ground with no card box — the email footer logo and copy sit directly on the
// page. Forced light regardless of OS theme.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Seo from '../common/Seo';
import ErrorIllustration from './ErrorIllustration';
import { useHideChrome } from '../../context/ChromeContext';
import '../../styles/error-pages.css';

export default function ErrorLayout({
  eyebrow,
  title,
  message,
  art,
  image,
  showSearch = false,
  primaryLabel,
  onPrimary,
  seoTitle,
  children,
}) {
  useHideChrome();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  // Works like the /search launcher: hand the query to Explore, which does the
  // real search. Empty submit just opens Explore.
  const onSearch = (e) => {
    e.preventDefault();
    const v = q.trim();
    navigate(v ? `/explore?q=${encodeURIComponent(v)}` : '/explore');
  };

  return (
    <main className="bas-error min-h-screen w-full flex items-center justify-center px-5 py-12 bg-[#F1F2F2] text-[#191919]">
      {/* Error pages must never be indexed and carry no canonical. */}
      <Seo title={seoTitle} robots="noindex, nofollow, noarchive" />

      {/* No card box — content sits directly on the page ground. */}
      <div className="bas-error__card w-full max-w-3xl text-center px-7 py-10 sm:px-10 sm:py-12">
        {/* Sloth art — random PNG variant on 404/410, line-art elsewhere. No
            wordmark beside it. */}
        <div className="flex justify-center mb-6 text-[#191919]">
          <ErrorIllustration art={art} image={image} />
        </div>

        {/* Explicit colour: a global `h1 { color: var(--text) }` (base-fb.css) is
            not theme-aware and would force the title dark-on-dark. */}
        <h1 className="font-heading text-2xl sm:text-[28px] font-semibold leading-snug mb-3 text-[#191919]">
          {title}
        </h1>

        <p className="text-[15px] leading-relaxed text-gray-500 mb-8 max-w-xl mx-auto">
          {message}
        </p>

        {/* Optional slot (e.g. offline live-status line). */}
        {children}

        {/* Lost-page search — same behaviour as the /search launcher: submit hands
            the query to Explore. Only on the pages where "find what you lost"
            helps (404/410), gated by showSearch. */}
        {showSearch && (
          <form onSubmit={onSearch} className="mb-6">
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1.5 pl-4 pr-1.5 shadow-[0_4px_18px_-8px_rgba(20,20,20,0.2)] focus-within:border-[#2E1065]/60 transition-colors">
              <Search size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search services by skill or topic…"
                aria-label="Search Meeticulous"
                className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[15px] text-[#191919] outline-none focus:outline-none focus:ring-0 focus:shadow-none focus:border-transparent placeholder:text-gray-400"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex h-11 w-11 min-h-0 shrink-0 aspect-square items-center justify-center rounded-full bg-[#2E1065] text-white transition hover:bg-[#1E0B4D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E1065] focus-visible:ring-offset-2"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
        )}

        {primaryLabel && (
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex items-center justify-center w-full sm:w-auto px-7 py-3 rounded-md bg-[#2E1065] hover:bg-[#1E0B4D] active:bg-[#191919] text-white font-medium text-[15px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E1065] focus-visible:ring-offset-2"
          >
            {primaryLabel}
          </button>
        )}

        {/* Single quiet secondary link — support, not a competing CTA. */}
        <p className="mt-6 text-[13px] text-gray-400">
          Need a hand?{' '}
          <a
            href="/help"
            className="text-gray-500 underline underline-offset-2 hover:text-[#2E1065] focus:outline-none focus-visible:text-[#2E1065]"
          >
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}
