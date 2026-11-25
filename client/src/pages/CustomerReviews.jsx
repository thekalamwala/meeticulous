import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Sparkles } from "lucide-react";
import { getReceivedReviews } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isHost } from "../utils/roleRoutes";
import PetalSpinner from "../components/common/PetalSpinner";

// /reviews — reviews the current user has RECEIVED.
// Guests see only host→guest reviews (as traveler).
// Hosts get a tab bar: "As Traveler" (host_to_guest) | "As Host" (guest_to_host).

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Stars = ({ n }) => (
  <span className="mt-0.5 inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-marigold text-marigold" : "text-neutral-200"}`} strokeWidth={1.5} />
    ))}
  </span>
);

const CustomerReviews = () => {
  const { user, mode } = useAuth();
  const canHost = isHost(user);

  // Default to hosting tab if the user is currently in hosting mode, else traveling.
  const [tab, setTab] = useState(canHost && mode === "hosting" ? "hosting" : "traveling");
  const [data, setData] = useState({ reviews: [], count: 0, avg: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const direction = tab === "hosting" ? "guest_to_host" : "host_to_guest";
    getReceivedReviews(direction)
      .then(({ data }) => setData(data || { reviews: [], count: 0, avg: 0 }))
      .catch(() => setData({ reviews: [], count: 0, avg: 0 }))
      .finally(() => setLoading(false));
  }, [tab]);

  const { reviews, count, avg } = data;

  const subcopy = tab === "hosting"
    ? "What guests say about you as a host."
    : "What hosts say about you after a session.";

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-extrabold leading-none tracking-[-0.04em] text-maroon">Reviews</h1>
            <p className="mt-1.5 text-[13px] font-medium text-ink/55">{subcopy}</p>
          </div>
          {count > 0 && (
            <div className="text-right">
              <p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">{avg}</p>
              <p className="mt-1 text-[11px] font-semibold text-ink/50">{count} review{count === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>

        {/* Tab bar — only visible for hosts */}
        {canHost && (
          <div className="mb-5 inline-flex gap-1 rounded-full border-2 border-neutral-200 bg-white p-0.5">
            {[["traveling", "As Guest"], ["hosting", "As Host"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-full px-4 py-1.5 text-[11.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${tab === k ? "bg-maroon text-white" : "text-ink/55 hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center"><PetalSpinner size={40} /></div>
        ) : count === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-10 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-blush">
              <Star className="text-maroon" size={26} strokeWidth={1.8} />
            </span>
            <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">No reviews yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium leading-snug text-ink/50">
              {tab === "hosting"
                ? "Guests can leave a review after a completed session with you. They'll show up here."
                : "After your sessions, hosts can leave a rating and a note about you. They'll show up here."}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-neutral-200 bg-cream px-3 py-1.5 text-[11px] font-semibold text-ink/50">
              <Sparkles size={12} strokeWidth={2.2} /> Reviews open up as you complete bookings
            </div>
            {tab === "traveling" && (
              <div className="mt-5">
                <Link to="/" className="text-[12.5px] font-bold text-maroon hover:underline">Book a session →</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reviews.map((r) => {
              const author = r.profiles || {};
              return (
                <div key={r.id} className="rounded-[8px] border-2 border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-2.5">
                    {author.profile_image ? (
                      <img src={author.profile_image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush font-display text-[12px] font-extrabold text-maroon">
                        {author.name ? author.name[0].toUpperCase() : "U"}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-bold text-ink">{author.name || "Someone"}</p>
                        <span className="whitespace-nowrap text-[11px] font-medium text-ink/45">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Stars n={r.rating} />
                        {r.bookings?.services?.title && (
                          <p className="truncate text-[11px] font-medium text-ink/45">{r.bookings.services.title}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 text-[12.5px] font-medium leading-snug text-ink/70">{r.comment}</p>}
                </div>
              );
            })}
          </div>
        )}
    </>
  );
};

export default CustomerReviews;
