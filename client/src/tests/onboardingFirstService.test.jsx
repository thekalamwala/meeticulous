/**
 * tests/onboardingFirstService.test.jsx
 * The "You're live" screen now creates the host's FIRST service inline.
 * Verifies the publish path builds a valid online-service payload (so it never
 * trips the in-person map-link requirement) and completes onboarding.
 */
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getOnboardingStatus:   vi.fn().mockResolvedValue({ data: { stepCompleted: 6, isComplete: false, slug: 'me' } }),
  markOnboardingComplete: vi.fn().mockResolvedValue({ data: {} }),
  svcCreate:             vi.fn().mockResolvedValue({ data: { id: 'svc-1' } }),
  hostGetCategories:     vi.fn().mockResolvedValue({ data: { primary_category: 'photographer' } }),
  listServiceCategories: vi.fn().mockResolvedValue({ data: { categories: [{ slug: 'portrait', name: 'Portrait' }] } }),
  aiGenerateListing:     vi.fn().mockResolvedValue({ data: { fields: {
    title: 'Portrait Photography Session',
    short_description: 'Book a relaxed portrait session that gets you photos you actually like.',
    long_description: '<p>Portrait Photography Session is a guided shoot...</p>',
    duration_minutes: 45,
    category: 'portrait',
  } } }),
}));
vi.mock('../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../utils/celebration', () => ({ fireCelebration: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { fee_only_mode: true } }) }));

import { svcCreate, markOnboardingComplete, aiGenerateListing } from '../services/api';
import ExploreWithBolt from '../pages/onboarding/ExploreWithBolt';

const renderLive = () => render(
  <MemoryRouter initialEntries={['/vendor-register/me/live']}>
    <Routes>
      <Route path="/vendor-register/:slug/live" element={<ExploreWithBolt />} />
      <Route path="/dashboard" element={<div data-testid="dashboard">dash</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => vi.clearAllMocks());

describe('onboarding first-service publish', () => {
  test('publishes an online service with the typed title and finishes onboarding', async () => {
    renderLive();

    const titleInput = await screen.findByPlaceholderText(/1:1 Strategy Call/i);
    fireEvent.change(titleInput, { target: { value: 'Portrait Session' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish service/i }));

    await waitFor(() => expect(svcCreate).toHaveBeenCalledTimes(1));
    const payload = svcCreate.mock.calls[0][0];
    expect(payload.title).toBe('Portrait Session');
    expect(payload.meeting_mode).toBe('online');   // never trips the offline map-link wall
    expect(payload.price).toBe(0);                  // fee-only mode
    expect(payload.category).toBe('portrait');      // defaulted from the profession list

    await waitFor(() => expect(markOnboardingComplete).toHaveBeenCalled());
    await screen.findByTestId('dashboard');
  });

  test('blocks publish with no title', async () => {
    renderLive();
    await screen.findByPlaceholderText(/1:1 Strategy Call/i);
    fireEvent.click(screen.getByRole('button', { name: /Publish service/i }));
    await waitFor(() => expect(svcCreate).not.toHaveBeenCalled());
  });

  test('Build with Bolt fills AI copy and publish sends it', async () => {
    renderLive();

    const titleInput = await screen.findByPlaceholderText(/1:1 Strategy Call/i);
    fireEvent.change(titleInput, { target: { value: 'portrait shoot' } });
    fireEvent.click(screen.getByRole('button', { name: /Build with Bolt/i }));

    await waitFor(() => expect(aiGenerateListing).toHaveBeenCalledTimes(1));
    // Refined title lands back in the input.
    await waitFor(() => expect(titleInput.value).toBe('Portrait Photography Session'));

    fireEvent.click(screen.getByRole('button', { name: /Publish service/i }));
    await waitFor(() => expect(svcCreate).toHaveBeenCalledTimes(1));
    const payload = svcCreate.mock.calls[0][0];
    expect(payload.short_description).toMatch(/relaxed portrait session/i); // AI copy, not the title seed
    expect(payload.description).toMatch(/guided shoot/i);
    expect(payload.duration).toBe(45);        // AI-suggested duration snapped in
    expect(payload.category).toBe('portrait');
  });

  test('Build with Bolt needs a title first', async () => {
    renderLive();
    await screen.findByPlaceholderText(/1:1 Strategy Call/i);
    fireEvent.click(screen.getByRole('button', { name: /Build with Bolt/i }));
    await waitFor(() => expect(aiGenerateListing).not.toHaveBeenCalled());
  });

  // NOTE: onboarding_completed flips on /live MOUNT (idempotent), not on the
  // skip button — so these assert on NAVIGATION, which is what the soft-gate
  // actually governs: one tap no longer leaves the screen.
  test('skip is soft-gated — the tap opens a confirm instead of leaving', async () => {
    renderLive();
    await screen.findByPlaceholderText(/1:1 Strategy Call/i);

    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));

    // Confirm sheet appears; the host has NOT left for the dashboard.
    await screen.findByText(/Leave without a service\?/i);
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();

    // "Add my service" backs out — still on the screen, nothing published.
    fireEvent.click(screen.getByRole('button', { name: /Add my service/i }));
    await waitFor(() =>
      expect(screen.queryByText(/Leave without a service\?/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(svcCreate).not.toHaveBeenCalled();
  });

  test('confirming "Skip anyway" leaves for the dashboard with no service', async () => {
    renderLive();
    await screen.findByPlaceholderText(/1:1 Strategy Call/i);

    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    await screen.findByText(/Leave without a service\?/i);
    fireEvent.click(screen.getByRole('button', { name: /Skip anyway/i }));

    await screen.findByTestId('dashboard');
    expect(svcCreate).not.toHaveBeenCalled();
  });
});
