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
      <h1 className="font-display text-[24px] font-extrabold leading-none tracking-[-0.04em] text-maroon">Invoices</h1>
      <p className="mt-1.5 text-[13px] font-medium text-ink/55">Download GST tax invoices for your bookings and subscriptions.</p>

      <div className="mt-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[66px] animate-pulse rounded-[8px] border-2 border-neutral-200 bg-white" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed border-neutral-200 bg-white px-4 py-10 text-center">
            <Receipt className="mb-2 h-7 w-7 text-ink/25" strokeWidth={1.8} />
            <p className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink">No invoices yet</p>
            <p className="mt-1 text-[12px] font-medium text-ink/50">Invoices appear here once you have a paid booking.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-[8px] border-2 border-neutral-200 bg-white p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-maroon">
                  <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14px] font-extrabold tracking-[-0.02em] text-ink">
                    {inv.invoice_number || "Invoice"}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] font-medium text-ink/50">
                    {TYPE_LABEL[inv.source_type] || "Invoice"} · {fmtDate(inv.issued_at)} · <span className="font-bold text-ink/70">{fmtMoney(inv.total)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => download(inv)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-neutral-200 px-3 py-1.5 text-[11.5px] font-bold text-ink/65 transition hover:border-maroon/40 hover:text-maroon focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
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
