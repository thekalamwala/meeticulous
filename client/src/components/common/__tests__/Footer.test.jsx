import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

afterEach(cleanup);

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('<Footer>', () => {
  test('brand column + four link columns (Product, Company, Resources, Legal)', () => {
    renderFooter();
    expect(screen.getByRole('button', { name: 'Meeticulous' })).toBeTruthy();
    expect(screen.getByText(/All rights reserved/i)).toBeTruthy();
    ['Product', 'Company', 'Resources', 'Legal'].forEach((name) => {
      expect(screen.getByRole('navigation', { name })).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: 'About Us' }).getAttribute('href')).toBe('/about');
    // The old CTA band is gone.
    expect(screen.queryByText(/Power up your/i)).toBeNull();
  });

  test('links the Solutions + Compare discovery hubs (no per-profession sitemap)', () => {
    const { container } = renderFooter();
    // Discovery lives on dedicated hub pages; the footer links into them in
    // static HTML so the crawler reaches /for/* + /compare/* via those hubs.
    expect(screen.getByRole('link', { name: 'Solutions' }).getAttribute('href')).toBe('/solutions');
    expect(screen.getByRole('link', { name: 'Compare' }).getAttribute('href')).toBe('/compare');
    // No per-profession links.
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
    // Plain text since the move to Rajmudra Media LLP (no backlink any more).
    expect(screen.getByText('Operated and Hand crafted by the humans of Rajmudra Media LLP')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /timewheel/i })).toBeNull();
    const mail = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === 'mailto:hello@meeticulous.com');
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

  test('full footer ends with the decorative doodle wordmark (hidden from screen readers)', () => {
    const { container } = renderFooter();
    const art = container.querySelector('.dw');
    expect(art).toBeTruthy();
    expect(art.getAttribute('aria-hidden')).toBe('true');
    // The decorative letters spell the brand but add no extra "Meeticulous" button.
    expect(art.querySelector('.dw-word').textContent).toBe('Meeticulous');
    expect(screen.getAllByRole('button', { name: 'Meeticulous' })).toHaveLength(1);
    // Creatures + drifting doodles are rendered.
    expect(art.querySelectorAll('.dw-critter').length).toBe(5);
    expect(art.querySelector('.dw-snail')).toBeTruthy();
    expect(art.querySelectorAll('.dw-doodle').length).toBeGreaterThan(0);
  });

  test('minimal variant keeps the quiet faint wordmark, not the doodle art', () => {
    const { container } = render(<MemoryRouter><Footer variant="minimal" /></MemoryRouter>);
    expect(container.querySelector('.dw')).toBeNull();
  });

  test('minimal variant keeps brand + legal bar but drops columns, socials, newsletter', () => {
    render(<MemoryRouter><Footer variant="minimal" /></MemoryRouter>);
    // brand + copyright survive
    expect(screen.getByRole('button', { name: 'Meeticulous' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeTruthy();
    // legal bar survives (operator credit + a legal link); Bolt attribution removed
    expect(screen.getByText('Operated and Hand crafted by the humans of Rajmudra Media LLP')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Bolt the Sloth' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    // link columns + socials + newsletter are gone
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    expect(screen.queryByLabelText('Instagram')).toBeNull();
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull();
  });
});
