import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import {
  CalendarClock, CheckCircle2, XCircle, CalendarDays, LayoutGrid, IndianRupee,
  UserCheck, Hourglass, Camera, UserCog, Tag, CalendarCheck, ShieldCheck, MapPin,
  Check, ArrowRight, Copy, Link2, MessageCircle, Wallet, Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getHostBookings, getMyServices, getPayoutBalance, getMyKyc, markLinkShared, getHostNudges, dismissHostNudge, verifyLinkedin } from '../services/api';
import { getSupabase } from '../services/supabaseClient';
import { analytics, EVENTS } from '../services/analytics';
import { isFreePlan } from '../utils/themeUtils';
import { buildNudges, pickNextStep } from '../lib/hostNudges';
import NextStepCard from '../components/dashboard/NextStepCard';
import toast from 'react-hot-toast';
import Modal from '../components/booking/Modal';
import WhatsAppVerify from '../components/whatsapp/WhatsAppVerify';
import StatusChip from '../components/common/StatusChip';
import { PageHeader, Card, buttonClasses, fmtMoney, cn } from '../components/dashboard/ui';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Human "in 3 days" / "in 5 hr" / "in 20 min" countdown for the next-session strip.
const relWhen = (iso) => {
  const min = Math.round((new Date(iso) - new Date()) / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `in ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr} hr`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'tomorrow' : `in ${d} days`;
};

// ── Stat tile (flat — lives inside a Card panel). Clickable when `to` is set:
// a count should lead somewhere, not just sit there. ─────────────────────────
const Stat = ({ Icon, label, value, tint, to, title }) => {
  const inner = (
    <>
      {/* Compact: icon + number share a row, title sits under — shorter card. */}
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md', tint)}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="text-lg font-bold leading-none text-gray-900 sm:text-xl">{value}</span>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{label}</p>
    </>
  );
  const base = 'block rounded-md border border-gray-100 bg-gray-50/60 p-3 min-h-[4.5rem]';
  if (!to) return <div className={base} title={title}>{inner}</div>;
  return (
    <Link to={to} title={title} className={cn(base, 'block transition hover:border-primary/30 hover:bg-primary-light/40 hover:no-underline')}>
      {inner}
    </Link>
  );
};

// ── Money bit (one figure in the money-clarity strip) ────────────────────
const MoneyBit = ({ label, value, tone }) => (
  <span className="inline-flex flex-col">
    <span className={cn('text-sm font-bold leading-none', tone)}>{value}</span>
    <span className="mt-0.5 text-[11px] text-gray-400">{label}</span>
  </span>
);

// ── Booking row (compact) ───────────────────────────────────────────────
const BookingRow = ({ b }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-gray-900">{b.guest_name || 'Guest'}</p>
      <p className="truncate text-xs text-gray-400">{b.services?.title} · {fmtDate(b.scheduled_at)}</p>
    </div>
    <StatusChip status={b.status} className="shrink-0" />
  </div>
);

// ── Loading skeleton — shown while bookings/services load, so a mid-fetch
// dashboard never looks like an empty (zeros) new account. ────────────────
const Bar = ({ className }) => <div className={cn('animate-pulse rounded bg-gray-100', className)} />;
const DashboardSkeleton = () => (
  <>
    <Bar className="mb-5 h-16 w-full" />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} as="section">
          <Bar className="mb-3 h-4 w-32" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((j) => <Bar key={j} className="h-20 w-full" />)}
          </div>
        </Card>
      ))}
    </div>
  </>
);

// LinkedIn "in" glyph — inline SVG (lucide-react's brand-icon exports aren't
// guaranteed; a missing named import would crash the whole dashboard). Accepts
// className so it drops into the checklist exactly like a lucide icon.
const LinkedInGlyph = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);

const Dashboard = () => {
  const { user, connectGoogleCalendar, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isHost = user?.is_host === true || user?.role === 'host';

  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [balance, setBalance] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappEntry, setWhatsappEntry] = useState(undefined); // { country, number } preserved across close
  const [linkedinBusy, setLinkedinBusy] = useState(false);
  const linkedinRan = useRef(false); // StrictMode double-invoke guard for the return handler

  // Start LinkedIn verification: link the LinkedIn identity to the CURRENT host's
  // Supabase auth user (linkIdentity — never signInWithOAuth, which would mint a
  // separate user and hijack the session). Requires "Manual linking" enabled on
  // the Supabase project. Redirects out; the ?linkedin=done effect below finishes.
  const startLinkedinVerify = useCallback(async () => {
    setLinkedinBusy(true);
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.auth.linkIdentity({
        provider: 'linkedin_oidc',
        options: { redirectTo: `${window.location.origin}/dashboard?linkedin=done` },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url; // fallback for SDK builds that don't auto-redirect
    } catch (e) {
      setLinkedinBusy(false);
      toast.error(e?.message || 'Could not start LinkedIn verification.');
    }
  }, []);

  // ── Dashboard "Next step" — ONE ranked, server-dismissed nudge that replaces the
  // old scattered localStorage banners (set up payouts / upgrade / legacy auto-renew
  // / share). Ranking is a pure function over signals already loaded below; `snoozed`
  // (server-tracked) makes a dismiss stick across devices instead of re-nagging. ───
  const [snoozed, setSnoozed] = useState({});
  const onFreePlan = isHost && isFreePlan(user?.plan);
  const pendingEarnings = Number(kyc?.pending_earnings) || 0;
  const commissionPaid = useMemo(
    () => bookings.reduce(
      (sum, b) => sum + (b.payment_status === 'paid' ? Number(b.commission_applied) || 0 : 0), 0),
    [bookings]
  );
  const hasRealEarning = useMemo(
    () => bookings.some((b) => b.payment_status === 'paid' && Number(b.vendor_amount ?? b.amount ?? 0) > 0),
    [bookings]
  );
  const nextStep = useMemo(() => pickNextStep(buildNudges({
    isFreePlan: onFreePlan,
    plan: user?.plan,
    subscriptionStatus: user?.subscription_status,
    hasPaymentMandate: user?.has_payment_mandate,
    pendingEarnings, payoutsReady: !!kyc?.payouts_ready,
    commissionPaid, hasRealEarning,
    hasUsername: !!user?.username, servicesCount: services.length, bookingsCount: bookings.length,
  }), snoozed), [onFreePlan, user, kyc, pendingEarnings, commissionPaid, hasRealEarning, services.length, bookings.length, snoozed]);

  const dismissNudge = (key) => {
    setSnoozed((s) => ({ ...s, [key]: new Date(Date.now() + 3650 * 86400000).toISOString() })); // optimistic hide
    dismissHostNudge(key);
  };

  // Share helpers — used by the share-hero variant of the Next-step card.
  const profileUrl = user?.username ? `${window.location.origin}/${user.username}` : '';
  const shareText = `Book a session with me on Meeticulous: ${profileUrl}`;
  const trackShare = (method) => {
    analytics.track(EVENTS.PROFILE_LINK_SHARED, { method, source: 'share_moment' });
    markLinkShared(); // stamp the activation-funnel "shared" signal in the DB (idempotent)
  };
  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Meeticulous', text: 'Book a session with me:', url: profileUrl }); trackShare('native'); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(profileUrl); toast.success('Link copied!'); trackShare('copy'); }
    catch { toast.error('Could not share link'); }
  };

  // Google-calendar return toast
  useEffect(() => {
    const g = searchParams.get('google');
    if (g === 'connected') {
      toast.success('Google Calendar connected!');
      updateUser({ google_calendar_connected: true });
      window.history.replaceState({}, '', '/dashboard');
    } else if (g === 'error') {
      toast.error('Failed to connect Google Calendar.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  // LinkedIn verify return — the host came back from linkIdentity(). Finalize the
  // PKCE code ourselves (client has detectSessionInUrl:false), which completes the
  // link on the current user, then have the server confirm the identity + award
  // the badge. Idempotent server-side; the ref guards StrictMode's double mount.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Supabase returns errors in the query (PKCE) or the hash (implicit); read both.
    const errCode = qs.get('error_code') || hash.get('error_code');
    const isReturn = qs.get('linkedin') === 'done' || !!errCode;
    if (!isReturn || linkedinRan.current) return;
    linkedinRan.current = true;
    (async () => {
      try {
        const sb = await getSupabase();
        // identity_already_exists = this LinkedIn identity is already linked to the
        // account from an earlier attempt (the link succeeded; only the finalize
        // didn't run — e.g. an interrupted redirect). Don't surface it as a failure:
        // the identity IS present, so skip the code exchange and just confirm +
        // award the badge server-side (idempotent). Any OTHER error is real.
        if (errCode && errCode !== 'identity_already_exists') {
          const desc = hash.get('error_description') || qs.get('error_description');
          throw new Error(desc || 'LinkedIn verification could not be completed.');
        }
        if (errCode !== 'identity_already_exists') {
          const code = qs.get('code');
          if (code) {
            const { error } = await sb.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
        }
        const { data } = await verifyLinkedin(); // server checks identity + awards badge
        updateUser({ linkedin_verified: true });
        toast.success(
          data?.badgeAwarded
            ? 'LinkedIn verified — “LinkedIn Verified” badge unlocked! 🎉'
            : 'LinkedIn verified!',
        );
      } catch (e) {
        toast.error(e?.response?.data?.message || e?.message || 'LinkedIn verification failed.');
      } finally {
        setLinkedinBusy(false);
        window.history.replaceState({}, '', '/dashboard');
      }
    })();
  }, [searchParams, updateUser]);

  const [loadErr, setLoadErr] = useState(false);
  const loadData = () => {
    if (!isHost) return;
    setLoadErr(false);
    setLoading(true);
    Promise.all([getHostBookings(), getMyServices()])
      .then(([b, s]) => { setBookings(b.data || []); setServices(s.data || []); })
      .catch(() => setLoadErr(true)) // P2-9: surface failure, don't render empty-as-error
      .finally(() => setLoading(false));
    // Settlement balance — fetched independently so a payout-balance hiccup
    // never blanks the whole dashboard.
    getPayoutBalance().then(({ data }) => setBalance(data)).catch(() => {});
    // Deferred-KYC nudge signal: pending_earnings + payouts_ready. Best-effort.
    getMyKyc().then(({ data }) => setKyc(data)).catch(() => {});
    // Server-tracked nudge snoozes (so a dismiss sticks across devices). Best-effort.
    getHostNudges().then(({ data }) => setSnoozed(data?.snoozed || {})).catch(() => {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [isHost]);

  // Derived stats — all from real data, nothing hardcoded.
  const m = useMemo(() => {
    const now = new Date();
    const future = (b) => new Date(b.scheduled_at) > now;
    const upcomingList = bookings
      .filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && future(b))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const recentList = [...bookings]
      .filter((b) => b.status === 'completed' || !future(b))
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
    // Confirmed sessions that have passed but aren't wrapped up — the host's
    // to-do. Excludes never-confirmed (pending) past slots: those are no-shows /
    // abandoned holds, not work the host owes a completion on.
    const needsActionList = bookings
      .filter((b) => b.status === 'confirmed' && !future(b));
    return {
      nextUp: upcomingList[0] || null,
      needsAction: needsActionList.length,
      upcoming: upcomingList.length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      total: bookings.length,
      services: services.length,
      // Lifetime gross host earnings from paid bookings. Excludes cancelled
      // (a cancelled-but-paid booking is pending refund, not earned).
      earnings: bookings
        .filter((b) => b.payment_status === 'paid' && b.status !== 'cancelled')
        .reduce((s, b) => s + (b.vendor_amount != null ? b.vendor_amount : (b.services?.price || 0)), 0),
      // Pending requests awaiting the host's confirmation — distinct from
      // "Upcoming" (which already counts confirmed + pending future slots).
      pending: bookings.filter((b) => b.status === 'pending' && future(b)).length,
      upcomingList: upcomingList.slice(0, 2),
      recentList: recentList.slice(0, 2),
    };
  }, [bookings, services]);

  // Profile-completion checklist — derived from real profile + data.
  const checklist = useMemo(() => [
    { key: 'photo',   label: 'Upload profile photo',     done: !!user?.profile_image,                 Icon: Camera,       to: '/dashboard/profile' },
    { key: 'profile', label: 'Complete your profile',    done: !!(user?.bio && user?.username),        Icon: UserCog,      to: '/dashboard/profile' },
    { key: 'city',    label: 'Add your city',            done: !!user?.location,                       Icon: MapPin,       to: '/dashboard/profile' },
    { key: 'service', label: 'Add a service',            done: services.length > 0,                    Icon: LayoutGrid,   to: '/dashboard/services' },
    { key: 'pricing', label: 'Set service pricing',      done: services.some((s) => Number(s.price) > 0), Icon: Tag,        to: '/dashboard/services' },
    { key: 'gcal',    label: 'Connect Google Calendar',  done: !!user?.google_calendar_connected,      Icon: CalendarCheck, onClick: connectGoogleCalendar },
    // 'Choose a plan' removed — every host defaults to the free `starter` tier,
    // so it was always "done" and only padded the completion %.
    { key: 'verify',  label: 'Verify contact details',   done: !!user?.is_verified,                    Icon: ShieldCheck,  to: '/dashboard/profile' },
    // When already verified, no onClick — item renders as a static "done" badge
    { key: 'whatsapp', label: 'Add WhatsApp for Booking Updates', done: !!user?.whatsapp_verified, Icon: MessageCircle, ...(user?.whatsapp_verified ? {} : { onClick: () => setWhatsappModalOpen(true) }) },
    // Verify LinkedIn → earns the "LinkedIn Verified" badge. When already verified,
    // no onClick — renders as a static "done" item (same pattern as WhatsApp above).
    { key: 'linkedin', label: linkedinBusy ? 'Opening LinkedIn…' : 'Verify your LinkedIn', done: !!user?.linkedin_verified, Icon: LinkedInGlyph, ...(user?.linkedin_verified || linkedinBusy ? {} : { onClick: startLinkedinVerify }) },
  ], [user, services, connectGoogleCalendar, linkedinBusy, startLinkedinVerify]);

  const completion = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
  const allDone = completion === 100;

  if (!isHost) return <Navigate to="/user" replace />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Welcome back, ${user?.name?.split(' ')[0]}`} subtitle="Here's what's happening — we're handling the rest." />

      {/* P2-9: data load failed — distinct from an empty (new) account */}
      {loadErr && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Couldn't load your dashboard. Check your connection and retry.</p>
          <button onClick={loadData} className="shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Retry</button>
        </div>
      )}

      {/* Next step — ONE ranked, server-dismissed nudge. Sharing is the top activation
          priority and keeps its rich hero; KYC / upgrade / legacy render via NextStepCard. */}
      {nextStep?.key === 'share' ? (
        <div className="mb-5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900">You're live! 🎉 Now share your link to get your first booking</p>
              <p className="mt-1 text-sm text-gray-600">
                Bookings come from people who see your link. Send it to your followers, groups and DMs — this is the one thing that gets you booked.
              </p>
            </div>
            <button onClick={() => dismissNudge('share')} aria-label="Dismiss" className="p-1 text-primary/50 hover:text-primary">
              <XCircle className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
            <span className="truncate text-sm font-semibold text-gray-800">{profileUrl.replace(/^https?:\/\//, '')}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank" rel="noreferrer"
              onClick={() => trackShare('whatsapp')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 hover:no-underline"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2.25} /> Share on WhatsApp
            </a>
            <button
              onClick={shareNative}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.25} /> Share
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(profileUrl); toast.success('Link copied!'); trackShare('copy'); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Copy className="h-4 w-4" strokeWidth={2.25} /> Copy link
            </button>
          </div>
        </div>
      ) : nextStep ? (
        <NextStepCard nudge={nextStep} onDismiss={() => dismissNudge(nextStep.key)} />
      ) : null}

      {/* Profile URL + Money — side by side on desktop, stacked on mobile */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
      {user?.username ? (
        <div className="flex flex-1 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2.25} />
          <span className="shrink-0 text-xs text-gray-400">Your profile:</span>
          <a href={`/${user.username}`} target="_blank" rel="noreferrer" className="truncate text-xs font-semibold text-primary hover:underline">
            meeticulous.com/{user.username}
          </a>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {/* Native share sheet on mobile; falls back to copy where unsupported. */}
            <button
              onClick={async () => {
                const url = `${window.location.origin}/${user.username}`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: 'Meeticulous', text: 'Book a session with me:', url });
                    analytics.track(EVENTS.PROFILE_LINK_SHARED, { method: 'native', source: 'dashboard' });
                    return;
                  } catch (e) { if (e?.name === 'AbortError') return; /* user dismissed */ }
                }
                try {
                  await navigator.clipboard.writeText(url); toast.success('Link copied!');
                  analytics.track(EVENTS.PROFILE_LINK_SHARED, { method: 'copy', source: 'dashboard' });
                } catch { toast.error('Could not share link'); }
              }}
              className="shrink-0 p-1 text-gray-400 transition-colors hover:text-primary" title="Share"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${user.username}`);
                toast.success('Link copied!');
                analytics.track(EVENTS.PROFILE_LINK_SHARED, { method: 'copy', source: 'dashboard' });
              }}
              className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-700" title="Copy link"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-start gap-3 rounded-md border border-primary/30 bg-primary-light p-4">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Set up your public profile</p>
            <p className="mt-0.5 text-xs text-gray-500">Add a username so clients can find and book you.</p>
          </div>
          <Link to="/dashboard/profile" className={cn(buttonClasses({ variant: 'primary', size: 'sm' }), 'shrink-0 whitespace-nowrap')}>
            Set username
          </Link>
        </div>
      )}
      {balance && (balance.available != null || balance.clearing != null || balance.pendingCompletion != null) && (
        <Link to="/dashboard/payments/payouts"
          className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-primary/30 hover:no-underline">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Wallet className="h-4 w-4 text-primary" strokeWidth={2.25} /> Money
          </span>
          <MoneyBit label="Available" value={fmtMoney(balance.available, { decimals: true })} tone="text-primary" />
          <MoneyBit label="Clearing" value={fmtMoney(balance.clearing, { decimals: true })} tone="text-amber-600" />
          <MoneyBit label="Pending" value={fmtMoney(balance.pendingCompletion, { decimals: true })} tone="text-gray-700" />
          <ArrowRight className="ml-auto h-4 w-4 text-gray-300" strokeWidth={2.25} />
        </Link>
      )}
      </div>

      {loading ? <DashboardSkeleton /> : (
      <>
      {/* Next session — the host's "what now" at a glance */}
      {m.nextUp && (
        <div className="mb-5 flex flex-col gap-3 rounded-md border border-primary/20 bg-primary-light/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.5} /> Next session · {relWhen(m.nextUp.scheduled_at)}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-900">
              {m.nextUp.guest_name || 'Guest'} · {m.nextUp.services?.title || 'Session'}
            </p>
            <p className="text-xs text-gray-500">{fmtDate(m.nextUp.scheduled_at)}</p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            {m.nextUp.meeting_link && (
              <a href={m.nextUp.meeting_link} target="_blank" rel="noreferrer"
                className={cn(buttonClasses({ variant: 'primary', size: 'sm' }), 'min-h-11 flex-1 whitespace-nowrap sm:min-h-0 sm:flex-none')}>
                Join
              </a>
            )}
            <Link to="/dashboard/bookings"
              className="inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:no-underline sm:min-h-0 sm:flex-none sm:py-1.5">
              View
            </Link>
          </div>
        </div>
      )}

      {/* Past sessions still open — needs-action nudge */}
      {m.needsAction > 0 && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            {m.needsAction} {m.needsAction === 1 ? 'session has' : 'sessions have'} passed and need wrapping up.
          </p>
          <Link to="/dashboard/bookings"
            className="shrink-0 whitespace-nowrap rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 hover:no-underline">
            Review
          </Link>
        </div>
      )}

      {/* 2 rows × 2 columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {/* Top-Left: bookings stats (2×2) */}
        <Card as="section">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Bookings overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat Icon={CalendarClock} label="Upcoming"       value={m.upcoming}  tint="bg-blue-50 text-blue-600"   to="/dashboard/bookings" />
            <Stat Icon={CheckCircle2}  label="Completed"      value={m.completed} tint="bg-green-50 text-green-600" to="/dashboard/bookings" />
            <Stat Icon={XCircle}       label="Cancelled"      value={m.cancelled} tint="bg-red-50 text-red-600"     to="/dashboard/bookings" />
            <Stat Icon={CalendarDays}  label="Total Bookings" value={m.total}     tint="bg-gray-100 text-gray-600"  to="/dashboard/bookings" />
          </div>
        </Card>

        {/* Top-Right: business stats (2×2) */}
        <Card as="section">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Your business</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat Icon={LayoutGrid}  label="Total Services"      value={m.services}            tint="bg-purple-50 text-purple-600" to="/dashboard/services" />
            <Stat Icon={IndianRupee} label="Total Earnings"      value={fmtMoney(m.earnings)}  tint="bg-primary-light text-primary" to="/dashboard/earnings"
              title="Lifetime gross from paid bookings. See Money for your settlement balance (available / clearing / pending)." />
            <Stat Icon={UserCheck}   label="Profile Completion"  value={`${completion}%`}      tint="bg-amber-50 text-amber-600"   to="/dashboard/profile" />
            <Stat Icon={Hourglass}   label="Pending Requests"    value={m.pending}             tint="bg-teal-50 text-teal-600"     to="/dashboard/bookings"
              title="Bookings awaiting your confirmation." />
          </div>
        </Card>

        {/* Bottom-Left: upcoming + recent (1 col, 2 rows) */}
        <Card as="section" className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Upcoming Bookings</h2>
              <Link to="/dashboard/bookings" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {m.upcomingList.length === 0 ? (
              <p className="py-3 text-xs text-gray-400">No upcoming bookings. Share your profile to get booked.</p>
            ) : (
              <div className="divide-y divide-gray-100">{m.upcomingList.map((b) => <BookingRow key={b.id} b={b} />)}</div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-3">
            <h2 className="mb-1 text-sm font-semibold text-gray-700">Recent Bookings</h2>
            {m.recentList.length === 0 ? (
              <p className="py-3 text-xs text-gray-400">No past bookings yet — they&rsquo;ll gather here as you go.</p>
            ) : (
              <div className="divide-y divide-gray-100">{m.recentList.map((b) => <BookingRow key={b.id} b={b} />)}</div>
            )}
          </div>
        </Card>

        {/* Bottom-Right: checklist or success */}
        <Card as="section">
          {allDone ? (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-7 w-7 text-green-600" strokeWidth={2} />
              </div>
              <p className="font-semibold text-gray-900">Everything is set.</p>
              <p className="mt-1 text-xs text-gray-500">Your account is fully configured. You're ready to grow.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Finish setup</h2>
                <span className="text-xs font-medium text-gray-500">{completion}%</span>
              </div>
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
              </div>
              <ul className="space-y-1.5">
                {checklist.map((c) => {
                  const inner = (
                    <>
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', c.done ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500')}>
                        {c.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <c.Icon className="h-4 w-4" strokeWidth={2.25} />}
                      </span>
                      <span className={cn('flex-1 text-sm', c.done ? 'text-gray-400 line-through' : 'text-gray-700')}>{c.label}</span>
                      {!c.done && <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" strokeWidth={2.25} />}
                    </>
                  );
                  const cls = 'flex w-full items-center gap-3 rounded p-1.5 text-left transition hover:bg-gray-50 disabled:hover:bg-transparent';
                  if (c.done) return <li key={c.key}><div className="flex items-center gap-3 p-1.5">{inner}</div></li>;
                  return (
                    <li key={c.key}>
                      {c.onClick
                        ? <button onClick={c.onClick} className={cls}>{inner}</button>
                        : <button onClick={() => navigate(c.to)} className={cls}>{inner}</button>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
      </>
      )}

      {/* Only render the modal when the host is not yet verified — belt-and-suspenders guard */}
      <Modal open={whatsappModalOpen && !user?.whatsapp_verified} title="Verify WhatsApp" onClose={() => setWhatsappModalOpen(false)}>
        <p className="mb-4 text-sm text-gray-500">
          Receive booking confirmations and important updates directly on WhatsApp.
        </p>
        <WhatsAppVerify
          initialCountry={whatsappEntry?.country}
          initialPhone={whatsappEntry?.number}
          onPhoneChange={setWhatsappEntry}
          onVerified={(phone) => {
            updateUser({ whatsapp_verified: true, whatsapp_number: phone });
            setWhatsappModalOpen(false);
            toast.success("WhatsApp successfully verified.\nYou'll now receive booking updates.");
          }}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;
