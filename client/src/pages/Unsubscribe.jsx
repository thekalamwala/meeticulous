import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getUnsubscribeStatus,
  unsubscribeEmail,
  resubscribeEmail,
} from "../services/api";
import Seo from "../components/common/Seo";

/**
 * /unsubscribe?u=<signed-token>
 * Opt out of MARKETING email (booking/payment/security mail keeps coming).
 * The token identifies the address, so no login is needed.
 */
const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("u") || "";

  const [state, setState] = useState("loading"); // loading | ready | invalid
  const [email, setEmail] = useState("");
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    getUnsubscribeStatus(token)
      .then(({ data }) => {
        setEmail(data.email);
        setUnsubscribed(data.unsubscribed);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    setBusy(true);
    try {
      await unsubscribeEmail(token);
      setUnsubscribed(true);
      toast.success("You've been unsubscribed from marketing emails");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleResubscribe = async () => {
    setBusy(true);
    try {
      await resubscribeEmail(token);
      setUnsubscribed(false);
      toast.success("You're subscribed again");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center py-8 sm:py-12">
      <Seo title="Unsubscribe — Meeticulous" robots="noindex,nofollow" />
      <div className="page-card w-full max-w-md p-5 sm:p-8 text-center">
        {state === "loading" && (
          <p className="text-sm text-gray-500 py-8">Loading…</p>
        )}

        {state === "invalid" && (
          <>
            <h1 className="text-xl font-bold mb-2">Link not valid</h1>
            <p className="text-sm text-gray-500 mb-6">
              This unsubscribe link is invalid or has expired. Use the link from a
              recent email, or contact support.
            </p>
            <Link to="/" className="text-primary hover:underline text-sm">
              Go home
            </Link>
          </>
        )}

        {state === "ready" && !unsubscribed && (
          <>
            <h1 className="text-xl font-bold mb-2">Unsubscribe from marketing emails?</h1>
            <p className="text-sm text-gray-500 mb-2">
              <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You'll stop getting promotional and reminder emails. Booking
              confirmations, payment receipts and security alerts will still be
              sent — those are required for your account.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={busy}
              className="btn w-full bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Updating…" : "Unsubscribe"}
            </button>
          </>
        )}

        {state === "ready" && unsubscribed && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2">You're unsubscribed</h1>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{email}</strong> won't receive marketing emails anymore.
              Changed your mind?
            </p>
            <button
              onClick={handleResubscribe}
              disabled={busy}
              className="btn w-full border border-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? "Updating…" : "Resubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
