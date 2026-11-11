import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardKycBanner from './DashboardKycBanner';

const setup = (props) => render(<MemoryRouter><DashboardKycBanner {...props} /></MemoryRouter>);
const prompt = /Complete verification to accept payments/i;

describe('DashboardKycBanner (pre-earnings KYC push)', () => {
  it('shows when the host sells a paid service and has not started KYC', () => {
    setup({ kyc: { status: 'not_started' }, hasPaidService: true });
    expect(screen.getByText(prompt)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verify now/i })).toHaveAttribute('href', '/dashboard/kyc');
  });

  it('hides when KYC is already approved', () => {
    setup({ kyc: { status: 'approved' }, hasPaidService: true });
    expect(screen.queryByText(prompt)).toBeNull();
  });

  it('hides while KYC is pending/submitted', () => {
    setup({ kyc: { status: 'pending' }, hasPaidService: true });
    expect(screen.queryByText(prompt)).toBeNull();
  });

  it('hides for a host with no paid service', () => {
    setup({ kyc: { status: 'not_started' }, hasPaidService: false });
    expect(screen.queryByText(prompt)).toBeNull();
  });

  it('hides when kyc is not loaded yet', () => {
    setup({ kyc: null, hasPaidService: true });
    expect(screen.queryByText(prompt)).toBeNull();
  });
});
