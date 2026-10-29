// AdminGstIssues.jsx — /admin/gst/issues — the GST Action Center (§4).
// Exceptions are computed server-side from real data; this page shows them and
// lets finance set a resolution status (open/under_review/resolved/ignored),
// which is persisted in gst_issue_status and audited.
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Skeleton } from '../../components/admin/ui';
import { adminGstIssues, adminGstSetIssueStatus } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams } from './gstShared';

const STATUSES = ['open', 'under_review', 'resolved', 'ignored'];
const SEV_TONE = { high: 'danger', medium: 'warn', low: 'neutral' };
const STATUS_TONE = { open: 'warn', under_review: 'info', resolved: 'ok', ignored: 'neutral' };
const sevRank = { high: 0, medium: 1, low: 2 };

export default function AdminGstIssues() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState({ issues: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstIssues({ ...periodParams(period), ...(statusFilter ? { status: statusFilter } : {}) });
      const issues = (res.data.issues || []).slice().sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]));
      setData({ issues, summary: res.data.summary });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load GST issues');
      setData({ issues: [], summary: null });
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (issue, status) => {
    const rowKey = `${issue.type}:${issue.sourceType}:${issue.sourceId}`;
    setSaving(rowKey);
    try {
      await adminGstSetIssueStatus({ issue_type: issue.type, source_type: issue.sourceType, source_id: issue.sourceId, status });
      toast.success('Status updated');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update status');
    } finally {
      setSaving(null);
    }
  };

  const s = data.summary;

  return (
    <div>
      <PageHeader title="GST Action Center" subtitle="Transactions that need attention — resolve, review or mark not-applicable" />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Status
          <select className="fb-input text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
          </select>
        </label>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card><div className="text-[11px] uppercase tracking-wide adm-t3">Open + reviewing</div><div className="text-2xl font-semibold">{num(s.total)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide adm-t3">High</div><div className="text-2xl font-semibold" style={{ color: 'var(--adm-danger)' }}>{num(s.high)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide adm-t3">Medium</div><div className="text-2xl font-semibold" style={{ color: 'var(--adm-warn)' }}>{num(s.medium)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide adm-t3">Low</div><div className="text-2xl font-semibold">{num(s.low)}</div></Card>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data.issues.length ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No issues for this period — records look clean.</div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                  <th className="text-left px-4 py-3">Severity</th>
                  <th className="text-left px-4 py-3">Issue</th>
                  <th className="text-left px-4 py-3">Detail</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Set</th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((i) => {
                  const rowKey = `${i.type}:${i.sourceType}:${i.sourceId}`;
                  return (
                    <tr key={rowKey} className="border-b adm-border last:border-0">
                      <td className="px-4 py-3"><Badge tone={SEV_TONE[i.severity]}>{i.severity}</Badge></td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{i.type}</td>
                      <td className="px-4 py-3 adm-t2 max-w-[320px]">{i.message}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{i.amount != null ? inr(i.amount) : '—'}</td>
                      <td className="px-4 py-3 adm-t3 whitespace-nowrap">{i.sourceType} · {String(i.sourceId).slice(0, 8)}…</td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONE[i.status] || 'neutral'}>{(i.status || 'open').replace('_', ' ')}</Badge></td>
                      <td className="px-4 py-3">
                        <select
                          className="fb-input text-sm"
                          value={i.status || 'open'}
                          disabled={saving === rowKey}
                          onChange={(e) => setStatus(i, e.target.value)}
                        >
                          {STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
