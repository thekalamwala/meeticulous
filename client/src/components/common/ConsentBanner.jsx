// Marketing-consent banner (India DPDP / GDPR). Shown until the user accepts or
// declines. Accept → GA4/Pixel/Clarity load; decline → they never load. PostHog
// (first-party product analytics) runs regardless and is not gated here.
import { useEffect, useState } from 'react';
import { analytics } from '../../services/analytics';
import CookieDuo from './CookieDuo';

// Re-open the banner after a choice was made (e.g. the bottom-right cookie
// button, CookieButton.jsx). The banner listens for this window event.
const OPEN_EVENT = 'consent:open';
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

export default function ConsentBanner({ variant = "full" }) {
  const [decided, setDecided] = useState(() => analytics.hasDecided());

  useEffect(() => {
    const reopen = () => setDecided(false);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (decided) return null;

  const choose = (granted) => {
    analytics.setConsent(granted);
    setDecided(true);
  };

  if (variant === "slim") {
    return (
      <div
        role="dialog"
        aria-label="Cookie and analytics consent"
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-black/10 bg-white/95 px-4 py-2.5 text-xs text-[#252525] shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur"
      >
        <span>We use cookies for analytics &amp; marketing. Essential analytics always run.</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => choose(true)} className="rounded-full bg-[#009D28] px-3 py-1 font-semibold text-white">Agree</button>
          <button type="button" onClick={() => choose(false)} className="rounded-full border border-black/20 px-3 py-1 font-medium">Decline</button>
          <a href="/privacy" className="underline-offset-2 hover:underline">Learn more</a>
        </span>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie and analytics consent"
      className="fixed z-[9999] bottom-5 right-5 max-[600px]:bottom-2.5 max-[600px]:right-2.5 max-[600px]:max-w-[94%] w-[372px] max-w-[372px] flex flex-col items-center gap-3 rounded-[10px] border border-black/5 bg-white px-6 pb-6 pt-5 max-[600px]:px-4 text-[#252525] shadow-[0_24px_60px_-20px_rgba(26,26,26,0.4)]"
    >
      {/* Illustration-led card: two cookie characters (inline SVG, CookieDuo)
          above a bold headline — replaced the old pop-out cookie photo. */}
      <CookieDuo className="h-auto w-64" />

      <div className="text-center leading-relaxed">
        {/* Not an <h4>: this dialog renders above the page's <h1>, so a heading
            here made the article's first heading an h4 and broke the document
            outline on every page (semantic.heading_skip on ~195 pages). The dialog
            already has its own accessible name via aria-label above, so this needs
            no heading role — a styled <p> keeps the exact look. */}
        <p className="mb-2 font-display text-2xl font-extrabold leading-tight text-ink">We use cookies</p>
        <p className="text-xs text-gray-600">
          We use cookies for analytics &amp; marketing. Essential analytics always
          run — you can decline marketing &amp; ad cookies.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={() => choose(true)}
          className="rounded-[4px] border-2 border-current bg-[whitesmoke] px-3.5 py-2 text-sm text-[#2e7d32] transition-all duration-300 hover:bg-[#2e7d32]/15"
        >
          Agree
        </button>
        <button
          type="button"
          onClick={() => choose(false)}
          className="rounded-[4px] border-2 border-current bg-[whitesmoke] px-3.5 py-2 text-sm text-[#c62828] transition-all duration-300 hover:bg-[#c62828]/15"
        >
          Disagree
        </button>
        <a
          href="/privacy"
          className="rounded-[4px] border-2 border-current bg-[whitesmoke] px-3.5 py-2 text-sm text-[#1565c0] no-underline transition-all duration-300 hover:bg-[#1565c0]/15"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
