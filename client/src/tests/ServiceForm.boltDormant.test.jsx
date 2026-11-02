import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ServiceForm from '../pages/services/ServiceForm';

vi.mock('../services/api', async (orig) => ({
  ...(await orig()),
  hostGetCategories: () => Promise.resolve({ data: { primary_category: 'seo' } }),
  listServiceCategories: () => Promise.resolve({ data: { categories: [], allow_suggestions: false } }),
  aiGenerateListing: vi.fn(),
}));

// Pin the flag OFF so this keeps covering the dormant/pre-key state regardless
// of the shipped BOLT_ENABLED value (now true post-go-live).
vi.mock('../config/aiListing', () => ({ BOLT_ENABLED: false }));

const renderForm = () => render(<MemoryRouter><ServiceForm /></MemoryRouter>);

test('dormant: button is present but greyscaled + inactive', async () => {
  renderForm();
  const btn = await screen.findByRole('button', { name: /write with tithi/i });
  expect(btn).toBeInTheDocument();
  // Disabled even with a valid title (feature is off, not just missing input).
  const titleInput = screen.getByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  expect(btn).toBeDisabled();
  // Greyscaled look + "coming soon" affordance (className/attr, since jest-dom
  // toHaveClass isn't available in this client's vitest setup).
  expect(btn.getAttribute('class')).toMatch(/grayscale/);
  expect(btn.getAttribute('title')).toMatch(/available soon/i);
});

test('dormant: clicking does not call the AI endpoint', async () => {
  renderForm();
  const api = await import('../services/api');
  const btn = await screen.findByRole('button', { name: /write with tithi/i });
  const titleInput = screen.getByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  fireEvent.click(btn); // disabled — should be a no-op
  expect(api.aiGenerateListing).not.toHaveBeenCalled();
});
