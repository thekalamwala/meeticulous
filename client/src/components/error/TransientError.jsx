import { Link } from 'react-router-dom';

/**
 * TransientError — fallback for a public, prerendered page whose data fetch failed
 * for a NON-404 reason (network/timeout, 5xx, or a 429/403 from an edge rate-limit
 * or IP guard).
 *
 * Deliberately NOT the branded ErrorPage: ErrorLayout emits `noindex`, and a live,
 * prerendered page must not drop out of search over a transient blip — which is
 * exactly what happened when a JS-rendering crawler (Google's WRS) hit a transient
 * API failure and the page rendered the noindex 404. This emits NO robots meta, so
 * the baked prerendered <head> (canonical, JSON-LD) stays authoritative, and offers
 * the reader a retry. A GENUINE 404 still uses ErrorPage (noindex is correct there).
 */
export default function TransientError({ message = 'This page didn’t load. Please try again.' }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-base text-gray-700">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Reload
        </button>
        <p className="mt-4 text-sm">
          <Link to="/" className="text-gray-500 hover:underline">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
