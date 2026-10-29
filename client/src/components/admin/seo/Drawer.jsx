// client/src/components/admin/seo/Drawer.jsx
// Reusable right-side inspector drawer. Scrim + slide-in panel, body-scroll lock,
// Esc to close. Header is sticky; children scroll. Used by the SEO page inspector
// (and reusable for any admin drawer).
import { useEffect } from 'react';

export default function Drawer({ open, onClose, title, subtitle, headerRight, width = 'max-w-2xl', children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className={`relative h-full w-full ${width} flex flex-col adm-canvas shadow-2xl animate-[slideIn_.18s_ease-out]`}
        style={{ animationName: 'none' }}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b adm-border adm-canvas">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold adm-t1 truncate">{title}</h2>
            {subtitle && <p className="text-[12px] adm-t3 truncate mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerRight}
            <button onClick={onClose} aria-label="Close" className="adm-hoverable rounded-lg w-8 h-8 flex items-center justify-center adm-t2 text-lg leading-none">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
