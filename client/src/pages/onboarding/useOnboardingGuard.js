import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getOnboardingStatus } from '../../services/api';

// Maps stepCompleted → the segment the host should be on next.
// 3-screen flow (docs/onboarding-redesign-spec.md). Segments are kept from the
// older flow so resume links never break; /claim and /category both render
// PageStep, /preview renders ServiceStep:
//   1 = Google identity done       → claim    (PageStep: link + what you do)
//   2 = slug claimed               → category (PageStep, same screen)
//   3 = persona saved              → preview  (ServiceStep: first service)
//   4 = legacy: category-in-flight → preview (roll forward — legacy /about
//                                     hosts still hit persona, which bumps to 3)
//   5 = details saved              → plan
// stepCompleted >= 6 => onboarding complete → dashboard (handled below).
export const RESUME = { 1: 'claim', 2: 'category', 3: 'preview', 4: 'preview', 5: 'plan' };

// Forward order of onboarding segments. The guard blocks *skipping ahead* but
// allows revisiting any already-reached step (Back buttons must work).
const ORDER = ['claim', 'category', 'preview', 'plan'];

/**
 * Server-truth resume guard for onboarding steps.
 *
 * - If the host is already complete, redirects to /dashboard.
 * - If the host is on the wrong step, redirects to the correct segment.
 * - Returns `ready=true` once the correct step is confirmed (or on error, so
 *   the page can still render gracefully rather than blocking forever).
 *
 * Usage: const ready = useOnboardingGuard();
 * Render a loading state until ready is true.
 */
export default function useOnboardingGuard() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Retry the status fetch a few times before failing open. A single transient
    // blip must NOT immediately render whatever step the host is on — that lets a
    // forward-jumped or wrong screen through, whose save then throws a confusing
    // precondition error. Only after repeated real failure do we fail open, so
    // the host is never blocked on a spinner forever.
    const MAX_TRIES = 3;

    const evaluate = (data) => {
      if (data?.isComplete) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const done = data?.stepCompleted || 1;
      const target = done >= 6 ? null : RESUME[done];
      // Escape hatch: /category/all is the fallback search UI; treat it as
      // still "on category" so the guard doesn't bounce the host back out.
      const path = window.location.pathname.replace(/\/$/, '');
      let here = path.split('/').pop();
      if (/\/category\/all$/.test(path)) here = 'category';
      if (target) {
        const ti = ORDER.indexOf(target);
        const hi = ORDER.indexOf(here);
        // Allow revisiting any earlier/equal step (Back works); redirect only
        // when jumping ahead of `target`, or when on an unknown segment.
        if (hi === -1 || hi > ti) {
          navigate(`/vendor-register/${data.slug || slug}/${target}`, { replace: true });
          return;
        }
      }
      setReady(true);
    };

    const run = async (attempt = 1) => {
      try {
        const { data } = await getOnboardingStatus();
        if (!alive) return;
        evaluate(data);
      } catch {
        if (!alive) return;
        if (attempt < MAX_TRIES) {
          setTimeout(() => { if (alive) run(attempt + 1); }, 400 * attempt);
          return;
        }
        setReady(true); // last resort: never block the host forever
      }
    };
    run();
    return () => { alive = false; };
  }, [navigate, slug]);

  return ready;
}
