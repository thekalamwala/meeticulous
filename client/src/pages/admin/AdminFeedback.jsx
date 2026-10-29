// client/src/pages/admin/AdminFeedback.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListFeedback, adminUpdateFeedback } from '../../services/api';
import { PageHeader, Badge, Skeleton } from '../../components/admin/ui';

const STATUSES = ['new', 'reviewing', 'planned', 'shipped', 'declined'];
const STATUS_TONE = {
  new: 'neutral', reviewing: 'info',
  planned: 'warn', shipped: 'ok',
  declined: 'danger',
};

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // row being triaged
  const [resp, setResp] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListFeedback(filter ? { status: filter } : {}); setItems(data.feedback || []); }
    catch (e) { toast.error('Could not load feedback'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const openRow = (f) => { setActive(f); setResp(f.admin_response || ''); setNote(f.admin_note || ''); };

  const save = async (status) => {
    try {
      await adminUpdateFeedback(active.id, { status, admin_response: resp, admin_note: note });
      toast.success(`Marked ${status}`);
      setActive(null); load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Update failed'); }
  };

  return (
    <div>
      <PageHeader title="Host Feedback" actions={
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border adm-border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      } />

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        : items.length === 0 ? <p className="text-sm adm-t3">No feedback.</p>
        : (
          <div className="adm-card rounded-xl overflow-hidden">
            <table className="adm-table w-full text-sm">
              <thead className="text-xs uppercase tracking-wider adm-t3">
                <tr><th className="text-left px-4 py-2">Host</th><th className="text-left px-4 py-2">Type</th><th className="text-left px-4 py-2">Feedback</th><th className="text-left px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-t adm-border">
                    <td className="px-4 py-2 adm-t2">{f.profiles?.name || '—'}</td>
                    <td className="px-4 py-2 adm-t2">{f.type}{f.area ? ` · ${f.area}` : ''}</td>
                    <td className="px-4 py-2 max-w-md truncate adm-t2">{f.subject || f.body}</td>
                    <td className="px-4 py-2"><Badge tone={STATUS_TONE[f.status]}>{f.status}</Badge></td>
                    <td className="px-4 py-2 text-right"><button onClick={() => openRow(f)} className="text-primary text-xs font-medium hover:underline">Triage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {active && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setActive(null)}>
          <div className="adm-card w-full max-w-md h-full overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold adm-t1">{active.subject || active.type}</h2>
            <p className="text-sm adm-t2 whitespace-pre-wrap">{active.body}</p>
            <div>
              <label className="text-xs font-semibold adm-t3">Reply to vendor (sent on planned/shipped/declined)</label>
              <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={3} className="w-full border adm-border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold adm-t3">Internal note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border adm-border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => save(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium border adm-border adm-hoverable adm-t2">{s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
