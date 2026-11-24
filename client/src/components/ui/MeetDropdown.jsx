import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * MeetDropdown — the one branded dropdown for the whole site.
 *
 * Replaces the native <select>, whose open list is OS-rendered and can't be
 * styled (the grey/blue menu). This is a custom listbox built from the
 * design-system "Slot list" treatment: white panel, blush hover, the selected
 * row carries the pink booked-dot. Trigger reuses .mt-input; panel reuses
 * .mt-menu. See client/src/styles/components/dropdown.css.
 *
 * Near drop-in for a controlled <select>:
 *   <MeetDropdown value={v} onChange={setV} options={[{value,label,sublabel,icon}]} />
 * options may also be plain strings (value === label).
 *
 * Props:
 *   value       selected value (controlled)
 *   onChange    (value) => void
 *   options     array of {value,label,sublabel?,icon?,disabled?} | string
 *   placeholder shown when value matches no option
 *   disabled    bool
 *   size        'md' (default) | 'sm'  — 'sm' for tables / filter bars
 *   searchable  bool — adds a filter box (use for long lists: country, timezone)
 *   ariaLabel   accessible name when there's no visible <label>
 *   id, className, name
 */
const cx = (...a) => a.filter(Boolean).join(' ');
const norm = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

const CHEVRON = (
  <svg className="mt-dd__chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const SEARCH_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

export default function MeetDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  size = 'md',
  searchable = false,
  ariaLabel,
  id,
  name,
  className = '',
}) {
  const opts = useMemo(() => options.map(norm), [options]);
  const rid = useId();
  const listId = `${id || rid}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0); // keyboard-highlighted index into `shown`
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const triggerRef = useRef(null);
  const activeRef = useRef(null);

  const selected = opts.find((o) => o.value === value);
  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return opts;
    const q = query.trim().toLowerCase();
    return opts.filter((o) =>
      String(o.label).toLowerCase().includes(q) ||
      String(o.sublabel || '').toLowerCase().includes(q) ||
      String(o.value).toLowerCase().includes(q));
  }, [opts, query, searchable]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // on open: focus search, point active at the selected row
  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const i = shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    if (searchable) searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the active row scrolled into view
  useEffect(() => { if (open) activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [active, open]);

  const choose = (o) => {
    if (o.disabled) return;
    onChange?.(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const step = (d) => {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + d + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };

  const onKey = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
  };

  return (
    <div
      ref={rootRef}
      className={cx('mt-dd', size === 'sm' && 'mt-dd--sm', className)}
      data-open={open ? 'true' : 'false'}
      onKeyDown={onKey}
    >
      {name != null && <input type="hidden" name={name} value={value ?? ''} />}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={cx('mt-input', 'mt-dd__trigger', disabled && 'mt-input--disabled')}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={cx('mt-dd__val', !selected && 'mt-dd__placeholder')}>
          {selected
            ? (<>{selected.icon && <span className="mt-dd__icon">{selected.icon}</span>}{selected.label}</>)
            : placeholder}
        </span>
        {CHEVRON}
      </button>

      {open && (
        <div className="mt-menu mt-dd__panel">
          {searchable && (
            <div className="mt-dd__search">
              {SEARCH_ICON}
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Search…"
                aria-label="Filter options"
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              />
            </div>
          )}
          <div className="mt-dd__list" role="listbox" id={listId} aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}>
            {shown.length === 0 && <div className="mt-dd__empty">No matches</div>}
            {shown.map((o, i) => (
              <button
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                tabIndex={-1}
                ref={i === active ? activeRef : null}
                className={cx('mt-menu__item', 'mt-dd__item', i === active && 'is-active')}
                onClick={() => choose(o)}
                onMouseMove={() => setActive(i)}
              >
                {o.icon && <span className="mt-dd__icon">{o.icon}</span>}
                <span className="mt-dd__label">
                  {o.label}
                  {o.sublabel && <small>{o.sublabel}</small>}
                </span>
                <span className="mt-dd__dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
