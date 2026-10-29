import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPress } from '../useLongPress';

function Probe({ onLongPress }) {
  const handlers = useLongPress(onLongPress, { delay: 400 });
  return <div data-testid="target" {...handlers}>hold</div>;
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay', () => {
    const cb = vi.fn();
    render(<Probe onLongPress={cb} />);
    fireEvent.pointerDown(screen.getByTestId('target'));
    act(() => { vi.advanceTimersByTime(400); });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cancels if released early', () => {
    const cb = vi.fn();
    render(<Probe onLongPress={cb} />);
    const el = screen.getByTestId('target');
    fireEvent.pointerDown(el);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(el);
    act(() => { vi.advanceTimersByTime(400); });
    expect(cb).not.toHaveBeenCalled();
  });
});
