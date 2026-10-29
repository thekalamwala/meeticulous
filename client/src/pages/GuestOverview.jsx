import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Star, Gift, MessageCircle, ArrowRight, Clock } from "lucide-react";
import { getGuestBookings } from "../services/api";
import { useAuth } from "../context/AuthContext";

// /user — the guest console landing. A calm at-a-glance home: the next upcoming
// booking, two quick counts, and shortcuts into the rest of the space. Pulls the
// same guest bookings list the Bookings page uses (no new endpoint).

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

const StatTile = ({ icon: Icon, label, value, to }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40"
  >
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
      <Icon size={20} strokeWidth={1.8} />
    </span>
    <div className="min-w-0">
      <p className="text-2xl font-bold leading-none text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  </Link>
);

const QuickLink = ({ icon: Icon, label, to }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-primary/40 hover:text-gray-900"
  >
    <Icon size={18} strokeWidth={1.8} className="shrink-0 text-primary" />
    <span className="flex-1">{label}</span>
    <ArrowRight size={16} className="text-gray-300" />
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
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Hi {firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-gray-500">Here's what's happening with your bookings.</p>

      {/* Next booking */}
      <div className="mt-6">
        {loading ? (
          <div className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        ) : next ? (
          <Link
            to="/user/my-bookings"
            className="block rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Clock size={14} /> Next booking
            </div>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {next.services?.title || "Your session"}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {next.profiles?.name ? `with ${next.profiles.name} · ` : ""}{fmtWhen(next.scheduled_at)}
            </p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <CalendarDays className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No upcoming bookings</p>
            <p className="mt-1 text-xs text-gray-500">When you book a session, it'll show up here.</p>
          </div>
        )}
      </div>

      {/* Quick counts */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile icon={CalendarDays} label="Upcoming" value={loading ? "—" : upcoming.length} to="/user/my-bookings" />
        <StatTile icon={Star} label="Completed" value={loading ? "—" : completedCount} to="/user/reviews" />
      </div>

      {/* Shortcuts */}
      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-gray-900">Quick links</p>
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
