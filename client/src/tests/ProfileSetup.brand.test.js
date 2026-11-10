import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Settings (Profile) was the worst brand offender before the makeover
// (docs/host-dashboard-makeover.md). Keep it on the token system: no cold
// Tailwind grays (the brand uses the warm `neutral-*` ramp instead), no
// gradient utilities, no off-palette color classes. Hex is allowed here only
// for the Google logo SVG + inline token values, so this guard checks classes.
const SRC = fs.readFileSync(
  path.resolve(__dirname, '../pages/ProfileSetup.jsx'),
  'utf8',
);

describe('ProfileSetup brand compliance', () => {
  it('uses no cold gray-* classes', () => {
    expect(SRC.match(/\b(?:text|bg|border|ring|from|to|via)-gray-\d/g)).toBeNull();
  });

  it('uses no gradient utilities', () => {
    expect(SRC.match(/gradient-to-|linear-gradient\(|radial-gradient\(/g)).toBeNull();
  });

  it('uses no off-palette color classes', () => {
    // amber/yellow/green/blue/indigo/violet/purple are not in the Loop & Slot kit.
    expect(SRC.match(/\b(?:text|bg|border|ring)-(?:amber|yellow|green|blue|indigo|violet|purple)-\d/g)).toBeNull();
  });
});
