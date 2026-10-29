/**
 * tests/SlugClaim.test.jsx
 * Light smoke tests for the authed SlugClaim step.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  checkOnboardingSlug: vi.fn(),
  claimOnboardingSlug: vi.fn(),
  getOnboardingStatus: vi.fn(),
}));

// Mock analytics so it doesn't error
vi.mock('../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { SIGNUP_STARTED: 'SIGNUP_STARTED' },
}));

// Mock useNavigate and useParams (react-router-dom already imported via actual)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: 'test-host' }),
  };
});

import { checkOnboardingSlug, claimOnboardingSlug, getOnboardingStatus } from '../services/api';
import SlugClaim from '../pages/onboarding/SlugClaim';

beforeEach(() => {
  mockNavigate.mockClear();
  checkOnboardingSlug.mockReset();
  claimOnboardingSlug.mockReset();
  getOnboardingStatus.mockReset();

  // Default: guard resolves with host on claim step → no redirect, ready=true
  getOnboardingStatus.mockResolvedValue({
    data: { stepCompleted: 1, isComplete: false, slug: 'test-host' },
  });

  // Set pathname to /claim so guard thinks it's on the right step
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, pathname: '/vendor-register/test-host/claim' },
  });
});

function renderSlugClaim() {
  return render(
    <MemoryRouter initialEntries={['/vendor-register/test-host/claim']}>
      <Routes>
        <Route path="/vendor-register/:slug/claim" element={<SlugClaim />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SlugClaim', () => {
  test('renders heading and pre-fills slug from URL param', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: true } });
    renderSlugClaim();

    // Wait for guard to resolve
    expect(await screen.findByText(/Claim your URL/i)).toBeTruthy();
    const input = screen.getByPlaceholderText('yourslug');
    expect(input.value).toBe('test-host');
  });

  test('Continue is ENABLED on mount for the prefilled own slug (server returns available:true for self)', async () => {
    // This is the core bug-fix test: when the server excludes the caller's own
    // seeded name, available:true comes back and Continue must be enabled.
    checkOnboardingSlug.mockResolvedValue({ data: { available: true } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i); // guard ready
    // Wait for the on-mount triggerCheck to complete
    await waitFor(() => expect(checkOnboardingSlug).toHaveBeenCalledWith('test-host'));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Continue/i });
      expect(button).not.toBeDisabled();
    });
  });

  test('shows too-short warning for a 2-char slug', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: false } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i); // wait for guard
    const input = screen.getByPlaceholderText('yourslug');
    fireEvent.change(input, { target: { value: 'ab' } });

    await waitFor(() => {
      expect(screen.getByText(/Minimum 3 characters/i)).toBeTruthy();
    });
    // Should NOT say "taken"
    expect(screen.queryByText(/taken/i)).toBeNull();
  });

  test('shows taken message for a slug that is not available (reason:taken)', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: false, reason: 'taken' } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i);
    const input = screen.getByPlaceholderText('yourslug');
    fireEvent.change(input, { target: { value: 'taken-slug' } });

    await waitFor(() => {
      expect(screen.getByText(/URL is taken/i)).toBeTruthy();
    });
  });

  test('a network/500 error is NOT reported as "taken"', async () => {
    checkOnboardingSlug.mockRejectedValue(new Error('network down'));
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i);
    const input = screen.getByPlaceholderText('yourslug');
    fireEvent.change(input, { target: { value: 'some-slug' } });

    await waitFor(() => {
      expect(screen.getByText(/couldn.?t check that url/i)).toBeTruthy();
    });
    expect(screen.queryByText(/taken/i)).toBeNull();
  });

  test('shows reserved message for a reserved slug (reason:reserved)', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: false, reason: 'reserved' } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i);
    const input = screen.getByPlaceholderText('yourslug');
    fireEvent.change(input, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(screen.getByText(/reserved/i)).toBeTruthy();
    });
    // Should NOT say "taken"
    expect(screen.queryByText(/taken/i)).toBeNull();
  });

  test('calls claimOnboardingSlug and navigates on Continue', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: true } });
    claimOnboardingSlug.mockResolvedValue({ data: { slug: 'new-slug' } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i);

    // Type a new slug to trigger the debounced check
    const input = screen.getByPlaceholderText('yourslug');
    fireEvent.change(input, { target: { value: 'new-slug' } });

    // Wait for availability check to resolve and button to become enabled
    await waitFor(() => expect(checkOnboardingSlug).toHaveBeenCalledWith('new-slug'));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Continue/i });
      expect(button).not.toBeDisabled();
    });

    const button = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(claimOnboardingSlug).toHaveBeenCalledWith('new-slug');
      expect(mockNavigate).toHaveBeenCalledWith('/vendor-register/new-slug/category');
    });
  });

  test('Back button navigates to /vendor-register', async () => {
    checkOnboardingSlug.mockResolvedValue({ data: { available: true } });
    renderSlugClaim();

    await screen.findByText(/Claim your URL/i);
    const back = screen.getByText(/← Back/i);
    fireEvent.click(back);

    expect(mockNavigate).toHaveBeenCalledWith('/vendor-register');
  });
});
