import { useEffect } from 'react';
import LeadPanel from './LeadPanel';

// Right-side slide-over lead detail. Renders the shared LeadPanel; the full-page
// route stays available via the "Open full page" link for deep-linking.
export default function LeadDrawer({ leadId, onClose, onChanged }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!leadId) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[600px] lg:w-[940px] adm-card shadow-2xl overflow-y-auto animate-[slideIn_.15s_ease-out]">
        <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 adm-card border-b border-gray-100">
          <a href={`/admin/sales/leads/${leadId}`} className="text-[11px] adm-t3 hover:text-[#2E1065]">Open full page ↗</a>
          <button onClick={onClose} className="adm-t3 text-2xl leading-none px-1">×</button>
        </div>
        <div className="p-4">
          <LeadPanel leadId={leadId} onChanged={onChanged} onClose={onClose} variant="drawer" />
        </div>
      </div>
    </div>
  );
}
