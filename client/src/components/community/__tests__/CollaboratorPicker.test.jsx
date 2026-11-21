import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

vi.mock('../../../services/communityApi', () => ({ searchMentions: vi.fn() }));
import { searchMentions } from '../../../services/communityApi';
import CollaboratorPicker from '../CollaboratorPicker';

const MEMBERS = [
  { id: 'a', name: 'Ava', username: 'ava', avatar_url: null },
  { id: 'b', name: 'Bo', username: 'bo', avatar_url: null },
  { id: 'c', name: 'Cy', username: 'cy', avatar_url: null },
];

function Harness({ selfId }) {
  const [val, setVal] = useState([]);
  return <CollaboratorPicker value={val} onChange={setVal} selfId={selfId} />;
}

beforeEach(() => { vi.clearAllMocks(); searchMentions.mockResolvedValue({ members: MEMBERS }); });

it('searches and adds a collaborator as a chip', async () => {
  render(<Harness />);
  await userEvent.type(screen.getByRole('searchbox'), 'a');
  await userEvent.click(await screen.findByRole('button', { name: /Ava/ }));
  expect(screen.getByText('Ava')).toBeInTheDocument(); // chip
});

it('caps at 2 collaborators', async () => {
  render(<Harness />);
  await userEvent.type(screen.getByRole('searchbox'), 'x');
  await userEvent.click(await screen.findByRole('button', { name: /Ava/ }));
  await userEvent.click(await screen.findByRole('button', { name: /Bo/ }));
  expect(screen.getByText(/up to 2/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cy/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

it('excludes the current user from results', async () => {
  render(<Harness selfId="a" />);
  await userEvent.type(screen.getByRole('searchbox'), 'x');
  await screen.findByRole('button', { name: /Bo/ });
  expect(screen.queryByRole('button', { name: /Ava/ })).not.toBeInTheDocument();
});

it('removes a picked collaborator', async () => {
  render(<Harness />);
  await userEvent.type(screen.getByRole('searchbox'), 'x');
  await userEvent.click(await screen.findByRole('button', { name: /Ava/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove Ava' }));
  expect(screen.queryByText('Ava')).not.toBeInTheDocument();
});
