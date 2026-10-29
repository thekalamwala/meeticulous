// Offline — the page shown when the device has no connection.
//
// Today it's a reachable route (/offline) so it can be designed, tested, and is
// ready for the Service Worker to serve from cache in a follow-up branch (the SW
// itself is intentionally NOT wired here — a mis-versioned cache on a live deploy
// is the riskiest piece, so it ships separately).
//
// Behaviour: listens for the browser regaining connectivity and reloads the page
// automatically; the CTA also retries on demand. Reuses ErrorLayout so it stays
// visually identical to the rest of the error system.
import { useEffect, useState } from 'react';
import ErrorLayout from '../components/error/ErrorLayout';
import { getErrorEntry } from '../config/errorCatalog';

export default function Offline() {
  const entry = getErrorEntry('offline');
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      // Give the network a beat to settle, then pull a fresh page.
      window.setTimeout(() => window.location.reload(), 600);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ErrorLayout
      eyebrow="No connection"
      title={entry.title}
      message={entry.message}
      art={entry.art}
      primaryLabel={entry.cta.label}
      onPrimary={() => window.location.reload()}
      seoTitle="Offline · Meeticulous"
    >
      {/* Live connection status — updates the moment the browser flips state. */}
      <p
        className="mb-7 inline-flex items-center gap-2 text-[13px] text-gray-400 dark:text-gray-500"
        role="status"
        aria-live="polite"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            online ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
        {online ? 'Back online — reconnecting…' : 'Waiting for a connection…'}
      </p>
    </ErrorLayout>
  );
}
