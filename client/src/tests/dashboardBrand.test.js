import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// P1 of the host dashboard makeover (docs/host-dashboard-makeover.md): ServiceForm
// and UpgradePlan brought onto the Loop & Slot token system. Keep them there —
// no cold Tailwind grays (brand uses the warm `neutral-*` ramp), no gradient
// utilities, no off-palette color classes. `red-*` is allowed only for genuine
// error/danger states, so it is not guarded here.
const FILES = {
  ServiceForm: '../pages/services/ServiceForm.jsx',
  UpgradePlan: '../pages/UpgradePlan.jsx',
};

const GRAY = /\b(?:text|bg|border|ring|from|to|via|divide|placeholder|fill|stroke)-gray-\d/g;
const GRADIENT = /gradient-to-|linear-gradient\(|radial-gradient\(/g;
const OFF_PALETTE = /\b(?:text|bg|border|ring)-(?:amber|yellow|green|emerald|blue|indigo|violet|purple)-\d/g;

describe.each(Object.entries(FILES))('%s brand compliance', (name, rel) => {
  const src = fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  it('uses no cold gray-* classes', () => expect(src.match(GRAY)).toBeNull());
  it('uses no gradient utilities', () => expect(src.match(GRADIENT)).toBeNull());
  it('uses no off-palette color classes', () => expect(src.match(OFF_PALETTE)).toBeNull());
});
