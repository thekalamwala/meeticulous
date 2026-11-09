import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, User, CalendarDays, IndianRupee, CreditCard, Copy,
  Download, MoreHorizontal, ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { getTransactions } from "../services/api";
import toast from "react-hot-toast";
import {
  Modal, EmptyState, ErrorState, Skeleton, fmtMoney, cn,
} from "../components/dashboard/ui";
import { isPreviewEnabled, getPreviewTransactions, filterPreviewTransactions } from "../utils/previewData";

/* ==========================================================================
 * Transactions — redesigned content area (the host console shell/ConsoleSidebar
 * is unchanged; this only redraws the right-hand page). ALL data is real:
 * getTransactions() returns the host's PAID bookings. No dummy rows; empty,
 * error and loading states are honest.
 * ======================================================================== */

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

// PAYOUT status — the truth the host actually cares about: has THEIR money moved?
// A green "Paid" from the guest's payment_status said nothing about the host being
// paid, so we show the Route transfer state instead. `null` transfer_status on a
// paid booking that owes money = owed but not yet sent ("Payout pending").
const PAYOUT_STATE = {
  processed: { label: "Paid out", cls: "border-c-emerald/20 bg-c-emerald/10 text-c-emerald" },
  pending:   { label: "In transit", cls: "border-maroon/20 bg-maroon-100 text-maroon-700" },
  reversed:  { label: "Reversed", cls: "border-ink/10 bg-ink/5 text-ink/60" },
  failed:    { label: "Payout failed", cls: "border-rose/30 bg-rose/10 text-rose-700" },
  owed:      { label: "Payout pending", cls: "border-marigold-300 bg-marigold-100 text-marigold-800" },
};
const payoutStateKey = (tx) => {
  if (tx.services?.price === 0 || !(Number(tx.vendor_amount) > 0)) return null; // free / nothing owed
  const ts = tx.transfer_status;
  if (ts === "processed" || ts === "pending" || ts === "reversed" || ts === "failed") return ts;
  return "owed"; // paid by guest, transfer not created/sent yet
};
const PayoutChip = ({ tx }) => {
  const key = payoutStateKey(tx);
  // Every row here is a captured payment, so a row with no payout movement still
  // reads as "Paid" (the real payment_status) rather than a blank cell.
  if (!key) {
    return (
      <span className="inline-flex items-center rounded-full border border-c-emerald/20 bg-c-emerald/10 px-2 py-0.5 text-[11px] font-semibold text-c-emerald">
        Paid
      </span>
    );
  }
  const s = PAYOUT_STATE[key];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", s.cls)}>
      {s.label}
    </span>
  );
};
const statusLabel = (tx) => {
  const key = payoutStateKey(tx);
  return key ? PAYOUT_STATE[key].label : "Paid";
};

// The only payment gateway on the platform is Razorpay — shown as the method when
// a gateway payment id exists; never fabricated.
const paymentMethod = (tx) => (tx.razorpay_payment_id ? "Razorpay" : "—");

const copy = (text, label) => {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => toast.success(`${label} copied`)).catch(() => {});
};

/* ------------------------------------------------------------------ */
/* Transaction detail modal (unchanged — real fields)                  */
/* ------------------------------------------------------------------ */

const Row = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="flex-shrink-0 text-xs text-muted">{label}</span>
    <span className={cn("text-right text-xs font-medium text-ink", mono && "break-all font-mono")}>{value || "-"}</span>
  </div>
);

const RowCopy = ({ label, value }) => (
  <button type="button" onClick={() => copy(value, label)} className="flex w-full items-start justify-between gap-4 text-left">
    <span className="flex-shrink-0 text-xs text-muted">{label}</span>
    <span className="inline-flex items-center gap-1 break-all text-right font-mono text-xs font-medium text-ink transition-colors hover:text-primary">
      {value} <Copy className="h-3 w-3 shrink-0" />
    </span>
  </button>
);

const Section = ({ icon: Icon, title, children }) => (
  <section className="rounded-xl border border-maroon/5 bg-blush/40 p-4">
    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/40">
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />{title}
    </h4>
    <div className="space-y-2">{children}</div>
  </section>
);

const Detail = ({ tx }) => {
  const isFree = tx.services?.price === 0;
  const pg = Math.round(((Number(tx.razorpay_fee_actual) || 0) + (Number(tx.razorpay_tax_actual) || 0)) * 100) / 100;
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border-2 border-maroon/10 bg-blush/50 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink/40">Your earnings</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">{fmtMoney(tx.vendor_amount, { decimals: true })}</p>
          <button
            type="button"
            onClick={() => copy(tx.id, "Transaction ID")}
            title="Copy transaction ID"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-ink/40 transition-colors hover:text-primary"
          >
            #{tx.id?.slice(0, 8).toUpperCase()}
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="shrink-0 text-right">
          <PayoutChip tx={tx} />
          <p className="mt-1.5 text-[11px] text-ink/40">{fmtDate(tx.scheduled_at || tx.created_at)}</p>
        </div>
      </div>

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
              <div className="mt-1 flex items-center justify-between border-t border-maroon/10 pt-2">
                <span className="text-xs font-semibold text-ink">Net payout</span>
                <span className="text-xs font-bold text-primary">{fmtMoney(tx.vendor_amount, { decimals: true })}</span>
              </div>
              {payoutStateKey(tx) && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Payout status</span>
                  <PayoutChip tx={tx} />
                </div>
              )}
              {tx.transfer_status === "failed" && tx.transfer_error && (
                <p className="text-[10px] leading-snug text-rose-700">Reason: {tx.transfer_error}</p>
              )}
            </>
          )}
          <p className="mt-2 text-[10px] leading-snug text-ink/40">
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
            <p className="text-xs text-ink/40">No gateway reference on this transaction.</p>
          )}
        </Section>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Filters → API params (only backend-supported controls are wired)    */
/* ------------------------------------------------------------------ */

// Maps a date-filter preset to an ISO lower bound (getTransactions `dateFrom`).
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

// Pink pill select — same options the backend understands, styled to the reference.
const FilterSelect = ({ value, onChange, children, label }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      aria-label={label}
      className="h-10 w-full cursor-pointer appearance-none rounded-full border border-maroon/15 bg-white pl-4 pr-9 text-sm font-medium text-ink shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
    >
      {children}
    </select>
    <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-primary/70" />
  </div>
);

/* ------------------------------------------------------------------ */
/* Row actions menu                                                    */
/* ------------------------------------------------------------------ */

const RowActions = ({ tx, onView }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-ink transition hover:bg-blush/50";
  return (
    <div ref={ref} className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Transaction actions"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full border border-maroon/10 text-ink/50 transition hover:bg-blush/50 hover:text-primary"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-maroon/10 bg-white p-1 shadow-[0_18px_40px_-20px_rgba(150,13,50,0.45)]">
          <button type="button" role="menuitem" className={item} onClick={() => { onView(tx); setOpen(false); }}>View details</button>
          {tx.razorpay_payment_id && (
            <button type="button" role="menuitem" className={item} onClick={() => { copy(tx.razorpay_payment_id, "Payment ID"); setOpen(false); }}>Copy payment ID</button>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => { copy(tx.id, "Transaction ID"); setOpen(false); }}>Copy transaction ID</button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

const TH = ({ children, className }) => (
  <th scope="col" className={cn("whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-maroon/70", className)}>
    {children}
  </th>
);

const TxRow = ({ tx, onView }) => {
  const d = tx.scheduled_at || tx.created_at;
  const isFree = tx.services?.price === 0;
  return (
    <tr onClick={() => onView(tx)} className="cursor-pointer border-b border-maroon/5 transition-colors last:border-0 hover:bg-blush/30">
      <td className="whitespace-nowrap px-4 py-2.5">
        <p className="text-sm font-medium text-ink">{fmtDate(d)}</p>
        <p className="text-[11px] text-ink/40">{fmtTime(d)}</p>
      </td>
      <td className="px-4 py-2.5">
        <p className="text-sm font-semibold text-ink">{tx.guest_name || "Guest"}</p>
        <p className="max-w-[180px] truncate text-[11px] text-ink/40">{tx.guest_email || "—"}</p>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-sm text-ink/70">{tx.services?.title || "—"}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">Booking</span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <p className="text-sm font-bold text-ink">{isFree ? "Free" : fmtMoney(tx.services?.price, { decimals: true })}</p>
        {!isFree && <p className="text-[11px] text-primary">nets {fmtMoney(tx.vendor_amount, { decimals: true })}</p>}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink/70">
          <CreditCard className="h-3.5 w-3.5 text-ink/30" strokeWidth={2} />
          {paymentMethod(tx)}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5"><PayoutChip tx={tx} /></td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right"><RowActions tx={tx} onView={onView} /></td>
    </tr>
  );
};

const TableSkeleton = () => (
  <tbody>
    {Array.from({ length: 8 }).map((_, i) => (
      <tr key={i} className="border-b border-maroon/5 last:border-0">
        {Array.from({ length: 8 }).map((__, j) => (
          <td key={j} className="px-4 py-3"><Skeleton className={cn("h-4", j === 1 ? "w-36" : "w-16")} /></td>
        ))}
      </tr>
    ))}
  </tbody>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 12;
const EXPORT_LIMIT = 500;

const Transactions = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState("month"); // reference default: This Month
  const [sort, setSort] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(null);

  const params = useCallback(
    (overrides = {}) => ({ page, limit: PAGE_SIZE, search, status, sort, dateFrom: dateFromFor(dateRange), ...overrides }),
    [page, search, status, sort, dateRange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    // DEV-only UI preview: render sample transactions WITHOUT touching the API.
    // Never a fallback on failure — this is an up-front branch gated on the flag.
    if (isPreviewEnabled()) {
      const all = filterPreviewTransactions(getPreviewTransactions() || [], { search, status, dateFrom: dateFromFor(dateRange), sort });
      setTotal(all.length);
      setData(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      setLoading(false);
      return;
    }
    try {
      const { data: res } = await getTransactions(params());
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [params, page, search, status, dateRange, sort]);

  useEffect(() => { load(); }, [load]);

  // Filters reset to page 1 (search is debounce-free; the API call fires on change).
  const onFilter = (setter) => (v) => { setter(v); setPage(1); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows;
      if (isPreviewEnabled()) {
        rows = filterPreviewTransactions(getPreviewTransactions() || [], { search, status, dateFrom: dateFromFor(dateRange), sort });
      } else {
        const { data: res } = await getTransactions(params({ page: 1, limit: EXPORT_LIMIT }));
        rows = res.data || [];
      }
      if (rows.length === 0) { toast.error("No transactions to export."); return; }
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = ["Date", "Time", "Customer", "Email", "Service", "Type", "Amount", "Earnings", "Payment Method", "Status"];
      const lines = rows.map((tx) => {
        const d = tx.scheduled_at || tx.created_at;
        return [
          fmtDate(d), fmtTime(d), tx.guest_name || "Guest", tx.guest_email || "",
          tx.services?.title || "", "Booking",
          tx.services?.price ?? "", tx.vendor_amount ?? "",
          paymentMethod(tx), statusLabel(tx),
        ].map(esc).join(",");
      });
      const csv = [head.map(esc).join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} transactions`);
    } catch {
      toast.error("Couldn't export transactions.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-3xl bg-gradient-to-b from-blush/40 via-transparent to-transparent p-1">
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Receipt className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-maroon sm:text-[28px]">Transactions</h1>
            <p className="mt-0.5 text-sm text-muted">Payments, refunds and payout records.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || loading}
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50 sm:self-auto"
        >
          <Download className="h-4 w-4" strokeWidth={2} />
          {exporting ? "Exporting…" : "Export Report"}
        </button>
      </div>

      {/* ── Filter toolbar (only backend-supported controls are wired) ── */}
      <div className="mb-4 grid grid-cols-1 gap-2.5 rounded-2xl border border-maroon/10 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
        <FilterSelect value={dateRange} onChange={(e) => onFilter(setDateRange)(e.target.value)} label="Filter by date">
          <option value="month">This Month</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="">All time</option>
        </FilterSelect>
        <FilterSelect value={status} onChange={(e) => onFilter(setStatus)(e.target.value)} label="Filter by status">
          <option value="">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </FilterSelect>
        {/* Sort is real (API `sort`). The reference's "Transaction type" and
            "Payment method" filters are omitted: the backend has no type or
            method field to filter on, so faking them would be decorative. */}
        <FilterSelect value={sort} onChange={(e) => onFilter(setSort)(e.target.value)} label="Sort order">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </FilterSelect>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            value={search}
            onChange={(e) => onFilter(setSearch)(e.target.value)}
            placeholder="Search by customer, service, ref…"
            aria-label="Search transactions"
            className="h-10 w-full rounded-full border border-maroon/15 bg-white pl-11 pr-4 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-maroon/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse">
            <thead>
              <tr className="border-b border-maroon/10 bg-blush/50">
                <TH>Date &amp; Time</TH>
                <TH>Customer</TH>
                <TH>Service / Product</TH>
                <TH>Type</TH>
                <TH>Amount</TH>
                <TH>Payment Method</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton />
            ) : data.length > 0 ? (
              <tbody>
                {data.map((tx) => <TxRow key={tx.id} tx={tx} onView={setSelected} />)}
              </tbody>
            ) : null}
          </table>
        </div>

        {/* Empty / error states live inside the table card so the chrome is preserved. */}
        {!loading && error && (
          <div className="px-4 py-10">
            <ErrorState message="Couldn't load your transactions." onRetry={load} />
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="px-4 py-12">
            <EmptyState
              icon={Receipt}
              title="No transactions found"
              description="Transactions show up here once guests pay for bookings."
            />
          </div>
        )}
      </div>

      {/* ── Footer: range + numbered pagination (real total) ──────────── */}
      {!loading && !error && total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted">
            Showing <span className="font-semibold text-ink">{from}–{to}</span> of{" "}
            <span className="font-semibold text-ink">{total}</span> transactions
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="grid h-9 w-9 place-items-center rounded-full border border-maroon/15 text-ink/60 transition hover:bg-blush/50 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-medium text-ink">
              Page {page} <span className="text-ink/40">of {totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="grid h-9 w-9 place-items-center rounded-full border border-maroon/15 text-ink/60 transition hover:bg-blush/50 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction Details" size="lg">
        {selected && <Detail tx={selected} />}
      </Modal>
    </div>
  );
};

export default Transactions;
