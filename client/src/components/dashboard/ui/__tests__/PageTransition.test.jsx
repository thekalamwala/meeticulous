import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { PageTransition } from '../PageTransition';

describe('PageTransition', () => {
  it('renders children within a router', () => {
    render(
      <MemoryRouter>
        <PageTransition><div>Page body</div></PageTransition>
      </MemoryRouter>,
    );
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
