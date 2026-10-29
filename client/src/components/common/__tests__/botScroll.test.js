import { describe, it, expect } from 'vitest';
import { shouldSwallowScroll } from '../BotWidget.jsx';

// Guards the "scroll the chat, page scrolls" fix: the page must not scroll when the
// list can't consume the wheel gesture, but native scrolling must run mid-list.
describe('shouldSwallowScroll', () => {
  const box = (o) => ({ scrollTop: 0, scrollHeight: 1000, clientHeight: 500, ...o });

  it('swallows when list is not scrollable (short conversation)', () => {
    const notScrollable = { scrollTop: 0, scrollHeight: 300, clientHeight: 500 };
    expect(shouldSwallowScroll(50, notScrollable)).toBe(true);
    expect(shouldSwallowScroll(-50, notScrollable)).toBe(true);
  });

  it('swallows at top scrolling up, and at bottom scrolling down', () => {
    expect(shouldSwallowScroll(-50, box({ scrollTop: 0 }))).toBe(true);      // top, up
    expect(shouldSwallowScroll(50, box({ scrollTop: 500 }))).toBe(true);     // bottom, down
  });

  it('lets native scroll run mid-list and away from a boundary', () => {
    expect(shouldSwallowScroll(50, box({ scrollTop: 200 }))).toBe(false);    // middle, down
    expect(shouldSwallowScroll(-50, box({ scrollTop: 200 }))).toBe(false);   // middle, up
    expect(shouldSwallowScroll(50, box({ scrollTop: 0 }))).toBe(false);      // top, down (into content)
    expect(shouldSwallowScroll(-50, box({ scrollTop: 500 }))).toBe(false);   // bottom, up (into content)
  });
});
