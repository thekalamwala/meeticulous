import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProfileDrawer from '../ProfileDrawer';

test('drawer is a labelled dialog, Esc closes, and there is no Follow', async () => {
  const onClose = vi.fn();
  const u = userEvent.setup();
  render(
    <MemoryRouter>
      <ProfileDrawer open onClose={onClose} user={{ name: 'Aastha', is_host: true, username: 'aastha' }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('dialog', { name: /profile menu/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view full profile/i })).toBeInTheDocument();
  expect(screen.queryByText(/follow/i)).not.toBeInTheDocument();

  await u.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});

test('a closed drawer renders nothing', () => {
  const { container } = render(
    <MemoryRouter><ProfileDrawer open={false} onClose={() => {}} user={{}} /></MemoryRouter>,
  );
  expect(container).toBeEmptyDOMElement();
});
