import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import JobDetail from '../JobDetail';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/careers/:jobSlug" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>
  );

describe('JobDetail page', () => {
  it('renders a known role with its meta + apply mailto', () => {
    renderAt('/careers/digital-marketeer');
    expect(screen.getByRole('heading', { name: /digital marketeer/i })).toBeInTheDocument();
    expect(screen.getByText(/responsibilities/i)).toBeInTheDocument();
    const apply = screen.getByRole('link', { name: /apply/i });
    expect(apply.getAttribute('href')).toMatch(/^mailto:bolt@meeticulous\.in\?subject=/);
  });

  it('shows a friendly not-found block for an unknown slug', () => {
    renderAt('/careers/nope-not-real');
    expect(screen.getByText(/role.*(not|no longer).*(found|open|available)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to careers/i })).toHaveAttribute('href', '/careers');
  });
});
