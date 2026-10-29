import { describe, it, expect } from 'vitest';
import { coverFitScale, clampOffset } from '../ImageCropper';

describe('coverFitScale — smallest scale that fully covers the frame', () => {
  it('scales up a small image to cover', () => {
    // 100x100 image into a 300x300 frame → needs 3×
    expect(coverFitScale(100, 100, 300, 300)).toBe(3);
  });
  it('picks the larger ratio (wide image, square frame)', () => {
    // 600x100 into 300x300: max(0.5, 3) = 3 (height governs)
    expect(coverFitScale(600, 100, 300, 300)).toBe(3);
  });
  it('handles a 3:1 cover frame', () => {
    // 900x900 into 600x200: max(0.667, 0.222) = 0.667
    expect(coverFitScale(900, 900, 600, 200)).toBeCloseTo(0.6667, 3);
  });
  it('guards zero dimensions', () => {
    expect(coverFitScale(0, 0, 300, 300)).toBe(1);
  });
});

describe('clampOffset — image can never reveal an empty edge', () => {
  const frameW = 300, frameH = 300;

  it('keeps the frame covered — no positive offset (would show a gap top/left)', () => {
    const o = clampOffset({ x: 50, y: 50 }, 600, 600, frameW, frameH);
    expect(o.x).toBe(0);
    expect(o.y).toBe(0);
  });

  it('stops at the far edge (no gap bottom/right)', () => {
    // image 600 wide in 300 frame → min x = 300-600 = -300
    const o = clampOffset({ x: -9999, y: -9999 }, 600, 600, frameW, frameH);
    expect(o.x).toBe(-300);
    expect(o.y).toBe(-300);
  });

  it('allows valid interior panning', () => {
    const o = clampOffset({ x: -120, y: -80 }, 600, 600, frameW, frameH);
    expect(o.x).toBe(-120);
    expect(o.y).toBe(-80);
  });

  it('centres an axis smaller than the frame instead of leaving it pinned', () => {
    // img 200 wide < 300 frame → centred at (300-200)/2 = 50
    const o = clampOffset({ x: -50, y: 0 }, 200, 600, frameW, frameH);
    expect(o.x).toBe(50);
  });
});
