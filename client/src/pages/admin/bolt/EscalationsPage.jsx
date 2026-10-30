// Escalations — conversations Bolt handed to a human. List + shared detail
// (EscalationDetail). The unified Support inbox reuses the same detail component.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListEscalations } from '../../../services/api';
import { Badge, Skeleton } from '../../../components/admin/ui';
import EscalationDetail from './EscalationDetail';

const STATUS_TONE = { open: 'warn', replied: 'ok', closed: 'neutral' };
const RATING_EMOJI = { 1: '😠', 2: '😕', 3: '😐', 4: '🙂', 5: '🤩' };
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function EscalationsPage() {
  const [escStatus, setEscStatus] = useState('open');
  const [escs, setEscs] = useState([]);
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListEscalations({ status: escStatus }); setEscs(data.escalations || []); }
    catch { toast.error('Could not load escalations'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [escStatus]);

  if (selId) return <EscalationDetail id={selId} onBack={() => setSelId(null)} onChanged={load} />;

  return (
    <>
      <div className="mb-3">
        <select value={escStatus} onChange={(ev) => setEscStatus(ev.target.value)} className="border adm-border rounded-lg px-3 py-1.5 text-sm">
          <option value="open">Open</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </div>
      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : escs.length === 0 ? <p className="text-sm adm-t3">No escalations — Bolt is handling everything.</p>
          : (
            <div className="space-y-2">
              {escs.map((e) => (
                <button key={e.id} onClick={() => setSelId(e.id)} className="block w-full rounded-xl border adm-border p-3 text-left hover:border-[#960D32]">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-[#FFF4EC] px-1.5 py-0.5 text-xs font-semibold text-[#2A1416]">{e.reference}</code>
                    <Badge tone={STATUS_TONE[e.status] || 'neutral'}>{e.status}</Badge>
                    <span className="text-xs adm-t3">{e.logged_in ? (e.is_host ? 'Host' : 'Guest') : 'Anon'}</span>
                    {e.contact_verified && <Badge tone="ok">verified</Badge>}
                    {e.rating && <span className="text-xs" title={`Rated ${e.rating}/5`}>{RATING_EMOJI[e.rating]} {e.rating}/5</span>}
                    <span className="ml-auto text-xs adm-t3">{fmtDate(e.created_at)}</span>
                  </div>
                  <p className="text-sm adm-t1">{e.summary || '—'}</p>
                  <p className="mt-0.5 text-xs adm-t3">{e.contact_channel || '—'} · {e.email || e.phone || 'no contact'}</p>
                </button>
              ))}
            </div>
          )}
    </>
  );
}
