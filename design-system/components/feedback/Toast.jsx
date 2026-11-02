import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Toast({ tone = 'brand', title, description, action, onAction, onClose, className }) {
  return (
    <div role="status" className={cx('mt-toast', tone !== 'brand' && 'mt-toast--' + tone, className)}>
      <span className="mt-toast__dot" />
      <div style={{ flex: 1, minWidth: 0 }}><span className="mt-toast__title">{title}</span>{description && <span className="mt-toast__desc">{description}</span>}</div>
      {action && <button className="mt-toast__action" onClick={onAction}>{action}</button>}
      {onClose && <button className="mt-toast__close" aria-label="Dismiss" onClick={onClose}>×</button>}
    </div>
  );
}
