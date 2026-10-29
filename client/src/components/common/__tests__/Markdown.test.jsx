import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Markdown from '../Markdown';

const html = (node) => {
  const { container } = render(<MemoryRouter>{node}</MemoryRouter>);
  return container;
};

describe('Markdown externalLinks prop', () => {
  it('strip: external link renders as plain text, no anchor', () => {
    const c = html(<Markdown source="See [x](https://evil.com) here" externalLinks="strip" />);
    expect(c.querySelector('a[href^="http"]')).toBeNull();
    expect(c.textContent).toContain('x');
  });
  it('strip: internal link still renders as a link', () => {
    const c = html(<Markdown source="Go to [My Bookings](/my-bookings)" externalLinks="strip" />);
    expect(c.querySelector('a[href="/my-bookings"]')).not.toBeNull();
  });
  it('allow (default): external link renders as an anchor', () => {
    const c = html(<Markdown source="See [x](https://ok.com)" />);
    expect(c.querySelector('a[href="https://ok.com"]')).not.toBeNull();
  });
  it('strip: protocol-relative // link renders as plain text, no anchor', () => {
    const c = html(<Markdown source="see [x](//evil.com)" externalLinks="strip" />);
    expect(c.querySelector('a')).toBeNull();
    expect(c.textContent).toContain('x');
  });
});

describe('Markdown inline formatting', () => {
  it('renders *italic* as <em>', () => {
    const c = html(<Markdown source="this is *very* important" />);
    expect(c.querySelector('em')?.textContent).toBe('very');
  });
  it('keeps **bold** as <strong>, not two italics', () => {
    const c = html(<Markdown source="**payout** works" />);
    expect(c.querySelector('strong')?.textContent).toBe('payout');
    expect(c.querySelector('em')).toBeNull();
  });
  it('autolinks a bare http(s) URL', () => {
    const c = html(<Markdown source="Docs at https://meeticulous.com/help now" />);
    const a = c.querySelector('a[href="https://meeticulous.com/help"]');
    expect(a).not.toBeNull();
    expect(a.getAttribute('target')).toBe('_blank');
  });
  it('does not swallow the trailing period after a bare URL', () => {
    const c = html(<Markdown source="See https://meeticulous.com." />);
    expect(c.querySelector('a')?.getAttribute('href')).toBe('https://meeticulous.com');
    expect(c.textContent).toContain('.');
  });
  it('never autolinks a javascript: URL', () => {
    const c = html(<Markdown source="click javascript:alert(1) now" />);
    expect(c.querySelector('a')).toBeNull();
  });
});
