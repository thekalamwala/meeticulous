import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import HostBackground from '../HostBackground';

afterEach(cleanup);

describe('HostBackground', () => {
  it('renders the masked band wrapper', () => {
    const { container } = render(<HostBackground typeKey={null} color="#0079C1" />);
    expect(container.querySelector('[data-bg-band]')).toBeInTheDocument();
  });
  it('renders static fallback for any key (no engines registered)', () => {
    const { container } = render(<HostBackground typeKey="lines" color="#0079C1" />);
    expect(container.querySelector('[data-bg-static]')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
