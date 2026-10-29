// Auto-saved — answers Bolt cached and reuses automatically. Each is editable:
// the pencil opens the FAQ editor pre-filled; saving promotes it to a Final FAQ
// and evicts the cache row (it "moves" out of here). No delete/clear — the cache
// self-manages from traffic.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListBotCache } from '../../../services/api';
import { Badge, Skeleton } from '../../../components/admin/ui';
import FaqModal from './FaqModal';

export default function AutoSavedPage() {
  const [cache, setCache] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListBotCache(); setCache(data.cache || []); }
    catch { toast.error('Could not load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  if (cache.length === 0) return <p className="text-sm adm-t3">No reused answers yet. Fills as questions get answered (needs the Voyage key live).</p>;

  return (
    <>
      <p className="mb-3 text-sm adm-t3">{cache.length} reused answers · edit one to promote it into a Final FAQ.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cache.map((c) => (
          <div key={c.id} className="adm-card flex flex-col rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={c.hits > 0 ? 'ok' : 'neutral'}>used {c.hits} time{c.hits === 1 ? '' : 's'}</Badge>
            </div>
            <p className="text-sm font-medium adm-t1" title={c.question}>{c.question}</p>
            <p className="mt-1 flex-1 text-xs adm-t3">{c.answer.slice(0, 160)}{c.answer.length > 160 ? '…' : ''}</p>
            <div className="mt-3">
              <button onClick={() => setModal({ pattern: (c.question || '').toLowerCase().slice(0, 120), answer: c.answer, category: 'General', cacheId: c.id })}
                title="Edit and save as a Final FAQ" className="rounded-lg border adm-border px-3 py-1.5 text-xs font-medium adm-t2">✏️ Edit &amp; save to FAQ</button>
            </div>
          </div>
        ))}
      </div>
      {modal && <FaqModal initial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
