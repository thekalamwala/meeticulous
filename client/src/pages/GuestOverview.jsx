import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Star, Gift, MessageCircle, ArrowRight, Clock } from "lucide-react";
import { getGuestBookings } from "../services/api";
import { useAuth } from "../context/AuthContext";

// /user — the guest console landing. A calm at-a-glance home: the next upcoming
// booking, two quick counts, and shortcuts into the rest of the space. Pulls the
// same guest bookings list the Bookings page uses (no new endpoint).
//
// STYLING EXPLORATION (explore/console-restyle): the look is carried over from
// the Host Lab redesign — Loop & Slot tokens (maroon/cream/blush, 2px rounded
// borders, Bricolage display numbers, one Instrument Serif phrase), a scorecard
// row and a card grid. Data and routes are unchanged; this is a restyle only.

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
};

// A booking counts as "upcoming" when it's in the future and not cancelled.
const isUpcoming = (b) => {
  const t = new Date(b.scheduled_at).getTime();
  return t >= Date.now() && !["cancelled", "canceled", "no_show"].includes((b.status || "").toLowerCase());
};
const isCompleted = (b) => ["completed", "complete"].includes((b.status || "").toLowerCase());

// Scorecard — the Host Lab stat pattern: a big Bricolage number over a quiet
// label, in a 2px rounded card that lifts to maroon on hover.
const StatTile = ({ icon: Icon, label, value, to }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-xl border-2 border-neutral-200 bg-white p-3.5 transition hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
  >
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-maroon">
      <Icon size={19} strokeWidth={2} />
    </span>
    <div className="min-w-0">
      <p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-ink/50">{label}</p>
    </div>
  </Link>
);

const QuickLink = ({ icon: Icon, label, to }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-full border-2 border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink/70 transition hover:border-maroon/40 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
  >
    <Icon size={17} strokeWidth={2} className="shrink-0 text-maroon" />
    <span className="flex-1">{label}</span>
    <ArrowRight size={15} className="text-ink/25" strokeWidth={2.4} />
  </Link>
);

const GuestOverview = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGuestBookings()
      .then(({ data }) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const firstName = (user?.name || "").trim().split(/\s+/)[0] || "there";
  const upcoming = bookings.filter(isUpcoming);
  const next = upcoming[0]; // list is server-sorted ascending by scheduled_at
  const completedCount = bookings.filter(isCompleted).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-maroon">
          Hi {firstName}
        </h1>
        <p className="mt-1.5 text-[13px] font-medium text-ink/55">
          Here&apos;s <span className="font-serif text-[1.08em] italic text-ink/70">what&apos;s happening</span> with your bookings.
        </p>
      </div>

      {/* Next booking — the hero. Maroon ground, pink dot = booked (brand rule). */}
      {loading ? (
        <div className="h-28 animate-pulse rounded-2xl border-2 border-neutral-200 bg-white" />
      ) : next ? (
        <Link
          to="/user/my-bookings"
          className="block rounded-2xl bg-maroon p-5 text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white/70">
            <span className="h-2 w-2 rounded-full bg-pink" aria-hidden="true" /> Next booking
          </div>
          <p className="mt-2 font-display text-[19px] font-extrabold leading-tight tracking-[-0.03em]">
            {next.services?.title || "Your session"}
          </p>
          <p className="mt-1 text-[13px] font-medium text-white/75">
            {next.profiles?.name ? `with ${next.profiles.name} · ` : ""}{fmtWhen(next.scheduled_at)}
          </p>
        </Link>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-7 text-center">
          <CalendarDays className="mx-auto mb-2 h-7 w-7 text-ink/25" strokeWidth={1.8} />
          <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">No upcoming bookings</p>
          <p className="mt-1 text-[12px] font-medium text-ink/50">When you book a session, it&apos;ll show up here.</p>
        </div>
      )}

      {/* Quick counts — the scorecard row. */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={CalendarDays} label="Upcoming" value={loading ? "—" : upcoming.length} to="/user/my-bookings" />
        <StatTile icon={Star} label="Completed" value={loading ? "—" : completedCount} to="/user/my-bookings" />
      </div>

      {/* Shortcuts — pill links, the Host Lab rail style laid flat. */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">Quick links</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <QuickLink icon={CalendarDays} label="My bookings" to="/user/my-bookings" />
          <QuickLink icon={MessageCircle} label="Chat with support" to="/user/chat" />
          <QuickLink icon={Star} label="My reviews" to="/user/reviews" />
          <QuickLink icon={Gift} label="Rewards" to="/user/loyalty" />
        </div>
      </div>
    </div>
  );
};

export default GuestOverview;
