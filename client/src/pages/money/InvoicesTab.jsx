// Money › Invoices & tax (Kept).
// Tax: the TDS / TCS already withheld from this host's payouts, FY-scoped (1 Apr–31 Mar,
// computed server-side in /vendor/intelligence/money). Presentation of persisted
// withholding only — no amount is derived here, so no CA sign-off is involved.
// Invoices: GST invoices the host is the BUYER of (plan renewals + bookings they paid
// for), same data and download link as the old Invoices page.
import { useCallback, useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { getIntelligenceMoney, getMyInvoices, invoiceUrl } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { Panel, cn, fmtDay, inr } from '../../components/dashboard/ui/v2';
import { MoneyEmpty, ring, tappable } from './MoneyV2';

const money = (v) => inr(v, { decimals: Number(v) % 1 !== 0 });

// Tax lines with ₹0 dropped (Kept: hide zero lines). Exported for tests.
export const taxLines = (w) => (w ? [
  { label: 'TDS', note: 'Income tax, section 194-O', value: Number(w.tds) || 0 },
  { label: 'TCS', note: 'GST, section 52', value: Number(w.tcs) || 0 },
].filter((l) => l.value > 0) : []);

const TaxPanel = () => {
  const [w, setW] = useState(undefined); // undefined loading · null unavailable · object
  useEffect(() => {
    getIntelligenceMoney().then(({ data }) => setW(data?.withholding || null)).catch(() => setW(null));
  }, []);
  if (w === undefined) return <Skeleton className="h-[150px] rounded-[24px]" />;
  const lines = taxLines(w);
  return (
    <Panel title="Tax withheld" subtitle={w?.fyLabel || 'This financial year'} flush={lines.length > 0}>
      {w === null && <p className="mb-0 text-[14px] text-muted">Tax figures aren&apos;t available right now. Your payouts aren&apos;t affected.</p>}
      {w && !lines.length && <p className="mb-0 text-[14px] text-muted">No tax has been withheld from your payouts this financial year.</p>}
      {lines.length > 0 && (
        <>
          <ul>
            {lines.map((l, i) => (
              <li key={l.label} className={cn('flex min-h-[60px] items-center gap-3 px-4 py-3 sm:px-5', i > 0 && 'border-t border-neutral-200')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{l.label}</span>
                  <span className="block truncate text-[12.5px] text-muted lg:text-[13.5px]">{l.note}</span>
                </span>
                <span className="shrink-0 font-display text-[16px] font-extrabold tabular-nums text-ink">{money(l.value)}</span>
              </li>
            ))}
          </ul>
          {/* The one line that explains it. */}
          <p className="mb-0 border-t border-neutral-200 px-4 py-3 text-[13px] text-muted sm:px-5">
            This went to the government against your PAN. Claim it when you file your return.
          </p>
        </>
      )}
    </Panel>
  );
};

const InvoiceRow = ({ inv, first }) => {
  const plan = inv.source_type === 'subscription';
  return (
    <li>
      <a href={invoiceUrl(inv.id, inv.access_token)} target="_blank" rel="noreferrer"
        className={cn('flex w-full items-center gap-3 pl-4 transition-colors hover:bg-pink-50 active:bg-pink-100 sm:pl-5', tappable, ring, 'focus-visible:ring-inset')}>
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-maroon"><FileText className="h-[18px] w-[18px]" strokeWidth={2} /></span>
        <span className={cn('flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-3 pr-4 sm:pr-5', !first && 'border-t border-neutral-200')}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink lg:text-[15px]">{plan ? 'Plan renewal' : 'Booking you paid for'}</span>
            <span className="block truncate text-[12.5px] text-muted lg:text-[13.5px]">{fmtDay(inv.issued_at)} · {inv.invoice_number}</span>
          </span>
          <span className="shrink-0 font-display text-[15px] font-extrabold tabular-nums text-ink lg:text-[16px]">{money(inv.total)}</span>
          <Download aria-label="Download" className="h-[18px] w-[18px] shrink-0 text-maroon" strokeWidth={2.2} />
        </span>
      </a>
    </li>
  );
};

const InvoiceList = () => {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    setInvoices(null);
    getMyInvoices().then(({ data }) => setInvoices(data || [])).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <Panel><ErrorState title="We couldn't load your invoices." message="Nothing is lost. This is a problem showing them." onRetry={load} /></Panel>;
  if (!invoices) return <Skeleton className="h-[260px] rounded-[24px]" />;
  if (!invoices.length) {
    return <Panel><MoneyEmpty title="No invoices yet">GST invoices for your plan and for bookings you pay for show up here.</MoneyEmpty></Panel>;
  }
  return (
    <Panel title="Your invoices" subtitle="GST invoices for your plan and for bookings you paid for" flush>
      <ul>{invoices.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} first={i === 0} />)}</ul>
    </Panel>
  );
};

export default function InvoicesTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-5">
      <InvoiceList />
      <TaxPanel />
    </div>
  );
}
