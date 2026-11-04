import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminGetMembers, adminPatchMember } from '../../../services/communityApi';
import AdminEmptyState from '../../../components/admin/AdminEmptyState';
import { Badge, Btn, Card, Skeleton } from '../../../components/admin/ui';
import { askNote, banUntil, canModerate, errMsg } from './shared';

const fld = 'border adm-border rounded-lg px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[#960D32]/30';
const isBanned = (m) => m.banned_until && Date.parse(m.banned_until) > Date.now();

function Row({ m, can, save }) {
  const [days, setDays] = useState('7');
  const ban = () => {
    const n = days === 'permanent' ? days : Math.min(365, Math.max(1, parseInt(days, 10) || 1));
    const note = askNote(`Ban ${m.display_name} ${n === 'permanent' ? 'permanently' : `for ${n} day(s)`}?`);
    if (note === null) return;
    save(m, { banned_until: banUntil(n), ban_reason: note || 'Community guidelines' });
  };
  return (
    <Card className="!p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium adm-t1 text-[13px]">{m.display_name}</span>
        <Badge>{m.role}</Badge>
        {m.early_access && <Badge tone="ok">Early access on</Badge>}
        {isBanned(m) && <Badge tone="danger">Banned until {m.banned_until.startsWith('9999') ? 'forever' : new Date(m.banned_until).toLocaleDateString('en-IN')}</Badge>}
        <span className="text-[11px] adm-t3 ml-auto">{m.post_count} posts · {m.comment_count} comments</span>
      </div>
      {can && (
        <div className="flex flex-wrap items-center gap-3 mt-2 text-[12.5px] adm-t2">
          <label className="inline-flex items-center gap-1.5 font-semibold">
            <input type="checkbox" checked={m.early_access} onChange={(e) => save(m, { early_access: e.target.checked })} />
            Early access
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={m.links_allowed} onChange={(e) => save(m, { links_allowed: e.target.checked })} />
            Links allowed
          </label>
          <label className="inline-flex items-center gap-1.5">Badge
            <select value={m.badge || 'none'} onChange={(e) => save(m, { badge: e.target.value === 'none' ? null : e.target.value })} className={fld}>
              {['none', 'official', 'staff', 'ai'].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <span className="inline-flex items-center gap-1 ml-auto">
            {isBanned(m) ? (
              <Btn size="sm" variant="outline" onClick={() => save(m, { banned_until: null, ban_reason: null })}>Unban</Btn>
            ) : (
              <>
                <select aria-label="Ban length" value={days === 'permanent' ? 'permanent' : 'days'} onChange={(e) => setDays(e.target.value === 'permanent' ? 'permanent' : '7')} className={fld}>
                  <option value="days">Days</option><option value="permanent">Permanent</option>
                </select>
                {days !== 'permanent' && <input type="number" min="1" max="365" aria-label="Ban days" value={days} onChange={(e) => setDays(e.target.value)} className={`${fld} w-16`} />}
                <Btn size="sm" variant="danger" onClick={ban}>Ban</Btn>
              </>
            )}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function MembersTab() {
  const [q, setQ] = useState('');
  const [members, setMembers] = useState(null);
  const load = useCallback(() => adminGetMembers(q.trim())
    .then((d) => setMembers(d.members || [])).catch((e) => { setMembers([]); toast.error(errMsg(e)); }), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const save = async (m, patch) => {
    try { await adminPatchMember(m.user_id, patch); toast.success('Saved'); await load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const can = canModerate();
  return (
    <div>
      <input aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username…" className={`${fld} w-full sm:w-80 mb-4`} />
      {!members ? <Skeleton className="h-40" /> : !members.length ? (
        <AdminEmptyState title="No members found" description="Search for the person you want to seed or moderate." />
      ) : <div className="space-y-2">{members.map((m) => <Row key={m.user_id} m={m} can={can} save={save} />)}</div>}
    </div>
  );
}
