/**
 * CatalogList — it renders, and it degrades honestly.
 *
 * The merge logic is covered in catalogModel.test.js. What this adds is the
 * part a pure test cannot reach: that the page actually mounts against the real
 * design-kit components, and that a failing endpoint produces a named warning
 * over a shorter list rather than either a blank page or a silent lie.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  svcGetAll: vi.fn(),
  getMyProducts: vi.fn(),
  getMyCourses: vi.fn(),
  getHostCoupons: vi.fn(),
}));

// Both flag-gated types on, so the page fetches all four sources.
vi.mock('../hooks/useFeatureFlags', () => ({
  default: () => ({ flags: { course_purchase: true, coupons: true }, on: () => true }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => navigate,
}));

import { svcGetAll, getMyProducts, getMyCourses, getHostCoupons } from '../services/api';
import CatalogList from '../pages/catalog/CatalogList';

const ok = (rows) => Promise.resolve({ data: rows });

beforeEach(() => {
  vi.clearAllMocks();
  svcGetAll.mockReturnValue(ok([{ id: 's1', title: 'Follow-up consult', price: 1200, is_active: true, duration: 30 }]));
  getMyProducts.mockReturnValue(ok([{ id: 'p1', title: 'Meal plan PDF', price: 499, is_active: true }]));
  getMyCourses.mockReturnValue(ok([{ id: 'c1', title: 'Six weeks', price: 6999, is_active: false }]));
  getHostCoupons.mockReturnValue(ok([{ id: 'o1', code: 'FIRST20', discount_type: 'percent', discount_value: 20, active: true }]));
});

it('shows all four types in one list', async () => {
  render(<CatalogList />);
  await waitFor(() => expect(screen.getByText('Follow-up consult')).toBeInTheDocument());
  // The point of the page: four pages' worth of answer, in one.
  expect(screen.getByText('Meal plan PDF')).toBeInTheDocument();
  expect(screen.getByText('Six weeks')).toBeInTheDocument();
  expect(screen.getByText('FIRST20')).toBeInTheDocument();
});

it('shows a coupon without inventing a price for it', async () => {
  render(<CatalogList />);
  await waitFor(() => expect(screen.getByText('FIRST20')).toBeInTheDocument());
  expect(screen.getByText('20% off')).toBeInTheDocument();
  // Not "Free" — a coupon has no price, and claiming zero is a different thing.
  expect(screen.queryByText('Free')).not.toBeInTheDocument();
});

it('names what failed and still shows the rest', async () => {
  getHostCoupons.mockRejectedValue(new Error('500'));
  render(<CatalogList />);
  await waitFor(() => expect(screen.getByText('Follow-up consult')).toBeInTheDocument());

  // A host must know WHICH part of their catalog is missing before trusting
  // the list — a generic "something went wrong" would leave them reading a
  // short list as though it were complete.
  expect(screen.getByText(/could not load offers/i)).toBeInTheDocument();
  expect(screen.getByText('Meal plan PDF')).toBeInTheDocument();
});

it('only falls back to an error state when everything fails', async () => {
  for (const fn of [svcGetAll, getMyProducts, getMyCourses, getHostCoupons]) {
    fn.mockRejectedValue(new Error('offline'));
  }
  render(<CatalogList />);
  await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
});

it('tells a host with nothing what the two options are', async () => {
  for (const fn of [svcGetAll, getMyProducts, getMyCourses, getHostCoupons]) {
    fn.mockReturnValue(ok([]));
  }
  render(<CatalogList />);
  await waitFor(() => expect(screen.getByText(/nothing in your catalog yet/i)).toBeInTheDocument());
});
