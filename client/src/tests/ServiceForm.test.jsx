import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  svcCreate: vi.fn(),
  svcUpdate: vi.fn(),
  uploadImage: vi.fn(),
  hostGetCategories: vi.fn(),
  listServiceCategories: vi.fn(),
  updateProfile: vi.fn(),
  // Flags off → the legacy shell these tests were written for (Kept is dashboard_v2).
  getFeatureFlags: vi.fn(() => Promise.resolve({ data: {} })),
}));
// FeatureGate → render children so the gated sections (Overview, FAQ, etc.) show.
vi.mock('../components/common/FeatureGate', () => ({ default: ({ children }) => children }));

import { hostGetCategories, listServiceCategories } from '../services/api';
import ServiceForm from '../pages/services/ServiceForm';

// The host's profession + its bookable service categories.
const SERVICE_CATS = [
  { id: 'sc1', slug: 'wedding-photography', name: 'Wedding Photography' },
  { id: 'sc2', slug: 'portrait-photography', name: 'Portrait Photography' },
];

beforeEach(() => {
  vi.clearAllMocks();
  hostGetCategories.mockResolvedValue({ data: { categories: ['photographer'], primary_category: 'photographer' } });
  listServiceCategories.mockResolvedValue({ data: { categories: SERVICE_CATS } });
});

test('service category picker is scoped to the host profession', async () => {
  render(<MemoryRouter><ServiceForm /></MemoryRouter>);

  // The picker fetches by the host's primary_category slug.
  await waitFor(() => expect(listServiceCategories).toHaveBeenCalledWith('photographer'));

  // Category is a MeetDropdown now — open it to see the profession-scoped options.
  fireEvent.click(await screen.findByLabelText('Category'));
  await screen.findByRole('option', { name: 'Wedding Photography' });
  expect(screen.getByRole('option', { name: 'Portrait Photography' })).toBeInTheDocument();
});

test('Overview and FAQ sections both render (FAQ moved beside Overview)', async () => {
  render(<MemoryRouter><ServiceForm /></MemoryRouter>);
  await waitFor(() => screen.getByText('Overview'));
  expect(screen.getByText('Overview')).toBeInTheDocument();
  expect(screen.getByText('FAQs')).toBeInTheDocument();

  // Overview precedes FAQs in document order (left column, stacked).
  const overview = screen.getByText('Overview');
  const faqs = screen.getByText('FAQs');
  expect(overview.compareDocumentPosition(faqs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
