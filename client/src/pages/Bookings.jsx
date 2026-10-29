import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getHostBookings,
  cancelBooking,
  completeBooking,
  markNoShow,
  rescheduleBooking,
  getAvailability,
  getBookedSlots,
  getBookingReview,
} from "../services/api";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Eye, Star, CalendarDays, User, Briefcase, CreditCard, Link2, Copy, ChevronRight as Chevron, CalendarX2 } from "lucide-react";
import ReviewModal from "../components/booking/ReviewModal";
import useFeatureFlags from "../hooks/useFeatureFlags";
import StatusChip from "../components/common/StatusChip";
import {
  PageHeader, Card, Button, SearchInput, SegmentedControl,
  StatusBadge, Modal, SkeletonCard, EmptyState, ErrorState,
  useInfiniteScroll, cn,
} from "../components/dashboard/ui";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// ---- Agenda day-grouping (mobile) ----
// Group a booking list into day buckets keyed by local date, labelled
// Today / Tomorrow / Yesterday / weekday-date for a native calendar feel.
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayLabel = (d) => {
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
};
const groupByDay = (list) => {
  const groups = [];
  const index = {};
  for (const b of list) {
    const d = new Date(b.scheduled_at);
    const key = dayKey(d);
    if (index[key] == null) {
      index[key] = groups.length;
      groups.push({ key, label: dayLabel(d), items: [] });
    }
    groups[index[key]].items.push(b);
  }
  return groups;
};
const initialOf = (name) => (name || "G").trim().charAt(0).toUpperCase();

const Row = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="flex-shrink-0 text-xs text-gray-500">{label}</span>
    <span className={cn("text-right text-xs font-medium text-gray-800", mono && "break-all font-mono")}>{value}</span>
  </div>
);

// Icon-led card used to group booking-detail fields into clean sections.
// On the details modal these sit in a 2-col grid on desktop and stack on mobile.
const Section = ({ icon: Icon, title, children }) => (
  <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {title}
    </h4>
    <div className="space-y-2">{children}</div>
  </section>
);

const copy = (text, label) => {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => toast.success(`${label} copied`)).catch(() => {});
};

// ------ RESCHEDULE MODAL ------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DS = ["S", "M", "T", "W", "T", "F", "S"];

const RescheduleModal = ({ booking, onClose, onDone }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [avail, setAvail] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    getAvailability().then(({ data }) => setAvail(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selDate || !booking?.host_id) return;
    setLoadingSlots(true);
    const d = selDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    getBookedSlots(booking.host_id, dateStr)
      .then(({ data }) => setBookedSlots((data || []).filter((b) => b.id !== booking.id)))
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selDate, booking]);

  const svcDuration = booking.services?.duration || 30;

  const getAvailSlots = () => {
    if (!selDate || !avail?.weekly_schedule) return [];
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][selDate.getDay()];
    const daySlots = avail.weekly_schedule[dayName] || [];
    const bufferMin = avail.buffer_minutes || 0;
    const stepMin = svcDuration + bufferMin;
    const slots = [];
    const now = new Date();
    const isToday = selDate.toDateString() === now.toDateString();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() + 1 : 0;

    for (const { start, end } of daySlots) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let cur = sh * 60 + sm;
      const endMin = eh * 60 + em;
      while (cur + svcDuration <= endMin) {
        if (!isToday || cur >= nowMin) {
          const h = Math.floor(cur / 60), m = cur % 60;
          const tStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const sStart = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), h, m);
          const sEnd = new Date(sStart.getTime() + svcDuration * 60000);
          const blocked = bookedSlots.some((b) => {
            const bS = new Date(b.scheduled_at);
            const bE = new Date(bS.getTime() + (b.services?.duration || 30) * 60000);
            return sStart < bE && sEnd > bS;
          });
          if (!blocked) slots.push(tStr);
        }
        cur += stepMin;
      }
    }
    return slots;
  };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const isDateSelectable = (d) => {
    const date = new Date(calYear, calMonth, d);
    if (date < today) return false;
    if (!avail?.weekly_schedule) return true;
    const name = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];
    return (avail.weekly_schedule[name] || []).length > 0;
  };

  const isSel = (d) => selDate && selDate.getDate() === d && selDate.getMonth() === calMonth && selDate.getFullYear() === calYear;

  const save = async () => {
    if (!selDate || !selTime) { toast.error("Pick date and time"); return; }
    const [h, m] = selTime.split(":").map(Number);
    const dt = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), h, m);
    if (dt <= new Date()) { toast.error("Must be a future time"); return; }
    setSaving(true);
    try {
      await rescheduleBooking(booking.id, { scheduled_at: dt.toISOString() });
      toast.success("Booking rescheduled!");
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const slots = getAvailSlots();
  const formatSlot = (t) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM", hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <Modal open onClose={onClose} title="Reschedule Booking" size="sm">
      <p className="mb-4 text-xs text-gray-400">{booking.services?.title} &bull; {booking.guest_name}</p>

      {/* Calendar */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} aria-label="Previous month" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{MONTHS[calMonth]} {calYear}</span>
        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} aria-label="Next month" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-gray-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
        {DS.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={"e" + i} />;
          const ok = isDateSelectable(day);
          return (
            <button key={day} disabled={!ok}
              onClick={() => { if (ok) { setSelDate(new Date(calYear, calMonth, day)); setSelTime(""); } }}
              className={cn("grid aspect-square min-h-11 place-items-center rounded-lg text-sm transition-colors", isSel(day) ? "bg-primary font-semibold text-white" : !ok ? "cursor-default text-gray-300" : "hover:bg-gray-100 active:bg-gray-200")}>
              {day}
            </button>
          );
        })}
      </div>

      {/* Time slots from availability */}
      {selDate && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-gray-500">
            Available times
            {avail?.timezone ? <span className="ml-1 text-gray-400">({avail.timezone.split("/")[1] || avail.timezone})</span> : ""}
          </p>
          {loadingSlots ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : slots.length === 0 ? (
            <p className="py-2 text-sm text-gray-400">No available slots for this date.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {slots.map((t) => (
                <button key={t} onClick={() => setSelTime(t)}
                  className={cn("min-h-11 rounded-lg border text-sm font-medium transition-colors", selTime === t ? "border-primary bg-primary text-white" : "hover:border-gray-400 active:bg-gray-50")}>
                  {formatSlot(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button size="lg" variant="outline" full onClick={onClose}>Cancel</Button>
        <Button size="lg" full onClick={save} disabled={saving || !selDate || !selTime}>{saving ? "Saving…" : "Confirm"}</Button>
      </div>
    </Modal>
  );
};

// ------ DETAILS MODAL ------
const DetailsModal = ({ booking, onClose, onAction, review, onReviewDone }) => {
  const { on } = useFeatureFlags();
  const [confirming, setConfirming] = useState(null); // 'cancel' | 'delete' | 'complete'
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const doAction = async (action) => {
    setBusy(true);
    try {
      if (action === "complete") {
        await completeBooking(booking.id);
        toast.success("Marked as completed");
      }
      if (action === "no_show") {
        await markNoShow(booking.id);
        toast.success("Marked as no-show");
      }
      if (action === "cancel") {
        await cancelBooking(booking.id);
        toast.success("Booking cancelled");
      }
      onAction();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const dt = new Date(booking.scheduled_at);
  const endDt = new Date(dt.getTime() + (booking.services?.duration || 30) * 60000);

  if (showReschedule)
    return (
      <RescheduleModal
        booking={booking}
        onClose={() => setShowReschedule(false)}
        onDone={() => { setShowReschedule(false); onAction(); onClose(); }}
      />
    );

  if (showReview)
    return (
      <ReviewModal
        open
        booking={booking}
        direction="host_to_guest"
        existing={review || null}
        onClose={() => setShowReview(false)}
        onDone={(saved) => { setShowReview(false); if (onReviewDone) onReviewDone(saved); }}
      />
    );

  const isFree = booking.services?.price === 0;

  return (
    <Modal open onClose={onClose} title="Booking Details" size="xl">
      {/* Summary band — service, when, status, copyable id */}
      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{booking.services?.title || "Service"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            <span>{fmtDate(booking.scheduled_at)}</span>
            <span className="text-gray-300">&middot;</span>
            <span>{fmtTime(dt)} &ndash; {fmtTime(endDt)}</span>
            <span className="text-gray-300">&middot;</span>
            <span>{booking.services?.duration || 30} min</span>
          </p>
          <button
            type="button"
            onClick={() => copy(booking.id, "Booking ID")}
            title="Copy booking ID"
            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 transition-colors hover:text-primary"
          >
            #{booking.id.slice(0, 8).toUpperCase()}
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <StatusChip status={booking.status} />
      </div>

      {/* Two-column section grid on desktop; stacks on mobile. Equal-height
          rows come for free from the grid's default stretch alignment. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Section icon={CalendarDays} title="Schedule">
          <Row label="Date" value={fmtDate(booking.scheduled_at)} />
          <Row label="Time Slot" value={fmtTime(dt) + " - " + fmtTime(endDt)} />
          <Row label="Booked on" value={fmtDate(booking.created_at)} />
          {booking.notes && <Row label="Notes" value={booking.notes} />}
        </Section>

        <Section icon={User} title="Customer">
          <Row label="Name" value={booking.guest_name || "Guest"} />
          <Row label="Email" value={booking.guest_email || "-"} />
          <Row label="Phone" value={booking.guest_phone || "-"} />
        </Section>

        <Section icon={Briefcase} title="Service">
          <Row label="Service" value={booking.services?.title || "N/A"} />
          <Row label="Duration" value={(booking.services?.duration || 30) + " min"} />
          <Row label="Price" value={isFree ? "Free" : `₹${booking.services?.price}`} />
          <Row label="Mode" value={booking.services?.meeting_mode === "offline" ? "In-person" : "Online"} />
        </Section>

        <Section icon={CreditCard} title="Payment">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <StatusBadge status={booking.payment_status} />
          </div>
          <Row label="Total Amount" value={isFree ? "Free" : `₹${booking.services?.price}`} />
          {booking.vendor_amount != null && <Row label="Your Earnings" value={`₹${booking.vendor_amount}`} />}
          {booking.platform_fee_amount != null && <Row label="Platform Fee" value={`₹${booking.platform_fee_amount}`} />}
          {booking.razorpay_order_id && <Row label="Order Ref" value={booking.razorpay_order_id} mono />}
          {booking.razorpay_payment_id && <Row label="Payment Ref" value={booking.razorpay_payment_id} mono />}
          {booking.meeting_link && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Meet Link</span>
              <a href={booking.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Link2 className="h-3 w-3" /> Join
              </a>
            </div>
          )}
        </Section>
      </div>

      {/* Reschedule status */}
      {booking.reschedule_status && booking.reschedule_status !== "none" && (
        <div className={cn("mt-3 rounded-xl px-4 py-3 text-xs font-medium", booking.reschedule_status === "acknowledged" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
          {booking.reschedule_status === "awaiting_guest_ack"
            ? "Awaiting guest acknowledgement of reschedule"
            : "Guest acknowledged the new time"}
        </div>
      )}

      {/* Actions */}
      {confirming ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-sm font-medium text-red-700">
            {confirming === "cancel"
              ? booking.payment_status === "paid"
                ? "Cancel this paid booking? The guest will be notified. Cancelling does NOT refund automatically — process any refund manually."
                : "Cancel this booking? The guest will be notified."
              : confirming === "no_show"
              ? "Mark this booking as a no-show? Use this when the guest did not attend."
              : "Mark as completed?"}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button size="lg" variant="outline" full onClick={() => setConfirming(null)}>Back</Button>
            <Button size="lg" full variant={confirming === "cancel" ? "danger" : "primary"} onClick={() => doAction(confirming)} disabled={busy}>
              {busy ? "..." : confirming === "cancel" ? "Yes, cancel" : confirming === "no_show" ? "Yes, no-show" : "Yes, complete"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {booking.status === "confirmed" && new Date(booking.scheduled_at) > new Date() && (
            <Button size="lg" variant="outline" className="w-full text-primary sm:w-auto sm:min-w-[120px] sm:flex-1" onClick={() => setShowReschedule(true)}>Reschedule</Button>
          )}
          {booking.status === "confirmed" && new Date(booking.scheduled_at) <= new Date() && (
            <Button size="lg" className="w-full sm:w-auto sm:min-w-[120px] sm:flex-1" onClick={() => setConfirming("complete")}>Mark Completed</Button>
          )}
          {booking.status === "confirmed" && new Date(booking.scheduled_at) <= new Date() && (
            <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[120px] sm:flex-1" onClick={() => setConfirming("no_show")}>No-show</Button>
          )}
          {booking.status !== "cancelled" && booking.status !== "completed" && booking.status !== "no_show" && (
            <Button size="lg" variant="danger-outline" className="w-full sm:w-auto sm:min-w-[120px] sm:flex-1" onClick={() => setConfirming("cancel")}>Cancel Booking</Button>
          )}
          {booking.status === "completed" && on("review_submission") && booking.guest_id && !review && (
            <Button size="lg" className="w-full sm:w-auto sm:min-w-[120px] sm:flex-1" onClick={() => setShowReview(true)}>Review Guest</Button>
          )}
        </div>
      )}

      {/* Review submitted card — host's existing review of this guest */}
      {booking.status === "completed" && on("review_submission") && booking.guest_id && review && (
        <div className="mt-3 rounded-xl border bg-green-50/60 border-green-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Star size={14} className="fill-green-600 text-green-600" /> Review submitted
            </span>
            <button onClick={() => setShowReview(true)} className="text-xs font-medium text-[#0079C1] hover:underline">
              Edit review
            </button>
          </div>
          <p className="mt-1 text-[#0079C1] text-sm tracking-tight">
            {"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
          </p>
          {review.comment && <p className="mt-1 text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
        </div>
      )}
    </Modal>
  );
};

// ------ MOBILE AGENDA CARD ------
// App-style, person-forward booking row. The whole card is one large tap target
// that opens the details sheet. Same data, same click handler as the table row.
const BookingCard = ({ booking, onOpen }) => {
  const d = new Date(booking.scheduled_at);
  const isFree = booking.services?.price === 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors active:bg-gray-50 dash-elev-1"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary">
        {initialOf(booking.guest_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{booking.guest_name || "Guest"}</p>
          <StatusChip status={booking.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{booking.services?.title || "Service"}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-700">{fmtTime(d)}</span>
          <span className="text-gray-300">&middot;</span>
          <span className="text-gray-500">{isFree ? "Free" : `₹${booking.services?.price}`}</span>
        </div>
      </div>
      <Chevron className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  );
};

// ------ MAIN BOOKINGS PAGE ------
const PAGE_SIZE = 10;

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE); // client-side infinite window
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState({});

  const fetch = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await getHostBookings();
      const list = data || [];
      setBookings(list);
      // Load host's existing reviews for completed bookings that have an account guest.
      const completedWithGuest = list.filter((b) => b.status === "completed" && b.guest_id);
      Promise.all(
        completedWithGuest.map((b) =>
          getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])
        )
      ).then((pairs) => setReviews(Object.fromEntries(pairs)));
    } catch {
      setError(true);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    let list = bookings;
    if (filter === "upcoming")
      list = list.filter((b) => b.status !== "cancelled" && new Date(b.scheduled_at) > now);
    else if (filter === "past")
      list = list.filter((b) => b.status !== "cancelled" && new Date(b.scheduled_at) <= now);
    else if (filter === "cancelled")
      list = list.filter((b) => b.status === "cancelled");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          (b.guest_name || "").toLowerCase().includes(q) ||
          (b.guest_email || "").toLowerCase().includes(q) ||
          (b.services?.title || "").toLowerCase().includes(q) ||
          (b.id || "").toLowerCase().includes(q),
      );
    }
    // Newest → oldest on every tab. The API returns scheduled_at ascending;
    // present the most recent first (purely display-side — the source list is
    // untouched, so other consumers keep their order). Clone before sorting.
    return [...list].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  }, [bookings, filter, search]);

  // Client-side infinite window: grow `visible` as the sentinel scrolls into view.
  // (getHostBookings returns the full list; no server pagination to page through.)
  const paged = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const loadMore = useCallback(() => setVisible((v) => v + PAGE_SIZE), []);
  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: false });

  const counts = (() => {
    const now = new Date();
    return {
      all: bookings.length,
      upcoming: bookings.filter((b) => b.status !== "cancelled" && new Date(b.scheduled_at) > now).length,
      past: bookings.filter((b) => b.status !== "cancelled" && new Date(b.scheduled_at) <= now).length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };
  })();

  if (loading) {
    return (
      <div>
        <PageHeader title="Bookings" subtitle="Manage your appointments." />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div>
        <PageHeader title="Bookings" subtitle="Manage your appointments." />
        <ErrorState message="Couldn’t load your bookings." onRetry={fetch} />
      </div>
    );
  }

  return (
    <div>
      {selected && (
        <DetailsModal
          booking={selected}
          onClose={() => setSelected(null)}
          onAction={fetch}
          review={reviews[selected.id] || null}
          onReviewDone={(saved) => setReviews((m) => ({ ...m, [selected.id]: saved }))}
        />
      )}

      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} paid bookings`}
        actions={
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setVisible(PAGE_SIZE); }}
            placeholder="Search customer, service…"
            className="sm:w-64"
          />
        }
      />

      {/* Filter — app-style segmented control */}
      <SegmentedControl
        className="mb-5"
        value={filter}
        onChange={(f) => { setFilter(f); setVisible(PAGE_SIZE); }}
        options={["all", "upcoming", "past", "cancelled"].map((f) => ({
          value: f,
          label: f.charAt(0).toUpperCase() + f.slice(1),
          count: counts[f],
        }))}
      />

      {/* Mobile: day-grouped agenda cards */}
      <div className="space-y-5 md:hidden">
        {paged.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="No bookings yet"
            description={filter === "all" ? "They'll show up here as guests book you — share your link to get the first one." : `You have no ${filter} bookings.`}
          />
        ) : (
          groupByDay(paged).map((group) => (
            <section key={group.key}>
              <div className="sticky top-14 z-10 -mx-1 mb-2 bg-canvas/95 px-1 py-1.5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {group.label}
                  <span className="ml-1.5 font-normal text-gray-400">{group.items.length}</span>
                </p>
              </div>
              <div className="space-y-2.5">
                {group.items.map((b) => (
                  <BookingCard key={b.id} booking={b} onOpen={setSelected} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <Card padded={false} className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Booking</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Phone</th>
                <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Service</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Payment</th>
                <th className="px-4 py-3 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No bookings to show yet.</td></tr>
              ) : (
                paged.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-400">#{b.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-0.5 text-xs text-gray-600">{fmtDate(b.scheduled_at)}</p>
                      <p className="text-xs text-gray-400">{fmtTime(new Date(b.scheduled_at))}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.guest_name || "Guest"}</p>
                      <p className="max-w-[160px] truncate text-xs text-gray-400">{b.guest_email || "-"}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{b.guest_phone || "-"}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p className="max-w-[140px] truncate text-xs text-gray-700">{b.services?.title || "-"}</p>
                      <p className="text-xs text-gray-400">{b.services?.price === 0 ? "Free" : `₹${b.services?.price}`}</p>
                    </td>
                    <td className="px-4 py-3"><StatusChip status={b.status} /></td>
                    <td className="hidden px-4 py-3 md:table-cell"><StatusBadge status={b.payment_status} /></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setSelected(b)} title="View details"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Infinite scroll: sentinel grows the window; shared by both views. */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {!hasMore && filtered.length > PAGE_SIZE && (
        <p className="mt-4 text-center text-xs text-gray-400">Showing all {filtered.length} bookings</p>
      )}
    </div>
  );
};

export default Bookings;
