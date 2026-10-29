import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InfiniteFeed } from '../InfiniteFeed';

const row = (item) => <div key={item.id} data-testid="row">{item.name}</div>;

describe('InfiniteFeed', () => {
  it('shows skeletons on first load', () => {
    const { container } = render(
      <InfiniteFeed items={[]} renderItem={row} loading skeletonCount={3} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows ErrorState with retry on first-load error', () => {
    const onRetry = vi.fn();
    render(<InfiniteFeed items={[]} renderItem={row} error="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when settled and empty', () => {
    render(<InfiniteFeed items={[]} renderItem={row} empty={<div>None yet</div>} />);
    expect(screen.getByText('None yet')).toBeInTheDocument();
  });

  it('renders items when present', () => {
    render(<InfiniteFeed items={[{ id: 1, name: 'A' }, { id: 2, name: 'B' }]} renderItem={row} />);
    expect(screen.getAllByTestId('row')).toHaveLength(2);
  });
});
