import { describe, test, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Seo from '../Seo';

afterEach(cleanup);

const props = {
  title: 'Business Consultation with John Doe | Meeticulous',
  description: 'A 1:1 call.',
  canonical: 'https://meeticulous.com/john-doe/business-consultation',
  robots: 'noindex,nofollow',
  ogTitle: 'Business Consultation',
  ogDescription: 'A 1:1 call.',
  image: 'https://img/t.jpg',
  jsonLd: { '@context': 'https://schema.org', '@type': 'Service', name: 'Business Consultation' },
};

const head = (sel) => document.head.querySelector(sel);

describe('<Seo>', () => {
  test('sets title, description, robots and canonical', () => {
    render(<Seo {...props} />);
    expect(document.title).toBe(props.title);
    expect(head('meta[name="description"]').getAttribute('content')).toBe('A 1:1 call.');
    expect(head('meta[name="robots"]').getAttribute('content')).toBe('noindex,nofollow');
    expect(head('link[rel="canonical"]').getAttribute('href')).toBe(props.canonical);
  });

  test('emits Open Graph + Twitter tags', () => {
    render(<Seo {...props} />);
    expect(head('meta[property="og:title"]').getAttribute('content')).toBe('Business Consultation');
    expect(head('meta[property="og:url"]').getAttribute('content')).toBe(props.canonical);
    expect(head('meta[property="og:image"]').getAttribute('content')).toBe('https://img/t.jpg');
    expect(head('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
  });

  test('injects a JSON-LD script and removes it on unmount', () => {
    const { unmount } = render(<Seo {...props} />);
    const script = head('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    expect(JSON.parse(script.textContent)['@type']).toBe('Service');
    unmount();
    expect(head('script[type="application/ld+json"]')).toBeNull();
  });
});
