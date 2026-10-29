import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import useBackgroundCanvas from '../useBackgroundCanvas';

function Probe() {
  const ref = useBackgroundCanvas({ draw: () => {} });
  return <div style={{ width: 200, height: 100 }}><canvas ref={ref} /></div>;
}
afterEach(cleanup);

describe('useBackgroundCanvas', () => {
  it('mounts a canvas ref without throwing', () => {
    const { container } = render(<Probe />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
