import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

afterEach(cleanup);

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('<Footer>', () => {
  test('CTA primary points at the start route', () => {
    renderFooter();
    expect(screen.getByText(/Power up your/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: "Let's Get Started" }).getAttribute('href'),
    ).toBe('/become-a-host');
  });

  test('links the Solutions + Compare discovery hubs (not a heavy column sitemap)', () => {
    const { container } = renderFooter();
    // Discovery now lives on dedicated hub pages; the footer just links into them
    // in static HTML so the crawler reaches /for/* + /compare/* via those hubs.
    expect(screen.getByRole('link', { name: 'Solutions' }).getAttribute('href')).toBe('/solutions');
    expect(screen.getByRole('link', { name: 'Compare' }).getAttribute('href')).toBe('/compare');
    // The old 5-column discovery grid is gone, and so are the per-profession links.
    expect(container.querySelector('nav[aria-label="Site"]')).toBeNull();
    expect(container.querySelector('a[href="/for/doctors-india"]')).toBeNull();
    // Still no newsletter form.
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
  });

  test('drops redundant links that duplicate the CTA and the navbar', () => {
    renderFooter();
    expect(screen.queryByRole('link', { name: 'Be a Host' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Host log in' })).toBeNull();
  });

  test('legal strip has the legal + support links, operator line and support email', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'FAQ' }).getAttribute('href')).toBe('/#faq');
    expect(screen.getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe('/help/docs');
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'Refund' }).getAttribute('href')).toBe('/refund');
    // Company ownership line — required by the Google OAuth verification checklist.
    // "Timewheel Internet" is a dofollow backlink to Timewheel's web-development page.
    const operator = screen.getByRole('link', { name: 'Timewheel Internet' });
    expect(operator.getAttribute('href')).toBe('https://timewheel.co.in/web-development-company-in-nagpur');
    expect(operator.getAttribute('rel')).toBe('noopener');
    expect(operator.closest('span').textContent).toMatch(/Operated and Hand crafted by the humans of Timewheel Internet Private Limited/);
    const mail = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === 'mailto:bolt@meeticulous.in');
    expect(mail).toBeTruthy();
  });

  test('social links are safe external links with aria-labels', () => {
    renderFooter();
    ['Instagram', 'X', 'LinkedIn', 'Facebook', 'WhatsApp'].forEach((name) => {
      const link = screen.getByLabelText(name);
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });
  });

  test('minimal variant keeps CTA + legal bar but drops columns, socials, newsletter', () => {
    render(<MemoryRouter><Footer variant="minimal" /></MemoryRouter>);
    // CTA band survives
    expect(screen.getByText(/Power up your/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: "Let's Get Started" })).toBeTruthy();
    // legal bar survives (operator backlink + a legal link); Bolt attribution removed
    expect(screen.getByRole('link', { name: 'Timewheel Internet' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Bolt the Sloth' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    // link columns + socials + newsletter are gone
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    expect(screen.queryByLabelText('Instagram')).toBeNull();
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
  });
});
