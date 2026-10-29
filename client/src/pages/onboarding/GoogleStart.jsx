import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Seo from '../../components/common/Seo';

// Inline Google "G" logo SVG — no external file dependency.
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

/**
 * GoogleStart — the sole entry point for host onboarding.
 *
 * Route: /vendor-register
 * Action: kicks off Google OAuth (identity + calendar scopes) via
 *         useAuth().startVendorGoogleAuth('signup').
 * After Google consent, the server creates the host account (role=host,
 * onboarding_slug=auto-username, stepCompleted=1) and redirects to
 * /auth/google/done → adoptSession. From there, ProtectedRoute (a later
 * unit) routes hosts with step<6 into /vendor-register/:slug/claim.
 *
 * HARD RULE: ≤100vh, no page scroll.
 */
const GoogleStart = () => {
  const { startVendorGoogleAuth } = useAuth();

  const handleGoogleSignup = () => {
    startVendorGoogleAuth('signup');
  };

  return (
    <div className="app-container flex items-center justify-center min-h-screen px-4">
      <Seo title="Set up your Meeticulous page" robots="noindex,nofollow" />
      <div className="page-card w-full max-w-sm p-6 sm:p-8 flex flex-col items-center text-center">
        {/* Sloth brandmark */}
        <div
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-5"
          aria-hidden="true"
        >
          <span className="text-white text-xl font-bold select-none">S</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
          Start hosting on Book&nbsp;A&nbsp;Sloth
        </h1>

        <p className="text-sm text-gray-500 mb-7 leading-relaxed max-w-[260px]">
          Google pulls in your name and photo so you skip the forms and go live
          faster.
        </p>

        <button
          onClick={handleGoogleSignup}
          className="btn w-full flex items-center justify-center gap-2.5 border border-gray-300 bg-white text-gray-800 font-medium py-2.5 text-sm hover:bg-gray-50 transition"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-gray-400">
          Free to start. No credit card.
        </p>

        <p className="mt-2 text-xs text-gray-400">
          By continuing, you agree to our{' '}
          <Link to="/host-agreement" className="hover:underline">Host Agreement</Link>,{' '}
          <Link to="/host-fees" className="hover:underline">Host Fees</Link>, and{' '}
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default GoogleStart;
