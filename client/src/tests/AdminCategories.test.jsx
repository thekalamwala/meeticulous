import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  adminListCategories: vi.fn(),
  adminCreateCategory: vi.fn(),
  adminUpdateCategory: vi.fn(),
  adminDeleteCategory: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { adminListCategories, adminUpdateCategory } from '../services/api';
import AdminCategories from '../pages/admin/AdminCategories';

const ROWS = [
  { id: '1', slug: 'life-coach', label: 'Life Coach', group_label: 'Coaching & Consulting', status: 'active', registered_hosts: 4, active_services: 9, created_at: '2026-06-20T00:00:00Z' },
  { id: '2', slug: 'astrologer', label: 'Astrologer', group_label: 'Spiritual & Wellness', status: 'disabled', registered_hosts: 0, active_services: 0, created_at: '2026-06-20T00:00:00Z' },
];

beforeEach(() => {
  adminListCategories.mockResolvedValue({ data: ROWS });
  adminUpdateCategory.mockResolvedValue({ data: {} });
});

test('renders the analytics columns and the summary strip', async () => {
  render(<AdminCategories />);
  // "Life Coach" appears both in the busiest-category strip and in the table row.
  expect((await screen.findAllByText('Life Coach')).length).toBeGreaterThanOrEqual(1);
  // Per-row analytics columns
  expect(screen.getByText('Registered Hosts')).toBeTruthy();
  expect(screen.getByText('Active Services')).toBeTruthy();
  // Summary strip
  expect(screen.getByText('Active categories')).toBeTruthy();
  expect(screen.getByText('Hosts categorised')).toBeTruthy();
  expect(screen.getByText('Top category')).toBeTruthy();
});

test('status dropdown flips a category off', async () => {
  render(<AdminCategories />);
  // Target the row's status select by its aria-label (avoids colliding with the
  // group-name datalist input, which also has role combobox).
  const select = await screen.findByLabelText('Status: Life Coach');
  fireEvent.change(select, { target: { value: 'disabled' } });
  await waitFor(() => expect(adminUpdateCategory).toHaveBeenCalledWith('1', { status: 'disabled' }));
});

test('delete is disabled when hosts are registered', async () => {
  render(<AdminCategories />);
  await screen.findByLabelText('Status: Life Coach');
  const delBtn = screen.getByTitle(/4 hosts registered/i);
  expect(delBtn.disabled).toBe(true);
});
