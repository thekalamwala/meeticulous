import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";
import WhatsNewLink from "../components/auth/WhatsNewLink";
import Seo from "../components/common/Seo";
import toast from "react-hot-toast";

// /login-as-vendor — the host login door. Hosts authenticate with Google only
// (one consent screen grants identity + calendar). Kept strictly host-focused:
// no customer login, no link to the generic guest /login. This page is also the
// Google-callback error target (GoogleAuthDone redirects here with ?error=…).
const ERROR_COPY = {
  invalid_state: "That sign-in link expired. Please try again.",
  customer_email: "We couldn't sign you in with that Google account. Please try again.",
  create_failed: "We could not create your account. Please try again.",
  auth_failed: "Google sign-in failed. Please try again.",
  signin_needed: "You're all set! Please sign in to continue.",
  no_email: "Google did not share an email address. Check your account permissions.",
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const Logo = ({ className = "" }) => (
  <img
    src="/web-app-manifest-192x192.png"
    alt="Meeticulous"
    className={`block rounded-[6px] object-contain ${className}`}
  />
);

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const HostLogin = () => {
  const { startVendorGoogleAuth, user, mode, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);

  // Dual login. This is the HOST door. If a session already exists:
  //  - already in host space (hosting / superadmin) → nothing to do, go to
  //    /dashboard.
  //  - arriving from the guest session (traveling) → this is a context switch, so
  //    end the guest session first (force logout); the Google button then works
  //    on a clean slate.
  useEffect(() => {
    if (!user) return;
    if (mode === "hosting" || user.role === "superadmin") {
      navigate("/dashboard", { replace: true });
    } else {
      // Switching from the guest session → end it, land back on this host door.
      logout({ to: "/login-as-vendor" });
    }
  }, [user, mode, navigate, logout]);

  // Surface a Google-callback error (this page is the /auth/google/done error target).
  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    const msg = ERROR_COPY[err] || "Sign-in failed. Please try again.";
    if (err === "signin_needed") toast(msg, { icon: "👋" });
    else toast.error(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await startVendorGoogleAuth("login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start Google sign-in");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-72px)] w-full lg:grid-cols-[1.05fr_1fr]">
      <Seo title="Host login — Meeticulous" robots="noindex,nofollow" />
      {/* ── LEFT · colourful brand panel (lg+ only) ──────────────────────────── */}
      <AuthBrandPanel />

      {/* ── RIGHT · login card + outside-the-box link ────────────────────────── */}
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:py-12">
        <div className="page-card w-full max-w-md p-6 text-center sm:p-8">
          <Logo className="mx-auto h-14 w-14" />

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-cta">
          Host login
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Welcome back
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
          Log in to your host dashboard — manage bookings, services and payouts.
        </p>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="btn btn--outline mt-7 flex w-full items-center justify-center gap-3 bg-white py-3 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition disabled:opacity-50"
        >
          <GoogleIcon />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        <ul className="mt-6 space-y-2 text-left text-xs text-gray-500">
          <li className="flex gap-2">
            <Check />
            <span>No password to remember — your Google account is your login</span>
          </li>
          <li className="flex gap-2">
            <Check />
            <span>Calendar stays synced — busy times never get booked</span>
          </li>
        </ul>

          <p className="mt-8 text-sm text-gray-500">
            New here?{" "}
            <Link to="/be-a-sloth" className="font-semibold text-primary hover:underline">Sign up as a Host</Link>
          </p>
        </div>

        {/* Outside the card */}
        <WhatsNewLink className="mt-6" />
      </main>
    </div>
  );
};

export default HostLogin;
