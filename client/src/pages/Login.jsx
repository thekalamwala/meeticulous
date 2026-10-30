import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendOtp } from "../services/api";
import AuthBrandPanel from "../components/auth/AuthBrandPanel";
import WhatsNewLink from "../components/auth/WhatsNewLink";
import Seo from "../components/common/Seo";
import toast from "react-hot-toast";

// Guest login door. WhatsApp number only — enter the number, get a one-time
// code on WhatsApp, verify, done. No email, no password, no social login: the
// number IS the identity. (Customer accounts are created automatically during
// booking; this page is the return path.)
const isPhone = (v) => /^\+?[\d\s\-()]{8,17}$/.test(v.trim());

// ee app-icon (crimson tile) — shared brand mark across every auth door.
const Logo = ({ className = "" }) => (
  <img src="/brand/ee-rounded-primary.svg" alt="Meeticulous" className={`block ${className}`} />
);

const Login = () => {
  const { loginWithOtp, user, mode, setMode, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Honour ?redirect= only for internal single-slash paths (avoid open-redirects).
  const rawRedirect = searchParams.get("redirect") || "";
  const redirectTo = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/user";

  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const verifying = useRef(false); // in-flight guard: auto-submit + button can't double-fire
  const justLoggedIn = useRef(false); // set on OTP success so the switch-guard below never fires post-login

  // Dual login. This is the GUEST door. If a session already exists:
  //  - already in guest space (traveling) → nothing to do here, go to /user.
  //  - arriving from the host session (hosting) → this is a context switch, so
  //    end the host session first (force logout); the OTP form then re-appears.
  useEffect(() => {
    if (!user || justLoggedIn.current) return;
    if (mode === "traveling") {
      navigate(redirectTo, { replace: true });
    } else {
      // Switching from the host session → end it, land back on this guest door.
      logout({ to: "/login" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  // Guest door always lands in guest space and pins traveling mode, regardless of
  // whether the account can also host.
  const finish = () => {
    justLoggedIn.current = true;
    setMode("traveling");
    toast.success("Welcome back!");
    navigate(redirectTo);
  };

  const goToOtp = async (e) => {
    if (e) e.preventDefault();
    if (busy) return; // guard against double-send
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

  // Principle #2 (act immediately on input): verify the code the moment all six
  // digits land — no separate "click Verify" step — so a paste or the last
  // keystroke goes straight to the server. This is NOT optimistic auth: the
  // session is only granted once the server confirms. A wrong code clears the
  // input, which both prompts a retype and stops the auto-submit effect from
  // re-firing the same failed code in a loop.
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

  // Auto-submit as soon as the code is complete.
  useEffect(() => {
    if (step === "otp" && otp.length === 6) submitOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  return (
    <div className="grid min-h-[calc(100vh-72px)] w-full lg:grid-cols-[1.05fr_1fr]">
      <Seo title="Log in — Meeticulous" robots="noindex,nofollow" />
      {/* ── LEFT · crimson brand-art panel (lg+ only) ── */}
      <AuthBrandPanel
        title={<>Welcome back.<br /><span className="text-primary-light">Your bookings, in one place.</span></>}
        subtitle="Log in to see upcoming appointments, reschedule, and message your hosts."
        points={['Reschedule anytime', 'WhatsApp reminders', 'No password to remember']}
      />

      {/* ── RIGHT · OTP card + outside-the-box link ── */}
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:py-12">
        <div className="page-card w-full max-w-md p-6 sm:p-8">
          <Logo className="mb-5 h-12 w-12" />
        {/* STEP: WhatsApp number */}
        {step === "phone" && (
          <>
            <h1 className="font-heading text-2xl font-bold mb-2">Log in</h1>
            <p className="mb-6 text-sm text-gray-500">
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

            <p className="mt-6 text-center text-sm text-gray-500">
              Want to get booked?{" "}
              <Link to="/become-a-host" className="text-primary hover:underline">Become a host</Link>
            </p>
          </>
        )}

        {/* STEP: OTP */}
        {step === "otp" && (
          <>
            <button onClick={() => setStep("phone")} className="text-sm text-gray-400 hover:text-gray-600 mb-4">← Back</button>
            <h1 className="text-2xl font-bold mb-2">Enter your code</h1>
            <p className="mb-6 text-sm text-gray-500">
              We sent a 6-digit code to <strong>{phone}</strong> on WhatsApp.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); submitOtp(); }} className="space-y-4">
              <input
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="123456"
                className="fb-input text-center tracking-[0.5em] text-lg"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {/* Verify fires automatically on the 6th digit; this button is a
                  fallback (e.g. if the code was cleared after a wrong attempt). */}
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

        {/* Outside the card */}
        <WhatsNewLink className="mt-6" />
      </main>
    </div>
  );
};

export default Login;
