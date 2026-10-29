import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('../services/api', () => ({ getFeatureFlags: vi.fn() }));
import { getFeatureFlags } from '../services/api';
import useFeatureFlags, { _resetFlagCache } from '../hooks/useFeatureFlags';

function Probe() {
  const { on } = useFeatureFlags();
  return <span>{on('reschedule') ? 'on' : 'off'}|{on('unknown') ? 'on' : 'off'}</span>;
}

beforeEach(() => { _resetFlagCache(); vi.clearAllMocks(); });

test('reads flags; unknown keys fail open to on', async () => {
  getFeatureFlags.mockResolvedValue({ data: { reschedule: false } });
  render(<Probe />);
  await waitFor(() => expect(screen.getByText('off|on')).toBeInTheDocument());
});
