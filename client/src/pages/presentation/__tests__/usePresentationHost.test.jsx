import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePresentationHost } from '../usePresentationHost';
import { FALLBACK_HOST } from '../demoData';

describe('usePresentationHost', () => {
  it('returns the curated persona synchronously (no live/internal fetch)', () => {
    const { result } = renderHook(() => usePresentationHost());
    expect(result.current.host.name).toBe(FALLBACK_HOST.name);
    expect(result.current.services).toBe(FALLBACK_HOST.services);
    expect(result.current.loading).toBe(false);
    expect(result.current.source).toBe('curated');
  });

  it('never exposes a ₹1 / internal service in the demo host', () => {
    const { result } = renderHook(() => usePresentationHost());
    const prices = result.current.services.map((s) => s.price);
    expect(prices.every((p) => p === 0 || p >= 100)).toBe(true);
    expect(result.current.services.some((s) => /kyc|app (online )?demo/i.test(s.title))).toBe(false);
  });
});
