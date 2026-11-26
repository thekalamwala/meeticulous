import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Explore from '../Explore';
import { getExploreServices, getExploreCategories } from '../../services/api';

vi.mock('../../services/api', () => ({ getExploreServices: vi.fn(), getExploreCategories: vi.fn(), logExploreClick: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  getExploreCategories.mockResolvedValue({ data: { categories: [] } });
});

describe('Explore search failures', () => {
  it('distinguishes a failed request from no matches and retries the same search', async () => {
    getExploreServices.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce({ data: {
      services: [{ id: 'code', title: 'Code review', hostName: 'Sample developer', hostUsername: 'sample', slug: 'code-review', price: 0 }],
      meta: { total: 1, totalPages: 1, page: 1 },
    } });
    render(<MemoryRouter initialEntries={['/explore?q=coding']}><Explore /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No services found')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Code review')).toBeTruthy();
    expect(getExploreServices).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'coding' }), expect.anything());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no matches only after a successful empty response', async () => {
    getExploreServices.mockResolvedValue({ data: { services: [], meta: { total: 0, totalPages: 0, page: 1 } } });
    render(<MemoryRouter initialEntries={['/explore?q=coding']}><Explore /></MemoryRouter>);
    expect(await screen.findByText('No services found')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
