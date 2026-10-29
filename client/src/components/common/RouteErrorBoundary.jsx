import { Component } from 'react';
import { analytics, initAnalytics, EVENTS } from '../../services/analytics';

/**
 * Catches errors thrown while rendering lazy route chunks so a failed dynamic
 * import() degrades to a recover-able message instead of a blank white screen
 * (React unmounts the whole tree on an uncaught render error).
 *
 * lazyWithRetry already handles the common stale-chunk-after-deploy case with a
 * one-shot reload, so anything that reaches this boundary is either a genuine
 * runtime error in the page, or a chunk that stayed broken even after a reload.
 * Either way we show a manual recovery path rather than dying silently.
 *
 * Pass a `resetKey` (e.g. the current pathname) so the boundary clears its error
 * state when the user navigates away. Without it, one transient error would
 * "stick" and show the recovery card on every route for the rest of the SPA
 * session until a full browser reload.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const componentStack = info?.componentStack;
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary]', error, componentStack);

    // Report to PostHog (always-on, first-party — no consent gate) so a prod
    // crash names its route + component instead of dying as an anonymous "This
    // page didn't load". Without this the error is invisible server-side and we
    // can only guess which page/device (esp. mobile) is throwing. Fully guarded:
    // reporting must never throw from inside an error boundary.
    try {
      const message = String(error?.message || error || '');
      // A first-paint crash means AnalyticsBridge's idle-init never ran, so the
      // PostHog SDK isn't booting yet. Nudge it (idempotent) so the queued
      // capture actually flushes once the SDK loads.
      initAnalytics();
      analytics.track(EVENTS.APP_ERROR, {
        message: message.slice(0, 300),
        component_stack: componentStack
          ? componentStack.trim().split('\n').map((l) => l.trim()).slice(0, 8).join(' | ').slice(0, 500)
          : undefined,
        path: window.location?.pathname,
        // Distinguishes a stale-chunk-after-deploy failure from a genuine render
        // bug — they need different fixes.
        is_chunk_error:
          /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(message),
        viewport_w: typeof window !== 'undefined' ? window.innerWidth : undefined,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 200) : undefined,
      });
    } catch {
      /* reporting is best-effort — never let it re-throw */
    }
  }

  componentDidUpdate(prevProps) {
    // Route changed while showing the error card → give the new route a clean
    // shot at rendering instead of staying stuck on the recovery screen.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleReload = () => {
    // Clear the lazy-retry guard so the reload gets a clean shot at fresh chunks.
    try {
      sessionStorage.removeItem('bas:chunk-reload');
    } catch {
      /* sessionStorage unavailable — ignore */
    }
    // A plain reload can replay the same stale document/chunk from the browser's
    // bfcache or HTTP cache — the "reload doesn't help" case. A one-shot
    // cache-busting query param forces a fresh document + module-graph fetch.
    // Vercel ignores the param for its static/rewrite matching, so the same
    // route still resolves; location.replace keeps it out of history.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_rl', Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <div className="w-12 h-12 mb-5 rounded-full border-4 border-[#0079C1] border-t-transparent" />
        <h1 className="text-xl font-semibold text-gray-900">This page didn’t load</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Something interrupted the page. This usually fixes itself with a reload.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 rounded-lg bg-[#0079C1] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default RouteErrorBoundary;
