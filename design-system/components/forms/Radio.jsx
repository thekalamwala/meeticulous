import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Radio({ label, description, disabled, className, ...rest }) {
  return (
    <label className={cx('mt-check mt-check--radio', disabled && 'mt-check--disabled', className)}>
      <input type="radio" disabled={disabled} {...rest} />
      <span className="mt-check__box" />
      <span>{label}{description && <span className="mt-check__desc">{description}</span>}</span>
    </label>
  );
}
