import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Tabs({ items = [], value, defaultValue, onChange, variant = 'pill', className }) {
  const [inner, setInner] = React.useState(defaultValue ?? (items[0] && (items[0].value ?? items[0])));
  const cur = value ?? inner;
  return (
    <div role="tablist" className={cx('mt-tabs', variant === 'underline' && 'mt-tabs--underline', className)}>
      {items.map(it => { const v = it.value ?? it, l = it.label ?? it; return (
        <button key={v} role="tab" aria-selected={cur === v} className="mt-tab" onClick={() => { setInner(v); onChange && onChange(v); }}>
          {l}{it.count != null && <span className="mt-tab__count">{it.count}</span>}
        </button>); })}
    </div>
  );
}
