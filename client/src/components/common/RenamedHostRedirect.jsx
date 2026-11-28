import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { resolveUsername } from '../../services/api';

// A page under /:username/… that 404s may simply be using a host's OLD username
// (usernames can change; the old one stays in username_history). Ask the
// resolver: if the name now belongs to a different current username, replace the
// first path segment and keep the rest + query (/old/products/x → /new/products/x).
// Otherwise render `children` (the page's real not-found state).
// Crawlers get a real 301 for the same case at the edge (client/middleware.js).
export default function RenamedHostRedirect({ username, children }) {
  const { pathname, search } = useLocation();
  const [current, setCurrent] = useState(undefined); // undefined = checking, null = no rename

  useEffect(() => {
    let alive = true;
    setCurrent(undefined);
    resolveUsername(username)
      .then(({ data }) => {
        if (!alive) return;
        const cur = data?.found ? data.current : null;
        setCurrent(cur && cur.toLowerCase() !== String(username).toLowerCase() ? cur : null);
      })
      .catch(() => { if (alive) setCurrent(null); });
    return () => { alive = false; };
  }, [username]);

  // Placeholder, not null: these routes are prerendered (hydration-safe).
  if (current === undefined) return <div className="min-h-screen" />;
  if (current) {
    const rest = pathname.split('/').filter(Boolean).slice(1).join('/');
    return <Navigate to={`/${current}${rest ? `/${rest}` : ''}${search}`} replace />;
  }
  return children;
}
