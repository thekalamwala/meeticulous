import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Checkbox({ label, description, disabled, className, ...rest }) {
  return (
    <label className={cx('mt-check', disabled && 'mt-check--disabled', className)}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span className="mt-check__box" />
      <span>{label}{description && <span className="mt-check__desc">{description}</span>}</span>
    </label>
  );
}
