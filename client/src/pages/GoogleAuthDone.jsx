import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Seo from '../components/common/Seo';
import PetalSpinner from '../components/common/PetalSpinner';

// /auth/google/done — landing page for the vendor Google OAuth callback.
// Session tokens arrive in the URL FRAGMENT (never sent to any server/logs):
//   #access_token=...&refresh_token=...&new=1|0
const GoogleAuthDone = () => {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('access_token');
    const refresh = params.get('refresh_token');
    const newFlag = params.get('new'); // '1' new vendor · 'upgrade' customer→host · '0' returning
    const isNew = newFlag === '1';
    const isUpgrade = newFlag === 'upgrade';

    // Scrub tokens from the address bar immediately
    window.history.replaceState(null, '', '/auth/google/done');

    if (!token || !refresh) {
      navigate('/login-as-vendor?error=auth_failed', { replace: true });
      return;
    }

    adoptSession({ token, refresh_token: refresh })
      .then(() => {
        toast.success(
          isNew ? 'Welcome to Meeticulous! 🦥'
            : isUpgrade ? "Let's set up your hosting 🦥"
            : 'Welcome back!'
        );
        // /dashboard is onboarding-guarded — a new or just-upgraded host is
        // auto-routed into the /vendor-register steps by ProtectedRoute.
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        // Tokens were valid (account exists) — adopting the session failed, so
        // nudge to sign in rather than showing a hard "sign-in failed" dead-end.
        navigate('/login-as-vendor?error=signin_needed', { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Seo title="Signing you in — Meeticulous" robots="noindex,nofollow" />
      <div className="text-center">
        <div className="mb-4 flex justify-center"><PetalSpinner size={48} /></div>
        <p className="text-sm text-gray-500">Setting up your account…</p>
      </div>
    </div>
  );
};

export default GoogleAuthDone;
