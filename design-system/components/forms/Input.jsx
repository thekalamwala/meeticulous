import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Input({ label, hint, error, prefix, suffix, id, disabled, className, ...rest }) {
  const iid = id || React.useId();
  return (
    <div className={cx('mt-field', error && 'mt-field--error', className)}>
      {label && <label className="mt-label" htmlFor={iid}>{label}</label>}
      <div className={cx('mt-input', disabled && 'mt-input--disabled')}>
        {prefix && <span className="mt-affix">{prefix}</span>}
        <input id={iid} disabled={disabled} aria-invalid={!!error || undefined} {...rest} />
        {suffix && <span className="mt-affix">{suffix}</span>}
      </div>
      {(error || hint) && <span className="mt-hint">{error || hint}</span>}
    </div>
  );
}
