import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PublicCenterNav } from '../Navbar';

afterEach(cleanup);

const renderNav = () => render(<MemoryRouter><PublicCenterNav /></MemoryRouter>);
const openCount = (c) => [...c.querySelectorAll('[role="menu"]')].filter((m) => m.getAttribute('aria-hidden') === 'false').length;

describe('<PublicCenterNav> mega-menus', () => {
  test('renders the three mega-menu triggers + Pricing', () => {
    renderNav();
    // Crimson nav redesign: Product→Features, "Who it's for"→Industries, and the
    // Compare menu was dropped (see the crawlability note below).
    ['Features', 'Industries', 'Resources'].forEach((name) =>
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing');
  });

  test('all panels start closed', () => {
    const { container } = renderNav();
    expect(openCount(container)).toBe(0);
  });

  // The panels are visually hidden until opened, but their <a> links MUST be in the
  // DOM from the first render — otherwise the prerendered HTML has no nav links and
  // these pages read as orphaned in the SEO audit (crawlers/Google never open a menu).
  // NOTE: the Crimson nav redesign dropped the Compare mega-menu, so the /compare/*
  // competitor pages are no longer linked from the top nav (they remain in the sitemap
  // + footer). Restore Compare under Resources if nav SEO for those pages matters —
  // the CompareMega component still lives in Navbar.jsx.
  test('mega-menu links are in the DOM without opening any menu (crawlable)', () => {
    const { container } = renderNav();
    ['/for/lawyers', '/for/business-consultant', '/about', '/earnings-calculator', '/wall-of-love']
      .forEach((href) => expect(container.querySelector(`a[href="${href}"]`), `${href} link missing from prerendered nav`).toBeTruthy());
  });

  test('hovering a trigger opens exactly one panel', () => {
    const { container } = renderNav();
    const wrappers = container.querySelectorAll('[data-navmenu]');
    fireEvent.mouseEnter(wrappers[0]); // Features
    expect(openCount(container)).toBe(1);
  });

  test('switching triggers hands off — never two panels open at once', () => {
    const { container } = renderNav();
    const wrappers = container.querySelectorAll('[data-navmenu]');
    fireEvent.mouseEnter(wrappers[0]); // Features
    fireEvent.mouseEnter(wrappers[2]); // Resources — opening this must close Features
    expect(openCount(container)).toBe(1);
    // and it is Resources, not Product, that is open
    const panels = [...container.querySelectorAll('[role="menu"]')];
    const openPanel = panels.find((p) => p.getAttribute('aria-hidden') === 'false');
    expect(openPanel.textContent).toMatch(/Get started/i);
  });
});
