// Today's Calls — just the list: the day's calls in calling order (callbacks at their promised
// time, retries, new leads up to the daily target) plus what's already done.
// Clicking a row opens the lead page.
import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Table, Badge, Btn } from '../../../components/admin/ui';
import { Chips } from './ccUi';
import { pendingPlan, outcomeLabel, outcomeTone, fmtTime, countdown, ago } from './coldCallUtils';

const WHY = {
  callback: (p, now) => ({ tone: p.overdue ? 'danger' : 'warn', text: `Callback ${fmtTime(p.dueAt)}`, sub: countdown(p.dueAt, now) }),
  later: (p, now) => ({ tone: 'neutral', text: `Callback ${fmtTime(p.dueAt)}`, sub: countdown(p.dueAt, now) }),
  retry: (p) => ({ tone: 'info', text: `Retry ${(p.lead.attributes?.cold_call?.attempts || 0) + 1}`, sub: outcomeLabel(p.lead.attributes?.cold_call?.last_outcome) }),
  new: () => ({ tone: 'neutral', text: 'New', sub: '' }),
  setup: (p) => ({ tone: 'ok', text: 'Setup call', sub: `Signed up · ${p.left} step${p.left > 1 ? 's' : ''} left` }),
};

export default function ColdCallToday() {
  const { queue, now } = useOutletContext();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const open = (id) => navigate(`/admin/sales/cold-calling/lead/${id}`);

  const plan = useMemo(() => pendingPlan(queue), [queue]);
  const done = queue.done || [];
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const callbacksToday = plan.filter((p) => (p.kind === 'callback' || p.kind === 'later') && new Date(p.dueAt) <= dayEnd);
  const nextCb = callbacksToday.find((p) => new Date(p.dueAt) >= now);
  const firstPending = plan.find((p) => p.kind !== 'later' || new Date(p.dueAt) <= dayEnd);

  const rows = useMemo(() => {
    const doneRows = done.map((d, i) => ({ key: `d${i}`, state: 'done', lead: d.lead, outcome: d.outcome, at: d.at }));
    const pendingRows = plan.map((p) => ({ key: p.lead.id, state: 'pending', lead: p.lead, kind: p.kind, item: p }));
    const all = [...doneRows, ...pendingRows].map((r, i) => ({ ...r, n: i + 1 }));
    if (filter === 'done') return all.filter((r) => r.state === 'done');
    if (filter === 'pending') return all.filter((r) => r.state === 'pending');
    if (filter === 'callbacks') return all.filter((r) => r.kind === 'callback' || r.kind === 'later');
    if (filter === 'p1') return all.filter((r) => /^p?1$/i.test(String(r.lead.attributes?.cold_call?.priority || '')));
    return all;
  }, [done, plan, filter]);

  const columns = [
    { key: 'n', label: '#', className: 'w-14', render: (r) => (
      <div><div className="font-bold adm-t1">{r.n}</div><div className="text-[11px] adm-t3">{r.state === 'done' ? fmtTime(r.at) : ''}</div></div>
    ) },
    { key: 'biz', label: 'Business', render: (r) => {
      const cc = r.lead.attributes?.cold_call || {};
      return (<div className="min-w-0"><div className="font-semibold adm-t1 truncate">{r.lead.business_name || r.lead.name || 'Lead'}{queue.hot?.[r.lead.id] && <span className="ml-2 text-[11px] font-semibold text-red-600" title={`Clicked a link ${ago(queue.hot[r.lead.id], now)}`}>🔥 clicked</span>}</div>
        <div className="text-[12px] adm-t3 truncate">{[r.lead.profession, cc.locality].filter(Boolean).join(' · ')}</div></div>);
    } },
    { key: 'why', label: 'Why today', render: (r) => {
      if (r.state === 'done') return <span className="adm-t3 text-[12px]">—</span>;
      const w = WHY[r.kind](r.item, now);
      return <div><Badge tone={w.tone}>{w.text}</Badge>{w.sub && <div className="text-[11px] adm-t3 mt-1">{w.sub}</div>}</div>;
    } },
    { key: 'status', label: 'Status', render: (r) => (r.state === 'done'
      ? <Badge tone={outcomeTone(r.outcome)}>✓ {outcomeLabel(r.outcome)}</Badge>
      : <Badge tone="neutral">Pending</Badge>) },
    { key: 'p', label: 'Priority', render: (r) => {
      const cc = r.lead.attributes?.cold_call || {};
      return <span className="text-[12px]">{cc.priority ? <Badge tone="warn">{/^p/i.test(cc.priority) ? cc.priority : `#${cc.priority}`}</Badge> : null} {cc.fit ? <span className="adm-t3">fit {cc.fit}</span> : null}</span>;
    } },
    { key: 'go', label: '', className: 'text-right', render: (r) => (
      <Btn size="sm" variant={r.state === 'done' ? 'ghost' : 'outline'} onClick={(e) => { e.stopPropagation(); open(r.lead.id); }}>{r.state === 'done' ? 'Open' : 'Call'}</Btn>
    ) },
  ];

  const t = queue.today;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips label="Filter today's calls" value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: done.length + plan.length },
          { value: 'pending', label: 'Pending', count: plan.length },
          { value: 'done', label: 'Done', count: done.length },
          { value: 'callbacks', label: 'Callbacks', count: plan.filter((p) => p.kind === 'callback' || p.kind === 'later').length },
          { value: 'p1', label: 'P1' },
        ]} />
        <div className="flex items-center gap-3">
          <span className="text-[12px] adm-t3 hidden md:inline">{t.calls} / {t.target} done{nextCb ? ` · next callback ${fmtTime(nextCb.dueAt)}` : ''}</span>
          <Btn onClick={() => firstPending && open(firstPending.lead.id)} disabled={!firstPending}>{firstPending ? 'Start calling →' : `Today's ${t.target} done`}</Btn>
        </div>
      </div>

      <Table columns={columns} rows={rows} rowKey={(r) => r.key} onRowClick={(r) => open(r.lead.id)}
        rowClassName={(r) => (r.state === 'done' ? 'opacity-70' : r.lead.id === firstPending?.lead.id ? 'bg-[#0079C1]/[0.06]' : '')}
        empty={<div className="p-10 text-center adm-t3">Nothing here.</div>} />
    </div>
  );
}
