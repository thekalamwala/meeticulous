// Lists — every cold-calling list with how far it has got. Pick the one to call
// from, or upload a new CSV.
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Btn, Badge, Skeleton } from '../../../components/admin/ui';
import { crmColdCallStats } from '../../../services/api';
import { Bar, pct, HEADING } from './ccUi';

export default function ColdCallLists() {
  const { listId, setListId } = useOutletContext();
  const [s, setS] = useState(null);
  useEffect(() => { crmColdCallStats(7).then(({ data }) => setS(data)).catch(() => setS(false)); }, []);

  if (s === null) return <Skeleton className="h-48 rounded-2xl" />;
  if (!s) return <Card className="p-10 text-center adm-t3">Couldn't load the lists. Reload to retry.</Card>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.lists.map((l) => {
          const called = l.total - l.fresh;
          const on = l.id === listId;
          return (
            <Card key={l.id} className={`!p-5 space-y-3 ${on ? '!border-[#0079C1]/50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-bold adm-t1" style={HEADING}>{l.name}</h3>
                {on ? <Badge tone="ok">In use</Badge> : <Btn size="sm" variant="outline" onClick={() => setListId(l.id)}>Use</Btn>}
              </div>
              <Bar value={pct(called, l.total)} />
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Leads', l.total], ['Called', called], ['Interested', l.interested]].map(([k, v]) => (
                  <div key={k} className="rounded-xl adm-chip py-2"><div className="text-[17px] font-extrabold adm-t1" style={HEADING}>{v.toLocaleString('en-IN')}</div><div className="text-[11px] adm-t3">{k}</div></div>
                ))}
              </div>
              <div className="text-[12px] adm-t3">{pct(called, l.total)}% called · {l.fresh.toLocaleString('en-IN')} left</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
