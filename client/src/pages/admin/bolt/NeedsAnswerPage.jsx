// Needs Answer — Bolt's open to-do list (couldn't answer / got 👎), shown as
// cards. No filters. "Make FAQ" opens the editor modal; saving promotes the gap
// to a FAQ (server marks it resolved) and it drops off this list.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListBotGaps } from '../../../services/api';
import { Badge, Skeleton } from '../../../components/admin/ui';
import FaqModal from './FaqModal';

const REASON_TONE = { escalated: 'warn', thumbs_down: 'danger' };
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function NeedsAnswerPage() {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // FaqModal `initial` or null

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListBotGaps({ status: 'open' }); setGaps(data.gaps || []); }
    catch { toast.error('Could not load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const makeFaq = (g) => setModal({
    pattern: (g.question || '').toLowerCase().slice(0, 120),
    answer: g.question ? '' : (g.downvoted_answer || ''),
    gapId: g.id,
  });

  if (loading) return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  if (gaps.length === 0) return <p className="text-sm adm-t3">Nothing here — Bolt is answering everything.</p>;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gaps.map((g) => (
          <div key={g.id} className="adm-card flex flex-col rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={REASON_TONE[g.reason] || 'neutral'}>{g.reason === 'thumbs_down' ? 'Answer Disliked' : 'Bolt Gave Up'}</Badge>
              <span className="ml-auto text-xs adm-t3">{fmtDate(g.created_at)}</span>
            </div>
            <p className="flex-1 text-sm adm-t1">
              {g.question || (g.downvoted_answer
                ? <span className="adm-t2">Downvoted answer: “{g.downvoted_answer.slice(0, 180)}{g.downvoted_answer.length > 180 ? '…' : ''}”</span>
                : <span className="adm-t3">—</span>)}
            </p>
            <div className="mt-3">
              <button onClick={() => makeFaq(g)}
                className="rounded-lg bg-[#960D32] px-3 py-1.5 text-xs font-medium text-white">Make FAQ</button>
            </div>
          </div>
        ))}
      </div>
      {modal && <FaqModal initial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
