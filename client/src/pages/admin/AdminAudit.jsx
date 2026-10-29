import { useState, useEffect, useCallback } from 'react';
import { adminAuditLogs, adminAuditActions } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Btn, Skeleton } from '../../components/admin/ui';

// Read-only viewer for the append-only admin action trail (admin_audit_logs).
// Filter by action + date range; paginated. Every mutating admin endpoint writes
// here, so this is the single place to answer "who did what, when".

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const AdminAudit = () => {
  const [logs, setLogs]       = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.action) params.action = filters.action;
      if (filters.from) params.from = new Date(filters.from).toISOString();
      if (filters.to) params.to = new Date(filters.to).toISOString();
      const { data } = await adminAuditLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { adminAuditActions().then((r) => setActions(r.data.actions || [])).catch(() => {}); }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle={`Append-only trail of every admin action. ${total} record${total === 1 ? '' : 's'}.`} />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">Action</label>
          <select className="fb-input text-sm" value={filters.action}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, action: e.target.value })); }}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">From</label>
          <input type="date" className="fb-input text-sm" value={filters.from}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, from: e.target.value })); }} />
        </div>
        <div>
          <label className="block text-[11px] font-medium adm-t3 mb-1">To</label>
          <input type="date" className="fb-input text-sm" value={filters.to}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, to: e.target.value })); }} />
        </div>
        {(filters.action || filters.from || filters.to) && (
          <Btn variant="outline" size="sm" onClick={() => { setPage(1); setFilters({ action: '', from: '', to: '' }); }}>Clear</Btn>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : logs.length === 0 ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No audit records match these filters.</div>
      ) : (
        <div className="adm-card rounded-2xl overflow-hidden">
          <table className="adm-table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Resource</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b adm-border last:border-0 adm-hoverable transition-colors align-top">
                  <td className="px-4 py-3 text-[12px] adm-t3 whitespace-nowrap">{fmt(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="adm-t2">{l.admin_email || '—'}</p>
                    {l.admin_role && <p className="text-[11px] adm-t3">{l.admin_role}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono font-semibold px-2 py-1 rounded adm-chip adm-t2">{l.action}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[12px] adm-t3">
                    {l.resource_type ? <>{l.resource_type}{l.resource_id ? <span className="adm-t3"> · {l.resource_id}</span> : null}</> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
          <span className="text-[12px] adm-t3">Page {page} of {totalPages}</span>
          <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
        </div>
      )}
    </div>
  );
};

export default AdminAudit;
