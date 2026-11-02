import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Tag({ selected, onRemove, children, className, ...rest }) {
  return (
    <span role="button" tabIndex={0} aria-pressed={selected} className={cx('mt-tag', selected && 'mt-tag--selected', className)} {...rest}>
      {children}
      {onRemove && <button className="mt-tag__x" aria-label="Remove" onClick={e => { e.stopPropagation(); onRemove(); }}>×</button>}
    </span>
  );
}
