// AnalyticsBridge — boots the analytics bus once and emits a page view on every
// SPA route change. Renders nothing. Mount once inside <BrowserRouter>.
//
// The bus boots on the visitor's FIRST interaction (tap/scroll/key), or 4s after
// window load, whichever comes first — not on first idle. PostHog (104 KiB) + the
// Meta Pixel (274 KiB, ~460ms main thread) loading on idle still landed inside the
// mobile load window and cost ~400ms TBT on the homepage. Visitors who bounce
// without interacting still get boot via the 4s timer, so Pixel PageView and
// retargeting audiences keep filling. Page views fired before boot are queued by
// the PostHog adapter and flushed once it loads, so nothing is lost there.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics, initAnalytics } from '../../services/analytics';
import { EVENTS } from '../../services/analytics/events';

const BOOT_DELAY_MS = 4000;
const INTERACTIONS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
const LISTEN = { passive: true, capture: true };

export default function AnalyticsBridge() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('load', arm);
      INTERACTIONS.forEach((e) => window.removeEventListener(e, boot, LISTEN));
    };
    function boot() { cleanup(); initAnalytics(); }
    function arm() { timer = setTimeout(boot, BOOT_DELAY_MS); }

    INTERACTIONS.forEach((e) => window.addEventListener(e, boot, LISTEN));
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return cleanup;
  }, []);

  useEffect(() => {
    const path = pathname + search;
    analytics.page({ path });
    analytics.track(EVENTS.PAGE_VIEWED, { path });
  }, [pathname, search]);

  return null;
}
