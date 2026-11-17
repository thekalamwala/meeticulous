// Money — earnings, payouts, transactions and invoices, each its own page
// under one rail item. They were four separate rail entries; they are four
// routes now, because they are four views of one subject rather than one list
// filtered four ways.
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
  FileText, Info, Receipt, ShieldCheck, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  BarChart, Drawer, Panel, RankedBars, StatusPill, Tile,
  SubPageHeader, fmtDayFull, inr, relDay, useSubPage,
} from '../labUi';
import { Filter, FilterBar } from '../filters';
import mock from '../mockData';

const PERIODS = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' },
];

// A window, and the equivalent window before it, so every figure on this page
// can answer "up or down" rather than just "how much". Where there is not
// enough history to compare like with like (year to date, all time) it falls
// back to the latest month against the one before, and says so.
const MONTHS = { '30d': 1, '90d': 3, ytd: 11 };

const windowFor = (period) => {
  const all = mock.revenueByMonth;
  const n = MONTHS[period];
  // Enough history for a like-for-like window: compare it with the one before.
  if (n && all.length >= n * 2) {
    const cur = all.slice(-n);
    return {
      cur,
      cmpCur: cur,
      cmpPrev: all.slice(-n * 2, -n),
      label: `vs previous ${period === '30d' ? '30 days' : '90 days'}`,
    };
  }
  // Not enough (year to date, all time): the window has no predecessor, so the
  // comparison is the latest month against the one before — and says so. The
  // tile still SHOWS the whole window; only the delta is month-on-month.
  const cur = n ? all.slice(-n) : all;
  const [a, b] = [all.at(-2), all.at(-1)];
  return { cur, cmpCur: [b], cmpPrev: [a], label: `${b.month} vs ${a.month}` };
};

const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
const growth = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null);

/* ── Earnings ──────────────────────────────────────────────────────────── */
const Earnings = () => {
  const [period, setPeriod] = useState('all');
  const { cur, cmpCur, cmpPrev, label } = windowFor(period);

  const total = sum(cur, 'revenue');
  const count = sum(cur, 'bookings');
  const avg = count ? Math.round(total / count) : 0;

  // Deltas come from the comparison pair, which is not always the window.
  const avgOf = (rows) => (sum(rows, 'bookings') ? Math.round(sum(rows, 'revenue') / sum(rows, 'bookings')) : 0);
  const dTotal = growth(sum(cmpCur, 'revenue'), sum(cmpPrev, 'revenue'));
  const dCount = growth(sum(cmpCur, 'bookings'), sum(cmpPrev, 'bookings'));
  const dAvg = growth(avgOf(cmpCur), avgOf(cmpPrev));

  const thisM = mock.revenueByMonth.at(-1);

  const byService = useMemo(
    () => [...mock.services, ...mock.products, ...mock.courses]
      .filter((s) => s.revenue_30d > 0)
      .map((s) => ({ label: s.title, revenue: s.revenue_30d }))
      .sort((a, b) => b.revenue - a.revenue),
    [],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <FilterBar
        trailing={(
          <Button size="sm" variant="outline" onClick={() => toast.success('Earnings report exported to CSV')}>
            <Download className="h-3.5 w-3.5" strokeWidth={2.4} /> Export
          </Button>
        )}
      >
        <Filter label="Period" value={period} empty="all" width="w-44" onChange={setPeriod} options={PERIODS} />
      </FilterBar>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Earned" value={inr(total, { compact: true })} delta={dTotal} deltaLabel={label} />
        <Tile label="Bookings paid" value={count} delta={dCount} deltaLabel={label} />
        <Tile label="Average booking" value={inr(avg)} delta={dAvg} deltaLabel={label} />
        {/* Summed, not asserted. This tile was a hardcoded ₹0 beside a
            Transactions page that added up ₹3.3k of fees on the same bookings. */}
        <Tile
          label="Platform fees paid"
          value={inr(mock.bookings.reduce((n, b) => n + b.platform_fee, 0), { compact: true })}
          hint={mock.COMMISSION_RATE ? `Starter plan · ${mock.COMMISSION_RATE * 100}% commission` : 'Pro plan · 0% commission'}
        />
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
          {/* Not the kit Button. Overriding its colours from the outside is
              how this one broke: `cn` is a plain joiner, so `bg-white` beat
              `bg-maroon` while `text-white` beat `text-maroon`, and the page's
              primary action rendered as white text on a white pill — invisible,
              on the button that moves money. A tile with its own background
              styles its own button. */}
          <button
            type="button"
            onClick={() => setWithdrawing(true)}
            className="mt-2.5 inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] font-bold text-maroon transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
          >
            <ArrowDownToLine className="h-4 w-4" strokeWidth={2.4} /> Withdraw now
          </button>
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

      {/* A drawer, like every other side surface here. The lab dropped the kit
          Modal; this was the last one left. Withdrawing is irreversible, so it
          still asks — it just asks from the side, with the arithmetic in view. */}
      <Drawer
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title="Withdraw your balance"
        subtitle={`${inr(available)} to ${bank.label}`}
        width="sm:w-[380px]"
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
        <div className="mt-3 flex gap-1.5">
          <Button
            size="sm"
            onClick={() => { toast.success(`${inr(available)} on its way to ${bank.label}`); setWithdrawing(false); }}
          >
            Withdraw {inr(available)}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWithdrawing(false)}>Cancel</Button>
        </div>
      </Drawer>
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

  // Only paid rows count. Summing every row put unpaid bookings into "Net to
  // you", which is money that has not arrived — the one number on this page a
  // host would act on. What is outstanding is said separately, as what it is.
  const settled = rows.filter((b) => b.payment_status === 'paid');
  const gross = settled.reduce((n, b) => n + b.amount, 0);
  const fees = settled.reduce((n, b) => n + b.platform_fee, 0);
  const owed = rows.filter((b) => b.payment_status === 'unpaid');
  const outstanding = owed.reduce((n, b) => n + b.amount, 0);
  // On Pro there is no commission, so Fee is empty on every row and Net is
  // Gross again. Two columns of nothing. A Starter host gets both back.
  const charged = mock.COMMISSION_RATE > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Gross collected" value={inr(gross, { compact: true })} hint={`${settled.length} paid`} />
        <Tile
          label="Platform fees"
          value={inr(fees, { compact: true })}
          hint={mock.COMMISSION_RATE ? `${mock.COMMISSION_RATE * 100}% of each sale` : 'Pro pays no commission'}
        />
        {charged ? (
          <Tile
            label="Net to you"
            value={inr(gross - fees, { compact: true })}
            hint={owed.length ? `${inr(outstanding, { compact: true })} still unpaid, not counted` : 'Everything shown is settled'}
          />
        ) : (
          /* With no commission, "net" would just be "gross" a second time.
             What is still owed is the fact worth the space. */
          <Tile
            label="Awaiting payment"
            value={inr(outstanding, { compact: true })}
            hint={owed.length ? `${owed.length} booking${owed.length > 1 ? 's' : ''} unpaid` : 'Nothing outstanding'}
          />
        )}
      </div>

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: 'Client, service or MT-ref' }}
        activeCount={(status !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0)}
        onClearAll={() => { setStatus('all'); setQ(''); }}
        trailing={(
          <Button size="sm" variant="outline" onClick={() => toast.success(`${rows.length} transactions exported`)}>
            <Download className="h-3.5 w-3.5" strokeWidth={2.4} /> Export
          </Button>
        )}
      >
        <Filter
          label="Status"
          value={status}
          width="w-40"
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'refunded', label: 'Refunded' },
          ]}
        />
      </FilterBar>

      <Panel flush>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b-2 border-neutral-200 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                {['Date', 'Ref', 'Client', 'Service', 'Status', 'Gross', ...(charged ? ['Fee', 'Net'] : [])].map((h) => (
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
                  {/* Paid is the ordinary outcome, so it wears no pill — with one
                      on every row the two that matter stopped standing out. And
                      an unpaid row has no net yet: printing one in confident
                      maroon read as money received. */}
                  <td className="px-3 py-2">
                    {b.payment_status === 'paid'
                      ? <span className="text-[10.5px] font-medium text-ink/40">Paid</span>
                      : <StatusPill status={b.payment_status} />}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{inr(b.amount)}</td>
                  {charged && (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-ink/55">{b.platform_fee ? `−${inr(b.platform_fee)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-maroon">
                        {b.payment_status === 'paid' ? inr(b.amount - b.platform_fee) : <span className="font-medium text-ink/30">—</span>}
                      </td>
                    </>
                  )}
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
                <span className="block text-[10px] font-medium text-ink/45">
                  {b.payment_status !== 'paid' ? 'not paid yet' : charged ? `net ${inr(b.amount - b.platform_fee)}` : 'paid'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="py-10 text-center text-[11.5px] font-semibold text-ink/45">No transactions match.</p>}
      </Panel>

      <p className="flex items-start gap-1.5 rounded-xl border-2 border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/60">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" strokeWidth={2.2} />
        Refunds are not automatic. Cancelling a paid booking tells the guest but does not return the money — you issue the refund from the row here.
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

    {/* The gap is real and worth recording, but it was an empty panel with a
        button that did nothing. One line states it. */}
    <p className="flex items-start gap-1.5 rounded-lg border-2 border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/60">
      <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-ink/35" strokeWidth={2.2} />
      The invoices your guests received are not listed anywhere yet. Hosts who file GST ask for them every quarter — P1 in the roadmap.
    </p>
  </div>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const Money = () => {
  const page = useSubPage('money');

  return (
    <div className="flex flex-col gap-2.5">
      <SubPageHeader
        page={page}
        action={(
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1.5 text-[10.5px] font-bold text-success-fg">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.4} /> {inr(mock.payouts.available)} ready · next payout {relDay(mock.payouts.next_payout_on).toLowerCase()}
          </span>
        )}
      />

      {page.slug === 'earnings' && <Earnings />}
      {page.slug === 'payouts' && <Payouts />}
      {page.slug === 'transactions' && <Transactions />}
      {page.slug === 'invoices' && <Invoices />}
    </div>
  );
};

export default Money;
