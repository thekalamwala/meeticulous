import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({
  getProfessionServices: vi.fn(),
}));
import { getProfessionServices } from '../services/api';
import ProfessionServices from '../pages/services/ProfessionServices';

test('renders profession hero + one card per service', async () => {
  getProfessionServices.mockResolvedValue({ data: {
    profession: { slug: 'photographer', label: 'Photographer', group_label: 'Creative' },
    services: [
      { name: 'Wedding Photography', slug: 'wedding-photography', description: 'd1', icon: null },
      { name: 'Drone Photography',   slug: 'drone-photography',   description: 'd2', icon: null },
    ],
  }});
  render(
    <MemoryRouter initialEntries={['/services/photographer']}>
      <Routes><Route path="/services/:profession" element={<ProfessionServices />} /></Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Photographer/));
  expect(screen.getAllByRole('link', { name: /find professionals/i })).toHaveLength(2);
});
