import React from 'react';
const __mtBase = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';
export function Illustration({ name = 'availability', mode = 'light', width = 240, assetBase, style, className, alt = '' }) {
  const src = (assetBase ?? (__mtBase + 'assets/')) + '04-illustrations/mt-illo-' + name + '-' + mode + '.svg';
  return <img src={src} alt={alt} className={className} style={{ width, height: 'auto', display: 'block', ...style }} />;
}
