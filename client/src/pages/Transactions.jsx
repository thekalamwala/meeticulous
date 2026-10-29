import { useState, useEffect, useCallback } from "react";
import { Receipt, User, CalendarDays, IndianRupee, CreditCard, Copy } from "lucide-react";
import { getTransactions } from "../services/api";
import toast from "react-hot-toast";
import {
  PageHeader, DataTable, Modal,
  SearchInput, Select, EmptyState, ErrorState, SkeletonCard,
  useInfiniteScroll, fmtMoney, cn,
} from "../components/dashboard/ui";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// PAYOUT status — the truth the host actually cares about: has THEIR money moved?
// A green "Paid" from the guest's payment_status said nothing about the host being
// paid, so we show the Route transfer state instead. `null` transfer_status on a
// paid booking that owes money = owed but not yet sent ("Payout pending").
const PAYOUT_STATE = {
  processed: { label: "Paid out", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending:   { label: "In transit", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  reversed:  { label: "Reversed", cls: "border-gray-200 bg-gray-100 text-gray-600" },
  failed:    { label: "Payout failed", cls: "border-red-200 bg-red-50 text-red-700" },
  owed:      { label: "Payout pending", cls: "border-amber-200 bg-amber-50 text-amber-700" },
};
const payoutStateKey = (tx) => {
  if (tx.services?.price === 0 || !(Number(tx.vendor_amount) > 0)) return null; // free / nothing owed
  const ts = tx.transfer_status;
  if (ts === "processed" || ts === "pending" || ts === "reversed" || ts === "failed") return ts;
  return "owed"; // paid by guest, transfer not created/sent yet
};
const PayoutChip = ({ tx }) => {
  const key = payoutStateKey(tx);
  if (!key) return null;
  const s = PAYOUT_STATE[key];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", s.cls)}>
      {s.label}
    </span>
  );
};

// Day-grouping for the mobile statement feed (Today / Yesterday / date).
const txDate = (tx) => new Date(tx.scheduled_at || tx.created_at);
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayLabel = (d) => {
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
};
const groupTxByDay = (list) => {
  const groups = [];
  const index = {};
  for (const tx of list) {
    const key = dayKey(txDate(tx));
    if (index[key] == null) { index[key] = groups.length; groups.push({ key, label: dayLabel(txDate(tx)), items: [] }); }
    groups[index[key]].items.push(tx);
  }
  return groups;
};

// Money-forward mobile transaction card. Earnings lead; the whole card opens
// the detail sheet (same onRowClick target as the desktop table).
const TxCard = ({ tx, onOpen }) => {
  const isFree = tx.services?.price === 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(tx)}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors active:bg-gray-50 dash-elev-1"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{tx.guest_name || "Guest"}</p>
        <p className="truncate text-xs text-gray-500">{tx.services?.title || "—"}</p>
        <div className="mt-1.5"><PayoutChip tx={tx} /></div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold text-primary">{fmtMoney(tx.vendor_amount, { decimals: true })}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">{isFree ? "Free" : `of ${fmtMoney(tx.services?.price, { decimals: true })}`}</p>
      </div>
    </button>
  );
};

// Maps a date-filter preset to an ISO lower bound on the transaction date.
// Returns undefined for "all time" so the param is omitted entirely.
const dateFromFor = (preset) => {
  if (!preset) return undefined;
  const d = new Date();
  if (preset === "today") d.setHours(0, 0, 0, 0);
  else if (preset === "7d") d.setDate(d.getDate() - 7);
  else if (preset === "30d") d.setDate(d.getDate() - 30);
  else if (preset === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); }
  return d.toISOString();
};

const Row = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="flex-shrink-0 text-xs text-gray-500">{label}</span>
    <span className={cn("text-right text-xs font-medium text-gray-800", mono && "break-all font-mono")}>{value || "-"}</span>
  </div>
);

const copy = (text, label) => {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => toast.success(`${label} copied`)).catch(() => {});
};

// Copyable mono row for gateway reference ids.
const RowCopy = ({ label, value }) => (
  <button type="button" onClick={() => copy(value, label)} className="flex w-full items-start justify-between gap-4 text-left">
    <span className="flex-shrink-0 text-xs text-gray-500">{label}</span>
    <span className="inline-flex items-center gap-1 break-all text-right font-mono text-xs font-medium text-gray-800 transition-colors hover:text-primary">
      {value} <Copy className="h-3 w-3 shrink-0" />
    </span>
  </button>
);

// Icon-led card grouping the transaction's fields into clean sections.
const Section = ({ icon: Icon, title, children }) => (
  <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />{title}
    </h4>
    <div className="space-y-2">{children}</div>
  </section>
);

const Detail = ({ tx }) => {
  const isFree = tx.services?.price === 0;
  // Payment-gateway charge borne by the host = actual Razorpay fee + tax.
  const pg = Math.round(((Number(tx.razorpay_fee_actual) || 0) + (Number(tx.razorpay_tax_actual) || 0)) * 100) / 100;
  return (
    <div>
      {/* Summary band — emphasized earnings + payment status, copyable id */}
      <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Your earnings</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">{fmtMoney(tx.vendor_amount, { decimals: true })}</p>
          <button
            type="button"
            onClick={() => copy(tx.id, "Transaction ID")}
            title="Copy transaction ID"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 transition-colors hover:text-primary"
          >
            #{tx.id?.slice(0, 8).toUpperCase()}
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="shrink-0 text-right">
          <PayoutChip tx={tx} />
          <p className="mt-1.5 text-[11px] text-gray-400">{fmtDate(tx.scheduled_at || tx.created_at)}</p>
        </div>
      </div>

      {/* Two-column section grid; stacks on mobile with equal-height rows. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Section icon={User} title="Customer">
          <Row label="Name" value={tx.guest_name || "Guest"} />
          <Row label="Email" value={tx.guest_email} />
          <Row label="Phone" value={tx.guest_phone} />
        </Section>

        <Section icon={CalendarDays} title="Booking">
          <Row label="Service" value={tx.services?.title} />
          <Row label="Date" value={fmtDate(tx.scheduled_at || tx.created_at)} />
          <Row label="Duration" value={(tx.services?.duration || 30) + " min"} />
          {tx.notes && <Row label="Notes" value={tx.notes} />}
        </Section>

        <Section icon={IndianRupee} title="Payment advice">
          {isFree ? (
            <Row label="Service price" value="Free" />
          ) : (
            <>
              {/* Marketplace v4: host earns the listed price minus commission, the
                  payment-gateway charge, and statutory TDS/TCS. Deduction rows show
                  only when non-zero (paid plans have no commission). */}
              <Row label="Service price" value={fmtMoney(tx.services?.price, { decimals: true })} />
              {Number(tx.commission_applied) > 0 && (
                <Row label="− Commission" value={fmtMoney(tx.commission_applied, { decimals: true })} />
              )}
              {pg > 0 && <Row label="− Payment gateway" value={fmtMoney(pg, { decimals: true })} />}
              {Number(tx.tds_amount) > 0 && (
                <Row label="− TDS (194-O, 1%)" value={fmtMoney(tx.tds_amount, { decimals: true })} />
              )}
              {Number(tx.tcs_amount) > 0 && (
                <Row label="− TCS (GST §52, 1%)" value={fmtMoney(tx.tcs_amount, { decimals: true })} />
              )}
              <div className="mt-1 flex items-center justify-between border-t border-gray-200/70 pt-2">
                <span className="text-xs font-semibold text-gray-700">Net payout</span>
                <span className="text-xs font-bold text-primary">{fmtMoney(tx.vendor_amount, { decimals: true })}</span>
              </div>
              {payoutStateKey(tx) && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Payout status</span>
                  <PayoutChip tx={tx} />
                </div>
              )}
              {tx.transfer_status === "failed" && tx.transfer_error && (
                <p className="text-[10px] leading-snug text-red-500">Reason: {tx.transfer_error}</p>
              )}
            </>
          )}
          <p className="mt-2 text-[10px] leading-snug text-gray-400">
            Payment advice, not a tax invoice. TDS &amp; TCS are deposited with the government against your PAN — claim credit when you file.
          </p>
        </Section>

        <Section icon={CreditCard} title="Gateway reference">
          {tx.razorpay_order_id || tx.razorpay_payment_id ? (
            <>
              {tx.razorpay_order_id && <RowCopy label="Order ID" value={tx.razorpay_order_id} />}
              {tx.razorpay_payment_id && <RowCopy label="Payment ID" value={tx.razorpay_payment_id} />}
            </>
          ) : (
            <p className="text-xs text-gray-400">No gateway reference on this transaction.</p>
          )}
        </Section>
      </div>
    </div>
  );
};

const PAGE_SIZE = 20;

const COLUMNS = [
  {
    key: "customer",
    header: "Customer",
    render: (tx) => (
      <div>
        <p className="font-medium text-gray-800">{tx.guest_name || "Guest"}</p>
        <p className="max-w-[160px] truncate text-xs text-gray-400">{tx.guest_email || "—"}</p>
      </div>
    ),
  },
  { key: "service", header: "Service", render: (tx) => <span className="text-gray-600">{tx.services?.title || "—"}</span> },
  { key: "date", header: "Date", render: (tx) => <span className="text-gray-500">{fmtDate(tx.scheduled_at || tx.created_at)}</span> },
  { key: "total", header: "Total", render: (tx) => <span className="font-semibold text-gray-800">{tx.services?.price === 0 ? "Free" : fmtMoney(tx.services?.price, { decimals: true })}</span> },
  { key: "earned", header: "Earned", render: (tx) => <span className="font-semibold text-primary">{fmtMoney(tx.vendor_amount, { decimals: true })}</span> },
  { key: "status", header: "Payout", render: (tx) => <PayoutChip tx={tx} /> },
];

const Transactions = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [sort, setSort] = useState("desc");
  const [loading, setLoading] = useState(true);    // first-page / filter-change load
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);

  // One loader for both the first page (replace) and subsequent pages (append).
  const load = useCallback(async (pageToLoad, replace) => {
    replace ? setLoading(true) : setLoadingMore(true);
    setError(false);
    try {
      const { data: res } = await getTransactions({ page: pageToLoad, limit: PAGE_SIZE, search, status, sort, dateFrom: dateFromFor(dateRange) });
      const rows = res.data || [];
      setData((prev) => (replace ? rows : [...prev, ...rows]));
      setTotal(res.total || 0);
      setHasMore(pageToLoad * PAGE_SIZE < (res.total || 0));
    } catch {
      setError(true);
      if (replace) toast.error("Failed to load transactions");
    } finally {
      replace ? setLoading(false) : setLoadingMore(false);
    }
  }, [search, status, sort, dateRange]);

  // Reset to page 1 and replace whenever filters change (load identity changes with them).
  useEffect(() => { setPage(1); load(1, true); }, [load]);

  const loadMore = useCallback(() => {
    setPage((p) => { const next = p + 1; load(next, false); return next; });
  }, [load]);

  const sentinelRef = useInfiniteScroll(loadMore, { hasMore, loading: loading || loadingMore });

  return (
    <div>
      <PageHeader title="Transactions" subtitle={`${total} total transactions`} />

      {/* Toolbar — search ~70% + status/date/sort inline on one row;
          stacks on mobile (search on top, the 3 dropdowns in a row under). */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search name, email…"
          className="w-full sm:w-[70%]"
        />
        <div className="dash-noscrollbar flex gap-2 overflow-x-auto sm:flex-1 sm:overflow-visible">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="min-h-11 min-w-[8.5rem] shrink-0 sm:min-w-0 sm:flex-1" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }} className="min-h-11 min-w-[8.5rem] shrink-0 sm:min-w-0 sm:flex-1" aria-label="Filter by date">
            <option value="">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-11 min-w-[8.5rem] shrink-0 sm:min-w-0 sm:flex-1" aria-label="Sort order">
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </Select>
        </div>
      </div>

      {/* Mobile: money-forward statement feed, grouped by day */}
      <div className="space-y-5 md:hidden">
        {loading ? (
          <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : error && data.length === 0 ? (
          <ErrorState message="Couldn’t load your transactions." onRetry={() => load(1, true)} />
        ) : data.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions found" description="Transactions show up here once guests pay for bookings." />
        ) : (
          groupTxByDay(data).map((group) => (
            <section key={group.key}>
              <div className="sticky top-14 z-10 -mx-1 mb-2 bg-[#f7f5ef]/95 px-1 py-1.5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
              </div>
              <div className="space-y-2.5">
                {group.items.map((tx) => <TxCard key={tx.id} tx={tx} onOpen={setSelected} />)}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <DataTable
          columns={COLUMNS}
          rows={data}
          loading={loading}
          onRowClick={setSelected}
          empty={<EmptyState icon={Receipt} title="No transactions found" description="Transactions show up here once guests pay for bookings." />}
        />
      </div>

      {/* Infinite scroll: IntersectionObserver sentinel + inline load-more skeleton +
          inline retry on a load-more failure. Replaces numbered pagination. */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      {loadingMore && <div className="mt-3"><SkeletonCard /></div>}
      {error && data.length > 0 && (
        <div className="mt-4 py-2 text-center text-sm text-gray-500">
          Couldn’t load more.{" "}
          <button type="button" onClick={loadMore} className="font-medium text-primary underline">Retry</button>
        </div>
      )}
      {!hasMore && !loading && data.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">Showing all {total} transactions</p>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction Details" size="lg">
        {selected && <Detail tx={selected} />}
      </Modal>
    </div>
  );
};

export default Transactions;
