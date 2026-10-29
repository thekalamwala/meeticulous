import { useEffect, useState, useCallback } from 'react';
import { Card } from '../../../components/admin/ui';
import { crmListLeads } from '../../../services/api';
import { FUNNEL, STATUS_LABEL, rupees, relTime } from './salesConstants';
import { guardedSetStatus } from './statusMove';
import toast from 'react-hot-toast';

const PER_COL = 40;

// Board (Kanban) view of the leads database — respects the active filters
// (source/tag/search). Drag a card between stage columns to change its stage.
export default function LeadsBoard({ filters = {}, onOpen }) {
  const [cols, setCols] = useState({});
  const [loading, setLoading] = useState(true);
  const [over, setOver] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all(FUNNEL.map((s) =>
      crmListLeads({ leadType: 'host', ...filters, status: s, pageSize: PER_COL }).then(({ data }) => [s, data]).catch(() => [s, { rows: [], total: 0 }])
    )).then((pairs) => setCols(Object.fromEntries(pairs))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  const onDrop = async (to) => {
    setOver(null);
    const d = window.__crmDrag; window.__crmDrag = null;
    if (!d || d.from === to) return;
    const lead = (cols[d.from]?.rows || []).find((r) => r.id === d.id);
    if (!lead) return;
    setCols((c) => ({
      ...c,
      [d.from]: { rows: c[d.from].rows.filter((r) => r.id !== d.id), total: Math.max(0, (c[d.from].total || 1) - 1) },
      [to]: { rows: [{ ...lead, status: to }, ...(c[to]?.rows || [])], total: (c[to]?.total || 0) + 1 },
    }));
    try {
      const ok = await guardedSetStatus(d.id, d.from, to);   // reason prompt on backward/exit
      if (ok) toast.success(`${lead.name || 'Lead'} → ${STATUS_LABEL[to]}`);
      else load();                                            // cancelled → revert
    } catch { toast.error('Move failed'); load(); }
  };

  if (loading) return <p className="adm-t3">Loading…</p>;
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {FUNNEL.map((s) => {
        const col = cols[s] || { rows: [], total: 0 };
        return (
          <div key={s} className={`flex-shrink-0 w-64 rounded-xl p-1 transition ${over === s ? 'bg-[#2E1065]/10 ring-1 ring-[#2E1065]/40' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver((d) => (d === s ? null : d))}
            onDrop={() => onDrop(s)}>
            <div className="flex items-center justify-between mb-2 px-2 pt-1">
              <h3 className="text-[12px] font-bold adm-t1 uppercase tracking-wide">{STATUS_LABEL[s]}</h3>
              <span className="text-[11px] adm-t3">{col.total}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {col.rows.length === 0 && <p className="text-[11px] adm-t3 px-2">—</p>}
              {col.rows.map((r) => (
                <Card key={r.id} className="rounded-xl p-3 cursor-grab active:cursor-grabbing adm-hoverable"
                  draggable onDragStart={() => { window.__crmDrag = { id: r.id, from: s }; }}
                  onClick={() => onOpen?.(r.id)}>
                  <p className="text-[13px] font-semibold adm-t1 truncate">{r.name || 'Unnamed'}</p>
                  {r.business_name && <p className="text-[11px] adm-t3 truncate">{r.business_name}</p>}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] adm-t3">{relTime(r.last_activity_at || r.created_at)}</span>
                    {(r.expected_value_paise || r.revenue_paise) > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-600">{rupees(r.expected_value_paise || r.revenue_paise)}</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
