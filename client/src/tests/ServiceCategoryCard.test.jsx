import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceCategoryCard from '../components/services/ServiceCategoryCard';

const svc = { name: 'Wedding Photography', slug: 'wedding-photography', description: 'Capture your day.', icon: null };

test('renders name, description and CTA link with pair params', () => {
  render(<MemoryRouter><ServiceCategoryCard service={svc} profession="photographer" /></MemoryRouter>);
  expect(screen.getByText('Wedding Photography').tagName).toBe('H3');
  expect(screen.getByText('Capture your day.')).toBeInTheDocument();
  const cta = screen.getByRole('link', { name: /find professionals/i });
  expect(cta.getAttribute('href')).toBe('/explore?category=photographer&service=wedding-photography');
});
