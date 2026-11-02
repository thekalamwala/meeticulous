import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Tooltip({ content, placement = 'top', open, children, className }) {
  return <span className={cx('mt-tooltip', placement === 'bottom' && 'mt-tooltip--bottom', open && 'mt-tooltip--open', className)}>{children}<span role="tooltip" className="mt-tooltip__bubble">{content}</span></span>;
}
