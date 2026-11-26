import { useEffect } from 'react';

// While a host dashboard shell is mounted:
//  - the phone's status bar / browser chrome takes the cream of the dashboard top
//    bar instead of the marketing maroon set in index.html, so the two don't clash;
//  - <html> gets `dash-app`, which turns off the browser's own pull-to-refresh and
//    page rubber-band (index.css). The dashboard has its own PullToRefresh, and the
//    native one fired on top of it on Android Chrome.
// Both are restored on unmount, so marketing pages keep their own behaviour.
export default function useDashboardChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    const cream = getComputedStyle(root).getPropertyValue('--mt-cream').trim();
    if (meta && cream) meta.setAttribute('content', cream);
    root.classList.add('dash-app');
    return () => {
      if (meta && prev != null) meta.setAttribute('content', prev);
      root.classList.remove('dash-app');
    };
  }, []);
}
