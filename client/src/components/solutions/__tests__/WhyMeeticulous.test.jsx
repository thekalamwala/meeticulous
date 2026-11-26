import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WhyMeeticulous from '../WhyMeeticulous';

describe('Why Meeticulous feature stack', () => {
  it('advances when the card body is clicked and does not double-advance buttons', () => {
    render(<WhyMeeticulous />);
    fireEvent.click(screen.getByRole('heading', { name: 'Verified experts' }));
    expect(screen.getByRole('heading', { name: 'Flexible scheduling' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next up: Secure payments' }));
    expect(screen.getByRole('heading', { name: 'Secure payments' })).toBeTruthy();
  });

  it('opens with verified experts and supports arrows and selecting a stacked card', () => {
    render(<WhyMeeticulous />);
    expect(screen.getByRole('heading', { name: 'Verified experts' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));
    expect(screen.getByRole('heading', { name: 'Flexible scheduling' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Secure payments' }));
    expect(screen.getByRole('heading', { name: 'Secure payments' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous feature' }));
    expect(screen.getByRole('heading', { name: 'Flexible scheduling' })).toBeTruthy();
  });

  it('rotates automatically and pauses while the cards are hovered', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      render(<WhyMeeticulous />);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByRole('heading', { name: 'Flexible scheduling' })).toBeTruthy();
      const stack = screen.getByRole('region', { name: 'Why Meeticulous features' });
      fireEvent.mouseEnter(stack);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByRole('heading', { name: 'Flexible scheduling' })).toBeTruthy();
      fireEvent.mouseLeave(stack);
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByRole('heading', { name: 'Secure payments' })).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });
});
