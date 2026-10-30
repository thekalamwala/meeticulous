// Follow-ups — everyone who needs another call, in one place: overdue, today,
// tomorrow, this week, and interested leads with no next step. Filters on the
// left, the list in the middle, the selected lead on the right.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, Btn, Badge, Skeleton } from '../../../components/admin/ui';
import { crmColdCallFollowUps, crmColdCallSetFollowUp, crmColdCallStats } from '../../../services/api';
import Drawer from '../../../components/admin/seo/Drawer';
import { Kpi, HEADING } from './ccUi';
import { OUTCOMES, outcomeLabel, outcomeTone, formatPhone, countdown, safeUrl, ago } from './coldCallUtils';

const BASE = '/admin/sales/cold-calling';
const BUCKETS = [
  ['overdue', 'Overdue', 'alert', 'red', 'past due'],
  ['today', 'Due today', 'clock', 'orange', 'call today'],
  ['tomorrow', 'Tomorrow', 'calendar', 'green', 'planned'],
  ['week', 'This week', 'calCheck', 'gray', 'next 7 days'],
  ['nodate', 'No date', 'help', 'blue', 'no next step'],
];
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

function Reschedule({ value, onSave, onCancel }) {
  const [at, setAt] = useState(value ? toLocalInput(value) : '');
  return (
    <div className="flex items-center gap-1.5">
      <input type="datetime-local" className="fb-input text-[12.5px] !w-auto !min-h-0 !py-1" value={at} onChange={(e) => setAt(e.target.value)} aria-label="New follow-up time" />
      <Btn size="sm" disabled={!at} onClick={() => onSave(new Date(at).toISOString())}>Save</Btn>
      <Btn size="sm" variant="ghost" onClick={onCancel}>✕</Btn>
    </div>
  );
}

export default function ColdCallFollowUps() {
  const { lists, now } = useOutletContext();
  const navigate = useNavigate();
  const [bucket, setBucket] = useState('overdue');
  const [filters, setFilters] = useState({ outcome: '', listId: '', category: '', priority: '', q: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null);
  const [week, setWeek] = useState(null);
  const [picked, setPicked] = useState(null);       // lead shown in the right panel
  const [checked, setChecked] = useState(new Set());
  const [editing, setEditing] = useState(null);     // lead id being rescheduled ('bulk' for selection)

  const load = useCallback(() => {
    crmColdCallFollowUps({ bucket, page, pageSize, ...filters })
      .then(({ data: d }) => { setData(d); setPicked((p) => (p && d.rows.find((r) => r.lead.id === p.lead.id)) || null); })
      .catch((e) => { toast.error(e.response?.data?.message || 'Could not load follow-ups'); setData({ rows: [], total: 0, counts: {} }); });
  }, [bucket, page, pageSize, filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { crmColdCallStats(7).then(({ data: s }) => setWeek(s)).catch(() => setWeek(null)); }, []);
  useEffect(() => { setChecked(new Set()); }, [bucket, page, filters]);

  const setF = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const act = async (ids, body, msg) => {
    try { for (const id of ids) await crmColdCallSetFollowUp(id, body); toast.success(msg); setEditing(null); setChecked(new Set()); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not update'); }
  };

  const counts = data?.counts || {};
  const rows = data?.rows || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / pageSize));
  const sel = picked?.lead;
  const pcc = sel?.attributes?.cold_call || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex-[3_1_620px] grid grid-cols-2 sm:grid-cols-5 gap-3">
          {BUCKETS.map(([k, label, icon, tone, sub]) => (
            <button key={k} type="button" onClick={() => { setBucket(k); setPage(1); }} className={`!min-h-0 text-left rounded-2xl ${bucket === k ? 'ring-2 ring-[#960D32]/50' : ''}`}>
              <Kpi icon={icon} tone={tone} value={counts[k] ?? '—'} label={label} sub={sub} />
            </button>
          ))}
        </div>
        <Card className="flex-[1_1_300px] !p-4">
          <div className="text-[13.5px] font-bold adm-t1 mb-2" style={HEADING}>Follow-up conversion · 7 days</div>
          {!week ? <Skeleton className="h-10" /> : (
            <div className="flex items-center justify-between gap-1 text-center">
              {[['Calls', week.calls], ['Connected', week.connected], ['Interested', week.interested], ['Signed up', week.signedUp]].map(([l, n], i) => (
                <div key={l} className="flex items-center gap-1">{i > 0 && <span className="adm-t3">→</span>}<div><div className="text-[18px] font-extrabold adm-t1" style={HEADING}>{n}</div><div className="text-[10.5px] adm-t3">{l}</div></div></div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap xl:flex-nowrap gap-4 items-start">
        <Card className="w-full xl:w-[220px] xl:shrink-0 !p-4 space-y-3">
          <div className="flex items-center justify-between"><span className="text-[14px] font-bold adm-t1" style={HEADING}>Filters</span>
            <button type="button" className="!min-h-0 text-[12px] font-semibold text-[#960D32]" onClick={() => { setFilters({ outcome: '', listId: '', category: '', priority: '', q: '' }); setPage(1); }}>Reset</button></div>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide adm-t3">Search</span>
            <input className="fb-input text-[13px] !w-full !min-h-0 !py-1.5 mt-1" placeholder="Business or phone" value={filters.q} onChange={(e) => setF('q', e.target.value)} /></label>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide adm-t3">When</span>
            {BUCKETS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] adm-t2 py-1 cursor-pointer">
                <input type="radio" name="bucket" className="!w-4 !h-4 !min-h-0 !p-0 accent-[#960D32]" checked={bucket === k} onChange={() => { setBucket(k); setPage(1); }} />
                <span className="flex-1">{label}</span><span className="adm-t3">{counts[k] ?? ''}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-[13px] adm-t2 py-1 cursor-pointer">
              <input type="radio" name="bucket" className="!w-4 !h-4 !min-h-0 !p-0 accent-[#960D32]" checked={bucket === 'all'} onChange={() => { setBucket('all'); setPage(1); }} /> All scheduled
            </label>
          </div>
          {[
            ['outcome', 'Last outcome', [['', 'All outcomes'], ...OUTCOMES.map((o) => [o.key, o.label])]],
            ['listId', 'List', [['', 'All lists'], ...(lists || []).filter((l) => l.source === 'cold_call').map((l) => [l.id, l.name])]],
            ['priority', 'Priority', [['', 'All priorities'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']]],
          ].map(([k, label, opts]) => (
            <label key={k} className="block"><span className="text-[11px] font-semibold uppercase tracking-wide adm-t3">{label}</span>
              <select className="fb-input text-[13px] !w-full !min-h-0 !py-1.5 mt-1" value={filters[k]} onChange={(e) => setF(k, e.target.value)}>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
          ))}
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide adm-t3">Category</span>
            <input className="fb-input text-[13px] !w-full !min-h-0 !py-1.5 mt-1" placeholder="e.g. Dental" value={filters.category} onChange={(e) => setF('category', e.target.value)} /></label>
        </Card>

        <Card className="flex-1 min-w-0 !p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b adm-border">
            <div className="text-[15px] font-bold adm-t1" style={HEADING}>Follow-ups <span className="adm-t3 font-medium">({data?.total ?? '…'})</span></div>
            {checked.size > 0 && (editing === 'bulk'
              ? <Reschedule onSave={(at) => act([...checked], { at }, `Rescheduled ${checked.size}`)} onCancel={() => setEditing(null)} />
              : <span className="flex gap-2"><Btn size="sm" variant="outline" onClick={() => setEditing('bulk')}>Reschedule {checked.size}</Btn><Btn size="sm" variant="outline" onClick={() => act([...checked], { done: true }, `Marked ${checked.size} done`)}>Mark done</Btn></span>)}
          </div>
          {data === null ? <div className="p-4"><Skeleton className="h-64" /></div> : rows.length === 0 ? <div className="p-10 text-center adm-t3 text-[13px]">Nothing here.</div> : (
            <div className="overflow-x-auto">
              <table className="adm-table w-full text-left min-w-[760px]">
                <thead><tr className="text-[11px] font-semibold uppercase tracking-wide adm-t3">
                  <th className="px-3 py-2.5 w-8"><input type="checkbox" aria-label="Select all" className="!w-4 !h-4 !min-h-0 !p-0 accent-[#960D32]" checked={checked.size === rows.length} onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.lead.id)) : new Set())} /></th>
                  <th className="px-3 py-2.5">Business</th><th className="px-3 py-2.5">Last call</th><th className="px-3 py-2.5">Outcome</th>
                  <th className="px-3 py-2.5">Next follow-up</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const cc = r.lead.attributes?.cold_call || {};
                    const overdue = r.nextAt && new Date(r.nextAt) < now;
                    const on = picked?.lead.id === r.lead.id;
                    return (
                      <tr key={r.lead.id} onClick={() => setPicked(r)} className={`cursor-pointer adm-hoverable ${on ? 'bg-[#960D32]/[0.06]' : ''}`}>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Select" className="!w-4 !h-4 !min-h-0 !p-0 accent-[#960D32]" checked={checked.has(r.lead.id)}
                          onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.lead.id); else n.delete(r.lead.id); return n; })} /></td>
                        <td className="px-3 py-2.5"><div className="text-[13px] font-semibold adm-t1 truncate max-w-[220px]">{r.lead.business_name || r.lead.name || 'Lead'}</div>{r.hotAt && <div className="text-[11px] font-semibold text-red-600">🔥 Clicked link {ago(r.hotAt, now)}</div>}{r.lead.profile_id && <div className="text-[11px] font-semibold text-emerald-700">✓ Signed up</div>}<div className="text-[11.5px] adm-t3 truncate max-w-[220px]">{[r.lead.profession, cc.locality].filter(Boolean).join(' · ')}</div></td>
                        <td className="px-3 py-2.5 text-[12.5px] adm-t2 whitespace-nowrap">{fmt(r.lastCallAt)}</td>
                        <td className="px-3 py-2.5"><Badge tone={outcomeTone(cc.last_outcome)}>{outcomeLabel(cc.last_outcome) || '—'}</Badge>{r.lastNote && <div className="text-[11px] adm-t3 mt-1 truncate max-w-[200px]" title={r.lastNote}>{r.lastNote}</div>}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{editing === r.lead.id
                          ? <span onClick={(e) => e.stopPropagation()}><Reschedule value={r.nextAt} onSave={(at) => act([r.lead.id], { at }, 'Rescheduled')} onCancel={() => setEditing(null)} /></span>
                          : r.nextAt ? <><div className={`text-[12.5px] font-semibold ${overdue ? 'text-red-600' : 'adm-t1'}`}>{fmt(r.nextAt)}</div><div className={`text-[11px] ${overdue ? 'text-red-600' : 'adm-t3'}`}>{countdown(r.nextAt, now)}</div></>
                            : <span className="text-[12px] text-blue-600 font-semibold">Set a next step</span>}</td>
                        <td className="px-3 py-2.5">{cc.priority ? <Badge tone="warn">{cc.priority}</Badge> : '—'}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="!min-h-0 rounded-lg border adm-border px-2 py-1 text-[12px] font-semibold text-[#960D32] adm-hoverable" onClick={() => navigate(`${BASE}/lead/${r.lead.id}`)}>Call</button>{' '}
                          <button type="button" className="!min-h-0 rounded-lg border adm-border px-2 py-1 text-[12px] adm-t2 adm-hoverable" onClick={() => setEditing(r.lead.id)}>Reschedule</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t adm-border text-[12.5px] adm-t3">
            <div className="flex items-center gap-1">
              <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Btn>
              <span className="px-2">Page {page} of {pages}</span>
              <Btn size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</Btn>
            </div>
            <label className="flex items-center gap-2">Rows per page
              <select className="fb-input text-[12.5px] !w-auto !min-h-0 !py-1" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[12, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select></label>
          </div>
        </Card>

        <Drawer open={!!sel} onClose={() => setPicked(null)} width="max-w-md" title={sel?.business_name || sel?.name || 'Lead'} subtitle={sel ? [sel.profession, pcc.locality].filter(Boolean).join(' · ') : ''}>
        {sel && (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#960D32]/15 text-[#960D32] font-bold flex items-center justify-center shrink-0" style={HEADING}>{String(sel.business_name || sel.name || '?').slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1 flex flex-wrap gap-1.5 items-center">{pcc.fit && <Badge tone="ok">High fit · {pcc.fit}</Badge>}{pcc.priority && <Badge tone="warn">{pcc.priority}</Badge>}<Badge tone={outcomeTone(pcc.last_outcome)}>{outcomeLabel(pcc.last_outcome) || '—'}</Badge></div>
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              {[['Contact', [sel.name, pcc.role].filter(Boolean).join(' · ') || '—'], ['Phone', formatPhone(sel.phone)], ['Email', sel.email || 'Not captured'],
                ['Address', pcc.address || [pcc.locality, sel.city].filter(Boolean).join(', ') || '—'], ['Rating', pcc.rating ? `${pcc.rating} ★ (${pcc.reviews || 0})` : '—']].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[72px_1fr] gap-2"><span className="adm-t3">{k}</span><span className="adm-t1 break-words">{v}</span></div>
              ))}
              {safeUrl(pcc.maps_url) && <a href={safeUrl(pcc.maps_url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#960D32]">View on Maps ↗</a>}
            </div>
            <div className="border-l-[3px] border-[#960D32] pl-2.5">
              <div className="text-[13px] font-bold adm-t1" style={HEADING}>Last call</div>
              <div className="text-[11.5px] adm-t3">{fmt(picked.lastCallAt)} · {outcomeLabel(pcc.last_outcome) || '—'}</div>
            </div>
            {picked.lastNote && <div className="rounded-lg adm-chip p-2.5 text-[12.5px] adm-t2">“{picked.lastNote}”</div>}
            <div className="border-l-[3px] border-[#960D32] pl-2.5"><div className="text-[13px] font-bold adm-t1" style={HEADING}>Next follow-up</div></div>
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="adm-t1">{picked.nextAt ? fmt(picked.nextAt) : 'Not scheduled'}</span>
              {picked.nextAt && new Date(picked.nextAt) < now && <Badge tone="danger">{countdown(picked.nextAt, now)}</Badge>}
            </div>
            {editing === `p:${sel.id}` && <Reschedule value={picked.nextAt} onSave={(at) => act([sel.id], { at }, 'Rescheduled')} onCancel={() => setEditing(null)} />}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link to={`${BASE}/lead/${sel.id}`} className="col-span-2 inline-flex justify-center items-center rounded-xl py-2 text-[13px] font-semibold bg-[#960D32] text-white hover:bg-[#e54900]">Call now</Link>
              <Btn variant="outline" className="justify-center" onClick={() => setEditing(`p:${sel.id}`)}>Reschedule</Btn>
              <Btn variant="outline" className="justify-center" onClick={() => act([sel.id], { done: true }, 'Marked done')}>Mark done</Btn>
            </div>
          </div>
        )}
        </Drawer>
      </div>
    </div>
  );
}
