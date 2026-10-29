/**
 * OpeningTakeover.jsx — "The Opening" overlay, homepage only.
 *
 * During the launch window the ceremony appears full-screen over the HOMEPAGE (/)
 * for a device's FIRST homepage visit only. Once it has ended (stone placed OR
 * closed) it never re-appears on that device — first-time visitors see the moment,
 * returning visitors are not nagged.
 *
 * Mounted once at the app root; it self-gates to the homepage. Server /status is the
 * source of truth for the window; the result is cached in sessionStorage.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getOpeningStatus } from '../../services/opening';

// Lazy so the ceremony JS + opening.css only download when the takeover actually
// shows. Imported statically, Vite emitted opening.css as a <link> on every page and
// the prerender snapshot baked it in as a render-blocking stylesheet (~450ms on
// mobile Lighthouse) — even outside the launch window, when this renders null.
const OpeningCeremony = lazy(() => import('./OpeningCeremony'));

const SHOWS_KEY = 'opening_shows_v1';   // count of times shown-and-dismissed on this device
const MAX_SHOWS = 1;                    // first-time visitors only: show once, then never again
const CACHE_KEY = 'opening_status_v1';
const CACHE_TTL = 5 * 60 * 1000;

const readInt = (k) => { try { return parseInt(localStorage.getItem(k), 10) || 0; } catch { return 0; } };

async function fetchStatusCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, at } = JSON.parse(raw);
      if (Date.now() - at < CACHE_TTL) return data;
    }
  } catch { /* ignore */ }
  const data = await getOpeningStatus();
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, at: Date.now() })); } catch { /* ignore */ }
  return data;
}

export default function OpeningTakeover() {
  const { pathname } = useLocation();
  const [status, setStatus] = useState(null);
  const [show, setShow] = useState(false);

  // Homepage only, until this device has seen it MAX_SHOWS times. Recomputed each render.
  const eligible = pathname === '/' && readInt(SHOWS_KEY) < MAX_SHOWS;

  useEffect(() => {
    if (!eligible) return;
    let alive = true;
    fetchStatusCached()
      .then((s) => { if (alive && s?.open) { setStatus(s); setShow(true); } })
      .catch(() => {});
    return () => { alive = false; };
    // re-check when navigating back to the homepage
  }, [eligible, pathname]);

  if (!show || !status) return null;

  // Any dismissal — placing a stone or closing — consumes one of the MAX_SHOWS.
  const exit = () => {
    try { localStorage.setItem(SHOWS_KEY, String(readInt(SHOWS_KEY) + 1)); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-ink" role="dialog" aria-modal="true" aria-label="The Opening">
      <Suspense fallback={null}>
        <OpeningCeremony status={status} embedded onExit={exit} />
      </Suspense>
    </div>
  );
}
