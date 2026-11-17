// Bookings — calendar + a list that can actually be filtered.
//
// What the live page is missing and this adds: text search, status / payment /
// service / date-range filters, saved views, column sort, multi-select with bulk
// actions, a detail DRAWER instead of a modal (so the list stays in view), an
// a visible "Add booking" entry, and per-status counts inside the filters.
// Three views, each its own route: List, Week, Month.
// Every live action is preserved: confirm, complete, no-show, reschedule, cancel,
// review, notes.
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, CalendarDays, CalendarX2, Check, Copy, Download,
  CalendarRange, List, MessageSquare, Plus, RotateCcw, Trash2, UserX, Video, X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, LabInput as Input, LabSelect as Select,
  Drawer, Panel, StatusPill, fmtDayFull, fmtTime, inr, relDay, useLast, useSubPage,
} from '../labUi';
import { CheckBox, Filter, FilterBar, ViewSwitch } from '../filters';
import mock from '../mockData';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.toDateString() === b.toDateString();

const STATUSES = [
  { value: 'pending', label: 'Needs confirming' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Done' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];

const RANGES = [
  { value: 'all', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'last30', label: 'Last 30 days' },
];

// Saved views are the real answer to "I check the same three things daily".
const VIEWS = [
  { id: 'needs', label: 'Needs action', filters: { statuses: ['pending'], payment: 'all', range: 'all' } },
  { id: 'unpaid', label: 'Unpaid', filters: { statuses: ['confirmed'], payment: 'unpaid', range: 'all' } },
  { id: 'week', label: 'This week', filters: { statuses: [], payment: 'all', range: 'next7' } },
  { id: 'noshow', label: 'No-shows', filters: { statuses: ['no_show'], payment: 'all', range: 'all' } },
];

const inRange = (iso, range) => {
  const d = new Date(iso);
  const now = new Date();
  const t0 = new Date(now).setHours(0, 0, 0, 0);
  switch (range) {
    case 'today': return sameDay(d, now);
    case 'next7': return d >= t0 && d <= addDays(now, 7);
    case 'upcoming': return d > now;
    case 'past': return d < now;
    case 'last30': return d < now && d >= addDays(now, -30);
    default: return true;
  }
};

/* ── Detail drawer — the list stays behind it, so you keep your place ──── */
const BookingDrawer = ({ open, booking, onClose, onAction }) => {
  const [confirming, setConfirming] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { setConfirming(null); setNote(booking?.host_note || ''); }, [booking]);
  if (!booking) return null;

  const terminal = ['completed', 'cancelled', 'no_show'].includes(booking.status);
  const ACTIONS = [
    booking.status === 'pending' && { key: 'confirm', label: 'Confirm booking', icon: Check },
    !terminal && { key: 'complete', label: 'Mark done', icon: Check, variant: 'outline' },
    !terminal && { key: 'reschedule', label: 'Reschedule', icon: RotateCcw, variant: 'outline' },
    !terminal && { key: 'no_show', label: 'No-show', icon: UserX, variant: 'outline' },
    !terminal && { key: 'cancel', label: 'Cancel', icon: X, variant: 'danger-outline' },
  ].filter(Boolean);

  const CONFIRM_COPY = {
    cancel: booking.payment_status === 'paid'
      ? 'Cancel this paid booking? The guest is told straight away. A refund is not automatic — you issue it from Money › Transactions.'
      : 'Cancel this booking? The guest is told straight away.',
    no_show: 'Mark as a no-show? It is recorded on the client and counts toward their no-show history.',
    complete: 'Mark this done? The payout hold on this booking starts clearing.',
    confirm: 'Confirm this booking? The guest gets the calendar invite and the reminder sequence starts.',
    reschedule: 'Pick a new slot from your live availability. The guest is asked to accept it.',
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={booking.guest_name}
      subtitle={`${booking.ref} · ${booking.services.title}`}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={booking.status} />
          <StatusPill status={booking.payment_status} />
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-ink/55">from {booking.source}</span>
        </div>

        <div className="rounded-xl border-2 border-neutral-200 p-2.5">
          <p className="font-display text-[13px] font-bold text-ink">{booking.services.title}</p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-maroon">
            {fmtDayFull(booking.scheduled_at)} · {fmtTime(booking.scheduled_at)} · {booking.services.duration} min
          </p>
          <p className="mt-0.5 text-[10.5px] font-medium text-ink/50">{relDay(booking.scheduled_at)} · {booking.location}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-[11.5px]">
          {[
            ['Amount', booking.amount ? inr(booking.amount) : 'Free'],
            ['Platform fee', booking.platform_fee ? inr(booking.platform_fee) : '—'],
            ['You keep', booking.amount ? inr(booking.amount - booking.platform_fee) : '—'],
            ['Booked on', fmtDayFull(booking.created_at)],
            ['Phone', booking.guest_phone],
            ['Email', booking.guest_email],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</dt>
              <dd className="mt-0.5 font-semibold text-ink/80">{v}</dd>
            </div>
          ))}
        </dl>

        {booking.guest_note && (
          <div className="rounded-lg bg-blush p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-maroon/70">What they wrote when booking</p>
            <p className="mt-1 text-[11.5px] font-medium text-ink/80">{booking.guest_note}</p>
          </div>
        )}

        <div>
          <label htmlFor="bk-note" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">
            Your private note
          </label>
          <Input
            id="bk-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only you can see this."
          />
          <Button
            size="sm"
            variant="ghost"
            className="mt-1.5"
            onClick={() => toast.success('Note saved')}
          >
            Save note
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t-2 border-neutral-200 pt-2.5">
          <Button size="sm" variant="outline"><Video className="h-4 w-4" strokeWidth={2.4} /> Join call</Button>
          <Button size="sm" variant="outline"><MessageSquare className="h-4 w-4" strokeWidth={2.4} /> WhatsApp</Button>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(booking.ref); toast.success(`${booking.ref} copied`); }}>
            <Copy className="h-4 w-4" strokeWidth={2.4} /> Copy ref
          </Button>
        </div>

        {confirming ? (
          <div className="rounded-xl border-2 border-maroon bg-maroon-50 p-2.5">
            <p className="text-[11.5px] font-semibold text-ink/80">{CONFIRM_COPY[confirming]}</p>
            <div className="mt-2.5 flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Back</Button>
              <Button
                size="sm"
                variant={confirming === 'cancel' ? 'danger' : 'primary'}
                onClick={() => { onAction(booking, confirming); setConfirming(null); }}
              >
                Yes, {confirming === 'no_show' ? 'no-show' : confirming}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <Button key={a.key} size="sm" variant={a.variant} onClick={() => setConfirming(a.key)}>
                <a.icon className="h-4 w-4" strokeWidth={2.4} /> {a.label}
              </Button>
            ))}
            {terminal && <p className="text-[11px] font-medium text-ink/45">No actions left on a {booking.status.replace('_', '-')} booking.</p>}
          </div>
        )}
      </div>
    </Drawer>
  );
};

/* ── Add booking ───────────────────────────────────────────────────────── */
const AddBooking = ({ open, onClose }) => {
  const [form, setForm] = useState({ name: '', phone: '', service: mock.services[1].id, date: '', time: '10:00', collect: 'link' });
  const valid = form.name.trim() && form.date;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add a booking yourself"
      subtitle="For the client who called instead of booking online"
      width="sm:w-[420px]"
    >
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-ink/55">
          It lands on your calendar and blocks the slot like any other.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Client name</span>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Meera Iyer" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Phone</span>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 98200 11234" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Service</span>
          <Select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}>
            {mock.services.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>{s.title} · {s.duration} min · {s.price ? inr(s.price) : 'Free'}</option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Date</span>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Time</span>
            <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink/40">Payment</span>
          <Select value={form.collect} onChange={(e) => setForm((f) => ({ ...f, collect: e.target.value }))}>
            <option value="link">Send a payment link</option>
            <option value="offline">Already paid me directly</option>
            <option value="free">No charge</option>
          </Select>
        </label>
        {!valid && <p className="text-[10.5px] font-semibold text-warning-fg">A name and a date are needed.</p>}
        <div className="mt-1 flex gap-1.5">
          <Button size="sm" disabled={!valid} onClick={() => { toast.success(`Booking created for ${form.name}`); onClose(); }}>
            Create booking
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Drawer>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Bookings = () => {
  const [params, setParams] = useSearchParams();
  // Which view is open is a URL, not component state: a week you are looking
  // at is a thing you can send someone.
  const mode = useSubPage('bookings').slug;
  const [anchor, setAnchor] = useState(() => new Date());
  const [q, setQ] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [payment, setPayment] = useState('all');
  const [service, setService] = useState('all');
  const [range, setRange] = useState('all');
  const [sort, setSort] = useState('date_desc');
  const [picked, setPicked] = useState([]);
  const [openId, setOpenId] = useState(params.get('booking'));
  const [adding, setAdding] = useState(params.get('new') === '1');
  const [rows, setRows] = useState(mock.bookings);
  const [savedView, setSavedView] = useState(null);

  // Deep links from search / Today land straight on a booking.
  useEffect(() => {
    const b = params.get('booking');
    if (b) setOpenId(b);
    if (params.get('new') === '1') setAdding(true);
  }, [params]);

  const counts = useMemo(() => {
    const c = {};
    STATUSES.forEach((s) => { c[s.value] = rows.filter((b) => b.status === s.value).length; });
    c.unpaid = rows.filter((b) => b.payment_status === 'unpaid' && b.amount > 0).length;
    c.upcoming = rows.filter((b) => b.status !== 'cancelled' && new Date(b.scheduled_at) > new Date()).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((b) => {
      if (statuses.length && !statuses.includes(b.status)) return false;
      if (payment !== 'all' && b.payment_status !== payment) return false;
      if (service !== 'all' && b.services.id !== service) return false;
      if (!inRange(b.scheduled_at, range)) return false;
      if (needle && !`${b.guest_name} ${b.guest_email} ${b.services.title} ${b.ref}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by = {
      date_desc: (a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at),
      date_asc: (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at),
      amount_desc: (a, b) => b.amount - a.amount,
      name_asc: (a, b) => a.guest_name.localeCompare(b.guest_name),
    };
    return [...out].sort(by[sort]);
  }, [rows, q, statuses, payment, service, range, sort]);

  // How many things are narrowing the list — drives the one "Clear all".
  const activeCount =
    (statuses.length ? 1 : 0) + (payment !== 'all' ? 1 : 0) + (service !== 'all' ? 1 : 0)
    + (range !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0) + (savedView ? 1 : 0);

  const clearAll = () => { setStatuses([]); setPayment('all'); setService('all'); setRange('all'); setQ(''); setSavedView(null); };

  const applyView = (id) => {
    if (!id || savedView === id) { clearAll(); return; }
    const v = VIEWS.find((x) => x.id === id);
    setStatuses(v.filters.statuses);
    setPayment(v.filters.payment);
    setRange(v.filters.range);
    setService('all');
    setQ('');
    setSavedView(id);
  };

  const act = (booking, action) => {
    const next = { confirm: 'confirmed', complete: 'completed', no_show: 'no_show', cancel: 'cancelled' }[action];
    if (next) {
      setRows((rs) => rs.map((r) => (r.id === booking.id ? { ...r, status: next } : r)));
      toast.success(`${booking.guest_name} · ${next.replace('_', '-')}`);
      setOpenId(null);
    } else {
      toast.success('Reschedule request sent to the guest');
      setOpenId(null);
    }
  };

  const bulk = (action) => {
    const n = picked.length;
    if (action === 'remind') toast.success(`Reminder sent for ${n} ${n === 1 ? 'booking' : 'bookings'}`);
    else if (action === 'export') toast.success(`${n} rows exported to CSV`);
    else {
      const next = { confirm: 'confirmed', complete: 'completed', cancel: 'cancelled' }[action];
      setRows((rs) => rs.map((r) => (picked.includes(r.id) ? { ...r, status: next } : r)));
      toast.success(`${n} ${n === 1 ? 'booking' : 'bookings'} · ${next}`);
    }
    setPicked([]);
  };

  const weekStart = startOfWeek(anchor);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, items: filtered.filter((b) => sameDay(new Date(b.scheduled_at), date)).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)) };
  }), [weekStart, filtered]);

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const grid = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(grid, i);
      return { date, inMonth: date.getMonth() === anchor.getMonth(), items: filtered.filter((b) => sameDay(new Date(b.scheduled_at), date)) };
    });
  }, [anchor, filtered]);

  const openBooking = rows.find((b) => b.id === openId) || null;
  // Holds the booking on screen while the drawer animates out.
  const drawerBooking = useLast(openBooking);
  const allPicked = filtered.length > 0 && picked.length === filtered.length;

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Bookings</h1>
          {/* The live count belongs on the table it counts — repeating it
              here just gave two numbers that could disagree mid-filter. */}
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">
            {counts.upcoming} upcoming · {inr(rows.filter((b) => b.payment_status === 'paid').reduce((n, b) => n + b.amount, 0), { compact: true })} collected
            {counts.pending > 0 && <span className="text-warning-fg"> · {counts.pending} waiting on you</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Add booking
        </Button>
      </header>

      {/* One row. The value of an applied filter lives in its own button, so
          there is no chip row underneath repeating it back. */}
      <FilterBar
        search={{ value: q, onChange: (v) => { setQ(v); setSavedView(null); }, placeholder: 'Name, email, service or MT-ref' }}
        activeCount={activeCount}
        onClearAll={clearAll}
        trailing={(
          <>
            <Filter
              label="Sort"
              icon={ArrowDownUp}
              value={sort}
              empty="date_desc"
              align="right"
              width="w-44"
              onChange={setSort}
              options={[
                { value: 'date_desc', label: 'Newest first' },
                { value: 'date_asc', label: 'Oldest first' },
                { value: 'amount_desc', label: 'Highest value' },
                { value: 'name_asc', label: 'Client A-Z' },
              ]}
            />
            <ViewSwitch
              value={mode}
              options={[
                { value: 'list', label: 'List', icon: List, to: '/host-lab/bookings/list' },
                { value: 'week', label: 'Week', icon: CalendarDays, to: '/host-lab/bookings/week' },
                { value: 'month', label: 'Month', icon: CalendarRange, to: '/host-lab/bookings/month' },
              ]}
            />
          </>
        )}
      >
        <Filter
          label="View"
          value={savedView}
          empty={null}
          width="w-52"
          onChange={(v) => applyView(v)}
          options={VIEWS.map((v) => ({
            value: v.id,
            label: v.label,
            count: v.id === 'needs' ? counts.pending : v.id === 'unpaid' ? counts.unpaid : v.id === 'noshow' ? counts.no_show : undefined,
          }))}
        />
        <Filter
          label="Status"
          multi
          value={statuses}
          width="w-56"
          onChange={(v) => { setStatuses(v); setSavedView(null); }}
          options={STATUSES.map((x) => ({ ...x, count: counts[x.value] }))}
        />
        <Filter
          label="Payment"
          value={payment}
          width="w-40"
          onChange={(v) => { setPayment(v); setSavedView(null); }}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid', count: counts.unpaid },
            { value: 'refunded', label: 'Refunded' },
          ]}
        />
        <Filter
          label="Service"
          value={service}
          width="w-56"
          onChange={(v) => { setService(v); setSavedView(null); }}
          options={[{ value: 'all', label: 'All services' }, ...mock.services.map((x) => ({ value: x.id, label: x.title }))]}
        />
        <Filter
          label="When"
          value={range}
          width="w-44"
          onChange={(v) => { setRange(v); setSavedView(null); }}
          options={RANGES}
        />
      </FilterBar>

      {/* Bulk bar */}
      {picked.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-maroon bg-maroon px-2.5 py-1.5 text-white">
          <span className="text-[11.5px] font-bold">{picked.length} selected</span>
          <button type="button" onClick={() => setPicked([])} className="text-[10.5px] font-semibold text-white/70 underline">Clear</button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {[['confirm', 'Confirm'], ['complete', 'Mark done'], ['remind', 'Send reminder'], ['export', 'Export'], ['cancel', 'Cancel']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => bulk(k)}
                className={cn('rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition', k === 'cancel' ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white text-maroon hover:bg-pink-100')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <Panel
          flush
          title={`${filtered.length} of ${rows.length} bookings`}
          action={(
            <button
              type="button"
              onClick={() => toast.success(`${filtered.length} rows exported to CSV`)}
              className="inline-flex h-7 items-center gap-1 rounded-sm border-2 border-neutral-200 px-2 text-[11px] font-bold text-ink/65 transition hover:border-maroon/40 hover:text-maroon"
            >
              <Download className="h-3 w-3" strokeWidth={2.6} /> Export
            </button>
          )}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-2.5 py-14 text-center">
              <CalendarX2 className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
              <p className="text-[12px] font-bold text-ink">{rows.length === 0 ? 'No bookings yet' : 'Nothing matches those filters'}</p>
              <p className="max-w-sm text-[11px] font-medium text-ink/55">
                {rows.length === 0 ? 'They appear here the moment someone books you.' : 'Loosen a filter, or clear them all.'}
              </p>
              {activeFilters.length > 0 && <Button size="sm" variant="outline" className="mt-1" onClick={clearAll}>Clear filters</Button>}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b-2 border-neutral-200 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                      <th scope="col" className="w-8 px-3 py-2">
                        <CheckBox
                          checked={allPicked}
                          onChange={() => setPicked(allPicked ? [] : filtered.map((b) => b.id))}
                          label="Select all shown"
                        />
                      </th>
                      {['When', 'Client', 'Service', 'Status', 'Payment', 'Value'].map((h) => (
                        <th key={h} scope="col" className={cn('px-3 py-2 font-bold', h === 'Value' ? 'text-right' : 'text-left')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-neutral-200">
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setOpenId(b.id)}
                        className={cn('cursor-pointer transition-colors hover:bg-cream', picked.includes(b.id) && 'bg-blush/60')}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <CheckBox
                            checked={picked.includes(b.id)}
                            onChange={() => setPicked((p) => (p.includes(b.id) ? p.filter((x) => x !== b.id) : [...p, b.id]))}
                            label={`Select ${b.guest_name}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-bold text-ink">{fmtDayFull(b.scheduled_at)}</p>
                          <p className="text-[10.5px] font-medium text-ink/45">{fmtTime(b.scheduled_at)} · {relDay(b.scheduled_at)}</p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={b.guest_name} size="h-6 w-6 text-[9.5px]" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ink">{b.guest_name}</span>
                              <span className="block max-w-[150px] truncate text-[10.5px] text-ink/45">{b.guest_email}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <p className="max-w-[170px] truncate font-medium text-ink/75">{b.services.title}</p>
                          <p className="text-[10.5px] text-ink/45">{b.services.duration} min</p>
                        </td>
                        <td className="px-3 py-2"><StatusPill status={b.status} /></td>
                        <td className="px-3 py-2"><StatusPill status={b.payment_status} /></td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{b.amount ? inr(b.amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone: rows become cards */}
              <ul className="divide-y-2 divide-neutral-200 md:hidden">
                {filtered.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
                      <Avatar name={b.guest_name} size="h-8 w-8 text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name}</span>
                        <span className="block truncate text-[10.5px] font-medium text-ink/55">{b.services.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusPill status={b.status} />
                          {b.amount > 0 && <StatusPill status={b.payment_status} />}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[10.5px] font-bold text-maroon">{fmtTime(b.scheduled_at)}</span>
                        <span className="block text-[10px] font-medium text-ink/45">{fmtDayFull(b.scheduled_at)}</span>
                        {b.amount > 0 && <span className="mt-0.5 block text-[10.5px] font-bold text-ink">{inr(b.amount)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      {/* ── CALENDAR ── */}
      {(mode === 'week' || mode === 'month') && (
        <Panel
          flush
          title={mode === 'month'
            ? anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
            : `${weekDays[0].date.getDate()} – ${weekDays[6].date.getDate()} ${weekDays[6].date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
          action={(
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>Today</Button>
              <div className="flex gap-1">
                <button type="button" aria-label="Previous" onClick={() => setAnchor((a) => (mode === 'month' ? new Date(a.getFullYear(), a.getMonth() - 1, 1) : addDays(a, -7)))} className="grid h-6 w-6 place-items-center rounded-full border-2 border-neutral-200 text-ink/55 hover:border-maroon/40">‹</button>
                <button type="button" aria-label="Next" onClick={() => setAnchor((a) => (mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : addDays(a, 7)))} className="grid h-6 w-6 place-items-center rounded-full border-2 border-neutral-200 text-ink/55 hover:border-maroon/40">›</button>
              </div>
            </div>
          )}
        >
          {mode === 'week' ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[840px] grid-cols-7">
                {weekDays.map(({ date, items }, i) => {
                  const today = sameDay(date, new Date());
                  const open = mock.availability.weekly_schedule[date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()]?.length > 0;
                  return (
                    <div key={i} className={cn('flex min-h-[212px] flex-col border-r-2 border-neutral-200 last:border-r-0', today && 'bg-blush/40')}>
                      <div className="border-b-2 border-neutral-200 px-2 py-1.5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{DAYS[i]}</p>
                        <p className={cn('font-display text-[14px] font-extrabold leading-none', today ? 'text-maroon' : 'text-ink')}>{date.getDate()}</p>
                        {!open && <p className="mt-0.5 text-[9px] font-bold uppercase text-ink/30">Closed</p>}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                        {items.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setOpenId(b.id)}
                            className="rounded-lg border-2 border-neutral-200 bg-white p-1.5 text-left transition hover:-translate-y-0.5 hover:border-maroon/40"
                          >
                            <span className="flex items-center gap-1">
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', b.status === 'pending' ? 'bg-warning-fg' : b.status === 'no_show' ? 'bg-error-fg' : b.status === 'completed' ? 'bg-success-fg' : 'bg-pink')} />
                              <span className="text-[10px] font-bold text-maroon">{fmtTime(b.scheduled_at)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[10.5px] font-bold text-ink">{b.guest_name}</span>
                            <span className="block truncate text-[9.5px] font-medium text-ink/50">{b.services.title}</span>
                          </button>
                        ))}
                        {items.length === 0 && open && (
                          <span className="mt-2 block rounded-lg border-2 border-dashed border-marigold-300 bg-marigold-100/50 py-1.5 text-center text-[9.5px] font-bold text-marigold-800">
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 border-b-2 border-neutral-200 bg-cream">
                {DAYS.map((d) => <span key={d} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-ink/45">{d}</span>)}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map(({ date, inMonth, items }, i) => (
                  <div key={i} className={cn('min-h-[64px] border-b-2 border-r-2 border-neutral-200 p-1', !inMonth && 'bg-cream/70', sameDay(date, new Date()) && 'bg-blush/40')}>
                    <p className={cn('px-0.5 text-[10px] font-bold', sameDay(date, new Date()) ? 'text-maroon' : inMonth ? 'text-ink/60' : 'text-ink/25')}>{date.getDate()}</p>
                    <div className="mt-0.5 space-y-0.5">
                      {items.slice(0, 2).map((b) => (
                        <button key={b.id} type="button" onClick={() => setOpenId(b.id)} className="block w-full truncate rounded border-2 border-neutral-200 bg-white px-1 py-0.5 text-left text-[9px] font-bold text-ink hover:border-maroon/40">
                          {fmtTime(b.scheduled_at)} {b.guest_name.split(' ')[0]}
                        </button>
                      ))}
                      {items.length > 2 && (
                        <button
                          type="button"
                          onClick={() => { setAnchor(date); setCalView('week'); }}
                          className="px-1 text-[9px] font-bold text-maroon underline"
                        >
                          +{items.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      <BookingDrawer
        open={!!openBooking}
        booking={drawerBooking}
        onClose={() => { setOpenId(null); setParams({}, { replace: true }); }}
        onAction={act}
      />
      <AddBooking open={adding} onClose={() => { setAdding(false); setParams({}, { replace: true }); }} />
    </div>
  );
};

export default Bookings;
