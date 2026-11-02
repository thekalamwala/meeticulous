import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Dialog({ open = true, title, children, actions, onClose, inline, className }) {
  if (!open) return null;
  return (
    <div className={cx('mt-dialog-backdrop', inline && 'mt-dialog-backdrop--inline')} onClick={onClose}>
      <div role="dialog" aria-modal="true" className={cx('mt-dialog', className)} onClick={e => e.stopPropagation()}>
        <div className="mt-dialog__head">
          <h3 className="mt-dialog__title">{title}</h3>
          {onClose && <button className="mt-btn mt-iconbtn mt-btn--ghost mt-btn--s" aria-label="Close" onClick={onClose}><span className="mt-icon" style={{ width: 18, height: 18, '--_src': "url('https://unpkg.com/lucide-static@0.460.0/icons/x.svg')" }} /></button>}
        </div>
        <div className="mt-dialog__body">{children}</div>
        {actions && <div className="mt-dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}
