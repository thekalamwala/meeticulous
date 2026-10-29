import { render, screen } from '@testing-library/react';
import { vi, test, expect, describe, afterEach } from 'vitest';
import TwoClock, { humanClockTone } from '../pages/admin/sales/TwoClock';

const DAY = 864e5;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

describe('humanClockTone (staleness colour of the relationship clock)', () => {
  test('a fresh conversation is neutral', () => {
    expect(humanClockTone(ago(3))).toBe('adm-t2');
  });
  test('>21d cooling → amber', () => {
    expect(humanClockTone(ago(30))).toBe('text-amber-600');
  });
  test('>45d → red', () => {
    expect(humanClockTone(ago(60))).toBe('text-red-600');
  });
  test('never (null) → red (Infinity days)', () => {
    expect(humanClockTone(null)).toBe('text-red-600');
  });
});

describe('TwoClock render', () => {
  afterEach(() => vi.useRealTimers());

  test('shows both clocks with their labels', () => {
    render(<TwoClock meaningfulAt={ago(2)} automatedAt={ago(1)} />);
    expect(screen.getByText(/^Human /)).toBeInTheDocument();
    expect(screen.getByText(/^Auto /)).toBeInTheDocument();
  });

  test('null timestamps read "never"', () => {
    render(<TwoClock meaningfulAt={null} automatedAt={null} />);
    expect(screen.getByText('Human never')).toBeInTheDocument();
    expect(screen.getByText('Auto never')).toBeInTheDocument();
  });

  test('the machine clock never carries a staleness colour (automation recency is not health)', () => {
    // A very stale automated touch must still render neutral — only the human clock warns.
    const { container } = render(<TwoClock meaningfulAt={ago(1)} automatedAt={ago(200)} />);
    const auto = screen.getByText(/^Auto /).closest('span');
    expect(auto.className).toContain('adm-t3');
    expect(auto.className).not.toContain('text-red-600');
    expect(container).toBeTruthy();
  });
});
