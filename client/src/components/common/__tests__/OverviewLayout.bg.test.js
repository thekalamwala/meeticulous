import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The host dashboard background must be CONSTANT across every /dashboard/* page.
// Every other page uses DashboardLayout's `bg-canvas` ground; the Overview page
// must match. A pink gradient surface here (as once shipped) makes /dashboard
// inconsistent with the rest. Guard the ground so it can't drift back.
const SRC = fs.readFileSync(
  path.resolve(__dirname, '../OverviewLayout.jsx'),
  'utf8',
);

describe('OverviewLayout page ground', () => {
  it('uses the shared bg-canvas ground', () => {
    const shell = SRC.match(/className="ov-shell[^"]*"/)?.[0] ?? '';
    expect(shell).toContain('bg-canvas');
  });

  it('has no pink background surface (constant with DashboardLayout)', () => {
    const shell = SRC.match(/className="ov-shell[^"]*"/)?.[0] ?? '';
    // No pink `bg-[#...]` on the ground, and no inline background gradient on it.
    expect(shell).not.toMatch(/bg-\[#F/i);
    const shellBlock = SRC.slice(SRC.indexOf('ov-shell'), SRC.indexOf('ov-shell') + 500);
    expect(shellBlock).not.toMatch(/backgroundImage|linear-gradient|radial-gradient/);
  });
});
