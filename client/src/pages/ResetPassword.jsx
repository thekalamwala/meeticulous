import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { resetPassword } from "../services/api";
import toast from "react-hot-toast";
import Seo from "../components/common/Seo";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Mirror the server policy (8–128 chars, 1 uppercase, 1 number) so the form
    // doesn't accept a password the API will reject (audit P2-11).
    if (
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      toast.error("Password must be 8–128 characters and include an uppercase letter and a number");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ email, otp, newPassword });
      toast.success("Password reset! Please log in with your new password.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center py-8 sm:py-12">
      <Seo title="Reset password — Meeticulous" robots="noindex,nofollow" />
      <div className="page-card w-full max-w-md p-5 sm:p-8">
        <h1 className="text-2xl font-bold mb-2">Reset password</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter the 6-digit code from your email and choose a new password.
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
          <div>
            <label className="block text-sm font-medium mb-1">Reset code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              className="fb-input tracking-widest font-mono"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              className="fb-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8+ chars, 1 uppercase, 1 number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              required
              className="fb-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Request a new code
          </Link>
          {" · "}
          <Link to="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
