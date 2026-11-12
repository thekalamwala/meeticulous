import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LinkifiedText from '../LinkifiedText';

const renderR = (ui) => render(ui, { wrapper: MemoryRouter });

test('links a URL with ugc rel and turns \\n into <br>', () => {
  const { container } = render(<LinkifiedText text={'see https://x.com\nok'} />);
  const links = container.querySelectorAll('a');
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('https://x.com');
  expect(links[0].getAttribute('rel')).toBe('ugc nofollow noopener');
  expect(links[0].getAttribute('target')).toBe('_blank');
  expect(container.querySelectorAll('br')).toHaveLength(1);
  expect(container.textContent).toBe('see https://x.comok');
});

test('markup renders as text, never as elements', () => {
  const { container } = render(<LinkifiedText text={'<img src=x onerror=alert(1)>'} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
});

test('bare domains link only on the server allowlist TLDs; trailing punctuation stays text', () => {
  const { container } = render(<LinkifiedText text={'Try www.foo.co.uk, or bar.com. Not done.Thanks or 5.30pm'} />);
  const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs).toEqual(['https://www.foo.co.uk', 'https://bar.com']);
  expect(container.textContent).toBe('Try www.foo.co.uk, or bar.com. Not done.Thanks or 5.30pm');
});

test('a javascript: scheme is never a link', () => {
  const { container } = render(<LinkifiedText text={'javascript:alert(1)'} />);
  expect(container.querySelector('a')).toBeNull();
});

test('@mentions link to /<username> and keep the @ in the text', () => {
  const { container } = renderR(<LinkifiedText text={'thanks @team and @Priya-, see you'} />);
  const links = [...container.querySelectorAll('a')];
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/team', '/priya']);
  expect(links.map((a) => a.textContent)).toEqual(['@team', '@Priya']);
  expect(container.textContent).toBe('thanks @team and @Priya-, see you');
});

test('an email address is not mistaken for a mention', () => {
  const { container } = renderR(<LinkifiedText text={'mail me at a@b.io please'} />);
  // @b must NOT become a mention link (preceded by a word char); b.io may still URL-link.
  expect(container.querySelector('a[href="/b"]')).toBeNull();
  expect(container.textContent).toBe('mail me at a@b.io please');
});

test('a mention sits correctly alongside a URL on the same line', () => {
  const { container } = renderR(<LinkifiedText text={'@team see https://x.com now'} />);
  const links = [...container.querySelectorAll('a')];
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/team', 'https://x.com']);
  expect(container.textContent).toBe('@team see https://x.com now');
});
