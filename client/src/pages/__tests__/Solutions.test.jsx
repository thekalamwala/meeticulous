import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Solutions from '../Solutions';

const renderPage = () => render(<MemoryRouter><Solutions /></MemoryRouter>);

describe('Solutions profession browser', () => {
  it('shows the discover, schedule and meet hero preview with a working guide link', () => {
    renderPage();
    expect(screen.getByRole('img', { name: 'Discover an expert, schedule a session, and meet online' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See how it works' }).getAttribute('href')).toBe('/how-it-works');
    expect(screen.getByPlaceholderText('Search by profession, skill, or industry...')).toBeTruthy();
  });

  it('gives every profession its own illustration and crawlable destination', () => {
    renderPage();
    const browser = screen.getByRole('region', { name: 'Profession categories' });
    const cards = within(browser).getAllByRole('link');
    expect(cards).toHaveLength(26);
    expect(cards[0].getAttribute('href')).toBe('/for/architects');
    const images = cards.map((card) => card.querySelector('img').getAttribute('src'));
    expect(new Set(images).size).toBe(26);
    expect(images.every((src) => src.startsWith('/images/professions/'))).toBe(true);
    expect(screen.queryByRole('slider', { name: 'Browse professions' })).toBeNull();
  });

  it('filters professions by category and restores the full directory', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Finance & Law' }));
    const browser = screen.getByRole('region', { name: 'Profession categories' });
    expect(within(browser).getAllByRole('link')).toHaveLength(3);
    expect(within(browser).getByRole('link', { name: /Lawyers & Advocates/ }).getAttribute('href')).toBe('/for/lawyers');
    expect(within(browser).getByRole('link', { name: /Business Consultants/ }).getAttribute('href')).toBe('/for/business-consultant');
    expect(within(browser).queryByRole('link', { name: /Architects & Designers/ })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Finance & Law' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(within(browser).getAllByRole('link')).toHaveLength(26);
  });

  it('supports keyboard navigation between category tabs', () => {
    renderPage();
    const all = screen.getByRole('tab', { name: 'All' });
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    const design = screen.getByRole('tab', { name: 'Design & Architecture' });
    expect(document.activeElement).toBe(design);
    expect(design.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(design, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Events & Creative' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement, { key: 'Home' });
    expect(all.getAttribute('aria-selected')).toBe('true');
  });

  it('advances every two seconds, pauses for interaction, and loops at the end', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      renderPage();
      const track = screen.getByRole('region', { name: 'Profession categories' });
      Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 2000 });
      Object.defineProperty(track, 'clientWidth', { configurable: true, value: 1000 });
      Object.defineProperty(track.firstElementChild, 'offsetWidth', { configurable: true, value: 250 });
      track.scrollBy = vi.fn();
      track.scrollTo = vi.fn();
      act(() => vi.advanceTimersByTime(1999));
      expect(track.scrollBy).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(track.scrollBy).toHaveBeenCalledWith({ left: 266, behavior: 'smooth' });
      const card = track.firstElementChild;
      fireEvent.mouseEnter(card);
      act(() => vi.advanceTimersByTime(2000));
      expect(track.scrollBy).toHaveBeenCalledTimes(1);
      fireEvent.mouseLeave(card);
      track.scrollLeft = 1000;
      act(() => vi.advanceTimersByTime(2000));
      expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'instant' });
      expect(screen.queryByRole('button', { name: 'Pause automatic scrolling' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
