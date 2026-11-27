import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, RotateCcw, Video } from "lucide-react";
import { getGuestBookings, getMySubscriptions, getPurchasedCourses } from "../services/api";
import useFeatureFlags from "../hooks/useFeatureFlags";
import { useRegisterRefresh } from "../components/dashboard/ui/refreshContext";
import { InsightBand, Panel, StatusPill, Tile } from "../components/dashboard/ui/v2";
import { KeptSkeleton } from "./catalog/KeptKit";
import RescheduleModal from "../components/booking/RescheduleModal";
import {
  canConfirm, fmtWhen, homeBand, hostOf, isUpcoming, rebookHref, relWhen, svcOf,
} from "./guest/guestModel";
import { BandGhost, BandPrimary, DateBlock, serif, useBookingActions, ring } from "./guest/GuestKit";

// /user — guest Home (Kept). Mirrors the host Today order: greeting in the topbar
// (the shell renders it on the home path) → one band → 4 tiles → recent bookings.
// Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md §5.

const useLoad = (fn) => {
  const [state, setState] = useState({ data: null, error: false });
  const load = useCallback(() => fn()
    .then(({ data }) => setState({ data, error: false }))
    .catch(() => setState({ data: null, error: true })), [fn]);
  return [state, load];
};

const HomeBand = ({ band, actions, onReschedule, canReschedule }) => {
  const navigate = useNavigate();
  const b = band.booking;
  const open = () => navigate(`/user/my-bookings/${b.id}`);
  if (band.kind === "confirm") {
    const busy = actions.busyId === b.id;
    return (
      <InsightBand mascot="blue" compact eyebrow="Your session has ended"
        title={<>Did your session with {hostOf(b).name || "your host"} <em className={serif}>happen?</em></>}
        sub={`${svcOf(b).title || "Your session"} · ${fmtWhen(b.scheduled_at)}. Saying yes pays your host now.`}
        actions={(
          <>
            <BandPrimary disabled={busy} onClick={() => actions.confirm(b)}>Yes, it did</BandPrimary>
            <BandGhost disabled={busy} onClick={() => actions.report(b)}>Report a problem</BandGhost>
          </>
        )} />
    );
  }
  if (band.kind === "next") {
    return (
      <InsightBand mascot="blue" compact eyebrow={`Your next session · ${relWhen(b.scheduled_at)}`}
        title={svcOf(b).title || "Your session"}
        sub={`with ${hostOf(b).name || "your host"} · ${fmtWhen(b.scheduled_at)}`}
        actions={(
          <>
            {b.meeting_link
              ? <BandPrimary href={b.meeting_link} external><Video className="h-4 w-4" strokeWidth={2.4} /> Join</BandPrimary>
              : <BandPrimary onClick={open}>Open booking <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>}
            {canReschedule
              ? <BandGhost onClick={() => onReschedule(b)}><RotateCcw className="h-4 w-4" strokeWidth={2.4} /> Reschedule</BandGhost>
              : <BandGhost onClick={open}>Details</BandGhost>}
          </>
        )} />
    );
  }
  if (band.kind === "again") {
    return (
      <InsightBand mascot="blue" compact eyebrow="Nothing coming up"
        title={<>Book again with <em className={serif}>{hostOf(b).name || "your host"}</em></>}
        sub={`Your last session was ${svcOf(b).title || "a session"} on ${fmtWhen(b.scheduled_at)}.`}
        actions={<BandPrimary onClick={() => navigate(rebookHref(b))}>Book again <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>} />
    );
  }
  return (
    <InsightBand mascot="blue" compact eyebrow="Welcome"
      title={<>Find your first <em className={serif}>session.</em></>}
      sub="Coaches, teachers and experts you can book in a few taps."
      actions={<BandPrimary onClick={() => navigate("/explore")}>Browse creators <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>} />
  );
};

const GuestOverview = () => {
  const navigate = useNavigate();
  const { on } = useFeatureFlags();
  const [bk, loadBookings] = useLoad(getGuestBookings);
  const [subs, loadSubs] = useLoad(getMySubscriptions);
  const [courses, loadCourses] = useLoad(getPurchasedCourses);
  const [bookings, setBookings] = useState([]);
  const [reschedFor, setReschedFor] = useState(null);
  const actions = useBookingActions(setBookings);

  const loadAll = useCallback(() => Promise.all([loadBookings(), loadSubs(), loadCourses()]), [loadBookings, loadSubs, loadCourses]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useRegisterRefresh(loadAll);
  useEffect(() => { if (Array.isArray(bk.data)) setBookings(bk.data); }, [bk.data]);

  const now = new Date();
  const ready = bk.data !== null || bk.error;
  const band = useMemo(() => homeBand(bookings, new Date()), [bookings]);
  const upcoming = bookings.filter((b) => isUpcoming(b, now)).length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const activeSubs = (subs.data?.subscriptions || []).filter((s) => ["active", "past_due"].includes(s.status)).length;
  const courseCount = Array.isArray(courses.data) ? courses.data.length : 0;
  const recent = [...bookings].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 5);

  // A tile says when its figure is missing, never a fake 0 (Kept: honest states).
  const tile = (state, value) => (state.error ? { value: null, note: "Couldn't load" }
    : state.data === null ? { value: null, note: "Loading…" } : { value });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        {!ready
          ? <div className="h-[188px] animate-pulse rounded-[28px] bg-white sm:rounded-[32px]" />
          : <HomeBand band={band} actions={actions} onReschedule={setReschedFor} canReschedule={on("reschedule")} />}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Upcoming" {...tile(bk, upcoming)} onClick={() => navigate("/user/my-bookings")} />
          <Tile label="Completed" {...tile(bk, completed)} onClick={() => navigate("/user/my-bookings?tab=past")} />
          <Tile label="Memberships" {...tile(subs, activeSubs)} onClick={() => navigate("/user/memberships")} />
          <Tile label="Courses" {...tile(courses, courseCount)} onClick={() => navigate("/user/courses")} />
        </div>
      </div>

      <Panel title="Recent bookings" flush
        action={<Link to="/user/my-bookings" className={`text-[14px] font-semibold text-maroon hover:underline ${ring}`}>See all</Link>}>
        {!ready ? <KeptSkeleton rows={3} />
          : recent.length === 0 ? (
            <div className="px-5 py-8 text-center sm:px-6">
              <CalendarDays className="mx-auto mb-2 h-6 w-6 text-faint" strokeWidth={1.8} />
              <p className="mb-0 text-[14px] text-muted">Sessions you book will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {recent.map((b) => {
                const waiting = canConfirm(b, now);
                return (
                  <li key={b.id}>
                    <Link to={`/user/my-bookings/${b.id}`} className={`flex items-center gap-3 px-5 py-3 transition hover:bg-pink-50 hover:no-underline sm:px-6 ${ring}`}>
                      <DateBlock iso={b.scheduled_at} muted={!isUpcoming(b, now)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{svcOf(b).title || "Service"}</span>
                        <span className="block truncate text-[13px] text-muted">with {hostOf(b).name || "Host"} · {fmtWhen(b.scheduled_at)}</span>
                      </span>
                      <StatusPill status={waiting ? "pending" : b.status}>{waiting ? "Did it happen?" : undefined}</StatusPill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
      </Panel>

      {reschedFor && (
        <RescheduleModal open booking={reschedFor} onClose={() => setReschedFor(null)}
          onDone={(newWhen) => {
            actions.patch(reschedFor.id, { scheduled_at: newWhen, reschedule_count: (reschedFor.reschedule_count || 0) + 1 });
            setReschedFor(null);
          }} />
      )}
    </div>
  );
};

export default GuestOverview;
