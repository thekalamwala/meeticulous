import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isHost } from '../../utils/roleRoutes';
import { RESUME } from '../../pages/onboarding/useOnboardingGuard';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // The onboarding-resume gate applies ONLY at the host-space entry (/dashboard).
  // Once a host intentionally opens a specific page — a deep dashboard route,
  // their guest space, a review link — we honor that destination instead of
  // re-running a completeness check that could bounce them away. Auth and host
  // role are still enforced below; onboarding-completeness is a soft nudge, not
  // a permission. This also avoids a "Loading…" flash on every navigation.
  const isHostEntry = location.pathname === '/dashboard';

  useEffect(() => {
    if (loading || !user) {
      setStatusLoading(false);
      return;
    }

    // For host accounts, check onboarding status (is_host = v3.34 source of
    // truth) — but only at the host-space entry. Elsewhere, skip the fetch so
    // intentional navigation is instant and never risks an unintended redirect.
    if (isHost(user) && isHostEntry) {
      // Import here to avoid circular deps
      import('../../services/api')
        .then(({ getOnboardingStatus }) => {
          getOnboardingStatus()
            .then(({ data }) => {
              setOnboardingStatus(data);
            })
            .catch(() => {
              // If no onboarding status, assume it's not started
              setOnboardingStatus({ isComplete: true });
            })
            .finally(() => setStatusLoading(false));
        });
    } else {
      setStatusLoading(false);
    }
  }, [user, loading, isHostEntry]);

  if (loading || statusLoading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!user) {
    // Preserve the intended destination so login can return the user there
    // (e.g. the booking-completed email -> /review/:id while logged out).
    const next = encodeURIComponent(location.pathname + location.search);
    // Host space (/dashboard/*) logs in via the Google-only host door; every
    // other protected route (e.g. /review/:id) is guest space -> OTP /login.
    const loginPath = location.pathname.startsWith('/dashboard') ? '/login-as-vendor' : '/login';
    return <Navigate to={`${loginPath}?redirect=${next}`} replace />;
  }

  // A host is forced into onboarding ONLY if they have an in-progress, slug-based
  // onboarding session that isn't finished. Legacy/existing hosts (no onboarding
  // slug — they never used the new flow) are treated as complete and reach the
  // dashboard normally, instead of being trapped in the verify flow forever.
  //
  // RESUME map is the single source of truth in useOnboardingGuard — imported
  // here so this entry router and the per-step guard can never drift apart
  // (they did: this file used to encode the dead 6-step flow → double redirects).
  if (isHostEntry && isHost(user) && onboardingStatus && !onboardingStatus.isComplete && onboardingStatus.slug) {
    const done = onboardingStatus.stepCompleted || 1;
    if (done < 6) {
      return <Navigate to={`/vendor-register/${onboardingStatus.slug}/${RESUME[done] || 'claim'}`} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
