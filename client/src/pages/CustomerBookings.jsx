import { Link, useSearchParams } from "react-router-dom";
import { Video } from "lucide-react";
import { PageHeading, StatusPill, cn } from "../components/dashboard/ui/v2";
import { KeptError, KeptSkeleton } from "./catalog/KeptKit";
import {
  amountPaid, bucketOf, canConfirm, canReportCompleted, fmtWhen, hostOf, isUpcoming, svcOf,
} from "./guest/guestModel";
import { DateBlock, GuestEmpty, SessionPrompt, btnPrimary, btnQuiet, ring, useBookingActions, useGuestBookings } from "./guest/GuestKit";

// /user/my-bookings — the guest's bookings (Kept). Tabs over one list; each row
// opens the booking detail (/user/my-bookings/:id). Buttons appear on a row only
// when they apply (founder, 2026-11-27): the ended-session "did it happen?" pair,
// "Didn't happen? Report" inside the report window, and Join before a session.
// Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md §5.

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

const Row = ({ b, now, actions }) => {
  const waiting = canConfirm(b, now);
  const reportable = canReportCompleted(b, now);
  const joinable = b.meeting_link && isUpcoming(b, now);
  return (
    <li>
      <Link to={`/user/my-bookings/${b.id}`} className={cn("flex items-center gap-3 px-5 py-3.5 transition hover:bg-pink-50 hover:no-underline sm:px-6", ring)}>
        <DateBlock iso={b.scheduled_at} muted={!isUpcoming(b, now)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{svcOf(b).title || "Service"}</span>
          <span className="block truncate text-[13px] text-muted">with {hostOf(b).name || "Host"} · {fmtWhen(b.scheduled_at)}</span>
        </span>
        <span className="hidden shrink-0 text-[14px] font-semibold tabular-nums text-ink sm:block">{amountPaid(b)}</span>
        <StatusPill status={waiting ? "pending" : b.status}>{waiting ? "Did it happen?" : undefined}</StatusPill>
      </Link>
      {(waiting || reportable || joinable) && (
        <div className="px-5 pb-3.5 sm:px-6 sm:pl-[84px]">
          {waiting && <SessionPrompt b={b} actions={actions} />}
          {reportable && (
            <button type="button" disabled={actions.busyId === b.id} onClick={() => actions.report(b)} className={btnQuiet}>
              Didn&apos;t happen? Report
            </button>
          )}
          {joinable && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer" className={btnPrimary}>
              <Video className="h-4 w-4" strokeWidth={2.2} /> Join
            </a>
          )}
        </div>
      )}
    </li>
  );
};

const CustomerBookings = () => {
  const { bookings, setBookings, error, load } = useGuestBookings();
  const actions = useBookingActions(setBookings);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "upcoming";

  const now = new Date();
  const list = (bookings || [])
    .filter((b) => bucketOf(b, now) === tab)
    // Upcoming soonest first; past and cancelled most recent first.
    .sort((a, b) => (tab === "upcoming" ? 1 : -1) * (new Date(a.scheduled_at) - new Date(b.scheduled_at)));
  const count = (key) => (bookings || []).filter((b) => bucketOf(b, now) === key).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Bookings" sub="Every session you've booked." />

      <div role="tablist" aria-label="Bookings" className="flex w-fit max-w-full gap-1 rounded-[14px] bg-white p-1">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on}
              onClick={() => setParams(t.key === "upcoming" ? {} : { tab: t.key }, { replace: true })}
              className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition", ring,
                on ? "bg-maroon text-white" : "text-muted hover:bg-blush hover:text-maroon")}>
              {t.label}
              {bookings && <span className={cn("rounded-[6px] px-1.5 text-[12px] tabular-nums", on ? "bg-white/20" : "bg-cream")}>{count(t.key)}</span>}
            </button>
          );
        })}
      </div>

      {error && !bookings ? <KeptError what="bookings" onRetry={load} />
        : !bookings ? <KeptSkeleton rows={4} />
          : bookings.length === 0 ? (
            <GuestEmpty mascot="blue" title="No bookings yet" sub="When you book a session, it'll show up here."
              action={<Link to="/explore" className={btnPrimary}>Find a creator to book</Link>} />
          ) : list.length === 0 ? (
            <div className="rounded-[24px] bg-white px-6 py-10 text-center text-[14px] text-muted">
              Nothing {tab === "upcoming" ? "coming up" : tab === "past" ? "in the past yet" : "cancelled"}.
              {tab === "upcoming" && <> <Link to="/explore" className="font-semibold text-maroon hover:underline">Book a session</Link></>}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white">
              {list.map((b) => <Row key={b.id} b={b} now={now} actions={actions} />)}
            </ul>
          )}
    </div>
  );
};

export default CustomerBookings;
