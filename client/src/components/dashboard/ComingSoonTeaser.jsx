import { useState } from 'react';
import { Sparkles, BellRing, Check } from 'lucide-react';
import { notifyFeatureInterest } from '../../services/api';

const KEY = (feature) => `fi_${feature}`;
const readNotified = (feature) => {
  try { return localStorage.getItem(KEY(feature)) === '1'; } catch { return false; }
};

/**
 * ComingSoonTeaser — a "Coming to Pro" card for an unlaunched host feature, with a
 * one-click "Notify me" that records demand (POST /host/feature-interest). The
 * interest write is the slice's conversion signal: who wants what, so the next Pro
 * feature ships to a warm list. Remembers the click per-viewer (localStorage) so the
 * button doesn't re-offer after a reload.
 *
 * Props: feature ('courses'|'coupons'|'membership'), title, blurb.
 */
export default function ComingSoonTeaser({ feature, title, blurb }) {
  const [notified, setNotified] = useState(() => readNotified(feature));
  const [busy, setBusy] = useState(false);

  const notify = async () => {
    if (busy || notified) return;
    setBusy(true);
    // Optimistic + fire-and-forget: the endpoint is schema-fallback safe, so a
    // failure still shouldn't nag the host. Confirm, and remember for this browser.
    try { await notifyFeatureInterest(feature); } catch { /* recorded best-effort */ }
    try { localStorage.setItem(KEY(feature), '1'); } catch { /* ignore */ }
    setNotified(true);
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border-2 border-maroon/15 bg-blush/60 p-6 text-center">
      <span className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-maroon px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
        Coming to Pro
      </span>
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-maroon">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">{blurb}</p>
      <div className="mt-4">
        {notified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-maroon">
            <Check className="h-4 w-4" strokeWidth={2.6} />
            We&apos;ll let you know
          </span>
        ) : (
          <button
            type="button"
            onClick={notify}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-maroon-dark disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" strokeWidth={2.2} />
            Notify me
          </button>
        )}
      </div>
    </section>
  );
}
