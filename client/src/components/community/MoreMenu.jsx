import { useEffect, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';

// Overflow menu for edit / delete / report. `items` = [{label, onSelect}]; Esc or an outside
// click closes it. Returns null when there is nothing to offer.
export default function MoreMenu({ label = 'More', items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!items.length) return null;
  return (
    <span ref={ref} className="mt-more">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mt-btn mt-btn--ghost mt-iconbtn mt-btn--s">
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-menu" role="menu" aria-label={label}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className="mt-menu__item" onClick={() => { setOpen(false); it.onSelect(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </span>
  );
}
