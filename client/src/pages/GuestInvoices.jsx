import { useEffect, useState } from "react";
import { FileText, Download, Receipt } from "lucide-react";
import { getMyInvoices, invoiceUrl } from "../services/api";

// /user/invoices — the guest's own GST tax invoices (bookings + subscriptions),
// each downloadable as a PDF via the token-gated invoice view. Product-purchase
// invoices are not in this feed yet (the /invoices/mine endpoint scopes to
// booking + subscription to avoid leaking host commission invoices).

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const TYPE_LABEL = { booking: "Booking", subscription: "Subscription" };

const GuestInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyInvoices()
      .then(({ data }) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  // GST invoice opens in a new tab (print / save as PDF from there). The
  // access_token is the invoice's own owner-scoped token from /invoices/mine.
  const download = (inv) => {
    window.open(invoiceUrl(inv.id, inv.access_token), "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Invoices</h1>
      <p className="mt-1 text-sm text-gray-500">Download GST tax invoices for your bookings and subscriptions.</p>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <Receipt className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No invoices yet</p>
            <p className="mt-1 text-xs text-gray-500">Invoices appear here once you have a paid booking.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText size={20} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {inv.invoice_number || "Invoice"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {TYPE_LABEL[inv.source_type] || "Invoice"} · {fmtDate(inv.issued_at)} · {fmtMoney(inv.total)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => download(inv)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Download size={15} />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GuestInvoices;
