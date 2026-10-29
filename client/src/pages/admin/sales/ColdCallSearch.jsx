// Find any lead by phone (any format), name, business or email — for the inbound
// "you called me" moment. Picking one opens it in the call card.
import { useEffect, useState } from 'react';
import { crmColdCallSearch } from '../../../services/api';
import { formatPhone } from './coldCallUtils';

export default function ColdCallSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (q.trim().length < 3) { setRows(null); return undefined; }
    const t = setTimeout(() => {
      crmColdCallSearch(q.trim()).then(({ data }) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (lead) => { onPick(lead); setQ(''); setRows(null); };
  return (
    <div className="relative w-full">
      <input className="fb-input text-sm !w-full" placeholder="Search phone, name or email…" aria-label="Search leads"
        value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
      {rows && (
        <div className="absolute right-0 z-20 mt-1 w-[320px] adm-card rounded-lg shadow-lg p-1 max-h-80 overflow-y-auto">
          {rows.length === 0 ? <div className="px-3 py-2 text-[12.5px] adm-t3">No lead found</div>
            : rows.map((l) => (
              <button key={l.id} type="button" onClick={() => pick(l)} className="w-full text-left px-3 py-2 rounded-lg adm-hoverable">
                <div className="text-[13px] adm-t1 truncate">{l.business_name || l.name || 'Lead'}</div>
                <div className="text-[11.5px] adm-t3 truncate">{[formatPhone(l.phone), l.email, l.attributes?.cold_call?.last_outcome].filter(Boolean).join(' · ')}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
