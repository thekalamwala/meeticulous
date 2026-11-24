// Clients — dashboard_v2 graduation of the Host Lab "Clients" design onto the
// REAL CRM data. Shown only on the dashboard_v2 flag-ON path (App.jsx picks
// between this and ClientsList).
//
// Everything is real: crmGetCustomers for the list (already returns no_show_count,
// next_upcoming_at, first_booked_at, is_recurring, tags), crmGetCustomer +
// svcGetAll + the notes endpoints for the drawer. Segments and the win-back banner
// are DERIVED on the client from that list — no backend change, no faked data.
//
// ponytail: segments + win-back are computed over the LOADED page (the list is a
// single page; the UI has no pager and free plans cap at 10, Pro is unpaged at
// pageSize 50). If a Pro host ever crosses 50 clients, lift these to the
// aggregation RPC the server already flags (crmService Phase 8) — do not paginate
// around it here.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Download, Repeat, UserX, MessageSquare, Phone, Mail, Crown, ChevronDown,
  StickyNote, Trash2, CalendarClock, ArrowDownUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  crmGetCustomers, crmExportCsv, crmResolveCustomer, crmGetCustomer,
  crmGetNotes, crmAddNote, crmDeleteNote, svcGetAll,
} from '../services/api';
import {
  Card, SearchInput, SegmentedControl, Button, buttonClasses, Modal, Textarea,
  StatusBadge, EmptyState, ErrorState, Skeleton, SkeletonText, cn, fmtMoney,
} from '../components/dashboard/ui';
import { PageHeading } from '../components/dashboard/ui/v2';
import { PREMIUM_PLAN } from '../data/plans';
import ProTeaser from '../components/dashboard/ProTeaser';

const LAPSE_DAYS = 60; // mirrors crmService.LAPSE_DAYS

const SAMPLE_CUSTOMERS = [
  { name: 'Aarav Sharma', meta: '6 bookings · ₹7,200' },
  { name: 'Diya Patel', meta: '3 bookings · ₹3,600' },
  { name: 'Kabir Mehta', meta: '9 bookings · ₹12,400' },
  { name: 'Ananya Rao', meta: '2 bookings · ₹1,800' },
];

export const initialsOf = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

const daysSince = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null);
export const lastSeen = (iso) => {
  const d = daysSince(iso);
  if (d === null) return '—';
  if (d === 0) return 'today';
  return `${d}d ago`;
};
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const waLink = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
};

// A client is lapsing on the same rule the server's `lapsed` filter uses: a
// repeat client (≥2 bookings) with nothing upcoming, last seen over 60 days ago.
export const isLapsing = (c) =>
  (c.bookings_count || 0) >= 2 && !c.next_upcoming_at &&
  c.last_booking_at && (daysSince(c.last_booking_at) ?? 0) > LAPSE_DAYS;

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

const Avatar = ({ name, size = 'h-6 w-6 text-[9.5px]' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-bold text-maroon', size)} aria-hidden="true">
    {initialsOf(name)}
  </span>
);

const WaButton = ({ c }) => {
  const href = waLink(c.phone);
  if (!href) return null;
  return (
    <a
      href={href} target="_blank" rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`WhatsApp ${c.name || 'client'}`}
      className="grid h-7 w-7 place-items-center rounded-full text-ink/40 transition hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
    >
      <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
    </a>
  );
};

/* ── Detail drawer ─────────────────────────────────────────────────────────
 * Opens over the list (the lab's in-place drawer) instead of navigating to the
 * detail route. Resolves a derived client to a stable id first, then loads the
 * same payload the detail page uses (customer + history + reviews + notes). */
const ClientDrawer = ({ customerId, onClose }) => {
  const [data, setData] = useState(null);
  const [serviceMap, setServiceMap] = useState({});
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!customerId) return;
    setLoading(true); setError(false);
    Promise.all([
      crmGetCustomer(customerId),
      svcGetAll().catch(() => ({ data: [] })),
      crmGetNotes(customerId).catch(() => ({ data: { notes: [] } })),
    ])
      .then(([detail, svc, nts]) => {
        setData(detail.data);
        const map = {};
        (svc.data || []).forEach((s) => { map[s.id] = s.title; });
        setServiceMap(map);
        setNotes(nts.data.notes || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const { data: note } = await crmAddNote(customerId, body);
      setNotes((n) => [note, ...n]);
      setDraft('');
    } catch { toast.error('Could not save note'); } finally { setSaving(false); }
  };
  const removeNote = async (noteId) => {
    try { await crmDeleteNote(customerId, noteId); setNotes((n) => n.filter((x) => x.id !== noteId)); }
    catch { toast.error('Could not delete note'); }
  };

  const customer = data?.customer;
  const history = data?.history || [];
  const avg = customer?.bookings_count ? Math.round(customer.total_spent / customer.bookings_count) : 0;

  return (
    <Modal open drawer size="lg" onClose={onClose} title={customer?.name || 'Client'}>
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-16 w-full" /><SkeletonText lines={4} /></div>
      ) : error || !customer ? (
        <ErrorState message="Couldn't load this client." onRetry={load} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={customer.name} size="h-12 w-12 text-sm" />
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-ink">{customer.name || 'Unknown'}</p>
              <p className="text-xs text-muted">Client since {fmtDay(customer.first_booked_at)}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {customer.is_recurring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold text-maroon"><Repeat className="h-3 w-3" />Repeat</span>
                )}
                {customer.no_show_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-bold text-warning-fg"><UserX className="h-3 w-3" />{customer.no_show_count} no-show{customer.no_show_count > 1 ? 's' : ''}</span>
                )}
                {(customer.tags || []).map((t) => (
                  <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-ink/60">{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[['Lifetime value', fmtMoney(customer.total_spent)], ['Bookings', customer.bookings_count], ['Avg booking', fmtMoney(avg)]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-blush/40 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</p>
                <p className="mt-0.5 font-display text-sm font-extrabold text-ink">{v}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {waLink(customer.phone) && (
              <a href={waLink(customer.phone)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {customer.phone && <a href={`tel:${customer.phone}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}><Phone className="h-4 w-4" /> {customer.phone}</a>}
            {customer.email && <a href={`mailto:${customer.email}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}><Mail className="h-4 w-4" /> Email</a>}
            <Link to={`/dashboard/clients/${customerId}`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>Open full page</Link>
          </div>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/45">
              <StickyNote className="h-3.5 w-3.5" /> Private notes
            </h3>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Allergies, goals, what to pick up next time. Only you see this." />
            <Button size="sm" className="mt-2" disabled={saving || !draft.trim()} onClick={addNote}>Add note</Button>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {notes.length === 0 && <li className="text-[11px] font-medium text-ink/45">No notes yet.</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-blush/40 p-2">
                  <p className="whitespace-pre-wrap text-[11.5px] font-medium text-ink/80">{n.body}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-ink/40">{fmtDay(n.created_at)}</span>
                    <button type="button" onClick={() => removeNote(n.id)} aria-label="Delete note" className="ml-auto rounded-full p-1 text-ink/30 transition hover:bg-error-bg hover:text-error-fg">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink/45">Every booking ({history.length})</h3>
            {history.length === 0 ? (
              <p className="text-[11px] font-medium text-ink/45">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-maroon/5 overflow-hidden rounded-xl border-2 border-maroon/10">
                {history.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-bold text-ink">{serviceMap[b.service_id] || 'Service'}</span>
                      <span className="block text-[10.5px] font-medium text-ink/50">{fmtDay(b.scheduled_at || b.created_at)}</span>
                    </span>
                    <StatusBadge status={b.status} />
                    <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">{b.customer_total ? fmtMoney(b.customer_total) : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};

const ClientsV2 = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [hidden, setHidden] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [segment, setSegment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gated, setGated] = useState(false);
  const [picked, setPicked] = useState([]);
  const [winbackOpen, setWinbackOpen] = useState(false);
  const [openId, setOpenId] = useState(params.get('client') || null);
  const [opening, setOpening] = useState(false);

  // q + sort go to the server; segment is applied on the client (derived).
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await crmGetCustomers({ q, sort });
      setClients(data.clients || []);
      setTotal(data.total || 0);
      setHidden(data.hidden_count || 0);
      setGated(false);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.upgrade_required) setGated(true);
      else { setError(true); toast.error('Failed to load clients'); }
    } finally { setLoading(false); }
  }, [q, sort]);

  useEffect(() => { load(); }, [load]);

  const vips = useMemo(() => vipKeySet(clients), [clients]);
  const counts = useMemo(() => {
    const out = { new: 0, repeat: 0, vip: 0, lapsing: 0, risk: 0 };
    for (const c of clients) {
      if (matchesSegment(c, 'new', vips)) out.new += 1;
      if (matchesSegment(c, 'repeat', vips)) out.repeat += 1;
      if (matchesSegment(c, 'vip', vips)) out.vip += 1;
      if (matchesSegment(c, 'lapsing', vips)) out.lapsing += 1;
      if (matchesSegment(c, 'risk', vips)) out.risk += 1;
    }
    return out;
  }, [clients, vips]);

  const rows = useMemo(
    () => clients.filter((c) => matchesSegment(c, segment, vips)),
    [clients, segment, vips],
  );

  const lapsing = useMemo(() => clients.filter((c) => isLapsing(c)), [clients]);
  const lapsingValue = lapsing.reduce((n, c) => n + (c.total_spent || 0), 0);

  const openClient = async (c) => {
    if (opening) return;
    let id = c.id;
    if (!id) {
      setOpening(true);
      try { ({ data: { id } } = await crmResolveCustomer(c.customer_key)); }
      catch { toast.error('Could not open this client'); setOpening(false); return; }
      setOpening(false);
    }
    setOpenId(id);
    setParams((p) => { const n = new URLSearchParams(p); n.set('client', id); return n; }, { replace: true });
  };
  const closeDrawer = () => {
    setOpenId(null);
    setParams((p) => { const n = new URLSearchParams(p); n.delete('client'); return n; }, { replace: true });
  };

  const csvEsc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const exportRows = async (subset) => {
    if (subset) {
      const header = ['Name', 'Phone', 'Email', 'Bookings', 'Total Spent', 'Last Booking'];
      const lines = subset.map((c) => [c.name, c.phone, c.email, c.bookings_count, c.total_spent, c.last_booking_at].map(csvEsc).join(','));
      const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'clients-selected.csv';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      return;
    }
    try {
      const { data } = await crmExportCsv();
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = 'clients.csv';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not export clients'); }
  };

  const allPicked = rows.length > 0 && picked.length === rows.length;
  const toggleAll = () => setPicked(allPicked ? [] : rows.map((c) => c.customer_key));
  const togglePick = (key) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const pickedRows = clients.filter((c) => picked.includes(c.customer_key));

  if (gated) {
    return (
      <div className="flex flex-col gap-2.5">
        <PageHeading title="Clients" />
        <ProTeaser title="Unlock Clients" sub={`See every client's booking history, total spend and private notes — upgrade to ${PREMIUM_PLAN.name} to unlock your client list.`} src="crm">
          <ul className="divide-y divide-black/5">
            {SAMPLE_CUSTOMERS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 bg-white p-4">
                <Avatar name={c.name} size="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1"><p className="font-semibold text-ink">{c.name}</p><p className="text-sm text-muted">{c.meta}</p></div>
              </li>
            ))}
          </ul>
        </ProTeaser>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PageHeading
        title="Clients"
        sub={`${total} ${total === 1 ? 'client' : 'clients'}`}
        action={(
          <Button variant="secondary" size="sm" onClick={() => exportRows()} disabled={loading || total === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
        )}
      />

      {/* Win-back — the thing a host with 60 clients cannot spot by eye. */}
      {lapsing.length > 0 && (
        <section className="overflow-hidden rounded-xl border-2 border-marigold-300 bg-marigold-100">
          <button type="button" onClick={() => setWinbackOpen((v) => !v)} aria-expanded={winbackOpen}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-marigold-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose">
            <UserX className="h-3.5 w-3.5 shrink-0 text-marigold-800" strokeWidth={2.6} />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-marigold-800">
              <b className="font-bold">{lapsing.length} regular{lapsing.length > 1 ? 's' : ''}</b> haven't booked in {LAPSE_DAYS}+ days
              <span className="font-medium opacity-70"> · {fmtMoney(lapsingValue)} of lifetime value</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-marigold-800">{winbackOpen ? 'Hide' : 'Review'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-marigold-800 transition-transform', winbackOpen && 'rotate-180')} strokeWidth={2.6} />
          </button>
          {winbackOpen && (
            <div className="border-t border-marigold-300/60 bg-white">
              <ul className="divide-y divide-maroon/5">
                {lapsing.map((c) => (
                  <li key={c.customer_key} className="flex items-center gap-2 px-3 py-1.5">
                    <Avatar name={c.name} size="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-bold text-ink">{c.name || 'Unknown'}</span>
                      <span className="block text-[10.5px] font-medium text-ink/50">{lastSeen(c.last_booking_at)} · {fmtMoney(c.total_spent)} lifetime</span>
                    </span>
                    {waLink(c.phone) && (
                      <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border-2 border-maroon px-2 text-[11px] font-bold text-maroon transition hover:bg-blush">
                        <MessageSquare className="h-3 w-3" strokeWidth={2.6} /> Nudge
                      </a>
                    )}
                    <button type="button" onClick={() => openClient(c)} className="shrink-0 px-1.5 text-[11px] font-bold text-ink/50 transition hover:text-maroon">Open</button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 border-t border-maroon/5 px-3 py-1.5">
                <button type="button" onClick={() => { setSegment('lapsing'); setWinbackOpen(false); }} className="text-[11px] font-bold text-maroon underline decoration-maroon/30 underline-offset-2">
                  Show only these in the list
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Name, phone or email…" className="w-full sm:w-64" />
        <div className="relative inline-flex items-center">
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            aria-label="Segment"
            className="h-10 appearance-none rounded-full border border-maroon/20 bg-white pl-3 pr-8 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}{s.value !== 'all' ? ` (${counts[s.value] ?? 0})` : ''}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-ink/40" />
        </div>
        <SegmentedControl className="sm:w-auto" value={sort} onChange={setSort}
          options={[{ value: 'recent', label: 'Recent' }, { value: 'ltv', label: 'Top Spend' }]} />
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-maroon px-3 py-2 text-white">
          <span className="text-[11.5px] font-bold">{picked.length} selected</span>
          <button type="button" onClick={() => setPicked([])} className="text-[10.5px] font-semibold text-white/70 underline">Clear</button>
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => exportRows(pickedRows)} className="rounded-full bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-maroon transition hover:bg-blush">
              Export selected
            </button>
          </div>
        </div>
      )}

      {error && clients.length === 0 ? (
        <ErrorState message="Couldn't load your clients." onRetry={load} />
      ) : loading ? (
        <div className="overflow-hidden rounded-2xl border-2 border-maroon/10 bg-white">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-maroon/5 px-3 py-2.5 last:border-b-0">
              <Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-3.5 w-40" /><Skeleton className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={clients.length ? 'No one matches' : 'No clients yet'}
          description={clients.length ? 'Try a different segment, or clear the search.' : 'Clients show up here automatically once guests book and pay for your services.'} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border-2 border-maroon/10 bg-white md:block">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-maroon/10 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                  <th scope="col" className="w-8 px-3 py-2">
                    <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all shown" className="h-3.5 w-3.5 accent-maroon" />
                  </th>
                  {['Client', 'Phone', 'Bookings', 'Lifetime value', 'Last seen', ''].map((h, i) => (
                    <th key={h || i} scope="col" className={cn('px-3 py-2 font-bold', ['Bookings', 'Lifetime value'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-maroon/5">
                {rows.map((c) => (
                  <tr key={c.customer_key} onClick={() => openClient(c)} className={cn('cursor-pointer transition-colors hover:bg-cream', picked.includes(c.customer_key) && 'bg-blush/60')}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={picked.includes(c.customer_key)} onChange={() => togglePick(c.customer_key)} aria-label={`Select ${c.name || 'client'}`} className="h-3.5 w-3.5 accent-maroon" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.name} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-ink">{c.name || 'Unknown'}</span>
                            {vips.has(c.customer_key) && <Crown className="h-3.5 w-3.5 shrink-0 text-marigold-600" strokeWidth={2.4} />}
                          </span>
                          {c.no_show_count > 0 && <span className="block text-[10.5px] font-bold text-error-fg">{c.no_show_count} no-show{c.no_show_count > 1 ? 's' : ''}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className="font-medium tabular-nums text-ink/70">{c.phone || '—'}</span></td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{c.bookings_count ?? 0}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-maroon">{fmtMoney(c.total_spent)}</td>
                    <td className="px-3 py-2"><span className="font-medium text-ink/70">{lastSeen(c.last_booking_at)}</span></td>
                    <td className="px-3 py-2 text-right"><WaButton c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-maroon/5 overflow-hidden rounded-2xl border-2 border-maroon/10 bg-white md:hidden">
            {rows.map((c) => (
              <li key={c.customer_key}>
                <button type="button" onClick={() => openClient(c)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
                  <Avatar name={c.name} size="h-8 w-8 text-[10.5px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="block truncate text-[12px] font-bold text-ink">{c.name || 'Unknown'}</span>
                      {vips.has(c.customer_key) && <Crown className="h-3 w-3 shrink-0 text-marigold-600" strokeWidth={2.4} />}
                    </span>
                    <span className="block text-[10.5px] font-medium text-ink/50">{c.bookings_count ?? 0} bookings · {lastSeen(c.last_booking_at)}</span>
                    {c.no_show_count > 0 && <span className="block text-[10.5px] font-bold text-error-fg">{c.no_show_count} no-show{c.no_show_count > 1 ? 's' : ''}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11.5px] font-bold text-maroon">{fmtMoney(c.total_spent)}</span>
                    <span className="block text-[10px] font-medium text-ink/40">lifetime</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {hidden > 0 && (
        <Card className="mt-1 flex flex-wrap items-center justify-between gap-3 border-2 border-dashed border-primary/30">
          <p className="text-sm text-muted">
            You have <strong className="text-maroon">{total + hidden} clients</strong> — you're seeing your {total} most recent.
            See every one, with notes and history, on {PREMIUM_PLAN.name}.
          </p>
          <Link to="/dashboard/upgrade?src=crm_cap" className={buttonClasses({ variant: 'primary' })}>See all clients</Link>
        </Card>
      )}

      {openId && <ClientDrawer customerId={openId} onClose={closeDrawer} />}
    </div>
  );
};

export default ClientsV2;
