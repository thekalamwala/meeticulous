// Final FAQs — the deterministic answer layer, shown as a table grouped by
// category. Pencil edits the answer (modal); toggle pauses; delete removes.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminListBotFaqs, adminUpdateBotFaq, adminDeleteBotFaq } from '../../../services/api';
import { Badge, Table, Skeleton } from '../../../components/admin/ui';
import FaqModal from './FaqModal';

export default function FaqsPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await adminListBotFaqs(); setFaqs(data.faqs || []); }
    catch { toast.error('Could not load FAQs'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (f) => {
    try { await adminUpdateBotFaq(f.id, { enabled: !f.enabled }); load(); }
    catch { toast.error('Toggle failed'); }
  };
  const remove = async (f) => {
    if (!window.confirm(`Delete FAQ "${f.pattern}"?`)) return;
    try { await adminDeleteBotFaq(f.id); toast.success('Deleted'); load(); }
    catch { toast.error('Delete failed'); }
  };

  const columns = [
    { key: 'pattern', label: 'Question', render: (f) => (
      <div className="min-w-0">
        <code className="rounded bg-[#FFF4EC] px-1.5 py-0.5 text-xs text-[#191919]">{f.pattern}</code>
        <p className="mt-1 max-w-md truncate text-xs adm-t3">{f.answer}</p>
      </div>
    ) },
    { key: 'category', label: 'Category', render: (f) => <Badge tone="neutral">{f.category || 'General'}</Badge> },
    { key: 'enabled', label: 'Status', render: (f) => <Badge tone={f.enabled ? 'ok' : 'neutral'}>{f.enabled ? 'live' : 'off'}</Badge> },
    { key: 'actions', label: '', className: 'text-right', render: (f) => (
      <div className="flex justify-end gap-1.5">
        <button onClick={() => setModal({ pattern: f.pattern, answer: f.answer, category: f.category || 'General', editingId: f.id })}
          title="Edit answer" className="rounded-lg border adm-border px-2 py-1 text-xs adm-t2">✏️ Edit</button>
        <button onClick={() => toggle(f)} className="rounded-lg border adm-border px-2 py-1 text-xs adm-t2">{f.enabled ? 'Disable' : 'Enable'}</button>
        <button onClick={() => remove(f)} className="rounded-lg border adm-border px-2 py-1 text-xs text-red-600">Delete</button>
      </div>
    ) },
  ];

  return (
    <>
      <div className="mb-3">
        <button onClick={() => setModal({ pattern: '', answer: '', category: 'General' })}
          className="rounded-lg bg-[#0079C1] px-3 py-1.5 text-sm font-medium text-white">+ Add FAQ</button>
      </div>
      {loading ? <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        : <Table columns={columns} rows={faqs} rowKey={(f) => f.id}
            empty={<p className="p-6 text-sm adm-t3">No FAQs yet. Add one, or promote a gap from Needs Answer.</p>} />}
      {modal && <FaqModal initial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
