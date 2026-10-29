import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AvailabilityFeature, { slotStarts } from '../features/AvailabilityFeature';

describe('slotStarts', () => {
  // Same stepping as computeSlots() in server/services/availabilityService.js:
  // a slot every (duration + buffer) minutes that must end inside the 480-min day.
  it('fits the expected number of sessions in a 9 to 5 day', () => {
    expect(slotStarts(60, 0)).toHaveLength(8);
    expect(slotStarts(60, 15)).toHaveLength(6);
    expect(slotStarts(30, 0)).toHaveLength(16);
    expect(slotStarts(45, 10)).toHaveLength(8);
  });
});

describe('Availability feature page', () => {
  const renderPage = () => render(<MemoryRouter><AvailabilityFeature /></MemoryRouter>);

  it('renders one h1 and real CTA targets', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /start free/i })[0].getAttribute('href')).toBe('/be-a-sloth');
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /try the buffer maths/i }).getAttribute('href')).toBe('#buffer');
  });

  it('updates the weekly slot count when a block is toggled', () => {
    renderPage();
    const count = screen.getByTestId('week-slots');
    expect(count.textContent).toBe('44');
    fireEvent.click(screen.getByRole('button', { name: 'Monday 9 AM' }));
    expect(count.textContent).toBe('42');
    fireEvent.click(screen.getByRole('button', { name: /open all of sunday/i }));
    expect(count.textContent).toBe('50');
  });

  it('recounts sessions when duration or buffer changes', () => {
    renderPage();
    const day = screen.getByTestId('day-slots');
    expect(day.textContent).toBe('6');
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(day.textContent).toBe('8');
    fireEvent.click(screen.getByRole('radio', { name: '30 min' }));
    expect(day.textContent).toBe('16');
  });
});
