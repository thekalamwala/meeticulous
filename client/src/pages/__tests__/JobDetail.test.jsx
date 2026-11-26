import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    const apply = screen.getByRole('link', { name: /apply by email/i });
    expect(apply.getAttribute('href')).toMatch(/^mailto:team@meeticulous\.com\?subject=/);
  });

  it('prepares an application email without claiming it has been submitted', () => {
    renderAt('/careers/digital-marketeer');
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Applicant' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'applicant@example.com' } });
    fireEvent.change(screen.getByLabelText(/résumé or portfolio link/i), { target: { value: 'https://example.com/portfolio' } });
    fireEvent.change(screen.getByLabelText(/why you’re a fit/i), { target: { value: 'I build thoughtful campaigns.' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Prepare application' }).closest('form'));
    const link = screen.getByRole('link', { name: 'Open email draft' });
    const url = new URL(link.getAttribute('href'));
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('team@meeticulous.com');
    expect(url.searchParams.get('subject')).toContain('Digital Marketeer');
    expect(url.searchParams.get('body')).toContain('Test Applicant');
    expect(url.searchParams.get('body')).toContain('https://example.com/portfolio');
    expect(screen.queryByText('Application received')).toBeNull();
  });

  it('shows a friendly not-found block for an unknown slug', () => {
    renderAt('/careers/nope-not-real');
    expect(screen.getByText(/role.*(not|no longer).*(found|open|available)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to careers/i })).toHaveAttribute('href', '/careers');
  });
});
