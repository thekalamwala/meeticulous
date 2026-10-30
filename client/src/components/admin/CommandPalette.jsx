// client/src/components/admin/CommandPalette.jsx
// The ONE admin command bar (⌘K, opened from AdminLayout). Searches nav
// destinations + live leads and offers "New lead". Previously the sales Leads
// page mounted its own second palette with its own ⌘K listener, so one keypress
// opened both, stacked — this is now the single source of truth.
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from './Ic';
import { IC, NAV, flattenAllDestinations } from './adminNav';
import { crmListLeads } from '../../services/api';

const CommandPalette = ({ open, session, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [leads, setLeads] = useState([]);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  const all = useMemo(() => flattenAllDestinations(NAV, session), [session]);
  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(d => d.label.toLowerCase().includes(q) || d.section.toLowerCase().includes(q));
  }, [query, all]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setLeads([]); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  // Debounced live lead search — only while the palette is open and there's a query.
  useEffect(() => {
    clearTimeout(debounce.current);
    const q = query.trim();
    if (!open || !q) { setLeads([]); return; }
    debounce.current = setTimeout(() => {
      crmListLeads({ q, pageSize: 6 }).then(({ data }) => setLeads(data.rows || [])).catch(() => setLeads([]));
    }, 180);
    return () => clearTimeout(debounce.current);
  }, [query, open]);

  // Unified, keyboard-navigable item list: New lead → nav destinations → leads.
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    if (!q || 'new lead'.includes(q))
      out.push({ key: 'new-lead', kind: 'Cmd', label: 'New lead', hint: 'Create', run: () => { onClose(); navigate('/admin/sales/leads?new=1'); } });
    navMatches.forEach(d => out.push({ key: `nav-${d.section}-${d.to}`, kind: d.section, label: d.label, run: () => { onClose(); navigate(d.to); } }));
    leads.forEach(r => out.push({
      key: `lead-${r.id}`, kind: 'Lead', label: r.name || 'Unnamed lead',
      hint: [r.business_name, r.phone, r.email].filter(Boolean)[0] || '',
      run: () => { onClose(); navigate(`/admin/sales/leads/${r.id}`); },
    }));
    return out;
  }, [query, navMatches, leads, navigate, onClose]);

  const clamped = Math.min(active, Math.max(0, items.length - 1));

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[clamped]?.run(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/40" onMouseDown={onClose}>
      <div className="w-full max-w-lg mx-4 adm-card rounded-xl shadow-2xl overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b adm-border">
          <Ic d={IC.search} size={16} className="text-gray-400" />
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
            placeholder="Search admin, leads, or run a command…" aria-label="Search admin" aria-controls="adm-cmd-listbox"
            className="flex-1 py-3.5 text-[14px] outline-none placeholder:text-gray-400" />
          <kbd className="text-[10px] adm-t3 font-mono adm-chip px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <ul id="adm-cmd-listbox" role="listbox" aria-label="Admin destinations" className="max-h-[50vh] overflow-y-auto py-1.5">
          {items.length === 0 && <li className="px-4 py-6 text-center text-[13px] adm-t3">No matches</li>}
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === clamped}
              onMouseEnter={() => setActive(i)} onMouseDown={() => it.run()}
              className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer text-[13px] ${i === clamped ? 'bg-[#960D32]/10 text-[#960D32]' : 'adm-t2'}`}>
              <span className="text-[10px] uppercase adm-t3 w-9 flex-shrink-0">{it.kind === 'Lead' || it.kind === 'Cmd' ? it.kind : ''}</span>
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint
                ? <span className="text-[11px] adm-t3 truncate flex-shrink-0 max-w-[45%]">{it.hint}</span>
                : <span className="text-[10px] uppercase tracking-wider adm-t3">{it.kind !== 'Lead' && it.kind !== 'Cmd' ? it.kind : ''}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
