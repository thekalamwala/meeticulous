// client/src/components/admin/__tests__/AdminFilters.test.jsx
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import AdminFilters from '../ui/AdminFilters';

const CONFIG = [
  { key: 'stage', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'won', label: 'Won' }] },
  { key: 'tags', label: 'Tags', multi: true, options: [{ value: 'vip', label: 'VIP' }, { value: 'cold', label: 'Cold' }] },
];

// Controlled harness so onChange round-trips through real state.
function Harness({ onChange }) {
  const [value, setValue] = useState({});
  return <AdminFilters config={CONFIG} value={value} onChange={(v) => { setValue(v); onChange?.(v); }} />;
}

describe('AdminFilters', () => {
  it('adds a single-select filter, applies a value, then removes it', () => {
    render(<Harness />);

    // + Filter → pick "Stage"
    fireEvent.click(screen.getByText('Add filter'));
    fireEvent.click(screen.getByText('Stage'));
    // chip shows, value "any" until picked
    expect(screen.getByText('any')).toBeTruthy();
    // value panel searchable list → pick Won (single-select closes panel)
    fireEvent.click(screen.getByText('Won'));
    expect(screen.getByText('Won')).toBeTruthy();
    expect(screen.queryByText('any')).toBeNull();

    // remove the chip via its × button → dimension is back on the add menu
    const chip = screen.getByText('Stage').closest('div');
    fireEvent.click(within(chip).getByTitle('Remove filter'));
    expect(screen.queryByText('Won')).toBeNull();
    expect(screen.getByText('Add filter')).toBeTruthy();
  });

  it('multi-select toggles values and keeps the panel open', () => {
    const seen = [];
    render(<Harness onChange={(v) => seen.push(v)} />);

    fireEvent.click(screen.getByText('Add filter'));
    fireEvent.click(screen.getByText('Tags'));
    fireEvent.click(screen.getByText('VIP'));   // panel stays open (multi)
    fireEvent.click(screen.getByText('Cold'));

    const last = seen[seen.length - 1];
    expect(Array.isArray(last.tags)).toBe(true);
    expect(last.tags).toEqual(['vip', 'cold']);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });
});
