import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Badge({ tone = 'neutral', dot, children, className, ...rest }) {
  const showDot = dot ?? ['booked', 'open', 'brand'].includes(tone);
  return <span className={cx('mt-badge', tone !== 'neutral' && 'mt-badge--' + tone, className)} {...rest}>{showDot && <span className="mt-badge__dot" />}{children}</span>;
}
