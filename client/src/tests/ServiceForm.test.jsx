import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  svcCreate: vi.fn(),
  svcUpdate: vi.fn(),
  uploadImage: vi.fn(),
  hostGetCategories: vi.fn(),
  listServiceCategories: vi.fn(),
  updateProfile: vi.fn(),
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

  await screen.findByText('Wedding Photography');
  expect(screen.getByText('Portrait Photography')).toBeInTheDocument();
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
