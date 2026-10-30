import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye, HelpCircle, ChevronDown, Download, X, Calendar, Clock,
  Hash, IndianRupee, Video, RotateCcw, Star, Repeat, CalendarClock,
} from "lucide-react";
import { getGuestBookings, cancelBooking, getBookingReview, guestCompleteBooking, guestReportProblem } from "../services/api";
import { downloadReceipt } from "../utils/receipt";
import { useAuth } from "../context/AuthContext";
import useFeatureFlags from "../hooks/useFeatureFlags";
import RescheduleModal from "../components/booking/RescheduleModal";
import ReviewModal from "../components/booking/ReviewModal";
import StatusChip from "../components/common/StatusChip";
import toast from "react-hot-toast";
import PetalSpinner from "../components/common/PetalSpinner";

// Customer-facing "My Bookings" — list of bookings a guest has made, with a
// status filter, per-row Booking ID + Amount Paid, and a details drawer that
// includes an invoice download.

const FILTERS = [
  { key: "all",       label: "All bookings" },
  { key: "upcoming",  label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// Human "in 3 days" / "in 5 hr" / "in 20 min" countdown for the next-session hero.
const relWhen = (iso) => {
  const min = Math.round((new Date(iso) - new Date()) / 60000);
  if (min < 1) return "starting now";
  if (min < 60) return `in ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr} hr`;
  const d = Math.round(hr / 24);
  return d === 1 ? "tomorrow" : `in ${d} days`;
};

const shortId = (id) => (id ? `#${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}` : "—");

// Uses the actual charged total (customer_total = service price + platform fee +
// GST), falling back to list price for legacy rows that predate the column.
const amountPaid = (b) => {
  const total = Number(b.customer_total ?? b.services?.price ?? 0);
  if (total === 0) return "Free";
  const amt = `₹${total.toLocaleString("en-IN")}`;
  if (b.payment_status === "refunded") return `${amt} (refunded)`;
  if (b.payment_status === "paid") return amt;
  return `${amt} · Unpaid`;
};

// Invoice download. Prefers the real GST tax invoice via the OWNER-GATED endpoint
// (Bearer-authed → fetched as a local blob so the URL isn't shareable; only the
// logged-in buyer can open it). Falls back to the client-side receipt for bookings
// without a GST invoice (e.g. free bookings, or before the invoice is minted).
const downloadInvoice = async (b, host) => {
  try {
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const session = JSON.parse(localStorage.getItem("user") || "null");
    const res = await fetch(`${base}/invoices/booking/${b.id}/view`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    });
    if (res.ok) {
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/html" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
    // 404 (no GST invoice for this booking) → fall through to the client receipt.
  } catch { /* network issue → fall through to the client receipt */ }
  downloadReceipt({
    receiptId: shortId(b.id),
    bookingId: b.id,
    whenText: fmtWhen(b.scheduled_at),
    serviceTitle: b.services?.title || "Service",
    category: b.services?.category,
    duration: b.services?.duration,
    timezone: b.timezone,
    venue: b.meeting_link,
    hostName: host?.name || "Host",
    guestName: b.guest_name || "",
    guestEmail: b.guest_email || "",
    customerPhone: b.guest_phone,
    status: b.status,
    paymentStatus: b.payment_status,
    paymentId: b.payment_id,
    gateway: b.payment_id ? "Razorpay" : "",
    price: Number(b.services?.price || 0),
    platformFee: Number(b.platform_fee_amount || 0),
    platformFeeGst: Number(b.platform_fee_gst || 0),
    total: Number(b.customer_total || 0),
  });
};

// Hero card for the soonest upcoming session — the guest's "what now" at a glance.
const HeroNext = ({ b, host, count, onDetails }) => {
  const svc = b.services || {};
  return (
    <div className="rounded-2xl p-5 sm:p-6 mb-5 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#960D32,#960D32)" }}>
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-90">
        <CalendarClock size={14} /> Your next session · {relWhen(b.scheduled_at)}
      </p>
      <p className="text-lg sm:text-xl font-bold mt-1.5 truncate">{svc.title || "Service"}</p>
      <p className="text-sm opacity-90 mt-0.5">
        with {host.name || "Host"} · {fmtWhen(b.scheduled_at)}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {b.meeting_link && (
          <a href={b.meeting_link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#960D32] bg-white rounded-xl px-4 py-2 hover:bg-white/90 hover:no-underline">
            <Video size={15} /> Join
          </a>
        )}
        <button onClick={onDetails}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white border border-white/40 rounded-xl px-4 py-2 hover:bg-white/10">
          <Eye size={15} /> Details
        </button>
        {count > 1 && (
          <span className="text-xs opacity-80 ml-auto">+{count - 1} more upcoming</span>
        )}
      </div>
    </div>
  );
};

const CustomerBookings = () => {
  const { user } = useAuth();
  const { on } = useFeatureFlags();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reschedFor, setReschedFor] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailsFor, setDetailsFor] = useState(null);

  const load = () => {
    getGuestBookings()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setBookings(list);
        const completed = list.filter((b) => b.status === "completed");
        Promise.all(completed.map((b) =>
          getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])
        )).then((pairs) => setReviews(Object.fromEntries(pairs)));
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCancel = async (id) => {
    const b = bookings.find((x) => x.id === id);
    const msg = b?.payment_status === "paid"
      ? "Cancel this paid booking? Cancellations are generally non-refundable — refunds apply only in limited cases (see our Refund Policy at /refund). This cannot be undone."
      : "Cancel this booking? This cannot be undone.";
    if (!window.confirm(msg)) return;
    setCancelling(id);
    try {
      await cancelBooking(id);
      toast.success("Booking cancelled");
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel");
    } finally {
      setCancelling(null);
    }
  };

  const now = new Date();
  const isUpcoming = (b) => new Date(b.scheduled_at) >= now && b.status !== "cancelled" && b.status !== "completed";

  // Guest confirms the session happened → completes the booking AND releases the
  // host's payout instantly. Shown for a paid, confirmed booking whose slot has passed.
  const [confirming, setConfirming] = useState(null);
  const canConfirm = (b) => b.status === "confirmed" && b.payment_status === "paid" && new Date(b.scheduled_at) < now;
  const handleConfirmComplete = async (id) => {
    setConfirming(id);
    try {
      await guestCompleteBooking(id);
      toast.success("Thanks for confirming — your host has been paid.");
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status: "completed" } : b)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not confirm");
    } finally {
      setConfirming(null);
    }
  };
  const handleReportProblem = async (id) => {
    const reason = window.prompt("What went wrong? (e.g. host didn't show up)");
    if (reason == null) return;
    setConfirming(id);
    try {
      await guestReportProblem(id, reason);
      toast.success("Reported — we've put the payout on hold and our team will look into it.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not report");
    } finally {
      setConfirming(null);
    }
  };

  const filtered = bookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return isUpcoming(b);
    return b.status === filter;
  });

  const hostOf = (b) => b["profiles!bookings_host_id_fkey"] || b.profiles || {};

  // Soonest future session — drives the hero card at the top of the page.
  const nextUp = bookings
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const next = nextUp[0];

  const Row = ({ b }) => {
    const host = hostOf(b);
    const svc = b.services || {};
    return (
      <div className="bg-white border rounded-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{svc.title || "Service"}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              with {host.username
                ? <Link to={`/${host.username}`} className="text-[#960D32] hover:underline">{host.name || "Host"}</Link>
                : (host.name || "Host")}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" />{fmtWhen(b.scheduled_at)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1"><Hash size={12} />{shortId(b.id)}</span>
              <span className="inline-flex items-center gap-1">{amountPaid(b)}</span>
            </div>
          </div>
          <StatusChip status={b.status} />
        </div>

        <div className="mt-3 pt-3 border-t flex items-center gap-2">
          <button onClick={() => setDetailsFor(b)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-[#960D32] px-2.5 py-1.5 rounded-lg hover:bg-[#960D32]/5">
            <Eye size={15} /> Details
          </button>
          <Link to="/help"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#960D32] px-2.5 py-1.5 rounded-lg hover:bg-[#960D32]/5 hover:no-underline">
            <HelpCircle size={15} /> Help
          </Link>
          {b.meeting_link && isUpcoming(b) && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#960D32] hover:underline px-2.5 py-1.5 ml-auto">
              <Video size={15} /> Join
            </a>
          )}
          {canConfirm(b) && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => handleReportProblem(b.id)} disabled={confirming === b.id}
                className="text-sm font-medium text-gray-500 hover:text-rose-600 disabled:opacity-60 px-2.5 py-1.5 rounded-lg hover:bg-rose-50">
                Report a problem
              </button>
              <button onClick={() => handleConfirmComplete(b.id)} disabled={confirming === b.id}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#960D32] hover:bg-[#2A1416] disabled:opacity-60 px-3 py-1.5 rounded-lg">
                {confirming === b.id ? "Confirming…" : "Confirm completed"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeFilterLabel = FILTERS.find((f) => f.key === filter)?.label;

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Bookings</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {user?.name ? `Hi ${user.name.split(" ")[0]}, ` : ""}here are the sessions you've booked.
            </p>
          </div>
          {/* Filter dropdown */}
          <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFilterOpen(false); }}>
            <button onClick={() => setFilterOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border rounded-xl px-3.5 py-2 hover:border-[#960D32]/40 whitespace-nowrap">
              {activeFilterLabel}
              <ChevronDown size={15} className={`text-gray-400 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border rounded-xl shadow-lg z-20 overflow-hidden py-1">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setFilterOpen(false); }}
                    className={`flex w-full items-center px-4 py-2.5 text-sm hover:bg-[#960D32]/5 ${filter === f.key ? "text-[#960D32] font-medium" : "text-gray-600"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {next && (
          <HeroNext b={next} host={hostOf(next)} count={nextUp.length}
            onDetails={() => setDetailsFor(next)} />
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <PetalSpinner size={40} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <p className="text-gray-500 mb-1">No bookings yet</p>
            <p className="text-sm text-gray-400 mb-4">When you book a session it'll show up here.</p>
            <Link to="/" className="inline-block text-sm font-medium text-[#960D32] hover:underline">Find a creator to book →</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center text-gray-400 text-sm">
            No {activeFilterLabel.toLowerCase()} to show.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => <Row key={b.id} b={b} />)}
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-[#960D32] hover:underline">Browse creators →</Link>
        </div>

      {/* Details drawer/modal */}
      {detailsFor && (
        <DetailsModal
          b={detailsFor}
          host={hostOf(detailsFor)}
          review={reviews[detailsFor.id]}
          onClose={() => setDetailsFor(null)}
          canReschedule={isUpcoming(detailsFor) && on("reschedule")}
          canReview={on("review_submission")}
          canCancel={isUpcoming(detailsFor)}
          cancelling={cancelling === detailsFor.id}
          onReschedule={() => { setReschedFor(detailsFor); setDetailsFor(null); }}
          onReview={() => { setReviewFor(detailsFor); setDetailsFor(null); }}
          onCancel={() => handleCancel(detailsFor.id)}
        />
      )}

      {reschedFor && (
        <RescheduleModal open booking={reschedFor} onClose={() => setReschedFor(null)}
          onDone={(newWhen) => {
            setBookings((bs) => bs.map((x) => x.id === reschedFor.id
              ? { ...x, scheduled_at: newWhen, reschedule_count: (x.reschedule_count || 0) + 1 } : x));
            setReschedFor(null);
          }} />
      )}
      {reviewFor && (
        <ReviewModal open booking={reviewFor} existing={reviews[reviewFor.id] || null}
          onClose={() => setReviewFor(null)}
          onDone={(review) => { setReviews((m) => ({ ...m, [reviewFor.id]: review })); setReviewFor(null); }} />
      )}
    </>
  );
};

// ── Booking Details modal ─────────────────────────────────────────────────────
const DetailsModal = ({ b, host, review, onClose, canReschedule, canReview, canCancel, cancelling, onReschedule, onReview, onCancel }) => {
  const svc = b.services || {};
  const Line = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 text-sm">
      <span className="inline-flex items-center gap-2 text-gray-500"><Icon size={14} className="text-gray-400" />{label}</span>
      <span className="font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-gray-900">Booking details</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="font-semibold text-gray-900">{svc.title || "Service"}</p>
          <p className="text-sm text-gray-500">with {host.name || "Host"}</p>

          <div className="mt-4">
            <Line icon={Hash} label="Booking ID" value={shortId(b.id)} />
            <Line icon={Calendar} label="Date & time" value={fmtWhen(b.scheduled_at)} />
            {svc.duration ? <Line icon={Clock} label="Duration" value={`${svc.duration} min`} /> : null}
            <Line icon={IndianRupee} label="Amount" value={amountPaid(b)} />
            <Line icon={Eye} label="Status" value={<StatusChip status={b.status} />} />
          </div>

          {b.meeting_link && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#960D32] hover:underline">
              <Video size={15} /> Join Google Meet
            </a>
          )}

          {/* Actions */}
          <div className="mt-5 grid grid-cols-1 gap-2">
            <button onClick={() => downloadInvoice(b, host)}
              className="btn inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#960D32] hover:bg-[#2A1416]">
              <Download size={15} /> Download invoice
            </button>
            {canReschedule && (
              <button onClick={onReschedule}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border rounded-xl hover:bg-gray-50">
                <RotateCcw size={15} /> Reschedule
              </button>
            )}
            {b.status === "completed" && canReview && !review && (
              <button onClick={onReview}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border rounded-xl hover:bg-gray-50">
                <Star size={15} /> Write a review
              </button>
            )}
            {b.status === "completed" && review && (
              <div className="rounded-xl border bg-green-50/60 border-green-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <Star size={14} className="fill-green-600 text-green-600" /> Review submitted
                  </span>
                  {canReview && (
                    <button onClick={onReview} className="text-xs font-medium text-[#960D32] hover:underline">
                      Edit review
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[#960D32] text-sm tracking-tight">
                  {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                </p>
                {review.comment && <p className="mt-1 text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
              </div>
            )}
            {(b.status === "completed" || b.status === "cancelled") && host.username && svc.slug && (
              <Link to={`/${host.username}/booking/${svc.slug}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border rounded-xl hover:bg-gray-50 hover:no-underline">
                <Repeat size={15} /> Rebook
              </Link>
            )}
            {canCancel && (
              <button onClick={onCancel} disabled={cancelling}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50">
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerBookings;
