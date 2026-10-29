// AdminGstReconciliation.jsx — /admin/gst/reconciliation.
// Internal cross-check: invoices (GST source of truth) vs the ledger's GST
// Payable control account (2100). External GST-portal/GSP source is not
// connected (framework hook only).
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Skeleton } from '../../components/admin/ui';
import { adminGstReconciliation } from '../../services/api';
import { inr, PeriodFilter, defaultPeriod, periodParams } from './gstShared';

export default function AdminGstReconciliation() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstReconciliation(periodParams(period));
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load reconciliation');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="GST Reconciliation" subtitle="Invoices vs ledger GST Payable (2100) — internal control check" />
      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !data ? (
        <Card>Could not load reconciliation for this period.</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <div className="text-[11px] uppercase tracking-wide adm-t3">Our GST (invoices)</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{inr(data.ours?.gst)}</div>
              <div className="text-xs adm-t3 mt-1">{data.ours?.invoices} invoices</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wide adm-t3">Ledger GST movement (2100)</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{data.ledger?.found ? inr(data.ledger?.gst) : '—'}</div>
              <div className="text-xs adm-t3 mt-1">{data.ledger?.found ? `credit ${inr(data.ledger.credit)} · debit ${inr(data.ledger.debit)}` : 'GST Payable account not found'}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-wide adm-t3">Difference</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{inr(data.difference)}</div>
              <div className="mt-2"><Badge tone={data.status === 'matched' ? 'ok' : 'danger'}>{data.status}</Badge></div>
            </Card>
          </div>

          {data.reason && (
            <Card className="mb-4">
              <div className="text-sm font-semibold mb-1">Why they differ</div>
              <div className="text-sm adm-t2">{data.reason}</div>
              <div className="text-xs adm-t3 mt-2">Refunds reverse GST in the ledger but the invoice is never credit-noted (pending CA), so a period with refunds is expected to differ.</div>
            </Card>
          )}

          <Card>
            <div className="text-sm font-semibold mb-1">External source</div>
            <div className="text-sm adm-t3">Not connected. GST-portal / GSP / accounting-software reconciliation can be wired into this framework later — no external integration is built.</div>
          </Card>
        </>
      )}
    </div>
  );
}
