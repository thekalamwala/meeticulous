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
    expect(links).toHaveLength(PAGE_GUIDES['/features/payments'].length);
    expect(links[0].getAttribute('href')).toBe(`/blog/${PAGE_GUIDES['/features/payments'][0].slug}`);
  });
  it('renders nothing on unmapped routes', () => {
    const { container } = at('/pricing');
    expect(container.innerHTML).toBe('');
  });
});
