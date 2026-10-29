import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwipeActions } from '../SwipeActions';

describe('SwipeActions', () => {
  it('renders content and right actions, fires onAction', () => {
    const onAction = vi.fn();
    render(
      <SwipeActions right={[{ label: 'Delete', color: '#ef4444', onAction }]}>
        <div>Row content</div>
      </SwipeActions>,
    );
    expect(screen.getByText('Row content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
