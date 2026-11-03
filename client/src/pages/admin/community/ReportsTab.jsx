import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminGetReports, adminResolveReport, adminModerate, adminPatchMember } from '../../../services/communityApi';
import AdminEmptyState from '../../../components/admin/AdminEmptyState';
import { Badge, Btn, Card, Skeleton } from '../../../components/admin/ui';
import { askNote, banUntil, canModerate, errMsg } from './shared';

const ICON = 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z';

function Group({ g, busy, run, moderate }) {
  const [days, setDays] = useState('7'); // '1'..'365' or 'permanent'
  const defamation = !!g.reasons.defamation;
  const type = g.target_type === 'post' ? 'posts' : 'comments';
  const status = g.preview.status;
  const content = g.target_type !== 'member';

  const ban = () => {
    const n = days === 'permanent' ? days : Math.min(365, Math.max(1, parseInt(days, 10) || 1));
    const note = askNote(`Ban ${g.author.display_name} ${n === 'permanent' ? 'permanently' : `for ${n} day(s)`}?`);
    if (note === null) return;
    run(() => adminPatchMember(g.author.id, { banned_until: banUntil(n), ban_reason: note || 'Community guidelines' }), 'Author banned');
  };

  return (
    <Card className={`!p-4 ${defamation ? 'border-l-4 !border-l-red-600' : ''}`} data-testid="report-group">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {defamation && <Badge tone="danger" title="Legal clock: acknowledge in 24 hours, resolve within 15 days">Defamation</Badge>}
        {Object.entries(g.reasons).filter(([r]) => r !== 'defamation').map(([r, n]) => <Badge key={r} tone="warn">{r} x{n}</Badge>)}
        <Badge>{g.count} report{g.count !== 1 ? 's' : ''}</Badge>
        <Badge tone={status === 'visible' || status === 'member' ? 'ok' : 'danger'}>{g.target_type}: {status}</Badge>
      </div>
      <p className="text-[13px] adm-t1 line-clamp-3 break-words">{g.preview.title || g.preview.body || '(no preview)'}</p>
      <p className="text-[11px] adm-t3 mt-1">by {g.author.display_name}{g.author.badge ? ` (${g.author.badge})` : ''} · last reported {new Date(g.latest_reported_at).toLocaleString('en-IN')}</p>
      {canModerate() && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {content && status === 'visible' && <Btn size="sm" variant="outline" disabled={busy} onClick={() => moderate(type, g.target_id, 'hide')}>Hide</Btn>}
          {content && status === 'hidden' && <Btn size="sm" variant="outline" disabled={busy} onClick={() => moderate(type, g.target_id, 'restore')}>Restore</Btn>}
          {content && ['visible', 'hidden'].includes(status) && <Btn size="sm" variant="danger" disabled={busy} onClick={() => moderate(type, g.target_id, 'remove')}>Remove</Btn>}
          <Btn size="sm" variant="ghost" disabled={busy} onClick={() => run(() => adminResolveReport(g.report_id, 'dismissed'), 'Dismissed')}>Dismiss</Btn>
          {g.author.id && (
            <span className="inline-flex items-center gap-1 ml-auto">
              <label className="sr-only" htmlFor={`ban-${g.target_id}`}>Ban length</label>
              <select id={`ban-${g.target_id}`} value={days === 'permanent' ? 'permanent' : 'days'}
                onChange={(e) => setDays(e.target.value === 'permanent' ? 'permanent' : '7')}
                className="border adm-border rounded-lg px-2 py-1.5 text-[12px]">
                <option value="days">Days</option><option value="permanent">Permanent</option>
              </select>
              {days !== 'permanent' && (
                <input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Ban days"
                  className="w-16 border adm-border rounded-lg px-2 py-1.5 text-[12px]" />
              )}
              <Btn size="sm" variant="danger" disabled={busy} onClick={ban}>Ban author</Btn>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ReportsTab() {
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => adminGetReports({ status: 'open', limit: 50 })
    .then((d) => setGroups(d.groups || [])).catch((e) => { setGroups([]); toast.error(errMsg(e)); }), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const COPY = { remove: ['Remove this from the community?', 'Removed'], hide: ['Hide this item?', 'Hidden'], restore: ['Restore this item so everyone can see it again?', 'Restored'] };
  const moderate = (type, id, action) => {
    const note = askNote(COPY[action][0]);
    if (note === null) return;
    run(() => adminModerate(type, id, action, note), COPY[action][1]);
  };

  if (!groups) return <Skeleton className="h-40" />;
  if (!groups.length) return <AdminEmptyState icon={ICON} title="No open reports" description="Nothing needs review right now." />;
  return (
    <div className="space-y-3">
      {groups.map((g) => <Group key={`${g.target_type}:${g.target_id}`} g={g} busy={busy} run={run} moderate={moderate} />)}
    </div>
  );
}
