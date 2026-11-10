import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendOtp } from "../services/api";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";
import AuthMobilePattern from "../components/auth/AuthMobilePattern";
import Seo from "../components/common/Seo";
import OtpSlots from "../components/common/OtpSlots";
import toast from "react-hot-toast";
import ContinueWithLinkedIn, { useLinkedinEnabled } from "../components/ContinueWithLinkedIn";

// One login door for both sides of the single identity. A toggle picks the form:
//  - "I'm booking" → guest WhatsApp OTP (the number IS the identity; accounts are
//    auto-created during booking, this is the return path).
//  - "I'm a host"  → Google, or LinkedIn when host_linkedin_login is ON.
// Mounted at BOTH /login (default guest) and /login-as-vendor (default host). The
// vendor route is kept alive only so server OAuth callbacks + old links still
// resolve — it is never linked publicly; public host links point at /login?as=host.
// Which form shows first comes from (in order): ?as=host|guest, the route path,
// then the viewer's last choice. This replaces the old split Login.jsx / HostLogin.jsx.

// ── Host-side Google/LinkedIn callback error copy (this page is the OAuth error
// target: GoogleAuthDone / LinkedinAuthDone redirect here with ?error=…). ──
const ERROR_COPY = {
  invalid_state: "That sign-in link expired. Please try again.",
  customer_email: "We couldn't sign you in with that Google account. Please try again.",
  create_failed: "We could not create your account. Please try again.",
  auth_failed: "Google sign-in failed. Please try again.",
  cancelled: "Google sign-in was cancelled.",
  linkedin_failed: "LinkedIn sign-in failed. Please try again.",
  linkedin_cancelled: "LinkedIn sign-in was cancelled.",
  signin_needed: "You're all set! Please sign in to continue.",
  calendar_account: "This Google account is connected as a calendar to an existing host. Sign in with LinkedIn instead.",
  email_has_account: "This email already has a host account. Sign in with Google.",
  linkedin_off: "LinkedIn sign-in isn't available right now.",
  email_unverified: "Verify the email on your LinkedIn account, then try again.",
  no_email: "Google did not share an email address. Check your account permissions.",
};
// The Google calendar-account guard is live with the LinkedIn flag OFF too — then
// there is no LinkedIn button to point at.
const CALENDAR_ACCOUNT_NO_LINKEDIN =
  "This Google account is connected as a calendar to an existing host. Sign in with the account you used to sign up.";

const STORE_KEY = "mt_login_view"; // remembers the viewer's last door choice

const isPhone = (v) => /^\+?[\d\s\-()]{8,17}$/.test(v.trim());

const Logo = ({ className = "" }) => (
  <img src="/brand/ee-rounded-primary.svg" alt="Meeticulous" className={`block object-contain ${className}`} />
);

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

// Shown but inactive ("Soon") — email login has no backend yet; LinkedIn shows
// this only while host_linkedin_login is OFF.
const SoonBtn = ({ icon, label }) => (
  <button
    type="button" disabled aria-disabled="true" title="Coming soon"
    className="btn btn--outline mt-3 flex w-full cursor-not-allowed items-center justify-center gap-3 border-maroon/10 bg-neutral-50 py-2.5 text-sm font-semibold text-muted"
  >
    {icon}
    {label}
    <span className="rounded-full bg-maroon/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Soon</span>
  </button>
);

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-fg" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Read the initial door from ?as=, else the route path, else the stored choice.
const initialView = (search, pathname) => {
  const as = new URLSearchParams(search).get("as");
  if (as === "host" || as === "guest") return as;
  if (pathname.includes("login-as-vendor")) return "host";
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored === "host" || stored === "guest") return stored;
  } catch { /* localStorage blocked — fall through */ }
  return "guest";
};

const UnifiedLogin = () => {
  const { startVendorGoogleAuth, loginWithOtp, user, mode, setMode, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const linkedinOn = useLinkedinEnabled();

  const [view, setView] = useState(() => initialView(location.search, location.pathname));

  // Honour ?redirect= only for internal single-slash paths (avoid open-redirects).
  const rawRedirect = searchParams.get("redirect") || "";
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/user";

  const [busy, setBusy] = useState(false);
  // Guest OTP state
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const verifying = useRef(false);     // in-flight guard: auto-submit + button can't double-fire
  const justLoggedIn = useRef(false);  // set on OTP success so the switch-guard never fires post-login

  const pickView = (v) => {
    setView(v);
    try { localStorage.setItem(STORE_KEY, v); } catch { /* ignore */ }
  };

  // Dual-login switch guard. One identity, two modes. If a session already exists
  // and it matches the door shown → go to that space. If it is the OTHER session
  // (e.g. a guest session while the Host door is shown), end it and reload this
  // door clean — same force-logout the two split pages did, now keyed on the
  // toggle instead of the route. Keyed on `view` so flipping the toggle while
  // logged in switches doors too. No loop: logout hard-redirects with no user, so
  // the reloaded page returns early here.
  useEffect(() => {
    if (!user || justLoggedIn.current) return;
    if (view === "host") {
      if (mode === "hosting" || user.role === "superadmin") navigate("/dashboard", { replace: true });
      else logout({ to: "/login?as=host" });
    } else {
      if (mode === "traveling") navigate(redirectTo, { replace: true });
      else logout({ to: "/login?as=guest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode, view]);

  // Surface a host OAuth-callback error (this page is the /auth/*/done error target).
  // Guest flow never sets ?error (its errors are inline toasts), so this is a no-op there.
  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    const msg = (err === "calendar_account" && !linkedinOn && CALENDAR_ACCOUNT_NO_LINKEDIN)
      || ERROR_COPY[err] || "Sign-in failed. Please try again.";
    if (err === "signin_needed") toast(msg, { icon: "👋" });
    else toast.error(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Host: Google ──
  const handleGoogle = async () => {
    setBusy(true);
    try {
      await startVendorGoogleAuth("login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start Google sign-in");
      setBusy(false);
    }
  };

  // ── Guest: OTP ──
  const finish = () => {
    justLoggedIn.current = true;
    setMode("traveling");
    toast.success("Welcome back!");
    navigate(redirectTo);
  };

  const goToOtp = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    if (!isPhone(phone)) return toast.error("Enter your WhatsApp number");
    setBusy(true);
    try {
      await sendOtp({ phone, purpose: "login" });
      setStep("otp");
      toast.success("Code sent on WhatsApp");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  // Verify the moment all six digits land — no separate click. Not optimistic:
  // the session is only granted once the server confirms. A wrong code clears the
  // input, prompting a retype and stopping the auto-submit effect from re-firing.
  const submitOtp = async () => {
    if (verifying.current) return;
    if (otp.length !== 6) return;
    verifying.current = true;
    setBusy(true);
    try {
      const data = await loginWithOtp(phone, otp);
      finish(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid code");
      setOtp("");
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (view === "guest" && step === "otp" && otp.length === 6) submitOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step, view]);

  const isHost = view === "host";

  return (
    <div className="relative grid h-[100dvh] w-full overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      <Seo title={isHost ? "Host login — Meeticulous" : "Log in — Meeticulous"} robots="noindex,nofollow" />
      <AuthMobilePattern />

      {/* ── LEFT · brand panel (host copy by default; guest copy when booking) ── */}
      {isHost ? (
        <AuthBrandPanel />
      ) : (
        <AuthBrandPanel
          title={<>Welcome back.<br /><span className="font-serif italic text-primary-light">Your bookings, in one place.</span></>}
          subtitle="Log in to see upcoming appointments, reschedule, and message your hosts."
          points={['Reschedule anytime', 'WhatsApp reminders', 'No password to remember']}
        />
      )}

      {/* ── RIGHT · toggle + the chosen form ── */}
      <main className="relative z-10 flex flex-col items-center justify-center overflow-y-auto px-5 py-4">
        <div className="w-full max-w-md p-6 sm:p-8">
          <Logo className="mx-auto mb-5 h-12 w-12 lg:hidden" />

          {/* door toggle */}
          <div className="mx-auto mb-7 flex w-full max-w-xs rounded-full bg-maroon/5 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => pickView("guest")}
              className={`flex-1 rounded-full py-2 transition-colors ${!isHost ? "bg-maroon text-white shadow-sm" : "text-muted hover:text-ink"}`}
            >
              I'm booking
            </button>
            <button
              type="button"
              onClick={() => pickView("host")}
              className={`flex-1 rounded-full py-2 transition-colors ${isHost ? "bg-maroon text-white shadow-sm" : "text-muted hover:text-ink"}`}
            >
              I'm a host
            </button>
          </div>

          {/* ── HOST form ── */}
          {isHost && (
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight text-maroon sm:text-3xl">Welcome back</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Log in to your host dashboard — manage bookings, services and payouts.
              </p>

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="btn mt-7 flex w-full items-center justify-center gap-3 rounded-[16px] bg-ink py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <GoogleIcon />
                {busy ? "Opening Google…" : "Continue with Google"}
              </button>

              {linkedinOn ? (
                <>
                  <ContinueWithLinkedIn intent="login" />
                  <p className="mt-3 text-xs text-muted">Already a host? Use the same option you signed up with.</p>
                </>
              ) : (
                <SoonBtn icon={<LinkedInIcon />} label="Continue with LinkedIn" />
              )}
              <SoonBtn icon={<MailIcon />} label="Continue with email" />

              <ul className="mt-6 space-y-2 text-left text-xs text-muted">
                <li className="flex gap-2"><Check /><span>No password to remember — your Google account is your login</span></li>
                <li className="flex gap-2"><Check /><span>Calendar stays synced — busy times never get booked</span></li>
              </ul>

              <p className="mt-8 text-sm text-muted">
                New here?{" "}
                <Link to="/become-a-host" className="font-semibold text-primary hover:underline">Sign up as a Host</Link>
              </p>
            </div>
          )}

          {/* ── GUEST form ── */}
          {!isHost && step === "phone" && (
            <>
              <h1 className="font-display text-maroon text-2xl font-bold mb-2">Log in</h1>
              <p className="mb-6 text-sm text-muted">
                Enter your WhatsApp number and we’ll send you a one-time code.
              </p>

              <form onSubmit={goToOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="+91 98765 43210"
                    className="fb-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !phone}
                  className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {busy ? "Sending code..." : "Send code on WhatsApp"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">
                Want to get booked?{" "}
                <Link to="/become-a-host" className="text-primary hover:underline">Become a host</Link>
              </p>
            </>
          )}

          {!isHost && step === "otp" && (
            <>
              <button onClick={() => setStep("phone")} className="text-sm text-muted hover:text-ink mb-4">← Back</button>
              <h1 className="font-display text-maroon text-2xl font-bold mb-2">Enter your code</h1>
              <p className="mb-6 text-sm text-muted">
                We sent a 6-digit code to <strong>{phone}</strong> on WhatsApp.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); submitOtp(); }} className="space-y-4">
                <OtpSlots
                  autoFocus
                  placeholder="123456"
                  aria-label="Enter your code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button
                  type="submit"
                  disabled={busy || otp.length !== 6}
                  className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {busy ? "Verifying..." : "Verify & log in"}
                </button>
              </form>
              <button onClick={() => goToOtp()} disabled={busy} className="mt-3 w-full text-sm text-primary hover:underline disabled:opacity-50">
                Resend code
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default UnifiedLogin;
