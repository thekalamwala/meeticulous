// ErrorPage — the ONE component behind every HTTP error route.
//
// <ErrorPage code={404} /> looks the code up in errorCatalog.js, renders the
// shared ErrorLayout, wires the single CTA to its action, and logs the visit for
// analytics. New error pages need a catalog entry + a <Route> — never a new
// component. Unknown codes fall back to 500 (see getErrorEntry).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorLayout from '../components/error/ErrorLayout';
import { getErrorEntry, ACTIONS } from '../config/errorCatalog';

export default function ErrorPage({ code = 404 }) {
  const navigate = useNavigate();
  const entry = getErrorEntry(code);

  // Log every error-page visit (best-effort — analytics must never break the
  // page that's already telling the user something broke).
  useEffect(() => {
    try {
      // Lazy import keeps analytics out of the error chunk's critical path.
      import('../services/analytics').then(({ analytics }) => {
        import('../services/analytics/events').then(({ EVENTS }) => {
          analytics.track(EVENTS.ERROR_PAGE_VIEWED, {
            code: String(code),
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          });
        });
      });
    } catch {
      /* swallow — never let instrumentation surface a second error */
    }
  }, [code]);

  const runAction = () => {
    switch (entry.cta.action) {
      case ACTIONS.BACK:
        // Go back if there's somewhere to go; otherwise home.
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
        break;
      case ACTIONS.HOME:
        navigate('/');
        break;
      case ACTIONS.DASHBOARD:
        navigate('/dashboard');
        break;
      case ACTIONS.LOGIN:
        navigate('/login');
        break;
      case ACTIONS.RELOAD:
        window.location.reload();
        break;
      default:
        navigate('/');
    }
  };

  const isNumeric = /^\d+$/.test(String(code));

  return (
    <ErrorLayout
      eyebrow={isNumeric ? `Error ${code}` : undefined}
      title={entry.title}
      message={entry.message}
      art={entry.art}
      image={entry.image}
      showSearch={Boolean(entry.image)}
      primaryLabel={entry.cta.label}
      onPrimary={runAction}
      seoTitle={`${isNumeric ? `${code} — ` : ''}${entry.title} · Meeticulous`}
    />
  );
}
