import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageGuides from '../PageGuides';
import { PAGE_GUIDES } from '../../../data/pageGuides';

const at = (pathname) => render(<MemoryRouter><PageGuides pathname={pathname} /></MemoryRouter>);

describe('PageGuides', () => {
  it('links the mapped guides for a page, trailing slash tolerated', () => {
    at('/features/payments/');
    const links = screen.getAllByRole('link');
    // Feature pages cap the strip at 3 guides (see PageGuides.jsx).
    const expected = PAGE_GUIDES['/features/payments'].slice(0, 3);
    expect(links).toHaveLength(expected.length);
    expect(links[0].getAttribute('href')).toBe(`/blog/${expected[0].slug}`);
  });
  it('renders nothing on unmapped routes', () => {
    const { container } = at('/pricing');
    expect(container.innerHTML).toBe('');
  });
});
