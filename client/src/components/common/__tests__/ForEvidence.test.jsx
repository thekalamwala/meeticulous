import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import ForEvidence from '../ForEvidence';

// The GEO "evidence" signal counts UNIQUE external citation hosts; ≥2 is the
// threshold this component exists to clear. If a refactor collapses the two
// sources to one host (or drops rel safety), this fails.
describe('ForEvidence', () => {
  const links = () => [...render(<ForEvidence />).container.querySelectorAll('a[href^="http"]')];

  test('renders at least two external citations with distinct hosts', () => {
    const hosts = new Set(links().map((a) => new URL(a.getAttribute('href')).host));
    expect(hosts.size).toBeGreaterThanOrEqual(2);
  });

  test('external links open safely (noopener)', () => {
    const anchors = links();
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel') || '').toContain('noopener');
    }
  });
});
