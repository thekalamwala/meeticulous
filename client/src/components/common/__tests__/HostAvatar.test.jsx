import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { HostAvatar, HostCover } from '../HostAvatar';

afterEach(cleanup);

describe('HostAvatar', () => {
  it('renders an <img> with the src and lazy-loads by default', () => {
    const { container } = render(<HostAvatar src="https://x.supabase.co/i.jpg" name="Asha" size={40} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://x.supabase.co/i.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe("Asha's profile photo");
  });

  it('loads eagerly when eager', () => {
    const { container } = render(<HostAvatar src="https://x/i.jpg" name="Asha" eager />);
    expect(container.querySelector('img').getAttribute('loading')).toBe('eager');
  });

  it('falls back to initials (no network) when src is empty', () => {
    const { container } = render(<HostAvatar src="" name="Bhola" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('B');
  });

  it('uses "?" when no name and empty src', () => {
    const { container } = render(<HostAvatar src="" name="" />);
    expect(container.textContent).toBe('?');
  });

  it('emits empty alt when decorative', () => {
    const { container } = render(<HostAvatar src="https://x/i.jpg" name="Asha" decorative />);
    expect(container.querySelector('img').getAttribute('alt')).toBe('');
  });
});

describe('HostCover', () => {
  it('renders an <img> when a src is given', () => {
    const { container } = render(<HostCover src="https://x/c.jpg" themeColor="#2E1065" />);
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('renders a gradient div (no img) when src is empty', () => {
    const { container } = render(<HostCover src="" themeColor="#2E1065" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstChild.style.background).toContain('linear-gradient');
  });

  it('sets fetchpriority high only when eager', () => {
    const { container } = render(<HostCover src="https://x/c.jpg" eager />);
    expect(container.querySelector('img').getAttribute('fetchpriority')).toBe('high');
  });
});
