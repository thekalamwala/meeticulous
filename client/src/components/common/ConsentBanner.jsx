// Cookie consent (India DPDP / GDPR), per category — services/analytics/consent.js.
//   First view: Customize · Reject · Accept.
//   Customize:  Necessary (always on) · Analytics (GA4, Clarity) · Marketing (Meta
//               Pixel, GTM) toggles → Save preferences.
// Nothing in Analytics or Marketing loads until allowed. PostHog + our first-party
// counter are always on and are named under Necessary, so the panel tells the truth.
import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { analytics } from '../../services/analytics';

// Re-open the banner after a choice was made (e.g. the bottom-right cookie
// button, CookieButton.jsx). The banner listens for this window event and opens
// straight on the Customize view, showing the visitor's current choice.
const OPEN_EVENT = 'consent:open';
export const openConsentSettings = () => window.dispatchEvent(new Event(OPEN_EVENT));

const NONE = { analytics: false, marketing: false };

const ROWS = [
  { key: 'necessary', title: 'Necessary', body: 'Keeps the site working and secure, plus our own first-party usage counts (PostHog). Always on.' },
  { key: 'analytics', title: 'Analytics', body: 'Google Analytics and Microsoft Clarity show us which pages get read.' },
  { key: 'marketing', title: 'Marketing', body: 'Meta Pixel and Google Tag Manager measure our ads and build ad audiences.' },
];

function Toggle({ id, checked, disabled, onChange, label }) {
  return (
    <label className="mt-switch shrink-0" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} aria-label={label} />
      <span className={`mt-switch__track ${disabled ? 'opacity-60' : ''}`} aria-hidden="true" />
    </label>
  );
}

export default function ConsentBanner({ variant = 'full' }) {
  const [open, setOpen] = useState(() => !analytics.hasDecided());
  const [view, setView] = useState('main'); // 'main' | 'customize'
  const [prefs, setPrefs] = useState(NONE);

  useEffect(() => {
    const reopen = () => {
      setPrefs(analytics.getConsent?.() || NONE);
      setView('customize');
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const decide = (value) => {
    analytics.setConsent(value);
    setOpen(false);
  };
  const customize = () => { setPrefs(analytics.getConsent?.() || NONE); setView('customize'); };

  const actions = (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={customize} className="mt-btn mt-btn--secondary mt-btn--s">Customize</button>
      <button type="button" onClick={() => decide(false)} className="mt-btn mt-btn--secondary mt-btn--s">Reject</button>
      <button type="button" onClick={() => decide(true)} className="mt-btn mt-btn--s">Accept</button>
    </div>
  );

  // Landing pages keep a thin bottom bar until the visitor opens Customize.
  if (variant === 'slim' && view === 'main') {
    return (
      <div
        role="dialog"
        aria-label="Cookie settings"
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-black/10 bg-white/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] text-xs text-ink shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur"
      >
        <span>We use cookies to run the site and, if you agree, for analytics and ads. <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a></span>
        <div className="w-full max-w-[300px]">{actions}</div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie settings"
      className="fixed z-[9999] bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 max-[600px]:bottom-[calc(0.625rem+env(safe-area-inset-bottom,0px))] max-[600px]:right-2.5 w-[340px] max-w-[calc(100vw-1.25rem)] rounded-[24px] border border-black/5 bg-white p-5 text-ink shadow-[0_24px_60px_-20px_rgba(26,26,26,0.4)]"
    >
      {/* Not a heading element: this dialog renders above the page's <h1>, and a
          heading here broke the document outline on every page (semantic.heading_skip
          on ~195 pages). The dialog's accessible name comes from aria-label. */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-extrabold leading-tight text-maroon">Cookie settings</p>
        <Cookie size={20} className="shrink-0 text-maroon" aria-hidden="true" />
      </div>

      {view === 'main' ? (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
            We use cookies to run the site and, if you agree, to see which pages get read and to measure our ads.
            Read our <a href="/privacy" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</a>.
          </p>
          <div className="mt-4">{actions}</div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
            Choose what we may store on this device. Details in our{' '}
            <a href="/privacy" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</a>.
          </p>
          <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
            {ROWS.map((r) => (
              <li key={r.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink/60">{r.body}</p>
                </div>
                {r.key === 'necessary' ? (
                  <Toggle id="consent-necessary" checked disabled label="Necessary cookies, always on" />
                ) : (
                  <Toggle
                    id={`consent-${r.key}`}
                    checked={prefs[r.key]}
                    onChange={(v) => setPrefs((p) => ({ ...p, [r.key]: v }))}
                    label={`${r.title} cookies`}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setView('main')} className="mt-btn mt-btn--secondary mt-btn--s">Back</button>
            <button type="button" onClick={() => decide(prefs)} className="mt-btn mt-btn--s">Save preferences</button>
          </div>
        </>
      )}
    </div>
  );
}
