// client/src/components/blog/__tests__/RelatedPosts.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedPosts from '../RelatedPosts';

const renderFor = (slug) =>
  render(<MemoryRouter><RelatedPosts slug={slug} /></MemoryRouter>);

describe('RelatedPosts', () => {
  it('renders 1-3 blog links, never a self-link', () => {
    const { container } = renderFor('zero-commission-bet');
    const links = container.querySelectorAll('a[href^="/blog/"]');
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThanOrEqual(3);
    links.forEach((a) => expect(a.getAttribute('href')).not.toBe('/blog/zero-commission-bet'));
  });

  it('renders nothing for an unknown slug', () => {
    const { container } = renderFor('does-not-exist');
    expect(container.querySelector('a[href^="/blog/"]')).toBeNull();
  });
});
