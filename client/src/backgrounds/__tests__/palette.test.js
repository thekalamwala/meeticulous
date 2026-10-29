// client/src/backgrounds/__tests__/palette.test.js
import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, rotateHue, tint, festivePalette } from '../palette';

describe('palette', () => {
  it('parses hex to rgb', () => {
    expect(hexToRgb('#0079c1')).toEqual({ r: 0, g: 121, b: 193 });
    expect(hexToRgb('bad')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('round-trips rgb<->hex', () => {
    expect(rgbToHex({ r: 0, g: 121, b: 193 })).toBe('#0079c1');
  });
  it('rotateHue returns a valid hex different from input', () => {
    const out = rotateHue('#2E1065', 120);
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out).not.toBe('#2E1065');
  });
  it('tint lightens toward white at amount 1', () => {
    expect(tint('#000000', 1)).toBe('#ffffff');
    expect(tint('#000000', 0)).toBe('#000000');
  });
  it('festivePalette returns N on-brand hex colors', () => {
    const p = festivePalette('#2E1065', 5);
    expect(p).toHaveLength(5);
    p.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });
});
