import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import NextStepCard from './NextStepCard';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
const nudge = { key: 'calendar', title: 'T', body: 'B', cta: 'Connect', action: 'connectCalendar', tone: 'primary', icon: 'CalendarCheck' };
const setup = (onAction) => render(<MemoryRouter><NextStepCard nudge={nudge} onAction={onAction} /></MemoryRouter>);

describe('NextStepCard action button', () => {
  it('disables while connecting so double-clicks fire once', async () => {
    const onAction = vi.fn(() => new Promise(() => {}));
    setup(onAction);
    const btn = screen.getByRole('button', { name: 'Connect' });
    fireEvent.click(btn); fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
  });

  it('toasts and re-enables when the action rejects', async () => {
    setup(vi.fn().mockRejectedValue(new Error('net')));
    const btn = screen.getByRole('button', { name: 'Connect' });
    fireEvent.click(btn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not start Google connection. Try again.'));
    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
