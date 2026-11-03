import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminSearchContent, adminModerate, adminPin } from '../../../services/communityApi';
import AdminEmptyState from '../../../components/admin/AdminEmptyState';
import { Badge, Btn, Card, Skeleton } from '../../../components/admin/ui';
import { askNote, canModerate, errMsg } from './shared';

const fld = 'border adm-border rounded-lg px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[#960D32]/30';
const TONE = { visible: 'ok', hidden: 'warn', removed: 'danger', deleted: 'neutral' };

export default function ContentTab() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('posts');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cur) => {
    try {
      const d = await adminSearchContent({ q: q.trim(), type, status, cursor: cur });
      setItems((p) => (cur ? [...(p || []), ...d.items] : d.items));
      setCursor(d.next_cursor);
    } catch (e) { setItems((p) => p || []); toast.error(errMsg(e)); }
  }, [q, type, status]);
  useEffect(() => { setItems(null); const t = setTimeout(() => load(null), 250); return () => clearTimeout(t); }, [load]);

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(null); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const moderate = (it, action) => {
    const note = askNote(`${action[0].toUpperCase()}${action.slice(1)} this ${type.slice(0, -1)}?`);
    if (note === null) return;
    act(() => adminModerate(type, it.id, action, note), `Done: ${action}`);
  };
  const can = canModerate();

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input aria-label="Search content" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text…" className={`${fld} flex-1`} />
        <select aria-label="Content type" value={type} onChange={(e) => setType(e.target.value)} className={fld}>
          <option value="posts">Posts</option><option value="comments">Comments</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={fld}>
          <option value="">Any status</option>
          {['visible', 'hidden', 'removed', 'deleted'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {!items ? <Skeleton className="h-40" /> : !items.length ? (
        <AdminEmptyState title="Nothing found" description="Try a different search or filter." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className="!p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge tone={TONE[it.status]}>{it.status}</Badge>
                {it.is_pinned && <Badge tone="info">pinned</Badge>}
                <span className="text-[11px] adm-t3">{it.author.display_name} · {new Date(it.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <p className="text-[13px] adm-t1 break-words">{it.title ? <strong>{it.title}: </strong> : null}{it.body}</p>
              {it.admin_note && <p className="text-[11px] adm-t3 mt-1">Note: {it.admin_note}</p>}
              {can && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {it.status === 'visible' && <Btn size="sm" variant="outline" disabled={busy} onClick={() => moderate(it, 'hide')}>Hide</Btn>}
                  {['hidden', 'removed'].includes(it.status) && <Btn size="sm" variant="outline" disabled={busy} onClick={() => moderate(it, 'restore')}>Restore</Btn>}
                  {['visible', 'hidden'].includes(it.status) && <Btn size="sm" variant="danger" disabled={busy} onClick={() => moderate(it, 'remove')}>Remove</Btn>}
                  {type === 'posts' && it.status === 'visible' && (
                    <Btn size="sm" variant="ghost" disabled={busy} onClick={() => act(() => adminPin(it.id, !it.is_pinned), it.is_pinned ? 'Unpinned' : 'Pinned')}>
                      {it.is_pinned ? 'Unpin' : 'Pin'}
                    </Btn>
                  )}
                </div>
              )}
            </Card>
          ))}
          {cursor && <Btn variant="outline" size="sm" onClick={() => load(cursor)}>Load more</Btn>}
        </div>
      )}
    </div>
  );
}
