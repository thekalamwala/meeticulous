import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function SlotCell({ state = 'empty', time, label, selected, compact, onClick, className, style }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cx('mt-slot', state !== 'empty' && 'mt-slot--' + state, selected && 'mt-slot--selected', compact && 'mt-slot--compact', className)} style={style}>
      {state === 'booked' ? <span className="mt-slot__dot" /> : <span />}
      {(time || label) && <span>{time && <b>{time}</b>}{time && label && compact ? ' · ' : time && label ? <br /> : null}{label}</span>}
    </Tag>
  );
}
