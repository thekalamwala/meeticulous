import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { getMyInvoices, invoiceUrl } from "../services/api";
import { useRegisterRefresh } from "../components/dashboard/ui/refreshContext";
import { PageHeading } from "../components/dashboard/ui/v2";
import { KeptError, KeptSkeleton } from "./catalog/KeptKit";
import { GuestEmpty, btnSoft } from "./guest/GuestKit";

// /user/invoices — the guest's own GST tax invoices (bookings + subscriptions),
// each downloadable as a PDF via the token-gated invoice view. Product-purchase
// invoices are not in this feed yet (the /invoices/mine endpoint scopes to
// booking + subscription to avoid leaking host commission invoices).

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const TYPE_LABEL = { booking: "Booking", subscription: "Membership" };

const GuestInvoices = () => {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => getMyInvoices()
    .then(({ data }) => { setInvoices(Array.isArray(data) ? data : []); setError(false); })
    .catch(() => setError(true)), []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  // GST invoice opens in a new tab (print / save as PDF from there). The
  // access_token is the invoice's own owner-scoped token from /invoices/mine.
  const download = (inv) => window.open(invoiceUrl(inv.id, inv.access_token), "_blank", "noopener,noreferrer");

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Invoices" sub="GST tax invoices for your bookings and memberships." />
      {error && !invoices ? <KeptError what="invoices" onRetry={load} />
        : !invoices ? <KeptSkeleton rows={3} />
          : invoices.length === 0 ? (
            <GuestEmpty mascot="orange" title="No invoices yet" sub="Invoices appear here once you have a paid booking." />
          ) : (
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-pink-50 text-maroon">
                    <FileText className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-0 truncate text-[15px] font-semibold text-ink">{TYPE_LABEL[inv.source_type] || "Invoice"} · {fmtDate(inv.issued_at)}</p>
                    <p className="mb-0 mt-0.5 truncate text-[13px] tabular-nums text-muted">{inv.invoice_number || "Invoice"}</p>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{fmtMoney(inv.total)}</span>
                  <button type="button" onClick={() => download(inv)} className={btnSoft} aria-label={`Download invoice ${inv.invoice_number || ""}`}>
                    <Download className="h-4 w-4" strokeWidth={2.2} />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
};

export default GuestInvoices;
