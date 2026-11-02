import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../services/api";
import toast from "react-hot-toast";
import Seo from "../components/common/Seo";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
      toast.success("Reset code sent — check your email");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="app-container flex h-[calc(100dvh-57px)] items-center justify-center overflow-hidden py-4">
        <Seo title="Forgot password — Meeticulous" robots="noindex,nofollow" />
        <div className="page-card w-full max-w-md max-h-full overflow-y-auto p-5 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-success-fg"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="font-display text-maroon text-xl font-bold mb-2">Check your email</h2>
          <p className="text-sm text-muted mb-6">
            If <strong>{email}</strong> has an account, we've sent a 6-digit
            reset code. It expires in 10 minutes.
          </p>
          <button
            onClick={() => navigate("/reset-password", { state: { email } })}
            className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark"
          >
            Enter reset code
          </button>
          <p className="mt-4 text-sm text-muted">
            Didn't get it?{" "}
            <button
              onClick={() => setSent(false)}
              className="text-primary hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container flex h-[calc(100dvh-57px)] items-center justify-center overflow-hidden py-4">
      <Seo title="Forgot password — Meeticulous" robots="noindex,nofollow" />
      <div className="page-card w-full max-w-md max-h-full overflow-y-auto p-5 sm:p-8">
        <img src="/brand/ee-rounded-primary.svg" alt="Meeticulous" className="mb-5 h-11 w-11" />
        <h1 className="font-display text-maroon text-2xl font-bold mb-2">Forgot password?</h1>
        <p className="mb-6 text-sm text-muted">
          Enter your email and we'll send you a 6-digit code to reset your
          password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              className="fb-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset code"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          Remembered it?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
