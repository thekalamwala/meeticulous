import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendOtp } from "../services/api";
import WhatsNewLink from "../components/auth/WhatsNewLink";
import Seo from "../components/common/Seo";
import toast from "react-hot-toast";

// Guest login door. WhatsApp number only — enter the number, get a one-time
// code on WhatsApp, verify, done. No email, no password, no social login: the
// number IS the identity. (Customer accounts are created automatically during
// booking; this page is the return path.)
const isPhone = (v) => /^\+?[\d\s\-()]{8,17}$/.test(v.trim());

const WhatsAppMark = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
    <path d="M.06 24l1.69-6.16a11.87 11.87 0 01-1.6-5.95C.15 5.34 5.5 0 12.06 0a11.82 11.82 0 018.42 3.49 11.82 11.82 0 013.48 8.41c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 01-5.69-1.45L.06 24zM6.6 20.13l.36.22a9.86 9.86 0 005.03 1.38 9.9 9.9 0 009.88-9.88 9.82 9.82 0 00-2.9-7 9.82 9.82 0 00-6.99-2.9 9.9 9.9 0 00-9.88 9.88c0 1.86.51 3.66 1.49 5.22l.24.38-1 3.65 3.77-.95zM17.5 14.3c-.07-.11-.25-.18-.53-.32-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.62.14-.18.27-.71.89-.87 1.07-.16.18-.32.2-.59.07a7.4 7.4 0 01-2.18-1.35 8.16 8.16 0 01-1.51-1.88c-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29s.98 2.66 1.12 2.84c.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.65.21 1.25.18 1.72.11.52-.08 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3z"/>
  </svg>
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
    <div className="app-container flex min-h-[calc(100vh-72px)] flex-col items-center justify-center py-8 sm:py-12">
      <Seo title="Log in — Meeticulous" robots="noindex,nofollow" />
      <div className="page-card w-full max-w-md p-5 sm:p-8">
        {/* STEP: WhatsApp number */}
        {step === "phone" && (
          <>
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
              <WhatsAppMark />
            </span>
            <h1 className="text-2xl font-bold mb-2">Log in</h1>
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
    </div>
  );
};

export default Login;
