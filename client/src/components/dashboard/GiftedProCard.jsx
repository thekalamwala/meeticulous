// Gifted Pro — the host's side on the billing page (docs/superpowers/plans/2026-11-04-gifted-pro.md).
// Shows the gift + personal note, a share card (their own booking link, so the host
// gains from posting), share-to-extend (+1 month after review) and the one
// pay-it-forward link. Data comes from the session's `user.gift`.
import { useState } from "react";
import { Gift, Copy, Link2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { submitGiftShare } from "../../services/api";
import { Card, Button, Input, cn } from "./ui";
import { GIFTED_PRO_LABEL } from "../../utils/themeUtils";

const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

const copy = async (text, what) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); }
  catch { toast.error("Couldn't copy — select and copy it manually"); }
};

const ShareLinks = ({ text, url }) => {
  const t = encodeURIComponent(text), u = encodeURIComponent(url);
  const links = [
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([name, href]) => (
        <a key={name} href={href} target="_blank" rel="noreferrer"
          className="rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary hover:no-underline focus:outline-none focus-visible:shadow-[var(--focus-ring)]">
          {name}
        </a>
      ))}
      <button type="button" onClick={() => copy(url, "Link")}
        className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary focus:outline-none focus-visible:shadow-[var(--focus-ring)]">
        <Copy className="h-3.5 w-3.5" /> Copy link
      </button>
    </div>
  );
};

const SHARE_COPY = {
  pending: "Thanks for posting! We're checking it — your extra month lands once it's approved.",
  approved: "Your post earned you an extra month of Pro. Thank you!",
  rejected: "We couldn't use that post for the extra month. Your gift is unchanged.",
};

export default function GiftedProCard({ onKeepPro }) {
  const { user, updateUser } = useAuth();
  const gift = user?.gift;
  const [postUrl, setPostUrl] = useState("");
  const [sending, setSending] = useState(false);
  if (!gift) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(gift.ends_at) - new Date()) / 86400000));
  const origin = window.location.origin;
  const bookingUrl = user?.username ? `${origin}/${user.username}?utm_source=gift_share&utm_medium=social` : origin;
  const forwardUrl = gift.forward?.code ? `${origin}/become-a-host?gift=${gift.forward.code}` : null;

  const sendShare = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await submitGiftShare(postUrl.trim());
      updateUser({ gift: { ...gift, share_status: data.share_status } });
      setPostUrl("");
      toast.success("Got it — we'll check your post soon.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't send your post");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mb-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Gift className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{GIFTED_PRO_LABEL}</p>
            <h2 className="text-base font-bold text-gray-900 sm:text-lg">Complimentary Pro from the Meeticulous team</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Every Pro feature is on until <strong>{fmtDay(gift.ends_at)}</strong>
              {" "}· {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </p>
            {gift.note && <p className="mt-2 font-serif text-base italic text-gray-700">“{gift.note}”</p>}
          </div>
        </div>
        <Button onClick={onKeepPro}>Keep Pro after your gift</Button>
      </div>

      <div className="rounded-2xl bg-blush/60 p-4">
        <p className="text-sm font-semibold text-gray-900">Tell people you got Pro</p>
        <p className="mb-3 mt-0.5 text-xs text-gray-600">Share your booking page. New clients find you, and you show off the upgrade.</p>
        <ShareLinks text="Meeticulous just gifted me Pro. Book a session with me here:" url={bookingUrl} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Send className="h-4 w-4 text-primary" /> Post about it, get another month free</p>
          {gift.share_status ? (
            <p className={cn("mt-2 text-xs", gift.share_status === "rejected" ? "text-gray-500" : "text-maroon")}>{SHARE_COPY[gift.share_status]}</p>
          ) : (
            <form onSubmit={sendShare} className="mt-2 space-y-2">
              <p className="text-xs text-gray-600">Post on LinkedIn, Instagram, X, Facebook or Threads and tag Meeticulous. Paste the link to your public post here. Once per gift.</p>
              <div className="flex gap-2">
                <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/…" aria-label="Link to your post" />
                <Button type="submit" variant="secondary" disabled={sending || !postUrl.trim()}>{sending ? "Sending…" : "Send"}</Button>
              </div>
            </form>
          )}
        </div>

        {forwardUrl && (
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Link2 className="h-4 w-4 text-primary" /> Pay it forward</p>
            {gift.forward.redeemed ? (
              <p className="mt-2 text-xs text-maroon">A fellow creator joined with your link and got a month of Pro. Nice one!</p>
            ) : (
              <>
                <p className="mb-3 mt-2 text-xs text-gray-600">Give one fellow creator a month of Pro. They get it when they sign up as a new host with this link.</p>
                <ShareLinks text="I'm gifting you a month of Meeticulous Pro — sign up with my link:" url={forwardUrl} />
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
