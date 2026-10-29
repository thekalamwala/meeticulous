import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextMenu } from '../ContextMenu';

describe('ContextMenu', () => {
  it('opens on click (openOnClick) and fires the selected action', () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        openOnClick
        trigger={<button>More</button>}
        items={[{ label: 'Cancel booking', danger: true, onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel booking/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
