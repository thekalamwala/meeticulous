import { describe, it, expect } from 'vitest';
import { niceTicks, buildLinePath, buildAreaPath } from '../utils/chartGeometry';

describe('niceTicks', () => {
  it('returns [0, 1] when max is 0 (avoids divide-by-zero)', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('produces 1-2-5 rounded ticks starting at 0 and covering max', () => {
    expect(niceTicks(32400, 4)).toEqual([0, 10000, 20000, 30000, 40000]);
    expect(niceTicks(800, 4)).toEqual([0, 200, 400, 600, 800]);
  });

  it('last tick is >= max', () => {
    const t = niceTicks(950, 4);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(950);
  });

  it('ticks are strictly ascending with equal steps', () => {
    const t = niceTicks(5000, 4);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    const step = t[1] - t[0];
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(step);
  });
});

describe('buildLinePath', () => {
  it('returns empty string for no points', () => {
    expect(buildLinePath([])).toBe('');
  });

  it('returns a single move for one point', () => {
    expect(buildLinePath([{ x: 5, y: 7 }])).toBe('M 5 7');
  });

  it('starts at the first point and passes through every data point with cubic segments', () => {
    const path = buildLinePath([
      { x: 0, y: 100 },
      { x: 40, y: 10 },
      { x: 80, y: 60 },
    ]);
    expect(path.startsWith('M 0 100')).toBe(true);
    expect(path).toContain('C'); // smooth (cubic) segments
    expect(path).toContain('40 10'); // passes through middle point
    expect(path).toContain('80 60'); // ends at last point
  });
});

describe('buildAreaPath', () => {
  it('returns empty string for no points', () => {
    expect(buildAreaPath([], 200)).toBe('');
  });

  it('closes the path down to the baseline', () => {
    const area = buildAreaPath(
      [{ x: 0, y: 100 }, { x: 40, y: 10 }, { x: 80, y: 60 }],
      200,
    );
    expect(area.startsWith('M 0 100')).toBe(true);
    expect(area.trim().endsWith('Z')).toBe(true);
    expect(area).toContain('200'); // baseline corners
  });
});
