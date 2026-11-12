import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import useMentionSuggest from '../useMentionSuggest';

const searchMentions = vi.fn(() => Promise.resolve({
  members: [{ id: 'u1', username: 'tithi', name: 'Tithi', avatar_url: null, role: 'staff' }],
}));
vi.mock('../../../services/communityApi', () => ({ searchMentions: (...a) => searchMentions(...a) }));

function Harness() {
  const [v, setV] = useState('');
  const ref = useRef(null);
  const m = useMentionSuggest({ value: v, setValue: setV, inputRef: ref });
  return (
    <div>
      <textarea data-testid="ta" ref={ref} value={v} onChange={m.onChange} onKeyDown={m.onKeyDown} {...m.aria} />
      {m.list}
      <output data-testid="val">{v}</output>
    </div>
  );
}

test('typing @ queries members and selecting inserts @username', async () => {
  const u = userEvent.setup();
  render(<Harness />);
  await u.type(screen.getByTestId('ta'), 'hi @ti');

  const opt = await screen.findByRole('option', { name: /Tithi/ });
  expect(searchMentions).toHaveBeenCalled();
  await u.click(opt);

  expect(screen.getByTestId('val').textContent).toBe('hi @tithi ');
  // the list closes after insert
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('a non-@ word opens nothing', async () => {
  const u = userEvent.setup();
  render(<Harness />);
  await u.type(screen.getByTestId('ta'), 'just text');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
