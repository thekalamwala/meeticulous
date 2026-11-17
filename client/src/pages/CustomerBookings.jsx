import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye, HelpCircle, ChevronDown, Download, X, Calendar, Clock,
  Hash, IndianRupee, Video, RotateCcw, Star, Repeat, CalendarClock,
} from "lucide-react";
import { getGuestBookings, cancelBooking, getBookingReview, guestCompleteBooking, guestReportProblem } from "../services/api";
import { downloadReceipt } from "../utils/receipt";
import { useAuth } from "../context/AuthContext";
import { useRegisterRefresh } from "../components/dashboard/ui/refreshContext";
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
    <div className="mb-5 rounded-2xl bg-maroon p-5 text-white">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white/70">
        <CalendarClock size={14} strokeWidth={2.2} /> Your next session · {relWhen(b.scheduled_at)}
      </p>
      <p className="mt-2 truncate font-display text-[19px] font-extrabold leading-tight tracking-[-0.03em]">{svc.title || "Service"}</p>
      <p className="mt-1 text-[13px] font-medium text-white/75">
        with {host.name || "Host"} · {fmtWhen(b.scheduled_at)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.meeting_link && (
          <a href={b.meeting_link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-maroon transition hover:bg-cream hover:no-underline">
            <Video size={15} strokeWidth={2.2} /> Join
          </a>
        )}
        <button onClick={onDetails}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-white/25">
          <Eye size={15} strokeWidth={2.2} /> Details
        </button>
        {count > 1 && (
          <span className="ml-auto text-[11px] font-medium text-white/70">+{count - 1} more upcoming</span>
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
    return getGuestBookings()
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
  // load() returns a promise (for useRegisterRefresh), so it must NOT be passed
  // straight to useEffect — React would treat the promise as the cleanup fn and
  // call it on unmount ("destroy is not a function"). Wrap so the effect returns
  // nothing; load still returns its promise to the refresh registrar below.
  useEffect(() => { load(); }, []);
  useRegisterRefresh(load); // pull-to-refresh re-fetches guest bookings

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
  // A booking can auto-complete on a timer even if nobody joined. Give the guest a
  // recourse window after completion to flag that it didn't happen — same endpoint
  // as "Report a problem" (holds/reverses payout + opens an admin dispute).
  const REPORT_WINDOW_DAYS = 14;
  const canReportCompleted = (b) =>
    b.status === "completed" &&
    b.payment_status === "paid" &&
    new Date(b.scheduled_at) >= new Date(now - REPORT_WINDOW_DAYS * 86400000);
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
      <div className="rounded-xl border-2 border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">{svc.title || "Service"}</p>
            <p className="mt-0.5 text-[12px] font-medium text-ink/55">
              with {host.username
                ? <Link to={`/${host.username}`} className="font-semibold text-maroon hover:underline">{host.name || "Host"}</Link>
                : (host.name || "Host")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-ink/50">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" strokeWidth={2} />{fmtWhen(b.scheduled_at)}</span>
              <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" strokeWidth={2} />{shortId(b.id)}</span>
              <span className="font-bold text-ink/70">{amountPaid(b)}</span>
            </div>
          </div>
          <StatusChip status={b.status} />
        </div>

        <div className="mt-3 flex items-center gap-1 border-t-2 border-neutral-200 pt-3">
          <button onClick={() => setDetailsFor(b)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/65 transition hover:bg-blush hover:text-maroon">
            <Eye size={15} strokeWidth={2.2} /> Details
          </button>
          <Link to="/help"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/55 transition hover:bg-blush hover:text-maroon hover:no-underline">
            <HelpCircle size={15} strokeWidth={2.2} /> Help
          </Link>
          {b.meeting_link && isUpcoming(b) && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-maroon px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-maroon-dark hover:no-underline">
              <Video size={15} strokeWidth={2.2} /> Join
            </a>
          )}
          {canConfirm(b) && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => handleReportProblem(b.id)} disabled={confirming === b.id}
                className="rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/55 transition hover:bg-error-bg hover:text-error-fg disabled:opacity-60">
                Report a problem
              </button>
              <button onClick={() => handleConfirmComplete(b.id)} disabled={confirming === b.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-maroon-dark disabled:opacity-60">
                {confirming === b.id ? "Confirming…" : "Confirm completed"}
              </button>
            </div>
          )}
          {canReportCompleted(b) && (
            <button onClick={() => handleReportProblem(b.id)} disabled={confirming === b.id}
              className="ml-auto rounded-full px-2.5 py-1.5 text-[12px] font-bold text-ink/55 transition hover:bg-error-bg hover:text-error-fg disabled:opacity-60">
              Didn't happen? Report
            </button>
          )}
        </div>
      </div>
    );
  };

  const activeFilterLabel = FILTERS.find((f) => f.key === filter)?.label;

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-extrabold leading-none tracking-[-0.04em] text-maroon">My bookings</h1>
            <p className="mt-1.5 text-[13px] font-medium text-ink/55">
              {user?.name ? `Hi ${user.name.split(" ")[0]}, ` : ""}here are the sessions you've booked.
            </p>
          </div>
          {/* Filter dropdown */}
          <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFilterOpen(false); }}>
            <button onClick={() => setFilterOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-neutral-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-ink/70 transition hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
              {activeFilterLabel}
              <ChevronDown size={15} className={`text-ink/35 transition-transform ${filterOpen ? "rotate-180" : ""}`} strokeWidth={2.2} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border-2 border-neutral-200 bg-white py-1 dash-elev-3">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setFilterOpen(false); }}
                    className={`flex w-full items-center px-4 py-2 text-[12.5px] font-semibold transition hover:bg-blush ${filter === f.key ? "text-maroon" : "text-ink/65"}`}>
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
          <div className="py-16 text-center">
            <PetalSpinner size={40} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-10 text-center">
            <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">No bookings yet</p>
            <p className="mt-1 text-[12px] font-medium text-ink/50">When you book a session it'll show up here.</p>
            <Link to="/explore" className="mt-4 inline-block text-[12.5px] font-bold text-maroon hover:underline">Find a creator to book →</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-10 text-center text-[13px] font-medium text-ink/50">
            No {activeFilterLabel.toLowerCase()} to show.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((b) => <Row key={b.id} b={b} />)}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/explore" className="text-[12.5px] font-bold text-maroon hover:underline">Browse creators →</Link>
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
    <div className="flex items-center justify-between border-b border-neutral-100 py-2.5 text-[13px]">
      <span className="inline-flex items-center gap-2 font-medium text-ink/50"><Icon size={14} className="text-ink/35" strokeWidth={2} />{label}</span>
      <span className="text-right font-bold text-ink/80">{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border-2 border-neutral-200 bg-white sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b-2 border-neutral-200 bg-white px-5 py-4">
          <h2 className="font-display text-[16px] font-extrabold tracking-[-0.02em] text-ink">Booking details</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink/40 transition hover:bg-blush hover:text-maroon"><X size={18} strokeWidth={2.2} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">{svc.title || "Service"}</p>
          <p className="text-[12px] font-medium text-ink/50">with {host.name || "Host"}</p>

          <div className="mt-4">
            <Line icon={Hash} label="Booking ID" value={shortId(b.id)} />
            <Line icon={Calendar} label="Date & time" value={fmtWhen(b.scheduled_at)} />
            {svc.duration ? <Line icon={Clock} label="Duration" value={`${svc.duration} min`} /> : null}
            <Line icon={IndianRupee} label="Amount" value={amountPaid(b)} />
            <Line icon={Eye} label="Status" value={<StatusChip status={b.status} />} />
          </div>

          {b.meeting_link && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-maroon hover:underline">
              <Video size={15} strokeWidth={2.2} /> Join Google Meet
            </a>
          )}

          {/* Actions */}
          <div className="mt-5 grid grid-cols-1 gap-2">
            <button onClick={() => downloadInvoice(b, host)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-maroon px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-maroon-dark">
              <Download size={15} strokeWidth={2.2} /> Download invoice
            </button>
            {canReschedule && (
              <button onClick={onReschedule}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-neutral-200 px-4 py-2.5 text-[13px] font-bold text-ink/70 transition hover:border-maroon/40 hover:text-maroon">
                <RotateCcw size={15} strokeWidth={2.2} /> Reschedule
              </button>
            )}
            {b.status === "completed" && canReview && !review && (
              <button onClick={onReview}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-neutral-200 px-4 py-2.5 text-[13px] font-bold text-ink/70 transition hover:border-maroon/40 hover:text-maroon">
                <Star size={15} strokeWidth={2.2} /> Write a review
              </button>
            )}
            {b.status === "completed" && review && (
              <div className="rounded-xl border-2 border-success-fg/25 bg-success-bg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-success-fg">
                    <Star size={14} className="fill-success-fg text-success-fg" /> Review submitted
                  </span>
                  {canReview && (
                    <button onClick={onReview} className="text-[11px] font-bold text-maroon hover:underline">
                      Edit review
                    </button>
                  )}
                </div>
                <p className="mt-1 inline-flex">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= review.rating ? "fill-marigold text-marigold" : "text-neutral-200"}`} strokeWidth={1.5} />)}
                </p>
                {review.comment && <p className="mt-1 text-[12.5px] font-medium leading-snug text-ink/70">{review.comment}</p>}
              </div>
            )}
            {(b.status === "completed" || b.status === "cancelled") && host.username && svc.slug && (
              <Link to={`/${host.username}/booking/${svc.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-neutral-200 px-4 py-2.5 text-[13px] font-bold text-ink/70 transition hover:border-maroon/40 hover:text-maroon hover:no-underline">
                <Repeat size={15} strokeWidth={2.2} /> Rebook
              </Link>
            )}
            {canCancel && (
              <button onClick={onCancel} disabled={cancelling}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-error-fg transition hover:bg-error-bg disabled:opacity-50">
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
