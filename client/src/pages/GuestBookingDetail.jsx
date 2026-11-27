import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Repeat, RotateCcw, Star, Video } from "lucide-react";
import { getBookingReview } from "../services/api";
import useFeatureFlags from "../hooks/useFeatureFlags";
import { Panel, StatusPill, cn } from "../components/dashboard/ui/v2";
import { KeptError } from "./catalog/KeptKit";
import RescheduleModal from "../components/booking/RescheduleModal";
import ReviewModal from "../components/booking/ReviewModal";
import {
  amountPaid, canConfirm, canReportCompleted, fmtWhen, hostOf, isUpcoming, rebookHref, shortId, svcOf,
} from "./guest/guestModel";
import {
  GuestEmpty, SessionPrompt, btnDanger, btnPrimary, btnQuiet, btnSoft, downloadInvoice, ring,
  useBookingActions, useGuestBookings,
} from "./guest/GuestKit";

// /user/my-bookings/:id — one booking, every action in one place (Kept). Replaces
// the old details popup AND carries the actions that sat on list rows: Join,
// "did it happen?", report, reschedule, cancel, review, invoice, rebook. Same
// rules and endpoints as before. Data: the guest's bookings list (no new endpoint);
// an id that isn't theirs shows "Booking not found".

const Line = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 py-3 text-[14px]">
    <span className="text-muted">{label}</span>
    <span className="min-w-0 truncate text-right font-semibold text-ink">{children}</span>
  </div>
);

const Stars = ({ n }) => (
  <span className="inline-flex" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("h-4 w-4", i <= n ? "fill-marigold text-marigold" : "text-neutral-200")} strokeWidth={1.5} />)}
  </span>
);

const GuestBookingDetail = () => {
  const { id } = useParams();
  const { on } = useFeatureFlags();
  const { bookings, setBookings, error, load } = useGuestBookings();
  const actions = useBookingActions(setBookings);
  const [review, setReview] = useState(undefined); // undefined = not loaded
  const [resched, setResched] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const b = bookings?.find((x) => String(x.id) === String(id));
  const completed = b?.status === "completed";
  useEffect(() => {
    if (!completed) return;
    getBookingReview(b.id).then(({ data }) => setReview(data || null)).catch(() => setReview(null));
  }, [completed, b?.id]);

  const back = (
    <Link to="/user/my-bookings" className={cn("inline-flex w-fit items-center gap-1.5 rounded-[12px] px-2 py-1.5 text-[14px] font-semibold text-muted transition hover:bg-white hover:text-maroon hover:no-underline", ring)}>
      <ArrowLeft className="h-4 w-4" strokeWidth={2.2} /> Bookings
    </Link>
  );

  if (error && !bookings) return <div className="flex flex-col gap-4">{back}<KeptError what="bookings" onRetry={load} /></div>;
  if (!bookings) return <div className="flex flex-col gap-4">{back}<div className="h-72 animate-pulse rounded-[24px] bg-white" /></div>;
  if (!b) {
    return (
      <div className="flex flex-col gap-4">{back}
        <GuestEmpty mascot="blue" title="Booking not found" sub="It may belong to another account, or the link is out of date."
          action={<Link to="/user/my-bookings" className={btnPrimary}>See your bookings</Link>} />
      </div>
    );
  }

  const now = new Date();
  const svc = svcOf(b); const host = hostOf(b);
  const upcoming = isUpcoming(b, now);
  const waiting = canConfirm(b, now);
  const rebook = (completed || b.status === "cancelled") ? rebookHref(b) : null;
  const canReview = on("review_submission");

  return (
    <div className="flex flex-col gap-4">
      {back}
      <header>
        <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[34px]">{svc.title || "Your session"}</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          with {host.username ? <Link to={`/${host.username}`} className="font-semibold text-maroon hover:underline">{host.name || "Host"}</Link> : (host.name || "Host")} · {fmtWhen(b.scheduled_at)}
        </p>
      </header>

      {waiting && (
        <div className="rounded-[24px] bg-white p-5 sm:p-6"><SessionPrompt b={b} actions={actions} /></div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel title="Booking">
          <div className="-my-3 divide-y divide-neutral-200">
            <Line label="Status"><StatusPill status={waiting ? "pending" : b.status}>{waiting ? "Did it happen?" : undefined}</StatusPill></Line>
            <Line label="Date and time">{fmtWhen(b.scheduled_at)}</Line>
            {svc.duration ? <Line label="Duration">{svc.duration} min</Line> : null}
            <Line label="Amount">{amountPaid(b)}</Line>
            <Line label="Booking ID"><span className="tabular-nums">{shortId(b.id)}</span></Line>
          </div>
        </Panel>

        <Panel title="Actions">
          <div className="flex flex-col gap-2">
            {b.meeting_link && upcoming && (
              <a href={b.meeting_link} target="_blank" rel="noreferrer" className={btnPrimary}><Video className="h-4 w-4" strokeWidth={2.2} /> Join</a>
            )}
            <button type="button" onClick={() => downloadInvoice(b)} className={btnSoft}><Download className="h-4 w-4" strokeWidth={2.2} /> Download invoice</button>
            {upcoming && on("reschedule") && (
              <button type="button" onClick={() => setResched(true)} className={btnSoft}><RotateCcw className="h-4 w-4" strokeWidth={2.2} /> Reschedule</button>
            )}
            {completed && canReview && !review && review !== undefined && (
              <button type="button" onClick={() => setReviewing(true)} className={btnSoft}><Star className="h-4 w-4" strokeWidth={2.2} /> Write a review</button>
            )}
            {rebook && <Link to={rebook} className={btnSoft}><Repeat className="h-4 w-4" strokeWidth={2.2} /> Book again</Link>}
            {canReportCompleted(b, now) && (
              <button type="button" disabled={actions.busyId === b.id} onClick={() => actions.report(b)} className={btnQuiet}>Didn&apos;t happen? Report</button>
            )}
            {upcoming && (
              <button type="button" disabled={actions.busyId === b.id} onClick={() => actions.cancel(b)} className={btnDanger}>
                {actions.busyId === b.id ? "Cancelling…" : "Cancel booking"}
              </button>
            )}
          </div>
        </Panel>
      </div>

      {completed && review && (
        <Panel title="Your review" action={canReview && <button type="button" onClick={() => setReviewing(true)} className={btnQuiet}>Edit</button>}>
          <Stars n={review.rating} />
          {review.comment && <p className="mb-0 mt-2 text-[14px] text-ink">{review.comment}</p>}
        </Panel>
      )}

      {resched && (
        <RescheduleModal open booking={b} onClose={() => setResched(false)}
          onDone={(newWhen) => { actions.patch(b.id, { scheduled_at: newWhen, reschedule_count: (b.reschedule_count || 0) + 1 }); setResched(false); }} />
      )}
      {reviewing && (
        <ReviewModal open booking={b} existing={review || null} onClose={() => setReviewing(false)}
          onDone={(r) => { setReview(r); setReviewing(false); }} />
      )}
    </div>
  );
};

export default GuestBookingDetail;
