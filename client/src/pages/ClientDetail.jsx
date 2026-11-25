// Client profile — one person, in the Kept direction (founder-approved 2026-11-25).
// Borrowed from phone Contacts / Shopify Customers: a contact card on top (the
// page's one maroon band), the figures that matter (lifetime spend, bookings,
// average, last visit), a timeline of every booking, and private notes.
//
// Same data and handlers as before: crmGetCustomer (customer + history + reviews),
// svcGetAll for service titles, and the notes endpoints. "Send booking link" is a
// plain WhatsApp / email link with the host's public booking URL — the host can't
// book on a guest's behalf, so the button says what it does.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Copy, Mail, Phone, Star, Trash2, UserX } from 'lucide-react';
import { useRegisterRefresh } from '../components/dashboard/ui/refreshContext';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { crmGetCustomer, crmGetNotes, crmAddNote, crmDeleteNote, svcGetAll } from '../services/api';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, InsightBand, Panel, StatusPill, Tile, WhatsAppIcon, cn, fmtDayFull, inr,
} from '../components/dashboard/ui/v2';
import {
  BandPrimary, ClientsProPreview, isLapsing, lastSeen, noShowWord, press, waLink,
} from './ClientsV2';

const lower = (s) => String(s || '').toLowerCase();
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const monthYear = (iso) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const serif = 'font-serif font-normal italic text-pink';
const control = `rounded-[12px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose ${press}`;

// The newest booking that has already happened (not cancelled). last_booking_at
// can be a prepaid future booking, so the profile reads it off the history. Pure, tested.
export const lastVisit = (history, now = Date.now()) => history
  .filter((b) => lower(b.status) !== 'cancelled' && new Date(b.scheduled_at || b.created_at).getTime() <= now)
  .map((b) => b.scheduled_at || b.created_at)
  .sort()
  .at(-1) || null;

// The prefilled "come back" message. Pure, tested.
export const bookAgainText = (name, url, lapsing) => {
  const first = (name || '').trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first}` : 'Hi';
  return lapsing
    ? `${hi}, it's been a while! Here's my booking link if you'd like to come back: ${url}`
    : `${hi}! Here's my booking link for your next visit: ${url}`;
};

/* Timeline — every booking, newest first, upcoming marked with the pink "booked" dot. */
const Timeline = ({ history, serviceMap }) => {
  const now = Date.now();
  if (!history.length) {
    return <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">No bookings yet. They show up here as they happen.</p>;
  }
  return (
    <ol className="relative flex flex-col">
      {history.map((b, i) => {
        const when = b.scheduled_at || b.created_at;
        const upcoming = new Date(when).getTime() > now && lower(b.status) !== 'cancelled';
        const amount = Number(b.customer_total) || 0;
        return (
          <li key={b.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < history.length - 1 && <span aria-hidden="true" className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-0.5 bg-neutral-200" />}
            <span aria-hidden="true" className={cn('relative mt-1 h-4 w-4 shrink-0 rounded-full', upcoming ? 'bg-maroon ring-4 ring-pink-100' : 'bg-neutral-200')}>
              {upcoming && <span className="absolute inset-[4px] rounded-full bg-pink" />}
            </span>
            {/* Same two-line shape at every width: what + how much, then when + status. */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="mb-0 min-w-0 truncate text-[14.5px] font-semibold text-ink">{serviceMap[b.service_id] || 'Booking'}</p>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{amount ? inr(amount) : 'Free'}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] text-faint">{upcoming ? `Coming up · ${fmtDayFull(when)}` : fmtDate(when)}</span>
                <StatusPill status={lower(b.status)} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const ContactRow = ({ icon: Icon, href, children }) => (
  <a href={href} className={cn(control, '-mx-2 flex items-center gap-3 px-2 py-1.5 hover:bg-cream active:bg-cream')}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-pink-100 text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{children}</span>
  </a>
);

// Private notes — list + add + delete. Isolated so its own loading state doesn't
// block the rest of the profile.
const NotesPanel = ({ customerId }) => {
  const [notes, setNotes] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setState('loading');
    crmGetNotes(customerId)
      .then(({ data }) => { setNotes(data.notes || []); setState('ready'); })
      .catch(() => setState('error'));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await crmAddNote(customerId, trimmed);
      setBody('');
      load();
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await crmDeleteNote(customerId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      toast.error('Failed to delete note');
    }
  };

  return (
    <Panel title="Private notes" subtitle="Only you see these.">
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <label htmlFor="client-note" className="sr-only">New note</label>
        <textarea id="client-note" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
          placeholder="Goals, preferences, what to pick up next time."
          className="w-full resize-y rounded-[16px] border-0 bg-cream p-3.5 text-[16px] text-ink sm:text-[14px] placeholder:text-faint focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose" />
        <button type="submit" disabled={saving || !body.trim()}
          className={cn(control, 'inline-flex h-10 items-center justify-center self-end bg-maroon px-4 text-[14px] font-semibold text-white hover:bg-maroon-dark disabled:cursor-default disabled:bg-neutral-200 disabled:text-neutral-400')}>
          {saving ? 'Saving…' : 'Add note'}
        </button>
      </form>
      <div className="mt-4">
        {state === 'loading' ? (
          <div className="flex flex-col gap-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : state === 'error' ? (
          <p className="mb-0 text-[14px] text-muted">Your notes didn&apos;t load. <button type="button" onClick={load} className="font-semibold text-maroon underline underline-offset-2">Try again</button></p>
        ) : notes.length === 0 ? (
          <p className="mb-0 text-[14px] text-muted">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 rounded-[16px] bg-cream p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="mb-0 whitespace-pre-wrap text-[14px] text-ink">{n.body}</p>
                  <p className="mb-0 mt-1 text-[12.5px] text-faint">{fmtDate(n.created_at)}</p>
                </div>
                <button type="button" onClick={() => handleDelete(n.id)} aria-label="Delete note"
                  className={cn(control, 'grid h-9 w-9 shrink-0 place-items-center text-faint hover:bg-pink-100 hover:text-maroon')}>
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
};

/* Back bar — sticks under the top bar like an app's navigation bar. Once the
 * contact card scrolls away the client's name slides in beside the back button
 * (the iOS large-title pattern), so you always know whose page this is. */
const BackBar = ({ name, collapsed = false }) => (
  <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mx-4 -my-2 flex h-12 items-center gap-2 bg-cream/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
    <Link to="/dashboard/clients" className={cn(control, '-ml-2 inline-flex h-11 shrink-0 items-center gap-0.5 px-2 text-[15px] font-semibold text-maroon active:bg-pink-100 hover:bg-pink-100')}>
      <ChevronLeft className="h-5 w-5" strokeWidth={2.4} /> Clients
    </Link>
    {name && (
      <span aria-hidden={!collapsed}
        className={cn('flex min-w-0 items-center gap-2 transition-[opacity,transform] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
          collapsed ? 'translate-y-0 opacity-100 duration-200' : 'pointer-events-none translate-y-1 opacity-0 duration-150')}>
        <Avatar name={name} size="h-8 w-8 text-[12px]" />
        <span className="truncate text-[15px] font-semibold text-ink">{name}</span>
      </span>
    )}
  </div>
);

/* Quick actions — the row under a contact on a phone: message, call, email,
 * share your link. A missing channel stays in place, dimmed, with its reason. */
const QuickActions = ({ phone, email, bookingUrl }) => {
  const copy = async () => {
    try { await navigator.clipboard.writeText(bookingUrl); toast.success('Booking link copied'); }
    catch { toast.error('Could not copy your link.'); }
  };
  const items = [
    { key: 'wa', label: 'Message', off: 'No phone', icon: <WhatsAppIcon className="h-5 w-5" />, href: waLink(phone), external: true },
    { key: 'call', label: 'Call', off: 'No phone', icon: <Phone className="h-5 w-5" strokeWidth={2} />, href: phone ? `tel:${phone}` : null },
    { key: 'mail', label: 'Email', off: 'No email', icon: <Mail className="h-5 w-5" strokeWidth={2} />, href: email ? `mailto:${email}` : null },
    { key: 'link', label: 'Copy link', off: 'No link yet', icon: <Copy className="h-5 w-5" strokeWidth={2} />, onClick: bookingUrl ? copy : null },
  ];
  const tile = 'flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-[20px] bg-white text-[13px] font-semibold';
  return (
    <nav aria-label="Contact" className="grid grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((it) => {
        const body = (
          <>
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-pink-100 text-maroon">{it.icon}</span>
            <span>{it.href || it.onClick ? it.label : it.off}</span>
          </>
        );
        if (it.href) {
          return (
            <a key={it.key} href={it.href} {...(it.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className={cn(tile, press, 'text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose active:bg-pink-50 hover:bg-pink-50')}>{body}</a>
          );
        }
        if (it.onClick) {
          return (
            <button key={it.key} type="button" onClick={it.onClick}
              className={cn(tile, press, 'text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose active:bg-pink-50 hover:bg-pink-50')}>{body}</button>
          );
        }
        return <span key={it.key} aria-disabled="true" className={cn(tile, 'text-faint opacity-60')}>{body}</span>;
      })}
    </nav>
  );
};

const ClientDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [serviceMap, setServiceMap] = useState({});
  const [status, setStatus] = useState('loading'); // loading | ready | error | missing | gated
  const bandRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  // A refetch (pull-to-refresh) keeps the page on screen instead of flashing skeletons.
  const load = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    return Promise.all([
      crmGetCustomer(id),
      svcGetAll().catch(() => ({ data: [] })), // best-effort — enriches history with service titles
    ])
      .then(([detailRes, svcRes]) => {
        setCustomer(detailRes.data.customer);
        setHistory(detailRes.data.history || []);
        setReviews(detailRes.data.reviews || []);
        const map = {};
        (svcRes.data || []).forEach((s) => { map[s.id] = s.title; });
        setServiceMap(map);
        setStatus(detailRes.data.customer ? 'ready' : 'missing');
      })
      .catch((err) => {
        if (err.response?.status === 403 && err.response?.data?.upgrade_required) setStatus('gated');
        else setStatus(err.response?.status === 404 ? 'missing' : 'error');
      });
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load); // pull-to-refresh re-fetches this client, not the whole page

  // The name joins the back bar once the contact card has scrolled under it.
  useEffect(() => {
    const el = bandRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), { rootMargin: '-120px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [status]);

  if (status === 'gated') return <ClientsProPreview />;

  if (status === 'loading') {
    // Mirror the real layout (band → figures → timeline + side) so nothing reflows.
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <BackBar />
        <Skeleton className="h-[200px] !rounded-[28px] sm:h-[220px] sm:!rounded-[32px]" />
        <Skeleton className="h-[84px] !rounded-[20px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[108px] !rounded-[20px]" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-[360px] !rounded-[24px]" />
          <Skeleton className="h-[260px] !rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (status !== 'ready') {
    const missing = status === 'missing';
    return (
      <div className="flex flex-col gap-6">
        <BackBar />
        <div className="rounded-[24px] bg-white">
          <ErrorState icon={UserX}
            title={missing ? "We couldn't find this client." : "We couldn't load this client."}
            message={missing ? 'They may have been merged with another record. Find them in your client list.' : 'Their records are safe. This is a problem showing them. Try again.'}
            onRetry={missing ? undefined : load} />
        </div>
      </div>
    );
  }

  const c = customer;
  const lapsing = isLapsing(c);
  const last = lastVisit(history);
  const upcoming = c.next_upcoming_at && new Date(c.next_upcoming_at).getTime() > Date.now() ? c.next_upcoming_at : null;
  const avg = c.bookings_count ? Math.round(c.total_spent / c.bookings_count) : null;
  const bookingUrl = user?.username ? `${window.location.origin}/${user.username}` : null;
  const text = bookingUrl ? bookAgainText(c.name, bookingUrl, lapsing) : null;
  const sendLink = text && (waLink(c.phone, text)
    || (c.email ? `mailto:${c.email}?subject=${encodeURIComponent('Book your next visit')}&body=${encodeURIComponent(text)}` : null));

  const eyebrow = upcoming ? `Next visit · ${fmtDayFull(upcoming)}`
    : lapsing && last ? `Slipping away · last visit ${lastSeen(last)}`
      : c.first_booked_at ? `Client since ${monthYear(c.first_booked_at)}` : 'Client';

  return (
    <div className="flex flex-col gap-6">
      <BackBar name={c.name || 'Name not given'} collapsed={collapsed} />

      {/* Contact card: the page's one band. */}
      <div ref={bandRef}>
      <InsightBand mascot="blue" compact className="sm:py-7" eyebrow={eyebrow}
        title={(
          <>
            {c.name || 'Name not given'}
            {c.bookings_count > 1 && <> <em className={serif}>{lapsing ? 'misses you.' : 'keeps coming back.'}</em></>}
          </>
        )}
        sub={(c.tags?.length || c.no_show_count > 0) ? (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {(c.tags || []).map((t) => <span key={t} className="inline-flex items-center rounded-[8px] bg-white/[0.12] px-2.5 py-1 text-[13px] text-white">{t}</span>)}
            {c.no_show_count > 0 && <span className="inline-flex items-center rounded-[8px] bg-white/[0.12] px-2.5 py-1 text-[13px] text-white">{noShowWord(c.no_show_count)}</span>}
          </span>
        ) : null}
        actions={sendLink
          ? <BandPrimary href={sendLink}>{lapsing ? 'Win them back' : 'Send booking link'} <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>
          : null} />
      </div>

      <QuickActions phone={c.phone} email={c.email} bookingUrl={bookingUrl} />

      <section aria-label="Figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tile label="Lifetime spend" value={inr(c.total_spent)} hint={c.first_booked_at ? `Since ${monthYear(c.first_booked_at)}` : 'Paid bookings'} accent />
        <Tile label="Bookings" value={c.bookings_count || null} note="No paid bookings yet"
          hint={c.no_show_count > 0 ? noShowWord(c.no_show_count) : c.cancel_count > 0 ? `${c.cancel_count} cancelled` : 'Paid, all time'} />
        <Tile label="Average booking" value={avg ? inr(avg) : null} note="Shows after their first paid booking" hint={avg ? 'Per paid booking' : undefined} />
        <Tile label="Last visit" value={last ? lastSeen(last) : null} note="No visits yet" hint={last ? fmtDate(last) : undefined} />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Timeline" subtitle={`${history.length} ${history.length === 1 ? 'booking' : 'bookings'}, newest first`}>
          <Timeline history={history} serviceMap={serviceMap} />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Contact">
            {c.phone || c.email ? (
              <div className="flex flex-col gap-1">
                {c.phone && <ContactRow icon={Phone} href={`tel:${c.phone}`}>{c.phone}</ContactRow>}
                {c.email && <ContactRow icon={Mail} href={`mailto:${c.email}`}>{c.email}</ContactRow>}
              </div>
            ) : <p className="mb-0 text-[14px] text-muted">No phone or email on their bookings.</p>}
          </Panel>

          <NotesPanel customerId={id} />

          {reviews.length > 0 && (
            <Panel title="Their reviews">
              <ul className="flex flex-col gap-2">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-[16px] bg-cream p-3.5">
                    <span className="flex items-center gap-0.5" role="img" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn('h-4 w-4', n <= r.rating ? 'fill-maroon text-maroon' : 'text-neutral-300')} strokeWidth={2} />
                      ))}
                    </span>
                    {r.comment && <p className="mb-0 mt-1.5 text-[14px] text-ink">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;
