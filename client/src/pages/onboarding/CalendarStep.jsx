import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, CalendarPlus, Video } from 'lucide-react';
import { getMe, skipCalendar } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { analytics } from '../../services/analytics';
import { EVENTS } from '../../services/analytics/events';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import PetalSpinner from '../../components/common/PetalSpinner';
import { needsCalendar } from './needsCalendar';

const REASONS = [
  { Icon: CalendarClock, text: 'We hide times you’re already busy' },
  { Icon: CalendarPlus, text: 'New bookings land on your calendar' },
  { Icon: Video, text: 'Online sessions get a Google Meet link' },
];

/**
 * CalendarStep — conditional, skippable screen between plan and live.
 *
 * Route: /vendor-register/:slug/calendar. PlansStep sends only hosts without a
 * working Google Calendar here (needsCalendar), so guests aren't booked into
 * times the host is busy. Google returns to this route with ?google=connected
 * or ?google=denied; the return is handled once (ref) because StrictMode runs
 * effects twice in dev and must not double-track or double-navigate.
 */
const CalendarStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ready = useOnboardingGuard();
  const { user, updateUser, connectGoogleCalendar } = useAuth() || {};
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const google = params.get('google');
  const denied = google === 'denied';
  const goLive = () => navigate(`/vendor-register/${slug}/live`, { replace: true });

  useEffect(() => {
    if (!ready || handledRef.current) return;
    if (google === 'connected') {
      handledRef.current = true;
      // Deliberately not cancelled on cleanup: under StrictMode the first effect
      // run is torn down, and the ref above stops the second from re-running.
      (async () => {
        try {
          const { data } = await getMe();
          updateUser?.(data);
        } catch { /* server already recorded the connection; carry on */ }
        analytics.track(EVENTS.CALENDAR_CONNECTED, { source: 'onboarding' });
        toast.success('Calendar connected.');
        goLive();
      })();
      return;
    }
    // Already connected/skipped (resume link, back button): nothing to ask.
    // Re-runs when the flags change because AuthContext seeds `user` from a
    // possibly stale localStorage copy and refreshes it async. handledRef keeps
    // this (and the ?google= branch above) to a single navigation.
    if (!google && !needsCalendar(user)) {
      handledRef.current = true;
      goLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.google_calendar_connected, user?.calendar_skipped]);

  const connect = async () => {
    setBusy(true);
    try {
      await connectGoogleCalendar(`/vendor-register/${slug}/calendar`);
    } catch {
      toast.error('Could not reach Google. Please try again.');
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    handledRef.current = true; // the context update below must not trigger a second redirect
    try {
      await skipCalendar();
      // Mirror the server flag so Back from /live doesn't re-show this screen.
      updateUser?.({ calendar_skipped: true });
    } catch { /* skipping must never block going live */ }
    goLive();
  };

  if (!ready || google === 'connected') {
    return (
      <div className="min-h-screen bg-canvas">
        <OnboardingStepper current={2} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center"><PetalSpinner size={48} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-16 font-sans text-ink">
      <OnboardingStepper current={2} />
      <main className="mx-auto max-w-xl px-5 pt-8 sm:pt-12">
        <div className="onb-rise">
          <h1 className="font-display text-[clamp(28px,4.5vw,42px)] font-extrabold leading-[1.1] tracking-tight text-maroon">
            Connect your <span className="font-serif font-normal italic">calendar</span>
          </h1>

          <section className="mt-card mt-7 !gap-5">
            <ul className="flex flex-col gap-4">
              {REASONS.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-maroon">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">Any Google account works — it doesn’t have to be the one you signed in with.</p>

            {denied && (
              <p role="alert" className="rounded-md bg-blush px-4 py-3 text-sm text-ink">
                Calendar access wasn’t granted — tick the calendar boxes on Google’s screen, or skip for now.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={connect} disabled={busy} className="mt-btn flex-1">
                Connect Google Calendar
              </button>
              <button type="button" onClick={skip} disabled={busy} className="mt-btn mt-btn--secondary flex-1">
                Skip for now
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CalendarStep;
