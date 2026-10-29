// client/src/components/admin/__tests__/useAdminTheme.test.js
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminTheme } from '../useAdminTheme';

beforeEach(() => localStorage.clear());

describe('useAdminTheme', () => {
  it('defaults to light', () => {
    const { result } = renderHook(() => useAdminTheme());
    expect(result.current[0]).toBe('light');
  });

  it('toggles and persists to localStorage', () => {
    const { result } = renderHook(() => useAdminTheme());
    act(() => result.current[1]());
    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem('adm_theme')).toBe('dark');
    act(() => result.current[1]());
    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem('adm_theme')).toBe('light');
  });

  it('reads persisted value on mount', () => {
    localStorage.setItem('adm_theme', 'dark');
    const { result } = renderHook(() => useAdminTheme());
    expect(result.current[0]).toBe('dark');
  });
});
