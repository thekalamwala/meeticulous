// Marketing-consent banner (India DPDP / GDPR). Shown until the user accepts or
// declines. Accept → GA4/Pixel/Clarity load; decline → they never load. PostHog
// (first-party product analytics) runs regardless and is not gated here.
import { useState } from 'react';
import { analytics } from '../../services/analytics';

export default function ConsentBanner({ variant = "full" }) {
  const [decided, setDecided] = useState(() => analytics.hasDecided());

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
      className="fixed z-[9999] bottom-5 right-5 max-[600px]:bottom-2.5 max-[600px]:right-2.5 max-[600px]:max-w-[90%] max-w-[380px] flex flex-col items-center gap-4 rounded-2xl bg-[whitesmoke] px-5 pt-5 pb-4 text-[#252525] shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
    >
      {/* Cookie pops above the card via negative top margin */}
      <div className="-mt-16 mb-[-20px] drop-shadow">
        {/* Self-hosted from client/public (was company-assets.meeticulous.in; the
            .in CDN was flaky and the .png fallback 404'd — only the webp existed).
            webp is universally supported, so the <picture>/<source> dance is gone. */}
        <img
          src="/images/banner/consent.webp"
          alt="Meeticulous cookie preferences"
          width={224}
          height={201}
          decoding="async"
          className="h-auto w-28"
        />
      </div>

      <div className="text-center leading-relaxed">
        {/* Not an <h4>: this dialog renders above the page's <h1>, so a heading
            here made the article's first heading an h4 and broke the document
            outline on every page (semantic.heading_skip on ~195 pages). The dialog
            already has its own accessible name via aria-label above, so this needs
            no heading role — a styled <p> keeps the exact look. */}
        <p className="mb-1.5 text-base font-semibold">This site uses cookies 🍪</p>
        <p className="text-xs text-gray-600">
          We use cookies for analytics &amp; marketing. Essential analytics always
          run — you can decline marketing &amp; ad cookies.
        </p>
      </div>

      <div className="mt-1 flex flex-wrap justify-center gap-2.5">
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
