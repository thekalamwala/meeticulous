import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({}) }));
vi.mock('../../../hooks/useSupportUnread', () => ({ default: () => 0 }));

const { NAV } = await import('../ConsoleSidebar');

// Nav glyphs are static PNGs — a typo'd name ships as a silent broken image.
const ICON_DIR = path.resolve(__dirname, '../../../../public/icons/dashboard');
const has = (name) => ['@2x', '@3x'].every((s) => fs.existsSync(path.join(ICON_DIR, `${name}${s}.png`)));

describe('ConsoleSidebar nav icons', () => {
  it('every section and item has its PNG for each state it can show', () => {
    const missing = [];
    for (const section of NAV) {
      for (const state of ['active', 'inactive']) {
        if (!has(`${section.icon}-${state}`)) missing.push(`${section.icon}-${state}`);
      }
      for (const item of section.items) {
        const states = ['active', 'inactive', ...(item.locked ? ['locked'] : [])];
        for (const state of states) {
          if (!has(`${item.icon}-${state}`)) missing.push(`${item.icon}-${state}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
