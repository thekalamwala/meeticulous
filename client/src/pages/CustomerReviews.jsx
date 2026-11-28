import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getReceivedReviews } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { isHost } from "../utils/roleRoutes";
import { PageHeading, cn } from "../components/dashboard/ui/v2";
import { KeptSkeleton } from "./catalog/KeptKit";
import { GuestEmpty, btnPrimary, ring } from "./guest/GuestKit";

// /user/reviews — reviews the current user has RECEIVED (Kept).
// Guests see only host→guest reviews (as a guest).
// Hosts get tabs: "As Guest" (host_to_guest) | "As Host" (guest_to_host).

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Stars = ({ n }) => (
  <span className="inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={cn("h-4 w-4", i <= n ? "fill-marigold text-marigold" : "text-neutral-200")} strokeWidth={1.5} />
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Reviews"
        sub={tab === "hosting" ? "What guests say about you as a host." : "What hosts say about you after a session."}
        action={count > 0 && (
          <div className="text-right">
            <p className="mb-0 font-display text-[28px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{avg}</p>
            <p className="mb-0 mt-1 text-[13px] text-muted">{count} review{count === 1 ? "" : "s"}</p>
          </div>
        )} />

      {canHost && (
        <div role="tablist" aria-label="Reviews" className="flex w-fit gap-1 rounded-[14px] bg-white p-1">
          {[["traveling", "As Guest"], ["hosting", "As Host"]].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("h-9 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition", ring,
                tab === k ? "bg-maroon text-white" : "text-muted hover:bg-blush hover:text-maroon")}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? <KeptSkeleton rows={3} />
        : count === 0 ? (
          <GuestEmpty mascot="blue" title="No reviews yet"
            sub={tab === "hosting"
              ? "Guests can leave a review after a completed session with you. They'll show up here."
              : "After your sessions, hosts can leave a rating and a note about you. They'll show up here."}
            action={tab === "traveling" && <Link to="/explore" className={btnPrimary}>Book a session</Link>} />
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white">
            {reviews.map((r) => {
              const author = r.profiles || {};
              return (
                <li key={r.id} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    {author.profile_image ? (
                      <img src={author.profile_image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-50 font-display text-[14px] font-extrabold text-maroon">
                        {author.name ? author.name[0].toUpperCase() : "U"}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="mb-0 truncate text-[15px] font-semibold text-ink">{author.name || "Someone"}</p>
                        <span className="whitespace-nowrap text-[13px] text-faint">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Stars n={r.rating} />
                        {r.bookings?.services?.title && <p className="mb-0 truncate text-[13px] text-muted">{r.bookings.services.title}</p>}
                      </div>
                    </div>
                  </div>
                  {r.comment && <p className="mb-0 mt-2.5 text-[14px] leading-relaxed text-ink">{r.comment}</p>}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
};

export default CustomerReviews;
