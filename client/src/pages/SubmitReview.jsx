import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getMyPlatformReview, saveMyPlatformReview } from "../services/api";
import Seo from "../components/common/Seo";

// /submit-review — a signed-in host or guest reviews Meeticulous itself (v3.185).
// Shareable link for marketing social proof. Sign-in is required so every review
// is tied to a real account; nothing is public until an admin approves it AND the
// author ticks consent. Hosts use the Google door (GoogleAuthDone honours the
// stashed return path); guests use WhatsApp OTP with ?redirect=.

const RETURN_KEY = "mt_after_host_login"; // read by GoogleAuthDone
const MIN_BODY = 10;
const MAX_BODY = 2000;

const STATUS_COPY = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Not published",
};
const STATUS_BADGE = { pending: "mt-badge--warning", approved: "mt-badge--success", rejected: "mt-badge--danger" };

const Shell = ({ children }) => (
  <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-cream px-5 py-10 sm:py-14">
    <Seo title="Review Meeticulous" robots="noindex,nofollow" />
    <div className="mt-card mt-card--outline w-full max-w-lg !p-6 sm:!p-8">{children}</div>
  </div>
);

const Heading = () => (
  <>
    <h1 className="font-display text-3xl font-extrabold tracking-tight text-maroon">
      How is Meeticulous <span className="font-serif font-normal italic">working for you?</span>
    </h1>
    <p className="mt-2 text-sm text-ink/70">
      Your honest review helps other hosts and guests decide. It takes a minute.
    </p>
  </>
);

export default function SubmitReview() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let active = true;
    getMyPlatformReview()
      .then(({ data }) => {
        if (!active || !data) return;
        setExisting(data);
        setRating(data.rating);
        setTitle(data.title || "");
        setBody(data.body || "");
        setConsent(!!data.consent_public);
      })
      .catch(() => { /* no review yet */ })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user, authLoading]);

  const hostSignIn = () => {
    try { sessionStorage.setItem(RETURN_KEY, "/submit-review"); } catch { /* storage blocked: lands on dashboard */ }
    navigate("/login?as=host");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) { toast.error("Pick a star rating"); return; }
    if (body.trim().length < MIN_BODY) { toast.error(`Write at least ${MIN_BODY} characters`); return; }
    setBusy(true);
    try {
      const { data } = await saveMyPlatformReview({ rating, title, body, consent_public: consent });
      setSaved(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save your review");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <Shell><p className="py-8 text-center text-sm text-ink/60">Loading…</p></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <Heading />
        <p className="mt-6 text-sm font-medium text-ink">Sign in to leave your review</p>
        <p className="mt-1 text-xs text-ink/60">
          We only accept reviews from real Meeticulous accounts, so every review is genuine.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={hostSignIn} className="mt-btn mt-btn--block">
            Host? Sign in with Google
          </button>
          <Link to="/login?redirect=%2Fsubmit-review" className="mt-btn mt-btn--secondary mt-btn--block hover:no-underline">
            Guest? Sign in with WhatsApp
          </Link>
        </div>
      </Shell>
    );
  }

  if (saved) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-maroon">Thank you.</h1>
        <p className="mt-3 text-sm text-ink/80">
          {saved.consent_public
            ? "We'll check your review, and once it's approved it can appear on our website and social pages with your name and photo."
            : "Your review is saved privately. It helps us improve but won't be shown publicly."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/wall-of-love" className="mt-btn hover:no-underline">See the Wall of Love</Link>
          <button type="button" onClick={() => { setExisting(saved); setSaved(null); }} className="mt-btn mt-btn--ghost">
            Edit my review
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Heading />
      {existing && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink/70">
          <span className={`mt-badge ${STATUS_BADGE[existing.status] || ""}`}>{STATUS_COPY[existing.status] || existing.status}</span>
          Saving changes sends your review back for approval.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div className="mt-field">
          <span className="mt-label" id="rating-label">Your rating</span>
          <div className="flex gap-1" role="radiogroup" aria-labelledby="rating-label">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className={`rounded-full px-1 text-3xl leading-none transition-colors ${n <= rating ? "text-maroon" : "text-ink/20 hover:text-ink/40"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="mt-field">
          <span className="mt-label">Headline <span className="text-ink/50">(optional)</span></span>
          <span className="mt-input">
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
          </span>
        </label>

        <label className="mt-field">
          <span className="mt-label">Your review</span>
          <span className="mt-input !h-auto !items-start py-3">
            <textarea
              rows={5}
              value={body}
              maxLength={MAX_BODY}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What has Meeticulous changed for you? What could be better?"
              className="w-full flex-1 resize-y bg-transparent text-ink outline-none placeholder:text-ink/40"
            />
          </span>
          <span className="mt-hint">{body.trim().length < MIN_BODY ? `At least ${MIN_BODY} characters` : `${body.length}/${MAX_BODY}`}</span>
        </label>

        <label className="mt-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="mt-check__box" aria-hidden="true" />
          <span>
            Meeticulous may show my name, photo and this review on its website and social media.
            <span className="mt-check__desc">Leave unticked to keep your review private. You can change this any time.</span>
          </span>
        </label>

        <button type="submit" disabled={busy} className="mt-btn mt-btn--block disabled:opacity-50">
          {busy ? "Saving…" : existing ? "Update my review" : "Submit my review"}
        </button>
      </form>
    </Shell>
  );
}
