import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProTeaser from './ProTeaser';

describe('ProTeaser', () => {
  it('overlays an attributed upgrade CTA on blurred aria-hidden sample', () => {
    render(
      <MemoryRouter>
        <ProTeaser title="See what converts" sub="Upgrade to unlock" src="crm">
          <div>SAMPLE</div>
        </ProTeaser>
      </MemoryRouter>,
    );
    const cta = screen.getByRole('link', { name: /Upgrade to Pro/i });
    expect(cta).toHaveAttribute('href', '/dashboard/upgrade?src=crm');
    // Sample content is present but hidden from assistive tech (fake numbers).
    const sample = screen.getByText('SAMPLE');
    expect(sample.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('omits the query when no src is given', () => {
    render(
      <MemoryRouter>
        <ProTeaser title="t" sub="s"><div>X</div></ProTeaser>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Upgrade to Pro/i }))
      .toHaveAttribute('href', '/dashboard/upgrade');
  });
});
