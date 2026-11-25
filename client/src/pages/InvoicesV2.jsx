// Invoices — dashboard_v2 graduation. v2 look (SubNav + v2 rows in a Panel) on
// the SAME real data as Invoices.jsx: getMyInvoices (GST invoices the host is the
// BUYER of — bookings they paid for + plan renewals), same plan/booking split,
// same download URL. Shown on the flag-ON path (App picks it in InvoicesRoute).
import { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { getMyInvoices, invoiceUrl } from '../services/api';
import { ErrorState, Skeleton, fmtMoney, cn } from '../components/dashboard/ui';
import { PageHeading, Panel, SubNav, fmtDay } from '../components/dashboard/ui/v2';
import { MONEY_NAV } from './dashboardNav';

const Row = ({ inv }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="truncate font-mono text-[11px] font-semibold text-ink">{inv.invoice_number}</p>
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold',
          inv.source_type === 'subscription' ? 'bg-maroon-100 text-maroon-700' : 'bg-success-bg text-success-fg')}>
          {inv.source_type === 'subscription' ? 'Plan' : 'Booking'}
        </span>
      </div>
      <p className="text-[10.5px] font-medium text-ink/45">{fmtDay(inv.issued_at)}</p>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      <span className="text-[12px] font-bold tabular-nums text-ink">{fmtMoney(inv.total, { decimals: true })}</span>
      <a href={invoiceUrl(inv.id, inv.access_token)} target="_blank" rel="noreferrer"
        className="text-[11.5px] font-bold text-maroon hover:opacity-80">Download</a>
    </div>
  </div>
);

export default function InvoicesV2() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setInvoices(null);
    getMyInvoices().then(({ data }) => setInvoices(data || [])).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const header = (
    <>
      <PageHeading title="Invoices" sub="GST invoices for services you booked and your plan renewals." />
    </>
  );

  if (error) {
    return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your invoices." onRetry={load} /></div>;
  }
  if (invoices === null) {
    return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-48 rounded-xl" /></div>;
  }

  const plan = invoices.filter((i) => i.source_type === 'subscription');
  const booking = invoices.filter((i) => i.source_type !== 'subscription');

  return (
    <div className="flex flex-col gap-2.5">
      {header}
      {invoices.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-1.5 py-14 text-center">
            <FileText className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">No invoices yet</p>
            <p className="max-w-sm text-[11px] font-medium text-ink/55">Invoices for bookings you pay for and plan renewals will appear here.</p>
          </div>
        </Panel>
      ) : (
        <>
          {plan.length > 0 && (
            <Panel title="Plan & subscriptions" flush>
              <div className="divide-y-2 divide-neutral-100">{plan.map((inv) => <Row key={inv.id} inv={inv} />)}</div>
            </Panel>
          )}
          {booking.length > 0 && (
            <Panel title="Bookings" flush>
              <div className="divide-y-2 divide-neutral-100">{booking.map((inv) => <Row key={inv.id} inv={inv} />)}</div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
