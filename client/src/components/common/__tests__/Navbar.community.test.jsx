import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Navbar no longer reads the community flag, but keep the mock so the import graph
// resolves the same way regardless of provider changes.
let flags = {};
vi.mock('../../../context/FeatureContext', () => ({ useFeatures: () => ({ flags }), useFeature: () => true }));
import { PublicCenterNav } from '../Navbar';

const nav = (entries = ['/']) => render(<MemoryRouter initialEntries={entries}><PublicCenterNav /></MemoryRouter>);

describe('Navbar Community link', () => {
  // The standalone "Community" nav item was removed; the section is reached elsewhere
  // and the logo lockup carries the name on /community routes.
  test('absent when the community flag is off', () => { flags = { community: false }; nav(); expect(screen.queryByRole('link', { name: 'Community' })).toBeNull(); });
  test('absent when the flag is on (no public nav link anymore)', () => { flags = { community: true }; nav(); expect(screen.queryByRole('link', { name: 'Community' })).toBeNull(); });
  test('absent on community routes', () => { flags = { community: true }; nav(['/community']); expect(screen.queryByRole('link', { name: 'Community' })).toBeNull(); });
});
