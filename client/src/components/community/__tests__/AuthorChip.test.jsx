import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthorChip from '../AuthorChip';

const author = { display_name: 'Ravi', profile_url: '/ravi', role: 'host' };
const collab = (over) => ({ id: 'a', display_name: 'Ava', profile_url: '/ava', ...over });
const r = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

it('links each collaborator next to the author', () => {
  r(<AuthorChip author={author} collaborators={[collab(), collab({ id: 'b', display_name: 'Bo', profile_url: '/bo' })]} />);
  expect(screen.getByRole('link', { name: 'Ava' })).toHaveAttribute('href', '/ava');
  expect(screen.getByRole('link', { name: 'Bo' })).toHaveAttribute('href', '/bo');
});

it('renders no collaborator row when empty', () => {
  r(<AuthorChip author={author} />);
  expect(screen.queryByRole('link', { name: 'Ava' })).not.toBeInTheDocument();
});

it('renders a collaborator without a profile as plain text, not a link', () => {
  r(<AuthorChip author={author} collaborators={[collab({ profile_url: null, display_name: 'Guesty' })]} />);
  expect(screen.getByText('Guesty')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Guesty' })).not.toBeInTheDocument();
});
