import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getHostBookings, cancelBooking, completeBooking, markNoShow,
  rescheduleBooking, getAvailability, getBookedSlots, getBookingReview,
} from "../services/api";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Star, CalendarDays, CalendarClock, CalendarCheck2,
  Clock, CheckCircle2, Plus, Calendar as CalendarIcon, List as ListIcon,
  User, Briefcase, CreditCard, FileText, StickyNote, MapPin, ArrowRight, CalendarX2,
} from "lucide-react";
import ReviewModal from "../components/booking/ReviewModal";
import useFeatureFlags from "../hooks/useFeatureFlags";
import StatusChip from "../components/common/StatusChip";
import { useAuth } from "../context/AuthContext";
import {
  Card, Button, Modal, StatusBadge, SkeletonCard, EmptyState, ErrorState, cn,
} from "../components/dashboard/ui";
import { isPreviewEnabled, getPreviewBookings } from "../utils/previewData";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const initialOf = (name) => (name || "G").trim().charAt(0).toUpperCase();

// Soft card tones per status — purple / green / orange / pink variations.
const CARD_TONE = {
  confirmed: { card: "border-l-[#9B7CF6] bg-[#F6F3FF]", time: "text-[#7C6BB0]", dot: "bg-[#9B7CF6]" },
  completed: { card: "border-l-[#10BF83] bg-[#ECFBF4]", time: "text-[#3E8C72]", dot: "bg-[#10BF83]" },
  pending:   { card: "border-l-[#F59E0B] bg-[#FFF5EA]", time: "text-[#B07A2A]", dot: "bg-[#F59E0B]" },
  no_show:   { card: "border-l-[#F50069] bg-[#FFF1F7]", time: "text-[#C05B87]", dot: "bg-[#F50069]" },
  cancelled: { card: "border-l-[#B9B4C7] bg-[#F4F3F7]", time: "text-[#8A849B]", dot: "bg-[#B9B4C7]" },
};
const tone = (status) => CARD_TONE[String(status || "").toLowerCase()] || CARD_TONE.confirmed;

/* ===========================================================================
 * RESCHEDULE MODAL — unchanged (real availability + rescheduleBooking)
 * ========================================================================= */
const RescheduleModal = ({ booking, onClose, onDone }) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [avail, setAvail] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => { getAvailability().then(({ data }) => setAvail(data)).catch(() => {}); }, []);
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
    } finally { setSaving(false); }
  };
  const slots = getAvailSlots();
  const formatSlot = (t) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM", hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <Modal open onClose={onClose} title="Reschedule Booking" size="sm">
      <p className="mb-4 text-xs text-ink/40">{booking.services?.title} &bull; {booking.guest_name}</p>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }} aria-label="Previous month" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-blush"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-sm font-semibold">{MONTHS[calMonth]} {calYear}</span>
        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }} aria-label="Next month" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-blush"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-ink/40">{DS.map((d, i) => <div key={i}>{d}</div>)}</div>
      <div className="mb-4 grid grid-cols-7 gap-1 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={"e" + i} />;
          const ok = isDateSelectable(day);
          return (
            <button key={day} disabled={!ok} onClick={() => { if (ok) { setSelDate(new Date(calYear, calMonth, day)); setSelTime(""); } }}
              className={cn("grid aspect-square min-h-11 place-items-center rounded-lg text-sm transition-colors", isSel(day) ? "bg-primary font-semibold text-white" : !ok ? "cursor-default text-ink/30" : "hover:bg-blush active:bg-blush")}>
              {day}
            </button>
          );
        })}
      </div>
      {selDate && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted">Available times{avail?.timezone ? <span className="ml-1 text-ink/40">({avail.timezone.split("/")[1] || avail.timezone})</span> : ""}</p>
          {loadingSlots ? (
            <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-blush" />)}</div>
          ) : slots.length === 0 ? (
            <p className="py-2 text-sm text-ink/40">No available slots for this date.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {slots.map((t) => (
                <button key={t} onClick={() => setSelTime(t)} className={cn("min-h-11 rounded-lg border text-sm font-medium transition-colors", selTime === t ? "border-primary bg-primary text-white" : "hover:border-gray-400 active:bg-blush/40")}>{formatSlot(t)}</button>
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

/* ===========================================================================
 * BOOKING DETAIL MODAL — redesigned (left info + right tabs). Reuses the real
 * action handlers (complete / no-show / cancel / reschedule / review).
 * ========================================================================= */
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="inline-flex items-center gap-2 text-sm text-ink/50">
      <Icon className="h-4 w-4 text-primary/70" strokeWidth={2} />{label}
    </span>
    <span className="text-right text-sm font-semibold text-ink">{value}</span>
  </div>
);

const BookingDetailModal = ({ booking, onClose, onAction, review, onReviewDone }) => {
  const { on } = useFeatureFlags();
  const [tab, setTab] = useState("details");
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const doAction = async (action) => {
    setBusy(true);
    try {
      if (action === "complete") { await completeBooking(booking.id); toast.success("Marked as completed"); }
      if (action === "no_show") { await markNoShow(booking.id); toast.success("Marked as no-show"); }
      if (action === "cancel") { await cancelBooking(booking.id); toast.success("Booking cancelled"); }
      onAction(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally { setBusy(false); setConfirming(null); }
  };

  const dt = new Date(booking.scheduled_at);
  const endDt = new Date(dt.getTime() + (booking.services?.duration || 30) * 60000);
  const isFree = booking.services?.price === 0;
  const future = new Date(booking.scheduled_at) > new Date();
  const terminal = ["cancelled", "completed", "no_show"].includes(booking.status);

  if (showReschedule)
    return <RescheduleModal booking={booking} onClose={() => setShowReschedule(false)} onDone={() => { setShowReschedule(false); onAction(); onClose(); }} />;
  if (showReview)
    return <ReviewModal open booking={booking} direction="host_to_guest" existing={review || null} onClose={() => setShowReview(false)} onDone={(saved) => { setShowReview(false); if (onReviewDone) onReviewDone(saved); }} />;

  const TABS = [
    { id: "details", label: "Booking Details" },
    { id: "timeline", label: "Timeline" },
    { id: "actions", label: "Actions" },
  ];

  const actionButtons = (
    <>
      {booking.status === "confirmed" && future && (
        <Button size="lg" variant="outline" className="text-primary" onClick={() => setShowReschedule(true)}>Reschedule</Button>
      )}
      {booking.status === "confirmed" && !future && (
        <Button size="lg" onClick={() => setConfirming("complete")}>Mark Completed</Button>
      )}
      {booking.status === "confirmed" && !future && (
        <Button size="lg" variant="outline" onClick={() => setConfirming("no_show")}>No-show</Button>
      )}
      {!terminal && (
        <Button size="lg" variant="danger-outline" onClick={() => setConfirming("cancel")}>Cancel Booking</Button>
      )}
      {booking.status === "completed" && on("review_submission") && booking.guest_id && !review && (
        <Button size="lg" onClick={() => setShowReview(true)}>Review Guest</Button>
      )}
    </>
  );

  return (
    <Modal open onClose={onClose} title="Booking Details" size="xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ── Left: service + schedule + customer ─────────────────────── */}
        <div className="flex flex-col">
          {/* Service image (real only if present) or a branded placeholder */}
          <div className="relative mb-3 overflow-hidden rounded-2xl">
            {booking.services?.image ? (
              <img src={booking.services.image} alt={booking.services?.title || "Service"} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#FFE1F1] via-[#FBD3E6] to-[#EDE3FF]">
                <span className="font-display text-3xl font-extrabold text-maroon/70">{booking.services?.title || "Service"}</span>
              </div>
            )}
            <span className="absolute left-3 top-3"><StatusChip status={booking.status} /></span>
          </div>
          <h3 className="font-display text-xl font-extrabold text-maroon">{booking.services?.title || "Service"}</h3>
          {booking.services?.description && <p className="mt-1 text-sm text-muted">{booking.services.description}</p>}

          <div className="mt-3 space-y-2 border-t border-maroon/10 pt-3">
            <div className="flex items-start gap-2 text-sm">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" strokeWidth={2} />
              <div>
                <p className="font-semibold text-ink">{fmtDate(booking.scheduled_at)}</p>
                <p className="text-xs text-muted">{fmtTime(dt)} – {fmtTime(endDt)}</p>
              </div>
            </div>
            {booking.location && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" strokeWidth={2} />
                <p className="text-ink">{booking.location}</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2.5 border-t border-maroon/10 pt-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initialOf(booking.guest_name)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">Booked by</p>
              <p className="truncate text-sm font-semibold text-ink">{booking.guest_name || "Guest"}</p>
            </div>
            {booking.guest_id && (
              <Link to={`/dashboard/clients/${booking.guest_id}`} onClick={onClose} className="inline-flex items-center gap-1 rounded-full border border-maroon/15 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-blush/50">
                View Profile <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Right: tabs ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div role="tablist" className="mb-4 flex gap-1 rounded-full border border-maroon/10 bg-blush/40 p-1">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn("flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition", tab === t.id ? "bg-white text-primary shadow-sm" : "text-ink/50 hover:text-ink")}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "details" && (
            <div className="divide-y divide-maroon/5">
              <InfoRow icon={Briefcase} label="Service" value={booking.services?.title || "—"} />
              <InfoRow icon={Clock} label="Duration" value={`${booking.services?.duration || 30} min`} />
              {booking.staff_name && <InfoRow icon={User} label="Staff" value={booking.staff_name} />}
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-ink/50"><CreditCard className="h-4 w-4 text-primary/70" strokeWidth={2} />Payment Status</span>
                <StatusBadge status={booking.payment_status} />
              </div>
              <InfoRow icon={CreditCard} label="Amount" value={isFree ? "Free" : `₹${booking.services?.price}`} />
              {booking.vendor_amount != null && <InfoRow icon={CreditCard} label="Your earnings" value={`₹${booking.vendor_amount}`} />}
              <div className="flex items-start justify-between gap-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-ink/50"><StickyNote className="h-4 w-4 text-primary/70" strokeWidth={2} />Notes</span>
                <span className="max-w-[60%] text-right text-sm text-ink">{booking.notes || "—"}</span>
              </div>
            </div>
          )}

          {tab === "timeline" && (
            <ol className="relative space-y-4 pl-5">
              <span aria-hidden="true" className="absolute left-[7px] top-1 h-[calc(100%-0.5rem)] w-px bg-maroon/10" />
              {[
                { icon: FileText, label: "Booked", value: fmtDate(booking.created_at || booking.scheduled_at) },
                { icon: CalendarDays, label: "Scheduled", value: `${fmtDate(booking.scheduled_at)} · ${fmtTime(dt)}` },
                ...(booking.reschedule_status && booking.reschedule_status !== "none"
                  ? [{ icon: CalendarClock, label: "Reschedule", value: booking.reschedule_status === "acknowledged" ? "Guest acknowledged" : "Awaiting guest" }] : []),
                { icon: CheckCircle2, label: "Current status", value: <StatusChip status={booking.status} /> },
              ].map((step, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary/15 ring-2 ring-white"><span className="h-1.5 w-1.5 rounded-full bg-primary" /></span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{step.label}</p>
                  <div className="text-sm font-medium text-ink">{step.value}</div>
                </li>
              ))}
            </ol>
          )}

          {tab === "actions" && (
            confirming ? (
              <div className="rounded-2xl border-2 border-rose/30 bg-blush p-4">
                <p className="mb-3 text-sm font-medium text-maroon">
                  {confirming === "cancel"
                    ? booking.payment_status === "paid"
                      ? "Cancel this paid booking? The guest will be notified. Cancelling does NOT refund automatically — process any refund manually."
                      : "Cancel this booking? The guest will be notified."
                    : confirming === "no_show" ? "Mark this booking as a no-show?" : "Mark as completed?"}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button size="lg" variant="outline" full onClick={() => setConfirming(null)}>Back</Button>
                  <Button size="lg" full variant={confirming === "cancel" ? "danger" : "primary"} onClick={() => doAction(confirming)} disabled={busy}>
                    {busy ? "..." : confirming === "cancel" ? "Yes, cancel" : confirming === "no_show" ? "Yes, no-show" : "Yes, complete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {actionButtons}
                {terminal && booking.status !== "completed" && <p className="text-sm text-ink/40">No actions available for a {booking.status} booking.</p>}
                {booking.status === "completed" && on("review_submission") && booking.guest_id && review && (
                  <div className="rounded-2xl border-2 border-c-emerald/20 bg-c-emerald/5 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-c-emerald"><Star size={14} className="fill-c-emerald text-c-emerald" /> Review submitted</span>
                      <button onClick={() => setShowReview(true)} className="text-xs font-medium text-maroon hover:underline">Edit review</button>
                    </div>
                    <p className="mt-1 text-sm tracking-tight text-maroon">{"★".repeat(review.rating)}<span className="text-ink/30">{"★".repeat(5 - review.rating)}</span></p>
                    {review.comment && <p className="mt-1 text-sm leading-relaxed text-muted">{review.comment}</p>}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Persistent bottom action bar (the reference's Reschedule / Cancel). */}
      {!confirming && !terminal && (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-maroon/10 pt-4">
          {booking.status === "confirmed" && future && (
            <Button size="lg" variant="outline" className="text-primary" onClick={() => setShowReschedule(true)}>Reschedule</Button>
          )}
          <Button size="lg" variant="danger-outline" onClick={() => { setTab("actions"); setConfirming("cancel"); }}>Cancel Booking</Button>
        </div>
      )}
    </Modal>
  );
};

/* ===========================================================================
 * Summary cards
 * ========================================================================= */
const SummaryCard = ({ icon: Icon, label, value, to, tone: t }) => {
  const tones = {
    pink: "bg-[#FFE1F1] text-[#F50069]",
    orange: "bg-[#FFF0DD] text-[#D97706]",
    green: "bg-[#E7FAF2] text-[#10BF83]",
  };
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl border border-maroon/10 bg-white p-4 shadow-sm transition hover:border-primary/30">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tones[t])}><Icon className="h-5 w-5" strokeWidth={2} /></span>
        <div>
          <p className="text-xs font-semibold text-ink/50">{label}</p>
          <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-ink/30" />
    </Link>
  );
};

/* ===========================================================================
 * Booking card (calendar cell)
 * ========================================================================= */
const BookingCard = ({ booking, onOpen }) => {
  const t = tone(booking.status);
  return (
    <button type="button" onClick={() => onOpen(booking)}
      className={cn("flex w-full items-center gap-2 rounded-xl border-l-[3px] p-2 text-left transition hover:-translate-y-0.5 hover:shadow-[0_6px_14px_-10px_rgba(23,22,74,0.45)]", t.card)}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-primary shadow-sm">{initialOf(booking.guest_name)}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[11px] font-semibold leading-tight", t.time)}>{fmtTime(booking.scheduled_at)}</span>
        <span className="block truncate text-[12px] font-bold leading-tight text-[#17164A]">{booking.services?.title || "Service"}</span>
        <span className="block text-[10px] text-ink/40">{booking.guest_name} · {booking.services?.duration || 30}m</span>
      </span>
    </button>
  );
};

/* ===========================================================================
 * Main page
 * ========================================================================= */
const Bookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState({});
  const [viewMode, setViewMode] = useState("calendar"); // 'calendar' | 'list'
  const [calView, setCalView] = useState("week");        // 'week' | 'month' | 'agenda'
  const [anchor, setAnchor] = useState(() => new Date());

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    // DEV-only UI preview — sample bookings, no API call. Gated on the flag.
    if (isPreviewEnabled()) {
      setBookings(getPreviewBookings() || []);
      setLoading(false);
      return;
    }
    try {
      const { data } = await getHostBookings();
      const list = data || [];
      setBookings(list);
      const completedWithGuest = list.filter((b) => b.status === "completed" && b.guest_id);
      Promise.all(completedWithGuest.map((b) => getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])))
        .then((pairs) => setReviews(Object.fromEntries(pairs)));
    } catch {
      setError(true);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);

  const counts = useMemo(() => {
    const now = new Date();
    const terminal = (s) => ["cancelled", "completed", "no_show"].includes(s);
    return {
      upcoming: bookings.filter((b) => !terminal(b.status) && new Date(b.scheduled_at) > now).length,
      pending: bookings.filter((b) => b.status === "pending" || (!terminal(b.status) && new Date(b.scheduled_at) <= now)).length,
      completed: bookings.filter((b) => b.status === "completed").length,
    };
  }, [bookings]);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, bookings: bookings.filter((b) => sameDay(new Date(b.scheduled_at), date)).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)) };
  }), [weekStart, bookings]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const leading = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -leading);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return { date, inMonth: date.getMonth() === monthStart.getMonth(), bookings: bookings.filter((b) => sameDay(new Date(b.scheduled_at), date)) };
    });
  }, [anchor, bookings]);

  const agendaGroups = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const groups = []; const idx = {};
    for (const b of sorted) {
      const d = new Date(b.scheduled_at); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (idx[key] == null) { idx[key] = groups.length; groups.push({ key, date: d, items: [] }); }
      groups[idx[key]].items.push(b);
    }
    return groups;
  }, [bookings]);

  const step = (dir) => setAnchor((a) => calView === "month" ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7));
  const today = new Date();

  const newBooking = () => {
    if (user?.username) window.open(`/${user.username}`, "_blank", "noopener");
    else navigate("/dashboard/profile");
  };

  const title = calView === "month"
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  const header = (
    <>
      {/* Heading */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-6 w-6" strokeWidth={2} /></span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-maroon sm:text-[28px]">Bookings</h1>
            <p className="mt-0.5 text-sm text-muted">Manage your upcoming and completed appointments.</p>
          </div>
        </div>
        <button type="button" onClick={newBooking} className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 sm:self-auto">
          <Plus className="h-4 w-4" strokeWidth={2.4} /> New Booking
        </button>
      </div>
      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={CalendarClock} label="Upcoming" value={counts.upcoming} to="/dashboard/bookings" tone="pink" />
        <SummaryCard icon={Clock} label="Pending" value={counts.pending} to="/dashboard/bookings" tone="orange" />
        <SummaryCard icon={CalendarCheck2} label="Completed" value={counts.completed} to="/dashboard/bookings" tone="green" />
      </div>
    </>
  );

  return (
    <div className="rounded-3xl bg-gradient-to-b from-blush/40 via-transparent to-transparent p-0.5">
      {header}

      {loading ? (
        <div className="rounded-2xl border border-maroon/10 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        </div>
      ) : error && bookings.length === 0 ? (
        <div className="rounded-2xl border border-maroon/10 bg-white p-4 shadow-sm">
          <ErrorState message="Couldn't load your bookings." onRetry={fetch} />
        </div>
      ) : (
        <>
      {selected && (
        <BookingDetailModal
          booking={selected}
          onClose={() => setSelected(null)}
          onAction={fetch}
          review={reviews[selected.id] || null}
          onReviewDone={(saved) => setReviews((m) => ({ ...m, [selected.id]: saved }))}
        />
      )}

      {/* Calendar toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-maroon/10 bg-white p-2.5 shadow-sm">
        <div className="flex items-center rounded-full border border-maroon/10 bg-blush/40 p-0.5">
          {[{ id: "calendar", label: "Calendar", Icon: CalendarIcon }, { id: "list", label: "List", Icon: ListIcon }].map((v) => (
            <button key={v.id} type="button" onClick={() => setViewMode(v.id)} aria-pressed={viewMode === v.id}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition", viewMode === v.id ? "bg-white text-primary shadow-sm" : "text-ink/50 hover:text-ink")}>
              <v.Icon className="h-4 w-4" />{v.label}
            </button>
          ))}
        </div>

        {viewMode === "calendar" && (
          <>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} aria-label="Previous" className="grid h-8 w-8 place-items-center rounded-full border border-maroon/10 text-ink/60 hover:bg-blush/50 hover:text-primary"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[132px] text-center text-sm font-bold text-maroon">{title}</span>
              <button type="button" onClick={() => step(1)} aria-label="Next" className="grid h-8 w-8 place-items-center rounded-full border border-maroon/10 text-ink/60 hover:bg-blush/50 hover:text-primary"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => setAnchor(new Date())} className="rounded-full border border-maroon/15 px-3 py-1.5 text-[13px] font-semibold text-ink/70 transition hover:bg-blush/50 hover:text-primary">Today</button>
            <div className="ml-auto flex items-center rounded-full border border-maroon/10 bg-blush/40 p-0.5">
              {["week", "month", "agenda"].map((v) => (
                <button key={v} type="button" onClick={() => setCalView(v)} aria-pressed={calView === v}
                  className={cn("rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize transition", calView === v ? "bg-white text-primary shadow-sm" : "text-ink/50 hover:text-ink")}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── CALENDAR VIEWS ─────────────────────────────────────────────── */}
      {viewMode === "calendar" && calView === "week" && (
        <div className="overflow-hidden rounded-2xl border border-maroon/10 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="grid min-w-[920px] grid-cols-7">
              {weekDays.map(({ date, bookings: dayBookings }, i) => {
                const isToday = sameDay(date, today);
                return (
                  <div key={i} className={cn("flex min-h-[320px] flex-col border-r border-[#FFE8F3] last:border-r-0", isToday && "bg-blush/30")}>
                    <div className={cn("border-b border-[#FFE8F3] px-2 py-2 text-center", isToday && "bg-primary/10")}>
                      <p className="text-[11px] font-semibold uppercase text-ink/40">{WEEKDAYS[i]}</p>
                      <p className={cn("font-display text-xl font-extrabold", isToday ? "text-primary" : "text-ink")}>{date.getDate()}</p>
                    </div>
                    <div className="flex-1 space-y-1.5 p-1.5">
                      {dayBookings.map((b) => <BookingCard key={b.id} booking={b} onOpen={setSelected} />)}
                      <button type="button" onClick={newBooking} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-maroon/15 py-1.5 text-[11px] font-semibold text-ink/40 transition hover:border-primary/40 hover:text-primary">
                        <Plus className="h-3 w-3" /> Add Booking
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === "calendar" && calView === "month" && (
        <div className="overflow-hidden rounded-2xl border border-maroon/10 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-[#FFE8F3] bg-blush/40">
            {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-[11px] font-bold uppercase text-maroon/60">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map(({ date, inMonth, bookings: dayBookings }, i) => (
              <div key={i} className={cn("min-h-[92px] border-b border-r border-[#FFE8F3] p-1 last:border-r-0", !inMonth && "bg-blush/20", sameDay(date, today) && "bg-primary/5")}>
                <p className={cn("text-[11px] font-bold", sameDay(date, today) ? "text-primary" : inMonth ? "text-ink/60" : "text-ink/25")}>{date.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {dayBookings.slice(0, 3).map((b) => (
                    <button key={b.id} type="button" onClick={() => setSelected(b)} className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold text-[#17164A]", tone(b.status).card)}>
                      {fmtTime(b.scheduled_at).replace(":00", "")} {b.services?.title}
                    </button>
                  ))}
                  {dayBookings.length > 3 && <p className="px-1 text-[10px] text-ink/40">+{dayBookings.length - 3} more</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "calendar" && calView === "agenda" && (
        <div className="space-y-4">
          {agendaGroups.length === 0 ? (
            <EmptyState icon={CalendarX2} title="No bookings yet" description="They'll show up here as guests book you." />
          ) : agendaGroups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-2xl border border-maroon/10 bg-white shadow-sm">
              <p className="border-b border-maroon/10 bg-blush/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-maroon/70">
                {g.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <div className="divide-y divide-maroon/5">
                {g.items.map((b) => (
                  <button key={b.id} type="button" onClick={() => setSelected(b)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blush/30">
                    <span className={cn("h-9 w-1 shrink-0 rounded-full", tone(b.status).dot)} />
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initialOf(b.guest_name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{b.services?.title} · {b.guest_name}</span>
                      <span className="block text-xs text-muted">{fmtTime(b.scheduled_at)} · {b.services?.duration || 30} min</span>
                    </span>
                    <StatusChip status={b.status} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW (table) ──────────────────────────────────────────── */}
      {viewMode === "list" && (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-blush/40 text-xs uppercase tracking-wider text-maroon/70">
                  <th className="px-4 py-3 text-left font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Service</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Payment</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-maroon/5">
                {bookings.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-ink/40">No bookings to show yet.</td></tr>
                ) : [...bookings].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).map((b) => (
                  <tr key={b.id} onClick={() => setSelected(b)} className="cursor-pointer transition-colors hover:bg-blush/40">
                    <td className="px-4 py-3"><p className="text-xs font-medium text-ink">{fmtDate(b.scheduled_at)}</p><p className="text-xs text-ink/40">{fmtTime(b.scheduled_at)}</p></td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{b.guest_name || "Guest"}</p><p className="max-w-[160px] truncate text-xs text-ink/40">{b.guest_email || "-"}</p></td>
                    <td className="hidden px-4 py-3 sm:table-cell"><p className="max-w-[160px] truncate text-xs text-ink">{b.services?.title || "-"}</p></td>
                    <td className="px-4 py-3"><StatusChip status={b.status} /></td>
                    <td className="hidden px-4 py-3 md:table-cell"><StatusBadge status={b.payment_status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setSelected(b); }} className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-blush/50">View details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state (calendar views with zero bookings) */}
      {viewMode === "calendar" && calView !== "agenda" && bookings.length === 0 && (
        <div className="mt-3 rounded-2xl border border-maroon/10 bg-white p-6 shadow-sm">
          <EmptyState icon={CalendarX2} title="No bookings yet" description="They'll show up here as guests book you — share your link to get the first one." />
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Bookings;
