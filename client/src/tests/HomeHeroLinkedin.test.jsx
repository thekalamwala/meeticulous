/**
 * tests/HomeHeroLinkedin.test.jsx
 * Homepage hero: the LinkedIn button carries the slug typed into "Claim my link",
 * and the helper text names LinkedIn only when its button is shown.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

let flagOn = false;
const start = vi.fn(async () => {});
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ startLinkedinHostAuth: start }) }));
vi.mock('../context/FeatureContext', () => ({
  useFeature: () => flagOn,
  useFeatures: () => ({ flags: flagOn ? { host_linkedin_login: true } : {} }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('../components/home/Reveal', () => ({ default: ({ children }) => <div>{children}</div> }));

import HomeHero from '../components/home/HomeHero';

const renderHero = () => render(<MemoryRouter><HomeHero onStart={vi.fn()} loading={false} /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); flagOn = false; sessionStorage.clear(); });

test('LinkedIn click saves the typed slug before starting auth', async () => {
  flagOn = true;
  let slugAtStart = null;
  start.mockImplementationOnce(async () => { slugAtStart = sessionStorage.getItem('meet_hero_slug'); });
  renderHero();
  fireEvent.change(screen.getByLabelText('Your booking link'), { target: { value: 'Asha-Yoga' } });
  fireEvent.click(screen.getByRole('button', { name: /continue with linkedin/i }));
  await waitFor(() => expect(start).toHaveBeenCalledWith('signup'));
  expect(slugAtStart).toBe('asha-yoga');
});

test('helper text names LinkedIn only when its button is shown', () => {
  const { unmount } = renderHero();
  expect(screen.getByText(/Next, sign in with Google —/)).toBeInTheDocument();
  unmount();
  flagOn = true;
  renderHero();
  expect(screen.getByText(/Next, sign in with Google or LinkedIn —/)).toBeInTheDocument();
});
