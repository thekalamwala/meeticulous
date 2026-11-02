import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function IconButton({ icon, label, variant = 'ghost', size = 'm', className, ...rest }) {
  return <button type="button" aria-label={label} title={label} className={cx('mt-btn mt-iconbtn', variant !== 'primary' && 'mt-btn--' + variant, size !== 'm' && 'mt-btn--' + size, className)} {...rest}>{icon}</button>;
}
