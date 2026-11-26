// Money (Kept) — Payouts, Transactions and Invoices & tax as ONE page with tabs
// (founder-approved merge, 2026-11-25). Each tab is still its own URL
// (/dashboard/payments/payouts, /dashboard/payments/transactions, /dashboard/invoices),
// so bookmarks keep working; App.jsx's routes render this with a `tab`.
//
// Balance first (Stripe Balances): the maroon band says what is waiting, ready and in
// transit, in words built from /vendor/payout/balance. When KYC isn't done, the verify
// ask lives HERE, inside the balance, and nowhere else on the page.
// Payouts are automatic (Razorpay Route): there is no Withdraw. The host's money is
// never "held in a wallet" — it is earnings on their way to their bank.
// Presentation only: every figure is one the server already persisted.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, Landmark, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyKyc, getPayoutBalance, getTransactions } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { Avatar, InsightBand, Panel, cn, fmtDay, fmtDayFull, fmtTime, inr } from '../../components/dashboard/ui/v2';
import { balanceBuckets, byMonth, feeLines, payoutState, splitPayouts } from './moneyModel';
import { EASE, Sheet } from './Sheet';

export const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const serif = 'font-serif font-normal italic text-pink';
// Rows used as controls: no long-press callout or text selection on a phone.
export const tappable = 'touch-manipulation select-none [-webkit-touch-callout:none]';

/* ── Data: balance + KYC, cached across tab switches ──────────────────────
 * Each tab is a route, so switching remounts the page. Keep the last answer and
 * show it at once, refreshing behind it, so the band never flashes to a skeleton.
 * ponytail: module cache, no query library — one page reads it. */
let cache = null;
const loadBalance = () => Promise.all([
  getPayoutBalance().then((r) => r.data),
  getMyKyc().then((r) => r.data).catch(() => ({ status: 'not_started' })),
]).then(([balance, kyc]) => { cache = { balance, kyc }; return cache; });

export const useBalance = () => {
  const [state, setState] = useState(() => (cache ? { ...cache, status: 'ready' } : { status: 'loading' }));
  const load = useCallback(() => {
    if (!cache) setState({ status: 'loading' });
    loadBalance().then((c) => setState({ ...c, status: 'ready' })).catch(() => setState((s) => (s.balance ? s : { status: 'error' })));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
};

const kycOf = (kyc) => kyc?.status || 'not_started';
export const isVerified = (kyc) => kycOf(kyc) === 'approved';

/* ── Tabs: one segmented control, full width on a phone ────────────────── */
export const MONEY_TABS = [
  { key: 'payouts', to: '/dashboard/payments/payouts', label: 'Payouts' },
  { key: 'transactions', to: '/dashboard/payments/transactions', label: 'Transactions' },
  { key: 'invoices', to: '/dashboard/invoices', label: 'Invoices & tax' },
];
const MoneyTabs = ({ tab }) => (
  <nav aria-label="Money" className="flex w-full gap-1 rounded-[14px] bg-white p-1 lg:w-fit">
    {MONEY_TABS.map((t) => (
      <NavLink key={t.key} to={t.to} replace aria-current={tab === t.key ? 'page' : undefined}
        className={cn('relative flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-[10px] px-3 text-[13px] font-semibold transition-colors lg:flex-none lg:px-5 lg:text-[14px]',
          tappable, ring, tab === t.key ? 'text-white' : 'text-muted hover:bg-blush hover:text-maroon')}>
        {/* The maroon segment slides between tabs (layoutId survives the route remount). */}
        {tab === t.key && <motion.span layoutId="money-tab" aria-hidden="true" className="absolute inset-0 rounded-[10px] bg-maroon"
          transition={{ duration: 0.26, ease: EASE }} />}
        <span className="relative">{t.label}</span>
      </NavLink>
    ))}
  </nav>
);

/* ── Balance band ─────────────────────────────────────────────────────── */
const bandBtn = cn('inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition-colors', tappable, 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink');
const BandPrimary = ({ children, ...p }) => <button type="button" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')} {...p}>{children}</button>;

// What the band says, from the balance + KYC state. Exported for tests.
export const bandCopy = ({ buckets, kyc }) => {
  const status = kycOf(kyc);
  const total = buckets.total;
  const paid = buckets.paidOut > 0 ? `${inr(buckets.paidOut)} has reached your bank so far.` : null;
  if (status !== 'approved') {
    const verify = status === 'not_started' ? 'verify' : status === 'rejected' ? 'fix' : null;
    const sub = status === 'pending'
      ? "We're checking your details. It goes to your bank as soon as you're verified."
      : status === 'rejected'
        ? `Your verification needs a fix${kyc?.review_note ? `: ${kyc.review_note}` : '.'}`
        : 'Verify your PAN and bank once, and every payment goes straight to your bank.';
    if (!total) return { eyebrow: 'Get ready to be paid', title: ['Your earnings', 'land here'], sub, verify };
    return { eyebrow: 'Your balance', title: [inr(total), 'is waiting for you'], sub, verify };
  }
  if (kyc?.payouts_ready === false) {
    return { eyebrow: 'Almost there', title: [inr(total), 'is on its way'], sub: 'Add your registered address so your payout account can go live.', verify: 'finish' };
  }
  if (!total) {
    return buckets.paidOut
      ? { eyebrow: 'All caught up', title: [inr(buckets.paidOut), 'is in your bank'], sub: 'Nothing is on the way right now. New payments show up here as guests book.' }
      : { eyebrow: 'Your balance', title: ['Your earnings', 'land here'], sub: 'When a guest pays, you see the money here until it reaches your bank.' };
  }
  return { eyebrow: 'Your balance', title: [inr(total), 'is on its way to your bank'], sub: paid || 'It reaches your bank on its own. Nothing for you to do.' };
};

const VERIFY = {
  verify: 'Verify to get paid',
  fix: 'Fix my details',
  finish: 'Finish payout setup',
};

// The three buckets, in the order money moves, as one white card under the band:
// rows on a phone, columns on desktop. A ₹0 bucket says so in a sentence. When KYC
// holds the ready money, "Verify" sits right next to it (the verify ask lives in the
// balance, nowhere else on the page).
const BalanceCells = ({ buckets, verified, verifyLabel, onVerify }) => {
  const cells = [
    { label: 'Waiting', note: 'Until the session is done', none: 'No sessions waiting', value: buckets.waiting },
    { label: 'Ready', note: verified ? 'Goes out on its own' : 'Released once you verify', none: 'Nothing ready right now', value: buckets.ready, verify: !verified && buckets.ready > 0 && verifyLabel },
    { label: 'In transit', note: 'Clearing to your bank', none: 'Nothing in transit', value: buckets.inTransit },
  ];
  return (
    <ul className="grid overflow-hidden rounded-[24px] bg-white lg:grid-cols-3">
      {cells.map((c, i) => (
        <li key={c.label} className={cn('flex min-h-[64px] items-center gap-3 px-4 py-3 sm:px-5 lg:flex-col lg:items-start lg:gap-1.5 lg:py-5',
          i > 0 && 'border-t border-neutral-200 lg:border-l lg:border-t-0')}>
          <span className="min-w-0 flex-1 lg:flex-none">
            <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{c.label}</span>
            <span className="block truncate text-[12.5px] text-muted lg:text-[13.5px]">{c.value > 0 ? c.note : c.none}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 lg:order-first lg:min-h-9">
            {c.value > 0 && <span className="font-display text-[18px] font-extrabold tabular-nums tracking-[-0.03em] text-ink lg:text-[26px]">{inr(c.value, { decimals: c.value % 1 !== 0 })}</span>}
            {/* No figure for an empty bucket — the sentence says it; this keeps the columns level. */}
            {c.value <= 0 && <span className="hidden h-9 lg:block" aria-hidden="true" />}
            {c.verify && (
              <button type="button" onClick={onVerify}
                className={cn('hidden h-9 items-center rounded-[10px] bg-blush px-3 text-[13px] font-semibold text-maroon transition-colors hover:bg-pink-100 lg:inline-flex', tappable, ring)}>
                Verify
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

const BalanceBand = ({ data, onVerify }) => {
  if (data.status === 'loading') {
    return <><Skeleton className="h-[200px] rounded-[28px] sm:rounded-[32px]" /><Skeleton className="h-[120px] rounded-[24px]" /></>;
  }
  if (data.status === 'error') {
    return (
      <InsightBand mascot="orange" compact eyebrow="Your balance" title="We couldn't load your balance."
        sub="Your money is safe. This is a problem showing it." actions={<BandPrimary onClick={data.reload}>Try again</BandPrimary>} />
    );
  }
  const buckets = balanceBuckets(data.balance);
  const c = bandCopy({ buckets, kyc: data.kyc });
  return (
    <section aria-label="Your balance" className="flex flex-col gap-3">
      <InsightBand mascot="orange" compact className="sm:py-6" eyebrow={c.eyebrow}
        title={<>{c.title[0]} <em className={serif}>{c.title[1]}</em></>}
        sub={c.sub}
        // On a phone the verify button is pinned in the thumb zone instead (PinnedAction).
        actions={c.verify ? <span className="hidden lg:contents"><BandPrimary onClick={onVerify}><ShieldCheck className="h-4 w-4" strokeWidth={2.4} />{VERIFY[c.verify]}</BandPrimary></span> : null} />
      {/* Nothing in any bucket: the band already says so, three "nothing" rows would repeat it. */}
      {buckets.total > 0 && <BalanceCells buckets={buckets} verified={isVerified(data.kyc)} verifyLabel={c.verify && VERIFY[c.verify]} onVerify={onVerify} />}
    </section>
  );
};

// The page's main action on a phone: full-width, in the thumb zone, above the tab bar
// and clear of its raised Grow button. Portalled to <body> so it is outside the
// PullToRefresh transform and stays put while the page scrolls.
export const PinnedAction = ({ label, onClick }) => createPortal(
  <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] z-30 px-4 lg:hidden">
    <button type="button" onClick={onClick}
      className={cn('pointer-events-auto flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-maroon text-[15px] font-semibold text-white shadow-[var(--shadow-md)] transition-transform duration-100 active:scale-[0.98] motion-reduce:active:scale-100', tappable, ring)}>
      <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />{label}
    </button>
  </div>,
  document.body,
);

/* ── Rows ─────────────────────────────────────────────────────────────── */
const TONE = {
  ok: 'bg-success-bg text-success-fg',
  move: 'bg-maroon-100 text-maroon-700',
  wait: 'bg-warning-bg text-warning-fg',
  bad: 'bg-error-bg text-error-fg',
};
export const StateBadge = ({ state }) => (state
  ? <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] px-2 py-0.5 text-[12px] font-semibold', TONE[state.tone])}>{state.word}</span>
  : <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] bg-success-bg px-2 py-0.5 text-[12px] font-semibold text-success-fg">Paid</span>);

// One record per row: leading art · title + meta (each truncates on its own line) ·
// trailing value. Full-row tap; the divider is inset to start at the text.
export const Row = ({ lead, title, meta, value, sub, onClick, first }) => (
  <li>
    <button type="button" onClick={onClick}
      className={cn('flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-pink-50 active:bg-pink-100 sm:pl-5', tappable, ring, 'focus-visible:ring-inset')}>
      {lead}
      <span className={cn('flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-3 pr-4 sm:pr-5', !first && 'border-t border-neutral-200')}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{title}</span>
          <span className="block truncate text-[12.5px] text-muted lg:text-[13.5px]">{meta}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-[15px] font-extrabold tabular-nums tracking-[-0.02em] text-ink lg:text-[16px]">{value}</span>
          {sub && <span className="mt-0.5 block">{sub}</span>}
        </span>
      </span>
    </button>
  </li>
);

const money = (v) => inr(v, { decimals: Number(v) % 1 !== 0 });

// A payment's meta line: the state in words, then the when.
const paymentMeta = (tx, state) => {
  const service = tx.services?.title || 'Booking';
  switch (state?.key) {
    case 'waiting': return `${state.word} · ${fmtDay(tx.scheduled_at)} · ${service}`;
    case 'clearing': return `${state.word} · ${tx.transfer_hold_until ? `reaches your bank by ${fmtDay(tx.transfer_hold_until)}` : service}`;
    case 'sent': return `${state.word} · ${fmtDay(tx.transfer_released_at)}`;
    case 'deposited': return `${state.word} · ${fmtDay(tx.transfer_settled_at)}`;
    default: return `${state?.word || 'Paid'} · ${service}`;
  }
};

export const PaymentRow = ({ tx, state, meta, onOpen, first }) => (
  <Row first={first} onClick={() => onOpen(tx)} lead={<Avatar name={tx.guest_name || tx.guest_email} />}
    title={tx.guest_name || 'Guest'} meta={meta || paymentMeta(tx, state)} value={money(tx.vendor_amount)} />
);

/* ── Payment detail (shared with Transactions) ────────────────────────── */
const copy = (text, label) => {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => toast.success(`${label} copied`)).catch(() => {});
};
const Line = ({ label, value, strong, mono, onCopy }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <span className={cn('shrink-0 text-[13.5px]', strong ? 'font-semibold text-ink' : 'text-muted')}>{label}</span>
    {onCopy ? (
      <button type="button" onClick={onCopy} className={cn('inline-flex min-w-0 items-center gap-1.5 break-all text-right font-mono text-[12.5px] text-ink hover:text-maroon', ring, 'rounded-[6px]')}>
        {value}<Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </button>
    ) : (
      <span className={cn('min-w-0 text-right text-[13.5px]', strong ? 'font-display text-[16px] font-extrabold tabular-nums text-ink' : 'text-ink', mono && 'break-all font-mono text-[12.5px]')}>{value}</span>
    )}
  </div>
);
const Group = ({ title, children }) => (
  <section className="rounded-[20px] bg-white px-4 py-2 sm:px-5">
    {title && <h3 className="mb-0 pt-2 text-[13px] font-semibold text-faint">{title}</h3>}
    {children}
  </section>
);

export const PaymentDetail = ({ tx, verified }) => {
  const state = payoutState(tx, { verified });
  const lines = feeLines(tx);
  const taxed = lines.some((l) => l.tax);
  const when = tx.scheduled_at || tx.created_at;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[20px] bg-white px-4 py-4 sm:px-5">
        <p className="mb-0 text-[13px] text-muted">You get</p>
        <p className="mb-0 mt-1 font-display text-[30px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{money(tx.vendor_amount)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StateBadge state={state} />
          <span className="min-w-0 truncate text-[13px] text-muted">{tx.services?.title || 'Booking'} · {tx.guest_name || 'Guest'}</span>
        </div>
      </div>
      <Group title="How it adds up">
        {lines.map((l) => <Line key={l.label} label={l.label} value={l.value < 0 ? `− ${money(-l.value)}` : money(l.value)} />)}
        <div className="border-t border-neutral-200"><Line label="You get" value={money(tx.vendor_amount)} strong /></div>
        {taxed && <p className="mb-2 text-[12.5px] leading-snug text-muted">TDS and TCS go to the government against your PAN. Claim them when you file your return.</p>}
      </Group>
      <Group title="Booking">
        <Line label="When" value={when ? `${fmtDayFull(when)} · ${fmtTime(when)}` : 'Not scheduled'} />
        {tx.services?.duration ? <Line label="Length" value={`${tx.services.duration} min`} /> : null}
        <Line label="Guest" value={tx.guest_name || 'Guest'} />
        {tx.guest_email && <Line label="Email" value={tx.guest_email} />}
        {tx.guest_phone && <Line label="Phone" value={tx.guest_phone} />}
      </Group>
      {(tx.razorpay_payment_id || tx.razorpay_order_id) && (
        <Group title="Razorpay reference">
          {tx.razorpay_payment_id && <Line label="Payment" value={tx.razorpay_payment_id} onCopy={() => copy(tx.razorpay_payment_id, 'Payment ID')} />}
          {tx.razorpay_order_id && <Line label="Order" value={tx.razorpay_order_id} onCopy={() => copy(tx.razorpay_order_id, 'Order ID')} />}
          {tx.transfer_status === 'failed' && tx.transfer_error && <p className="mb-2 text-[12.5px] text-error-fg">Why it failed: {tx.transfer_error}</p>}
        </Group>
      )}
      <p className="mb-0 px-1 text-[12px] text-faint">Payment advice, not a tax invoice.</p>
    </div>
  );
};

/* ── Payouts tab ──────────────────────────────────────────────────────── */
const sticky = 'sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-10 bg-white/95 px-4 py-2 text-[13px] font-semibold text-faint backdrop-blur-sm sm:px-5';

const BankLead = () => (
  <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-maroon">
    <Landmark className="h-[18px] w-[18px]" strokeWidth={2} />
  </span>
);

// `art` off where the balance band above already carries the panda (one per screen).
export const MoneyEmpty = ({ title, children, action, art = true }) => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    {art && <img src="/about/mascot-orange.png" alt="" className="mb-3 h-24 w-24 object-contain" />}
    <p className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{title}</p>
    <p className="mb-0 mt-1.5 max-w-[40ch] text-[13.5px] text-muted">{children}</p>
    {action}
  </div>
);

const DepositDetail = ({ deposit, onOpen }) => (
  <div className="flex flex-col gap-3">
    <div className="rounded-[20px] bg-white px-4 py-4 sm:px-5">
      <p className="mb-0 text-[13px] text-muted">Reached your bank</p>
      <p className="mb-0 mt-1 font-display text-[30px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{money(deposit.total)}</p>
      <p className="mb-0 mt-2 text-[13.5px] text-muted">
        {deposit.at ? fmtDayFull(deposit.at) : 'Date not recorded'} · {deposit.rows.length} {deposit.rows.length === 1 ? 'payment' : 'payments'}
      </p>
    </div>
    <section className="overflow-hidden rounded-[20px] bg-white">
      <h3 className="mb-0 px-4 pb-1 pt-3 text-[13px] font-semibold text-faint sm:px-5">Payments in this deposit</h3>
      <ul>
        {deposit.rows.map((tx, i) => (
          <Row key={tx.id} first={i === 0} onClick={() => onOpen(tx)} lead={<Avatar name={tx.guest_name || tx.guest_email} />}
            title={tx.guest_name || 'Guest'} meta={`${tx.services?.title || 'Booking'} · ${fmtDay(tx.scheduled_at || tx.created_at)}`}
            value={money(tx.vendor_amount)} />
        ))}
      </ul>
    </section>
    {!deposit.id.startsWith('day:') && (
      <Group><Line label="Bank reference" value={deposit.id} onCopy={() => copy(deposit.id, 'Reference')} /></Group>
    )}
    <p className="mb-0 px-1 text-[12px] text-faint">Razorpay sends these payments to your bank together, as one credit.</p>
  </div>
);

const PayoutsTab = ({ verified }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(null); // { kind: 'payment'|'deposit', item }
  const load = useCallback(() => {
    setError(false);
    // ponytail: the latest 100 payments; a deep history can page later if hosts need it.
    getTransactions({ limit: 100, sort: 'desc' }).then(({ data }) => setRows(data?.data || [])).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const split = useMemo(() => splitPayouts(rows || [], { verified }), [rows, verified]);
  const months = useMemo(() => byMonth(split.deposits, (d) => d.at), [split.deposits]);
  const close = useCallback(() => setOpen(null), []);
  const openPayment = useCallback((tx) => setOpen({ kind: 'payment', item: tx }), []);

  if (error) {
    return <Panel><ErrorState title="We couldn't load your payouts." message="Your money is safe. This is a problem showing it." onRetry={load} /></Panel>;
  }
  if (!rows) return <div className="flex flex-col gap-4"><Skeleton className="h-[200px] rounded-[24px]" /><Skeleton className="h-[320px] rounded-[24px]" /></div>;
  if (!split.onTheWay.length && !split.deposits.length && !split.problems.length) {
    return (
      <Panel>
        <MoneyEmpty art={false} title="No payouts yet">When a guest pays for a booking, it shows up here and goes to your bank after the session.</MoneyEmpty>
      </Panel>
    );
  }

  const states = (list) => list.map((tx) => [tx, payoutState(tx, { verified })]);
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {split.onTheWay.length > 0 && (
        <Panel title="On its way" subtitle={`${split.onTheWay.length} ${split.onTheWay.length === 1 ? 'payment' : 'payments'} not in your bank yet`} flush>
          <ul>{states(split.onTheWay).map(([tx, s], i) => <PaymentRow key={tx.id} tx={tx} state={s} first={i === 0} onOpen={openPayment} />)}</ul>
        </Panel>
      )}
      {split.problems.length > 0 && (
        <Panel title="Didn't go through" subtitle="Refunded or cancelled bookings, and transfers that failed" flush>
          <ul>{states(split.problems).map(([tx, s], i) => (
            <Row key={tx.id} first={i === 0} onClick={() => openPayment(tx)} lead={<Avatar name={tx.guest_name} />}
              title={tx.guest_name || 'Guest'} meta={`${tx.services?.title || 'Booking'} · ${fmtDay(tx.scheduled_at || tx.created_at)}`}
              value={money(tx.vendor_amount)} sub={<StateBadge state={s} />} />
          ))}</ul>
        </Panel>
      )}
      {split.deposits.length > 0 && (
        <Panel title="Bank deposits" subtitle="Each one can hold several payments. Tap to see them." flush bodyClassName="pb-2">
          {months.map((m) => (
            <section key={m.label} aria-label={m.label}>
              <h3 className={cn(sticky, 'mb-0')}>{m.label}</h3>
              <ul>
                {m.items.map((d, i) => (
                  <Row key={d.id} first={i === 0} onClick={() => setOpen({ kind: 'deposit', item: d })} lead={<BankLead />}
                    title={d.at ? fmtDayFull(d.at) : 'Deposit'}
                    meta={`In your bank · ${d.rows.length} ${d.rows.length === 1 ? 'payment' : 'payments'}`}
                    value={money(d.total)} />
                ))}
              </ul>
            </section>
          ))}
        </Panel>
      )}

      <Sheet open={!!open} onClose={close} bodyClassName="bg-cream"
        title={open?.kind === 'deposit' ? 'Bank deposit' : 'Payment'}>
        {open?.kind === 'deposit' && <DepositDetail deposit={open.item} onOpen={openPayment} />}
        {open?.kind === 'payment' && <PaymentDetail tx={open.item} verified={verified} />}
      </Sheet>
    </div>
  );
};

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function MoneyV2({ tab = 'payouts', children }) {
  const navigate = useNavigate();
  const data = useBalance();
  const verified = isVerified(data.kyc);
  const verifyKey = tab === 'payouts' && data.status === 'ready'
    ? bandCopy({ buckets: balanceBuckets(data.balance), kyc: data.kyc }).verify
    : null;
  const goVerify = () => navigate('/dashboard/kyc');

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon lg:text-[34px]">Money</h1>
        <MoneyTabs tab={tab} />
      </header>

      {/* Balance first — on the Payouts tab, which is where Money opens. The other
          tabs start right under the tabs, so a phone sees their list at once. */}
      {tab === 'payouts' && <BalanceBand data={data} onVerify={goVerify} />}
      {tab === 'payouts' && (data.status === 'loading'
        ? <Skeleton className="h-[320px] rounded-[24px]" />
        : <PayoutsTab verified={verified} />)}
      {tab !== 'payouts' && children?.({ verified, data })}

      {verifyKey && (
        <>
          <PinnedAction label={VERIFY[verifyKey]} onClick={goVerify} />
          {/* Room for the pinned button, so the last row can scroll clear of it. */}
          <div aria-hidden="true" className="h-16 lg:hidden" />
        </>
      )}
    </div>
  );
}

