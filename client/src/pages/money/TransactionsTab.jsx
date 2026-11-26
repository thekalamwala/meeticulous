// Money › Transactions (Kept). Same data and controls as the old Transactions page —
// getTransactions (the host's PAID bookings) with search, date, status and sort
// filters, a CSV export and a per-payment detail — laid out as Kept rows. A phone
// gets the filters in a bottom sheet of settings-style choices instead of dropdowns.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTransactions } from '../../services/api';
import MeetDropdown from '../../components/ui/MeetDropdown';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { Panel, cn, fmtDay, fmtTime } from '../../components/dashboard/ui/v2';
import { byMonth, payoutState } from './moneyModel';
import { MoneyEmpty, PaymentDetail, PaymentRow, ring, tappable } from './MoneyV2';
import { Sheet } from './Sheet';

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 500;

const DATES = [
  { value: 'month', label: 'This month' }, { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '', label: 'All time' },
];
const STATUSES = [
  { value: '', label: 'Any status' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Done' }, { value: 'cancelled', label: 'Cancelled' },
];
const SORTS = [{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }];

// A date preset → the API's ISO `dateFrom` (undefined = all time). Exported for tests.
export const dateFromFor = (preset, now = new Date()) => {
  if (!preset) return undefined;
  const d = new Date(now);
  if (preset === 'today') d.setHours(0, 0, 0, 0);
  else if (preset === '7d') d.setDate(d.getDate() - 7);
  else if (preset === '30d') d.setDate(d.getDate() - 30);
  else if (preset === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
  return d.toISOString();
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Same columns as the old export; the status column is the payout state in words.
export const toCsv = (rows, { verified }) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Date', 'Time', 'Customer', 'Email', 'Service', 'Type', 'Amount', 'Earnings', 'Payment Method', 'Status'];
  const lines = rows.map((tx) => {
    const d = tx.scheduled_at || tx.created_at;
    return [fmtDate(d), d ? fmtTime(d) : '', tx.guest_name || 'Guest', tx.guest_email || '', tx.services?.title || '', 'Booking',
      tx.services?.price ?? '', tx.vendor_amount ?? '', tx.razorpay_payment_id ? 'Razorpay' : '',
      payoutState(tx, { verified })?.word || 'Paid'].map(esc).join(',');
  });
  return [head.map(esc).join(','), ...lines].join('\n');
};

// Settings-style single choice for the phone filter sheet: full-width 52px rows,
// a check on the chosen one.
const Choice = ({ legend, options, value, onChange }) => (
  <fieldset className="mb-4 overflow-hidden rounded-[20px] bg-white">
    <legend className="sr-only">{legend}</legend>
    <p className="mb-0 px-4 pb-1 pt-3 text-[13px] font-semibold text-faint">{legend}</p>
    {options.map((o, i) => (
      <label key={o.value} className={cn('flex min-h-[52px] cursor-pointer items-center gap-3 px-4 text-[14px] text-ink active:bg-pink-100', tappable, i > 0 && 'border-t border-neutral-200')}>
        <input type="radio" name={legend} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
        <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full border-2 border-neutral-300 peer-checked:border-maroon peer-checked:bg-maroon peer-focus-visible:ring-[3px] peer-focus-visible:ring-rose">
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
      </label>
    ))}
  </fieldset>
);

const btn = cn('inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition-colors disabled:opacity-50', tappable, ring);

export default function TransactionsTab({ verified }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('month');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('desc');
  const [state, setState] = useState('loading'); // loading | ready | more | error
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(null);
  const [filters, setFilters] = useState(false);
  const [nonce, setNonce] = useState(0); // bumps to retry after an error

  const params = useCallback((o = {}) => ({ page, limit: PAGE_SIZE, search, status, sort, dateFrom: dateFromFor(dateRange), ...o }),
    [page, search, status, sort, dateRange]);

  // Page 1 replaces the list; later pages append (Load more).
  useEffect(() => {
    let alive = true;
    setState(page === 1 ? 'loading' : 'more');
    getTransactions(params())
      .then(({ data }) => {
        if (!alive) return;
        setRows((prev) => (page === 1 ? data?.data || [] : [...prev, ...(data?.data || [])]));
        setTotal(data?.total || 0);
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [params, page, nonce]);

  const onFilter = (setter) => (v) => { setter(v); setPage(1); };
  const retry = () => { setPage(1); setNonce((n) => n + 1); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await getTransactions(params({ page: 1, limit: EXPORT_LIMIT }));
      const list = data?.data || [];
      if (!list.length) { toast.error('No transactions to export.'); return; }
      const url = URL.createObjectURL(new Blob([toCsv(list, { verified })], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${list.length} transactions`);
    } catch {
      toast.error("Couldn't export transactions.");
    } finally {
      setExporting(false);
    }
  };

  const months = useMemo(() => byMonth(rows, (tx) => tx.scheduled_at || tx.created_at), [rows]);
  const filtered = !!search || !!status || dateRange !== 'month';
  const extra = [status, sort !== 'desc'].filter(Boolean).length;
  const close = useCallback(() => setOpen(null), []);

  const exportBtn = (
    <button type="button" onClick={exportCsv} disabled={exporting || state === 'loading'} className={cn(btn, 'bg-white text-maroon hover:bg-pink-50')}>
      <Download className="h-4 w-4" strokeWidth={2.2} />{exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Toolbar: search everywhere; dropdowns on desktop, a filter sheet on a phone. */}
      <div className="flex items-center gap-2 lg:gap-3">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search transactions</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-faint" strokeWidth={2} />
          <input type="search" value={search} onChange={(e) => onFilter(setSearch)(e.target.value)} placeholder="Search guests"
            className="h-12 w-full rounded-[16px] border-2 border-transparent bg-white pl-11 pr-4 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-maroon" />
        </label>
        <div className="hidden items-center gap-2 lg:flex">
          <div className="w-[160px]"><MeetDropdown size="sm" value={dateRange} onChange={onFilter(setDateRange)} options={DATES} ariaLabel="Date" /></div>
          <div className="w-[160px]"><MeetDropdown size="sm" value={status} onChange={onFilter(setStatus)} options={STATUSES} ariaLabel="Booking status" /></div>
          <div className="w-[150px]"><MeetDropdown size="sm" value={sort} onChange={onFilter(setSort)} options={SORTS} ariaLabel="Sort" /></div>
          {exportBtn}
        </div>
        <button type="button" onClick={() => setFilters(true)} className={cn(btn, 'bg-white text-ink hover:bg-pink-50 lg:hidden')}>
          <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
          {DATES.find((d) => d.value === dateRange)?.label}{extra ? ` · +${extra}` : ''}
        </button>
      </div>

      {state === 'error' && (
        <Panel><ErrorState title="We couldn't load your transactions." message="Your money is safe. This is a problem showing it." onRetry={retry} /></Panel>
      )}
      {state === 'loading' && <Skeleton className="h-[420px] rounded-[24px]" />}
      {(state === 'ready' || state === 'more') && rows.length === 0 && (
        <Panel>
          {filtered
            ? <MoneyEmpty title="Nothing matches" action={(
              <button type="button" onClick={() => { setSearch(''); setStatus(''); setDateRange(''); setPage(1); }} className={cn(btn, 'mt-4 bg-maroon text-white hover:bg-maroon-dark')}>Show all time</button>
            )}>No payments match these filters{search ? ` and “${search}”` : ''}.</MoneyEmpty>
            : <MoneyEmpty title="No payments yet">Every booking a guest pays for shows up here, with what you get from it.</MoneyEmpty>}
        </Panel>
      )}
      {(state === 'ready' || state === 'more') && rows.length > 0 && (
        <Panel flush title={`${total.toLocaleString('en-IN')} ${total === 1 ? 'payment' : 'payments'}`} subtitle="What each guest paid and what you get from it" bodyClassName="pb-2">
          {months.map((m) => (
            <section key={m.label} aria-label={m.label}>
              <h3 className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-10 mb-0 bg-white/95 px-4 py-2 text-[13px] font-semibold text-faint backdrop-blur-sm sm:px-5">{m.label}</h3>
              <ul>{m.items.map((tx, i) => (
                <PaymentRow key={tx.id} tx={tx} first={i === 0} onOpen={setOpen}
                  meta={`${payoutState(tx, { verified })?.word || 'Paid'} · ${fmtDay(tx.scheduled_at || tx.created_at)} · ${tx.services?.title || 'Booking'}`} />
              ))}</ul>
            </section>
          ))}
          {rows.length < total && (
            <div className="px-4 pb-3 pt-2 sm:px-5">
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={state === 'more'} className={cn(btn, 'w-full bg-cream text-maroon hover:bg-pink-50')}>
                {state === 'more' ? 'Loading…' : `Show more · ${total - rows.length} left`}
              </button>
            </div>
          )}
        </Panel>
      )}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filter payments" bodyClassName="bg-cream pt-1"
        footer={(
          <div className="flex gap-2">
            {exportBtn}
            <button type="button" onClick={() => setFilters(false)} className={cn(btn, 'flex-1 bg-maroon text-white hover:bg-maroon-dark')}>Show {total.toLocaleString('en-IN')}</button>
          </div>
        )}>
        <Choice legend="When" options={DATES} value={dateRange} onChange={onFilter(setDateRange)} />
        <Choice legend="Booking status" options={STATUSES} value={status} onChange={onFilter(setStatus)} />
        <Choice legend="Order" options={SORTS} value={sort} onChange={onFilter(setSort)} />
      </Sheet>

      <Sheet open={!!open} onClose={close} title="Payment" bodyClassName="bg-cream">
        {open && <PaymentDetail tx={open} verified={verified} />}
      </Sheet>
    </div>
  );
}
