import { useState, useEffect, useRef } from 'react';
import { STATUS_LABEL } from './salesConstants';

// Reason prompt for a guarded status move (backward, or into an exit). Mirrors the
// server guard: these moves must record WHY. `open` carries { id, from, to, name };
// onConfirm(reason) runs the move, onCancel reverts. Exit moves suggest a reason.
const EXIT_REASONS = {
  not_reachable: 'No response after repeated attempts',
  not_interested: 'Declined — not interested',
  disqualified: 'Not an ICP (spam / competitor / wrong geo)',
  lost: 'Lost',
  churned: 'Cancelled a paid plan',
  do_not_contact: 'Requested no further contact',
};

export default function ReasonModal({ open, onConfirm, onCancel, busy }) {
  const [reason, setReason] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setReason(EXIT_REASONS[open.to] || ''); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  if (!open) return null;
  const label = (s) => STATUS_LABEL[s] || s;
  const submit = () => { const r = reason.trim(); if (r) onConfirm(r); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--adm-panel,#fff)] adm-panel border border-[var(--adm-line,#e5e7eb)] shadow-xl p-5"
        onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold adm-t1">
          Move {open.name || 'lead'} → {label(open.to)}
        </h3>
        <p className="text-[12px] adm-t3 mt-1">
          Moving <b>{label(open.from)}</b> → <b>{label(open.to)}</b> is a backward or exit move. Add a reason for the timeline.
        </p>
        <label className="block text-[11px] font-semibold adm-t2 uppercase tracking-wide mt-4 mb-1">Reason</label>
        <textarea
          ref={inputRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          rows={3}
          placeholder="Why is this lead moving here?"
          className="w-full rounded-xl border border-[var(--adm-line,#d1d5db)] bg-transparent px-3 py-2 text-[13px] adm-t1 focus:outline-none focus:ring-2 focus:ring-[#960D32]/40"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium adm-t2 hover:bg-black/5 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !reason.trim()}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-[#960D32] hover:bg-[#e34800] disabled:opacity-50">
            {busy ? 'Moving…' : 'Confirm move'}
          </button>
        </div>
      </div>
    </div>
  );
}
