import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Host360List from '../pages/admin/Host360List';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const withPhoto = {
  id: 'h1', name: 'Asha Rao', username: 'asha', email: 'asha@example.com', phone: '9876543210',
  profile_image: 'https://img/asha.jpg', plan: 'creator', revenue: 5000, rating: 4.6, reviews_count: 12,
  is_banned: false, is_verified: true, account_manager: { id: 'am1', name: 'Ravi' },
};
const noPhoto = {
  id: 'h2', name: 'Bharat Kumar', username: 'bharat', email: 'b@example.com', phone: null,
  profile_image: null, plan: 'starter', revenue: 0, rating: null, reviews_count: 0,
  is_banned: false, is_verified: false, account_manager: null,
};

vi.mock('../services/api', () => ({
  adminHost360List: vi.fn(() => Promise.resolve({ data: { hosts: [withPhoto, noPhoto], total: 2, page: 1, pageSize: 20 } })),
  adminHost360Managers: vi.fn(() => Promise.resolve({ data: { managers: [{ id: 'am1', name: 'Ravi' }] } })),
}));

import { adminHost360List } from '../services/api';

const renderList = () => render(<MemoryRouter><Host360List /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

test('search and all three dropdowns sit on one row', async () => {
  const { container } = renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  const bar = container.querySelector('input[placeholder^="Search"]').closest('div').parentElement;
  expect(bar.className).not.toContain('flex-wrap');
  expect(bar.querySelectorAll('select').length).toBe(3);
});

test('renders the profile photo when the host has one', async () => {
  const { container } = renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  const img = container.querySelector('img[src="https://img/asha.jpg"]');
  expect(img).not.toBe(null);
});

test('falls back to an initial only when there is no photo', async () => {
  const { container } = renderList();
  await waitFor(() => expect(screen.getByText('Bharat Kumar')).toBeInTheDocument());

  expect(container.querySelectorAll('img').length).toBe(1); // only Asha's
  expect(screen.getByText('B')).toBeInTheDocument();        // Bharat's initial
});

test('a broken photo url degrades to the initial instead of a broken image', async () => {
  const { container } = renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  fireEvent.error(container.querySelector('img[src="https://img/asha.jpg"]'));

  await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
  expect(container.querySelector('img[src="https://img/asha.jpg"]')).toBe(null);
});

test('contact column shows the number and the email', async () => {
  renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  expect(screen.getByText('Contact Details')).toBeInTheDocument();
  expect(screen.getByText('9876543210')).toBeInTheDocument();
  expect(screen.getByText('asha@example.com')).toBeInTheDocument();
});

test('rating column shows a colour-coded pill, and "No reviews" is not a low score', async () => {
  renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  const pill = screen.getByText('4.6');
  expect(pill.closest('span').className).toContain('emerald'); // 4.5+ reads as good
  expect(screen.getByText('No reviews')).toBeInTheDocument();  // null !== 0.0
  expect(screen.queryByText('0.0')).toBe(null);
  // Status is already a filter dropdown, so it is not also a column.
  expect(screen.queryByText('Status')).toBe(null);
});

test('a 3.2 rating reads as amber, not green', async () => {
  adminHost360List.mockResolvedValueOnce({ data: { hosts: [{ ...withPhoto, rating: 3.2 }], total: 1, page: 1, pageSize: 20 } });
  renderList();
  await waitFor(() => expect(screen.getByText('3.2')).toBeInTheDocument());
  expect(screen.getByText('3.2').closest('span').className).toContain('amber');
});

test('actions column is a single Open 360 button that opens the detail page', async () => {
  renderList();
  await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

  expect(screen.queryByText('Manage')).toBe(null);   // overflow menu is gone
  expect(screen.queryByText('Suspend')).toBe(null);
  const buttons = screen.getAllByText('Open 360°');
  expect(buttons.length).toBe(2);                    // one per row

  fireEvent.click(buttons[0]);
  expect(navigate).toHaveBeenCalledWith('/admin/host360/h1');
});
