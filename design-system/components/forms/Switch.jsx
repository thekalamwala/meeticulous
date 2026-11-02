import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Switch({ label, className, ...rest }) {
  return (
    <label className={cx('mt-switch', className)}>
      <input type="checkbox" role="switch" {...rest} />
      <span className="mt-switch__track" />
      {label && <span>{label}</span>}
    </label>
  );
}
