import React from 'react';
const __mtBase = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';
export function Thread({ color = 'rose', variant = 'thread', width = 820, assetBase, style, className }) {
  const file = variant === 'ribbon' ? 'mt-ee-ribbon-' : variant === 'mark' ? 'mt-ee-' : 'mt-ee-thread-';
  const src = (assetBase ?? (__mtBase + 'assets/')) + '02-ee/' + file + color + '.svg';
  return <img src={src} alt="" aria-hidden="true" className={className} style={{ width, height: 'auto', display: 'block', pointerEvents: 'none', ...style }} />;
}
