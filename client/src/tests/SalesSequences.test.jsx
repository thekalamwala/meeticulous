import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  crmListSequences: vi.fn(() => Promise.resolve({ data: [] })),
  crmListTemplates: vi.fn(() => Promise.resolve({ data: [] })),
  crmCreateSequence: vi.fn(() => Promise.resolve({ data: { id: 's1' } })),
}));

import SalesSequences from '../pages/admin/sales/SalesSequences';
import { crmCreateSequence } from '../services/api';

beforeEach(() => vi.clearAllMocks());

test('empty state renders', async () => {
  render(<SalesSequences />);
  expect(await screen.findByText('No sequences yet')).toBeTruthy();
});

test('creates a sequence with a mapped email step', async () => {
  render(<SalesSequences />);
  await screen.findByText('No sequences yet');
  fireEvent.click(screen.getAllByText('+ New sequence')[0]);

  fireEvent.change(screen.getByPlaceholderText('Name (e.g. New Lead nurture)'), { target: { value: 'New Lead nurture' } });
  fireEvent.change(screen.getByPlaceholderText('Subject — {{first_name}} supported'), { target: { value: 'Hi {{first_name}}' } });
  fireEvent.change(screen.getByPlaceholderText(/HTML body/), { target: { value: '<p>welcome</p>' } });

  fireEvent.click(screen.getByText('Create sequence'));

  await waitFor(() => expect(crmCreateSequence).toHaveBeenCalled());
  const payload = crmCreateSequence.mock.calls[0][0];
  expect(payload.name).toBe('New Lead nurture');
  expect(payload.steps[0]).toMatchObject({ channel: 'email', subject: 'Hi {{first_name}}', body: '<p>welcome</p>', template_key: null });
});

test('blocks a whatsapp step with no template', async () => {
  render(<SalesSequences />);
  await screen.findByText('No sequences yet');
  fireEvent.click(screen.getAllByText('+ New sequence')[0]);
  fireEvent.change(screen.getByPlaceholderText('Name (e.g. New Lead nurture)'), { target: { value: 'X' } });
  // switch the single step to whatsapp (no template picked)
  fireEvent.change(screen.getByDisplayValue('email'), { target: { value: 'whatsapp' } });
  fireEvent.click(screen.getByText('Create sequence'));
  await waitFor(() => {}); // let the submit handler run
  expect(crmCreateSequence).not.toHaveBeenCalled();
});
