import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Seo from '../../components/common/Seo';
import { Wordmark } from './OnboardingStepper';

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

const TRUST = ['Free to start', 'No card needed', 'Google Calendar synced'];

/**
 * GoogleStart — the sole entry point for host onboarding.
 *
 * Route: /vendor-register
 * Action: kicks off Google OAuth (identity + calendar scopes) via
 *         useAuth().startVendorGoogleAuth('signup').
 * After Google consent, the server creates the host account (role=host,
 * onboarding_slug = {email-handle}-{4 random}, stepCompleted=1) and redirects
 * to /auth/google/done → adoptSession. From there, ProtectedRoute routes hosts
 * with step<6 into /vendor-register/:slug/claim (PageStep).
 *
 * The sample page on the right sets the expectation of what they're about to
 * own — the very next screen shows it again, filled with THEIR name and photo.
 */
const GoogleStart = () => {
  const { startVendorGoogleAuth } = useAuth();

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <Seo title="Set up your Meeticulous page" robots="noindex,nofollow" />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-wrap items-center gap-14 px-5 py-14 sm:px-8">
        <div className="onb-rise min-w-0 flex-[999_1_440px]">
          <Wordmark />
          <h1 className="mt-7 font-heading text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.06] tracking-tight">
            Your booking page, <span className="text-primary-cta">live</span> in 2 minutes.
          </h1>
          <p className="mt-4 max-w-md text-base text-muted">
            Sign in with Google. We build your page from your name and photo, you add one service, and guests can book you today.
          </p>

          <button
            type="button"
            onClick={() => startVendorGoogleAuth('signup')}
            className="mt-8 inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-[6px] border border-black/10 bg-white px-7 py-3 text-[15px] font-semibold text-ink shadow-[0_8px_30px_rgba(26,26,26,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.35)]"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>

          <p className="mt-7 text-xs text-muted">
            By continuing, you agree to our{' '}
            <Link to="/host-agreement" className="underline-offset-2 hover:underline">Host Agreement</Link>,{' '}
            <Link to="/host-fees" className="underline-offset-2 hover:underline">Host Fees</Link>, and{' '}
            <Link to="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        {/* Sample page — what they're about to own. */}
        <div className="relative mx-auto w-full max-w-[340px] flex-[1_1_300px]" aria-hidden="true">
          <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[10px] bg-primary-light" />
          <div className="relative overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(26,26,26,0.35)]">
            <div className="bg-gradient-to-br from-primary/20 to-primary/85" style={{ aspectRatio: '3 / 1' }} />
            <div className="-mt-9 flex justify-center">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[10px] border-[3px] border-white bg-primary-light font-heading text-lg font-extrabold text-primary">You</div>
            </div>
            <div className="px-5 pb-5 pt-2.5 text-center">
              <p className="font-heading text-lg font-bold">Your name here</p>
              <p className="text-sm font-medium text-primary">What you do</p>
              <div className="mx-auto mt-3.5 flex max-w-[200px] flex-col gap-1.5"><div className="onb-shimmer" /><div className="onb-shimmer mx-auto w-2/3" /></div>
              <div className="mt-4 flex justify-between rounded-[6px] border border-black/5 px-3 py-2.5 text-sm">
                <span className="font-semibold">Your first service</span><span className="text-muted">30 min</span>
              </div>
              <div className="mt-3 rounded-[6px] bg-primary py-2.5 text-sm font-bold text-white">Book Now</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GoogleStart;
