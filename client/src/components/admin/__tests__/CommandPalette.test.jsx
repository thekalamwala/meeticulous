// client/src/components/admin/__tests__/CommandPalette.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../CommandPalette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const SUPER = { permissions: ['*'] };
const renderPalette = (props = {}) =>
  render(<MemoryRouter><CommandPalette open session={SUPER} onClose={() => {}} {...props} /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('CommandPalette', () => {
  it('lists destinations and filters by query', () => {
    renderPalette();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(5);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bookings' } });
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach(o => expect(o.textContent.toLowerCase()).toContain('bookings'));
  });

  it('Enter navigates to the highlighted destination', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bookings' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/bookings');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<MemoryRouter><CommandPalette open={false} session={SUPER} onClose={() => {}} /></MemoryRouter>);
    expect(container.querySelector('input')).toBeNull();
  });
});
