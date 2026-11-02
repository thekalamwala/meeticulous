import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Select({ label, hint, error, options = [], id, disabled, className, ...rest }) {
  const iid = id || React.useId();
  return (
    <div className={cx('mt-field', error && 'mt-field--error', className)}>
      {label && <label className="mt-label" htmlFor={iid}>{label}</label>}
      <div className={cx('mt-input mt-select', disabled && 'mt-input--disabled')}>
        <select id={iid} disabled={disabled} {...rest}>
          {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="mt-icon" style={{ width: 18, height: 18, color: 'var(--fg-2)', '--_src': "url('https://unpkg.com/lucide-static@0.460.0/icons/chevron-down.svg')", pointerEvents: 'none' }} />
      </div>
      {(error || hint) && <span className="mt-hint">{error || hint}</span>}
    </div>
  );
}
