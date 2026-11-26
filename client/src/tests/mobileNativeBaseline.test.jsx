import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderHook } from '@testing-library/react';
import useDashboardChrome from '../hooks/useDashboardChrome';

// Guards the mobile-native baseline: the platform fixes that make the dashboard
// behave like an installed app on a phone. Each one is a single line that is easy
// to "tidy" away without noticing what it was for.
const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('mobile-native baseline', () => {
  it('lets env(safe-area-inset-*) work (viewport-fit=cover)', () => {
    const meta = read('../../index.html').match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';
    expect(meta).toContain('viewport-fit=cover');
    // Never disable zoom to dodge input zoom; the 16px rule fixes the cause.
    expect(meta).not.toMatch(/user-scalable=no|maximum-scale=1/);
  });

  it('only applies hover styles on devices that can hover', () => {
    expect(read('../../tailwind.config.js')).toMatch(/hoverOnlyWhenSupported:\s*true/);
  });

  it('keeps touch inputs at 16px and the dashboard free of native pull-to-refresh', () => {
    const css = read('../index.css');
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*?font-size: 16px !important/);
    expect(css).toMatch(/html\.dash-app[\s\S]*?overscroll-behavior-y: none/);
    expect(css).toMatch(/-webkit-tap-highlight-color: transparent/);
  });

  it('v2 shell reads the WINDOW scroll for pull-to-refresh (window scrolls, not <main>)', () => {
    // Passing <main> made scrollTop read 0 at any depth, so on a phone every
    // downward drag (scrolling back up) was swallowed into a refresh.
    const src = read('../components/common/DashboardLayoutV2.jsx');
    expect(src).not.toMatch(/<PullToRefresh\s+scrollerRef/);
  });
});

describe('useDashboardChrome', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.documentElement.style.removeProperty('--mt-cream');
  });

  it('sets the cream status bar and dash-app class while mounted, restores both after', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#960D32">';
    document.documentElement.style.setProperty('--mt-cream', '#FBF5F3');
    const meta = document.querySelector('meta[name="theme-color"]');

    const { unmount } = renderHook(() => useDashboardChrome());
    expect(meta.getAttribute('content')).toBe('#FBF5F3');
    expect(document.documentElement.classList.contains('dash-app')).toBe(true);

    unmount();
    expect(meta.getAttribute('content')).toBe('#960D32');
    expect(document.documentElement.classList.contains('dash-app')).toBe(false);
  });
});
