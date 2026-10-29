// Shared FAQ editor modal — used by Needs Answer (promote a gap), Auto-saved
// (promote a reused answer, evicting the cache row), and Final FAQs (add / edit).
// initial: { pattern, answer, category, editingId?, gapId?, cacheId? }
import { useState } from 'react';
import toast from 'react-hot-toast';
import { adminCreateBotFaq, adminUpdateBotFaq } from '../../../services/api';

const CATEGORIES = ['General', 'Bookings', 'Payments', 'Account', 'Hosts', 'Refunds', 'Onboarding', 'Technical'];

export default function FaqModal({ initial, onClose, onSaved }) {
  const [pattern, setPattern] = useState(initial.pattern || '');
  const [answer, setAnswer] = useState(initial.answer || '');
  const [category, setCategory] = useState(initial.category || 'General');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = pattern.trim(); const a = answer.trim();
    if (!p || !a) { toast.error('Question and answer are required'); return; }
    setBusy(true);
    try {
      if (initial.editingId) {
        await adminUpdateBotFaq(initial.editingId, { pattern: p, answer: a, category });
        toast.success('FAQ updated');
      } else {
        await adminCreateBotFaq({ pattern: p, answer: a, category, gapId: initial.gapId, cacheId: initial.cacheId });
        toast.success('Saved to FAQs');
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="adm-card w-full max-w-lg rounded-2xl p-5">
        <h2 className="mb-4 text-lg font-bold adm-t1">{initial.editingId ? 'Edit FAQ' : 'New FAQ'}</h2>

        <label className="mb-1 block text-xs font-semibold adm-t2">Question / trigger phrase (matched as a substring of the visitor's question)</label>
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} autoFocus
          placeholder="e.g. how do i reset my password"
          className="mb-3 w-full rounded-lg border adm-border px-3 py-2 text-sm" />

        <label className="mb-1 block text-xs font-semibold adm-t2">Category</label>
        <input list="faq-cats" value={category} onChange={(e) => setCategory(e.target.value)}
          className="mb-3 w-full rounded-lg border adm-border px-3 py-2 text-sm" />
        <datalist id="faq-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>

        <label className="mb-1 block text-xs font-semibold adm-t2">Answer (markdown; served verbatim, no AI)</label>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5}
          placeholder="Keep prices/policy OUT — link the docs instead so it can't go stale."
          className="mb-4 w-full rounded-lg border adm-border px-3 py-2 text-sm" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border adm-border px-3 py-1.5 text-sm adm-t2">Cancel</button>
          <button onClick={save} disabled={busy}
            className="rounded-lg bg-[#0079C1] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
