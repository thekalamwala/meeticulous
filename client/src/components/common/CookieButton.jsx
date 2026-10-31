import { useLocation } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { openConsentSettings } from './ConsentBanner';

// Bottom-right floating circle → re-opens the cookie/consent banner.
// Replaced the Bolt support-chat launcher in this corner (owner request
// 2026-10-31); BotWidget.jsx is kept in the codebase but no longer mounted.
// Same pages the Bolt launcher appeared on.
const isAllowedPath = (p) =>
  p === '/' || p === '/privacy' || p === '/terms' || p === '/help' || p.startsWith('/help/');

export default function CookieButton() {
  const { pathname } = useLocation();
  if (!isAllowedPath(pathname)) return null;

  return (
    <button
      type="button"
      onClick={openConsentSettings}
      aria-label="Cookie settings"
      title="Cookie settings"
      className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-primary bg-white text-primary shadow-[0_12px_30px_-12px_rgba(26,26,26,0.35)] transition-transform hover:scale-105"
    >
      <Cookie size={24} aria-hidden="true" />
    </button>
  );
}
