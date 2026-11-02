import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Btn } from '../../../components/admin/ui';
import { crmListFollowUps, crmCompleteFollowUp } from '../../../services/api';
import { relTime } from './salesConstants';
import toast from 'react-hot-toast';

export default function SalesFollowUps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => crmListFollowUps({})
    .then(({ data }) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const done = async (id) => { try { await crmCompleteFollowUp(id); toast.success('Done'); load(); } catch { toast.error('Failed'); } };

  const now = Date.now();
  const dayEnd = new Date(new Date().setHours(23, 59, 59)).getTime();
  const groups = [
    { key: 'overdue', label: 'Overdue', items: items.filter((f) => new Date(f.due_at).getTime() < now) },
    { key: 'today', label: 'Today', items: items.filter((f) => { const t = new Date(f.due_at).getTime(); return t >= now && t <= dayEnd; }) },
    { key: 'upcoming', label: 'Upcoming', items: items.filter((f) => new Date(f.due_at).getTime() > dayEnd) },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Follow-ups" subtitle={`${items.length} open`} />
      {loading ? <p className="adm-t3">Loading…</p> : items.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center adm-t3">All clear.</Card>
      ) : groups.filter((g) => g.items.length).map((g) => (
        <div key={g.key} className="mb-6">
          <h2 className={`text-sm font-bold uppercase tracking-wide mb-2 ${g.key === 'overdue' ? 'text-red-500' : 'adm-t2'}`}>{g.label} ({g.items.length})</h2>
          <Card className="rounded-2xl divide-y divide-gray-100">
            {g.items.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link to={`/admin/sales/leads/${f.lead_id}`} className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium adm-t1 truncate">{f.title}</p>
                  <p className="text-[11px] adm-t3">{relTime(f.due_at)}</p>
                </Link>
                <Btn variant="outline" size="sm" onClick={() => done(f.id)}>Done</Btn>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
