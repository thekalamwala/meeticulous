import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled])';

// Modal shell for the community dialogs: aria-modal + label, Esc closes, Tab stays inside,
// focus starts on the first field (or Close) and returns to the opener on unmount.
export default function Dialog({ title, onClose, children }) {
  const id = useId();
  const ref = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const el = ref.current;
    (el.querySelector('textarea,input:not([type=radio]),select') || el.querySelector(FOCUSABLE))?.focus();
    return () => { if (opener?.isConnected) opener.focus?.(); };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="mt-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={onKeyDown} className="mt-dialog mt-dialog--wide">
        <div className="mt-dialog__head">
          <h3 id={id} className="mt-dialog__title">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="mt-btn mt-btn--ghost mt-iconbtn mt-btn--s"><X size={20} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Delete confirmation. `onConfirm` may be async; the button locks while it runs.
export function ConfirmDialog({ title, text, confirmLabel = 'Delete', busy, onConfirm, onClose }) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="mt-dialog__body">{text}</p>
      <div className="mt-dialog__actions">
        <button type="button" onClick={onClose} className="mt-btn mt-btn--ghost">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="mt-btn mt-btn--danger">{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
