import { describe, it, expect } from 'vitest';
import { claimBrush } from '../pages/agents/territory';
import { BODY } from '../pages/agents/sprites';

describe('/agents territory', () => {
  it('claims a round brush and keeps per-agent counts in sync when tiles are stolen', () => {
    const cols = 10, rows = 8;
    const own = new Int8Array(cols * rows).fill(-1);
    const count = [0, 0, 0, 0];

    claimBrush(own, count, cols, rows, 4, 4, 0);
    expect(count[0]).toBe(21); // radius-2 round brush, fully on the board

    let changed = 0;
    claimBrush(own, count, cols, rows, 5, 4, 1, () => { changed += 1; });
    expect(count[0] + count[1]).toBe([...own].filter((o) => o >= 0).length);
    expect(count[1]).toBe(21);
    expect(changed).toBe(21); // overlapping tiles changed hands, none double-counted
    expect(count[0]).toBeLessThan(21);

    claimBrush(own, count, cols, rows, 0, 0, 2); // corner: brush clipped to the board
    expect(count.reduce((s, n) => s + n, 0)).toBe([...own].filter((o) => o >= 0).length);
  });

  it('every mascot is a 32x32 map (16-char rows mirror to 32)', () => {
    for (const [name, body] of Object.entries(BODY)) {
      expect(body.rows, name).toHaveLength(32);
      for (const row of body.rows) expect([16, 32], `${name}: ${row}`).toContain(row.length);
    }
  });
});
