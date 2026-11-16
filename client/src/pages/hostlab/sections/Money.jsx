// Money — earnings, payouts, transactions and invoices as four tabs of one
// destination instead of four rail items.
//
// Kept: the period selector, the trend chart, the automatic Razorpay-Route
// settlement states, the host-as-buyer invoice list, the free-plan commission
// meter. Added: revenue by service (so "what earns" is answerable), a payout
// that states when the money actually lands and why part of it is held, fee
// transparency per transaction, and a withdraw flow that shows the arithmetic
// before it is confirmed.
import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, Banknote, Building2, Clock, Download,
  FileText, Info, Receipt, Search, ShieldCheck, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal, Tabs, cn } from '../../../components/dashboard/ui';
import {
  BarChart, Chip, Dropdown, Panel, RankedBars, StatusPill, Tile,
  fmtDayFull, inr, relDay, useUrlTab,
} from '../labUi';
import mock from '../mockData';

const PERIODS = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const monthsFor = (period) => {
  const all = mock.revenueByMonth;
  if (period === '30d') return all.slice(-2);
  if (period === '90d') return all.slice(-3);
  if (period === 'ytd') return all.slice(-11);
  return all;
};

/* ── Earnings ──────────────────────────────────────────────────────────── */
const Earnings = () => {
  const [period, setPeriod] = useState('all');
  const months = monthsFor(period);
  const total = months.reduce((n, m) => n + m.revenue, 0);
  const count = months.reduce((n, m) => n + m.bookings, 0);
  const avg = count ? Math.round(total / count) : 0;
  const thisM = mock.revenueByMonth.at(-1);
  const lastM = mock.revenueByMonth.at(-2);
  const delta = Math.round(((thisM.revenue - lastM.revenue) / lastM.revenue) * 100);

  const byService = useMemo(
    () => [...mock.services, ...mock.products, ...mock.courses]
      .filter((s) => s.revenue_30d > 0)
      .map((s) => ({ label: s.title, revenue: s.revenue_30d }))
      .sort((a, b) => b.revenue - a.revenue),
    [],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Chip key={p.value} active={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</Chip>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success('Earnings report exported to CSV')}>
          <Download className="h-4 w-4" strokeWidth={2.4} /> Export
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Earned" value={inr(total, { compact: true })} delta={delta} deltaLabel="this month vs last" />
        <Tile label="Bookings paid" value={count} />
        <Tile label="Average booking" value={inr(avg)} />
        <Tile label="Platform fees paid" value={inr(0)} hint="Pro plan · 0% commission" />
      </div>

      <Panel title="Revenue by month" subtitle="Every paid booking, product and course">
        <BarChart data={mock.revenueByMonth} />
      </Panel>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Panel title="What earns the most" subtitle="Last 30 days">
          <RankedBars rows={byService} valueKey="revenue" format={(v) => inr(v, { compact: true })} />
        </Panel>
        <Panel title="How your plan pays off" subtitle="Pro, ₹999 a month">
          <ul className="flex flex-col gap-1.5 text-[11.5px]">
            {[
              ['Commission you would owe on Starter (5%)', inr(Math.round(thisM.revenue * 0.05))],
              ['What Pro costs you', inr(999)],
              ['Pro is cheaper by', inr(Math.round(thisM.revenue * 0.05) - 999)],
            ].map(([k, v], i) => (
              <li key={k} className={cn('flex items-baseline justify-between gap-2', i === 2 && 'border-t-2 border-neutral-200 pt-2.5')}>
                <span className={cn('font-medium', i === 2 ? 'font-bold text-ink' : 'text-ink/65')}>{k}</span>
                <span className={cn('shrink-0 font-bold tabular-nums', i === 2 ? 'text-success-fg' : 'text-ink')}>{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] font-medium text-ink/50">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            On a Starter plan this panel is the commission meter instead: how much commission you have paid, and the month it becomes cheaper to upgrade.
          </p>
        </Panel>
      </div>
    </div>
  );
};

/* ── Payouts ───────────────────────────────────────────────────────────── */
const Payouts = () => {
  const [withdrawing, setWithdrawing] = useState(false);
  const { available, clearing, pending_completion: held, bank, history, next_payout_on: next } = mock.payouts;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Tile accent label="Ready to withdraw" value={inr(available)} hint={`Lands in ${bank.label} in about 2 working days`}>
          <Button
            size="sm"
            className="mt-2.5 w-fit bg-white text-maroon hover:bg-pink-100"
            onClick={() => setWithdrawing(true)}
          >
            <ArrowDownToLine className="h-4 w-4" strokeWidth={2.4} /> Withdraw now
          </Button>
        </Tile>
        <Tile label="Clearing" value={inr(clearing)} hint="Razorpay holds new money briefly before release" />
        <Tile label="Held until the session happens" value={inr(held)} hint="Released when you mark the booking done" />
      </div>

      <Panel
        title="Bank account"
        subtitle="Where every payout lands"
        action={<Button size="sm" variant="outline" onClick={() => toast.success('Opens the bank-details form')}>Change</Button>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success-bg text-success-fg">
            <Building2 className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-ink">{bank.label}</p>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-fg">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} /> Verified · payouts enabled
            </p>
          </div>
          <p className="ml-auto text-[11px] font-medium text-ink/55">Next automatic payout {relDay(next).toLowerCase()}</p>
        </div>
      </Panel>

      <Panel title="Payout history" flush>
        <ul className="divide-y-2 divide-neutral-200">
          {history.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cream text-maroon">
                <Banknote className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-ink">{inr(p.amount)}</span>
                <span className="block text-[11px] font-medium text-ink/55">
                  Requested {fmtDayFull(p.requested_at)}
                  {p.settled_at ? ` · settled ${fmtDayFull(p.settled_at)}` : ' · on its way'}
                  {p.utr && <span className="ml-1 font-mono text-[10.5px] text-ink/45">UTR {p.utr}</span>}
                </span>
              </span>
              <StatusPill status={p.status} />
            </li>
          ))}
        </ul>
      </Panel>

      <Modal
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title="Withdraw your balance"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setWithdrawing(false)}>Cancel</Button>
            <Button onClick={() => { toast.success(`${inr(available)} on its way to ${mock.payouts.bank.label}`); setWithdrawing(false); }}>
              Withdraw {inr(available)}
            </Button>
          </>
        )}
      >
        <ul className="flex flex-col gap-1.5 text-[11.5px]">
          {[
            ['Available now', inr(available)],
            ['Goes to', bank.label],
            ['Payout fee', 'None'],
            ['Expected to land', 'In about 2 working days'],
          ].map(([k, v]) => (
            <li key={k} className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink/60">{k}</span>
              <span className="shrink-0 font-bold text-ink">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-cream p-2 text-[10.5px] font-medium text-ink/60">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          {inr(clearing)} is still clearing and {inr(held)} is held until those sessions happen. Both arrive on later payouts automatically.
        </p>
      </Modal>
    </div>
  );
};

/* ── Transactions ──────────────────────────────────────────────────────── */
const Transactions = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mock.bookings
      .filter((b) => b.amount > 0 || b.payment_status === 'refunded')
      .filter((b) => (status === 'all' ? true : b.payment_status === status))
      .filter((b) => (needle ? `${b.guest_name} ${b.ref} ${b.services.title}`.toLowerCase().includes(needle) : true))
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  }, [q, status]);

  const gross = rows.reduce((n, b) => n + b.amount, 0);
  const fees = rows.reduce((n, b) => n + b.platform_fee, 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Gross" value={inr(gross, { compact: true })} />
        <Tile label="Platform fees" value={inr(fees, { compact: true })} />
        <Tile label="Net to you" value={inr(gross - fees, { compact: true })} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-neutral-200 bg-white p-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" strokeWidth={2.2} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Client, service or MT-ref"
            aria-label="Search transactions"
            className="w-full rounded-full border-2 border-neutral-200 bg-white py-1.5 pl-9 pr-3 text-[11.5px] font-medium text-ink outline-none transition placeholder:text-ink/35 focus:border-maroon/40 focus-visible:ring-[3px] focus-visible:ring-rose"
          />
        </div>
        <Dropdown
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: 'all', label: 'Any' }, { value: 'paid', label: 'Paid' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'refunded', label: 'Refunded' }]}
          width="w-40"
        />
        <Button size="sm" variant="outline" onClick={() => toast.success(`${rows.length} transactions exported`)}>
          <Download className="h-4 w-4" strokeWidth={2.4} /> Export
        </Button>
      </div>

      <Panel flush>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b-2 border-neutral-200 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                {['Date', 'Ref', 'Client', 'Service', 'Status', 'Gross', 'Fee', 'Net'].map((h) => (
                  <th key={h} scope="col" className={cn('px-3 py-2 font-bold', ['Gross', 'Fee', 'Net'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-neutral-200">
              {rows.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-cream">
                  <td className="px-3 py-2 font-medium text-ink/70">{fmtDayFull(b.scheduled_at)}</td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-ink/55">{b.ref}</td>
                  <td className="px-3 py-2 font-bold text-ink">{b.guest_name}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate font-medium text-ink/70">{b.services.title}</td>
                  <td className="px-3 py-2"><StatusPill status={b.payment_status} /></td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{inr(b.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/55">{b.platform_fee ? `−${inr(b.platform_fee)}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-maroon">{inr(b.amount - b.platform_fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y-2 divide-neutral-200 md:hidden">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name}</span>
                <span className="block truncate text-[10.5px] font-medium text-ink/50">{b.services.title} · {fmtDayFull(b.scheduled_at)}</span>
                <span className="mt-1 block"><StatusPill status={b.payment_status} /></span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[11.5px] font-bold text-ink">{inr(b.amount)}</span>
                <span className="block text-[10px] font-medium text-ink/45">net {inr(b.amount - b.platform_fee)}</span>
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="py-10 text-center text-[11.5px] font-semibold text-ink/45">No transactions match.</p>}
      </Panel>

      <p className="flex items-start gap-1.5 rounded-xl border-2 border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/60">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" strokeWidth={2.2} />
        Refunds are not automatic. Cancelling a paid booking tells the guest but does not return the money — you issue a refund from the row here. That is true today and the prototype keeps it, loudly.
      </p>
    </div>
  );
};

/* ── Invoices ──────────────────────────────────────────────────────────── */
const Invoices = () => (
  <div className="flex flex-col gap-2.5">
    <Panel
      title="Invoices issued to you"
      subtitle="Your plan renewals, and bookings you paid for as a guest"
      action={<Button size="sm" variant="outline" onClick={() => toast.success('All invoices downloaded as a zip')}><Download className="h-4 w-4" strokeWidth={2.4} /> Download all</Button>}
      flush
    >
      <ul className="divide-y-2 divide-neutral-200">
        {mock.invoices.map((inv) => (
          <li key={inv.id} className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cream text-maroon">
              <FileText className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-ink">{inv.invoice_number}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', inv.source_type === 'subscription' ? 'bg-maroon-100 text-maroon-700' : 'bg-success-bg text-success-fg')}>
                  {inv.source_type === 'subscription' ? 'Plan' : 'Booking'}
                </span>
              </span>
              <span className="block text-[10.5px] font-medium text-ink/50">{fmtDayFull(inv.issued_at)}</span>
            </span>
            <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-ink">{inr(inv.total, { decimals: true })}</span>
            <Button size="sm" variant="ghost" onClick={() => toast.success(`${inv.invoice_number} downloaded`)}>Download</Button>
          </li>
        ))}
      </ul>
    </Panel>

    <Panel title="Invoices you issued" subtitle="GST invoices your guests received for their bookings">
      <div className="flex flex-col items-center gap-1.5 py-8 text-center">
        <Receipt className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
        <p className="text-[12px] font-bold text-ink">Not built yet</p>
        <p className="max-w-md text-[11px] font-medium text-ink/55">
          Today a host can see the invoices they received but not the ones their guests got. Hosts who file GST ask for this list every quarter. It is a P1 in the roadmap, not a prototype trick.
        </p>
        <Button size="sm" variant="outline" className="mt-1" onClick={() => toast.success('Noted — you want this')}>Tell us you need it</Button>
      </div>
    </Panel>
  </div>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const Money = () => {
  const [tab, setTab, TABS] = useUrlTab('money');

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Money</h1>
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">
            {inr(mock.payouts.available)} ready · {inr(mock.payouts.clearing + mock.payouts.pending_completion)} on the way
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1.5 text-[10.5px] font-bold text-success-fg">
          <Clock className="h-3.5 w-3.5" strokeWidth={2.4} /> Next payout {relDay(mock.payouts.next_payout_on).toLowerCase()}
        </span>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'earnings' && <Earnings />}
      {tab === 'payouts' && <Payouts />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'invoices' && <Invoices />}
    </div>
  );
};

export default Money;
