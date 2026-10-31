/**
 * tests/onboardingFlow.test.jsx
 * The 3-screen host onboarding: PageStep (link + what you do) → ServiceStep
 * (first service) → LiveStep (celebrate + share). Replaces the SlugClaim,
 * CategoryStep and first-service (ExploreWithBolt) suites.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getOnboardingStatus:    vi.fn(),
  checkOnboardingSlug:    vi.fn(),
  claimOnboardingSlug:    vi.fn(),
  saveOnboardingPersona:  vi.fn(),
  getCategories:          vi.fn(),
  suggestCategory:        vi.fn(),
  saveOnboardingDetails:  vi.fn(),
  activateFreePlan:       vi.fn(),
  svcCreate:              vi.fn(),
  hostGetCategories:      vi.fn(),
  listServiceCategories:  vi.fn(),
  aiGenerateListing:      vi.fn(),
  markOnboardingComplete: vi.fn(),
}));
vi.mock('../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../utils/celebration', () => ({ fireCelebration: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { fee_only_mode: true, name: 'Priya Sharma' } }) }));

import * as api from '../services/api';
import { analytics } from '../services/analytics';
import { fireCelebration } from '../utils/celebration';
import PageStep from '../pages/onboarding/PageStep';
import ServiceStep from '../pages/onboarding/ServiceStep';
import LiveStep from '../pages/onboarding/LiveStep';

const setPath = (p) => Object.defineProperty(window, 'location', {
  writable: true,
  value: { ...window.location, pathname: p, host: 'meeticulous.com', origin: 'https://meeticulous.com' },
});

const renderAt = (path, state) => render(
  <MemoryRouter initialEntries={[{ pathname: path, state }]}>
    <Routes>
      <Route path="/vendor-register/:slug/claim" element={<PageStep />} />
      <Route path="/vendor-register/:slug/preview" element={<ServiceStep />} />
      <Route path="/vendor-register/:slug/live" element={<LiveStep />} />
      <Route path="/dashboard" element={<div data-testid="dashboard">dash</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  api.claimOnboardingSlug.mockResolvedValue({ data: {} });
  api.saveOnboardingPersona.mockResolvedValue({ data: {} });
  api.getCategories.mockResolvedValue({ data: [{ slug: 'yoga-instructor', label: 'Yoga Instructor' }] });
  api.saveOnboardingDetails.mockResolvedValue({ data: {} });
  api.activateFreePlan.mockResolvedValue({ data: {} });
  api.svcCreate.mockResolvedValue({ data: { id: 'svc-1' } });
  api.hostGetCategories.mockResolvedValue({ data: { primary_category: 'life-coach' } });
  api.listServiceCategories.mockResolvedValue({ data: { categories: [{ slug: 'coaching', name: 'Coaching' }] } });
  api.markOnboardingComplete.mockResolvedValue({ data: {} });
});

describe('PageStep — your page', () => {
  beforeEach(() => {
    setPath('/vendor-register/priya-x4k9/claim');
    api.getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 1, isComplete: false, slug: 'priya-x4k9', name: 'Priya Sharma', primaryCategory: null },
    });
  });

  test('greets by first name and shows the reserved link', async () => {
    renderAt('/vendor-register/priya-x4k9/claim');
    expect(await screen.findByText(/Hi Priya, your/i)).toBeTruthy();
    expect(screen.getByText(/Reserved for you/i)).toBeTruthy();
  });

  test('Continue is blocked until a category is picked, then claims → saves → goes to service', async () => {
    renderAt('/vendor-register/priya-x4k9/claim');
    const cta = await screen.findByRole('button', { name: /Looks good/i });
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /^Coach$/i }));
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);

    await waitFor(() => expect(api.saveOnboardingPersona).toHaveBeenCalledWith('life-coach'));
    expect(api.claimOnboardingSlug).toHaveBeenCalledWith('priya-x4k9');
    // Claim must land before the persona write (server step order).
    expect(api.claimOnboardingSlug.mock.invocationCallOrder[0])
      .toBeLessThan(api.saveOnboardingPersona.mock.invocationCallOrder[0]);
    expect(await screen.findByRole('button', { name: /Publish my page/i })).toBeTruthy();
  });

  test('editing the link: taken vs network error vs available', async () => {
    renderAt('/vendor-register/priya-x4k9/claim');
    fireEvent.click(await screen.findByRole('button', { name: /Edit/i }));
    const input = screen.getByLabelText('Your link');

    api.checkOnboardingSlug.mockResolvedValueOnce({ data: { available: false, reason: 'taken' } });
    fireEvent.change(input, { target: { value: 'priya' } });
    expect(await screen.findByText(/URL is taken/i)).toBeTruthy();

    api.checkOnboardingSlug.mockRejectedValueOnce(new Error('down'));
    fireEvent.change(input, { target: { value: 'priya-2' } });
    expect(await screen.findByText(/couldn.?t check that url/i)).toBeTruthy();
    expect(screen.queryByText(/taken/i)).toBeNull();

    api.checkOnboardingSlug.mockResolvedValueOnce({ data: { available: true } });
    fireEvent.change(input, { target: { value: 'priya-coach' } });
    const save = screen.getByRole('button', { name: /Save link/i });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    expect((await screen.findAllByText('priya-coach')).length).toBeGreaterThan(0);
  });

  test('"Something else" searches the full list inline and can pick from it', async () => {
    renderAt('/vendor-register/priya-x4k9/claim');
    fireEvent.click(await screen.findByRole('button', { name: /Something else/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yoga Instructor' }));
    fireEvent.click(screen.getByRole('button', { name: /Looks good/i }));
    await waitFor(() => expect(api.saveOnboardingPersona).toHaveBeenCalledWith('yoga-instructor'));
  });

  test('shows an Add row for an unknown category and suggests it', async () => {
    api.suggestCategory.mockResolvedValue({ data: { slug: 'tarot-reader', label: 'Tarot Reader', status: 'pending' } });
    renderAt('/vendor-register/priya-x4k9/claim');
    fireEvent.click(await screen.findByRole('button', { name: /Something else/i }));
    fireEvent.change(screen.getByLabelText(/Search all categories/i), { target: { value: 'Tarot Reader' } });
    fireEvent.click(await screen.findByTestId('add-custom-row'));
    await waitFor(() => expect(api.suggestCategory).toHaveBeenCalledWith('Tarot Reader'));
    expect(await screen.findByText(/Pending review/i)).toBeTruthy();
  });
});

describe('ServiceStep — first service', () => {
  beforeEach(() => {
    setPath('/vendor-register/priya-x4k9/preview');
    api.getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 3, isComplete: false, slug: 'priya-x4k9', name: 'Priya Sharma', primaryCategory: 'life-coach' },
    });
    api.aiGenerateListing.mockResolvedValue({ data: { fields: {
      title: 'Discovery Call',
      short_description: 'A focused first call to map where you are and what to do next.',
      long_description: '<p>Discovery Call long copy</p>',
      duration_minutes: 45,
    } } });
  });

  test('persona suggestions are one tap, run Bolt, and publish sends the AI copy', async () => {
    renderAt('/vendor-register/priya-x4k9/preview');
    fireEvent.click(await screen.findByRole('button', { name: 'Discovery call' }));

    await waitFor(() => expect(api.aiGenerateListing).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/focused first call/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Publish my page/i }));
    await waitFor(() => expect(api.svcCreate).toHaveBeenCalledTimes(1));
    const payload = api.svcCreate.mock.calls[0][0];
    expect(payload.title).toBe('Discovery Call');
    expect(payload.short_description).toMatch(/focused first call/i);
    expect(payload.duration).toBe(45);
    expect(payload.meeting_mode).toBe('online'); // never trips the offline map-link wall
    expect(payload.price).toBe(0);               // fee-only mode
    expect(payload.category).toBe('coaching');

    // Server order: details (→5) → free plan (→6) → service.
    const order = (fn) => fn.mock.invocationCallOrder[0];
    expect(order(api.saveOnboardingDetails)).toBeLessThan(order(api.activateFreePlan));
    expect(order(api.activateFreePlan)).toBeLessThan(order(api.svcCreate));
    expect(analytics.track).toHaveBeenCalledWith('service_published', { source: 'onboarding' });
    // Completion is LiveStep's job: it only fires after the service exists.
    await waitFor(() => expect(api.markOnboardingComplete).toHaveBeenCalled());
    expect(order(api.svcCreate)).toBeLessThan(order(api.markOnboardingComplete));
  });

  test('blocks publish with no title', async () => {
    renderAt('/vendor-register/priya-x4k9/preview');
    fireEvent.click(await screen.findByRole('button', { name: /Publish my page/i }));
    await waitFor(() => expect(api.svcCreate).not.toHaveBeenCalled());
    expect(api.saveOnboardingDetails).not.toHaveBeenCalled();
  });

  test('in person reveals city, saved as location with the booking type', async () => {
    renderAt('/vendor-register/priya-x4k9/preview');
    fireEvent.change(await screen.findByLabelText(/Or name it yourself/i), { target: { value: 'Walk & talk session' } });
    fireEvent.click(screen.getByRole('button', { name: /In person/i }));
    fireEvent.change(screen.getByLabelText(/Your city/i), { target: { value: 'Nagpur' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish my page/i }));
    await waitFor(() => expect(api.saveOnboardingDetails).toHaveBeenCalledWith(
      expect.objectContaining({ booking_type: 'offline_only', location: 'Nagpur' }),
    ));
  });

  test('skip saves details, tracks the skip, creates no service', async () => {
    renderAt('/vendor-register/priya-x4k9/preview');
    fireEvent.click(await screen.findByRole('button', { name: /add a service later/i }));
    await waitFor(() => expect(api.activateFreePlan).toHaveBeenCalled());
    expect(api.svcCreate).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith('first_service_skipped', { source: 'onboarding' });
    expect(await screen.findByText(/Your page is/i)).toBeTruthy();
  });
});

describe('LiveStep — you are live', () => {
  beforeEach(() => {
    setPath('/vendor-register/priya-x4k9/live');
    api.getOnboardingStatus.mockResolvedValue({
      data: { stepCompleted: 6, isComplete: false, slug: 'priya-x4k9', name: 'Priya Sharma' },
    });
  });

  test('after a publish: celebrates, completes onboarding, names the service', async () => {
    renderAt('/vendor-register/priya-x4k9/live', { published: true, title: 'Discovery call' });
    expect(await screen.findByText(/You’re live, Priya/i)).toBeTruthy();
    await waitFor(() => expect(api.markOnboardingComplete).toHaveBeenCalledTimes(1));
    expect(fireCelebration).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Page published/i)).toBeTruthy();
  });

  test('after a skip: no confetti, nudges to add a service, still completes', async () => {
    renderAt('/vendor-register/priya-x4k9/live', { skipped: true });
    expect(await screen.findByText(/Your page is/i)).toBeTruthy();
    await waitFor(() => expect(api.markOnboardingComplete).toHaveBeenCalled());
    expect(fireCelebration).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add service/i })).toBeTruthy();
  });

  test('WhatsApp share links out with the page URL', async () => {
    renderAt('/vendor-register/priya-x4k9/live', { published: true });
    const wa = await screen.findByRole('link', { name: /Share on WhatsApp/i });
    expect(decodeURIComponent(wa.getAttribute('href'))).toContain('https://meeticulous.com/priya-x4k9');
  });

  test('Go to my dashboard leaves the flow', async () => {
    renderAt('/vendor-register/priya-x4k9/live', { published: true });
    fireEvent.click(await screen.findByRole('button', { name: /Go to my dashboard/i }));
    expect(await screen.findByTestId('dashboard')).toBeTruthy();
  });
});
