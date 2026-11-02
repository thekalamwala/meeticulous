// Locks the branded error-page system: catalog integrity, the config-driven
// ErrorPage render, the unknown-code fallback, and the Offline page. Analytics is
// mocked so the dynamic import in ErrorPage's effect can't pull the real adapters.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, render as rtlRender } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../services/analytics/events', () => ({ EVENTS: { ERROR_PAGE_VIEWED: 'error_page_viewed' } }));

import ErrorPage from '../pages/ErrorPage';
import Offline from '../pages/Offline';
import ErrorIllustration from '../components/error/ErrorIllustration';
import { ERROR_CATALOG, ACTIONS, getErrorEntry, FALLBACK_CODE } from '../config/errorCatalog';

const renderAt = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('errorCatalog integrity', () => {
  const validActions = new Set(Object.values(ACTIONS));

  it.each(Object.entries(ERROR_CATALOG))('entry "%s" is well-formed', (_code, entry) => {
    expect(typeof entry.title).toBe('string');
    expect(entry.title.length).toBeGreaterThan(0);
    expect(typeof entry.message).toBe('string');
    expect(entry.message.length).toBeGreaterThan(0);
    expect(typeof entry.art).toBe('string');
    expect(typeof entry.cta.label).toBe('string');
    expect(validActions.has(entry.cta.action)).toBe(true);
  });

  it('covers every code that has its own route', () => {
    for (const code of [400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 429, 500, 502, 503, 504]) {
      expect(ERROR_CATALOG[code]).toBeTruthy();
    }
  });

  it('falls back to 500 for an unknown code', () => {
    expect(getErrorEntry(799)).toBe(ERROR_CATALOG[String(FALLBACK_CODE)]);
  });
});

describe('ErrorPage renders from config', () => {
  it('renders the 404 title and CTA', () => {
    renderAt(<ErrorPage code={404} />);
    // #984 flat redesign dropped the "Error 404" eyebrow — title + CTA are the page now.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This page pulled a vanishing act');
    expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument();
  });

  it('renders inline line-art (no CDN image) for the 404 page', () => {
    const { container } = renderAt(<ErrorPage code={404} />);
    expect(container.querySelector('img.bas-error-art')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders the 403 access-denied CTA', () => {
    renderAt(<ErrorPage code={403} />);
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });

  it('renders a branded page (not blank) for an unknown code', () => {
    renderAt(<ErrorPage code={799} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(ERROR_CATALOG[500].title);
  });
});

describe('Offline page', () => {
  it('renders the offline title and a connection status', () => {
    renderAt(<Offline />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("You're offline");
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('404/410 catalog entries', () => {
  it('marks 404 and 410 as image-driven', () => {
    expect(ERROR_CATALOG[404].image).toBe(true);
    expect(ERROR_CATALOG[410].image).toBe(true);
    expect(ERROR_CATALOG[500].image).toBeUndefined();
  });
  it('uses the new detective copy for 404', () => {
    expect(ERROR_CATALOG[404].title).toBe('This page pulled a vanishing act');
  });
});

describe('ErrorIllustration image mode', () => {
  it('ignores image mode and still renders line-art', () => {
    const { container } = rtlRender(<ErrorIllustration art="lost" image />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('renders the SVG (no img) when image is not set', () => {
    const { container } = rtlRender(<ErrorIllustration art="lost" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('lost-page search box', () => {
  const withLocation = (ui) => {
    let loc;
    const Probe = () => { loc = useLocation(); return null; };
    render(<MemoryRouter>{ui}<Probe /></MemoryRouter>);
    return () => loc;
  };

  it('shows a search box on 404 and routes to /explore with the query', () => {
    const getLoc = withLocation(<ErrorPage code={404} />);
    const input = screen.getByLabelText('Search Meeticulous');
    fireEvent.change(input, { target: { value: 'yoga coach' } });
    fireEvent.submit(input.closest('form'));
    expect(getLoc().pathname).toBe('/explore');
    expect(getLoc().search).toBe(`?q=${encodeURIComponent('yoga coach')}`);
  });

  it('empty submit just opens /explore', () => {
    const getLoc = withLocation(<ErrorPage code={404} />);
    fireEvent.submit(screen.getByLabelText('Search Meeticulous').closest('form'));
    expect(getLoc().pathname).toBe('/explore');
    expect(getLoc().search).toBe('');
  });

  it('does NOT show the search box on a non-lost page (500)', () => {
    render(<MemoryRouter><ErrorPage code={500} /></MemoryRouter>);
    expect(screen.queryByLabelText('Search Meeticulous')).toBeNull();
  });
});
