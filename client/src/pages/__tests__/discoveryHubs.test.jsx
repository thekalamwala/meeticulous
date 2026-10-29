import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Solutions from '../Solutions';
import Compare from '../Compare';
import PROFESSION_LANDING from '../for/professionLandingData';

afterEach(cleanup);

const renderAt = (Comp) => render(<MemoryRouter><Comp /></MemoryRouter>);

// The whole point of these hubs is de-orphaning: every /for/* and /compare/* landing
// page (both hide the global nav) must be reachable from a crawlable static link.
describe('<Solutions> hub', () => {
  test('links every profession landing page (/for/*)', () => {
    const { container } = renderAt(Solutions);
    Object.values(PROFESSION_LANDING).forEach((p) => {
      expect(container.querySelector(`a[href="/for/${p.slug}"]`), `missing /for/${p.slug}`).toBeTruthy();
    });
  });

  test('has an h1 and cross-links to Compare', () => {
    const { container } = renderAt(Solutions);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('a[href="/compare"]')).toBeTruthy();
  });
});

describe('<Compare> hub', () => {
  test('links every competitor comparison page (/compare/*)', () => {
    const { container } = renderAt(Compare);
    ['/compare/calendly-alternative', '/compare/acuity-alternative', '/compare/setmore-alternative',
      '/compare/simplybook-alternative', '/compare/zoho-bookings-alternative', '/compare/topmate-alternative']
      .forEach((href) => expect(container.querySelector(`a[href="${href}"]`), `missing ${href}`).toBeTruthy());
  });

  test('has an h1 and cross-links to Solutions', () => {
    const { container } = renderAt(Compare);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('a[href="/solutions"]')).toBeTruthy();
  });
});
