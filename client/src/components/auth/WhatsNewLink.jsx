import { Link } from 'react-router-dom';

// "Check what's new" link — rendered OUTSIDE the login/signup card, pointing at
// the public /changelog timeline. Shared across guest login, host login and the
// vendor signup page so the entry point is consistent.
const WhatsNewLink = ({ className = '' }) => (
  <Link
    to="/changelog"
    className={`inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary hover:no-underline ${className}`}
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
    Check what’s new
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">New</span>
  </Link>
);

export default WhatsNewLink;
