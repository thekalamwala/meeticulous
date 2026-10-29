import { useState, useRef, useEffect } from 'react';
import { Badge } from '../../../components/admin/ui';
import { ALL_STATUSES, STATUS_LABEL, STATUS_TONE } from './salesConstants';

// Notion-style inline text edit: click the cell → edit in place → Enter/blur
// saves, Esc cancels. stopPropagation so the row's drawer-open doesn't fire.
export function InlineText({ value, onSave, placeholder = '—', mono = false }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? '');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const nv = v.trim();
    if (nv !== (value ?? '')) onSave(nv);
  };
  if (editing) {
    return (
      <input ref={ref} value={v} onClick={(e) => e.stopPropagation()}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value ?? ''); setEditing(false); } }}
        className={`w-full bg-white border border-[#2E1065]/40 rounded px-1.5 py-0.5 text-[13px] outline-none ${mono ? 'font-mono' : ''}`} />
    );
  }
  return (
    <span onClick={(e) => { e.stopPropagation(); setV(value ?? ''); setEditing(true); }}
      className={`block truncate cursor-text rounded px-1.5 py-0.5 -mx-1.5 hover:bg-black/[0.04] ${value ? '' : 'adm-t3'} ${mono ? 'font-mono' : ''}`}
      title="Click to edit">
      {value || placeholder}
    </span>
  );
}

// Inline status chip → click opens a compact stage menu.
export function InlineStatus({ value, onSave }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded hover:opacity-80" title="Change stage">
        <Badge tone={STATUS_TONE[value] || 'neutral'}>{STATUS_LABEL[value] || value}</Badge>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-40 rounded-lg adm-card shadow-lg py-1">
            {ALL_STATUSES.map((s) => (
              <button key={s} type="button"
                onClick={() => { setOpen(false); if (s !== value) onSave(s); }}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] adm-hoverable flex items-center gap-2 ${s === value ? 'font-semibold' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[STATUS_TONE[s]] || 'bg-gray-400'}`} />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const TONE_DOT = { ok: 'bg-emerald-500', danger: 'bg-rose-500', warn: 'bg-amber-500', info: 'bg-blue-500', neutral: 'bg-gray-400' };
