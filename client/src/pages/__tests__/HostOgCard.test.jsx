import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HostOgCard from '../HostOgCard';

const renderCard = (query) =>
  render(
    <MemoryRouter initialEntries={[`/og/host/priya?${query}`]}>
      <Routes>
        <Route path="/og/host/:username" element={<HostOgCard />} />
      </Routes>
    </MemoryRouter>,
  );

describe('HostOgCard (share-card render target)', () => {
  it('established host: name, profession + rating, @username, proof, CTA', () => {
    renderCard('name=Priya+Sharma&profession=Clinical+Psychologist&username=priya&rating=4.9&reviews=247&bookings=820&since=2024&verified=1');
    expect(screen.getByText('Priya Sharma')).toBeTruthy();
    expect(screen.getByText('Clinical Psychologist')).toBeTruthy();
    expect(screen.getByText('www.meeticulous.com')).toBeTruthy(); // brand, top-left
    expect(screen.getByText('@priya')).toBeTruthy();           // handle under the portrait
    expect(screen.getByText('✓')).toBeTruthy();                // single verified mark
    expect(screen.getByText(/4\.9/)).toBeTruthy();             // rating chip beside profession
    expect(screen.getByText(/247 reviews/)).toBeTruthy();
    expect(screen.getByText(/820\+ booked/)).toBeTruthy();     // compact() rounds 820 -> "820+"
    expect(screen.getByText('Book an Appointment Now')).toBeTruthy();
  });

  it('brand-new host: honest state, no verified mark, no rating chip', () => {
    renderCard('name=Aarav+Mehta&profession=Startup+Mentor&username=aarav&rating=0&reviews=0&bookings=0&since=2026');
    expect(screen.getByText('Aarav Mehta')).toBeTruthy();
    expect(screen.getByText('@aarav')).toBeTruthy();
    expect(screen.getByText(/New host/)).toBeTruthy();         // not a hollow "0.0 / 0 bookings"
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('is noindex — it is an art board, never a page', () => {
    renderCard('name=Priya&username=priya');
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toBe('noindex');
  });
});
