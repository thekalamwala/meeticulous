import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import BackgroundCurator from '../BackgroundCurator';

afterEach(cleanup);

describe('BackgroundCurator', () => {
  it('renders empty when no backgrounds registered', () => {
    const value = { backgrounds: {}, default_background: null };
    const { container } = render(<BackgroundCurator value={value} onChange={() => {}} />);
    expect(container.querySelectorAll('[class*="rounded-xl"]').length).toBe(0);
  });
});
