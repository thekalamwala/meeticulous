import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunityGuidelines from '../CommunityGuidelines';

test('guidelines show the terms version, grievance officer and timelines', () => {
  render(<MemoryRouter><CommunityGuidelines /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  expect(screen.getByText(/2026-11-v1/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: /grievance officer/i })).toBeTruthy();
  expect(screen.getByText(/24 hours/)).toBeTruthy();
  expect(screen.getByText(/15 days/)).toBeTruthy();
});
