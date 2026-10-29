import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { getMyInvoices, invoiceUrl } from "../services/api";
import {
  PageHeader, Section, EmptyState, ErrorState, SkeletonCard, fmtMoney, cn,
} from "../components/dashboard/ui";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

// One host-facing invoice row — reused for both booking (BAS-BKG) and
// subscription (BAS-SUB) invoices; the badge tells them apart.
const InvoiceRow = ({ inv }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="truncate font-mono text-xs font-medium text-gray-800">{inv.invoice_number}</p>
        <span className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          inv.source_type === "subscription" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
        )}>
          {inv.source_type === "subscription" ? "Plan" : "Booking"}
        </span>
      </div>
      <p className="text-[11px] text-gray-400">{fmtDate(inv.issued_at)}</p>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      <span className="text-xs font-semibold text-gray-700">{fmtMoney(inv.total, { decimals: true })}</span>
      <a href={invoiceUrl(inv.id, inv.access_token)} target="_blank" rel="noreferrer"
        className="text-xs font-semibold text-primary hover:opacity-80">
        Download
      </a>
    </div>
  </div>
);

// GST invoices the host is the BUYER of — bookings they paid for as a guest and
// their own plan renewals. Consolidated here (was split across Transactions +
// the Plan page) so neither of those pages carries a stray invoices block.
export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getMyInvoices()
      .then(({ data }) => setInvoices(data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const subtitle = "GST invoices for services you booked and your plan renewals.";

  if (loading) {
    return (
      <div>
        <PageHeader title="Invoices" subtitle={subtitle} />
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Invoices" subtitle={subtitle} />
        <ErrorState message="Couldn’t load your invoices." onRetry={load} />
      </div>
    );
  }

  // Split so plan and booking invoices read as distinct groups; each section only
  // renders when it has rows.
  const plan = invoices.filter((i) => i.source_type === "subscription");
  const booking = invoices.filter((i) => i.source_type !== "subscription");

  return (
    <div>
      <PageHeader title="Invoices" subtitle={subtitle} />

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Invoices for bookings you pay for and plan renewals will appear here."
        />
      ) : (
        <div className="space-y-6">
          {plan.length > 0 && (
            <Section title="Plan & subscriptions">
              <div className="space-y-2">{plan.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}</div>
            </Section>
          )}
          {booking.length > 0 && (
            <Section title="Bookings">
              <div className="space-y-2">{booking.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}</div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
