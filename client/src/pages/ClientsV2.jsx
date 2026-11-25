// Clients — the host's book of business, in the Kept direction (founder-approved
// 2026-11-25). Contact-style list (phone Contacts / Shopify Customers): search,
// segments, one row per person. A row opens the full profile at
// /dashboard/clients/:id (ClientDetail); the old ?client=<id> drawer link redirects
// there, so bookmarks keep working.
//
// Everything is real: crmGetCustomers for the list (already returns no_show_count,
// next_upcoming_at, first_booked_at, is_recurring, tags). Segments and win-back are
// DERIVED on the client from that list — no backend change, no faked data. Win-back
// shows on every plan (founder call, 2026-11-25).
//
// ponytail: segments + win-back are computed over the LOADED page (the list is a
// single page; the UI has no pager and free plans cap at 10, Pro is unpaged at
// pageSize 50). If a Pro host ever crosses 50 clients, lift these to the
// aggregation RPC the server already flags (crmService Phase 8) — do not paginate
// around it here.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Copy, Download, Search, Users, X } from 'lucide-react';
import { useRegisterRefresh } from '../components/dashboard/ui/refreshContext';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { crmGetCustomers, crmExportCsv, crmResolveCustomer } from '../services/api';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, InsightBand, PageHeading, WhatsAppIcon, cn, fmtDayFull, inr,
} from '../components/dashboard/ui/v2';
import { PREMIUM_PLAN } from '../data/plans';

const LAPSE_DAYS = 60; // mirrors crmService.LAPSE_DAYS
const DAY = 86_400_000;

export { initialsOf } from '../components/dashboard/ui/v2';

const daysSince = (iso, now = Date.now()) => (iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / DAY)) : null);

// How long ago, as a person says it. null when there is no date: the caller
// writes the sentence (Kept: never a dash).
export const lastSeen = (iso, now = Date.now()) => {
  const d = daysSince(iso, now);
  if (d === null) return null;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 60) return `${d} days ago`;
  return `${Math.round(d / 30)} months ago`;
};

export const waLink = (phone, text) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
};

// A client is lapsing on the same rule the server's `lapsed` filter uses: a
// repeat client (≥2 bookings) with nothing upcoming, last seen over 60 days ago.
export const isLapsing = (c, now = Date.now()) =>
  (c.bookings_count || 0) >= 2 && !c.next_upcoming_at &&
  !!c.last_booking_at && (daysSince(c.last_booking_at, now) ?? 0) > LAPSE_DAYS;

// The one line under a client's name: their next visit if one is booked, else
// their last. last_booking_at can be a prepaid future booking, so "next" wins.
export const visitLine = (c, now = Date.now()) => {
  if (c.next_upcoming_at && new Date(c.next_upcoming_at).getTime() > now) return `Next visit ${fmtDayFull(c.next_upcoming_at)}`;
  const seen = lastSeen(c.last_booking_at, now);
  return seen ? `Last visit ${seen}` : 'No visits yet';
};

// Top spenders: the top fifth by lifetime value (at least one), among clients who
// have actually paid. Derived over the loaded set — see the ponytail note above.
const vipKeySet = (clients) => {
  const paid = clients.filter((c) => (c.total_spent || 0) > 0).sort((a, b) => b.total_spent - a.total_spent);
  const take = Math.max(paid.length >= 5 ? Math.ceil(paid.length * 0.2) : 1, paid.length ? 1 : 0);
  return new Set(paid.slice(0, take).map((c) => c.customer_key));
};

const SEGMENTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'new', label: 'New' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'vip', label: 'Top spenders' },
  { value: 'lapsing', label: 'Slipping away' },
  { value: 'risk', label: 'No-show history' },
];

// Does a client match a segment? `vips` is the precomputed top-spender key set.
export const matchesSegment = (c, segment, vips) => {
  switch (segment) {
    case 'new': return (c.bookings_count || 0) === 1;
    case 'repeat': return (c.bookings_count || 0) > 1;
    case 'vip': return vips.has(c.customer_key);
    case 'lapsing': return isLapsing(c);
    case 'risk': return (c.no_show_count || 0) > 0;
    default: return true;
  }
};

// The band's facts, from the whole (unsearched) list. Pure, tested.
export const summarize = (clients, now = Date.now()) => {
  const lapsing = clients.filter((c) => isLapsing(c, now));
  return {
    total: clients.length,
    repeat: clients.filter((c) => (c.bookings_count || 0) > 1).length,
    lifetime: clients.reduce((n, c) => n + (c.total_spent || 0), 0),
    lapsing: lapsing.length,
    lapsingValue: lapsing.reduce((n, c) => n + (c.total_spent || 0), 0),
  };
};

// Contacts-style sections for the "Recent" order: who's coming, who came lately,
// everyone else. Keeps the server's order inside each section. Pure, tested.
export const groupRecent = (rows, now = Date.now()) => {
  const out = [['Coming up', []], ['Last 30 days', []], ['Earlier', []]];
  rows.forEach((c) => {
    if (c.next_upcoming_at && new Date(c.next_upcoming_at).getTime() > now) out[0][1].push(c);
    else if ((daysSince(c.last_booking_at, now) ?? Infinity) <= 30) out[1][1].push(c);
    else out[2][1].push(c);
  });
  return out.filter(([, list]) => list.length);
};

/* ── Shared Kept bits (also used by ClientDetail) ─────────────────────────── */
// Press feedback (Emil Kowalski's rule): a button dips to 0.97 on press with a
// strong ease-out, so a tap feels answered. Press only, never hover (Kept).
export const press = 'transition-[transform,background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 [-webkit-tap-highlight-color:transparent] touch-manipulation';
const serif = 'font-serif font-normal italic text-pink';
const bandBtn = `inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink ${press}`;
export const BandPrimary = ({ children, href, ...p }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')}>{children}</a>
  : <button type="button" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')} {...p}>{children}</button>);
export const BandGhost = ({ children, href, ...p }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>{children}</a>
  : <button type="button" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')} {...p}>{children}</button>);

// A word, never colour alone. 8px badge.
const TAG = {
  vip: ['Top spender', 'bg-maroon-100 text-maroon-700'],
  lapsing: ['Slipping away', 'bg-warning-bg text-warning-fg'],
  noshow: [null, 'bg-error-bg text-error-fg'],
  tag: [null, 'bg-neutral-100 text-ink/65'],
};
export const ClientTag = ({ kind, children }) => (
  <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[12px] font-semibold', TAG[kind][1])}>
    {children || TAG[kind][0]}
  </span>
);
export const noShowWord = (n) => `${n} no-show${n > 1 ? 's' : ''}`;

/* Pro preview — when the server says the CRM is locked (403 upgrade_required).
 * Ghost shapes only: a locked block never renders zeros or made-up people. */
export const ClientsProPreview = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Clients" />
      <InsightBand mascot="purple" eyebrow={`${PREMIUM_PLAN.name} feature`}
        title={<>Everyone who booked you, <em className={serif}>in one place.</em></>}
        sub="See each client's visits, lifetime spend and your private notes, and spot the regulars who stopped coming."
        actions={<BandPrimary onClick={() => navigate('/dashboard/upgrade?src=crm')}>Upgrade to {PREMIUM_PLAN.name} <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>} />
      <section aria-label="Preview of the client list" className="overflow-hidden rounded-[24px] bg-white">
        <p className="mb-0 px-5 pt-5 text-[14px] text-muted sm:px-6">Your clients will be listed here.</p>
        <ul aria-hidden="true" className="mt-2 divide-y divide-neutral-200">
          {[0.62, 0.48, 0.7, 0.55].map((w) => (
            <li key={w} className="flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="h-10 w-10 shrink-0 rounded-full bg-neutral-100" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="h-3 rounded-[6px] bg-neutral-100" style={{ width: `${w * 60}%` }} />
                <span className="h-2.5 rounded-[6px] bg-neutral-100" style={{ width: `${w * 85}%` }} />
              </span>
              <span className="h-3 w-14 shrink-0 rounded-[6px] bg-neutral-100" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const control = `rounded-[12px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose ${press}`;
// Segment chips: separate 12px tiles so the row can scroll edge to edge on a phone,
// like an app's filter bar. Hover tints only where hover exists; touch gets a press tint.
const chip = (on) => cn('h-10 shrink-0 snap-start rounded-[12px] px-3.5 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose', press,
  on ? 'bg-maroon text-white' : 'bg-white text-ink/75 active:bg-pink-100 [@media(hover:hover)]:hover:bg-pink-50');

/* One contact row. The whole row opens the profile; WhatsApp is its own target. */
const ClientRow = ({ c, vip, busy, onOpen }) => {
  const wa = waLink(c.phone);
  return (
    <li className="flex items-center transition-colors duration-150 [@media(hover:hover)]:hover:bg-pink-50">
      <button type="button" onClick={() => onOpen(c)} aria-busy={busy}
        className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left transition-colors duration-100 [-webkit-tap-highlight-color:transparent] touch-manipulation focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose active:bg-pink-100 sm:pl-6">
        <Avatar name={c.name} size="h-11 w-11 text-[14px]" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15.5px] font-semibold text-ink sm:text-[15px]">{c.name || 'Name not given'}</span>
            {vip && <ClientTag kind="vip" />}
            {isLapsing(c) && <ClientTag kind="lapsing" />}
            {c.no_show_count > 0 && <ClientTag kind="noshow">{noShowWord(c.no_show_count)}</ClientTag>}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-faint">
            {visitLine(c)}
            {c.phone && <span className="hidden sm:inline"> · {c.phone}</span>}
          </span>
        </span>
        <span className="shrink-0 pr-1 text-right" aria-label={`${inr(c.total_spent)} lifetime from ${c.bookings_count} ${c.bookings_count === 1 ? 'booking' : 'bookings'}`}>
          <span className="block text-[15px] font-semibold tabular-nums text-ink">{inr(c.total_spent)}</span>
          <span className="block text-[12px] text-faint">{c.bookings_count} {c.bookings_count === 1 ? 'booking' : 'bookings'}</span>
        </span>
      </button>
      <span className="flex w-14 shrink-0 justify-center pr-2 sm:w-16 sm:pr-3">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.name || 'this client'}`}
            className={cn(control, 'grid h-11 w-11 place-items-center active:bg-pink-100 [@media(hover:hover)]:hover:bg-pink-100')}>
            <WhatsAppIcon className="h-[22px] w-[22px]" />
          </a>
        )}
      </span>
    </li>
  );
};

const downloadBlob = (blob, name) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
};
const csvEsc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const ClientsV2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const legacyId = params.get('client'); // the retired drawer's deep link
  const [clients, setClients] = useState([]);
  const [base, setBase] = useState(null); // the unsearched list: the band's facts
  const [total, setTotal] = useState(0);
  const [hidden, setHidden] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // q, debounced
  const [sort, setSort] = useState('recent');
  const [segment, setSegment] = useState('all');
  const [status, setStatus] = useState('loading'); // loading | ready | error | gated
  const [opening, setOpening] = useState(null);
  const listRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  // q + sort go to the server; segment is applied on the client (derived).
  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const { data } = await crmGetCustomers({ q: query, sort });
      const list = data.clients || [];
      setClients(list);
      if (!query) { setBase(list); setTotal(data.total || 0); setHidden(data.hidden_count || 0); }
      setStatus('ready');
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.upgrade_required) setStatus('gated');
      else setStatus('error');
    }
  }, [query, sort]);

  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load); // pull-to-refresh re-fetches the list, not the whole page

  const vips = useMemo(() => vipKeySet(base || []), [base]);
  const facts = useMemo(() => summarize(base || []), [base]);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.value, clients.filter((c) => matchesSegment(c, s.value, vips)).length])), [clients, vips]);
  const rows = useMemo(() => clients.filter((c) => matchesSegment(c, segment, vips)), [clients, segment, vips]);

  const openClient = async (c) => {
    if (opening) return;
    let { id } = c;
    if (!id) {
      setOpening(c.customer_key);
      try { ({ data: { id } } = await crmResolveCustomer(c.customer_key)); }
      catch { toast.error('Could not open this client'); setOpening(null); return; }
      setOpening(null);
    }
    navigate(`/dashboard/clients/${id}`);
  };

  const showSegment = (s) => { setSegment(s); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // A filtered view exports what's on screen; the full list goes through the server
  // CSV (same columns as before).
  const filtered = segment !== 'all' || !!query;
  const exportRows = async () => {
    if (filtered) {
      const header = ['Name', 'Phone', 'Email', 'Bookings', 'Total Spent', 'Last Booking'];
      const lines = rows.map((c) => [c.name, c.phone, c.email, c.bookings_count, c.total_spent, c.last_booking_at].map(csvEsc).join(','));
      downloadBlob(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }), 'clients-selected.csv');
      return;
    }
    try {
      const { data } = await crmExportCsv();
      downloadBlob(new Blob([data], { type: 'text/csv' }), 'clients.csv');
    } catch { toast.error('Could not export clients'); }
  };

  const bookingUrl = user?.username ? `${window.location.origin}/${user.username}` : null;
  const copyLink = async () => {
    if (!bookingUrl) { toast.error('Set your username first.'); return; }
    try { await navigator.clipboard.writeText(bookingUrl); toast.success('Booking link copied'); }
    catch { toast.error('Could not copy your link.'); }
  };

  if (legacyId) return <Navigate to={`/dashboard/clients/${legacyId}`} replace />;
  if (status === 'gated') return <ClientsProPreview />;

  const loading = status === 'loading';
  const none = status === 'ready' && base && base.length === 0;
  const sub = loading || status === 'error' ? null
    : none ? 'Everyone who books and pays you'
      : `${total + hidden} ${total + hidden === 1 ? 'client' : 'clients'} · ${inr(facts.lifetime)} lifetime`;

  /* The band: one finding, from the whole list. Win-back first (the thing a host
   * with 60 clients can't spot by eye), else who keeps coming back. */
  let band = null;
  if (loading) band = <Skeleton className="h-[184px] !rounded-[28px] sm:h-[220px] sm:!rounded-[32px]" />;
  else if (status === 'ready' && none) {
    const share = bookingUrl ? `https://wa.me/?text=${encodeURIComponent(`Book a session with me: ${bookingUrl}`)}` : null;
    band = (
      <InsightBand mascot="blue" compact className="sm:py-7" eyebrow="Your clients"
        title={<>Your first client <em className={serif}>lands here.</em></>}
        sub="Everyone who books and pays shows up on their own, with their visits, spend and your notes."
        actions={(
          <>
            <BandPrimary onClick={copyLink}><Copy className="h-4 w-4" strokeWidth={2.4} /> Copy booking link</BandPrimary>
            {share && <BandGhost href={share}><WhatsAppIcon className="h-4 w-4" /> Share on WhatsApp</BandGhost>}
          </>
        )} />
    );
  } else if (status === 'ready' && facts.lapsing > 0) {
    const one = facts.lapsing === 1;
    band = (
      <InsightBand mascot="blue" compact className="sm:py-7" eyebrow="Win back"
        title={<>{facts.lapsing} {one ? 'regular hasn’t' : 'regulars haven’t'} booked <em className={serif}>in two months.</em></>}
        sub={`${inr(facts.lapsingValue)} of lifetime value between ${one ? 'them' : 'them all'}. A friendly WhatsApp is often all it takes.`}
        actions={segment === 'lapsing'
          ? <BandPrimary onClick={() => showSegment('all')}>Show everyone</BandPrimary>
          : <BandPrimary onClick={() => showSegment('lapsing')}>Show {one ? 'them' : `all ${facts.lapsing}`} <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>} />
    );
  } else if (status === 'ready') {
    band = (
      <InsightBand mascot="blue" compact className="sm:py-7" eyebrow="Your clients"
        title={facts.repeat
          ? <>{facts.repeat} of {facts.total} <em className={serif}>came back for more.</em></>
          : <>{facts.total} {facts.total === 1 ? 'client' : 'clients'} so far. <em className={serif}>Bring them back.</em></>}
        sub={facts.repeat
          ? 'No one has gone quiet for long. Your regulars show here first if they do.'
          : 'Nobody has booked twice yet. A note after their visit makes the second booking likelier.'}
        actions={facts.repeat ? <BandPrimary onClick={() => showSegment('vip')}>See top spenders <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary> : null} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Clients" sub={sub} />

      {status === 'error' ? (
        <div className="rounded-[24px] bg-white">
          <ErrorState icon={Users} title="We couldn't load your clients."
            message="Your client records are safe. This is a problem showing them. Try again." onRetry={load} />
        </div>
      ) : (
        <>
          {band}

          {!none && (
            <div ref={listRef} className="flex scroll-mt-20 flex-col gap-4">
              {/* Sticky on a phone, like an app's search bar: search + segments stay
                  under the top bar while the list scrolls. */}
              <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mx-4 flex flex-col gap-3 bg-cream/90 px-4 pb-3 pt-1 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <label className="relative block">
                  <span className="sr-only">Search clients</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" strokeWidth={2.2} />
                  {/* 16px on phones so iOS doesn't zoom the page on focus. */}
                  <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, phone or email" disabled={loading}
                    className="h-11 w-full rounded-[12px] border-0 bg-white pl-11 pr-11 text-[16px] text-ink placeholder:text-faint focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:opacity-60 sm:text-[14.5px] [&::-webkit-search-cancel-button]:hidden" />
                  {q && (
                    <button type="button" onClick={() => setQ('')} aria-label="Clear search"
                      className={cn(control, 'absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-faint hover:text-maroon active:bg-pink-100')}>
                      <X className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  )}
                </label>
                <nav aria-label="Segments" className="dash-noscrollbar -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                  {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-24 shrink-0" />)
                    : SEGMENTS.filter((s) => s.value === 'all' || s.value === segment || counts[s.value] > 0).map((s) => (
                      <button key={s.value} type="button" aria-pressed={segment === s.value} onClick={() => setSegment(s.value)} className={chip(segment === s.value)}>
                        {s.label}<span className={cn('ml-1.5 tabular-nums', segment === s.value ? 'text-white/75' : 'text-faint')}>{counts[s.value]}</span>
                      </button>
                    ))}
                </nav>
              </div>

              <section aria-label="Client list" className="overflow-hidden rounded-[24px] bg-white">
                <header className="flex items-center gap-2 border-b border-neutral-200 py-2.5 pl-5 pr-2.5 sm:pl-6">
                  <p className="mb-0 mr-auto text-[13.5px] font-semibold text-muted">
                    {loading ? 'Loading clients…' : `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`}
                  </p>
                  <div role="group" aria-label="Sort" className="flex shrink-0 gap-0.5 rounded-[12px] bg-cream p-0.5">
                    {[['recent', 'Recent'], ['ltv', 'Top spend']].map(([v, l]) => (
                      <button key={v} type="button" aria-pressed={sort === v} onClick={() => setSort(v)}
                        className={cn('h-9 rounded-[10px] px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose', press,
                          sort === v ? 'bg-white text-maroon' : 'text-muted')}>{l}</button>
                    ))}
                  </div>
                  <button type="button" onClick={exportRows} disabled={loading || rows.length === 0} aria-label={filtered ? `Export these ${rows.length}` : 'Export all clients'}
                    className={cn(control, 'inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-semibold text-maroon active:bg-pink-100 disabled:cursor-default disabled:text-neutral-300 [@media(hover:hover)]:hover:bg-pink-100')}>
                    <Download className="h-4 w-4" strokeWidth={2.4} /><span className="hidden sm:inline">{filtered ? `Export ${rows.length}` : 'Export'}</span>
                  </button>
                </header>
                {loading ? (
                  <ul aria-hidden="true" className="divide-y divide-neutral-200">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <li key={i} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                        <Skeleton className="h-11 w-11 !rounded-full" />
                        <span className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-40 max-w-full" /><Skeleton className="h-3 w-56 max-w-full" /></span>
                        <Skeleton className="h-4 w-16" />
                      </li>
                    ))}
                  </ul>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                    <p className="mb-0 text-[15px] font-semibold text-ink">
                      {query ? `No one matches “${query}”.` : `No one is in ${SEGMENTS.find((s) => s.value === segment)?.label.toLowerCase()} right now.`}
                    </p>
                    <button type="button" onClick={() => { setQ(''); setSegment('all'); }}
                      className={cn(control, 'inline-flex h-11 items-center gap-1.5 bg-cream px-4 text-[14px] font-semibold text-maroon hover:bg-blush')}>
                      <X className="h-4 w-4" strokeWidth={2.4} /> Show everyone
                    </button>
                  </div>
                ) : (
                  (sort === 'recent' ? groupRecent(rows) : [[null, rows]]).map(([label, list]) => (
                    <div key={label || 'all'}>
                      {label && <h3 className="mb-0 bg-cream/60 px-5 py-2 text-[13px] font-semibold text-muted sm:px-6">{label}</h3>}
                      <ul className="divide-y divide-neutral-200">
                        {list.map((c) => <ClientRow key={c.customer_key} c={c} vip={vips.has(c.customer_key)} busy={opening === c.customer_key} onOpen={openClient} />)}
                      </ul>
                    </div>
                  ))
                )}
              </section>

              {/* Starter cap: a notice, not a banner (Kept). */}
              {hidden > 0 && (
                <section className="flex flex-col gap-3 rounded-[24px] bg-white p-5 sm:flex-row sm:items-center sm:p-6">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon"><Users className="h-5 w-5" strokeWidth={2.2} /></span>
                  <p className="mb-0 flex-1 text-[14px] text-ink">
                    You have <strong className="font-semibold">{total + hidden} clients</strong>. You&apos;re seeing your {total} most recent; {PREMIUM_PLAN.name} shows every one.
                  </p>
                  <Link to="/dashboard/upgrade?src=crm_cap" className={cn(control, 'inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-maroon px-5 text-[14px] font-semibold text-white hover:bg-maroon-dark')}>
                    See all clients
                  </Link>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientsV2;
