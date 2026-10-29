import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getCategories: vi.fn(),
  hostGetCategories: vi.fn(),
  hostUpdateCategories: vi.fn(),
}));

import { getCategories, hostGetCategories, hostUpdateCategories } from '../services/api';
import CategoriesSection from '../components/dashboard/CategoriesSection';

const ACTIVE = [
  { slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting' },
  { slug: 'business-coach', label: 'Business Coach', group_label: 'Coaching & Consulting' },
  { slug: 'ai-engineer', label: 'AI Engineer', group_label: 'Technology & Product' },
];

beforeEach(() => {
  getCategories.mockResolvedValue({ data: ACTIVE });
  hostGetCategories.mockResolvedValue({ data: { primary_category: 'life-coach', categories: ['life-coach'] } });
  hostUpdateCategories.mockResolvedValue({ data: { primary_category: 'life-coach', categories: ['life-coach'], services_cleared: 0 } });
});

test('free plan is locked with a contact-admin note', async () => {
  render(<CategoriesSection plan="starter" onSaved={() => {}} />);
  expect(await screen.findByText(/Life Coach/)).toBeTruthy();
  expect(screen.getByText(/contact admin/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /save categories/i })).toBeNull();
});

test('professional plan can save up to 3 categories', async () => {
  render(<CategoriesSection plan="professional" onSaved={() => {}} />);
  fireEvent.click(await screen.findByText('Business Coach')); // add a 2nd
  fireEvent.click(screen.getByRole('button', { name: /save categories/i }));
  await waitFor(() => expect(hostUpdateCategories).toHaveBeenCalled());
  const payload = hostUpdateCategories.mock.calls[0][0];
  expect(payload.primary_category).toBe('life-coach');
  expect(payload.categories).toContain('business-coach');
});
