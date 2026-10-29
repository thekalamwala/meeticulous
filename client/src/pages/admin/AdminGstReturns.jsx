// AdminGstReturns.jsx — /admin/gst/returns — filing status tracker.
// A 12-month (Apr–Mar) × {GSTR-1, GSTR-3B} grid. Status is tracked in
// gst_returns; "Filed" requires an ARN (server-enforced). Marking filed needs
// the gst.returns_file permission.
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Btn, Skeleton } from '../../components/admin/ui';
import { adminGstReturns, adminGstSetReturnStatus } from '../../services/api';
import { MONTHS } from './gstShared';

const STATUSES = ['not_started', 'preparing', 'needs_review', 'ready', 'filed'];
const TONE = { not_started: 'neutral', preparing: 'info', needs_review: 'warn', ready: 'ok', filed: 'ok' };
const RETURN_TYPES = ['GSTR1', 'GSTR3B'];

// FY months in filing order: Apr(4)…Dec(12), Jan(1)…Mar(3).
const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const pkey = (calMonth) => `M${String(calMonth).padStart(2, '0')}`;

function currentFy2() {
  const d = new Date(Date.now() + 330 * 60000);
  const m = d.getUTCMonth() + 1;
  const fyStart = m >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return String(fyStart % 100).padStart(2, '0');
}

export default function AdminGstReturns() {
  const [fy, setFy] = useState(currentFy2);
  const [byKey, setByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null); // { calMonth, return_type, status, arn }

  const fyOptions = [0, 1, 2].map((b) => {
    const s = 2000 + Number(currentFy2()) - b;
    return { fy2: String(s % 100).padStart(2, '0'), label: `FY ${s}-${String((s + 1) % 100).padStart(2, '0')}` };
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstReturns({ fy });
      const map = {};
      for (const r of res.data.returns || []) map[`${r.period_key}:${r.return_type}`] = r;
      setByKey(map);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load returns');
      setByKey({});
    } finally {
      setLoading(false);
    }
  }, [fy]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (edit.status === 'filed' && !edit.arn?.trim()) { toast.error('An ARN is required to mark a return filed'); return; }
    try {
      await adminGstSetReturnStatus({
        fiscal_year: fy, period_type: 'month', period_key: pkey(edit.calMonth),
        return_type: edit.return_type, status: edit.status, arn: edit.arn?.trim() || undefined,
      });
      toast.success('Return updated');
      setEdit(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update return');
    }
  };

  const cell = (calMonth, rt) => {
    const r = byKey[`${pkey(calMonth)}:${rt}`];
    const status = r?.status || 'not_started';
    return (
      <button
        className="w-full text-left px-3 py-2 rounded-xl border adm-border adm-hoverable"
        onClick={() => setEdit({ calMonth, return_type: rt, status, arn: r?.arn || '' })}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs adm-t3">{rt.replace('GSTR', 'GSTR-')}</span>
          <Badge tone={TONE[status]}>{status.replace('_', ' ')}</Badge>
        </div>
        {r?.arn && <div className="text-[11px] adm-t3 mt-1 truncate">ARN {r.arn}</div>}
      </button>
    );
  };

  return (
    <div>
      <PageHeader title="GST Returns" subtitle="Preparation & filing status per period (monthly filer)" />

      <div className="mb-4">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3 w-fit">
          Financial year
          <select className="fb-input text-sm" value={fy} onChange={(e) => setFy(e.target.value)}>
            {fyOptions.map((o) => <option key={o.fy2} value={o.fy2}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FY_MONTHS.map((m) => (
            <Card key={m}>
              <div className="text-sm font-semibold mb-2">{MONTHS[m - 1]}</div>
              <div className="space-y-2">
                {RETURN_TYPES.map((rt) => <div key={rt}>{cell(m, rt)}</div>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setEdit(null)}>
          <div className="adm-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-1">{MONTHS[edit.calMonth - 1]} · {edit.return_type.replace('GSTR', 'GSTR-')}</div>
            <div className="text-xs adm-t3 mb-4">Set the preparation / filing status for this return.</div>

            <label className="block text-[11px] uppercase tracking-wide adm-t3 mb-1">Status</label>
            <select className="fb-input text-sm w-full mb-3" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
              {STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
            </select>

            {edit.status === 'filed' && (
              <>
                <label className="block text-[11px] uppercase tracking-wide adm-t3 mb-1">ARN (required to file)</label>
                <input className="fb-input text-sm w-full mb-3" value={edit.arn} placeholder="Acknowledgement Reference Number" onChange={(e) => setEdit({ ...edit, arn: e.target.value })} />
              </>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Btn variant="outline" size="sm" onClick={() => setEdit(null)}>Cancel</Btn>
              <Btn variant="primary" size="sm" onClick={save}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
