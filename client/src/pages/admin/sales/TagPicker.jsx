import { useState, useMemo } from 'react';
import { TAG_PALETTE, chipClass, swatchClass } from './salesTagColors';

// Searchable tag dropdown. Click an existing tag → onSelect(name).
// Type a new name → pick a colour swatch → onCreate(name, color).
export default function TagPicker({ tags = [], exclude = [], onSelect, onCreate, onClose }) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const excluded = new Set(exclude);

  const matches = useMemo(() => {
    const ql = query.toLowerCase();
    return tags.filter((t) => !excluded.has(t.name) && (!ql || t.name.toLowerCase().includes(ql)));
  }, [tags, query, exclude]);

  const exactExists = tags.some((t) => t.name.toLowerCase() === query.toLowerCase());

  return (
    <div className="absolute z-20 mt-1 w-64 rounded-xl adm-card shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
      <input autoFocus className="fb-input text-sm w-full mb-2" placeholder="Search or create a tag…"
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="max-h-52 overflow-auto space-y-1">
        {matches.map((t) => (
          <button key={t.id || t.name} type="button"
            onClick={() => { onSelect(t.name); onClose?.(); }}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg adm-hoverable text-left">
            <span className={`w-2.5 h-2.5 rounded-full ${swatchClass(t.color)}`} />
            <span className="text-[13px] adm-t1">{t.name}</span>
          </button>
        ))}
        {matches.length === 0 && !query && <p className="px-2 py-1 text-[12px] adm-t3">No tags yet — type to create one.</p>}
      </div>

      {query && !exactExists && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[11px] adm-t3 mb-1">Create <span className={`px-1.5 py-0.5 rounded-full border ${chipClass('gray')}`}>{query}</span> with colour:</p>
          <div className="flex flex-wrap gap-1.5">
            {TAG_PALETTE.map((c) => (
              <button key={c} type="button" title={c}
                onClick={() => { onCreate(query, c); onClose?.(); }}
                className={`w-5 h-5 min-h-0 shrink-0 rounded-full ${swatchClass(c)} ring-offset-1 hover:ring-2 ring-gray-300`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
