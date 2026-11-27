// Guest console Kept pieces shared by Home, Bookings, booking detail, Library,
// Invoices, Reviews and Rewards. Visual language = the host Kept kit (v2.jsx,
// catalog/KeptKit.jsx); only guest-specific bits live here.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { cancelBooking, getGuestBookings, guestCompleteBooking, guestReportProblem } from '../../services/api';
import { useRegisterRefresh } from '../../components/dashboard/ui/refreshContext';
import { downloadReceipt } from '../../utils/receipt';
import { PageHeading, SubNav, cn } from '../../components/dashboard/ui/v2';
import { fmtWhen, hostOf, shortId, svcOf } from './guestModel';

/* Library = one rail row; its two real routes are tabs here. */
export const LibraryHead = () => (
  <div className="flex flex-col gap-4">
    <PageHeading title="Library" sub="Courses and memberships you've bought." />
    <SubNav items={[{ to: '/user/courses', label: 'Courses' }, { to: '/user/memberships', label: 'Memberships' }]} />
  </div>
);

export const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
export const serif = 'font-serif font-normal italic text-pink';

/* Buttons — 12px radius (Kept), hover tints only. */
const btn = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition disabled:opacity-60';
export const btnPrimary = cn(btn, 'bg-maroon text-white hover:bg-maroon-dark hover:no-underline', ring);
export const btnSoft = cn(btn, 'bg-pink-50 text-maroon hover:bg-pink-100 hover:no-underline', ring);
export const btnQuiet = cn(btn, 'text-muted hover:bg-pink-50 hover:text-maroon hover:no-underline', ring);
export const btnDanger = cn(btn, 'text-error-fg hover:bg-error-bg', ring);

/* Band buttons — same as the host band (BookingsV2). */
const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-4 sm:px-5 text-[14px] font-semibold transition hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
const bandSolid = cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100');
const bandGhost = cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60');
const BandBtn = ({ cls, href, external, children, ...p }) => {
  if (href && external) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button type="button" className={cls} {...p}>{children}</button>;
};
export const BandPrimary = (p) => <BandBtn cls={bandSolid} {...p} />;
export const BandGhost = (p) => <BandBtn cls={bandGhost} {...p} />;

/* Empty state with the page's one mascot. */
const MASCOT = { blue: '/about/mascot-blue.png', green: '/about/mascot-green.png', orange: '/about/mascot-orange.png', purple: '/about/mascot-purple.png' };
export const GuestEmpty = ({ mascot, title, sub, action }) => (
  <div className="flex flex-col items-center gap-3 rounded-[24px] bg-white px-6 py-10 text-center">
    {mascot && <img src={MASCOT[mascot]} alt="" aria-hidden="true" className="h-24 w-24 object-contain" />}
    <p className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</p>
    {sub && <p className="mb-0 max-w-sm text-[14px] text-muted">{sub}</p>}
    {action}
  </div>
);

/* The guest's bookings, with pull-to-refresh. null = still loading. */
export const useGuestBookings = () => {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => getGuestBookings()
    .then(({ data }) => { setBookings(Array.isArray(data) ? data : []); setError(false); })
    .catch(() => setError(true)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);
  return { bookings, setBookings, error, load };
};

/* Confirm / report / cancel — one place, so the list and the detail page behave
 * the same. Prompts and toasts are the ones the old bookings page used. */
export const useBookingActions = (setBookings) => {
  const [busyId, setBusyId] = useState(null);
  const patch = (id, fields) => setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  const run = async (id, fn) => { setBusyId(id); try { await fn(); } finally { setBusyId(null); } };

  const confirm = (b) => run(b.id, async () => {
    try {
      await guestCompleteBooking(b.id);
      toast.success('Thanks for confirming — your host has been paid.');
      patch(b.id, { status: 'completed' });
    } catch (err) { toast.error(err.response?.data?.message || 'Could not confirm'); }
  });

  const report = (b) => {
    const reason = window.prompt("What went wrong? (e.g. host didn't show up)");
    if (reason == null) return undefined;
    return run(b.id, async () => {
      try {
        await guestReportProblem(b.id, reason);
        toast.success("Reported — we've put the payout on hold and our team will look into it.");
      } catch (err) { toast.error(err.response?.data?.message || 'Could not report'); }
    });
  };

  const cancel = (b) => {
    const msg = b?.payment_status === 'paid'
      ? 'Cancel this paid booking? Cancellations are generally non-refundable — refunds apply only in limited cases (see our Refund Policy at /refund). This cannot be undone.'
      : 'Cancel this booking? This cannot be undone.';
    if (!window.confirm(msg)) return undefined;
    return run(b.id, async () => {
      try {
        await cancelBooking(b.id);
        toast.success('Booking cancelled');
        patch(b.id, { status: 'cancelled' });
      } catch (err) { toast.error(err.response?.data?.message || 'Could not cancel'); }
    });
  };

  return { busyId, confirm, report, cancel, patch };
};

/* "Did your session happen?" — the ended-session prompt (founder, 2026-11-27).
 * Yes releases the host's held payout now; Report reverses it and opens a dispute. */
export const SessionPrompt = ({ b, actions, className = '' }) => {
  const busy = actions.busyId === b.id;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <p className="mb-0 mr-auto text-[14px] font-medium text-ink">Did your session with {hostOf(b).name || 'your host'} happen?</p>
      <button type="button" disabled={busy} onClick={() => actions.report(b)} className={btnQuiet}>Report a problem</button>
      <button type="button" disabled={busy} onClick={() => actions.confirm(b)} className={btnPrimary}>{busy ? 'Saving…' : 'Yes, it did'}</button>
    </div>
  );
};

/* Invoice download. Prefers the real GST tax invoice via the OWNER-GATED endpoint
 * (Bearer-authed → fetched as a local blob so the URL isn't shareable; only the
 * logged-in buyer can open it). Falls back to the client-side receipt for bookings
 * without a GST invoice (e.g. free bookings, or before the invoice is minted). */
export const downloadInvoice = async (b) => {
  const host = hostOf(b); const svc = svcOf(b);
  try {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const session = JSON.parse(localStorage.getItem('user') || 'null');
    const res = await fetch(`${base}/invoices/booking/${b.id}/view`, {
      headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    });
    if (res.ok) {
      const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
    // 404 (no GST invoice for this booking) → fall through to the client receipt.
  } catch { /* network issue → fall through to the client receipt */ }
  downloadReceipt({
    receiptId: shortId(b.id),
    bookingId: b.id,
    whenText: fmtWhen(b.scheduled_at),
    serviceTitle: svc.title || 'Service',
    category: svc.category,
    duration: svc.duration,
    timezone: b.timezone,
    venue: b.meeting_link,
    hostName: host.name || 'Host',
    guestName: b.guest_name || '',
    guestEmail: b.guest_email || '',
    customerPhone: b.guest_phone,
    status: b.status,
    paymentStatus: b.payment_status,
    paymentId: b.payment_id,
    gateway: b.payment_id ? 'Razorpay' : '',
    price: Number(svc.price || 0),
    platformFee: Number(b.platform_fee_amount || 0),
    platformFeeGst: Number(b.platform_fee_gst || 0),
    total: Number(b.customer_total || 0),
  });
};

/* Date block for list rows: "27 / Nov". */
export const DateBlock = ({ iso, muted = false }) => {
  const d = new Date(iso);
  return (
    <span className={cn('grid h-12 w-12 shrink-0 place-content-center rounded-[14px] text-center leading-none', muted ? 'bg-neutral-100 text-muted' : 'bg-pink-50 text-maroon')}>
      <span className="font-display text-[18px] font-extrabold tabular-nums">{Number.isNaN(+d) ? '–' : d.getDate()}</span>
      <span className="mt-0.5 text-[12px] font-semibold">{Number.isNaN(+d) ? '' : d.toLocaleString('en-IN', { month: 'short' })}</span>
    </span>
  );
};
