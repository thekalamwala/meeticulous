import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Button({ variant = 'primary', size = 'm', block = false, iconLeft, iconRight, as, href, disabled, className, children, ...rest }) {
  const Tag = as || (href ? 'a' : 'button');
  const cls = cx('mt-btn', variant !== 'primary' && 'mt-btn--' + variant, size !== 'm' && 'mt-btn--' + size, block && 'mt-btn--block', className);
  const extra = Tag === 'button' ? { type: rest.type || 'button', disabled } : { href, 'aria-disabled': disabled || undefined };
  return <Tag className={cls} {...extra} {...rest}>{iconLeft}{children}{iconRight}</Tag>;
}
