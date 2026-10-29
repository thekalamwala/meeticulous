import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders title and message', () => {
    render(<ErrorState title="Oops" message="It broke" />);
    expect(screen.getByText('Oops')).toBeInTheDocument();
    expect(screen.getByText('It broke')).toBeInTheDocument();
  });

  it('shows retry only when onRetry given and fires it', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="x" />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ErrorState message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
