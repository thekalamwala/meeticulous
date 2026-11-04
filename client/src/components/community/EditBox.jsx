import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { errorCopy, fmtCount } from './communityErrors';

// Inline editor for the author's own post / thread / reply. `onSave({title?, body})` is async;
// NOT_EDITABLE (window closed) is a toast, any other error shows inline.
export default function EditBox({ initial, max, withTitle = false, onSave, onCancel }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState(initial.body || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => { box.current?.focus(); }, []);

  const over = body.length > max;
  const ready = body.trim() && (!withTitle || title.trim()) && !over && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr('');
    try {
      await onSave({ ...(withTitle && { title: title.trim() }), body: body.trim() });
    } catch (e2) {
      if (e2?.response?.data?.code === 'NOT_EDITABLE') { toast.error(errorCopy(e2, user)); onCancel(); return; }
      setErr(errorCopy(e2, user));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} className="flex flex-col gap-3">
      {withTitle && (
        <div className="mt-input"><input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      )}
      <div className="mt-input mt-input--textarea">
        <textarea ref={box} aria-label="Edit text" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="mt-field-foot">
        {err ? <span role="alert" className="mt-hint mt-field--error">{err}</span> : <span />}
        <span aria-live="polite" className={`mt-counter ${over ? 'mt-counter--over' : ''}`}>{fmtCount(body.length)} / {fmtCount(max)}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="mt-btn mt-btn--ghost mt-btn--s">Cancel</button>
        <button type="submit" disabled={!ready} className="mt-btn mt-btn--s">Save</button>
      </div>
    </form>
  );
}
