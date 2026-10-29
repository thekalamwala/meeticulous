// client/src/components/admin/ui/AdminFilters.jsx
// Linear-style filter builder for admin list pages. Click "+ Filter" → pick a
// dimension → it drops in as a small chip; each chip opens a searchable value
// picker. Config-driven, on-stack (no cmdk/radix/motion) — the searchable dropdown
// reuses the same absolute-panel + click-away idiom as sales/TagPicker.jsx.
//
// config: [{ key, label, icon?, options?: [{value,label}], search?, multi?, type?: 'text'|'date' }]
//   - options + (multi=false, default): value[key] is a string ('' = unset)
//   - options + multi=true:             value[key] is a string[] ([] = unset)
//   - type 'text' | 'date':             value[key] is a string ('' = unset)
// value:    { [key]: string | string[] }   — only set keys render a chip
// onChange: (nextValue) => void            — receives the whole value object
import { useEffect, useRef, useState } from 'react';
import Ic from '../Ic';
import { IC } from '../adminNav';

const isSet = (v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== '');

// Close the open panel on outside-click or Escape.
function useDismiss(onDismiss) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onDismiss(); };
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onDismiss]);
  return ref;
}

// Searchable option list for one dimension. Single-select replaces + closes;
// multi-select toggles + stays open.
function ValuePanel({ dim, current, onChange, onClose }) {
  const [q, setQ] = useState('');
  const ref = useDismiss(onClose);
  const ql = q.trim().toLowerCase();
  const opts = (dim.options || []).filter((o) => !ql || o.label.toLowerCase().includes(ql));
  const sel = Array.isArray(current) ? current : (current ? [current] : []);
  const has = (val) => sel.includes(val);

  const pick = (val) => {
    if (dim.multi) { onChange(has(val) ? sel.filter((v) => v !== val) : [...sel, val]); }
    else { onChange(val); onClose(); }
  };

  return (
    <div ref={ref} className="absolute z-30 mt-1 w-60 rounded-xl adm-card border adm-border shadow-lg p-2">
      {dim.search !== false && (
        <div className="relative mb-2">
          <Ic d={IC.search} size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 adm-t3" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${dim.label.toLowerCase()}…`}
            className="fb-input text-sm w-full pl-8" />
        </div>
      )}
      <div className="max-h-56 overflow-auto space-y-0.5">
        {opts.map((o) => (
          <button key={o.value} type="button" onClick={() => pick(o.value)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg adm-hoverable text-left text-[13px] adm-t1">
            <span className={`flex-none w-4 ${has(o.value) ? 'text-[#2E1065]' : 'opacity-0'}`}><Ic d={IC.check} size={14} /></span>
            <span className="truncate">{o.label}</span>
          </button>
        ))}
        {opts.length === 0 && <p className="px-2 py-2 text-[12px] adm-t3">No matches.</p>}
      </div>
    </div>
  );
}

// Free-text / date entry for one dimension.
function InputPanel({ dim, current, onChange, onClose }) {
  const ref = useDismiss(onClose);
  return (
    <div ref={ref} className="absolute z-30 mt-1 w-56 rounded-xl adm-card border adm-border shadow-lg p-2">
      <input autoFocus type={dim.type === 'date' ? 'date' : 'text'} value={current || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}
        placeholder={dim.placeholder || dim.label}
        className="fb-input text-sm w-full" />
    </div>
  );
}

// The "+ Filter" dropdown listing dimensions not yet active.
function AddMenu({ dims, onAdd, onClose }) {
  const [q, setQ] = useState('');
  const ref = useDismiss(onClose);
  const ql = q.trim().toLowerCase();
  const list = dims.filter((d) => !ql || d.label.toLowerCase().includes(ql));
  return (
    <div ref={ref} className="absolute z-30 mt-1 w-56 rounded-xl adm-card border adm-border shadow-lg p-2">
      <div className="relative mb-2">
        <Ic d={IC.search} size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 adm-t3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…"
          className="fb-input text-sm w-full pl-8" />
      </div>
      <div className="max-h-56 overflow-auto space-y-0.5">
        {list.map((d) => (
          <button key={d.key} type="button" onClick={() => onAdd(d.key)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg adm-hoverable text-left text-[13px] adm-t1">
            {d.icon ? <span className="flex-none">{d.icon}</span> : <span className="flex-none"><Ic d={IC.filter || IC.tag} size={14} className="adm-t3" /></span>}
            <span className="truncate">{d.label}</span>
          </button>
        ))}
        {list.length === 0 && <p className="px-2 py-2 text-[12px] adm-t3">All filters added.</p>}
      </div>
    </div>
  );
}

// Short human summary of a chip's current value.
function summarise(dim, v) {
  const arr = Array.isArray(v) ? v : [v];
  if (dim.options) {
    const label = (val) => dim.options.find((o) => o.value === val)?.label ?? val;
    if (arr.length === 1) return label(arr[0]);
    return `${arr.length} selected`;
  }
  return arr[0];
}

export default function AdminFilters({ config = [], value = {}, onChange, className = '', showClear = true }) {
  const [openKey, setOpenKey] = useState(null); // active dimension key whose panel is open
  const [adding, setAdding] = useState(false);   // "+ Filter" menu open
  // Keys added via "+ Filter" but not yet given a value. isSet('') is false, so an
  // empty chip would vanish without this — it keeps the chip on screen until valued.
  const [pending, setPending] = useState([]);

  const shown = config.filter((d) => isSet(value[d.key]) || pending.includes(d.key));
  const inactive = config.filter((d) => !isSet(value[d.key]) && !pending.includes(d.key));

  const setVal = (key, v) => onChange({ ...value, [key]: v });
  const removeKey = (key) => {
    const next = { ...value }; delete next[key]; onChange(next);
    setPending((p) => p.filter((k) => k !== key));
    setOpenKey((k) => (k === key ? null : k));
  };
  const clearAll = () => { const next = { ...value }; config.forEach((d) => delete next[d.key]); onChange(next); setPending([]); setOpenKey(null); };

  const addDim = (key) => {
    setPending((p) => (p.includes(key) ? p : [...p, key]));
    setAdding(false);
    setOpenKey(key);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map((dim) => {
        const v = value[dim.key];
        const empty = !isSet(v);
        return (
          <div key={dim.key} className="relative flex items-stretch text-[12px]">
            <button type="button" onClick={() => setOpenKey((k) => (k === dim.key ? null : dim.key))}
              className="flex items-center gap-1.5 rounded-l-lg bg-[var(--adm-hover)] pl-2 pr-2 py-1 adm-t1 hover:opacity-80">
              {dim.icon && <span className="flex-none">{dim.icon}</span>}
              <span className="adm-t2">{dim.label}</span>
              <span className="w-px h-3.5 bg-[var(--adm-border)]" />
              <span className="font-medium max-w-[140px] truncate">{empty ? 'any' : summarise(dim, v)}</span>
              <Ic d={IC.chevD} size={12} className="adm-t3" />
            </button>
            <button type="button" onClick={() => removeKey(dim.key)} title="Remove filter"
              className="rounded-r-lg bg-[var(--adm-hover)] px-1.5 py-1 adm-t3 hover:text-red-500 border-l border-[var(--adm-border)]">
              <Ic d={IC.x} size={12} />
            </button>
            {openKey === dim.key && (
              dim.options
                ? <ValuePanel dim={dim} current={v} onChange={(nv) => setVal(dim.key, nv)} onClose={() => setOpenKey(null)} />
                : <InputPanel dim={dim} current={v} onChange={(nv) => setVal(dim.key, nv)} onClose={() => setOpenKey(null)} />
            )}
          </div>
        );
      })}

      {inactive.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-[var(--adm-border)] px-2 py-1 text-[12px] adm-t3 hover:text-[#2E1065] hover:border-[#2E1065]">
            <Ic d={IC.plus} size={12} /> {shown.length ? 'Filter' : 'Add filter'}
          </button>
          {adding && <AddMenu dims={inactive} onAdd={addDim} onClose={() => setAdding(false)} />}
        </div>
      )}

      {showClear && shown.length > 0 && (
        <button type="button" onClick={clearAll} className="text-[12px] adm-t3 hover:text-[#2E1065] px-1.5 py-1">Clear</button>
      )}
    </div>
  );
}
