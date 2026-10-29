// Call History — every call logged from the Cold Calling console, newest first.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Table, Badge, Btn } from '../../../components/admin/ui';
import { crmColdCallHistory } from '../../../services/api';
import { Chips } from './ccUi';
import { OUTCOMES, outcomeLabel, outcomeTone } from './coldCallUtils';

const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ColdCallHistory() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    crmColdCallHistory({ days, outcome, page, pageSize: 25 })
      .then(({ data: d }) => { if (alive) setData(d); })
      .catch((e) => { toast.error(e.response?.data?.message || 'Could not load call history'); if (alive) setData({ rows: [], total: 0 }); });
    return () => { alive = false; };
  }, [days, outcome, page]);

  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));
  const columns = [
    { key: 'at', label: 'When', className: 'whitespace-nowrap', render: (r) => fmt(r.at) },
    { key: 'biz', label: 'Business', render: (r) => (
      <div className="min-w-0"><div className="font-semibold adm-t1 truncate max-w-[260px]">{r.lead.business_name || r.lead.name || 'Lead'}</div>
        <div className="text-[11.5px] adm-t3 truncate max-w-[260px]">{[r.lead.profession, r.lead.attributes?.cold_call?.locality].filter(Boolean).join(' · ')}</div></div>
    ) },
    { key: 'outcome', label: 'Outcome', render: (r) => <Badge tone={outcomeTone(r.outcome)}>{outcomeLabel(r.outcome)}</Badge> },
    { key: 'dur', label: 'Length', render: (r) => (r.durationMin ? `${r.durationMin} min` : '—') },
    { key: 'obj', label: 'Objection', render: (r) => r.objection || '—' },
    { key: 'note', label: 'Note', render: (r) => <span className="block truncate max-w-[280px]" title={r.note}>{r.note || '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips label="Period" value={days} onChange={(v) => { setDays(v); setPage(1); }} options={[
          { value: 1, label: 'Today' }, { value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' },
        ]} />
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] adm-t3">{data ? `${data.total} calls` : ''}</span>
          <select className="fb-input text-[13px] !w-auto !min-h-0 !py-1.5" aria-label="Outcome" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <Table columns={columns} rows={data?.rows || []} rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/admin/sales/cold-calling/lead/${r.lead.id}`)}
        empty={<div className="p-10 text-center adm-t3 text-[13px]">{data === null ? 'Loading…' : 'No calls in this period.'}</div>} />
      <div className="flex items-center justify-end gap-1 text-[12.5px] adm-t3">
        <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Btn>
        <span className="px-2">Page {page} of {pages}</span>
        <Btn size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</Btn>
      </div>
    </div>
  );
}
