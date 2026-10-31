import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as api from '../services/api';
import ServiceForm from '../pages/services/ServiceForm';

vi.mock('../services/api', async (orig) => ({
  ...(await orig()),
  hostGetCategories: () => Promise.resolve({ data: { primary_category: 'seo' } }),
  listServiceCategories: () => Promise.resolve({ data: { categories: [], allow_suggestions: false } }),
  aiGenerateListing: vi.fn(),
}));

// These tests exercise the LIVE (post-key) behavior — force the feature on.
vi.mock('../config/aiListing', () => ({ BOLT_ENABLED: true }));

const renderForm = () => render(<MemoryRouter><ServiceForm /></MemoryRouter>);

test('Write with Tithi button is present', async () => {
  renderForm();
  expect(await screen.findByRole('button', { name: /write with tithi/i })).toBeInTheDocument();
});

test('requires a title before generating', async () => {
  renderForm();
  const btn = await screen.findByRole('button', { name: /write with tithi/i });
  expect(btn).toBeDisabled(); // disabled while title empty
});

test('fills fields from AI response', async () => {
  api.aiGenerateListing.mockResolvedValue({ data: {
    ai_generated: true, session_id: 's1',
    fields: { title: 'SEO Consultancy', short_description: 'Grow traffic.', long_description: '<p>SEO is…</p>', included_items: ['Audit'], excluded_items: ['Ads'], faqs: [{ question: 'How long?', answer: 'Weeks.' }], important_note: 'Bring analytics access.' },
  }});
  renderForm();
  const titleInput = await screen.findByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  fireEvent.click(screen.getByRole('button', { name: /write with tithi/i }));
  await waitFor(() => expect(screen.getByDisplayValue('Grow traffic.')).toBeInTheDocument());
});

test('shows cooldown message on 429', async () => {
  api.aiGenerateListing.mockRejectedValue({ response: { status: 429, data: { message: 'You have used your 1 AI generation for the starter plan.' } } });
  renderForm();
  const titleInput = await screen.findByPlaceholderText(/SEO Consultancy by/i);
  fireEvent.change(titleInput, { target: { value: 'SEO' } });
  fireEvent.click(screen.getByRole('button', { name: /write with tithi/i }));
  await waitFor(() => expect(screen.getByText(/used your 1 AI generation/i)).toBeInTheDocument());
});
