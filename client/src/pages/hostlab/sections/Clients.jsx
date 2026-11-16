// Clients — the host's own book of business.
//
// The live page is a Pro-gated table with search + CSV export, and a separate
// detail route. Kept: everything, including the Pro gate (shown as a state here,
// not removed). Added: segments that are computed not typed (new / repeat / VIP /
// lapsing / no-show risk), lifetime value and average per booking, a detail
// DRAWER with the full booking history and private notes in one place, bulk
// WhatsApp + export, and a "win them back" list — the one thing a host with 60
// clients cannot do by eye.
import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownUp, ChevronDown, Download, MessageSquare, Phone, Repeat, UserMinus,
  StickyNote, Trash2, TrendingUp, Users, Mail, Crown,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Modal, cn } from '../../../components/dashboard/ui';
import { Avatar, LabTextarea, Panel, StatusPill, fmtDayFull, inr, relDay } from '../labUi';
import { CheckBox, Filter, FilterBar } from '../filters';
import mock from '../mockData';

const SEGMENTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'new', label: 'New' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'vip', label: 'Top spenders' },
  { value: 'lapsing', label: 'Slipping away' },
  { value: 'risk', label: 'No-show history' },
];

const SEG_LABEL = { new: 'New', repeat: 'Repeat', vip: 'Top spender', lapsing: 'Slipping away' };

const daysSince = (iso) => Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);

const ClientDrawer = ({ client, onClose }) => {
  const [notes, setNotes] = useState(client?.notes || []);
  const [draft, setDraft] = useState('');
  if (!client) return null;

  const history = mock.bookings
    .filter((b) => b.client_id === client.id)
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  const avg = client.bookings_count ? Math.round(client.total_spent / client.bookings_count) : 0;

  return (
    <Modal open drawer size="lg" onClose={onClose} title={client.name}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Avatar name={client.name} size="h-12 w-12 text-[13px]" />
          <div className="min-w-0">
            <p className="font-display text-[13.5px] font-bold text-ink">{client.name}</p>
            <p className="text-[11px] font-medium text-ink/55">
              First booked {fmtDayFull(client.first_booking_at)} · {SEG_LABEL[client.segment] || 'Client'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {client.tags.map((t) => <StatusPill key={t} status="x">{t}</StatusPill>)}
              {client.no_shows > 0 && <StatusPill status="no_show">{client.no_shows} no-show{client.no_shows > 1 ? 's' : ''}</StatusPill>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            ['Lifetime value', inr(client.total_spent)],
            ['Bookings', client.bookings_count],
            ['Average booking', inr(avg)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border-2 border-neutral-200 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</p>
              <p className="mt-0.5 font-display text-[13.5px] font-extrabold text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm"><MessageSquare className="h-4 w-4" strokeWidth={2.4} /> WhatsApp</Button>
          <Button size="sm" variant="outline"><Phone className="h-4 w-4" strokeWidth={2.4} /> {client.phone}</Button>
          <Button size="sm" variant="outline"><Mail className="h-4 w-4" strokeWidth={2.4} /> Email</Button>
          <Button size="sm" variant="ghost" onClick={() => toast.success(`Booking link sent to ${client.name}`)}>Send booking link</Button>
        </div>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/45">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={2.4} /> Private notes
          </h3>
          <LabTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Allergies, goals, what to pick up next time. Only you see this."
          />
          <Button
            size="sm"
            className="mt-2"
            disabled={!draft.trim()}
            onClick={() => {
              setNotes((n) => [{ id: `n${Date.now()}`, at: new Date().toISOString(), body: draft.trim() }, ...n]);
              setDraft('');
              toast.success('Note added');
            }}
          >
            Add note
          </Button>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {notes.length === 0 && <li className="text-[11px] font-medium text-ink/45">No notes yet.</li>}
            {notes.map((n) => (
              <li key={n.id} className="group rounded-lg bg-cream p-2">
                <p className="text-[11.5px] font-medium text-ink/80">{n.body}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-ink/40">{relDay(n.at)}</span>
                  <button
                    type="button"
                    onClick={() => { setNotes((v) => v.filter((x) => x.id !== n.id)); toast.success('Note deleted'); }}
                    aria-label="Delete note"
                    className="ml-auto rounded-full p-1 text-ink/30 transition hover:bg-error-bg hover:text-error-fg"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink/45">Every booking ({history.length})</h3>
          <ul className="divide-y-2 divide-neutral-200 overflow-hidden rounded-lg border-2 border-neutral-200">
            {history.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-bold text-ink">{b.services.title}</span>
                  <span className="block text-[10.5px] font-medium text-ink/50">{fmtDayFull(b.scheduled_at)}</span>
                </span>
                <StatusPill status={b.status} />
                <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">{b.amount ? inr(b.amount) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
};

const Clients = () => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('value_desc');
  const [picked, setPicked] = useState([]);
  const [openId, setOpenId] = useState(params.get('client'));
  const [winbackOpen, setWinbackOpen] = useState(false);

  const counts = useMemo(() => ({
    new: mock.clients.filter((c) => c.segment === 'new').length,
    repeat: mock.clients.filter((c) => c.segment === 'repeat').length,
    vip: mock.clients.filter((c) => c.segment === 'vip').length,
    lapsing: mock.clients.filter((c) => c.segment === 'lapsing').length,
    risk: mock.clients.filter((c) => c.no_shows > 0).length,
  }), []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = mock.clients.filter((c) => {
      if (segment === 'risk' ? c.no_shows === 0 : segment !== 'all' && c.segment !== segment) return false;
      if (needle && !`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by = {
      value_desc: (a, b) => b.total_spent - a.total_spent,
      recent: (a, b) => new Date(b.last_booking_at) - new Date(a.last_booking_at),
      stale: (a, b) => new Date(a.last_booking_at) - new Date(b.last_booking_at),
      name_asc: (a, b) => a.name.localeCompare(b.name),
      bookings_desc: (a, b) => b.bookings_count - a.bookings_count,
    };
    return [...out].sort(by[sort]);
  }, [q, segment, sort]);

  const total = mock.clients.reduce((n, c) => n + c.total_spent, 0);
  const repeatRate = mock.clients.filter((c) => c.bookings_count > 1).length / mock.clients.length;
  const lapsing = mock.clients.filter((c) => c.segment === 'lapsing');
  const lapsingValue = lapsing.reduce((n, c) => n + c.total_spent, 0);
  const open = mock.clients.find((c) => c.id === openId) || null;
  const allPicked = rows.length > 0 && picked.length === rows.length;


  return (
    <div className="flex flex-col gap-2.5">
      <header>
        <div>
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Clients</h1>
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">
            {mock.clients.length} people · {inr(total)} lifetime · {Math.round(repeatRate * 100)}% come back
          </p>
        </div>
      </header>

      {/* Win-back. A banner, not a panel: the page is a list of clients, and
          this is one line of news above it until the host asks for it. Closed
          it states the fact and what it is worth; open it is the list to act
          on. The one thing a host cannot spot by eye, costing one line. */}
      {lapsing.length > 0 && (
        <section className="overflow-hidden rounded-lg border-2 border-marigold-300 bg-marigold-100">
          <button
            type="button"
            onClick={() => setWinbackOpen((v) => !v)}
            aria-expanded={winbackOpen}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-marigold-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          >
            <UserMinus className="h-3.5 w-3.5 shrink-0 text-marigold-800" strokeWidth={2.6} />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-marigold-800">
              <b className="font-bold">{lapsing.length} regulars</b> have not booked in 30+ days
              <span className="font-medium opacity-70"> · {inr(lapsingValue)} of lifetime value</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-marigold-800">{winbackOpen ? 'Hide' : 'Review'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-marigold-800 transition-transform', winbackOpen && 'rotate-180')} strokeWidth={2.6} />
          </button>

          {winbackOpen && (
            <div className="border-t-2 border-marigold-300 bg-white">
              <ul className="divide-y-2 divide-neutral-200">
                {lapsing.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Avatar name={c.name} size="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-bold text-ink">{c.name}</span>
                      <span className="block text-[10.5px] font-medium text-ink/50">
                        {daysSince(c.last_booking_at)} days ago · {inr(c.total_spent)} lifetime
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toast.success(`WhatsApp drafted for ${c.name}`)}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border-2 border-maroon px-2 text-[11px] font-bold text-maroon transition hover:bg-pink-100"
                    >
                      <MessageSquare className="h-3 w-3" strokeWidth={2.6} /> Nudge
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="shrink-0 px-1.5 text-[11px] font-bold text-ink/50 transition hover:text-maroon"
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 border-t-2 border-neutral-200 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => toast.success(`WhatsApp drafted for ${lapsing.length} clients`)}
                  className="inline-flex h-7 items-center gap-1 rounded-sm bg-maroon px-2.5 text-[11px] font-bold text-white transition hover:bg-maroon-dark"
                >
                  <MessageSquare className="h-3 w-3" strokeWidth={2.6} /> Message all {lapsing.length}
                </button>
                <button
                  type="button"
                  onClick={() => { setSegment('lapsing'); setWinbackOpen(false); }}
                  className="text-[11px] font-bold text-maroon underline decoration-maroon/30 underline-offset-2"
                >
                  Show only these in the list
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: 'Name, email or phone' }}
        activeCount={(segment !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0)}
        onClearAll={() => { setSegment('all'); setQ(''); }}
        trailing={(
          <Filter
            label="Sort"
            icon={ArrowDownUp}
            value={sort}
            empty="value_desc"
            align="right"
            width="w-56"
            onChange={setSort}
            options={[
              { value: 'value_desc', label: 'Highest lifetime value' },
              { value: 'bookings_desc', label: 'Most bookings' },
              { value: 'recent', label: 'Booked most recently' },
              { value: 'stale', label: 'Longest since booking' },
              { value: 'name_asc', label: 'Name A-Z' },
            ]}
          />
        )}
      >
        <Filter
          label="Segment"
          value={segment}
          width="w-52"
          onChange={setSegment}
          options={SEGMENTS.map((x) => ({ ...x, count: counts[x.value] }))}
        />
      </FilterBar>

      {picked.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-maroon bg-maroon px-2.5 py-1.5 text-white">
          <span className="text-[11.5px] font-bold">{picked.length} selected</span>
          <button type="button" onClick={() => setPicked([])} className="text-[10.5px] font-semibold text-white/70 underline">Clear</button>
          <div className="ml-auto flex gap-1.5">
            {[['WhatsApp them', 'wa'], ['Send booking link', 'link'], ['Export', 'csv']].map(([label, k]) => (
              <button
                key={k}
                type="button"
                onClick={() => { toast.success(`${label} · ${picked.length} clients`); setPicked([]); }}
                className="rounded-full bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-maroon transition hover:bg-pink-100"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Panel
        flush
        title={`${rows.length} ${rows.length === 1 ? 'client' : 'clients'}`}
        action={(
          <button
            type="button"
            onClick={() => toast.success(`${rows.length} clients exported to CSV`)}
            className="inline-flex h-7 items-center gap-1 rounded-sm border-2 border-neutral-200 px-2 text-[11px] font-bold text-ink/65 transition hover:border-maroon/40 hover:text-maroon"
          >
            <Download className="h-3 w-3" strokeWidth={2.6} /> Export
          </button>
        )}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2.5 py-14 text-center">
            <Users className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">No one matches</p>
            <p className="max-w-sm text-[11px] font-medium text-ink/55">Try a different segment, or clear the search.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b-2 border-neutral-200 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                    <th scope="col" className="w-8 px-3 py-2">
                      <CheckBox checked={allPicked} onChange={() => setPicked(allPicked ? [] : rows.map((c) => c.id))} label="Select all shown" />
                    </th>
                    {['Client', 'Contact', 'Bookings', 'Lifetime value', 'Last seen', ''].map((h, i) => (
                      <th key={h || i} scope="col" className={cn('px-3 py-2 font-bold', ['Bookings', 'Lifetime value'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-neutral-200">
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} className={cn('cursor-pointer transition-colors hover:bg-cream', picked.includes(c.id) && 'bg-blush/60')}>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <CheckBox checked={picked.includes(c.id)} onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} label={`Select ${c.name}`} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={c.name} size="h-6 w-6 text-[9.5px]" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-bold text-ink">{c.name}</span>
                              {c.segment === 'vip' && <Crown className="h-3.5 w-3.5 shrink-0 text-marigold-600" strokeWidth={2.4} />}
                              {c.is_recurring && <Repeat className="h-3.5 w-3.5 shrink-0 text-maroon/50" strokeWidth={2.4} />}
                            </span>
                            {c.no_shows > 0 && <span className="block text-[10.5px] font-bold text-error-fg">{c.no_shows} no-show{c.no_shows > 1 ? 's' : ''}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[170px] truncate font-medium text-ink/70">{c.email}</p>
                        <p className="text-[10.5px] text-ink/45">{c.phone}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{c.bookings_count}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-maroon">{inr(c.total_spent)}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink/70">{daysSince(c.last_booking_at)}d ago</p>
                        <p className="text-[10.5px] text-ink/45">{fmtDayFull(c.last_booking_at)}</p>
                      </td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toast.success(`WhatsApp drafted for ${c.name}`)}
                          aria-label={`WhatsApp ${c.name}`}
                          className="grid h-7 w-7 place-items-center rounded-full text-ink/40 transition hover:bg-blush hover:text-maroon"
                        >
                          <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y-2 divide-neutral-200 md:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
                    <Avatar name={c.name} size="h-8 w-8 text-[10.5px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold text-ink">{c.name}</span>
                      <span className="block text-[10.5px] font-medium text-ink/50">{c.bookings_count} bookings · {daysSince(c.last_booking_at)}d ago</span>
                      {c.no_shows > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-error-fg">
                          <AlertTriangle className="h-3 w-3" strokeWidth={2.6} /> {c.no_shows} no-show{c.no_shows > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[11.5px] font-bold text-maroon">{inr(c.total_spent)}</span>
                      <span className="block text-[10px] font-medium text-ink/40">lifetime</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <p className="flex items-start gap-1.5 rounded-xl border-2 border-maroon-100 bg-maroon-50 px-2.5 py-1.5 text-[11px] font-medium text-ink/65">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
        On a Starter plan this page is a blurred teaser with an upgrade overlay, exactly as it is today — the gate is preserved, only the contents behind it change.
      </p>

      <ClientDrawer client={open} onClose={() => { setOpenId(null); setParams({}, { replace: true }); }} />
    </div>
  );
};

export default Clients;
