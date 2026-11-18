// Clients — dashboard_v2 graduation of the Host Lab "Clients" design onto the
// REAL CRM data. Same data, gate, states and detail route as ClientsList (the
// old page); this one wears the lab's denser, avatar-led look. Shown only on the
// dashboard_v2 flag-ON path (App.jsx picks between this and ClientsList).
//
// Deliberately NOT ported from the lab, because each needs backend data the CRM
// API does not return yet — tracked as follow-ups, not faked here:
//   · computed segments (new / repeat / VIP / no-show risk) and no-show counts
//   · the win-back banner's lapsing count + lifetime value (the Lapsed *filter*
//     is here; the summarised banner is not)
//   · the in-place detail DRAWER with booking history + private notes
//     (we keep the existing /dashboard/clients/:id detail route instead)
//   · bulk WhatsApp / select
// ponytail: add each when its CRM endpoint exists; do not invent the data.
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Download, Repeat, UserX, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { crmGetCustomers, crmExportCsv, crmResolveCustomer } from '../services/api';
import {
  PageHeader, Card, SearchInput, SegmentedControl, Button, buttonClasses,
  EmptyState, ErrorState, Skeleton, cn, fmtMoney,
} from '../components/dashboard/ui';
import { PREMIUM_PLAN } from '../data/plans';
import ProTeaser from '../components/dashboard/ProTeaser';

const SAMPLE_CUSTOMERS = [
  { name: 'Aarav Sharma', initials: 'AS', meta: '6 bookings · ₹7,200' },
  { name: 'Diya Patel', initials: 'DP', meta: '3 bookings · ₹3,600' },
  { name: 'Kabir Mehta', initials: 'KM', meta: '9 bookings · ₹12,400' },
  { name: 'Ananya Rao', initials: 'AR', meta: '2 bookings · ₹1,800' },
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

const Avatar = ({ name, size = 'h-6 w-6 text-[9.5px]' }) => (
  <span className={cn('grid shrink-0 place-items-center rounded-full bg-blush font-bold text-maroon', size)} aria-hidden="true">
    {initialsOf(name)}
  </span>
);

// A WhatsApp deep link, only when there is a phone to send to. Digits only; the
// backend stores E.164-ish numbers but we strip non-digits defensively.
export const waLink = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
};

const ClientsV2 = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [hidden, setHidden] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gated, setGated] = useState(false);
  const [opening, setOpening] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await crmGetCustomers({ q, sort, filter: filter || undefined });
      setClients(data.clients || []);
      setTotal(data.total || 0);
      setHidden(data.hidden_count || 0);
      setGated(false);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.upgrade_required) {
        setGated(true);
      } else {
        setError(true);
        toast.error('Failed to load clients');
      }
    } finally {
      setLoading(false);
    }
  }, [q, sort, filter]);

  useEffect(() => { load(); }, [load]);

  // Derived (not-yet-persisted) client has id:null — resolve to a stable handle first.
  const openClient = async (c) => {
    if (opening) return;
    if (c.id) { navigate(`/dashboard/clients/${c.id}`); return; }
    setOpening(c.customer_key);
    try {
      const { data } = await crmResolveCustomer(c.customer_key);
      navigate(`/dashboard/clients/${data.id}`);
    } catch {
      toast.error('Could not open this client');
    } finally {
      setOpening(null);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await crmExportCsv();
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export clients');
    }
  };

  if (gated) {
    return (
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Clients</h1>
        <ProTeaser
          title="Unlock Clients"
          sub={`See every client's booking history, total spend and private notes — upgrade to ${PREMIUM_PLAN.name} to unlock your client list.`}
          src="crm"
        >
          <ul className="divide-y divide-black/5">
            {SAMPLE_CUSTOMERS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 bg-white p-4">
                <Avatar name={c.name} size="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">{c.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </ProTeaser>
      </div>
    );
  }

  const WaButton = ({ c }) => {
    const href = waLink(c.phone);
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`WhatsApp ${c.name || 'client'}`}
        className="grid h-7 w-7 place-items-center rounded-full text-ink/40 transition hover:bg-blush hover:text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
      </a>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Clients</h1>
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">{total} {total === 1 ? 'client' : 'clients'}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={loading || total === 0}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Name, phone or email…" className="w-full sm:w-72" />
        <SegmentedControl
          className="sm:w-auto"
          value={sort}
          onChange={setSort}
          options={[{ value: 'recent', label: 'Recent' }, { value: 'ltv', label: 'Top Spend' }]}
        />
        <button
          type="button"
          onClick={() => setFilter((f) => (f === 'lapsed' ? null : 'lapsed'))}
          aria-pressed={filter === 'lapsed'}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
            filter === 'lapsed' ? 'border-primary bg-primary/10 text-primary' : 'border-maroon/20 text-muted hover:bg-blush/40',
          )}
        >
          <UserX className="h-3.5 w-3.5" /> Lapsed
        </button>
      </div>

      {error && clients.length === 0 ? (
        <ErrorState message="Couldn't load your clients." onRetry={load} />
      ) : loading ? (
        <div className="overflow-hidden rounded-xl border-2 border-neutral-200 bg-white">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 border-b-2 border-neutral-100 px-3 py-2.5 last:border-b-0">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Clients show up here automatically once guests book and pay for your services."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border-2 border-neutral-200 bg-white md:block">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b-2 border-neutral-200 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                  {['Client', 'Phone', 'Bookings', 'Lifetime value', 'Last seen', ''].map((h, i) => (
                    <th key={h || i} scope="col" className={cn('px-3 py-2 font-bold', ['Bookings', 'Lifetime value'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-neutral-200">
                {clients.map((c) => (
                  <tr key={c.id || c.customer_key} onClick={() => openClient(c)} className="cursor-pointer transition-colors hover:bg-cream">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.name} />
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-bold text-ink">{c.name || 'Unknown'}</span>
                          {c.is_recurring && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-blush px-1.5 py-px text-[9.5px] font-bold text-maroon">
                              <Repeat className="h-2.5 w-2.5" strokeWidth={2.6} /> Repeat
                            </span>
                          )}
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
          <ul className="divide-y-2 divide-neutral-200 overflow-hidden rounded-xl border-2 border-neutral-200 bg-white md:hidden">
            {clients.map((c) => (
              <li key={c.id || c.customer_key}>
                <button type="button" onClick={() => openClient(c)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
                  <Avatar name={c.name} size="h-8 w-8 text-[10.5px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-ink">{c.name || 'Unknown'}</span>
                    <span className="block text-[10.5px] font-medium text-ink/50">{c.bookings_count ?? 0} bookings · {lastSeen(c.last_booking_at)}</span>
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
          <Link to="/dashboard/upgrade?src=crm_cap" className={buttonClasses({ variant: 'primary' })}>
            See all clients
          </Link>
        </Card>
      )}
    </div>
  );
};

export default ClientsV2;
