import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let flags = {};
vi.mock('../../../context/FeatureContext', () => ({ useFeatures: () => ({ flags }), useFeature: () => true }));
import { PublicCenterNav } from '../Navbar';

const nav = () => render(<MemoryRouter><PublicCenterNav /></MemoryRouter>);

describe('Navbar Community link', () => {
  test('hidden when the community flag is off', () => { flags = { community: false }; nav(); expect(screen.queryByRole('link', { name: 'Community' })).toBeNull(); });
  test('hidden when the flag is unknown (fail-open must not leak pre-launch)', () => { flags = {}; nav(); expect(screen.queryByRole('link', { name: 'Community' })).toBeNull(); });
  test('shown when the flag is truly on', () => { flags = { community: true }; nav(); expect(screen.getByRole('link', { name: 'Community' }).getAttribute('href')).toBe('/community'); });
});
