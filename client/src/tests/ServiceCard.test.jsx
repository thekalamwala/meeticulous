import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({ logExploreClick: vi.fn() }));
import ServiceCard from '../components/guest/ServiceCard';

const base = {
  id: 'svc1', slug: 'wedding', title: 'Offline Meeting',
  description: 'A full day of coverage.',
  price: 499, currency: 'INR', coverImage: 'c.jpg',
  hostName: 'Shubham Datarkar', hostUsername: 'shubham', hostAvatar: 'a.jpg',
  avgRating: 4.5, reviewCount: 28, area: 'Nagpur', meetingMode: 'offline',
  url: '/shubham/wedding', badges: {},
};

const renderCard = (over = {}) =>
  render(
    <MemoryRouter>
      <ServiceCard service={{ ...base, ...over }} rank={1} />
    </MemoryRouter>
  );

test('renders title, host, price and links to the service', () => {
  renderCard();
  expect(screen.getByRole('heading').textContent).toBe('Offline Meeting');
  expect(screen.getByText('Shubham Datarkar')).toBeInTheDocument();
  expect(screen.getByText('₹499')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/shubham/wedding');
});

test('rating line is hidden when there are no reviews', () => {
  renderCard({ reviewCount: 0, avgRating: null });
  expect(screen.queryByText(/review/i)).toBeNull();
  expect(screen.queryByText('4.5')).toBeNull();
});

test('description block is omitted when the host wrote none', () => {
  renderCard({ description: '' });
  expect(screen.queryByText('A full day of coverage.')).toBeNull();
});

test('free services show Free with no starts-at or per-session scaffolding', () => {
  renderCard({ price: 0 });
  expect(screen.getByText('Free')).toBeInTheDocument();
  expect(screen.queryByText(/starts at/i)).toBeNull();
  expect(screen.queryByText(/per session/i)).toBeNull();
});

test('mode pill uses the site vocabulary, not the raw column value', () => {
  renderCard({ meetingMode: 'offline' });
  expect(screen.getByText('In-person')).toBeInTheDocument();
});

test('online services read Online', () => {
  renderCard({ meetingMode: 'online' });
  expect(screen.getByText('Online')).toBeInTheDocument();
});
