import React from 'react';
const __mtBase = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';
const MAP = {
  wordmark: { color: '01-logo/wordmark/mt-wordmark-full-color.svg', inverse: '01-logo/wordmark/mt-wordmark-inverse.svg', white: '01-logo/wordmark/mt-wordmark-mono-white.svg', primary: '01-logo/wordmark/mt-wordmark-mono-primary.svg', black: '01-logo/wordmark/mt-wordmark-mono-black.svg' },
  icon: { color: '01-logo/icon/mt-icon-color.svg', inverse: '01-logo/icon/mt-icon-color-reversed.svg', white: '01-logo/icon/mt-icon-mono-white.svg', primary: '01-logo/icon/mt-icon-mono-primary.svg', black: '01-logo/icon/mt-icon-mono-black.svg', small: '01-logo/icon/mt-icon-small-color.svg' },
  ee: { color: '01-logo/mark/mt-ee-mark-color.svg', inverse: '01-logo/mark/mt-ee-mark-accent.svg', white: '01-logo/mark/mt-ee-mark-white.svg', primary: '01-logo/mark/mt-ee-mark-primary.svg', black: '01-logo/mark/mt-ee-mark-primary.svg' },
  monogram: { color: '01-logo/mark/mt-m-monogram-primary.svg', inverse: '01-logo/mark/mt-m-monogram-white.svg', white: '01-logo/mark/mt-m-monogram-white.svg', primary: '01-logo/mark/mt-m-monogram-primary.svg', black: '01-logo/mark/mt-m-monogram-black.svg' },
};
export function Logo({ kind = 'wordmark', tone = 'color', height = 28, assetBase, style, className }) {
  const src = (assetBase ?? (__mtBase + 'assets/')) + (MAP[kind][tone] || MAP[kind].color);
  return <img src={src} alt="Meeticulous" className={className} style={{ height, width: 'auto', display: 'block', ...style }} />;
}
