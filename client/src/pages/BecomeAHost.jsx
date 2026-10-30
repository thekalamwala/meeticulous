import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import WhatsNewLink from '../components/auth/WhatsNewLink';
import BookDemoDrawer from '../components/auth/BookDemoDrawer';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { SITE_URL } from '../utils/seo';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>
  </svg>
);

const MailIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

// ── Brand logo lockup (replaces the 🦥 emoji) ──────────────────────────────────
// Uses the official manifest icon asset; the wordmark stays in our heading font.
const Logo = ({ className = '' }) => (
  <img
    src="/brand/ee-rounded-primary.svg"
    alt="Meeticulous"
    className={`block object-contain ${className}`}
  />
);

// /become-a-host — host signup. Google-only: one consent screen grants identity
// + calendar access, the account is created automatically in the callback.
const BecomeAHost = () => {
  const { startVendorGoogleAuth, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // A logged-in host has nothing to do here — send them to the dashboard.
  useEffect(() => {
    if (user?.is_host === true || user?.role === 'host' || user?.role === 'superadmin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Handle typed on the homepage hero — carried via router state, sessionStorage as fallback.
  const desiredUsername =
    location.state?.desiredUsername ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pendingSlothPage')) ||
    '';

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await startVendorGoogleAuth('signup');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start Google sign-up');
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-72px)] w-full lg:grid-cols-[1.05fr_1fr]">
      <Seo
        title="Get booked and paid — become a host on Meeticulous"
        description="Start taking bookings in minutes. Create your Meeticulous host page, publish services, and get paid — sign up free with Google."
        canonical={`${SITE_URL}/become-a-host`}
        image={ogCard('be-a-sloth', 'png')}
      />
      {/* ── LEFT · crimson brand-art panel (lg+ only) ──────────────────────────── */}
      <AuthBrandPanel
        title={<>Whatever you’re great at,<br /><span className="text-primary-light">get booked &amp; paid for it.</span></>}
        subtitle="Coaches, consultants, tutors and more get booked and paid on Meeticulous — one link, money over UPI, 0% commission."
      />

      {/* ── RIGHT · signup card ──────────────────────────────────────────────── */}
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:py-12">
        <div className="page-card relative w-full max-w-lg overflow-hidden p-6 text-center sm:p-8">
          <Link to="/" aria-label="Meeticulous — home" className="inline-block">
            <Logo className="mx-auto h-14 w-14" />
          </Link>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-cta">
            Become a host
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Become a host
          </h1>
          <p className="mt-1 text-base font-semibold text-gray-700">
            Get booked. Get paid.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
            Publish your services, share your booking page and get paid — calendar and Google Meet links set up automatically.
          </p>

          {desiredUsername && (
            <p className="mt-6 inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-ink">
              Claiming <span className="font-semibold">meeticulous.com/{desiredUsername}</span>
            </p>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="btn mt-7 flex w-full items-center justify-center gap-3 rounded-[5px] bg-ink py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <GoogleIcon />
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </button>

          <p className="mt-3 text-xs leading-relaxed text-gray-400">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="hover:underline">Terms &amp; Conditions</Link> and{' '}
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
          </p>

          {/* Secondary providers — shown but inactive ("Soon"). LinkedIn login and
              email sign-up have no backend yet; enable when those flows land. */}
          <button
            type="button" disabled aria-disabled="true" title="Coming soon"
            className="btn btn--outline mt-3 flex w-full cursor-not-allowed items-center justify-center gap-3 border-black/10 bg-gray-100 py-3 text-sm font-semibold text-gray-400"
          >
            <LinkedInIcon />
            Sign up with LinkedIn
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Soon</span>
          </button>
          <button
            type="button" disabled aria-disabled="true" title="Coming soon"
            className="btn btn--outline mt-3 flex w-full cursor-not-allowed items-center justify-center gap-3 border-black/10 bg-gray-100 py-3 text-sm font-semibold text-gray-400"
          >
            <MailIcon />
            Sign up with email
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Soon</span>
          </button>

          <ul className="mt-6 space-y-2 text-left text-xs text-gray-500">
            <li className="flex gap-2">
              <Check />
              <span>No password to remember — your Google account is your login</span>
            </li>
            <li className="flex gap-2">
              <Check />
              <span>Calendar connected instantly — busy times never get booked</span>
            </li>
            <li className="flex gap-2">
              <Check />
              <span>Google Meet links created for every online booking</span>
            </li>
          </ul>

          {/* Book a demo — 1:1 onboarding call with the founder */}
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-black/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Or</span>
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            className="btn flex w-full items-center justify-center gap-3 border-2 border-primary-cta bg-primary py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors hover:bg-black hover:text-primary-cta"
          >
            Book A Demo
          </button>

          <p className="mt-8 text-sm text-gray-500">
            Already a host?{' '}
            <Link to="/login-as-vendor" className="font-semibold text-primary hover:underline">Log in</Link>
          </p>

          {/* Book-a-demo panel slides up from the bottom of this card, filling it. */}
          <BookDemoDrawer open={demoOpen} onClose={() => setDemoOpen(false)} />
        </div>

        {/* Outside the card */}
        <WhatsNewLink className="mt-6" />
      </main>
    </div>
  );
};

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default BecomeAHost;
