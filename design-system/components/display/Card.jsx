import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Card({ variant = 'surface', size = 'm', raised, interactive, kicker, title, children, className, ...rest }) {
  return (
    <div className={cx('mt-card', variant !== 'surface' && 'mt-card--' + variant, size === 's' && 'mt-card--s', raised && 'mt-card--raised', interactive && 'mt-card--interactive', className)} {...rest}>
      {kicker && <span className="mt-card__kicker">{kicker}</span>}
      {title && <h4 className="mt-card__title">{title}</h4>}
      {typeof children === 'string' ? <p className="mt-card__body">{children}</p> : children}
    </div>
  );
}
